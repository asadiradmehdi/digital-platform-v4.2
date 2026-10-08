BEGIN;

-- 1) Notifications addressed to a user (user_id set) are read and marked read from the user's inbox,
--    which spans every workspace the user belongs to. tenant_isolation alone hid them from the inbox for
--    a non-superuser role. Mirroring audit_user_scope (0030), the user set in app.user_id may SELECT and
--    UPDATE (mark read) only their own notifications. No INSERT or DELETE is granted by this scope; those
--    remain governed solely by tenant_isolation.
DROP POLICY IF EXISTS notifications_user_read ON notifications;
CREATE POLICY notifications_user_read ON notifications FOR SELECT
  USING (user_id IS NOT NULL AND user_id = app_user_id());

DROP POLICY IF EXISTS notifications_user_mark_read ON notifications;
CREATE POLICY notifications_user_mark_read ON notifications FOR UPDATE
  USING (user_id IS NOT NULL AND user_id = app_user_id())
  WITH CHECK (user_id IS NOT NULL AND user_id = app_user_id());

-- 2) Platform-level operational events (alerts, pricing guards) carry no workspace. tenant_isolation
--    rejected every such insert. This INSERT-only policy admits a workspace-less row only when no tenant
--    context is set, so a tenant transaction can never write one. It grants no read access: platform
--    rows are read only through system_admin_dashboard_stats() (0031).
DROP POLICY IF EXISTS operational_events_platform_insert ON operational_events;
CREATE POLICY operational_events_platform_insert ON operational_events FOR INSERT
  WITH CHECK (workspace_id IS NULL AND app_workspace_id() IS NULL);

COMMIT;
