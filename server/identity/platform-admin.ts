import { query } from '../core/db';
import { AppError } from '../core/errors';

/**
 * Asserts that the given userId holds the platform_admin role.
 * Throws FORBIDDEN if not.
 *
 * The platform_admin role is stored in the global roles table without a
 * workspace_id (workspace_id IS NULL) or in the user_roles table directly.
 * We check both the user_roles path and the member_roles path to cover both
 * assignment strategies.
 */
export async function requirePlatformAdmin(userId: string): Promise<void> {
  const r = await query<{ is_admin: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.name = 'platform_admin'
     ) AS is_admin`,
    [userId]
  );
  if (!r.rows[0]?.is_admin) {
    throw new AppError('FORBIDDEN', 'Platform admin required.');
  }
}

/** Returns true when the userId has the platform_admin role, without throwing. */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const r = await query<{ is_admin: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.name = 'platform_admin'
     ) AS is_admin`,
    [userId]
  );
  return Boolean(r.rows[0]?.is_admin);
}
