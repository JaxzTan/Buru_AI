# Sockabus — Telegram Connector Guide (TR-2, G-11)

Oct 28, 2026 · @Jaxz

## Goal and scope

The connector logs in as a real Telegram **user account** (not a bot), receives private messages from scammers, hands them to the gateway, and sends persona replies back with a typing indicator. It must work by the **Fri 30 Oct 2026, 12:00** decision point, or the demo falls back to web chat (PRD §8, TRD TR-22).

**Does**

- Hold one MTProto session per honeypot account with [gotd/td](https://github.com/gotd/td) (TRD §3: scammers ignore bots).
- Receive private messages, drop everything else, pass them to the gateway with a dedupe key.
- Send replies the gateway asks for, with "typing…" first.
- Push a heartbeat to Uptime Kuma every 60 s (TR-20) and stop loudly on a ban (G-10).

**Does not**

- Call the LLM, decide delays or track playbook stage. That is the Temporal workflow (TR-3, TR-5).
- Join groups, read channels or message first. Scammers contact the persona.
- WhatsApp (post-v1).

Conventions: `[推理]` = author's reasoning, not a sourced fact. Code is a starting skeleton against gotd's documented API; compile and adjust against the version in `go.mod`.

## Message flow

Inbound goes connector → gateway → Temporal; the reply comes back through a Temporal activity that calls the connector's `Send`. Web chat plugs into the same gateway, which is why it works as the demo fallback and the CI test path (TR-22).

&#91;embedded content: Telegram message flow · inbound and outbound\]

## Prerequisites

One SIM gives one account; the account plus an `api_id`/`api_hash` pair is all the code needs. Open question in PRD §8: which phone number / SIM is the honeypot.

1. Insert the SIM in a spare phone, install Telegram, create the account.
2. Set a username, name and photo that match the persona (e.g. Auntie Mei, Penang).
3. Turn on 2FA: Settings → Privacy and Security → Two-Step Verification. A stolen session file alone then cannot take over the account. \[推理\]
4. Log in at [my.telegram.org](https://my.telegram.org) → API development tools → create an app → copy `api_id` and `api_hash` (TRD §3).
5. Use the account normally on the phone for a day or two before automating it. Fresh accounts on unofficial clients get limited more often. \[推理\]
6. Keep the phone and SIM charged and safe: Telegram may send login codes to the app or by SMS later.

If my.telegram.org errors for a brand-new account, wait a day and retry. \[推理\]

## Package layout and config

The connector is a channel inside the Go monolith, next to the web chat channel; both talk only to the gateway (TRD §2). \[推理: paths are a suggestion\]

```
cmd/tglogin/main.go             # one-off interactive login, writes the session file
internal/channel/telegram/
  client.go                     # build client, middlewares, gap manager
  handler.go                    # incoming message -> gateway.Inbound
  sender.go                     # outgoing: typing + text (called by a Temporal activity)
  heartbeat.go                  # Uptime Kuma push
  connector.go                  # Run(ctx): wires everything, exits on fatal errors
```

```bash
go get github.com/gotd/td@latest
go get github.com/gotd/contrib@latest   # optional: floodwait, bbolt state
```

| Env var | Example | Notes |
| --- | --- | --- |
| `SOCKABUS_TG_APP_ID` | `1234567` | From my.telegram.org |
| `SOCKABUS_TG_APP_HASH` | `0123abcd…` | Secret |
| `SOCKABUS_TG_PHONE` | `+60123456789` | Login only |
| `SOCKABUS_TG_PASSWORD` | `…` | 2FA, login only; do not keep on the server after login \[推理\] |
| `SOCKABUS_TG_SESSION_PATH` | `/data/tg/mei.session.json` | Secret, on a volume |
| `SOCKABUS_TG_ACCOUNT_ID` | `1` | `honeypot_accounts.id` it belongs to |
| `SOCKABUS_KUMA_PUSH_URL` | `https://status.…/api/push/<token>` | Heartbeat target |

All in `.env` on the VPS only, never in the repo (TRD §7).

## Client and session

The client wraps your dispatcher in gotd's update gap manager, installed both as the update handler and as a middleware, so missed or out-of-order updates are recovered. This is the pattern in gotd's official [updates example](https://github.com/gotd/td/blob/main/examples/updates/main.go) and [updates recovery docs](https://64479934.gotd.pages.dev/docs/helpers/updates-recovery).

```go
// internal/channel/telegram/client.go
package telegram

import (
    "github.com/gotd/td/session"
    tdtg "github.com/gotd/td/telegram"
    "github.com/gotd/td/telegram/updates"
    updhook "github.com/gotd/td/telegram/updates/hook"
    "github.com/gotd/td/tg"
    "go.uber.org/zap"
)

func newClient(cfg Config, d tg.UpdateDispatcher, log *zap.Logger) (*tdtg.Client, *updates.Manager) {
    gaps := updates.New(updates.Config{
        Handler: d,
        Logger:  log.Named("gaps"),
        // Storage: boltstor.NewStateStorage(db), // G-9, optional: survives restarts
    })
    client := tdtg.NewClient(cfg.AppID, cfg.AppHash, tdtg.Options{
        SessionStorage: &session.FileStorage{Path: cfg.SessionPath},
        UpdateHandler:  gaps,
        Middlewares: []tdtg.Middleware{
            updhook.UpdateHook(gaps.Handle),
            // floodwait / ratelimit middlewares from github.com/gotd/contrib
        },
        Logger: log.Named("tg"),
    })
    return client, gaps
}
```

The session file is the login. Anyone holding it controls the account until the session is revoked from the phone (Settings → Devices). Treat it like a password. \[推理\]

## First login (tglogin)

Run a small interactive binary **once, on the server**, to create the session file; the main app then reuses it and never prompts. Logging in on the server avoids copying a session file across machines. \[推理\]

```go
// cmd/tglogin/main.go
func main() {
    ctx := context.Background()
    cfg := loadConfigFromEnv()
    client := telegram.NewClient(cfg.AppID, cfg.AppHash, telegram.Options{
        SessionStorage: &session.FileStorage{Path: cfg.SessionPath},
    })
    codePrompt := auth.CodeAuthenticatorFunc(func(ctx context.Context, _ *tg.AuthSentCode) (string, error) {
        fmt.Print("Enter code from the Telegram app: ")
        var code string
        _, err := fmt.Scanln(&code)
        return strings.TrimSpace(code), err
    })
    flow := auth.NewFlow(auth.Constant(cfg.Phone, cfg.Password, codePrompt), auth.SendCodeOptions{})

    if err := client.Run(ctx, func(ctx context.Context) error {
        if err := client.Auth().IfNecessary(ctx, flow); err != nil { return err }
        self, err := client.Self(ctx)
        if err != nil { return err }
        fmt.Printf("Logged in as @%s (id %d)\n", self.Username, self.ID)
        return nil
    }); err != nil {
        log.Fatal(err)
    }
}
```

```bash
# on the VPS
docker compose run --rm app /app/tglogin
# code arrives inside the Telegram app on the persona phone
chmod 600 /data/tg/mei.session.json
```

Refs: [gotd auth package](https://pkg.go.dev/github.com/gotd/td/telegram/auth), [gotd examples](https://github.com/gotd/td/tree/main/examples).

## Receive: filter and hand to gateway

Keep only incoming text from private chats with real users, then pass a normalised message to the gateway. The `AccessHash` from `e.Users` is required to reply later, so it goes into `conversations.scammer_peer_ref` (TRD §4). gotd's docs show this exact type-assert-and-lookup pattern ([handling updates](https://64479934.gotd.pages.dev/docs/basics/handling-updates)).

```go
// internal/channel/telegram/handler.go
func registerHandlers(d tg.UpdateDispatcher, gw gateway.Gateway, accountID int64, log *zap.Logger) {
    d.OnNewMessage(func(ctx context.Context, e tg.Entities, u *tg.UpdateNewMessage) error {
        m, ok := u.Message.(*tg.Message)
        if !ok || m.Out {
            return nil // service message, or our own outgoing message
        }
        pu, ok := m.PeerID.(*tg.PeerUser)
        if !ok {
            return nil // groups and channels are ignored
        }
        user, ok := e.Users[pu.UserID]
        if !ok || user.Bot {
            return nil
        }
        if m.Message == "" {
            // photo / sticker / voice: v1 records a placeholder so the persona can react [推理]
            m.Message = "[non-text message]"
        }
        err := gw.Inbound(ctx, gateway.Message{
            Channel:   "telegram",
            AccountID: accountID,
            PeerRef:   fmt.Sprintf("%d:%d", user.ID, user.AccessHash),
            Handle:    user.Username, // may be empty
            Text:      m.Message,
            SentAt:    time.Unix(int64(m.Date), 0).UTC(),
            DedupeKey: fmt.Sprintf("tg:%d:%d:%d", accountID, user.ID, m.ID),
        })
        if err != nil {
            log.Error("gateway inbound", zap.Error(err))
        }
        return nil // never return the error: it would stall the update stream [推理]
    })
}
```

`gw.Inbound` (shared with web chat) does: insert into `messages` with `ON CONFLICT (dedupe_key) DO NOTHING`, find or create the conversation for `(account_id, peer_ref)`, then `SignalWithStart` the conversation's Temporal workflow. The connector never calls the LLM.

## Send: typing and text

A Temporal activity calls `Send` after the workflow's 10–90 s thinking delay (TR-3). The connector only adds the short typing time, so a restart mid-delay is safe. Operator messages after takeover use the same function (TR-5).

```go
// internal/channel/telegram/sender.go
type Sender struct{ msg *message.Sender } // message.NewSender(client.API())

func (s *Sender) Send(ctx context.Context, peerRef, text string) error {
    var id, hash int64
    if _, err := fmt.Sscanf(peerRef, "%d:%d", &id, &hash); err != nil {
        return fmt.Errorf("bad peer ref %q: %w", peerRef, err)
    }
    peer := &tg.InputPeerUser{UserID: id, AccessHash: hash}

    _ = s.msg.To(peer).TypingAction().Typing(ctx) // shows "typing…" for ~5 s
    d := time.Duration(len([]rune(text))) * 150 * time.Millisecond
    if d > 8*time.Second { d = 8 * time.Second } // slow typist, capped [推理]
    select {
    case <-time.After(d):
    case <-ctx.Done(): return ctx.Err()
    }
    _, err := s.msg.To(peer).Text(ctx, text)
    return err
}
```

- The Temporal activity must be idempotent on retry: record the outbound `messages` row with a dedupe key **before** sending, and skip if already sent. \[推理\]
- Long replies: split on blank lines into 2–3 messages to look human (optional). \[推理\]
- Mark the scammer's message as read just before typing with `MessagesReadHistory` so the double tick appears naturally (optional). \[推理\]

Ref: [gotd message package](https://pkg.go.dev/github.com/gotd/td/telegram/message).

## Run loop and heartbeat

`Run` blocks for the life of the process: check the session, start the heartbeat, then hand control to the gap manager, as in gotd's updates example. If it returns, the connector is down and the heartbeat stops with it.

```go
// internal/channel/telegram/connector.go
func (c *Connector) Run(ctx context.Context) error {
    d := tg.NewUpdateDispatcher()
    registerHandlers(d, c.gw, c.cfg.AccountID, c.log)
    client, gaps := newClient(c.cfg, d, c.log)

    return client.Run(ctx, func(ctx context.Context) error {
        status, err := client.Auth().Status(ctx)
        if err != nil { return err }
        if !status.Authorized {
            return errors.New("telegram: not logged in, run tglogin")
        }
        self, err := client.Self(ctx)
        if err != nil { return err }
        c.sender.Set(message.NewSender(client.API()))
        c.status.SetConnected(true) // feeds /internal/status (TRD §5)
        defer c.status.SetConnected(false)

        go heartbeat(ctx, c.cfg.KumaPushURL)
        return gaps.Run(ctx, client.API(), self.ID, updates.AuthOptions{
            OnStart: func(ctx context.Context) { c.log.Info("telegram connected", zap.String("user", self.Username)) },
        })
    })
}
```

```go
// internal/channel/telegram/heartbeat.go
func heartbeat(ctx context.Context, url string) {
    t := time.NewTicker(60 * time.Second)
    defer t.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-t.C:
            resp, err := http.Get(url + "?status=up&msg=OK")
            if err == nil { resp.Body.Close() }
        }
    }
}
```

In Uptime Kuma, create a **Push** monitor with a 60 s interval and 1 retry; no push for \~2 min triggers the alert (TR-20). Also update `last_message_at` in status on every inbound message so the dashboard shows it (NFR-9).

## Failure handling

Rule: fatal errors exit the connector so the heartbeat stops and the operator is alerted; transient errors retry. Never fail silently (NFR-9).

| Error / situation | Meaning | Action |
| --- | --- | --- |
| `AUTH_KEY_UNREGISTERED`, `SESSION_REVOKED` | Session logged out | Exit; re-run `tglogin` (G-10) |
| `USER_DEACTIVATED`, `USER_DEACTIVATED_BAN` | Account banned | Exit; mark account `banned` by hand in v1; switch persona to spare account |
| `FLOOD_WAIT_X` | Too many requests, wait X s | floodwait middleware from gotd/contrib waits and retries |
| `PEER_FLOOD` | Account limited for messaging | Stop sending; alert; cool down (TRD `cooldown` status) \[推理\] |
| Network drop | Connection lost | gotd reconnects; gap manager recovers missed updates while the process is alive |
| Process restart | Update state is in memory (G-9) | Messages sent while down may be missed; optional bbolt state storage fixes it |

```go
if tgerr.Is(err, "AUTH_KEY_UNREGISTERED", "SESSION_REVOKED", "USER_DEACTIVATED", "USER_DEACTIVATED_BAN") {
    c.log.Error("telegram account unusable", zap.Error(err))
    c.status.SetConnected(false)
    return err // let the process supervisor restart; heartbeat stays down until fixed
}
```

Error names are Telegram RPC errors; check the exact strings against [Telegram's error list](https://core.telegram.org/api/errors) when coding. Use `restart: unless-stopped` in Compose, but expect a restart loop on a ban: that is fine, Kuma still alerts. \[推理\]

## Ops and deploy

The connector runs inside the app container on the 24/7 VPS (TR-23); a laptop that sleeps misses scammer messages (NFR-11).

```yaml
# docker-compose.yml (excerpt)
services:
  app:
    env_file: .env
    volumes:
      - tg-sessions:/data/tg      # session files survive redeploys
    restart: unless-stopped
volumes:
  tg-sessions:
```

- **One process per account.** Two processes on one session file conflict. If the app scales to 2 replicas, only one may run the connector (env flag `SOCKABUS_TG_ENABLED=true` on one). \[推理\]
- **Secrets:** `api_hash`, session file and 2FA password never in logs, repo or CI. Remove `SOCKABUS_TG_PASSWORD` from `.env` after login.
- **Backup:** include `/data/tg` in the nightly backup (TRD §8); losing it means logging in again with the phone.
- **Revoke:** if the VPS is compromised, end the session from the phone (Settings → Devices).
- **Spare account:** prepare a second SIM/account early; bans are rated High likelihood (TRD §10).

## Testing and done checklist

Telegram itself is not automated in CI; web chat exercises the same gateway path (TRD §9). The connector gets unit tests for its own logic plus a manual run on the real account.

**Unit tests (Go `testing`)**

- Handler filter: outgoing, group, channel, bot and service messages are dropped; private user text passes.
- `PeerRef` and `DedupeKey` format; `Sscanf` round-trip in `Send`.
- Typing delay cap.
- Use a fake `gateway.Gateway` that records calls.

**Done when (G-11), on the deployed server**

- [ ] A teammate messages the honeypot account from their phone → message appears in the dashboard live chat
- [ ] Persona reply arrives after 10–90 s with "typing…" first
- [ ] Same message delivered twice creates one `messages` row
- [ ] Takeover stops bot replies; operator message is sent from the persona account
- [ ] `docker compose restart app` → next message still gets a reply, no new login
- [ ] Stop the connector → Kuma alert within 2 min
- [ ] Group messages and bot messages are ignored
- [ ] Go / no-go recorded at Fri 30 Oct 12:00 (else web chat fallback)
