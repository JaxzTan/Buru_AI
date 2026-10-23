package gateway

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/JaxzTan/Buru_AI/internal/demostore"
)

func TestNormalize(t *testing.T) {
	at := time.Date(2026, 10, 24, 9, 30, 0, 0, time.FixedZone("MYT", 8*3600))
	long := strings.Repeat("a", MaxText-1) + "🌸" // emoji straddles the cap
	tests := []struct {
		name string
		in   InboundMessage
		want InboundMessage
		err  error
	}{
		{"text defaults", InboundMessage{AccountID: " a1 ", Channel: Telegram, Peer: "42", Text: "  hi auntie  ", At: at},
			InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Handle: "tg:42", Kind: Text, Text: "hi auntie", At: at.UTC()}, nil},
		{"handle kept", InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Handle: "@hr_task", Text: "hi", At: at},
			InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Handle: "@hr_task", Kind: Text, Text: "hi", At: at.UTC()}, nil},
		{"photo without caption", InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Kind: Photo, At: at},
			InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Handle: "tg:42", Kind: Photo, Text: "[photo]", At: at.UTC()}, nil},
		{"photo with caption", InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Kind: Photo, Text: "receipt", At: at},
			InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Handle: "tg:42", Kind: Photo, Text: "[photo] receipt", At: at.UTC()}, nil},
		{"control chars stripped, newline kept", InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Text: "send\x00 to\nMaybank\x1b", At: at},
			InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Handle: "tg:42", Kind: Text, Text: "send to\nMaybank", At: at.UTC()}, nil},
		{"capped on rune boundary", InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Text: long, At: at},
			InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Handle: "tg:42", Kind: Text, Text: strings.Repeat("a", MaxText-1), At: at.UTC()}, nil},
		{"empty text", InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Text: " \x00 "}, InboundMessage{}, ErrInvalid},
		{"missing account", InboundMessage{Channel: Telegram, Peer: "42", Text: "hi"}, InboundMessage{}, ErrInvalid},
		{"missing peer", InboundMessage{AccountID: "a1", Channel: Telegram, Text: "hi"}, InboundMessage{}, ErrInvalid},
		{"missing channel", InboundMessage{AccountID: "a1", Peer: "42", Text: "hi"}, InboundMessage{}, ErrInvalid},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Normalize(tt.in)
			if !errors.Is(err, tt.err) {
				t.Fatalf("err = %v, want %v", err, tt.err)
			}
			if err == nil && got != tt.want {
				t.Fatalf("got  %+v\nwant %+v", got, tt.want)
			}
		})
	}
	if got, _ := Normalize(InboundMessage{AccountID: "a1", Channel: Telegram, Peer: "42", Text: "hi"}); got.At.IsZero() {
		t.Fatal("zero At should default to now")
	}
}

// stubEngine accepts messages for open conversations, like engine.Inbound.
type stubEngine struct {
	st    *demostore.Store
	mu    sync.Mutex
	calls []string // convoID|text
}

func (e *stubEngine) Inbound(id, text string) bool {
	c, ok := e.st.Convo(id)
	if !ok || c.Status == "closed" {
		return false
	}
	e.mu.Lock()
	e.calls = append(e.calls, id+"|"+text)
	e.mu.Unlock()
	return true
}

type stubConn struct {
	chans []Channel
	sent  []OutboundMessage
}

func (c *stubConn) Channels() []Channel                                    { return c.chans }
func (c *stubConn) Start(context.Context, Deliver) error                   { return nil }
func (c *stubConn) SetTyping(context.Context, string, string, bool) error  { return nil }
func (c *stubConn) MarkRead(context.Context, string, string, string) error { return nil }
func (c *stubConn) Health(context.Context) []AccountHealth                 { return nil }
func (c *stubConn) Send(_ context.Context, m OutboundMessage) error {
	c.sent = append(c.sent, m)
	return nil
}

func newRouter(t *testing.T) (*Router, *demostore.Store, *stubEngine, *stubConn) {
	t.Helper()
	st, err := demostore.New() // seed: a1 TG active p1, a2 WA cooldown, a3 TG banned, a6 WA active p3
	if err != nil {
		t.Fatal(err)
	}
	eng, conn := &stubEngine{st: st}, &stubConn{chans: []Channel{Telegram, WhatsApp}}
	r, err := NewRouter(st, eng, conn)
	if err != nil {
		t.Fatal(err)
	}
	return r, st, eng, conn
}

func msg(account string, ch Channel, peer, ext, text string) InboundMessage {
	return InboundMessage{AccountID: account, Channel: ch, Peer: peer, Handle: "@" + peer, ExternalID: ext, Text: text}
}

