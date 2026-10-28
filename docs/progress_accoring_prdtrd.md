# Progress: Sockabus against PRD v1.0 and TRD v1.0

| Field | Value |
|---|---|
| Author | Jaxz Tan |
| Last updated | 26 Oct 2026 |
| Branch checked | `dev` @ `90a797a` |
| Related | [PRD_V1.0.md](PRD_V1.0.md) · [TRD_V1.0.md](TRD_V1.0.md) |
| Target | **v1.0 bank demo, 2 Nov 2026** (7 days) |

## Summary

```
v1.0 demo path (7 steps)   ████████░░░░░░░░░░░░  ~40%
v1.0 infra (NFR-9/10/11)   ██░░░░░░░░░░░░░░░░░░  ~10%
Release criteria (§13)      ░░░░░░░░░░░░░░░░░░░░   0/5
```

The backend for the demo is mostly built: persona auto-reply through Temporal workflows, persona generation, takeover, extraction, classification, verification and `/v1/lookup` all exist in Go on PostgreSQL, and `go test ./...` passes (10 packages). The v1.0 gap is everything around it. The dashboard (`web/`) still runs on `web/src/lib/mock.ts`, and monitoring, Playwright tests, deployment, the web chat channel and the bank simulator page don't exist yet.

Percentages are estimates from reading the code; they are not the G-13 audit.

## Code vs TRD v1.0 — needs a decision

TRD v1.0 §12 says two things that the code contradicts:

| Gap | TRD v1.0 says | Code on `dev` |
|---|---|---|
| G-11 | "Chat runs through a CLI; no Telegram connection" | gotd connector exists (`internal/channel/telegram`), is wired in `cmd/sockabus/main.go` when `SOCKABUS_TG_APP_ID` is set, and has a login tool (`make tglogin`) and test-network tool (`make tgchat`) |
| G-12 | "No backend endpoint or button" | `POST /internal/personas/generate` exists (`internal/server/live.go:42`, `internal/persona/generator.go`). No dashboard button |

Whether the connector works against a real Telegram account has not been checked. The G-13 audit should confirm both rows, then either the TRD or this file gets corrected.

## v1.0 demo path (PRD §10)

| # | Demo step | Reqs | Progress | What exists | Missing for v1.0 |
|---|---|---|---|---|---|
| 1 | Generate a persona with one click | FR-15, FR-1 | ~60% | Generator endpoint, schema validation, prompt version 1, tests | Dashboard button; < 30 s check |
| 2 | Teammate chats with the persona on Telegram (fallback: web chat) | FR-2, FR-3, FR-4 | ~60% | Telegram connector (unconfirmed live), Temporal workflow with ≥ 10 s delay + typing, playbook stages, CLI simulator | Live Telegram test; web chat page + `/internal/dev/inject` (TR-22); `webchat` channel migration |
| 3 | Operator watches live and takes over | FR-5 | ~45% | Takeover signal, operator-message endpoint, close endpoint | Wire `web/` live-chats page to the API (polling is fine) |
| 4 | Bank account / wallet appears as an entity | FR-6, FR-7 | ~70% | LLM + regex extraction, confidence levels, sightings, classifier with `loan` | Entity list in `web/` wired to API |
| 5 | Operator verifies it | FR-9 | ~55% | Verify/reject API, append-only `verifications` | Verification page wired to API |
| 6 | Bank simulator checks a transfer → held | FR-10 | ~40% | `POST /v1/lookup` on PostgreSQL with shared token | Bank simulator page |
| 7 | Status page shows bot + endpoints healthy | NFR-9 | ~10% | `/healthz`, `/readyz` (PostgreSQL + Redis) | `/internal/status`, Temporal in health check, Telegram heartbeat, Uptime Kuma, status page |

## v1.0 infrastructure

