-- Migration 000007: Convert tenant IDs from UUID to TEXT
-- This allows using Clerk Organization IDs (e.g., "org_2abc123") as tenant IDs.

-- 1. Drop existing RLS policies (they cast to ::uuid which won't work with TEXT)
DROP POLICY IF EXISTS tenant_isolation_items ON items;
DROP POLICY IF EXISTS tenant_isolation_connections ON connections;
DROP POLICY IF EXISTS tenant_isolation_groups ON groups;
DROP POLICY IF EXISTS tenant_isolation_group_items ON group_items;
DROP POLICY IF EXISTS tenant_isolation_milestones ON milestones;

-- 2. Drop FK constraints on tenant_id columns
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_tenant_id_fkey;
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_tenant_id_fkey;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_tenant_id_fkey;
ALTER TABLE group_items DROP CONSTRAINT IF EXISTS group_items_tenant_id_fkey;
ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_tenant_id_fkey;

-- 3. Convert tenants.id from UUID to TEXT
ALTER TABLE tenants ALTER COLUMN id TYPE TEXT;

-- 4. Convert all tenant_id columns from UUID to TEXT
ALTER TABLE items ALTER COLUMN tenant_id TYPE TEXT;
ALTER TABLE connections ALTER COLUMN tenant_id TYPE TEXT;
ALTER TABLE groups ALTER COLUMN tenant_id TYPE TEXT;
ALTER TABLE group_items ALTER COLUMN tenant_id TYPE TEXT;
ALTER TABLE milestones ALTER COLUMN tenant_id TYPE TEXT;

-- 5. Re-add FK constraints
ALTER TABLE items ADD CONSTRAINT items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE connections ADD CONSTRAINT connections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE groups ADD CONSTRAINT groups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE group_items ADD CONSTRAINT group_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE milestones ADD CONSTRAINT milestones_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- 6. Recreate RLS policies without ::uuid cast
CREATE POLICY tenant_isolation_items ON items
    USING (tenant_id = current_setting('app.current_tenant_id'))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_connections ON connections
    USING (tenant_id = current_setting('app.current_tenant_id'))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_groups ON groups
    USING (tenant_id = current_setting('app.current_tenant_id'))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_group_items ON group_items
    USING (tenant_id = current_setting('app.current_tenant_id'))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_milestones ON milestones
    USING (tenant_id = current_setting('app.current_tenant_id'))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id'));

-- 7. Grant permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
