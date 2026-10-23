-include .env
export

MIGRATE_DB := postgres://buru:buru@localhost:5432/buru?sslmode=disable

.PHONY: up down migrate-up migrate-down run web test lint

up: ## start PostgreSQL, Redis, Temporal
	docker compose up -d --wait postgres redis temporal

down:
	docker compose down

migrate-up:
	migrate -path db/migrations -database '$(MIGRATE_DB)' up

migrate-down:
	migrate -path db/migrations -database '$(MIGRATE_DB)' down 1

run:
	go run ./cmd/buru

web: ## dashboard on :3000, proxies /api to :8080
	cd web && pnpm dev

test:
	go test -race ./...

lint:
	go vet ./...
	golangci-lint-v2 run ./...
