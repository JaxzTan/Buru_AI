# TRD: Buru AI — Scam Intelligence Network for Southeast Asia

| Field | Value |
|---|---|
| Author | Jaxz Tan |
| Status | Draft |
| Version | 0.4 |
| Last updated | 24 Oct 2026 |
| Related PRD | [PRD.md](PRD.md) |

**Revision history**

| Version | Date | Changes |
|---|---|---|
| 0.1 | 21 Oct 2026 | First draft. |
| 0.2 | 23 Oct 2026 | Database moved from MySQL 8 to PostgreSQL 15+; data access via sqlc + pgx; migrations via golang-migrate. Data model synced with schema (added operators, prompt versions, playbooks, customer users, webhook deliveries; plural table names; persona statuses). |
| 0.3 | 23 Oct 2026 | Fixed §2/§7 contradiction on query builders; §4 now points to `db/schema.dbml` as a generated diagram; added §12 implementation gaps. |
| 0.4 | 24 Oct 2026 | Live Telegram honeypot (M1 + M2): LLM access goes through a provider interface with Gemini 3.8 Flash as the configured default (Claude still supported); migration 000004 adds `personas.profile`/`demo_identifiers`, `conversations.scammer_peer_ref`, `messages.dedupe_key` and append-only triggers; G-4 and G-5 closed; G-7 to G-10 added. |

## 1. Overview & scope

Buru AI is a Go backend that runs multilingual AI personas on honeypot messaging accounts, extracts scam entities (bank accounts, wallets, phone numbers, URLs) from conversations, traces crypto wallets on-chain, and serves verified intelligence to banks, e-wallets and exchanges through a low-latency lookup API, webhooks and a dashboard. This TRD covers all PRD Must and Should requirements (FR-1 to FR-13, NFR-1 to NFR-8). FR-14 (evidence reports), voice, and telco call diversion are deferred.

## 2. Architecture

Modular monolith in Go, with long-running conversations orchestrated as Temporal workflows. Split into services only when a module's load demands it (the persona engine and lookup API are the likely first splits).

```mermaid
flowchart TB
  subgraph Channels
    TG[Telegram connector<br/>MTProto user accounts]
    WA[WhatsApp connector]
  end
  subgraph Core["Buru AI core (Go monolith)"]
    GW[Channel gateway]
    PE[Persona engine]
    EX[Extraction + classification]
    TR[Chain tracer]
    IN[Intel service]
    CA[Customer API + webhooks]
  end
  TMP[Temporal<br/>conversation workflows]
  LLM[LLM API]
  CH[TronGrid / Etherscan]
  DB[(PostgreSQL)]
  RD[(Redis)]
  DASH[Dashboard<br/>operator + customer]

  TG & WA <--> GW
  GW <--> TMP
  TMP <--> PE
  PE <--> LLM
  TMP --> EX
  EX <--> LLM
  EX --> IN
  IN --> TR
  TR <--> CH
  IN <--> DB
  CA <--> RD
  CA <--> DB
  DASH <--> CA
```

| Component | Responsibility |
|---|---|
| Channel gateway | Normalises inbound/outbound messages from all channels into one message format. |
| Telegram / WhatsApp connectors | Maintain sessions for honeypot accounts; send/receive messages. |
| Persona engine | Builds prompts from persona config + scam playbook + history; generates replies. |
| Temporal workflows | One workflow per conversation: human-like delays, playbook stage, operator takeover, timeouts. |
| Extraction + classification | LLM structured extraction of entities + regex validators; scam-type labelling. |
| Chain tracer | Follows USDT transfers 1–2 hops on TRON/Ethereum; tags known exchange addresses. |
| Intel service | Entity store, dedupe, verification workflow, confidence scoring. |
| Customer API + webhooks | Lookup API, API-key auth, rate limiting, webhook delivery. |
| Dashboard | Operator console (personas, live chats, verification) + customer portal (search, trends, keys). |

**Data access:** All SQL comes from sqlc-generated queries, or a parameterised builder for dynamic filters (§7).

**Deployment:** Docker Compose on a VPS in Singapore or Malaysia for MVP; managed PostgreSQL; Temporal Cloud or self-hosted Temporal. Move to Kubernetes only after M4.

## 3. Tech stack & rationale

