// Package sim is a development-only channel: it stands in for Telegram so a developer can chat with
// a persona from the terminal (cmd/simchat) while everything after the transport runs for real
// (Temporal workflow, LLM, extraction, stages, takeover). Simulated honeypot accounts are ordinary
// honeypot_accounts rows whose session_ref starts with "sim:".
package sim

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// SessionPrefix marks a simulated honeypot account in honeypot_accounts.session_ref.
const SessionPrefix = "sim:"

// IsSimAccount reports whether a session_ref belongs to a simulated account.
func IsSimAccount(sessionRef string) bool { return strings.HasPrefix(sessionRef, SessionPrefix) }

// Event is what the simulated "scammer" sees: a message, a typing indicator, or a read receipt.
type Event struct {
	Seq  int64     `json:"seq"`
	Kind string    `json:"kind"` // message | typing | read
	Text string    `json:"text,omitempty"`
	At   time.Time `json:"at"`
}

const maxEventsPerChat = 500

// Hub implements gateway.Sender for simulated accounts and buffers events for the terminal client.
type Hub struct {
	mu      sync.Mutex
	seq     int64
	chats   map[string][]Event
	sent    map[string]bool // retried sends with the same random id are delivered once
	waiters map[string][]chan struct{}
}

func NewHub() *Hub {
	return &Hub{chats: map[string][]Event{}, sent: map[string]bool{}, waiters: map[string][]chan struct{}{}}
}

func key(accountID int64, peerRef string) string { return fmt.Sprintf("%d|%s", accountID, peerRef) }

func (h *Hub) push(k, kind, text string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	evs := h.chats[k]
	if kind == "typing" && len(evs) > 0 {
		if last := evs[len(evs)-1]; last.Kind == "typing" && time.Since(last.At) < 4*time.Second {
			return // one "typing…" per refresh window is enough
		}
	}
	h.seq++
	evs = append(evs, Event{Seq: h.seq, Kind: kind, Text: text, At: time.Now().UTC()})
	if len(evs) > maxEventsPerChat {
		evs = evs[len(evs)-maxEventsPerChat:]
	}
	h.chats[k] = evs
	for _, w := range h.waiters[k] {
		close(w)
	}
	delete(h.waiters, k)
}

// ---- gateway.Sender ----

func (h *Hub) Send(_ context.Context, accountID int64, peerRef, text string, randomID int64) error {
	k := key(accountID, peerRef)
	id := fmt.Sprintf("%s|%d", k, randomID)
	h.mu.Lock()
	dup := h.sent[id]
	h.sent[id] = true
	h.mu.Unlock()
	if !dup {
		h.push(k, "message", text)
	}
	return nil
}

func (h *Hub) Typing(_ context.Context, accountID int64, peerRef string) error {
	h.push(key(accountID, peerRef), "typing", "")
	return nil
}

func (h *Hub) MarkRead(_ context.Context, accountID int64, peerRef string) error {
	h.push(key(accountID, peerRef), "read", "")
	return nil
}

func (h *Hub) SetOnline(context.Context, int64, bool) error { return nil }

// Events returns events after the given sequence number, waiting up to wait for new ones.
func (h *Hub) Events(ctx context.Context, accountID int64, peerRef string, after int64, wait time.Duration) []Event {
	k := key(accountID, peerRef)
	for {
		h.mu.Lock()
		var out []Event
		for _, e := range h.chats[k] {
			if e.Seq > after {
				out = append(out, e)
			}
		}
		if len(out) > 0 || wait <= 0 {
			h.mu.Unlock()
			return out
		}
		ch := make(chan struct{})
		h.waiters[k] = append(h.waiters[k], ch)
		h.mu.Unlock()

		timer := time.NewTimer(wait)
		select {
		case <-ch:
			timer.Stop()
			wait = 0 // return whatever arrived
		case <-timer.C:
			return nil
		case <-ctx.Done():
			timer.Stop()
			return nil
		}
	}
}
