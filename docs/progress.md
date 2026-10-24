# Progress: Buru AI against PRD v0.2 and TRD v0.3

| Field | Value |
|---|---|
| Author | Jaxz Tan |
| Last updated | 23 Oct 2026 |
| Branch checked | `dev` (after PR #3) |
| Related | [PRD.md](PRD.md) (v0.2) · [TRD.md](TRD.md) (v0.3) |

## Summary

```
Build (FR + NFR)   █████░░░░░░░░░░░░░░░  ~25%
PRD goals (§2)     ░░░░░░░░░░░░░░░░░░░░   0/4  (needs real scammers + customers)
```

The full honeypot loop (message → extraction → classification → stage → persona reply) runs in memory with a scripted scammer simulator. The PostgreSQL schema is in place, but no code reads or writes it yet, and there is no real messaging channel. Percentages are estimates from reading the code against each requirement.

## Milestones (PRD §9)

| Milestone | Scope | Progress | Blocker |
|---|---|---|---|
| M1 — Persona prototype | FR-1, FR-2, FR-3 | `█████░░░░░` ~25% | No Telegram connector (FR-2); reply delay is 4–9 s, FR-3 needs ≥ 10 s |
| M2 — Intelligence MVP | FR-4, FR-5, FR-6, FR-7, FR-9 | `█████░░░░░` ~45% | All in memory; no sqlc repositories on the new schema (G-4) |
| M3 — Customer pilot | FR-10, FR-13, NFR-1, NFR-3, NFR-5 | `█░░░░░░░░░` ~10% | No API keys, batch lookup, Redis cache or legal review |
| M4 — Pilot-to-paid | FR-8, FR-11, FR-12, WhatsApp | `█░░░░░░░░░` ~10% | Chain tracer and webhooks are mock UI only |

## Functional requirements

| ID | Requirement | Priority | Progress | What exists | Missing |
|---|---|---|---|---|---|
| FR-1 | Personas | Must | ~40% | Schema (`personas`, `persona_prompt_versions`); in-memory create; Claude system prompt with injection guard | Lifecycle and prompt versions persisted |
| FR-2 | Honeypot accounts (Telegram) | Must | ~5% | Schema; in-memory account endpoints | Telegram connector + gateway (gotd/td) |
| FR-3 | Human-like timing | Must | ~30% | Random 4–9 s delay in a goroutine | ≥ 10 s minimum, typing/typos, Temporal durable timers |
| FR-4 | Playbooks steer to payment | Must | ~40% | Stage machine rapport → bait → payment request → stall; seed playbooks | Persisted playbooks, Temporal workflow |
| FR-5 | Operator takeover | Should | ~50% | Takeover stops the bot immediately; operator messages flagged | Temporal signal, persisted `sender_type` |
| FR-6 | Entity extraction | Must | ~50% | Regex + validators for bank (length per bank), phone, TRON/ETH, URL; unit tests | Confidence as low/medium/high level (G-5), LLM extraction, persisted sightings |
| FR-7 | Scam-type classification | Must | ~60% | Keyword classifier | `loan` label (added in PRD v0.2) |
| FR-8 | On-chain tracing | Should | ~5% | Schema (`chain_transfers`); mock UI | TronGrid / Etherscan tracer |
| FR-9 | Operator verification | Must | ~40% | Verify/reject API; only verified returns `high` | Append-only `verifications` in PostgreSQL |
| FR-10 | Lookup API | Must | ~35% | `POST /v1/lookup` with TRD response shape | Batch lookup (≤ 100), Redis cache, p95 < 300 ms |
| FR-11 | Customer dashboard | Should | ~30% | Next.js portal pages on mock data | Wire `web/` to Go API, CSV export |
| FR-12 | Webhooks | Should | ~5% | Schema (`webhook_deliveries`); mock UI | HMAC dispatcher with retries |
| FR-13 | API keys + usage | Must | ~10% | Schema; mock UI | Key issuance/revocation, `lookup_logs` counting |
| FR-14 | Evidence reports | Could | 0% | — | Deferred (stretch) |

## Non-functional requirements

| ID | Requirement | Progress | Notes |
|---|---|---|---|
| NFR-1 | Lookup p95 < 300 ms @ 100 req/s | 0% | No Redis cache or load test |
| NFR-2 | ≥ 1,000 concurrent conversations | 0% | Needs Temporal workflows |
| NFR-3 | TLS, hashed keys, rate limits | ~5% | `key_hash` column only |
| NFR-4 | Encryption at rest, retention | ~5% | `body_ciphertext` + `dek_ref` columns only |
| NFR-5 | Legal review | 0% | Start alongside M2 |
| NFR-6 | Multilingual personas | ~30% | Prompt allows code-switching; Hokkien in seed data; no evals |
| NFR-7 | ≥ 99.5% availability | ~5% | `/healthz`, `/readyz` only |
| NFR-8 | Tamper-proof audit trail | ~10% | Schema; append-only grants not yet applied |

## Recent changes

- ✅ PostgreSQL 16 schema, migrations (`db/migrations`) and pgx driver — TRD G-1 to G-3 closed.
- ⚠️ Go HTML console removed. The only UI is `web/`, which still runs on `web/src/lib/mock.ts` and makes no calls to the Go API.

## Critical path to M1

1. Telegram connector (gotd/td) — about 3–5 days
2. Temporal ConversationWorkflow with ≥ 10 s delay — about 2–3 days
3. Persist personas, accounts and messages via sqlc — about 2 days

## Quick wins

1. Add `loan` to the classifier (`internal/extraction/extract.go`) — 2 minutes
2. Map extractor float to confidence level, with tests (G-5) — 30 minutes
3. Add `POST /v1/lookup/batch` on the existing lookup — 1 hour
