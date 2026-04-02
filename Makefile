.PHONY: dev dev-static db-up db-down migrate-up migrate-down migrate-create sqlc api-build api-run test test-e2e test-e2e-ui

# Full-stack development (DB + API + Frontend)
dev: db-up api-run-bg
	npm run dev

# Static-only development (localStorage mode, no backend)
dev-static:
	npm run dev

# Database
db-up:
	docker compose up -d
	@echo "Waiting for database to be healthy..."
	@until docker compose exec db pg_isready -q; do sleep 1; done
	@echo "Database is ready"

db-down:
	docker compose down

# Migrations
migrate-up:
	cd api && go run github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
		-path migrations -database "$$DATABASE_URL" up

migrate-down:
	cd api && go run github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
		-path migrations -database "$$DATABASE_URL" down 1

migrate-create:
	@if [ -z "$(NAME)" ]; then echo "Usage: make migrate-create NAME=description"; exit 1; fi
	cd api && go run github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
		create -ext sql -dir migrations -seq $(NAME)

# sqlc
sqlc:
	cd api && sqlc generate

# Go API
api-build:
	cd api && go build -o bin/server ./cmd/server

api-run:
	cd api && go run ./cmd/server

api-run-bg:
	cd api && go run ./cmd/server &

# Tests
test:
	cd api && go test ./...

# E2E Tests
test-e2e:
	npx playwright test

test-e2e-ui:
	npx playwright test --ui

# Clean
clean:
	docker compose down -v
	rm -rf api/bin
