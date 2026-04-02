package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	db "github.com/danielterry/roadmapper/api/internal/db/generated"
	"github.com/danielterry/roadmapper/api/internal/middleware"
)

// ItemHandler handles HTTP requests for items.
type ItemHandler struct {
	pool *pgxpool.Pool
}

// NewItemHandler creates a new ItemHandler.
func NewItemHandler(pool *pgxpool.Pool) *ItemHandler {
	return &ItemHandler{pool: pool}
}

// --- DTOs ---

type itemResponse struct {
	ID          string              `json:"id"`
	Title       string              `json:"title"`
	Description string              `json:"description"`
	Status      string              `json:"status"`
	Size        *string             `json:"size,omitempty"`
	DateRange   *dateRange          `json:"dateRange,omitempty"`
	ParentID    *string             `json:"parentId,omitempty"`
	Position    position            `json:"position"`
	Milestones  []milestoneResponse `json:"milestones"`
}

type dateRange struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

type position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type milestoneResponse struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
}

type createItemRequest struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	Size        *string    `json:"size,omitempty"`
	DateRange   *dateRange `json:"dateRange,omitempty"`
	ParentID    *string    `json:"parentId,omitempty"`
	Position    position   `json:"position"`
}

type updateItemRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	Size        *string    `json:"size,omitempty"`
	DateRange   *dateRange `json:"dateRange,omitempty"`
	ParentID    *string    `json:"parentId,omitempty"`
	Position    position   `json:"position"`
}

type updatePositionRequest struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

type batchPositionEntry struct {
	ID       string   `json:"id"`
	Position position `json:"position"`
}

// --- Converters ---

func parseTenantUUID(tenantID string) (pgtype.UUID, error) {
	var uuid pgtype.UUID
	err := uuid.Scan(tenantID)
	return uuid, err
}

