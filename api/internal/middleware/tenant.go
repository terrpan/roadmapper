package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/clerk/clerk-sdk-go/v2"
	clerkhttp "github.com/clerk/clerk-sdk-go/v2/http"
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

// ClerkAuthMiddleware verifies the Clerk JWT from the Authorization header,
// extracts the active organization ID as the tenant, auto-creates the tenant
// record if needed, and stores the tenant ID in the request context.
func ClerkAuthMiddleware(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		clerkMiddleware := clerkhttp.WithHeaderAuthorization()
		return clerkMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := clerk.SessionClaimsFromContext(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			orgID := claims.ActiveOrganizationID
			if orgID == "" {
				defaultTenantID := os.Getenv("DEFAULT_TENANT_ID")
				if defaultTenantID != "" {
					orgID = defaultTenantID
				} else {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusForbidden)
					w.Write([]byte(`{"error":"No active organization. Please select an organization."}`))
					return
				}
			}

			if err := ensureTenant(r.Context(), pool, orgID); err != nil {
				log.Printf("Failed to ensure tenant %s: %v", orgID, err)
			}

			ctx := context.WithValue(r.Context(), tenantIDKey, orgID)
			next.ServeHTTP(w, r.WithContext(ctx))
		}))
	}
}

// ensureTenant idempotently creates a tenant record if one does not exist.
func ensureTenant(ctx context.Context, pool *pgxpool.Pool, tenantID string) error {
	_, err := pool.Exec(ctx,
		`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
		tenantID, tenantID, tenantID,
	)
	return err
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
