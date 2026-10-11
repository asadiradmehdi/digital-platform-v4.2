BEGIN;
-- Broadcast targets: one (user, workspace) pair per ACTIVE customer, keyset-paged so a send never loads everyone at once.
-- Read-only SECURITY DEFINER helper (same pattern as the other system_admin_* reads); the caller checks the permission.
CREATE OR REPLACE FUNCTION system_admin_broadcast_targets(p_after uuid, p_limit integer)
RETURNS TABLE(user_id uuid, workspace_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  prev text := current_setting('app.rls_system_read', true);
BEGIN
  PERFORM set_config('app.rls_system_read', 'on', true);
  RETURN QUERY
    SELECT u.id, wm.workspace_id
    FROM users u
    JOIN LATERAL (SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = u.id AND m.status = 'ACTIVE' ORDER BY m.created_at LIMIT 1) wm ON true
    WHERE u.status = 'ACTIVE' AND u.deleted_at IS NULL AND (p_after IS NULL OR u.id > p_after)
    ORDER BY u.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
  PERFORM set_config('app.rls_system_read', COALESCE(prev, ''), true);
END;
$$;
REVOKE ALL ON FUNCTION system_admin_broadcast_targets(uuid, integer) FROM PUBLIC;
COMMIT;