| Layer | Choice | Why | Alternative considered |
|---|---|---|---|
| Backend | Go | Known stack; strong concurrency for thousands of conversations. | Node.js |
| Workflow orchestration | Temporal | Durable timers and state for long, delayed, pausable conversations. | Cron + DB state machine |
| Database | PostgreSQL 15+ | `jsonb` for persona/playbook/watch-rule config; native enums; `UNIQUE NULLS NOT DISTINCT` for entity dedupe; per-table grants to enforce append-only audit tables. | MySQL 8 |
| Data access | sqlc + pgx | Type-safe Go generated from plain SQL; every query parameterised (no string-built SQL); full control over hot lookup queries. | GORM, ent, Prisma (Go client archived Jul 2025) |
| Migrations | golang-migrate | Versioned up/down SQL files; same folder is sqlc's schema source. | Atlas |
| Cache | Redis | Lookup API hot cache; rate limiting. | In-memory only |
| Queue | Temporal task queues (MVP); Kafka later | Avoid extra infra until volume justifies it. | Kafka from day one |
| LLM | Provider interface (`internal/llm`). Default: Gemini 3.8 Flash (`gemini-3.8-flash`, thinking level low) for personas and extraction; Claude API supported via `BURU_LLM_PROVIDER=anthropic` | Swap providers by config; personas, extraction and the persona generator never call a vendor SDK directly. | Self-hosted open model |
| Telegram | gotd/td (Go MTProto client) | User accounts behave like real people, unlike bots. | Bot API (scammers ignore bots) |
| WhatsApp | whatsmeow (Go) | Only practical Go option for personal accounts. | Official Business API (not suitable for personas) |
| Chain data | TronGrid + Etherscan APIs | USDT on TRON is dominant in SEA scams. | Paid analytics provider |
| Frontend | Next.js + Tailwind | Fast to build dashboard. Talks only to the Go API, never directly to the database. | Plain React |
| Auth | Operator: email + TOTP; Customer: API keys + dashboard login | Simple, adequate for B2B MVP. | Auth0 |
| Hosting | Docker on VPS (SG/MY region) | Cheap, low latency to SEA customers. | AWS ap-southeast-1 |

## 4. Data model

PostgreSQL 15+. All timestamps are `timestamptz` (UTC). Migrations under `db/migrations` are the source of truth; `db/schema.dbml` is a diagram of them for viewing in dbdiagram.io. After changing migrations, regenerate it instead of editing it by hand:

```bash
npx @dbml/cli db2dbml postgres "$DATABASE_URL" -o db/schema.dbml
```

**Operators, personas and accounts**

| Entity | Key fields | Relations / notes |
|---|---|---|
| `operators` | id, email, role (operator/admin), totp_secret_ref, created_at | Referenced by prompt versions, messages, verifications |
| `personas` | id, name, age, language_mix (jsonb), backstory, wealth_profile (jsonb), profile (jsonb), demo_identifiers (jsonb, masked), status (draft/active/paused/retired) | 1 → many `honeypot_accounts`; many ↔ many `playbooks`. `profile` holds persona-generator fields; demo identifiers are masked and never placed in a prompt |
| `persona_prompt_versions` | id, persona_id, version, system_prompt, created_by, created_at | Unique (persona_id, version) — TR-1 |
| `playbooks` | id, scam_type, name, version, stages (jsonb) | Stage machine per scam type — TR-4 |
| `persona_playbooks` | persona_id, playbook_id | Join table |
| `honeypot_accounts` | id, persona_id, channel (telegram/whatsapp), phone, session_ref, status (active/banned/cooldown), banned_at, cooldown_until | belongs to `personas` — TR-17 |

**Conversations**

| Entity | Key fields | Relations / notes |
|---|---|---|
| `conversations` | id, account_id, playbook_id, temporal_workflow_id, scammer_handle, scammer_peer_ref, scam_type, stage, status (bot/human/closed), started_at, last_message_at, closed_at | 1 → many `messages`. `scammer_peer_ref` is the channel reply address (Telegram: user id + access hash) |
| `messages` | id, conversation_id, direction, sender_type (scammer/persona/operator), operator_id, body_ciphertext (bytea), dek_ref, sent_at, dedupe_key | **Append-only** (grants + triggers). Encrypted — TR-14. `dedupe_key` makes redelivered updates and retried sends idempotent |

**Intelligence**

