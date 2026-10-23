package fake

import (
	"context"
	"testing"
	"time"

	"github.com/JaxzTan/Buru_AI/internal/demostore"
	"github.com/JaxzTan/Buru_AI/internal/engine"
	"github.com/JaxzTan/Buru_AI/internal/gateway"
)

// waitSent polls until the scammer has received n messages.
func waitSent(t *testing.T, c *Connector, n int) []gateway.OutboundMessage {
	t.Helper()
	for deadline := time.Now().Add(3 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		if out := c.Outbox(); len(out) >= n {
			return out
		}
	}
	t.Fatalf("scammer received %d messages, want %d", len(c.Outbox()), n)
	return nil
}

// TestScammerReceivesReplies runs one script through the real router and engine and checks that
// the persona's reply, then an operator's message, come back out through the fake connector.
func TestScammerReceivesReplies(t *testing.T) {
	t.Setenv("ANTHROPIC_API_KEY", "") // use the playbook's example line, no network
	st, err := demostore.New()
	if err != nil {
		t.Fatal(err)
	}
	eng := engine.New(st)
	eng.DelayMin, eng.DelayMax = 0, 0

	fc := New(st, gateway.Telegram)
	fc.Gap, fc.Every, fc.Max = 0, 0, 1
	fc.Scripts = []Script{{"@lazada_task_hr", gateway.Telegram, []string{"Hi Auntie, part-time job RM300 per day"}}}

	gw, err := gateway.NewRouter(st, eng, fc)
	if err != nil {
		t.Fatal(err)
	}
	eng.Out = gw
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := gw.Start(ctx); err != nil {
		t.Fatal(err)
	}

	reply := waitSent(t, fc, 1)[0]
	if reply.AccountID != "a1" || reply.Peer != "@lazada_task_hr#1" || reply.Human || reply.Text == "" {
		t.Fatalf("persona reply = %+v, want bot text to @lazada_task_hr#1 from a1", reply)
	}
	var id string
	for _, c := range st.Convos() {
		if c.Scammer == "@lazada_task_hr" {
			id = c.ID
			if last := c.Msgs[len(c.Msgs)-1]; last.Dir != "out" || last.Text != reply.Text {
				t.Fatalf("console shows %+v, scammer got %q", last, reply.Text)
			}
		}
	}

	eng.Takeover(id)
	eng.Operator(id, "sorry ah, which bank again?")
	op := waitSent(t, fc, 2)[1]
	if !op.Human || op.Text != "sorry ah, which bank again?" || op.Peer != reply.Peer {
		t.Fatalf("operator message = %+v", op)
	}
}
