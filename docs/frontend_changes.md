# Frontend Changes

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
