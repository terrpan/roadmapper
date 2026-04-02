package handler

import (
	"errors"
	"net/http"

	db "github.com/danielterry/roadmapper/api/internal/db/generated"
	"github.com/danielterry/roadmapper/api/internal/middleware"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type groupResponse struct {
	ID         string   `json:"id"`
	Label      string   `json:"label"`
	ColorIndex int      `json:"colorIndex"`
	ItemIds    []string `json:"itemIds"`
}

func toGroupResponse(g db.Group, itemIDs []string) groupResponse {
	if itemIDs == nil {
		itemIDs = []string{}
	}
	return groupResponse{
		ID:         g.ID,
		Label:      g.Label,
		ColorIndex: int(g.ColorIndex),
		ItemIds:    itemIDs,
	}
}

type GroupHandler struct {
	pool *pgxpool.Pool
}

func NewGroupHandler(pool *pgxpool.Pool) *GroupHandler {
	return &GroupHandler{pool: pool}
}

func (h *GroupHandler) List(w http.ResponseWriter, r *http.Request) {
	var resp []groupResponse

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		groups, err := q.ListGroups(r.Context())
		if err != nil {
			return err
		}
		resp = make([]groupResponse, 0, len(groups))
		for _, g := range groups {
			items, err := q.GetGroupItems(r.Context(), g.ID)
			if err != nil {
				return err
			}
			resp = append(resp, toGroupResponse(g, items))
		}
		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *GroupHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var resp groupResponse
	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		g, err := q.GetGroup(r.Context(), id)
		if err != nil {
			return err
		}
		items, err := q.GetGroupItems(r.Context(), g.ID)
		if err != nil {
			return err
		}
		resp = toGroupResponse(g, items)
		return nil
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "group not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *GroupHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID         string   `json:"id"`
		Label      string   `json:"label"`
		ColorIndex int32    `json:"colorIndex"`
		ItemIds    []string `json:"itemIds"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	tenantID := middleware.TenantFromContext(r.Context())
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "missing tenant ID")
		return
	}

	var resp groupResponse
	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		g, err := q.CreateGroup(r.Context(), db.CreateGroupParams{
			ID:         req.ID,
			TenantID:   tenantID,
			Label:      req.Label,
			ColorIndex: req.ColorIndex,
		})
		if err != nil {
			return err
		}

		for _, itemID := range req.ItemIds {
			if err := q.AddItemToGroup(r.Context(), db.AddItemToGroupParams{
				GroupID:  g.ID,
				ItemID:   itemID,
				TenantID: tenantID,
			}); err != nil {
				return err
			}
		}

		items, err := q.GetGroupItems(r.Context(), g.ID)
		if err != nil {
			return err
		}
		resp = toGroupResponse(g, items)
		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *GroupHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req struct {
		Label      string `json:"label"`
		ColorIndex int32  `json:"colorIndex"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var resp groupResponse
	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		g, err := q.UpdateGroup(r.Context(), db.UpdateGroupParams{
			ID:         id,
			Label:      req.Label,
			ColorIndex: req.ColorIndex,
		})
		if err != nil {
			return err
		}
		items, err := q.GetGroupItems(r.Context(), g.ID)
		if err != nil {
			return err
		}
		resp = toGroupResponse(g, items)
		return nil
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "group not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *GroupHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		return q.DeleteGroup(r.Context(), id)
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *GroupHandler) AddItems(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req struct {
		ItemIds []string `json:"itemIds"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	tenantID := middleware.TenantFromContext(r.Context())
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "missing tenant ID")
		return
	}

	var resp groupResponse
	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		g, err := q.GetGroup(r.Context(), id)
		if err != nil {
			return err
		}

		for _, itemID := range req.ItemIds {
			if err := q.AddItemToGroup(r.Context(), db.AddItemToGroupParams{
				GroupID:  g.ID,
				ItemID:   itemID,
				TenantID: tenantID,
			}); err != nil {
				return err
			}
		}

		items, err := q.GetGroupItems(r.Context(), g.ID)
		if err != nil {
			return err
		}
		resp = toGroupResponse(g, items)
		return nil
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "group not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *GroupHandler) RemoveItem(w http.ResponseWriter, r *http.Request) {
	groupID := r.PathValue("id")
	itemID := r.PathValue("itemId")

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		if err := q.RemoveItemFromGroup(r.Context(), db.RemoveItemFromGroupParams{
			GroupID: groupID,
			ItemID:  itemID,
		}); err != nil {
			return err
		}

		// Delete the group if it has no remaining items
		remaining, err := q.GetGroupItems(r.Context(), groupID)
		if err != nil {
			return err
		}
		if len(remaining) == 0 {
			return q.DeleteGroup(r.Context(), groupID)
		}
		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
