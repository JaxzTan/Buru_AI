package honeypot

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/JaxzTan/Buru_AI/internal/db"
	"github.com/JaxzTan/Buru_AI/internal/extraction"
	"github.com/JaxzTan/Buru_AI/internal/persona"
)

// ---- personas (FR-1, TR-1) ----

type PersonaInput struct {
	Name          string          `json:"name"`
	Age           int             `json:"age"`
	LanguageMix   json.RawMessage `json:"language_mix"`
	Backstory     string          `json:"backstory"`
	WealthProfile json.RawMessage `json:"wealth_profile"`
	Profile       json.RawMessage `json:"profile"`
	Status        string          `json:"status"`        // default draft
	SystemPrompt  string          `json:"system_prompt"` // optional; stored as prompt version 1
	ScamTypes     []string        `json:"scam_types"`    // playbooks to attach
}

type PersonaView struct {
	db.Persona
	PromptVersion int      `json:"prompt_version"`
	ScamTypes     []string `json:"scam_types"`
}

func (s *Service) Personas(ctx context.Context) ([]PersonaView, error) {
	rows, err := s.Q.ListPersonas(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]PersonaView, 0, len(rows))
	for _, p := range rows {
		v, err := s.personaView(ctx, p)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, nil
}

func (s *Service) personaView(ctx context.Context, p db.Persona) (PersonaView, error) {
	v := PersonaView{Persona: p, ScamTypes: []string{}}
	if pv, err := s.Q.LatestPromptVersion(ctx, p.ID); err == nil {
		v.PromptVersion = int(pv.Version)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return v, err
	}
	pbs, err := s.Q.ListPersonaPlaybooks(ctx, p.ID)
	if err != nil {
		return v, err
	}
	for _, pb := range pbs {
		v.ScamTypes = append(v.ScamTypes, string(pb.ScamType))
	}
	return v, nil
}

func (s *Service) CreatePersona(ctx context.Context, in PersonaInput, operatorID int64) (PersonaView, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || len(in.Name) > 100 {
		return PersonaView{}, fmt.Errorf("%w: name is required (max 100 chars)", ErrBadRequest)
	}
	if len(in.LanguageMix) == 0 || !json.Valid(in.LanguageMix) {
		return PersonaView{}, fmt.Errorf("%w: language_mix must be a JSON object such as {\"en\":0.6,\"ms\":0.4}", ErrBadRequest)
	}
	status := db.PersonaStatus(in.Status)
	if in.Status == "" {
		status = db.PersonaStatusDraft
	}
	if !status.Valid() {
		return PersonaView{}, fmt.Errorf("%w: status must be draft, active, paused or retired", ErrBadRequest)
	}
	var created db.Persona
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		var err error
		created, err = q.CreatePersonaWithProfile(ctx, db.CreatePersonaWithProfileParams{
			Name: in.Name, Age: pgtype.Int2{Int16: int16(in.Age), Valid: in.Age > 0}, LanguageMix: in.LanguageMix,
			Backstory: pgtype.Text{String: in.Backstory, Valid: in.Backstory != ""}, WealthProfile: nullJSON(in.WealthProfile),
			Status: status, Profile: nullJSON(in.Profile),
		})
		if err != nil {
			return err
		}
		if strings.TrimSpace(in.SystemPrompt) != "" {
			if _, err := q.CreatePromptVersion(ctx, db.CreatePromptVersionParams{PersonaID: created.ID,
				SystemPrompt: in.SystemPrompt, CreatedBy: opID(operatorID)}); err != nil {
				return err
			}
		}
		return setPlaybooks(ctx, q, created.ID, in.ScamTypes)
	})
	if err != nil {
		return PersonaView{}, err
	}
	return s.personaView(ctx, created)
}

