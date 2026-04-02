package middleware

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type contextKey string

const tenantIDKey contextKey = "tenant_id"

// TenantFromContext extracts the tenant ID from the request context.
func TenantFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(tenantIDKey).(string); ok {
		return v
	}
	return ""
}

// TenantMiddleware extracts the tenant ID from the X-Tenant-ID header
// (or falls back to DEFAULT_TENANT_ID env var) and stores it in the request context.
func TenantMiddleware(next http.Handler) http.Handler {
	defaultTenantID := os.Getenv("DEFAULT_TENANT_ID")
	if defaultTenantID == "" {
		defaultTenantID = "00000000-0000-0000-0000-000000000001"
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = defaultTenantID
		}

		ctx := context.WithValue(r.Context(), tenantIDKey, tenantID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// WithTenant wraps a pgx transaction callback to SET LOCAL the tenant ID for RLS.
// Usage:
//
//	err := WithTenant(ctx, pool, func(tx pgx.Tx) error {
//	    // All queries in this tx are scoped to the tenant via RLS
//	    return nil
//	})
func WithTenant(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	tenantID := TenantFromContext(ctx)
	if tenantID == "" {
		return fmt.Errorf("no tenant ID in context")
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Set the RLS session variable for this transaction
	if _, err := tx.Exec(ctx, fmt.Sprintf("SET LOCAL app.current_tenant_id = '%s'", tenantID)); err != nil {
		return fmt.Errorf("set tenant context: %w", err)
	}

	if err := fn(tx); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
