// Package demostore is the in-memory data layer for the pitch: seeded from seed.json, then mutated live
// by the extraction engine, operators and lookups. Swap for PostgreSQL (db/migrations, sqlc) + Redis cache (TR-10) later.
package demostore

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/JaxzTan/Buru_AI/internal/extraction"
)

//go:embed seed.json
var seedJSON []byte

type Entity struct {
	ID         int       `json:"id"`
	Type       string    `json:"type"`
	Bank       string    `json:"bank,omitempty"`
	Value      string    `json:"value"`
	Display    string    `json:"display,omitempty"`
	ScamType   string    `json:"scam_type"`
	Confidence float64   `json:"confidence"`
	Sightings  int       `json:"sightings"`
	FirstSeen  string    `json:"first_seen"` // UI label
	LastSeen   string    `json:"last_seen"`  // UI label
	FirstAt    time.Time `json:"first_seen_at"`
	LastAt     time.Time `json:"last_seen_at"`
	Status     string    `json:"status"` // unverified | verified | rejected
	Convo      string    `json:"convo,omitempty"`
}

type Msg struct {
	Dir      string   `json:"dir"` // in | out | system
	Time     string   `json:"time,omitempty"`
	Text     string   `json:"text"`
	Human    bool     `json:"human,omitempty"`
	Entities []string `json:"entities,omitempty"`
}

type Convo struct {
	ID      string `json:"id"`
	Scammer string `json:"scammer"`
	Persona string `json:"persona"`
	Channel string `json:"channel"`
	Scam    string `json:"scam"`
	Stage   string `json:"stage"`
	Status  string `json:"status"` // bot | human | closed
	Time    string `json:"time"`
	Stuck   bool   `json:"stuck"`
	Msgs    []Msg  `json:"msgs"`
}

type Row = map[string]any

type Day struct {
	K string `json:"k"`
	V int    `json:"v"`
}

type Store struct {
	mu        sync.RWMutex
	entities  []Entity
	convos    []Convo
	personas  []Row
	accounts  []Row
	playbooks []Row
	weeks     []Row
	days      []Day
	nextID    int
}

func New() (*Store, error) {
	var seed struct {
		Entities  []Entity `json:"entities"`
		Convos    []Convo  `json:"convos"`
		Personas  []Row    `json:"personas"`
		Accounts  []Row    `json:"accounts"`
		Playbooks []Row    `json:"playbooks"`
		Weeks     []Row    `json:"weeks"`
	}
	if err := json.Unmarshal(seedJSON, &seed); err != nil {
		return nil, err
	}
	s := &Store{entities: seed.Entities, convos: seed.Convos, personas: seed.Personas,
		accounts: seed.Accounts, playbooks: seed.Playbooks, weeks: seed.Weeks, nextID: 1000}
	for i := range s.entities {
		e := &s.entities[i]
		e.FirstAt = parseLabel("2 Jan 2006", e.FirstSeen)
		e.LastAt = parseLabel("2 Jan, 15:04", e.LastSeen)
	}
	base := []int{1480, 1620, 1710, 1555, 1902, 820, 640} // lookups/day history for the usage chart
	for i := 1; i <= 22; i++ {
		s.days = append(s.days, Day{K: fmt.Sprint(i), V: base[(i+2)%7] + (i*137)%260})
	}
	return s, nil
}

func parseLabel(layout, v string) time.Time {
	t, err := time.Parse(layout, v)
	if err != nil {
		return time.Now().UTC()
	}
	if t.Year() == 0 {
		t = time.Date(2026, t.Month(), t.Day(), t.Hour(), t.Minute(), 0, 0, time.UTC)
	}
	return t
}

func Normalize(v string) string {
	return strings.NewReplacer(" ", "", "-", "").Replace(strings.ToLower(strings.TrimSpace(v)))
}

// ---- entities ----

func (s *Store) Entities(verifiedOnly bool) []Entity {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []Entity{}
	for _, e := range s.entities {
		if !verifiedOnly || e.Status == "verified" {
			out = append(out, e)
		}
	}
	return out
}