// SetPersonaStatus moves a persona through draft → active → paused → retired (FR-1, PRD v0.2).
func (s *Service) SetPersonaStatus(ctx context.Context, id int64, status string) error {
	st := db.PersonaStatus(status)
	if !st.Valid() {
		return fmt.Errorf("%w: status must be draft, active, paused or retired", ErrBadRequest)
	}
	if _, err := s.Q.GetPersona(ctx, id); err != nil {
		return notFound(err)
	}
	_, err := s.Q.SetPersonaStatus(ctx, db.SetPersonaStatusParams{ID: id, Status: st})
	return err
}

// NewPromptVersion stores an edited prompt as the next version; old versions are kept (TR-1).
func (s *Service) NewPromptVersion(ctx context.Context, personaID, operatorID int64, prompt string) (db.PersonaPromptVersion, error) {
	if strings.TrimSpace(prompt) == "" {
		return db.PersonaPromptVersion{}, fmt.Errorf("%w: system_prompt is required", ErrBadRequest)
	}
	if _, err := s.Q.GetPersona(ctx, personaID); err != nil {
		return db.PersonaPromptVersion{}, notFound(err)
	}
	// CreatePromptVersion assigns the next version number itself.
	return s.Q.CreatePromptVersion(ctx, db.CreatePromptVersionParams{PersonaID: personaID, SystemPrompt: prompt, CreatedBy: opID(operatorID)})
}

func (s *Service) SetPersonaPlaybooks(ctx context.Context, personaID int64, scamTypes []string) error {
	if _, err := s.Q.GetPersona(ctx, personaID); err != nil {
		return notFound(err)
	}
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if err := q.DetachPlaybooks(ctx, personaID); err != nil {
			return err
		}
		return setPlaybooks(ctx, q, personaID, scamTypes)
	})
}

func setPlaybooks(ctx context.Context, q *db.Queries, personaID int64, scamTypes []string) error {
	for _, st := range scamTypes {
		t := db.ScamType(strings.ToLower(strings.TrimSpace(st)))
		if !t.Valid() {
			return fmt.Errorf("%w: unknown scam type %q", ErrBadRequest, st)
		}
		pb, err := q.PlaybookForScamType(ctx, t)
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: no playbook for scam type %q (run make seed)", ErrBadRequest, st)
		}
		if err != nil {
			return err
		}
		if err := q.AttachPlaybook(ctx, db.AttachPlaybookParams{PersonaID: personaID, PlaybookID: pb.ID}); err != nil {
			return err
		}
	}
	return nil
}

type GeneratedPersona struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Age     int    `json:"age"`
	Status  string `json:"status"`
	Summary string `json:"summary"`
}

// GeneratePersonas runs the persona generator (persona/generator_spec.md) and stores each result
// as a draft persona with prompt version 1.
func (s *Service) GeneratePersonas(ctx context.Context, req persona.GenerateRequest, operatorID int64) ([]GeneratedPersona, []string, error) {
	rows, err := s.Q.ListPersonasForDedupe(ctx)
	if err != nil {
		return nil, nil, err
	}
	existing := make([]persona.Existing, 0, len(rows))
	for _, r := range rows {
		existing = append(existing, persona.ExistingFromProfile(r.Name, int(r.Age.Int16), r.Profile))
	}
	gen, notes, err := persona.Generate(ctx, s.PersonaLLM, req, existing, s.Now(), rand.New(rand.NewSource(time.Now().UnixNano())))
	if err != nil {
		return nil, notes, err
	}
	var out []GeneratedPersona
	for _, g := range gen {
		mix, _ := json.Marshal(g.Persona.LanguageMix)
		var created db.Persona
		err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
			q := s.Q.WithTx(tx)
			var err error
			created, err = q.CreatePersonaWithProfile(ctx, db.CreatePersonaWithProfileParams{
				Name: g.Persona.Name, Age: pgtype.Int2{Int16: int16(g.Persona.Age), Valid: true}, LanguageMix: mix,
				Backstory: pgtype.Text{String: g.Persona.Backstory, Valid: g.Persona.Backstory != ""}, WealthProfile: nullJSON(g.Persona.WealthProfile),
				Status: db.PersonaStatusDraft, Profile: nullJSON(g.Profile), DemoIdentifiers: nullJSON(g.DemoIdentifiers),
			})
			if err != nil {
				return err
			}
			_, err = q.CreatePromptVersion(ctx, db.CreatePromptVersionParams{PersonaID: created.ID, SystemPrompt: g.PromptVersion.SystemPrompt, CreatedBy: opID(operatorID)})
			return err
		})
		if err != nil {
			return out, notes, err
		}
		pf := persona.ExistingFromProfile(created.Name, g.Persona.Age, g.Profile)
		out = append(out, GeneratedPersona{ID: created.ID, Name: created.Name, Age: g.Persona.Age, Status: string(created.Status),
			Summary: strings.TrimSpace(fmt.Sprintf("%d, %s %s, %s, %s", g.Persona.Age, pf.Ethnicity, pf.Gender, pf.Occupation, pf.City))})
		if g.GenerationNotes != nil && *g.GenerationNotes != "" {
			notes = append(notes, created.Name+": "+*g.GenerationNotes)
		}
	}
	return out, notes, nil
}

