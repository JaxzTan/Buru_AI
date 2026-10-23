package gateway

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/JaxzTan/Buru_AI/internal/demostore"
)

var (
	ErrUnknownAccount  = errors.New("gateway: unknown account")
	ErrAccountInactive = errors.New("gateway: account not active")
	ErrChannelMismatch = errors.New("gateway: message channel does not match account")
	ErrDuplicate       = errors.New("gateway: duplicate message")
	ErrRejected        = errors.New("gateway: engine rejected message")
	ErrUnknownConvo    = errors.New("gateway: conversation not routed through gateway")
	ErrNoConnector     = errors.New("gateway: no connector for channel")
)

// Handler is the engine side of the gateway (satisfied by *engine.Engine).
type Handler interface {
	Inbound(convoID, text string) bool
}

type peerKey struct{ account, peer string }

// Router maps inbound messages to conversations: account → persona → conversation,
// opening a new conversation on the first message from a peer (or after the last one closed).
type Router struct {
	st    *demostore.Store
	h     Handler
	conns map[Channel]Connector
	log   *slog.Logger

	mu    sync.Mutex
	open  map[peerKey]string // (account, peer) → current conversation id
	peers map[string]peerKey // conversation id → (account, peer), for replies
	seen  map[string]bool    // account + external id, for dedupe
	order []string           // seen keys oldest first, to bound memory
	n     int
}

const seenMax = 10000

func NewRouter(st *demostore.Store, h Handler, cs ...Connector) (*Router, error) {
	r := &Router{st: st, h: h, conns: map[Channel]Connector{}, log: slog.Default(),
		open: map[peerKey]string{}, peers: map[string]peerKey{}, seen: map[string]bool{}}
	for _, c := range cs {
		for _, ch := range c.Channels() {
			if _, dup := r.conns[ch]; dup {
				return nil, fmt.Errorf("gateway: two connectors for channel %s", ch)
			}
			r.conns[ch] = c
		}
	}
	return r, nil
}

// Start starts every connector, each delivering into Route.
func (r *Router) Start(ctx context.Context) error {
	started := map[Connector]bool{}
	for _, c := range r.conns {
		if started[c] {
			continue
		}
		started[c] = true
		if err := c.Start(ctx, func(ctx context.Context, m InboundMessage) error {
			_, err := r.Route(ctx, m)
			return err
		}); err != nil {
			return err
		}
	}
	return nil
}

// Route normalises one inbound message and hands it to the engine. It returns the conversation id.
func (r *Router) Route(_ context.Context, m InboundMessage) (string, error) {
	m, err := Normalize(m)
	if err != nil {
		return "", err
	}
	acct, ok := r.account(m.AccountID)
	if !ok {
		return "", r.drop(m, ErrUnknownAccount)
	}
	if fmt.Sprint(acct["channel"]) != string(m.Channel) {
		return "", r.drop(m, ErrChannelMismatch)
	}
	if acct["status"] != "active" { // banned / cooldown accounts don't talk (TR-17)
		return "", r.drop(m, ErrAccountInactive)
	}
	if r.duplicate(m) {
		return "", ErrDuplicate
	}
	persona, _ := acct["persona"].(string)
	for range 2 { // second try only if the engine saw the conversation close under us
		id := r.convo(m, persona)
		if r.h.Inbound(id, m.Text) {
			return id, nil
		}
		r.forget(id)
	}
	return "", r.drop(m, ErrRejected)
}

func (r *Router) account(id string) (demostore.Row, bool) {
	for _, a := range r.st.Accounts() {
		if a["id"] == id {
			return a, true
		}
	}
	return nil, false
}

func (r *Router) duplicate(m InboundMessage) bool {
	if m.ExternalID == "" {
		return false
	}
	k := m.AccountID + "/" + m.ExternalID
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.seen[k] {
		return true
	}
	r.seen[k] = true
	if r.order = append(r.order, k); len(r.order) > seenMax {
		delete(r.seen, r.order[0])
		r.order = r.order[1:]
	}
	return false
}

// convo returns the open conversation for (account, peer), creating it under the lock so
// two messages arriving together can't open two conversations.
func (r *Router) convo(m InboundMessage, persona string) string {
	k := peerKey{m.AccountID, m.Peer}
	r.mu.Lock()
	defer r.mu.Unlock()
	if id, ok := r.open[k]; ok {
		if c, ok := r.st.Convo(id); ok && c.Status != "closed" {
			return id
		}
		delete(r.peers, id)
	}
	r.n++
	id := fmt.Sprintf("g%d", r.n)
	r.st.AddConvo(demostore.Convo{ID: id, Scammer: m.Handle, Persona: persona, Channel: string(m.Channel),
		Scam: "other", Stage: "rapport", Status: "bot", Time: m.At.Local().Format("15:04")})
	r.open[k], r.peers[id] = id, k
	return id
}

func (r *Router) forget(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if k, ok := r.peers[id]; ok && r.open[k] == id {
		delete(r.open, k)
	}
}

func (r *Router) drop(m InboundMessage, err error) error {
	r.log.Warn("gateway: dropped inbound", "account", m.AccountID, "channel", m.Channel, "peer", m.Peer, "err", err)
	return err
}

// Send delivers a persona or operator message for a conversation through its account's connector.
func (r *Router) Send(ctx context.Context, convoID, text string, human bool) error {
	r.mu.Lock()
	k, ok := r.peers[convoID]
	r.mu.Unlock()
	if !ok {
		return ErrUnknownConvo // seeded demo conversations have no channel peer
	}
	acct, ok := r.account(k.account)
	if !ok {
		return ErrUnknownAccount
	}
	ch := Channel(fmt.Sprint(acct["channel"]))
	c, ok := r.conns[ch]
	if !ok {
		return ErrNoConnector
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	return c.Send(ctx, OutboundMessage{AccountID: k.account, Channel: ch, Peer: k.peer, Text: text, Human: human})
}

// Health collects every connector's account health.
func (r *Router) Health(ctx context.Context) []AccountHealth {
	out := []AccountHealth{}
	done := map[Connector]bool{}
	for _, c := range r.conns {
		if !done[c] {
			done[c] = true
			out = append(out, c.Health(ctx)...)
		}
	}
	return out
}
