// Package telegram is the gateway Connector for real Telegram user accounts, one gotd client per honeypot account.
// A failing account (no session, logged out, banned) shows up in Health and never stops the others.
package telegram

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gotd/contrib/middleware/floodwait"
	"github.com/gotd/contrib/middleware/ratelimit"
	"github.com/gotd/td/session"
	"github.com/gotd/td/telegram"
	"github.com/gotd/td/telegram/auth"
	"github.com/gotd/td/telegram/dcs"
	"github.com/gotd/td/telegram/message"
	"github.com/gotd/td/telegram/updates"
	"github.com/gotd/td/tg"
	"github.com/gotd/td/tgerr"
	"golang.org/x/time/rate"

	"github.com/JaxzTan/Buru_AI/internal/connector/telegram/store"
	"github.com/JaxzTan/Buru_AI/internal/gateway"
)

const retryAfter = 30 * time.Second // between reconnects after a non-fatal failure

var errNotReady = errors.New("telegram: account not connected")

type Connector struct {
	cfg   Config
	store store.Store
	log   *slog.Logger
	accts map[string]*account // fixed after New
}

type account struct {
	Account
	mu     sync.Mutex
	api    *tg.Client
	sender *message.Sender
	self   int64
	health gateway.AccountHealth
}

func New(cfg Config, st store.Store) *Connector {
	c := &Connector{cfg: cfg, store: st, log: slog.Default(), accts: map[string]*account{}}
	for _, a := range cfg.Accounts {
		c.accts[a.ID] = &account{Account: a,
			health: gateway.AccountHealth{AccountID: a.ID, Channel: gateway.Telegram, Status: "disconnected"}}
	}
	return c
}

func (c *Connector) Channels() []gateway.Channel { return []gateway.Channel{gateway.Telegram} }

// Start launches one goroutine per account with a session file; accounts without one are logged and skipped.
func (c *Connector) Start(ctx context.Context, deliver gateway.Deliver) error {
	for _, a := range c.accts {
		path := filepath.Join(c.cfg.SessionDir, a.Session)
		if _, err := os.Stat(path); err != nil {
			c.log.Error("telegram: no session file, run the Telegram login tool for this account; skipping it",
				"account", a.ID, "session", path, "err", err)
			a.setHealth("disconnected", "no session file "+path)
			continue
		}
		go c.run(ctx, a, path, deliver)
	}
	return nil
}

// run keeps one account connected until ctx ends or Telegram says the account is dead.
func (c *Connector) run(ctx context.Context, a *account, path string, deliver gateway.Deliver) {
	for {
		err := c.session(ctx, a, path, deliver)
		if ctx.Err() != nil {
			return
		}
		a.mu.Lock()
		a.api, a.sender = nil, nil
		a.mu.Unlock()
		if reason, dead := banned(err); dead {
			c.log.Error("telegram: account unusable, stopping it", "account", a.ID, "reason", reason)
			a.setHealth("banned", reason)
			return
		}
		c.log.Warn("telegram: session ended, retrying", "account", a.ID, "err", err, "in", retryAfter)
		a.setHealth("disconnected", fmt.Sprint(err))
		select {
		case <-ctx.Done():
			return
		case <-time.After(retryAfter):
		}
	}
}

func (c *Connector) session(ctx context.Context, a *account, path string, deliver gateway.Deliver) error {
	d := tg.NewUpdateDispatcher()
	gaps := updates.New(updates.Config{Handler: d, Storage: c.store, AccessHasher: c.store, UserAccessHasher: c.store})
	opt := telegram.Options{
		SessionStorage: &session.FileStorage{Path: path},
		UpdateHandler:  gaps,
		Middlewares: []telegram.Middleware{
			floodwait.NewSimpleWaiter(),
			ratelimit.New(rate.Every(100*time.Millisecond), 5),
		},
	}
	if c.cfg.TestDC {
		opt.DCList, opt.DC = dcs.Test(), 2
	}
	client := telegram.NewClient(c.cfg.AppID, c.cfg.AppHash, opt)

	d.OnNewMessage(func(ctx context.Context, e tg.Entities, u *tg.UpdateNewMessage) error {
		m, ok := u.Message.(*tg.Message)
		if !ok {
			return nil
		}
		in, ok := toInbound(a.ID, m, e.Users)
		if !ok {
			return nil
		}
		if err := deliver(ctx, in); err != nil {
			c.log.Debug("telegram: inbound not routed", "account", a.ID, "peer", in.Peer, "err", err)
		}
		return nil // a rejected message must not stall the update stream
	})

	return client.Run(ctx, func(ctx context.Context) error {
		st, err := client.Auth().Status(ctx)
		if err != nil {
			return err
		}
		if !st.Authorized {
			return errLoggedOut
		}
		self, err := client.Self(ctx)
		if err != nil {
			return err
		}
		if self.Restricted {
			return errRestricted
		}
		a.mu.Lock()
		a.api, a.sender, a.self = client.API(), message.NewSender(client.API()), self.ID
		a.mu.Unlock()
		a.setHealth("ok", "")
		c.log.Info("telegram: account connected", "account", a.ID)
		return gaps.Run(ctx, client.API(), self.ID, updates.AuthOptions{})
	})
}

