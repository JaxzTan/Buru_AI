-include .env
export

MIGRATE_DB := mysql://buru:buru@tcp(localhost:3307)/buru?multiStatements=true

.PHONY: up down migrate-up migrate-down run test lint

up: ## start MySQL, Redis, Temporal
	docker compose up -d --wait mysql redis temporal

down:
	docker compose down

migrate-up:
	migrate -path migrations -database '$(MIGRATE_DB)' up

migrate-down:
	migrate -path migrations -database '$(MIGRATE_DB)' down 1

run:
	go run ./cmd/buru

test:
	go test -race ./...

lint:
	go vet ./...
	golangci-lint-v2 run ./...
