package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	db "github.com/danielterry/roadmapper/api/internal/db/generated"
	"github.com/danielterry/roadmapper/api/internal/middleware"
)

// MilestoneHandler handles HTTP requests for milestones.
type MilestoneHandler struct {
	pool *pgxpool.Pool
}

// NewMilestoneHandler creates a new MilestoneHandler.
func NewMilestoneHandler(pool *pgxpool.Pool) *MilestoneHandler {
	return &MilestoneHandler{pool: pool}
}

type milestoneDetailResponse struct {
	ID        string `json:"id"`
	ItemID    string `json:"itemId"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
}

func toMilestoneDetail(m db.Milestone) milestoneDetailResponse {
	return milestoneDetailResponse{
		ID:        m.ID,
		ItemID:    m.ItemID,
		Title:     m.Title,
		Completed: m.Completed,
	}
}

type createMilestoneRequest struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// List handles GET /api/items/{itemId}/milestones
func (h *MilestoneHandler) List(w http.ResponseWriter, r *http.Request) {
	itemID := r.PathValue("itemId")

	var result []milestoneDetailResponse

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		milestones, err := q.ListMilestonesByItem(r.Context(), itemID)
		if err != nil {
			return err
		}

		result = make([]milestoneDetailResponse, len(milestones))
		for i, m := range milestones {
			result[i] = toMilestoneDetail(m)
		}
		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list milestones")
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// Create handles POST /api/items/{itemId}/milestones
func (h *MilestoneHandler) Create(w http.ResponseWriter, r *http.Request) {
	itemID := r.PathValue("itemId")

	var req createMilestoneRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tenantID := middleware.TenantFromContext(r.Context())
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "missing tenant ID")
		return
	}

	var resp milestoneDetailResponse

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		maxOrder, err := q.GetMaxSortOrder(r.Context(), itemID)
		if err != nil {
			return err
		}

		m, err := q.CreateMilestone(r.Context(), db.CreateMilestoneParams{
			ID:        req.ID,
			TenantID:  tenantID,
			ItemID:    itemID,
			Title:     req.Title,
			Completed: false,
			SortOrder: maxOrder + 1,
		})
		if err != nil {
			return err
		}

		resp = toMilestoneDetail(m)
		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create milestone")
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// Toggle handles PUT /api/milestones/{id}
func (h *MilestoneHandler) Toggle(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var resp milestoneDetailResponse

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		m, err := q.ToggleMilestone(r.Context(), id)
		if err != nil {
			return err
		}

		resp = toMilestoneDetail(m)
		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to toggle milestone")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Delete handles DELETE /api/milestones/{id}
func (h *MilestoneHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		return db.New(tx).DeleteMilestone(r.Context(), id)
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete milestone")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