var (
	errLoggedOut  = errors.New("session not authorized")
	errRestricted = errors.New("account restricted")
)

// banned reports whether err means the account itself is unusable (logged out, deleted, banned, frozen).
func banned(err error) (string, bool) {
	switch {
	case err == nil:
		return "", false
	case errors.Is(err, errLoggedOut), errors.Is(err, errRestricted):
		return err.Error(), true
	}
	if e, ok := tgerr.As(err); ok {
		if auth.IsUnauthorized(err) || strings.HasPrefix(e.Type, "FROZEN_") ||
			e.IsOneOf("USER_DEACTIVATED", "USER_DEACTIVATED_BAN", "AUTH_KEY_UNREGISTERED", "SESSION_REVOKED") {
			return e.Type, true
		}
	}
	return "", false
}

func (a *account) setHealth(status, err string) {
	a.mu.Lock()
	a.health.Status, a.health.Err = status, err
	a.mu.Unlock()
}

// peer resolves a scammer's user id to an input peer using the access hash the updates manager stored.
func (c *Connector) peer(ctx context.Context, accountID, peer string) (*account, *tg.Client, *message.Sender, *tg.InputPeerUser, error) {
	a, ok := c.accts[accountID]
	if !ok {
		return nil, nil, nil, nil, gateway.ErrUnknownAccount
	}
	a.mu.Lock()
	api, sender, self := a.api, a.sender, a.self
	a.mu.Unlock()
	if sender == nil {
		return nil, nil, nil, nil, errNotReady
	}
	id, err := strconv.ParseInt(peer, 10, 64)
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("telegram: bad peer %q", peer)
	}
	hash, ok, err := c.store.GetUserAccessHash(ctx, self, id)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	if !ok {
		return nil, nil, nil, nil, fmt.Errorf("telegram: no access hash for peer %d on %s", id, accountID)
	}
	return a, api, sender, &tg.InputPeerUser{UserID: id, AccessHash: hash}, nil
}

// call runs one request for an account, flagging it banned if Telegram says so.
func (c *Connector) call(ctx context.Context, accountID, peer string, f func(*tg.Client, *message.Sender, *tg.InputPeerUser) error) error {
	a, api, sender, p, err := c.peer(ctx, accountID, peer)
	if err != nil {
		return err
	}
	err = f(api, sender, p)
	if reason, dead := banned(err); dead {
		a.setHealth("banned", reason)
	}
	return err
}

func (c *Connector) Send(ctx context.Context, m gateway.OutboundMessage) error {
	return c.call(ctx, m.AccountID, m.Peer, func(_ *tg.Client, s *message.Sender, p *tg.InputPeerUser) error {
		_, err := s.To(p).Text(ctx, m.Text)
		return err
	})
}

func (c *Connector) SetTyping(ctx context.Context, accountID, peer string, typing bool) error {
	return c.call(ctx, accountID, peer, func(_ *tg.Client, s *message.Sender, p *tg.InputPeerUser) error {
		b := s.To(p).TypingAction()
		if typing {
			return b.Typing(ctx)
		}
		return b.Cancel(ctx)
	})
}

func (c *Connector) MarkRead(ctx context.Context, accountID, peer, externalID string) error {
	maxID, err := strconv.Atoi(externalID)
	if err != nil {
		return fmt.Errorf("telegram: bad message id %q", externalID)
	}
	return c.call(ctx, accountID, peer, func(api *tg.Client, _ *message.Sender, p *tg.InputPeerUser) error {
		_, err := api.MessagesReadHistory(ctx, &tg.MessagesReadHistoryRequest{Peer: p, MaxID: maxID})
		return err
	})
}

func (c *Connector) Health(context.Context) []gateway.AccountHealth {
	out := make([]gateway.AccountHealth, 0, len(c.accts))
	for _, a := range c.accts {
		a.mu.Lock()
		out = append(out, a.health)
		a.mu.Unlock()
	}
	return out
}
