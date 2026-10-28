# Makefile

Shortcuts for local development. Run every target from the repo root.

## Requirements

| Tool | Needed for | Install |
|---|---|---|
| Docker | `up`, `down` | Docker Desktop |
| Go 1.26+ | `run`, `test`, `test-db`, `lint` | go.dev/dl |
| golang-migrate | `migrate-up`, `migrate-down` | `brew install golang-migrate` |
| sqlc | `sqlc` | `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest` |
| pnpm | `web` | `corepack enable` |
| golangci-lint v2 | `lint` | `brew install golangci-lint` (found as `golangci-lint-v2` or `golangci-lint`) |

## Targets

| Target | What it runs | Use when |
|---|---|---|
| `make up` | `docker compose up -d --wait postgres redis temporal` | Starting work: brings up the 3 dependencies and waits until healthy |
| `make down` | `docker compose down` | Stopping the dependencies. Does not stop `app`/`web` profile containers (see [docker.md](docker.md)) |
| `make migrate-up` | `migrate -path db/migrations ... up` on `MIGRATE_DB` | After pulling new migrations |
| `make migrate-down` | `migrate ... down 1` | Undoing the most recent migration |
| `make sqlc` | `sqlc generate` then `sqlc vet` | After changing any file in `db/migrations` or `db/queries` |
| `make run` | `go run ./cmd/sockabus` | Running the Go API on `:8080` |
| `make web` | `cd web && pnpm dev` | Running the dashboard on `:3000` (proxies `/api/*` to `:8080`) |
| `make test` | `go test -race ./...` | Unit tests. DB tests are skipped |
| `make test-db` | `go test ./internal/db/` on `MIGRATE_DB` | DB integration tests. Needs migrations applied |
| `make lint` | `go vet` + golangci-lint | Before opening a PR |

## Which database each target uses

The Makefile loads `.env` and exports every variable in it. It strips quotes from `SOCKABUS_POSTGRES_URL` and `DATABASE_URL`, because `make` keeps them and Go would reject the URL.

| Target | Database |
|---|---|
| `migrate-up`, `migrate-down`, `test-db` | `DATABASE_URL` from `.env` (Supabase owner, `sslmode=require` added if the URL has no query). Local Docker when `DATABASE_URL` is empty |
| `run` | `SOCKABUS_POSTGRES_URL` from `.env` |

`test-db` writes inside transactions that are rolled back, so nothing is kept, but it still runs on whatever database `DATABASE_URL` points at.

Use local Docker for one run: `make migrate-up DATABASE_URL=` (a command-line value overrides `.env`; an empty shell variable does not).

These targets do not echo their command, because the URL contains the password.

## Typical flows

**First run on a new machine**
```sh
cp .env.example .env   # fill in values
make up
make migrate-up
make run        # terminal 1
make web        # terminal 2
```

**Changing the schema**
1. Add `db/migrations/00000N_<name>.up.sql` and its `.down.sql`.
2. `make migrate-up`
3. Update `db/queries/*.sql` if needed, then `make sqlc`.
4. `make test-db`

**Before a PR**
```sh
make lint && make test && make test-db
```

## Variables

| Variable | Default | Meaning |
|---|---|---|
| `MIGRATE_DB` | `DATABASE_URL` from `.env`, else `LOCAL_DB` | Database for `migrate-*` and `test-db` |
| `LOCAL_DB` | `postgres://buru:buru@localhost:5432/buru?sslmode=disable` | Local Docker database |
| `SQLC` | `sqlc` on `PATH`, else `$(go env GOPATH)/bin/sqlc` | sqlc binary |
| `GOLANGCI` | `golangci-lint-v2` or `golangci-lint` on `PATH`, else `$(go env GOPATH)/bin/golangci-lint` | Linter binary |

Override one for a single run: `make migrate-up MIGRATE_DB='postgres://...'`.
