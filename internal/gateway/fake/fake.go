// Package fake is a scripted scammer Connector that stands in for real Telegram/WhatsApp traffic in the demo.
// Every line goes through the real gateway and engine: routing, extraction, classification, stage machine, persona reply.
package fake

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/JaxzTan/Buru_AI/internal/demostore"
	"github.com/JaxzTan/Buru_AI/internal/gateway"
)

type Script struct {
	Scammer string
	Channel gateway.Channel
	Lines   []string
}

var Scripts = []Script{
	{"@lazada_task_hr", gateway.Telegram, []string{
		"Hi Auntie, our company hiring part-time reviewer, RM300 per day only click like 👍",
		"Yes can! First task need deposit RM150 to activate account, after that we return RM450",
		"Ok send RM150 to Maybank 1642 0457 1893 name Lim Ah Seng",
		"Any problem call my manager +60 12-777 4410 quickly, task expire today",
		"Bank cannot? Use CIMB 7012345678 can, or check status at http://lazada-task-claim.top/verify"}},
	{"@gold_usdt_mentor", gateway.WhatsApp, []string{
		"Good morning 🌸 our USDT plan give 8% weekly, my student already withdraw 3 times",
		"Start small 500 USDT, profit very stable, no risk",
		"Send to TUiNnd7ic6yCmaLmyuE7g7ZF5XYURYLBwR TRC20 only",
		"Join our group to see returns https://usdt-profit-club.xyz/join",
		"If wallet problem use second one TFBr3yb2N8JMpEzwfSqTWodTzQSwLxuRxo"}},
	{"@inspector_ali_pdrm", gateway.Telegram, []string{
		"This is Inspector Ali from PDRM Bukit Aman. Your IC linked to money laundering case, court will issue warrant",
		"Do not tell anyone. Bank Negara need to verify your savings, cooperate or you get arrested",
		"Transfer savings to safe account CIMB 7099 8800 12 under Bank Negara custody",
		"Confirm after transfer, call investigator +60 11-3321 5566"}},
}

// Connector plays Scripts against the store's active honeypot accounts.
type Connector struct {
	st       *demostore.Store
	channels []gateway.Channel
	Scripts  []Script
	Gap      time.Duration // between lines of one script (BURU_SIM_GAP)
	Every    time.Duration // between new scammers (BURU_SIM_EVERY)
	Max      int           // scammers in total (BURU_SIM_MAX)

	mu   sync.Mutex
	Sent []gateway.OutboundMessage // what the "scammers" received; read with Outbox
}

// New serves the given channels (default: Telegram and WhatsApp), timed from the BURU_SIM_* env vars.
func New(st *demostore.Store, channels ...gateway.Channel) *Connector {
	if len(channels) == 0 {
		channels = []gateway.Channel{gateway.Telegram, gateway.WhatsApp}
	}
	max := 6
	if n, err := strconv.Atoi(os.Getenv("BURU_SIM_MAX")); err == nil {
		max = n
	}
	return &Connector{st: st, channels: channels, Scripts: Scripts,
		Gap: secs("BURU_SIM_GAP", 14), Every: secs("BURU_SIM_EVERY", 25), Max: max}
}

func secs(key string, def int) time.Duration {
	if n, err := strconv.Atoi(os.Getenv(key)); err == nil {
		return time.Duration(n) * time.Second
	}
	return time.Duration(def) * time.Second
}

func (c *Connector) Channels() []gateway.Channel { return c.channels }

func (c *Connector) serves(ch gateway.Channel) bool {
	for _, x := range c.channels {
		if x == ch {
			return true
		}
	}
	return false
}

// Start begins a new scripted scammer every Every, each one messaging the next active account on its channel.
func (c *Connector) Start(ctx context.Context, deliver gateway.Deliver) error {
	if len(c.Scripts) == 0 {
		return nil
	}
	go func() {
		next := map[gateway.Channel]int{}
		started := 0
		for n := 0; started < c.Max && n < c.Max*len(c.Scripts); n++ {
			sc := c.Scripts[n%len(c.Scripts)]
			acct, ok := c.pick(sc.Channel, next)
			if !ok {
				continue // no active account on this channel
			}
			started++
			peer := fmt.Sprintf("%s#%d", sc.Scammer, n+1) // a fresh peer per run so each opens a new conversation
			go c.play(ctx, deliver, n, acct, peer, sc)
			select {
			case <-ctx.Done():
				return
			case <-time.After(c.Every):
			}
		}
	}()
	return nil
}

func (c *Connector) pick(ch gateway.Channel, next map[gateway.Channel]int) (string, bool) {
	if !c.serves(ch) {
		return "", false
	}
	var ids []string
	for _, a := range c.st.Accounts() {
		if a["channel"] == string(ch) && a["status"] == "active" {
			id, _ := a["id"].(string)
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return "", false
	}
	id := ids[next[ch]%len(ids)]
	next[ch]++
	return id, true
}

func (c *Connector) play(ctx context.Context, deliver gateway.Deliver, n int, acct, peer string, sc Script) {
	for i, line := range sc.Lines {
		if i > 0 {
			select {
			case <-ctx.Done():
				return
			case <-time.After(c.Gap):
			}
		}
		err := deliver(ctx, gateway.InboundMessage{AccountID: acct, Channel: sc.Channel, Peer: peer,
			Handle: sc.Scammer, ExternalID: fmt.Sprintf("%d-%d", n, i), Text: line})
		if err != nil {
			return // closed, account banned mid-chat, …
		}
	}
}

func (c *Connector) Send(_ context.Context, m gateway.OutboundMessage) error {
	c.mu.Lock()
	c.Sent = append(c.Sent, m)
	c.mu.Unlock()
	slog.Info("fake: sent", "account", m.AccountID, "peer", m.Peer, "human", m.Human, "text", m.Text)
	return nil
}

// Outbox returns a copy of everything sent so far.
func (c *Connector) Outbox() []gateway.OutboundMessage {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]gateway.OutboundMessage{}, c.Sent...)
}

func (c *Connector) SetTyping(context.Context, string, string, bool) error  { return nil }
func (c *Connector) MarkRead(context.Context, string, string, string) error { return nil }

func (c *Connector) Health(context.Context) []gateway.AccountHealth {
	var out []gateway.AccountHealth
	for _, a := range c.st.Accounts() {
		ch := gateway.Channel(fmt.Sprint(a["channel"]))
		if !c.serves(ch) {
			continue
		}
		status := "ok"
		if a["status"] == "banned" {
			status = "banned"
		}
		out = append(out, gateway.AccountHealth{AccountID: fmt.Sprint(a["id"]), Channel: ch, Status: status})
	}
	return out
}
