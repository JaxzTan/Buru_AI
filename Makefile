-include .env
export

# make keeps quotes from .env values; strip them so Go and migrate get a valid URL
BURU_POSTGRES_URL := $(subst ",,$(BURU_POSTGRES_URL))
DATABASE_URL := $(subst ",,$(DATABASE_URL))

# migrate-* and test-db use DATABASE_URL from .env (Supabase owner) when set, else local Docker
LOCAL_DB := postgres://buru:buru@localhost:5432/buru?sslmode=disable
MIGRATE_DB := $(if $(DATABASE_URL),$(if $(findstring ?,$(DATABASE_URL)),$(DATABASE_URL),$(DATABASE_URL)?sslmode=require),$(LOCAL_DB))
# sqlc from PATH, else where `go install` puts it
SQLC := $(or $(shell command -v sqlc),$(shell go env GOPATH)/bin/sqlc)
# golangci-lint v2 under either name, else where `go install` puts it
GOLANGCI := $(or $(shell command -v golangci-lint-v2),$(shell command -v golangci-lint),$(shell go env GOPATH)/bin/golangci-lint)

.PHONY: up down migrate-up migrate-down sqlc run web test test-db lint

up: ## start PostgreSQL, Redis, Temporal
	docker compose up -d --wait postgres redis temporal

down:
	docker compose down

migrate-up:
	@migrate -path db/migrations -database '$(MIGRATE_DB)' up # @: never echo the URL (it holds the password)

migrate-down:
	@migrate -path db/migrations -database '$(MIGRATE_DB)' down 1

sqlc: ## regenerate internal/db from db/migrations + db/queries
	$(SQLC) generate
	$(SQLC) vet

run:
	go run ./cmd/buru

web: ## dashboard on :3000, proxies /api to :8080
	cd web && pnpm dev

test:
	go test -race ./...

test-db: ## DB integration tests on MIGRATE_DB; writes run in rolled-back transactions
	@BURU_TEST_POSTGRES_URL='$(MIGRATE_DB)' go test -count=1 ./internal/db/

lint:
	go vet ./...
	$(GOLANGCI) run ./...