// ---- honeypot accounts (FR-2) ----

// AccountConnector starts the channel client for an account (wired to the Telegram manager).
type AccountConnector func(ctx context.Context, a db.HoneypotAccount) error

type AccountInput struct {
	PersonaID  int64  `json:"persona_id"`
	Channel    string `json:"channel"`
	Phone      string `json:"phone"`
	SessionRef string `json:"session_ref"`
}

func (s *Service) BindAccount(ctx context.Context, in AccountInput) (db.HoneypotAccount, error) {
	ch := db.Channel(strings.ToLower(in.Channel))
	if in.Channel == "" {
		ch = db.ChannelTelegram
	}
	if !ch.Valid() || in.PersonaID == 0 || strings.TrimSpace(in.Phone) == "" || in.SessionRef == "" {
		return db.HoneypotAccount{}, fmt.Errorf("%w: persona_id, channel, phone and session_ref are required", ErrBadRequest)
	}
	if _, err := s.Q.GetPersona(ctx, in.PersonaID); err != nil {
		return db.HoneypotAccount{}, notFound(err)
	}
	return s.Q.CreateHoneypotAccount(ctx, db.CreateHoneypotAccountParams{PersonaID: in.PersonaID, Channel: ch, Phone: strings.TrimSpace(in.Phone), SessionRef: in.SessionRef})
}

func (s *Service) SetAccountStatus(ctx context.Context, id int64, status string, cooldownUntil *time.Time) error {
	st := db.AccountStatus(status)
	if !st.Valid() {
		return fmt.Errorf("%w: status must be active, banned or cooldown", ErrBadRequest)
	}
	_, err := s.Q.SetAccountStatus(ctx, db.SetAccountStatusParams{ID: id, Status: st, CooldownUntil: cooldownUntil})
	return err
}

// ---- conversations (operator console) ----

type ConversationDetail struct {
	Conversation db.Conversation `json:"conversation"`
	Messages     []PlainMessage  `json:"messages"`
	Entities     []db.Entity     `json:"entities"`
}

func (s *Service) Conversation(ctx context.Context, id int64) (ConversationDetail, error) {
	conv, err := s.Q.GetConversation(ctx, id)
	if err != nil {
		return ConversationDetail{}, notFound(err)
	}
	msgs, err := s.History(ctx, id, 500)
	if err != nil {
		return ConversationDetail{}, err
	}
	ents, err := s.Q.ListConversationEntities(ctx, id)
	if err != nil {
		return ConversationDetail{}, err
	}
	return ConversationDetail{Conversation: conv, Messages: msgs, Entities: ents}, nil
}

// ---- verification queue (FR-9, TR-9) ----

