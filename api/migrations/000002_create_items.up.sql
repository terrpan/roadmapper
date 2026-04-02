CREATE TYPE item_status AS ENUM ('backlog', 'planned', 'in-progress', 'done');
CREATE TYPE initiative_size AS ENUM ('weeks', 'months', 'quarters', 'years');

CREATE TABLE items (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status item_status NOT NULL DEFAULT 'backlog',
    size initiative_size,
    date_start DATE,
    date_end DATE,
    parent_id TEXT REFERENCES items(id) ON DELETE SET NULL,
    position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_tenant ON items(tenant_id);
CREATE INDEX idx_items_parent ON items(parent_id);
CREATE INDEX idx_items_status ON items(tenant_id, status);
