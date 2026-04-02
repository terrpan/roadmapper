package handler

import (
	"context"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	db "github.com/danielterry/roadmapper/api/internal/db/generated"
	"github.com/danielterry/roadmapper/api/internal/middleware"
)

// ImportExportHandler handles bulk import and export of roadmap data.
type ImportExportHandler struct {
	pool *pgxpool.Pool
}

func NewImportExportHandler(pool *pgxpool.Pool) *ImportExportHandler {
	return &ImportExportHandler{pool: pool}
}

// --- DTOs ---

type exportResponse struct {
	Items       []itemResponse       `json:"items"`
	Connections []connectionResponse `json:"connections"`
	Groups      []groupResponse      `json:"groups"`
}

type importRequest struct {
	Data importData `json:"data"`
	Mode string     `json:"mode"` // "replace" or "merge"
}

type importData struct {
	Items       []importItem       `json:"items"`
	Connections []importConnection `json:"connections"`
	Groups      []importGroup      `json:"groups"`
}

type importItem struct {
	ID          string              `json:"id"`
	Title       string              `json:"title"`
	Description string              `json:"description"`
	Status      string              `json:"status"`
	Size        *string             `json:"size,omitempty"`
	DateRange   *dateRange          `json:"dateRange,omitempty"`
	ParentID    *string             `json:"parentId,omitempty"`
	Milestones  []milestoneResponse `json:"milestones"`
	Position    position            `json:"position"`
}

type importConnection struct {
	ID       string  `json:"id"`
	SourceID string  `json:"sourceId"`
	TargetID string  `json:"targetId"`
	Label    *string `json:"label,omitempty"`
	Type     string  `json:"type"`
}

type importGroup struct {
	ID         string   `json:"id"`
	Label      string   `json:"label"`
	ColorIndex int      `json:"colorIndex"`
	ItemIds    []string `json:"itemIds"`
}

// --- Export ---

