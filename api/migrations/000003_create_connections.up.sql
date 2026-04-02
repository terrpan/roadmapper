CREATE TYPE connection_type AS ENUM ('direct', 'indirect', 'blocking');

CREATE TABLE connections (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    label TEXT,
    type connection_type NOT NULL DEFAULT 'direct',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_connections_tenant ON connections(tenant_id);
CREATE INDEX idx_connections_source ON connections(source_id);
CREATE INDEX idx_connections_target ON connections(target_id);
