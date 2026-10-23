-include .env
export

MIGRATE_DB := postgres://buru:buru@localhost:5432/buru?sslmode=disable
# sqlc from PATH, else where `go install` puts it
SQLC := $(or $(shell command -v sqlc),$(shell go env GOPATH)/bin/sqlc)

.PHONY: up down migrate-up migrate-down seed keys tglogin sqlc run web test test-db test-e2e lint

up: ## start PostgreSQL, Redis, Temporal
	docker compose up -d --wait postgres redis temporal

down:
	docker compose down

migrate-up:
	migrate -path db/migrations -database '$(MIGRATE_DB)' up

migrate-down:
	migrate -path db/migrations -database '$(MIGRATE_DB)' down 1

seed: ## demo operator, playbooks and the four console personas (idempotent)
	docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U buru -d buru < db/seed/001_demo.sql

keys: ## print fresh values for BURU_OPERATOR_TOKEN and BURU_MESSAGE_KEY
	@echo "BURU_OPERATOR_TOKEN=$$(openssl rand -hex 24)"
	@echo "BURU_MESSAGE_KEY=$$(openssl rand -base64 32)"

tglogin: ## log a honeypot number into Telegram: make tglogin PHONE=+60123456789 PERSONA=1
	go run ./cmd/tglogin -phone '$(PHONE)' $(if $(PERSONA),-persona $(PERSONA),)

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

test-e2e: ## full honeypot loop on local PostgreSQL + Temporal; needs `make up migrate-up`
	BURU_TEST_POSTGRES_URL='$(MIGRATE_DB)' BURU_TEST_TEMPORAL=localhost:7233 go test -count=1 -v -run TestE2E ./internal/honeypot/

lint:
	go vet ./...
	golangci-lint-v2 run ./...
