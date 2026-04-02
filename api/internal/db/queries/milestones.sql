-- name: ListMilestonesByItem :many
SELECT * FROM milestones WHERE item_id = $1 ORDER BY sort_order;

-- name: GetMilestone :one
SELECT * FROM milestones WHERE id = $1;

-- name: CreateMilestone :one
INSERT INTO milestones (id, tenant_id, item_id, title, completed, sort_order)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateMilestone :one
UPDATE milestones SET title = $2, completed = $3, sort_order = $4 WHERE id = $1 RETURNING *;

-- name: ToggleMilestone :one
UPDATE milestones SET completed = NOT completed WHERE id = $1 RETURNING *;

-- name: DeleteMilestone :exec
DELETE FROM milestones WHERE id = $1;

-- name: DeleteMilestonesByItem :exec
DELETE FROM milestones WHERE item_id = $1;

-- name: GetMaxSortOrder :one
SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM milestones WHERE item_id = $1;
