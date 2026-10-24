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

.PHONY: up down migrate-up migrate-down seed keys tglogin tgchat sim sqlc run web test test-db test-e2e lint

up: ## start PostgreSQL, Redis, Temporal
	docker compose up -d --wait postgres redis temporal

down:
	docker compose down

migrate-up:
	@migrate -path db/migrations -database '$(MIGRATE_DB)' up # @: never echo the URL (it holds the password)

migrate-down:
	@migrate -path db/migrations -database '$(MIGRATE_DB)' down 1

seed: ## demo operator, playbooks and the four console personas (idempotent)
	docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U buru -d buru < db/seed/001_demo.sql

keys: ## print fresh values for BURU_OPERATOR_TOKEN and BURU_MESSAGE_KEY
	@echo "BURU_OPERATOR_TOKEN=$$(openssl rand -hex 24)"
	@echo "BURU_MESSAGE_KEY=$$(openssl rand -base64 32)"

tglogin: ## log a honeypot number into Telegram: make tglogin PHONE=+60123456789 PERSONA=1
	go run ./cmd/tglogin -phone '$(PHONE)' $(if $(PERSONA),-persona $(PERSONA),)

sim: ## chat with a persona without Telegram (needs `make run`): make sim PERSONA=1 [AS=scammer_name]
	go run ./cmd/simchat -persona $(or $(PERSONA),1) -as '$(if $(filter command line,$(origin AS)),$(AS),scammer)'

tgchat: ## play the scammer from your terminal: make tgchat PHONE=<your test account> TO=<honeypot phone or @username>
	go run ./cmd/tgchat -phone '$(PHONE)' -to '$(TO)'

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

test-e2e: ## full honeypot loop on local PostgreSQL + Temporal; needs `make up migrate-up`
	BURU_TEST_POSTGRES_URL='$(MIGRATE_DB)' BURU_TEST_TEMPORAL=localhost:7233 go test -count=1 -v -run TestE2E ./internal/honeypot/

lint:
	go vet ./...
	$(GOLANGCI) run ./...