// Export handles GET /api/export
func (h *ImportExportHandler) Export(w http.ResponseWriter, r *http.Request) {
	var resp exportResponse

	err := middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		items, err := q.ListItems(r.Context())
		if err != nil {
			return fmt.Errorf("list items: %w", err)
		}

		resp.Items = make([]itemResponse, 0, len(items))
		for _, item := range items {
			milestones, err := q.ListMilestonesByItem(r.Context(), item.ID)
			if err != nil {
				return fmt.Errorf("list milestones for item %s: %w", item.ID, err)
			}
			resp.Items = append(resp.Items, itemToResponse(item, milestones))
		}

		connections, err := q.ListConnections(r.Context())
		if err != nil {
			return fmt.Errorf("list connections: %w", err)
		}
		resp.Connections = make([]connectionResponse, 0, len(connections))
		for _, c := range connections {
			resp.Connections = append(resp.Connections, toConnectionResponse(c))
		}

		groups, err := q.ListGroups(r.Context())
		if err != nil {
			return fmt.Errorf("list groups: %w", err)
		}
		resp.Groups = make([]groupResponse, 0, len(groups))
		for _, g := range groups {
			itemIDs, err := q.GetGroupItems(r.Context(), g.ID)
			if err != nil {
				return fmt.Errorf("get group items for %s: %w", g.ID, err)
			}
			resp.Groups = append(resp.Groups, toGroupResponse(g, itemIDs))
		}

		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to export data")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// --- Import ---

// Import handles POST /api/import
func (h *ImportExportHandler) Import(w http.ResponseWriter, r *http.Request) {
	var req importRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Mode != "replace" && req.Mode != "merge" {
		writeError(w, http.StatusBadRequest, "mode must be 'replace' or 'merge'")
		return
	}

	tenantID, err := parseTenantUUID(middleware.TenantFromContext(r.Context()))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid tenant ID")
		return
	}

	err = middleware.WithTenant(r.Context(), h.pool, func(tx pgx.Tx) error {
		q := db.New(tx)

		if req.Mode == "replace" {
			if err := deleteAllData(r.Context(), tx); err != nil {
				return fmt.Errorf("delete existing data: %w", err)
			}
		}

		if err := insertItems(r.Context(), q, tenantID, req.Data.Items, req.Mode); err != nil {
			return fmt.Errorf("import items: %w", err)
		}
		if err := insertConnections(r.Context(), q, tenantID, req.Data.Connections, req.Mode); err != nil {
			return fmt.Errorf("import connections: %w", err)
		}
		if err := insertGroups(r.Context(), q, tenantID, req.Data.Groups, req.Mode); err != nil {
			return fmt.Errorf("import groups: %w", err)
		}

		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to import data")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// deleteAllData removes all tenant-scoped data in FK-safe order.
// RLS ensures only the current tenant's rows are affected.
func deleteAllData(ctx context.Context, tx pgx.Tx) error {
	// group_items references both groups and items
	if _, err := tx.Exec(ctx, "DELETE FROM group_items"); err != nil {
		return err
	}
	// milestones references items
	if _, err := tx.Exec(ctx, "DELETE FROM milestones"); err != nil {
		return err
	}
	// connections references items
	if _, err := tx.Exec(ctx, "DELETE FROM connections"); err != nil {
		return err
	}
	// groups (no remaining FK deps)
	if _, err := tx.Exec(ctx, "DELETE FROM groups"); err != nil {
		return err
	}
	// clear self-referential parent_id before deleting items
	if _, err := tx.Exec(ctx, "UPDATE items SET parent_id = NULL"); err != nil {
		return err
	}
	// items
	if _, err := tx.Exec(ctx, "DELETE FROM items"); err != nil {
		return err
	}
	return nil
}

// sortItemsParentsFirst reorders items so that parents appear before their
// children. Items without a parentId (or whose parent is not in the set)
// come first.
func sortItemsParentsFirst(items []importItem) []importItem {
	idSet := make(map[string]struct{}, len(items))
	for _, it := range items {
		idSet[it.ID] = struct{}{}
	}

	sorted := make([]importItem, 0, len(items))
	placed := make(map[string]struct{}, len(items))

	// Iteratively place items whose parent is already placed (or absent).
	for len(sorted) < len(items) {
		progress := false
		for _, it := range items {
			if _, done := placed[it.ID]; done {
				continue
			}
			parentReady := it.ParentID == nil
			if !parentReady {
				_, parentInSet := idSet[*it.ParentID]
				_, parentPlaced := placed[*it.ParentID]
				parentReady = !parentInSet || parentPlaced
			}
			if parentReady {
				sorted = append(sorted, it)
				placed[it.ID] = struct{}{}
				progress = true
			}
		}
		if !progress {
			// Circular references – append remaining items without parent link
			for _, it := range items {
				if _, done := placed[it.ID]; !done {
					sorted = append(sorted, it)
					placed[it.ID] = struct{}{}
				}
			}
			break
		}
	}
	return sorted
}

func insertItems(ctx context.Context, q *db.Queries, tenantID pgtype.UUID, items []importItem, mode string) error {
	items = sortItemsParentsFirst(items)

	existingSet := make(map[string]struct{})
	if mode == "merge" {
		existing, err := q.ListItems(ctx)
		if err != nil {
			return err
		}
		for _, it := range existing {
			existingSet[it.ID] = struct{}{}
		}
	}

	for _, it := range items {
		if mode == "merge" {
			if _, exists := existingSet[it.ID]; exists {
				continue
			}
		}

		dateStart, dateEnd, err := parseDateRange(it.DateRange)
		if err != nil {
			return fmt.Errorf("item %s: invalid date range: %w", it.ID, err)
		}

		if _, err := q.CreateItem(ctx, db.CreateItemParams{
			ID:          it.ID,
			TenantID:    tenantID,
			Title:       it.Title,
			Description: it.Description,
			Status:      db.ItemStatus(it.Status),
			Size:        sizeFromPtr(it.Size),
			DateStart:   dateStart,
			DateEnd:     dateEnd,
			ParentID:    textFromPtr(it.ParentID),
			PositionX:   it.Position.X,
			PositionY:   it.Position.Y,
		}); err != nil {
			return fmt.Errorf("create item %s: %w", it.ID, err)
		}

		for i, ms := range it.Milestones {
			if _, err := q.CreateMilestone(ctx, db.CreateMilestoneParams{
				ID:        ms.ID,
				TenantID:  tenantID,
				ItemID:    it.ID,
				Title:     ms.Title,
				Completed: ms.Completed,
				SortOrder: int32(i),
			}); err != nil {
				return fmt.Errorf("create milestone %s for item %s: %w", ms.ID, it.ID, err)
			}
		}
	}
	return nil
}

func insertConnections(ctx context.Context, q *db.Queries, tenantID pgtype.UUID, connections []importConnection, mode string) error {
	existingSet := make(map[string]struct{})
	if mode == "merge" {
		existing, err := q.ListConnections(ctx)
		if err != nil {
			return err
		}
		for _, c := range existing {
			existingSet[c.ID] = struct{}{}
		}
	}

	for _, c := range connections {
		if mode == "merge" {
			if _, exists := existingSet[c.ID]; exists {
				continue
			}
		}

		if _, err := q.CreateConnection(ctx, db.CreateConnectionParams{
			ID:       c.ID,
			TenantID: tenantID,
			SourceID: c.SourceID,
			TargetID: c.TargetID,
			Label:    textFromPtr(c.Label),
			Type:     db.ConnectionType(c.Type),
		}); err != nil {
			return fmt.Errorf("create connection %s: %w", c.ID, err)
		}
	}
	return nil
}

func insertGroups(ctx context.Context, q *db.Queries, tenantID pgtype.UUID, groups []importGroup, mode string) error {
	existingSet := make(map[string]struct{})
	if mode == "merge" {
		existing, err := q.ListGroups(ctx)
		if err != nil {
			return err
		}
		for _, g := range existing {
			existingSet[g.ID] = struct{}{}
		}
	}

	for _, g := range groups {
		if mode == "merge" {
			if _, exists := existingSet[g.ID]; exists {
				continue
			}
		}

		if _, err := q.CreateGroup(ctx, db.CreateGroupParams{
			ID:         g.ID,
			TenantID:   tenantID,
			Label:      g.Label,
			ColorIndex: int32(g.ColorIndex),
		}); err != nil {
			return fmt.Errorf("create group %s: %w", g.ID, err)
		}

		for _, itemID := range g.ItemIds {
			if err := q.AddItemToGroup(ctx, db.AddItemToGroupParams{
				GroupID:  g.ID,
				ItemID:   itemID,
				TenantID: tenantID,
			}); err != nil {
				return fmt.Errorf("add item %s to group %s: %w", itemID, g.ID, err)
			}
		}
	}
	return nil
}
