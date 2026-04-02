-- name: ListConnections :many
SELECT * FROM connections ORDER BY created_at;

-- name: GetConnection :one
SELECT * FROM connections WHERE id = $1;

-- name: CreateConnection :one
INSERT INTO connections (id, tenant_id, source_id, target_id, label, type)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateConnectionType :one
UPDATE connections SET type = $2 WHERE id = $1 RETURNING *;

-- name: DeleteConnection :exec
DELETE FROM connections WHERE id = $1;

-- name: GetConnectionsBySource :many
SELECT * FROM connections WHERE source_id = $1;

-- name: DeleteConnectionsByItem :exec
DELETE FROM connections WHERE source_id = $1 OR target_id = $1;

-- name: GetDownstreamIds :many
WITH RECURSIVE downstream AS (
    SELECT connections.target_id AS id FROM connections WHERE connections.source_id = $1
    UNION ALL
    SELECT c.target_id FROM connections c JOIN downstream d ON c.source_id = d.id
)
SELECT downstream.id FROM downstream;
