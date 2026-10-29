package db_test

// Integration tests against real PostgreSQL with migrations applied (TRD §9).
// Run: make test-db   (skipped when SOCKABUS_TEST_POSTGRES_URL is unset)

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/JaxzTan/Buru_AI/internal/db"
)

// setup returns queries inside a transaction that is rolled back after the test.
func setup(t *testing.T) (context.Context, *db.Queries, pgx.Tx) {
	url := os.Getenv("SOCKABUS_TEST_POSTGRES_URL")
	if url == "" {
		t.Skip("SOCKABUS_TEST_POSTGRES_URL not set")
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = tx.Rollback(ctx); _ = conn.Close(ctx) })
	return ctx, db.New(tx), tx
}

// must panics on error; the test fails with the error and its line.
func must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

// seedConversation creates operator → persona → account → conversation → one inbound message.
func seedConversation(t *testing.T, ctx context.Context, q *db.Queries) (db.Operator, db.Conversation, db.InsertMessageRow) {
	t.Helper()
	op := must(q.CreateOperator(ctx, db.CreateOperatorParams{Email: "op@sockabus.test", Role: db.OperatorRoleOperator, TotpSecretRef: "vault:op"}))
	p := must(q.CreatePersona(ctx, db.CreatePersonaParams{Name: "Auntie Mei", LanguageMix: json.RawMessage(`{"en":0.5,"hokkien":0.5}`)}))
	acc := must(q.CreateHoneypotAccount(ctx, db.CreateHoneypotAccountParams{PersonaID: p.ID, Channel: db.ChannelTelegram, Phone: "+60120000001", SessionRef: "vault:s1"}))
	c := must(q.CreateConversation(ctx, db.CreateConversationParams{AccountID: acc.ID, TemporalWorkflowID: "wf-1", ScammerHandle: "@scammer"}))
	m := must(q.InsertMessage(ctx, db.InsertMessageParams{ConversationID: c.ID, Direction: db.MessageDirectionInbound, SenderType: db.SenderTypeScammer, BodyCiphertext: []byte("x"), DekRef: "dek:1", SentAt: time.Now()}))
	return op, c, m
}

func TestPromptVersionsIncrement(t *testing.T) {
	ctx, q, _ := setup(t)
	p := must(q.CreatePersona(ctx, db.CreatePersonaParams{Name: "Uncle Lim", LanguageMix: json.RawMessage(`{"ms":1}`)}))
	v1 := must(q.CreatePromptVersion(ctx, db.CreatePromptVersionParams{PersonaID: p.ID, SystemPrompt: "a"}))
	v2 := must(q.CreatePromptVersion(ctx, db.CreatePromptVersionParams{PersonaID: p.ID, SystemPrompt: "b"}))
	if v1.Version != 1 || v2.Version != 2 {
		t.Fatalf("versions = %d, %d; want 1, 2", v1.Version, v2.Version)
	}
}

