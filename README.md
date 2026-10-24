# Buru AI

> Scam intelligence network for Southeast Asia: AI honeypot personas that turn scammer chats into verified intel for banks and e-wallets.

![Language](https://img.shields.io/badge/language-Go-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Table of Contents
- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Team](#team)

## About

Multilingual AI personas run on honeypot messaging accounts and keep scammers talking. Buru AI pulls mule bank accounts, crypto wallets, phone numbers and URLs out of those conversations, and serves verified intelligence to banks, e-wallets and exchanges through a low-latency lookup API.

- Product requirements: [docs/PRD.md](docs/PRD.md)
- Technical design: [docs/TRD.md](docs/TRD.md)

## Features

**Working today** (in memory, against a scripted scammer simulator):
- Full honeypot loop: message → entity extraction → scam classification → playbook stage → persona reply
- LLM-powered personas with a prompt-injection guard (Gemini in the demo, Claude in production)
- Playbook stage machine: rapport → bait → payment request → stall
- Entity extraction for bank accounts, phone numbers, TRON/ETH wallets and URLs
- Operator takeover and verify/reject; only verified entities return `high` confidence
- `POST /v1/lookup` customer API
- Next.js operator console and customer portal (on mock data)

**Planned:** see [Roadmap](#roadmap).

## Tech Stack

- **Frontend:** Next.js + Tailwind (operator console and customer portal)
- **Backend:** Go modular monolith, Temporal (one workflow per conversation), LLM: Gemini API (demo) → Claude API (production)
- **Database:** PostgreSQL on Supabase (sqlc + pgx), Redis
- **Infra / Deployment:** Supabase, Docker / Docker Compose

## Getting Started

### Prerequisites
- Go 1.26+
- Node 24 + pnpm
- Docker
- [`migrate`](https://github.com/golang-migrate/migrate)

### Installation
```bash
git clone https://github.com/JaxzTan/Buru_AI.git
cd Buru_AI
cd web && pnpm install && cd ..
```

### Environment Variables
Create `.env` at the repo root and set:

| Variable | Description |
|----------|-------------|
| `BURU_ENV` | Environment name |
| `BURU_HTTP_ADDR` | API listen address |
| `BURU_POSTGRES_URL` | PostgreSQL connection string |
| `BURU_REDIS_ADDR` | Redis address |
| `BURU_TEMPORAL_HOSTPORT` | Temporal server host:port |
| `BURU_TEMPORAL_NAMESPACE` | Temporal namespace |
| `BURU_TEMPORAL_TASK_QUEUE` | Temporal task queue (e.g. `buru-main`) |
| `SUPABASE_PASSWORD` | Supabase database password |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (dashboard) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (dashboard) |
| `DATABASE_URL` | Pooled database connection |
| `DIRECT_URL` | Direct database connection (migrations) |

### Run
```bash
make up            # PostgreSQL :5432, Redis :6379, Temporal :7233 (UI :8233)
make migrate-up
make run           # API on :8080
curl localhost:8080/readyz
make web           # dashboard on :3000
```

Smoke-test the Temporal worker:

```bash
docker compose exec temporal temporal workflow execute \
  --type Ping --task-queue buru-main --input '"buru"'
```

## Usage

| Command | Does |
|---|---|
| `make up` / `make down` | Start / stop local dependencies |
| `make migrate-up` / `make migrate-down` | Apply / roll back one migration |
| `make sqlc` | Generate `internal/db` from `db/queries` |
| `make run` | Run the API + Temporal worker |
| `make web` | Run the dashboard |
| `make test` | `go test -race ./...` |
| `make test-db` | DB integration tests (needs `make up migrate-up`) |
| `make lint` | `go vet` + golangci-lint |

## Project Structure

| Path | Purpose |
|---|---|
| `cmd/buru` | Entry point: HTTP server + Temporal worker |
| `internal/config` | Env-based config |
| `internal/server` | HTTP routes, health checks |
| `internal/workflows` | Temporal workflows (conversation workflow) |
| `internal/engine` | Honeypot loop: extract → classify → stage → persona reply |
| `internal/gateway` | Telegram/WhatsApp message normalisation |
| `internal/persona` | Persona prompts and playbooks |
| `internal/extraction` | Entity extraction + scam classification |
| `internal/tracer` | On-chain USDT tracing |
| `internal/intel` | Entity store, dedupe, verification |
| `internal/customerapi` | Lookup API, API keys, webhooks |
| `internal/db` | sqlc-generated data layer |
| `internal/demostore` | In-memory data layer seeded from `seed.json` (to be replaced by PostgreSQL + Redis) |
| `db/migrations` | PostgreSQL schema (golang-migrate) |
| `db/queries` | sqlc query files |
| `web` | Next.js dashboard: `/operator` console, `/portal` customer portal; `/api/*` proxies to the Go API |
| `docs` | PRD, TRD, contributing rules |

## Roadmap

- [ ] **M1 — Persona prototype:** Telegram connector, human-like reply timing (≥ 10 s, typing, typos)
- [ ] **M2 — Intelligence MVP:** persist personas, playbooks, sightings and verifications in PostgreSQL; LLM extraction
- [ ] **M3 — Customer pilot:** API keys + usage, batch lookup, Redis cache, p95 < 300 ms
- [ ] **M4 — Pilot-to-paid:** on-chain tracer (TronGrid / Etherscan), HMAC webhooks, WhatsApp, customer dashboard on live data

## Contributing

Branching, naming and PR rules are in [docs/Contributing_rules.md](docs/Contributing_rules.md). In short: branch from `dev` as `feature/*`, open a PR into `dev`; `main` only takes PRs from `dev`.

## License

MIT. See [LICENSE](LICENSE).

## Team

**Jaxz Tan Cheng Soo**
- GitHub: [@JaxzTan](https://github.com/JaxzTan)
- LinkedIn: [jaxz-tan-cheng-soo](https://www.linkedin.com/in/jaxz-tan-cheng-soo-a2b9b6361/)

**Gilbert Gan**
- GitHub: [@GGWX88](https://github.com/GGWX88)
- LinkedIn: [gilbert-gan](https://www.linkedin.com/in/gilbert-gan-362816401)

**Jayci Gan**
- GitHub: [@jaycigan05](https://github.com/jaycigan05)
- LinkedIn: [jayci-gan](https://www.linkedin.com/in/jayci-gan-b777472b9/)

**Hor Jian Jia**
- GitHub: [@hjianjia](https://github.com/hjianjia)
- LinkedIn: [hor-jian-jia](https://www.linkedin.com/in/jian-jia-hor-a08238404/)

**Andy Wong**
- GitHub: [@Andybunnny](https://github.com/Andybunnny)
- LinkedIn: [andy-wong-andybunnny](https://www.linkedin.com/in/andywongjiandao/)
