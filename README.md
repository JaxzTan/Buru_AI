# Buru AI

Scam intelligence network for Southeast Asia. Multilingual AI personas run on honeypot messaging accounts, pull mule bank accounts, crypto wallets, phone numbers and URLs out of scammer conversations, and serve verified intelligence to banks, e-wallets and exchanges through a low-latency lookup API.

- Product requirements: [docs/PRD.md](docs/PRD.md)
- Technical design: [docs/TRD.md](docs/TRD.md)
- Live Telegram honeypot setup and testing: [docs/telegram-honeypot.md](docs/telegram-honeypot.md)

## Stack

Go modular monolith · Temporal (one workflow per conversation) · PostgreSQL 16 (sqlc + pgx) · Redis · Telegram via gotd/td (MTProto user accounts) · LLM behind `internal/llm` (Gemini 3.8 Flash default, Claude supported) · Next.js + Tailwind dashboard · Docker Compose.

## Quick start

Requires Go 1.26+, Node 24 + pnpm, Docker, and [`migrate`](https://github.com/golang-migrate/migrate).

```sh
cp .env.example .env
make up            # PostgreSQL :5432, Redis :6379, Temporal :7233 (UI :8233)
make migrate-up
make run           # API on :8080 (BURU_MODE=demo: in-memory pitch data)
curl localhost:8080/readyz
make web           # dashboard on :3000 (first time: cd web && pnpm install)
```

Live honeypot on a real Telegram account (`BURU_MODE=live`): see [docs/telegram-honeypot.md](docs/telegram-honeypot.md).

```sh
make seed && make tglogin PHONE=+60XXXXXXXXX PERSONA=1 && make run
```

Smoke-test the Temporal worker:

```sh
docker compose exec temporal temporal workflow execute \
  --type Ping --task-queue buru-main --input '"buru"'
```

## Layout

| Path | Purpose |
|---|---|
| `cmd/buru` | Entry point: HTTP server + Temporal worker |
| `internal/config` | Env-based config |
| `internal/server` | HTTP routes, health checks |
| `internal/workflows` | Temporal `ConversationWorkflow`: reply timing, typing, takeover (TR-3, TR-5) |
| `internal/gateway` | Channel-neutral inbound/outbound types and sender registry (TR-2) |
| `internal/channel/telegram` | Telegram connector on gotd/td (FR-2) |
| `internal/honeypot` | Live engine: inbound routing, workflow activities, operator actions, lookup |
| `internal/persona` | Persona system prompt, output guard, persona generator (TR-1) |
| `internal/playbook` | Playbook stage machine (TR-4) |
| `internal/llm` | LLM boundary: Gemini and Claude clients |
| `internal/msgcrypt` | Message encryption at rest (TR-14) |
| `cmd/tglogin` | One-time Telegram login for a honeypot number |
| `internal/extraction` | Entity extraction + scam classification (TR-6, TR-7) |
| `internal/tracer` | On-chain USDT tracing (TR-8) |
| `internal/intel` | Entity store, dedupe, verification (TR-9) |
| `internal/customerapi` | Lookup API, API keys, webhooks (TR-10, TR-12, TR-13) |
| `db/migrations` | PostgreSQL schema (golang-migrate) |
| `db/queries` | sqlc query files; `make sqlc` generates `internal/db` |
| `db/seed` | Demo operator, playbooks and personas (`make seed`) |
| `web` | Next.js dashboard: `/operator` console, `/portal` customer portal. `/api/*` proxies to the Go API |

## Commands

| Command | Does |
|---|---|
| `make up` / `make down` | Start / stop local dependencies |
| `make migrate-up` / `make migrate-down` | Apply / roll back one migration |
| `make seed` | Load demo operator, playbooks and personas |
| `make keys` | Print fresh `BURU_OPERATOR_TOKEN` and `BURU_MESSAGE_KEY` values |
| `make tglogin PHONE=… PERSONA=…` | Log a honeypot number into Telegram and bind it |
| `make test-e2e` | End-to-end honeypot loop on local PostgreSQL + Temporal |
| `make run` | Run the app locally |
| `make web` | Run the dashboard locally |
| `make test` | `go test -race ./...` |
| `make lint` | `go vet` + golangci-lint |

## License

MIT