func TestEntityDedupeConfidenceAndVerify(t *testing.T) {
	ctx, q, _ := setup(t)
	op, c, m := seedConversation(t, ctx, q)
	if err := q.SetConversationScamType(ctx, db.SetConversationScamTypeParams{ID: c.ID, ScamType: db.NullScamType{ScamType: db.ScamTypeJob, Valid: true}}); err != nil {
		t.Fatal(err)
	}

	// Extraction asks for 'high'; FR-9 caps it at 'medium'. NULL bank_or_chain still dedupes (NULLS NOT DISTINCT).
	url := db.UpsertEntityParams{Type: db.EntityTypeUrl, ValueNormalized: "scam.top/verify", Confidence: db.ConfidenceLevelHigh}
	e1 := must(q.UpsertEntity(ctx, url))
	e2 := must(q.UpsertEntity(ctx, url))
	if e1.ID != e2.ID {
		t.Fatalf("dedupe failed: ids %d and %d", e1.ID, e2.ID)
	}
	if e1.Confidence != db.ConfidenceLevelMedium {
		t.Fatalf("confidence = %s; want medium", e1.Confidence)
	}

	// The same message counted twice is one sighting.
	s := db.InsertSightingParams{EntityID: e1.ID, ConversationID: c.ID, MessageID: m.ID}
	must(q.InsertSighting(ctx, s))
	if _, err := q.InsertSighting(ctx, s); err != pgx.ErrNoRows {
		t.Fatalf("duplicate sighting err = %v; want ErrNoRows", err)
	}
	if got := must(q.GetEntity(ctx, e1.ID)); got.SightingsCount != 1 {
		t.Fatalf("sightings_count = %d; want 1", got.SightingsCount)
	}

	v := must(q.VerifyEntity(ctx, db.VerifyEntityParams{EntityID: e1.ID, OperatorID: op.ID, Decision: db.VerificationDecisionVerified}))
	if v.Status != db.EntityStatusVerified || v.Confidence != db.ConfidenceLevelHigh {
		t.Fatalf("after verify: status %s, confidence %s; want verified, high", v.Status, v.Confidence)
	}
	if n := len(must(q.ListVerifications(ctx, e1.ID))); n != 1 {
		t.Fatalf("verifications = %d; want 1", n)
	}
	if st := must(q.EntityScamTypes(ctx, e1.ID)); len(st) != 1 || st[0] != db.ScamTypeJob {
		t.Fatalf("scam types = %v; want [job]", st)
	}
}

func TestLookupSingleAndBatch(t *testing.T) {
	ctx, q, _ := setup(t)
	bank := pgtype.Text{String: "MBB", Valid: true}
	acct := must(q.UpsertEntity(ctx, db.UpsertEntityParams{Type: db.EntityTypeBankAccount, ValueNormalized: "164204571893", BankOrChain: bank, Confidence: db.ConfidenceLevelMedium}))
	must(q.UpsertEntity(ctx, db.UpsertEntityParams{Type: db.EntityTypePhone, ValueNormalized: "+60127774410", Confidence: db.ConfidenceLevelMedium}))

	got := must(q.LookupEntity(ctx, db.LookupEntityParams{Type: db.EntityTypeBankAccount, ValueNormalized: "164204571893", BankOrChain: bank}))
	if got.ID != acct.ID {
		t.Fatalf("lookup id = %d; want %d", got.ID, acct.ID)
	}
	if _, err := q.LookupEntity(ctx, db.LookupEntityParams{Type: db.EntityTypeBankAccount, ValueNormalized: "164204571893"}); err != pgx.ErrNoRows {
		t.Fatalf("lookup without bank err = %v; want ErrNoRows", err)
	}

	rows := must(q.LookupEntitiesBatch(ctx, db.LookupEntitiesBatchParams{
		Types:  []string{"bank_account", "phone", "url"},
		Values: []string{"164204571893", "+60127774410", "not-there.com"},
		Banks:  []string{"MBB", "", ""},
	}))
	if len(rows) != 2 {
		t.Fatalf("batch matches = %d; want 2", len(rows))
	}
}

// NFR-8: the app role can add audit records but never change or remove them.
// Checks grants directly, so it also runs where the test user cannot SET ROLE (Supabase's postgres is not superuser).
func TestAppendOnlyForAppRole(t *testing.T) {
	ctx, _, tx := setup(t)
	for _, table := range []string{"messages", "entity_sightings", "verifications"} {
		for priv, want := range map[string]bool{"SELECT": true, "INSERT": true, "UPDATE": false, "DELETE": false, "TRUNCATE": false} {
			var got bool
			if err := tx.QueryRow(ctx, "SELECT has_table_privilege('buru_app', $1, $2)", table, priv).Scan(&got); err != nil {
				t.Fatal(err)
			}
			if got != want {
				t.Errorf("buru_app %s on %s = %v; want %v", priv, table, got, want)
			}
		}
	}
}
