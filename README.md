# Buru AI

Scam intelligence network for Southeast Asia. Multilingual AI personas run on honeypot messaging accounts, pull mule bank accounts, crypto wallets, phone numbers and URLs out of scammer conversations, and serve verified intelligence to banks, e-wallets and exchanges through a low-latency lookup API.

- Product requirements: [docs/PRD.md](docs/PRD.md)
- Technical design: [docs/TRD.md](docs/TRD.md)

## Stack

Go modular monolith · Temporal (one workflow per conversation) · MySQL 8 · Redis · Claude API · Next.js + Tailwind dashboard · Docker Compose.

## Quick start

Requires Go 1.26+, Node 24 + pnpm, Docker, and [`migrate`](https://github.com/golang-migrate/migrate).

```sh
cp .env.example .env
make up            # MySQL :3307, Redis :6379, Temporal :7233 (UI :8233)
make migrate-up
make run           # API on :8080
curl localhost:8080/readyz
make web           # dashboard on :3000 (first time: cd web && pnpm install)
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
| `internal/workflows` | Temporal workflows (conversation workflow, TR-3) |
| `internal/gateway` | Telegram/WhatsApp message normalisation (TR-2) |
| `internal/persona` | Persona prompts and playbooks (TR-1, TR-4) |
| `internal/extraction` | Entity extraction + scam classification (TR-6, TR-7) |
| `internal/tracer` | On-chain USDT tracing (TR-8) |
| `internal/intel` | Entity store, dedupe, verification (TR-9) |
| `internal/customerapi` | Lookup API, API keys, webhooks (TR-10, TR-12, TR-13) |
| `migrations` | MySQL schema (golang-migrate) |
| `web` | Next.js dashboard: `/operator` console, `/portal` customer portal. `/api/*` proxies to the Go API |

## Commands

| Command | Does |
|---|---|
| `make up` / `make down` | Start / stop local dependencies |
| `make migrate-up` / `make migrate-down` | Apply / roll back one migration |
| `make run` | Run the app locally |
| `make web` | Run the dashboard locally |
| `make test` | `go test -race ./...` |
| `make lint` | `go vet` + golangci-lint |

## License

MIT