| Entity | Key fields | Relations / notes |
|---|---|---|
| `entities` | id, type (bank_account/wallet/phone/url/handle), value_normalized, bank_or_chain, confidence (low/medium/high), status (unverified/verified/rejected), sightings_count, first_seen, last_seen | Unique (type, value_normalized, bank_or_chain) `NULLS NOT DISTINCT`. many ↔ many `conversations` via `entity_sightings` |
| `entity_sightings` | id, entity_id, conversation_id, message_id, extracted_at | **Append-only** — audit trail (NFR-8). Unique (entity_id, message_id) |
| `verifications` | id, entity_id, operator_id, decision (verified/rejected), note, decided_at | **Append-only** |
| `chain_transfers` | id, wallet_entity_id, chain (tron/ethereum), token, tx_hash, log_index, from_wallet, to_wallet, amount (numeric 38,18), hop, to_label, ts | Unique (chain, tx_hash, log_index, wallet_entity_id) |

**Customers**

| Entity | Key fields | Relations / notes |
|---|---|---|
| `customers` | id, name, type (bank/ewallet/exchange), webhook_url, webhook_secret_ref, watch_rules (jsonb) | 1 → many `api_keys`, `customer_users` |
| `customer_users` | id, customer_id, email, password_hash | Dashboard login |
| `api_keys` | id, customer_id, key_prefix, key_hash, status (active/revoked), rate_limit_per_min, created_at, revoked_at | |
| `lookup_logs` | id, customer_id, api_key_id, entity_type, matched, latency_ms, ts | Usage + billing (FR-13). Does not store the looked-up value |
| `webhook_deliveries` | id, customer_id, entity_id, event_type, payload (jsonb), status (pending/delivered/failed), attempts, last_response_code, created_at, delivered_at | Delivery log — TR-12 |

**Design notes**

- `sightings_count` is denormalised on `entities` so the lookup API never counts sightings at request time.
- `entities.confidence` is an enum. Extractor scores alone can reach at most `medium`; only an operator verification sets `high` (see §10, false positives, and G-5 in §12).
- Secrets (session files, TOTP secrets, webhook secrets) are stored only as `*_ref` pointers to the secret store.
- Redis cache and Temporal workflow state live outside PostgreSQL; `conversations.temporal_workflow_id` links them.

## 5. API design

| Method | Path | Purpose | Auth | Maps to FR |
|---|---|---|---|---|
| POST | `/v1/lookup` | Check one entity | API key | FR-10 |
| POST | `/v1/lookup/batch` | Check up to 100 entities | API key | FR-10 |
| GET | `/v1/entities` | List/filter entities, CSV export | Customer session | FR-11 |
| GET | `/v1/entities/{id}/trace` | On-chain trace for a wallet | Customer session | FR-8 |
| PUT | `/v1/webhooks` | Set webhook URL + watch rules | Customer session | FR-12 |
| POST/DELETE | `/v1/keys` | Create / revoke API keys | Customer session | FR-13 |
| GET | `/v1/usage` | Monthly lookup counts | Customer session | FR-13 |
| POST | `/internal/personas` | Create/edit persona | Operator | FR-1 |
| POST | `/internal/accounts` | Bind honeypot account | Operator | FR-2 |
| POST | `/internal/conversations/{id}/takeover` | Pause bot / take over | Operator | FR-5 |
| POST | `/internal/entities/{id}/verify` | Verify / reject entity | Operator | FR-9 |
| WS | `/internal/live` | Live conversation stream (`message.new`, `entity.extracted`) | Operator | FR-5, FR-9 |

**Example — `POST /v1/lookup`**

```json
// request
{ "type": "bank_account", "value": "1234567890", "bank": "MBB" }

// response
{
  "match": true,
  "confidence": "high",
  "scam_types": ["job", "investment"],
  "first_seen": "2026-09-02T10:14:00Z",
  "last_seen": "2026-10-19T08:41:00Z",
  "sightings": 7
}
```

## 6. Technical requirements

