CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    color_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_items (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, item_id)
);

CREATE INDEX idx_groups_tenant ON groups(tenant_id);
CREATE INDEX idx_group_items_tenant ON group_items(tenant_id);
CREATE INDEX idx_group_items_item ON group_items(item_id);