| ID | Requirement | Progress | What exists | Missing |
|---|---|---|---|---|
| NFR-9 / TR-20 | Monitoring, alert within 2 min | ~10% | `/healthz`, `/readyz` | Uptime Kuma container, heartbeat push from connector, `/internal/status`, alerts to team Telegram group |
| NFR-10 / TR-21 | Automated tests on every PR, merge blocked | ~25% | CI runs `go vet`, `go test -race`, `sqlc diff/vet`, migrations up/down, DB tests, web build | `fake` LLM provider; Playwright API + UI tests (`tests/`, `playwright.config.ts`); `api/openapi.yaml`; `data-testid`s; configurable reply delay for CI (currently hard floor 10 s); branch protection |
| NFR-11 / TR-23 | 24/7 server, one-command deploy | ~5% | Docker Compose for local (app, PostgreSQL, Redis, Temporal, web) | VPS, Caddy, `make deploy`, server `.env`, nightly `pg_dump` + restore test |

## Release criteria (TRD §13, due Sun 1 Nov)

| # | Criterion | Status |
|---|---|---|
| 1 | All demo-path test cases pass in CI | ❌ No Playwright tests yet |
| 2 | Demo rehearsed twice on the deployed server | ❌ No server |
| 3 | Uptime Kuma green 24 h; forced bot stop alerts in < 2 min | ❌ No Kuma |
| 4 | Database backup taken and restore tested | ❌ |
| 5 | Repo tagged `v1.0.0` | ❌ |

## Post-v1.0 requirements

| ID | Requirement | Milestone | Progress | Notes |
|---|---|---|---|---|
| FR-8 | On-chain tracing | M4 | ~5% | Schema + mock UI |
| FR-10 (full) | Batch lookup, Redis cache, p95 < 300 ms | M3 | — | Redis connected, unused |
| FR-11 (full) | Trend chart, CSV export | M4 | ~30% | Portal pages on mock data |
| FR-12 | Webhooks | M4 | ~5% | Schema + mock UI |
| FR-13 | API keys + usage | M3 | ~10% | Schema + sqlc queries (G-7) |
| FR-14 | Evidence reports | Stretch | 0% | — |
| NFR-1/2 | Lookup latency, 1,000 conversations | M3 | — | No load test (TR-15) |
| NFR-3 | TLS, hashed keys, rate limits | M3 | ~10% | Shared token |
| NFR-4 | Encryption at rest, retention | M3 | ~40% | AES-256-GCM single key (G-8) |
| NFR-5 | Legal review | M3 | 0% | Not started |
| NFR-6 | Multilingual personas | — | ~40% | Code-switching in prompts; no evals |
| NFR-8 | Tamper-proof audit trail | — | ~60% | Append-only triggers + grants |

## TRD §12 gaps

| # | Gap | In v1.0? | Status |
|---|---|---|---|
| G-6 | Regenerate `db/schema.dbml` | ✅ | Open (10 min) |
| G-7 | Operator TOTP + customer API keys | ❌ | Open |
| G-8 | KMS envelope encryption | ❌ | Open |
| G-9 | Persistent Telegram update state | ⚠ | Open |
| G-10 | Account health auto-status | ⚠ | Open |
| G-11 | Telegram connector live | ✅ | Code exists; live test pending (see above) |
| G-12 | Persona generation endpoint + button | ✅ | Endpoint done; button missing |
| G-13 | Audit of extraction, verify, lookup | ✅ | Due today (Mon 26 Oct) |

## Critical path to 2 Nov

1. **Mon 26 Oct:** G-13 audit, including a live Telegram test on the honeypot number (about 2 hours)
2. **Tue–Wed:** wire `web/` operator pages to `/internal/*` and add the generate button (about 2 days)
3. **Wed–Thu:** web chat + `/internal/dev/inject`, `fake` LLM provider, Playwright API + UI tests (about 2 days, can run in parallel with step 2)
4. **Thu–Fri:** VPS + Caddy + Uptime Kuma + `make deploy` (about 1 day)
5. **Fri 30 Oct 12:00:** Telegram-or-web-chat decision, then two rehearsals on the server

## Quick wins

1. Regenerate `db/schema.dbml` (G-6): 10 minutes
2. Add Temporal to the `/readyz` check: 30 minutes
3. Add a `fake` provider to `internal/llm/llm.go`: 1 hour