func TestRouteRejects(t *testing.T) {
	tests := []struct {
		name string
		in   InboundMessage
		err  error
	}{
		{"unknown account", msg("a404", Telegram, "x", "1", "hi"), ErrUnknownAccount},
		{"banned account", msg("a3", Telegram, "x", "1", "hi"), ErrAccountInactive},
		{"cooldown account", msg("a2", WhatsApp, "x", "1", "hi"), ErrAccountInactive},
		{"channel mismatch", msg("a1", WhatsApp, "x", "1", "hi"), ErrChannelMismatch},
		{"invalid message", msg("a1", Telegram, "", "1", "hi"), ErrInvalid},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r, st, eng, _ := newRouter(t)
			before := len(st.Convos())
			if _, err := r.Route(context.Background(), tt.in); !errors.Is(err, tt.err) {
				t.Fatalf("err = %v, want %v", err, tt.err)
			}
			if len(st.Convos()) != before || len(eng.calls) != 0 {
				t.Fatal("rejected message must not create a conversation or reach the engine")
			}
		})
	}
}

func TestRouteConversations(t *testing.T) {
	ctx := context.Background()
	r, st, eng, _ := newRouter(t)

	id1, err := r.Route(ctx, msg("a1", Telegram, "hr", "1", "hiring part-time"))
	if err != nil {
		t.Fatal(err)
	}
	c, _ := st.Convo(id1)
	if c.Persona != "p1" || c.Channel != "TG" || c.Scammer != "@hr" || c.Status != "bot" || c.Stage != "rapport" {
		t.Fatalf("new conversation = %+v, want persona p1 from account a1", c)
	}

	steps := []struct {
		name    string
		in      InboundMessage
		err     error
		sameAs  string // "" = expect a new conversation id
		closeID bool   // close the first conversation before this step
	}{
		{"same peer reuses conversation", msg("a1", Telegram, "hr", "2", "deposit RM150"), nil, id1, false},
		{"duplicate external id dropped", msg("a1", Telegram, "hr", "2", "deposit RM150"), ErrDuplicate, "", false},
		{"other peer on same account gets own conversation", msg("a1", Telegram, "mentor", "3", "USDT 8%"), nil, "", false},
		{"same peer on other account gets own conversation", msg("a6", WhatsApp, "hr", "1", "hello"), nil, "", false},
		{"after close a new conversation opens", msg("a1", Telegram, "hr", "4", "still there?"), nil, "", true},
	}
	seen := map[string]bool{id1: true}
	for _, s := range steps {
		t.Run(s.name, func(t *testing.T) {
			if s.closeID {
				st.UpdateConvo(id1, func(c *demostore.Convo) { c.Status = "closed" })
			}
			id, err := r.Route(ctx, s.in)
			if !errors.Is(err, s.err) {
				t.Fatalf("err = %v, want %v", err, s.err)
			}
			switch {
			case err != nil:
			case s.sameAs != "" && id != s.sameAs:
				t.Fatalf("id = %s, want %s", id, s.sameAs)
			case s.sameAs == "" && seen[id]:
				t.Fatalf("id %s reused, want a new conversation", id)
			}
			seen[id] = true
		})
	}
	if got := len(eng.calls); got != 5 { // every accepted message, duplicate excluded
		t.Fatalf("engine calls = %d, want 5: %v", got, eng.calls)
	}
	for _, c := range st.Convos() {
		if c.Channel == "WA" && c.Scammer == "@hr" && c.Persona != "p3" {
			t.Fatalf("a6 conversation persona = %q, want p3", c.Persona)
		}
	}
}

func TestRouteConcurrentFirstMessages(t *testing.T) {
	r, st, _, _ := newRouter(t)
	before := len(st.Convos())
	var wg sync.WaitGroup
	for i := range 20 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = r.Route(context.Background(), msg("a1", Telegram, "burst", string(rune('A'+i)), "hi"))
		}()
	}
	wg.Wait()
	if got := len(st.Convos()) - before; got != 1 {
		t.Fatalf("conversations opened = %d, want 1", got)
	}
}

func TestSend(t *testing.T) {
	ctx := context.Background()
	r, _, _, conn := newRouter(t)
	id, err := r.Route(ctx, msg("a1", Telegram, "hr", "1", "hi"))
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name  string
		convo string
		human bool
		err   error
	}{
		{"persona reply", id, false, nil},
		{"operator reply", id, true, nil},
		{"seeded convo has no peer", "c1", false, ErrUnknownConvo},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			n := len(conn.sent)
			if err := r.Send(ctx, tt.convo, "ok la", tt.human); !errors.Is(err, tt.err) {
				t.Fatalf("err = %v, want %v", err, tt.err)
			}
			if tt.err != nil {
				return
			}
			want := OutboundMessage{AccountID: "a1", Channel: Telegram, Peer: "hr", Text: "ok la", Human: tt.human}
			if len(conn.sent) != n+1 || conn.sent[n] != want {
				t.Fatalf("sent = %+v, want %+v", conn.sent, want)
			}
		})
	}
	if _, err := NewRouter(nil, nil, &stubConn{chans: []Channel{Telegram}}, &stubConn{chans: []Channel{Telegram}}); err == nil {
		t.Fatal("two connectors on one channel should fail")
	}
}
