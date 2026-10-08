-- Account-level audit rows (logout, password change, passkeys, trusted devices) carry no workspace,
-- so the tenant_isolation policy (workspace_id = app_workspace_id()) rejected every one of them for a
-- non-superuser application role. This adds a second, narrower permissive policy: a row without a
-- workspace is visible/insertable only for the user set in the transaction's app.user_id context.
-- Workspace-scoped rows remain governed solely by tenant_isolation.
CREATE OR REPLACE FUNCTION app_user_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

DROP POLICY IF EXISTS audit_user_scope ON audit_logs;
CREATE POLICY audit_user_scope ON audit_logs
  USING (workspace_id IS NULL AND actor_user_id IS NOT NULL AND actor_user_id = app_user_id())
  WITH CHECK (workspace_id IS NULL AND actor_user_id IS NOT NULL AND actor_user_id = app_user_id());