// Verify records an operator decision (append-only) and applies it. Only this path sets "high".
func (s *Service) Verify(ctx context.Context, entityID, operatorID int64, decision, note string) (db.Entity, error) {
	d := db.VerificationDecision(decision)
	if !d.Valid() {
		return db.Entity{}, fmt.Errorf("%w: decision must be verified or rejected", ErrBadRequest)
	}
	if operatorID == 0 {
		return db.Entity{}, fmt.Errorf("%w: operator id required", ErrBadRequest)
	}
	if _, err := s.Q.GetEntity(ctx, entityID); err != nil {
		return db.Entity{}, notFound(err)
	}
	// VerifyEntity appends the decision to verifications and applies it in one statement.
	return s.Q.VerifyEntity(ctx, db.VerifyEntityParams{EntityID: entityID, OperatorID: operatorID, Decision: d,
		Note: pgtype.Text{String: note, Valid: note != ""}})
}

// ---- lookup (FR-10, TRD §5) ----

type LookupRequest struct {
	Type  string `json:"type"`
	Value string `json:"value"`
	Bank  string `json:"bank"`
}

type LookupResponse struct {
	Match      bool       `json:"match"`
	Confidence string     `json:"confidence,omitempty"`
	ScamTypes  []string   `json:"scam_types,omitempty"`
	FirstSeen  *time.Time `json:"first_seen,omitempty"`
	LastSeen   *time.Time `json:"last_seen,omitempty"`
	Sightings  int32      `json:"sightings,omitempty"`
}

// Lookup serves POST /v1/lookup from PostgreSQL. (The Redis cache, API keys and batch lookup are M3.)
func (s *Service) Lookup(ctx context.Context, req LookupRequest) (LookupResponse, error) {
	t := db.EntityType(req.Type)
	if !t.Valid() {
		return LookupResponse{}, fmt.Errorf("%w: type must be bank_account, wallet, phone, url or handle", ErrBadRequest)
	}
	v, ok := extraction.NormalizeValue(req.Type, req.Value)
	if !ok {
		return LookupResponse{Match: false}, nil
	}
	e, ok, err := s.lookupEntity(ctx, t, v, lookupBank(req.Type, v, req.Bank))
	if err != nil {
		return LookupResponse{}, err
	}
	if !ok {
		return LookupResponse{Match: false}, nil
	}
	conf := string(e.Confidence)
	if conf == "high" && e.Status != db.EntityStatusVerified {
		conf = "medium" // FR-9 trust promise: "high" only with an operator verification
	}
	types, err := s.Q.EntityScamTypes(ctx, e.ID)
	if err != nil {
		return LookupResponse{}, err
	}
	scam := make([]string, 0, len(types))
	for _, st := range types {
		scam = append(scam, string(st))
	}
	first, last := e.FirstSeen.UTC(), e.LastSeen.UTC()
	return LookupResponse{Match: true, Confidence: conf, ScamTypes: scam, FirstSeen: &first, LastSeen: &last, Sightings: e.SightingsCount}, nil
}

// lookupBank returns the bank/chain to match: the caller's, or for wallets the chain implied by
// the address format, since extraction always stores a wallet's chain.
func lookupBank(typ, value, bank string) string {
	if b := extraction.BankOrChain(typ, bank); b != "" || typ != "wallet" {
		return b
	}
	if strings.HasPrefix(value, "0x") {
		return "ethereum"
	}
	return "tron"
}

// lookupEntity uses LookupEntity's exact bank/chain match. For a bank account looked up with a
// bank code it falls back to the same number stored without one: extraction can only set the bank
// when the scammer names it next to the number.
func (s *Service) lookupEntity(ctx context.Context, t db.EntityType, v, bank string) (db.Entity, bool, error) {
	p := db.LookupEntityParams{Type: t, ValueNormalized: v, BankOrChain: pgtype.Text{String: bank, Valid: bank != ""}}
	e, err := s.Q.LookupEntity(ctx, p)
	if errors.Is(err, pgx.ErrNoRows) && bank != "" && t == db.EntityTypeBankAccount {
		p.BankOrChain = pgtype.Text{}
		e, err = s.Q.LookupEntity(ctx, p)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Entity{}, false, nil
	}
	return e, err == nil, err
}

func nullJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	return raw
}

func opID(id int64) pgtype.Int8 { return pgtype.Int8{Int64: id, Valid: id != 0} }
