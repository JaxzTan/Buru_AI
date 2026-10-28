# Frontend Changes

## 2026-10-28 — Sockabus Console replaces the "unknown" dashboard

`web/` now runs the Sockabus Console from `front-end/sockabus-console` (spec: `front-end/Sockabus-Frontend-Spec-v1.1.md`), rebuilt as Next.js pages.

### Routes

| Screen | Route | URL state |
|---|---|---|
| S1 Personas | `/personas` | `?status=` `&new=` |
| S2 Conversations | `/conversations/[id]` | `?status=` |
| S3 Verify queue | `/verify` | `?selected=` |
| S4 Entities | `/entities` | `?type=` `&status=` `&q=` |
| S5 Bank simulator | `/demo/bank` | none |
| S6 Status | `/status` | none |
| S7 Web chat | `/demo/chat` | `?persona=` |

`/` redirects to `/personas`. The old `/operator/*` and `/portal/*` pages are removed (customer portal is not v1.0, spec Area 5.3).

### Where things live

| Path | What |
|---|---|
| `src/lib/store.ts` | Demo data and every action (generate, verify, lookup…). Each action is one swap point for the Go API |
| `src/lib/sim.ts` | Stand-ins for backend work: extraction, classification, persona replies, lookup rules |
| `src/lib/seed.ts` | Sample data and the golden script |
| `src/lib/hooks.ts` | `useQuery` (URL state), `DEV_CHAT` flag |
| `src/components/` | Shell (sidebar, demo path, toasts), shared atoms, chat pieces |
| `src/app/<route>/view.tsx` | One client component per screen |

### Notes

- Data is still sample data kept in the browser (localStorage). "Reset demo data" in the sidebar restores the seed.
- `NEXT_PUBLIC_DEV_CHAT=false` hides Web chat, the demo path bar, the reset button and the Status "Simulate" toggle. Unset means on.
- Fonts (Archivo, Archivo Black, JetBrains Mono) are self-hosted in `src/app/fonts/`, so builds don't fetch Google Fonts.
- Tailwind was removed; styles are the prototype's `styles.css` in `src/app/globals.css`.

## 2026-10-23 — Removed duplicate HTML frontend

The project had two frontends doing the same job:

- **Next.js app** in `web/` — `/operator` console and `/portal` customer portal (kept)
- **Static HTML pages** embedded in the Go server — `/console` and `/portal` (removed)

The Next.js app is now the only frontend. The Go server serves the API only.

### Deleted

| File | What it was |
|------|-------------|
| `internal/server/pages/console.html` | Operator console, static HTML (~216 KB) |
| `internal/server/pages/portal.html` | Customer portal, static HTML (~205 KB) |
| `internal/server/pages.go` | Embedded the HTML files with `//go:embed pages/*.html` and served them |

### Edited

**`internal/server/demo.go`** — removed the page routes from `registerDemo`:

```go
// --- pages ---
mux.HandleFunc("GET /{$}", ...) // redirected / to /console
mux.HandleFunc("GET /console", page("pages/console.html"))
mux.HandleFunc("GET /portal", page("pages/portal.html"))
```

The comment on `registerDemo` was changed to "mounts the API the Next.js UIs (web/) call."

**`internal/server/server.go`** — the comment on `WithDemo` now says it enables the console and portal APIs instead of pages.

### Behavior change

- `GET /`, `/console` and `/portal` on the Go server (`:8080`) now return 404.
- Open the UI through Next.js (`cd web && pnpm dev`): `/operator` and `/portal`.
- Next.js forwards `/api/*` to the Go API (`BURU_API_URL`, default `http://localhost:8080`).

### Verified

- `go build ./...` passes
- `go vet ./internal/server/` passes
