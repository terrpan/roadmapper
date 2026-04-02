-- name: ListItems :many
SELECT * FROM items ORDER BY created_at;

-- name: GetItem :one
SELECT * FROM items WHERE id = $1;

-- name: CreateItem :one
INSERT INTO items (id, tenant_id, title, description, status, size, date_start, date_end, parent_id, position_x, position_y)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: UpdateItem :one
UPDATE items
SET title = $2, description = $3, status = $4, size = $5, date_start = $6, date_end = $7, parent_id = $8, position_x = $9, position_y = $10, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteItem :exec
DELETE FROM items WHERE id = $1;

-- name: UpdateItemPosition :exec
UPDATE items SET position_x = $2, position_y = $3, updated_at = now() WHERE id = $1;

-- name: UpdateItemStatus :one
UPDATE items SET status = $2, updated_at = now() WHERE id = $1 RETURNING *;

-- name: ReparentChildren :exec
UPDATE items SET parent_id = $2 WHERE parent_id = $1;

-- name: GetItemsByParent :many
SELECT * FROM items WHERE parent_id = $1;

-- name: GetItemDepth :one
WITH RECURSIVE ancestors AS (
    SELECT items.id, items.parent_id, 0 AS depth FROM items WHERE items.id = $1
    UNION ALL
    SELECT i.id, i.parent_id, a.depth + 1
    FROM items i JOIN ancestors a ON i.id = a.parent_id
)
SELECT COALESCE(MAX(depth), 0)::int AS depth FROM ancestors;

-- name: GetDescendantIds :many
WITH RECURSIVE descendants AS (
    SELECT items.id FROM items WHERE items.parent_id = $1
    UNION ALL
    SELECT i.id FROM items i JOIN descendants d ON i.parent_id = d.id
)
SELECT descendants.id FROM descendants;

-- name: BulkUpdateStatus :exec
UPDATE items SET status = $2, updated_at = now() WHERE id = ANY($1::text[]);
