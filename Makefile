-include .env
export

MIGRATE_DB := postgres://buru:buru@localhost:5432/buru?sslmode=disable
# sqlc from PATH, else where `go install` puts it
SQLC := $(or $(shell command -v sqlc),$(shell go env GOPATH)/bin/sqlc)

.PHONY: up down migrate-up migrate-down sqlc run web test test-db lint

up: ## start PostgreSQL, Redis, Temporal
	docker compose up -d --wait postgres redis temporal

down:
	docker compose down

migrate-up:
	migrate -path db/migrations -database '$(MIGRATE_DB)' up

migrate-down:
	migrate -path db/migrations -database '$(MIGRATE_DB)' down 1

sqlc: ## regenerate internal/db from db/migrations + db/queries
	$(SQLC) generate
	$(SQLC) vet

run:
	go run ./cmd/buru

web: ## dashboard on :3000, proxies /api to :8080
	cd web && pnpm dev

test:
	go test -race ./...

test-db: ## DB integration tests; needs `make up migrate-up`
	BURU_TEST_POSTGRES_URL='$(MIGRATE_DB)' go test -count=1 ./internal/db/

lint:
	go vet ./...
	golangci-lint-v2 run ./...
