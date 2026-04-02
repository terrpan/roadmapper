package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	db "github.com/danielterry/roadmapper/api/internal/db/generated"
	"github.com/danielterry/roadmapper/api/internal/middleware"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ConnectionHandler handles CRUD operations for connections.
type ConnectionHandler struct {
	pool *pgxpool.Pool
}

func NewConnectionHandler(pool *pgxpool.Pool) *ConnectionHandler {
	return &ConnectionHandler{pool: pool}
}

type connectionResponse struct {
	ID       string  `json:"id"`
	SourceID string  `json:"sourceId"`
	TargetID string  `json:"targetId"`
	Label    *string `json:"label,omitempty"`
	Type     string  `json:"type"`
}

func toConnectionResponse(c db.Connection) connectionResponse {
	resp := connectionResponse{
		ID:       c.ID,
		SourceID: c.SourceID,
		TargetID: c.TargetID,
		Type:     string(c.Type),
	}
	if c.Label.Valid {
		resp.Label = &c.Label.String
	}
	return resp
}

// validationError is returned when a business-rule check fails inside a transaction.
type validationError struct {
	message string
}

func (e *validationError) Error() string { return e.message }

// validateBlockingDepth ensures source and target items share the same depth.
func validateBlockingDepth(ctx context.Context, q *db.Queries, sourceID, targetID string) error {
	sourceDepth, err := q.GetItemDepth(ctx, sourceID)
	if err != nil {
		return fmt.Errorf("failed to get source item depth: %w", err)
	}
	targetDepth, err := q.GetItemDepth(ctx, targetID)
	if err != nil {
		return fmt.Errorf("failed to get target item depth: %w", err)
	}
	if sourceDepth != targetDepth {
		return &validationError{
			message: fmt.Sprintf("blocking connections require items at the same depth (source=%d, target=%d)", sourceDepth, targetDepth),
		}
	}
	return nil
}

// List handles GET /api/connections
func (h *ConnectionHandler) List(w http.ResponseWriter, r *http.Request) {
	var connections []db.Connection
	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		var err error
		connections, err = db.New(tx).ListConnections(r.Context())
		return err
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list connections")
		return
	}

	resp := make([]connectionResponse, len(connections))
	for i, c := range connections {
		resp[i] = toConnectionResponse(c)
	}
	writeJSON(w, http.StatusOK, resp)
}

// Get handles GET /api/connections/{id}
func (h *ConnectionHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "missing connection id")
		return
	}

	var conn db.Connection
	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		var err error
		conn, err = db.New(tx).GetConnection(r.Context(), id)
		return err
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "connection not found")
		return
	}

	writeJSON(w, http.StatusOK, toConnectionResponse(conn))
}

type createConnectionRequest struct {
	ID       string  `json:"id"`
	SourceID string  `json:"sourceId"`
	TargetID string  `json:"targetId"`
	Label    *string `json:"label"`
	Type     string  `json:"type"`
}

// Create handles POST /api/connections
func (h *ConnectionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createConnectionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ID == "" || req.SourceID == "" || req.TargetID == "" || req.Type == "" {
		writeError(w, http.StatusBadRequest, "id, sourceId, targetId, and type are required")
		return
	}

	tenantID := middleware.TenantFromContext(r.Context())
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "missing tenant id")
		return
	}

	connType := db.ConnectionType(req.Type)

	var conn db.Connection
	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		if connType == db.ConnectionTypeBlocking {
			if err := validateBlockingDepth(r.Context(), q, req.SourceID, req.TargetID); err != nil {
				return err
			}
		}

		label := pgtype.Text{}
		if req.Label != nil {
			label = pgtype.Text{String: *req.Label, Valid: true}
		}

		var err error
		conn, err = q.CreateConnection(r.Context(), db.CreateConnectionParams{
			ID:       req.ID,
			TenantID: tenantID,
			SourceID: req.SourceID,
			TargetID: req.TargetID,
			Label:    label,
			Type:     connType,
		})
		return err
	})
	if err != nil {
		var ve *validationError
		if errors.As(err, &ve) {
			writeError(w, http.StatusBadRequest, ve.message)
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create connection")
		return
	}

	writeJSON(w, http.StatusCreated, toConnectionResponse(conn))
}

type updateConnectionRequest struct {
	Type string `json:"type"`
}

// Update handles PUT /api/connections/{id}
func (h *ConnectionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "missing connection id")
		return
	}

	var req updateConnectionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Type == "" {
		writeError(w, http.StatusBadRequest, "type is required")
		return
	}

	connType := db.ConnectionType(req.Type)

	var conn db.Connection
	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		if connType == db.ConnectionTypeBlocking {
			existing, err := q.GetConnection(r.Context(), id)
			if err != nil {
				return fmt.Errorf("connection not found: %w", err)
			}
			if err := validateBlockingDepth(r.Context(), q, existing.SourceID, existing.TargetID); err != nil {
				return err
			}
		}

		var err error
		conn, err = q.UpdateConnectionType(r.Context(), db.UpdateConnectionTypeParams{
			ID:   id,
			Type: connType,
		})
		return err
	})
	if err != nil {
		var ve *validationError
		if errors.As(err, &ve) {
			writeError(w, http.StatusBadRequest, ve.message)
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update connection")
		return
	}

	writeJSON(w, http.StatusOK, toConnectionResponse(conn))
}

// Delete handles DELETE /api/connections/{id}
func (h *ConnectionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "missing connection id")
		return
	}

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		return db.New(tx).DeleteConnection(r.Context(), id)
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete connection")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
