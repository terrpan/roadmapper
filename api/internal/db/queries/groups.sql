-- name: ListGroups :many
SELECT * FROM groups ORDER BY created_at;

-- name: GetGroup :one
SELECT * FROM groups WHERE id = $1;

-- name: CreateGroup :one
INSERT INTO groups (id, tenant_id, label, color_index)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateGroup :one
UPDATE groups SET label = $2, color_index = $3, updated_at = now() WHERE id = $1 RETURNING *;

-- name: DeleteGroup :exec
DELETE FROM groups WHERE id = $1;

-- name: GetGroupItems :many
SELECT item_id FROM group_items WHERE group_id = $1;

-- name: AddItemToGroup :exec
INSERT INTO group_items (group_id, item_id, tenant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;

-- name: RemoveItemFromGroup :exec
DELETE FROM group_items WHERE group_id = $1 AND item_id = $2;

-- name: RemoveItemFromAllGroups :exec
DELETE FROM group_items WHERE item_id = $1;

-- name: DeleteEmptyGroups :exec
DELETE FROM groups WHERE id NOT IN (SELECT DISTINCT group_id FROM group_items);