| ID | Requirement | Implements | Notes |
|---|---|---|---|
| TR-1 | Persona config schema with language mix, backstory, wealth profile; injected into system prompt with conversation history. | FR-1, NFR-6 | Prompts versioned in `persona_prompt_versions`. |
| TR-2 | Channel connectors for Telegram (MTProto) and WhatsApp, normalised by gateway; route by account → persona. | FR-2 | Session secrets in secret store. |
| TR-3 | Temporal workflow per conversation with randomised reply delay (min 10 s), typing simulation and inactivity timeout. | FR-3, NFR-2 | Durable timers survive restarts. |
| TR-4 | Scam playbooks as stage machines (rapport → bait → payment request → stall); stage stored on conversation. | FR-4 | Playbook per scam type. |
| TR-5 | Takeover signal to workflow halts bot replies instantly; operator messages sent via same gateway. | FR-5 | Temporal signals. |
| TR-6 | Extraction pipeline: LLM structured output + validators (bank account length per bank, TRON/ETH address checksum, URL normalisation); dedupe on normalised value. | FR-6 | Runs on every inbound message. Dedupe via unique index on `entities`. |
| TR-7 | Scam-type classifier on conversation summary; re-run at each stage change. | FR-7 | |
| TR-8 | Chain tracer job: fetch USDT transfers for wallet, follow 2 hops, label known exchange deposit addresses. | FR-8 | Rate-limit external APIs. |
| TR-9 | Verification queue in dashboard; status changes logged to append-only `verifications`. | FR-9, NFR-8 | |
| TR-10 | Lookup API backed by Redis cache of verified entities (normalised keys); PostgreSQL fallback. | FR-10, NFR-1 | Target p95 < 300 ms. |
| TR-11 | Dashboard entity list with filters, trend chart, CSV export. | FR-11 | Optional filters via sqlc nullable params or a parameterised builder. |
| TR-12 | Webhook dispatcher with HMAC signatures, retries with backoff, delivery log in `webhook_deliveries`; triggered on verification matching watch rules. | FR-12, NFR-3 | Temporal activity. |
| TR-13 | API key issuance (show once, store hash), revocation, per-key rate limits, `lookup_logs` usage counts. | FR-13, NFR-3 | |
| TR-14 | Encrypt message bodies at rest (envelope encryption); redact non-essential personal data in customer outputs. | NFR-4 | |
| TR-15 | Load test: 1,000 concurrent conversation workflows; 100 req/s lookup. | NFR-1, NFR-2 | k6 + Temporal metrics. |
| TR-16 | Health checks, uptime monitoring, alerting on API errors and account bans. | NFR-7 | |
| TR-17 | Account health monitor: detect banned/limited honeypot accounts, move to cooldown, alert operator. | FR-2, NFR-7 | Ban rate is a key ops metric. |
| TR-18 | Legal review checklist recorded before customer pilot (honeypot operation, PDPA, data-sharing agreement). | NFR-5 | Non-code gate for M3. |

## 7. Security & compliance

- **Auth:** operators use email + TOTP with role-based access (operator, admin); customers use hashed API keys over TLS plus dashboard login.
- **Secrets:** channel session files, LLM keys and chain API keys kept in a secret manager (or encrypted env on VPS for MVP), never in the repo.
- **Input validation:** all customer inputs validated and normalised; scammer messages are treated as untrusted. Prompt-injection guardrails stop scammer text from changing persona instructions or leaking system details. All database access goes through sqlc-generated parameterised queries, or a parameterised builder (e.g. squirrel) for dynamic dashboard filters; string-built SQL is not allowed.
- **Append-only enforcement:** the application's database role has INSERT and SELECT only on `messages`, `entity_sightings` and `verifications`; no UPDATE or DELETE.
- **Rate limiting:** per API key in Redis; webhook endpoints signed with HMAC.
- **Data stored:** conversations, scammer identifiers, mule account numbers, wallets. Encrypted at rest; retention 24 months for entities, 12 months for raw messages (to confirm with legal).
- **Custody:** Buru AI never holds, sends or receives funds. Personas never actually transfer money. This keeps the product outside payment and crypto-asset licensing scope.
- **Regulatory posture:** customers are BNM/SC-regulated, so expect vendor due-diligence (security questionnaire, data processing agreement). PDPA 2010 applies to personal data handled. Get a legal opinion on honeypot account operation and data sharing before the first pilot (TR-18).
- **Platform terms:** operating persona accounts on Telegram/WhatsApp likely breaches their terms of service; this is a business risk (see Risks), not a licensing issue.

## 8. Infrastructure & environments

| Environment | Setup |
|---|---|
| Local | Docker Compose: Go app, PostgreSQL, Redis, Temporal dev server; LLM calls mocked or live with low limits. |
| Staging | VPS mirror of prod with test honeypot accounts and a sandbox customer. |
| Prod | Docker on VPS (SG/MY), managed PostgreSQL, Redis, Temporal Cloud. |