func textFromPtr(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func dateFromString(s string) (pgtype.Date, error) {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return pgtype.Date{}, err
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

func sizeFromPtr(s *string) db.NullInitiativeSize {
	if s == nil {
		return db.NullInitiativeSize{}
	}
	return db.NullInitiativeSize{InitiativeSize: db.InitiativeSize(*s), Valid: true}
}

func parseDateRange(dr *dateRange) (pgtype.Date, pgtype.Date, error) {
	var start, end pgtype.Date
	if dr == nil {
		return start, end, nil
	}
	var err error
	start, err = dateFromString(dr.Start)
	if err != nil {
		return start, end, err
	}
	end, err = dateFromString(dr.End)
	if err != nil {
		return start, end, err
	}
	return start, end, nil
}

func itemToResponse(item db.Item, milestones []db.Milestone) itemResponse {
	resp := itemResponse{
		ID:          item.ID,
		Title:       item.Title,
		Description: item.Description,
		Status:      string(item.Status),
		Position:    position{X: item.PositionX, Y: item.PositionY},
		Milestones:  make([]milestoneResponse, 0, len(milestones)),
	}
	if item.Size.Valid {
		s := string(item.Size.InitiativeSize)
		resp.Size = &s
	}
	if item.DateStart.Valid && item.DateEnd.Valid {
		resp.DateRange = &dateRange{
			Start: item.DateStart.Time.Format("2006-01-02"),
			End:   item.DateEnd.Time.Format("2006-01-02"),
		}
	}
	if item.ParentID.Valid {
		resp.ParentID = &item.ParentID.String
	}
	for _, m := range milestones {
		resp.Milestones = append(resp.Milestones, milestoneResponse{
			ID: m.ID, Title: m.Title, Completed: m.Completed,
		})
	}
	return resp
}

// --- Handlers ---

// List handles GET /api/items
func (h *ItemHandler) List(w http.ResponseWriter, r *http.Request) {
	var results []itemResponse

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		items, err := q.ListItems(r.Context())
		if err != nil {
			return err
		}

		results = make([]itemResponse, 0, len(items))
		for _, item := range items {
			milestones, err := q.ListMilestonesByItem(r.Context(), item.ID)
			if err != nil {
				return err
			}
			results = append(results, itemToResponse(item, milestones))
		}
		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list items")
		return
	}

	writeJSON(w, http.StatusOK, results)
}

// Get handles GET /api/items/{id}
func (h *ItemHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var resp itemResponse

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		item, err := q.GetItem(r.Context(), id)
		if err != nil {
			return err
		}

		milestones, err := q.ListMilestonesByItem(r.Context(), item.ID)
		if err != nil {
			return err
		}

		resp = itemToResponse(item, milestones)
		return nil
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "item not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get item")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Create handles POST /api/items
func (h *ItemHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createItemRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tenantID, err := parseTenantUUID(middleware.TenantFromContext(r.Context()))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid tenant ID")
		return
	}

	dateStart, dateEnd, err := parseDateRange(req.DateRange)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid date range")
		return
	}

	var resp itemResponse

	err = middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		item, err := q.CreateItem(r.Context(), db.CreateItemParams{
			ID:          req.ID,
			TenantID:    tenantID,
			Title:       req.Title,
			Description: req.Description,
			Status:      db.ItemStatus(req.Status),
			Size:        sizeFromPtr(req.Size),
			DateStart:   dateStart,
			DateEnd:     dateEnd,
			ParentID:    textFromPtr(req.ParentID),
			PositionX:   req.Position.X,
			PositionY:   req.Position.Y,
		})
		if err != nil {
			return err
		}

		resp = itemToResponse(item, nil)
		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create item")
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// Update handles PUT /api/items/{id}
func (h *ItemHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req updateItemRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	dateStart, dateEnd, err := parseDateRange(req.DateRange)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid date range")
		return
	}

	var resp itemResponse

	err = middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		item, err := q.UpdateItem(r.Context(), db.UpdateItemParams{
			ID:          id,
			Title:       req.Title,
			Description: req.Description,
			Status:      db.ItemStatus(req.Status),
			Size:        sizeFromPtr(req.Size),
			DateStart:   dateStart,
			DateEnd:     dateEnd,
			ParentID:    textFromPtr(req.ParentID),
			PositionX:   req.Position.X,
			PositionY:   req.Position.Y,
		})
		if err != nil {
			return err
		}

		milestones, err := q.ListMilestonesByItem(r.Context(), item.ID)
		if err != nil {
			return err
		}

		resp = itemToResponse(item, milestones)
		return nil
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "item not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update item")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Delete handles DELETE /api/items/{id}
func (h *ItemHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		// Reparent children to the deleted item's parent
		item, err := q.GetItem(r.Context(), id)
		if err != nil {
			return err
		}

		err = q.ReparentChildren(r.Context(), db.ReparentChildrenParams{
			ParentID:   pgtype.Text{String: id, Valid: true},
			ParentID_2: item.ParentID,
		})
		if err != nil {
			return err
		}

		if err := q.DeleteConnectionsByItem(r.Context(), id); err != nil {
			return err
		}
		if err := q.RemoveItemFromAllGroups(r.Context(), id); err != nil {
			return err
		}
		if err := q.DeleteMilestonesByItem(r.Context(), id); err != nil {
			return err
		}
		return q.DeleteItem(r.Context(), id)
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "item not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete item")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdatePosition handles PATCH /api/items/{id}/position
func (h *ItemHandler) UpdatePosition(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req updatePositionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		return q.UpdateItemPosition(r.Context(), db.UpdateItemPositionParams{
			ID:        id,
			PositionX: req.X,
			PositionY: req.Y,
		})
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update position")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateStatus handles PATCH /api/items/{id}/status
func (h *ItemHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req updateStatusRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var results []itemResponse

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		item, err := q.UpdateItemStatus(r.Context(), db.UpdateItemStatusParams{
			ID:     id,
			Status: db.ItemStatus(req.Status),
		})
		if err != nil {
			return err
		}

		milestones, err := q.ListMilestonesByItem(r.Context(), item.ID)
		if err != nil {
			return err
		}
		results = append(results, itemToResponse(item, milestones))

		// Cascade "done" status to downstream items
		if db.ItemStatus(req.Status) == db.ItemStatusDone {
			downstreamIDs, err := q.GetDownstreamIds(r.Context(), id)
			if err != nil {
				return err
			}
			if len(downstreamIDs) > 0 {
				if err := q.BulkUpdateStatus(r.Context(), db.BulkUpdateStatusParams{
					Column1: downstreamIDs,
					Status:  db.ItemStatusDone,
				}); err != nil {
					return err
				}

				// Collect updated downstream items for response
				for _, dsID := range downstreamIDs {
					dsItem, err := q.GetItem(r.Context(), dsID)
					if err != nil {
						return err
					}
					dsMs, err := q.ListMilestonesByItem(r.Context(), dsID)
					if err != nil {
						return err
					}
					results = append(results, itemToResponse(dsItem, dsMs))
				}
			}
		}

		return nil
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "item not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	writeJSON(w, http.StatusOK, results)
}

// BatchUpdatePositions handles POST /api/items/batch-positions
func (h *ItemHandler) BatchUpdatePositions(w http.ResponseWriter, r *http.Request) {
	var entries []batchPositionEntry
	if err := decodeJSON(r, &entries); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		for _, e := range entries {
			if err := q.UpdateItemPosition(r.Context(), db.UpdateItemPositionParams{
				ID:        e.ID,
				PositionX: e.Position.X,
				PositionY: e.Position.Y,
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to batch update positions")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
