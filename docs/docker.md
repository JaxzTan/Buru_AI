# Docker

Docker runs the local development stack. Staging and prod follow [TRD.md](TRD.md) §8 (managed PostgreSQL on Supabase, Temporal Cloud).

## Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local stack: 3 dependencies + 2 app containers |
| `Dockerfile` | Go API image (`cmd/buru`) |
| `web/Dockerfile` | Next.js dashboard image |
| `.dockerignore`, `web/.dockerignore` | Keep `.env`, `.git`, `node_modules` and `.next` out of builds |

## Services

| Container | Image | Ports | Starts with | Notes |
|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | `make up` | User, password and DB are all `buru`. Data persists in the `postgres-data` volume |
| `redis` | `redis:7.4-alpine` | 6379 | `make up` | Lookup cache and rate limits (TR-10, TR-13) |
| `temporal` | `temporalio/temporal:1.5.1` | 7233 (gRPC), 8233 (web UI) | `make up` | Dev server; workflow history is in memory and resets on restart |
| `app` | built from `Dockerfile` | 8080 | `--profile app` | Go API. Uses the local `postgres` container, not Supabase |
| `web` | built from `web/Dockerfile` | 3000 | `--profile app` | Next.js dashboard. Proxies `/api/*` to `http://app:8080` |

Container names are fixed (`container_name`), so they must be unique on your machine. If another project already has a container named `postgres` or `redis`, `docker compose up` fails: stop that container or rename these.

## Common tasks

| Task | Command |
|---|---|
| Start dependencies only (develop Go/web on the host) | `make up` |
| Start everything in containers | `docker compose --profile app up -d --build` |
| Rebuild after code changes | `docker compose --profile app up -d --build app web` |
| Stop everything | `docker compose --profile app down` |
| Stop and delete local database data | `docker compose --profile app down -v` |
| See status | `docker compose --profile app ps` |
| Follow logs | `docker compose logs -f app web` |
| Temporal UI | open `http://localhost:8233` |

`make down` runs plain `docker compose down`, which does not stop the `app` and `web` profile containers. Use the `--profile app down` command above to stop everything.

## Images

**Go API (`Dockerfile`)**
1. `golang:1.26-alpine` builds a static binary from `./cmd/buru`.
2. `gcr.io/distroless/static-debian12:nonroot` runs it: no shell, non-root user, about 49 MB.

**Web (`web/Dockerfile`)**
1. `deps`: `pnpm install --frozen-lockfile`.
2. `build`: `pnpm build` with `output: "standalone"` (`web/next.config.ts`).
3. Runtime: `node:24-alpine` runs `server.js` as the `node` user, about 290 MB.

The Go API address is baked in at build time (`BURU_API_URL` build arg, default `http://app:8080`), because Next.js fixes rewrites during `next build`. Changing it means rebuilding the `web` image.

## Configuration and secrets

- The `app` container reads `.env` through `env_file`, then overrides `BURU_POSTGRES_URL`, `BURU_REDIS_ADDR` and `BURU_TEMPORAL_HOSTPORT` to point at the other containers.
- `.env` is never copied into an image (`.dockerignore`).
- To run the `app` container against Supabase, remove the `BURU_POSTGRES_URL` override and use the Supabase **Session pooler** URL. The direct host (`db.<ref>.supabase.co`) is IPv6-only, and Docker Desktop cannot reach it.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `container name "/postgres" is already in use` | Another container has that name | `docker rm -f postgres`, or rename in `docker-compose.yml` |
| `/api/*` returns 500 from `web` | `app` is not running or not healthy | `docker compose logs app` |
| `/readyz` shows a postgres error | Database not ready or wrong URL | `docker compose ps postgres`; check `BURU_POSTGRES_URL` |
| Web still shows old UI | Image not rebuilt | `docker compose --profile app up -d --build web` |
| Port already allocated | Something on the host uses 5432, 6379, 8080 or 3000 | Stop it, or change the left side of `ports:` |