- **Repo layout (data):** `db/migrations` (golang-migrate up/down files, also sqlc's schema source), `db/queries` (sqlc query files), `db/schema.dbml` (generated diagram), `sqlc.yaml` (engine `postgresql`, `sql_package: pgx/v5`).
- **CI/CD:** GitHub Actions — lint, test, `sqlc diff` (generated code up to date), `sqlc vet`, migrations up/down check, build image, deploy to staging on merge; manual promote to prod.
- **Observability:** structured logs (JSON), Prometheus metrics + Grafana, Sentry for errors. Key dashboards: lookup latency, conversations by stage, extraction rate, account ban rate, LLM cost per conversation.

## 9. Testing strategy

| Area | Approach | Tools |
|---|---|---|
| Extraction validators | Table-driven unit tests per bank/chain format | Go `testing` |
| Persona quality | Golden-conversation evals: replay scam scripts, score realism and stage progression | Custom eval harness + LLM grader |
| Prompt injection | Adversarial scammer messages must not break persona | Eval suite |
| Workflows | Temporal test environment for delays, takeover, timeouts | Temporal Go SDK testsuite |
| Database queries | Integration tests against real PostgreSQL; migrations applied fresh per run | testcontainers-go + golang-migrate |
| Lookup API | Integration tests + load test (p95 < 300 ms @ 100 req/s) | k6 |
| Dashboard | E2E for verify flow and API key flow | Playwright |
| Webhooks | Delivery, retry, signature verification tests | Go `testing` + mock server |

## 10. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Honeypot accounts banned by Telegram/WhatsApp | High | High | Account health monitor (TR-17), human-like behaviour, account pool rotation, diversify channels; pursue telco partnership long-term. |
| Too few scammer contacts from self-seeding | Medium | High | Seed via scam ads, job posts, Telegram groups; measure weekly; partner with an e-wallet or telco for diverted traffic. |
| Scammers detect AI personas | Medium | Medium | Continuous evals, human takeover, timing/typo realism, persona diversity. |
| LLM cost per conversation too high | Medium | Medium | Smaller model for extraction, summarised history, cap turns per stage. |
| False positives harm innocent account holders | Low | High | Only verified entities return high confidence; confidence scores; customer dispute flow. |
| Legal challenge to honeypot or data sharing | Low | High | Legal review before pilot (TR-18); clear data processing agreements. |

## 11. Estimation & sequencing

| Order | Work | Size | Milestone |
|---|---|---|---|
| 1 | Repo, Docker Compose, PostgreSQL migrations, sqlc setup, Temporal setup | S | M1 |
| 2 | Telegram connector + gateway (TR-2) | M | M1 |
| 3 | Persona engine + conversation workflow with delays (TR-1, TR-3) | L | M1 |
| 4 | Playbooks + takeover (TR-4, TR-5) | M | M2 |
| 5 | Extraction, validators, classifier (TR-6, TR-7) | M | M2 |
| 6 | Operator dashboard + verification queue (TR-9) | M | M2 |
| 7 | Lookup API, Redis cache, API keys (TR-10, TR-13) | M | M3 |
| 8 | Security hardening, encryption, legal gate (TR-14, TR-18) | M | M3 |
| 9 | Chain tracer, customer dashboard, webhooks (TR-8, TR-11, TR-12) | L | M4 |
| 10 | WhatsApp connector, account health monitor (TR-17) | M | M4 |

**Critical path:** 2 → 3 → 4 → 5 → 7. Without convincing personas producing real entities, there is nothing to sell.
**Parallelisable:** the dashboard (6, 9) and chain tracer (9) can be built by a second person once the data model is fixed. The legal review (TR-18) should start in parallel with M2, not after.

## 12. Open implementation gaps (doc ahead of code)

This section tracks where the code still differs from this TRD. Delete each row once it is done.

| # | Gap | Current code | Target | Done when |
|---|---|---|---|---|
| G-6 | Schema diagram | `db/schema.dbml` hand-copied from design | Regenerated from real migrations with `db2dbml` | File matches applied migrations |
| G-7 | Operator auth | Live operator API and `/v1/lookup` use one bearer token (`BURU_OPERATOR_TOKEN`) mapped to `BURU_OPERATOR_ID` | Operators: email + TOTP with roles; customers: hashed API keys (FR-13, M3) | Token removed |
| G-8 | Envelope encryption | AES-256-GCM with one key from `BURU_MESSAGE_KEY`; `dek_ref = local:v1` | Per-conversation data keys wrapped by a KMS (TR-14, M3) | Rows re-encrypted or readable under both refs |
| G-9 | Telegram update state | gotd update state and access hashes are in memory; messages sent while the app is down are not replayed | Persistent state storage per account (e.g. bbolt or PostgreSQL) | Restart replays missed messages |
| G-10 | Account health | Connector stops an account on `AUTH_KEY_UNREGISTERED` / `USER_DEACTIVATED*` and logs it | TR-17: set status `banned`/`cooldown` and alert the operator (M4) | Status changes automatically |
