// Who may do what in the admin console. Two kinds of people:
//   owner  = holds the global platform_admin role (deploy/admins.txt). Every permission, always. Unchanged legacy behaviour.
//   staff  = a row in staff_members (status ACTIVE) with the permissions the owner (or a manager under him) granted.
// Enforcement is server-side on every admin function and route; hiding UI is only a convenience.
// A pending staff_invites row for the user's VERIFIED email/phone is claimed on first access.
import { query, withUserTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { requirePlatformAdmin } from '../identity/platform-admin';
import { ALL_PERMISSIONS, normalizePermissions, type PermissionKey } from '../../lib/admin-permissions';

export type AdminAccess = { userId: string; kind: 'owner' | 'staff'; permissions: ReadonlySet<PermissionKey>; parentUserId: string | null };

const forbidden = (m = 'برای این کار دسترسی ندارید.') => new AppError('FORBIDDEN', m);
const toKeys = (arr: unknown): PermissionKey[] => normalizePermissions(Array.isArray(arr) ? arr : []);

async function claimInvite(userId: string): Promise<boolean> {
  const u = (await query<{ email: string | null; phone: string | null; ev: boolean; pv: boolean; status: string }>(
    `SELECT email, phone, email_verified_at IS NOT NULL AS ev, phone_verified_at IS NOT NULL AS pv, status::text FROM users WHERE id=$1 AND deleted_at IS NULL`, [userId]))?.rows?.[0];
  if (!u || u.status !== 'ACTIVE') return false;
  const contacts: Array<[string, string]> = [];
  if (u.email && u.ev) contacts.push(['email', u.email.toLowerCase()]);
  if (u.phone && u.pv) contacts.push(['phone', u.phone]);
  if (contacts.length === 0) return false;
  return withUserTransaction(userId, async c => {
    const inv = (await c.query<{ id: string; parent_user_id: string | null; title: string | null; preset: string | null; permissions: string[]; invited_by: string | null }>(
      `SELECT id, parent_user_id, title, preset, permissions, invited_by FROM staff_invites
       WHERE claimed_at IS NULL AND revoked_at IS NULL AND expires_at > now() AND (contact_kind, lower(contact_value)) IN (${contacts.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',')})
       ORDER BY created_at LIMIT 1 FOR UPDATE`, contacts.flat())).rows[0];
    if (!inv) return false;
    const perms = toKeys(inv.permissions);
    await c.query(`INSERT INTO staff_members(user_id,parent_user_id,title,preset,permissions,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$1) ON CONFLICT (user_id) DO NOTHING`,
      [userId, inv.parent_user_id, inv.title, inv.preset, perms, inv.invited_by]);
    await c.query(`UPDATE staff_invites SET claimed_at=now(), claimed_by=$2 WHERE id=$1`, [inv.id, userId]);
    await writeAudit({ actorUserId: userId, action: 'admin.team.invite.claimed', entityType: 'staff_member', entityId: userId, metadata: { inviteId: inv.id, permissions: perms, invitedBy: inv.invited_by } }, c);
    return true;
  });
}

/** Null when the user has no admin access at all. */
export async function getAdminAccess(userId: string): Promise<AdminAccess | null> {
  try { await requirePlatformAdmin(userId); return { userId, kind: 'owner', permissions: new Set(ALL_PERMISSIONS), parentUserId: null }; }
  catch (e) { if (!(e instanceof AppError) || e.code !== 'FORBIDDEN') throw e; }
  const read = () => query<{ status: string; permissions: string[]; parent_user_id: string | null; ustatus: string }>(
    `SELECT s.status, s.permissions, s.parent_user_id, u.status::text AS ustatus FROM staff_members s JOIN users u ON u.id=s.user_id WHERE s.user_id=$1`, [userId]);
  let row = (await read())?.rows?.[0];
  if (!row && await claimInvite(userId)) row = (await read())?.rows?.[0];
  if (!row || row.status !== 'ACTIVE' || row.ustatus !== 'ACTIVE') return null;
  return { userId, kind: 'staff', permissions: new Set(toKeys(row.permissions)), parentUserId: row.parent_user_id };
}

/** Any admin (owner or active staff). */
export async function requireAdminAccess(userId: string): Promise<AdminAccess> {
  const a = await getAdminAccess(userId);
  if (!a) throw forbidden('دسترسی به برنامه‌ی مدیریت ندارید.');
  return a;
}

/** The permission check every admin function runs first. Owners pass; staff need the exact key. */
export async function requirePermission(userId: string, permission: PermissionKey): Promise<AdminAccess> {
  const a = await requireAdminAccess(userId);
  if (!a.permissions.has(permission)) throw forbidden();
  return a;
}

/** Passes when the user holds at least one of the keys. */
export async function requireAnyPermission(userId: string, permissions: readonly PermissionKey[]): Promise<AdminAccess> {
  const a = await requireAdminAccess(userId);
  if (!permissions.some(p => a.permissions.has(p))) throw forbidden();
  return a;
}
