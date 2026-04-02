package server

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/danielterry/roadmapper/api/internal/handler"
	"github.com/danielterry/roadmapper/api/internal/middleware"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Config struct {
	Port           string
	DatabaseURL    string
	MigrationsPath string
}

type Server struct {
	cfg  Config
	pool *pgxpool.Pool
	http *http.Server
}

func New(cfg Config) (*Server, error) {
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}
	log.Println("Connected to database")

	if err := runMigrations(cfg.DatabaseURL, cfg.MigrationsPath); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	s := &Server{
		cfg:  cfg,
		pool: pool,
	}

	mux := s.routes()
	s.http = &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: mux,
	}

	return s, nil
}

func (s *Server) Start() error {
	return s.http.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.pool.Close()
	return s.http.Shutdown(ctx)
}

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()

	// Health check (no tenant middleware needed)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	importExport := handler.NewImportExportHandler(s.pool)
	mux.HandleFunc("GET /api/export", importExport.Export)
	mux.HandleFunc("POST /api/import", importExport.Import)

	items := handler.NewItemHandler(s.pool)
	mux.HandleFunc("GET /api/items", items.List)
	mux.HandleFunc("GET /api/items/{id}", items.Get)
	mux.HandleFunc("POST /api/items", items.Create)
	mux.HandleFunc("PUT /api/items/{id}", items.Update)
	mux.HandleFunc("DELETE /api/items/{id}", items.Delete)
	mux.HandleFunc("PATCH /api/items/{id}/position", items.UpdatePosition)
	mux.HandleFunc("PATCH /api/items/{id}/status", items.UpdateStatus)
	mux.HandleFunc("POST /api/items/batch-positions", items.BatchUpdatePositions)

	groups := handler.NewGroupHandler(s.pool)
	mux.HandleFunc("GET /api/groups", groups.List)
	mux.HandleFunc("GET /api/groups/{id}", groups.Get)
	mux.HandleFunc("POST /api/groups", groups.Create)
	mux.HandleFunc("PUT /api/groups/{id}", groups.Update)
	mux.HandleFunc("DELETE /api/groups/{id}", groups.Delete)
	mux.HandleFunc("POST /api/groups/{id}/items", groups.AddItems)
	mux.HandleFunc("DELETE /api/groups/{id}/items/{itemId}", groups.RemoveItem)

	milestones := handler.NewMilestoneHandler(s.pool)
	mux.HandleFunc("GET /api/items/{itemId}/milestones", milestones.List)
	mux.HandleFunc("POST /api/items/{itemId}/milestones", milestones.Create)
	mux.HandleFunc("PUT /api/milestones/{id}", milestones.Toggle)
	mux.HandleFunc("DELETE /api/milestones/{id}", milestones.Delete)

	connections := handler.NewConnectionHandler(s.pool)
	mux.HandleFunc("GET /api/connections", connections.List)
	mux.HandleFunc("GET /api/connections/{id}", connections.Get)
	mux.HandleFunc("POST /api/connections", connections.Create)
	mux.HandleFunc("PUT /api/connections/{id}", connections.Update)
	mux.HandleFunc("DELETE /api/connections/{id}", connections.Delete)

	// Apply middleware: CORS → Tenant → routes
	var handler http.Handler = mux
	handler = middleware.TenantMiddleware(handler)
	handler = middleware.CORS(handler)
	return handler
}

func runMigrations(databaseURL, migrationsPath string) error {
	pgxURL := databaseURL
	if len(pgxURL) > 11 && pgxURL[:11] == "postgres://" {
		pgxURL = "pgx5://" + pgxURL[11:]
	} else if len(pgxURL) > 14 && pgxURL[:14] == "postgresql://" {
		pgxURL = "pgx5://" + pgxURL[14:]
	}

	m, err := migrate.New(migrationsPath, pgxURL)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	log.Println("Migrations completed successfully")
	return nil
}
