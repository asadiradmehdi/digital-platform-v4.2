import { query } from '../core/db';
import { AppError } from '../core/errors';

/**
 * Platform admins hold the global system role 'platform_admin' (roles.workspace_id IS NULL,
 * is_system = true), assigned through member_roles on an ACTIVE workspace membership. Global roles are
 * provisioned only by operators: the member-role API resolves roles by (workspace_id, name), so a
 * workspace owner can neither create nor assign a global role. A workspace-scoped role that happens to
 * be named 'platform_admin' is deliberately ignored.
 *
 * (There is no user_roles table; the previous query against it failed on every call.)
 */
const PLATFORM_ADMIN_SQL = `SELECT EXISTS(
   SELECT 1 FROM workspace_members wm
   JOIN member_roles mr ON mr.member_id = wm.id
   JOIN roles r ON r.id = mr.role_id
   WHERE wm.user_id = $1 AND wm.status = 'ACTIVE'
     AND r.name = 'platform_admin' AND r.workspace_id IS NULL AND r.is_system = true
 ) AS is_admin`;

/** Asserts that the given userId holds the platform_admin role. Throws FORBIDDEN if not. */
export async function requirePlatformAdmin(userId: string): Promise<void> {
  const r = await query<{ is_admin: boolean }>(PLATFORM_ADMIN_SQL, [userId]);
  if (!r.rows[0]?.is_admin) {
    throw new AppError('FORBIDDEN', 'Platform admin required.');
  }
}

/** Returns true when the userId has the platform_admin role, without throwing. */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const r = await query<{ is_admin: boolean }>(PLATFORM_ADMIN_SQL, [userId]);
  return Boolean(r.rows[0]?.is_admin);
}
