# Frontend: `gilbert` branch vs `web/` (feature/frontend_integrate)

Both start from the same design source — the `unknown-frontend` prototype (tokens, `uk-*` components, operator console + customer portal). They differ in stack, data, and scope.

## Summary

| | `gilbert` | `web/` on `feature/frontend_integrate` |
|---|---|---|
| UI | Prototype HTML served as-is: `internal/server/pages/console.html`, `portal.html` (React UMD, no build) | Ported to Next.js 16 + Tailwind v4: typed TSX components, one App Router route per page |
| Data | Live — `fetch('/internal/…')`, `fetch('/v1/…')` against a Go demo backend | Mock — `web/src/lib/mock.ts` |
| Backend | New: seeded demo store, extraction pipeline, persona engine, scripted scammer simulator | None yet; `/api/*` proxies to Go (`SOCKABUS_API_URL`, default `:8080`) |
| Served at | `/console`, `/portal` (Go server) | `/operator/*`, `/portal/*` (Next.js) |
| Run | `go run ./cmd/demo` | `cd web && pnpm dev` |
| Matches TRD stack | Backend yes, frontend no | Frontend yes, backend not wired |

## `gilbert` — what it adds

Commits: `a7a98dc`, `d1308bb` ("BuruAI V2").

- `cmd/demo/demo_main.go` — demo entrypoint.
- `internal/demostore/` — in-memory store seeded from `seed.json`.
- `internal/engine/` — conversation engine + `sim.go` scripted scammers; each line runs through extraction → classification → stage machine → persona reply.
- `internal/extraction/` — entity extraction (with tests).
- `internal/persona/` — persona logic.
- `internal/server/demo.go`, `pages.go` — serves the two HTML pages (embedded) and the API below.

### API endpoints

Customer (`/v1`):

- `POST /v1/lookup`
- `GET /v1/entities`
- `GET /v1/weeks`
- `GET /v1/usage`

Operator (`/internal`):

- `GET /internal/entities`, `/weeks`, `/playbooks`, `/conversations`, `/personas`, `/accounts`
- `POST /internal/entities/{id}/verify`
- `POST /internal/conversations/{id}/takeover`, `/close`, `/operator-message`, `/inbound`
- `POST /internal/extract`
- `POST /internal/personas`
- `POST /internal/accounts`, `POST /internal/accounts/{id}/status`, `DELETE /internal/accounts/{id}`

### Also changed on `gilbert` (check if intentional)

- Deletes `.env.example`.
- Deletes `internal/server/server_test.go`.

## `web/` — what it adds

- `src/app/globals.css` — design tokens + Tailwind `@theme` mapping (`bg-surface`, `text-ink-muted`, …); prototype CSS in `@layer components`.
- `src/components/ui/` — 12 design-system components as TSX (Button, StatusBadge, ScamTypeTag, EntityValue, StatTile, LookupResult, EntityTable, StageTrack, ConversationThread, PersonaCard, ApiKeyRow, TraceHops).
- `src/components/app/` — Shell (sidebar, theme toggle), Toast, Tabs, Modal, Field, Select, charts.
- `src/app/operator/*` — overview, live-chats, verification, personas, honeypot-accounts, playbooks, entities.
- `src/app/portal/*` — lookup, entities, trends, webhooks, api-keys, usage.
- State per app in `operator/store.tsx`, `portal/store.tsx`; data from `src/lib/mock.ts`.

## Overlap

The UI is duplicated: same screens, same design, two implementations. The backend exists only on `gilbert`.

## Recommendation

Keep the `web/` Next.js frontend as the product UI and `gilbert`'s Go backend as its API:

1. Merge `gilbert`'s Go packages (`demostore`, `engine`, `extraction`, `persona`, `server/demo.go`).
2. Replace `web/src/lib/mock.ts` reads with `fetch('/api/v1/…')` / `fetch('/api/internal/…')` calls to those endpoints (through the existing `/api` proxy).
3. Keep `console.html` / `portal.html` only as a no-build demo, or drop them once `web/` is wired.

Estimated effort for step 2: 1–2 hours.
