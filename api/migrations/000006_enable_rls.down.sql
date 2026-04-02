DROP POLICY IF EXISTS tenant_isolation_items ON items;
DROP POLICY IF EXISTS tenant_isolation_connections ON connections;
DROP POLICY IF EXISTS tenant_isolation_groups ON groups;
DROP POLICY IF EXISTS tenant_isolation_group_items ON group_items;
DROP POLICY IF EXISTS tenant_isolation_milestones ON milestones;

ALTER TABLE items DISABLE ROW LEVEL SECURITY;
ALTER TABLE connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE milestones DISABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_user;
REVOKE USAGE ON SCHEMA public FROM app_user;
DROP ROLE IF EXISTS app_user;
