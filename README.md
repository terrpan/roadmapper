# Roadmapper

A visual roadmap planning tool built with React, TypeScript, and Zustand. Supports canvas, Kanban, and Gantt views for managing initiatives with connections, groups, and milestones.

## Deployment Modes

### Static (GitHub Pages)

No backend required. Data persists in `localStorage`.

```bash
npm install
npm run build
# Deploy dist/ to any static host
```

Or for local development:

```bash
npm run dev
```

### Full (Docker Compose)

Uses PostgreSQL with Row Level Security for multi-tenant persistent storage.

```bash
cp .env.example .env    # Edit credentials as needed
make dev                # Starts PostgreSQL + Go API + Vite dev server
```

The frontend auto-detects the API at `/api/health` on startup. You can force the mode with:

```
VITE_STORAGE_MODE=api   # Force API mode
VITE_STORAGE_MODE=local # Force localStorage mode
```

### Mode Auto-Detection

| Condition | Mode | Storage |
|-----------|------|---------|
| `/api/health` responds | API | PostgreSQL via Go server |
| No API available | Local | `localStorage` (demo) |
| `VITE_STORAGE_MODE` set | Forced | As specified |

When switching from local → API mode, a migration banner offers to import your localStorage data into the database.

## Development

```bash
make dev          # Full stack: Docker + Go API + Vite
make dev-static   # Frontend only (localStorage mode)
make migrate-up   # Run database migrations
make migrate-down # Rollback last migration
make sqlc         # Regenerate Go code from SQL queries
make build        # Build Go binary
make test         # Run Go tests
```

### Project Structure

```
├── src/                    # React frontend (Vite + Zustand)
│   ├── lib/
│   │   ├── storageAdapter.ts  # StorageAdapter interface + factory
│   │   ├── storage.ts         # localStorage adapter (@deprecated)
│   │   └── api.ts             # API client adapter
│   └── store/
│       └── roadmapStore.ts    # Zustand store (uses StorageAdapter)
├── api/                    # Go backend
│   ├── cmd/server/         # Entry point
│   ├── internal/
│   │   ├── handler/        # HTTP handlers (items, connections, groups, milestones)
│   │   ├── middleware/      # Tenant RLS + CORS
│   │   ├── server/         # Server setup + routing
│   │   └── db/             # sqlc queries + generated code
│   └── migrations/         # SQL migration files (golang-migrate)
├── docker-compose.yml      # PostgreSQL + Go API
├── Makefile                # Task runner
└── .env.example            # Environment variable template
```

### Multi-Tenancy

The database uses Row Level Security (RLS) with `tenant_id` on every table. The Go API sets `SET LOCAL app.current_tenant_id` per transaction. No auth is implemented yet — the default tenant is used automatically. When auth is added, the middleware just needs to resolve tenant from the auth token.

### Tech Stack

- **Frontend**: React 19, Zustand, React Flow, Vite
- **Backend**: Go (net/http), sqlc, pgx/v5
- **Database**: PostgreSQL 16 with RLS
- **Migrations**: golang-migrate (raw SQL)
