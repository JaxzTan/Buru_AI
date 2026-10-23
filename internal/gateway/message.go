// Package gateway normalises inbound/outbound messages from channel connectors and routes them
// account → persona → conversation into the engine (TR-2). Connectors (Telegram now, WhatsApp later)
// only deal in InboundMessage / OutboundMessage; nothing past the gateway knows which channel it is.
package gateway

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// Channel values match the "channel" field used by demostore accounts and conversations.
type Channel string

const (
	Telegram Channel = "TG"
	WhatsApp Channel = "WA"
)

// Kind is the message type before normalisation; anything but text becomes a placeholder like "[photo]".
type Kind string

const (
	Text     Kind = "text"
	Photo    Kind = "photo"
	Voice    Kind = "voice"
	Video    Kind = "video"
	Sticker  Kind = "sticker"
	Document Kind = "document"
)

// MaxText caps a message body (Telegram's own limit) so one huge message can't blow up prompts or storage.
const MaxText = 4096

// InboundMessage is one message from a scammer to a honeypot account.
type InboundMessage struct {
	AccountID  string // honeypot account id ("a1"); the connector knows which account received it
	Channel    Channel
	Peer       string    // scammer's stable id on the channel (e.g. Telegram user id); used to reply
	Handle     string    // display handle ("@lazada_task_hr"); defaults to "tg:<peer>"
	ExternalID string    // channel message id, for dedupe and MarkRead
	Kind       Kind      // defaults to Text
	Text       string    // body or media caption
	At         time.Time // defaults to now
}

// OutboundMessage is one message from a honeypot account to a scammer.
type OutboundMessage struct {
	AccountID string
	Channel   Channel
	Peer      string
	Text      string
	Human     bool // sent by an operator after takeover (FR-5)
}

// AccountHealth is a connector's view of one account's session (feeds TR-17).
type AccountHealth struct {
	AccountID string  `json:"account_id"`
	Channel   Channel `json:"channel"`
	Status    string  `json:"status"` // ok | disconnected | banned
	Err       string  `json:"error,omitempty"`
}

// Deliver is how a connector hands an inbound message to the gateway.
type Deliver func(context.Context, InboundMessage) error

// Connector owns the sessions for the honeypot accounts on one or more channels.
type Connector interface {
	Channels() []Channel
	// Start launches the connector's sessions and returns; they run until ctx is cancelled.
	Start(ctx context.Context, deliver Deliver) error
	Send(ctx context.Context, m OutboundMessage) error
	SetTyping(ctx context.Context, accountID, peer string, typing bool) error
	MarkRead(ctx context.Context, accountID, peer, externalID string) error
	Health(ctx context.Context) []AccountHealth
}

var ErrInvalid = errors.New("gateway: invalid inbound message")

// Normalize validates an inbound message and fills defaults. Scammer text stays untrusted:
// it is cleaned of control characters and length-capped here, never interpreted.
func Normalize(m InboundMessage) (InboundMessage, error) {
	m.AccountID, m.Peer, m.ExternalID = strings.TrimSpace(m.AccountID), strings.TrimSpace(m.Peer), strings.TrimSpace(m.ExternalID)
	if m.AccountID == "" || m.Peer == "" || m.Channel == "" {
		return m, ErrInvalid
	}
	if m.Kind == "" {
		m.Kind = Text
	}
	m.Text = clean(m.Text)
	if m.Kind != Text {
		m.Text = strings.TrimSpace("[" + string(m.Kind) + "] " + m.Text)
	}
	if m.Text == "" {
		return m, ErrInvalid
	}
	if len(m.Text) > MaxText {
		m.Text = m.Text[:MaxText]
		for !utf8.ValidString(m.Text) { // don't cut a multi-byte rune (emoji) in half
			m.Text = m.Text[:len(m.Text)-1]
		}
	}
	if m.Handle = strings.TrimSpace(m.Handle); m.Handle == "" {
		m.Handle = strings.ToLower(string(m.Channel)) + ":" + m.Peer
	}
	if m.At.IsZero() {
		m.At = time.Now()
	}
	m.At = m.At.UTC()
	return m, nil
}

// clean drops control characters (keeping newlines and tabs) and trims surrounding space.
func clean(s string) string {
	s = strings.ToValidUTF8(s, "")
	s = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' || !unicode.IsControl(r) {
			return r
		}
		return -1
	}, s)
	return strings.TrimSpace(s)
}