// Lookup mirrors POST /v1/lookup. Rejected entities never match; counts toward usage.
func (s *Store) Lookup(typ, value string) (Entity, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.days[len(s.days)-1].V++
	n := Normalize(value)
	for _, e := range s.entities {
		if e.Status == "rejected" || (typ != "" && typ != "any" && e.Type != typ) {
			continue
		}
		if Normalize(e.Value) == n || Normalize(e.Display) == n {
			return e, true
		}
	}
	return Entity{}, false
}

func (s *Store) Decide(id int, decision string) (Entity, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.entities {
		if s.entities[i].ID == id {
			s.entities[i].Status = decision
			return s.entities[i], true
		}
	}
	return Entity{}, false
}

// AddEntity stores a freshly extracted entity, or bumps sightings if we've seen it before (dedupe on normalized value).
func (s *Store) AddEntity(f extraction.Found, convo, scam string) Entity {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now().UTC()
	for i := range s.entities {
		e := &s.entities[i]
		if e.Type == f.Type && Normalize(e.Value) == Normalize(f.Value) {
			e.Sightings++
			e.LastAt, e.LastSeen = now, now.Format("2 Jan, 15:04")
			return *e
		}
	}
	s.nextID++
	e := Entity{ID: s.nextID, Type: f.Type, Bank: f.Bank, Value: f.Value, Display: f.Display, ScamType: scam,
		Confidence: f.Confidence, Sightings: 1, FirstAt: now, LastAt: now, Status: "unverified", Convo: convo,
		FirstSeen: now.Format("2 Jan 2006"), LastSeen: now.Format("2 Jan, 15:04")}
	s.entities = append(s.entities, e)
	return e
}

// ---- conversations ----

func (s *Store) Convos() []Convo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Convo, len(s.convos))
	for i, c := range s.convos {
		out[i] = cp(c)
	}
	return out
}

func (s *Store) Convo(id string) (Convo, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, c := range s.convos {
		if c.ID == id {
			return cp(c), true
		}
	}
	return Convo{}, false
}

func (s *Store) AddConvo(c Convo) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c.Msgs == nil {
		c.Msgs = []Msg{}
	}
	s.convos = append([]Convo{c}, s.convos...)
}

func (s *Store) UpdateConvo(id string, fn func(*Convo)) (Convo, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.convos {
		if s.convos[i].ID == id {
			fn(&s.convos[i])
			return cp(s.convos[i]), true
		}
	}
	return Convo{}, false
}

func cp(c Convo) Convo { c.Msgs = append([]Msg{}, c.Msgs...); return c }

// ---- personas, accounts, playbooks, weeks, usage ----

func (s *Store) Personas() []Row  { s.mu.RLock(); defer s.mu.RUnlock(); return append([]Row{}, s.personas...) }
func (s *Store) Accounts() []Row  { s.mu.RLock(); defer s.mu.RUnlock(); return append([]Row{}, s.accounts...) }
func (s *Store) Playbooks() []Row { s.mu.RLock(); defer s.mu.RUnlock(); return append([]Row{}, s.playbooks...) }
func (s *Store) Weeks() []Row     { s.mu.RLock(); defer s.mu.RUnlock(); return append([]Row{}, s.weeks...) }
func (s *Store) Days() []Day      { s.mu.RLock(); defer s.mu.RUnlock(); return append([]Day{}, s.days...) }

func (s *Store) AddPersona(r Row) Row {
	s.mu.Lock()
	defer s.mu.Unlock()
	r["id"] = fmt.Sprintf("p%d", len(s.personas)+1)
	s.personas = append(s.personas, r)
	return r
}

func (s *Store) AddAccount(r Row) Row {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nextID++
	r["id"], r["status"], r["chats"], r["last"], r["age"] = fmt.Sprintf("a%d", s.nextID), "active", 0, "—", "0 days"
	s.accounts = append(s.accounts, r)
	return r
}

func (s *Store) SetAccountStatus(id, status string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, a := range s.accounts {
		if a["id"] == id {
			a["status"] = status
		}
	}
}

func (s *Store) RemoveAccount(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	keep := s.accounts[:0:0]
	for _, a := range s.accounts {
		if a["id"] != id {
			keep = append(keep, a)
		}
	}
	s.accounts = keep
}
