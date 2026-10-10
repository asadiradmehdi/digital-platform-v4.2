// «تیم و دسترسی‌ها»: the owner adds staff under himself and picks exactly what each person may do.
// Rules enforced here (never in the UI):
//   - only holders of team.manage reach any function; the owner (platform_admin) always does;
//   - nobody can grant a permission they do not hold themselves, and cannot touch permissions they do not hold;
//   - managers act only on people below them (their subtree); nobody edits themselves, an ancestor, or an owner;
//   - owners are platform_admin role holders (deploy/admins.txt). They are listed but can not be changed, suspended or removed
//     here, so the last owner can never be removed from this screen;
//   - every add / change / suspend / remove / invite is one audit row with granted and revoked keys.
import type { PoolClient } from 'pg';
import { query, withUserTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { ALL_PERMISSIONS, PRESETS, matchPreset, normalizePermissions, presetById, type PermissionKey } from '../../lib/admin-permissions';
import { normalizeIranMobile } from '../../packages/api-contracts/src/phone';
import { requirePermission, type AdminAccess } from './access';

const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const bad = (m: string) => new AppError('VALIDATION_ERROR', m);
const forbidden = (m: string) => new AppError('FORBIDDEN', m);

export type TeamMember = {
  userId: string; name: string; email: string | null; phone: string | null; status: 'ACTIVE' | 'SUSPENDED'; title: string | null;
  preset: string | null; presetLabel: string | null; permissions: PermissionKey[]; parentUserId: string | null; parentName: string | null; createdAt: string; editable: boolean;
};
export type TeamInvite = { id: string; contact: string; kind: 'email' | 'phone'; title: string | null; permissions: PermissionKey[]; createdAt: string; expiresAt: string; parentName: string | null };
export type TeamOverview = {
  me: { userId: string; kind: 'owner' | 'staff'; permissions: PermissionKey[] };
  owners: { userId: string; name: string; email: string | null }[];
  members: TeamMember[]; invites: TeamInvite[];
};

/** Permission set the actor may hand out: everything for the owner, otherwise exactly what they hold. */
const grantable = (a: AdminAccess) => new Set<PermissionKey>(a.permissions);

/** Pure rule: what the target's permission list becomes when `actor` asks for `requested`. Throws if the actor tries to exceed their own rights. */
export function resolveGrant(actorPerms: ReadonlySet<PermissionKey>, current: readonly PermissionKey[], requested: readonly unknown[]): { next: PermissionKey[]; granted: PermissionKey[]; revoked: PermissionKey[] } {
  const wanted = normalizePermissions(requested);
  const cur = new Set(current);
  const overreach = wanted.filter(k => !cur.has(k) && !actorPerms.has(k));
  if (overreach.length) throw forbidden('نمی‌توانید دسترسی‌ای بدهید که خودتان ندارید.');
  // keys the actor does not hold stay exactly as they are (they cannot be removed by someone who lacks them)
  const kept = current.filter(k => !actorPerms.has(k));
  const next = normalizePermissions([...kept, ...wanted.filter(k => actorPerms.has(k))]);
  const nextSet = new Set(next);
  return { next, granted: next.filter(k => !cur.has(k)), revoked: current.filter(k => !nextSet.has(k)) };
}

async function isOwner(c: Pick<PoolClient, 'query'>, userId: string) {
  const r = await c.query(`SELECT 1 FROM workspace_members wm JOIN member_roles mr ON mr.member_id=wm.id JOIN roles r ON r.id=mr.role_id
    WHERE wm.user_id=$1 AND wm.status='ACTIVE' AND r.name='platform_admin' AND r.workspace_id IS NULL AND r.is_system LIMIT 1`, [userId]);
  return (r.rowCount ?? 0) > 0;
}
/** True when `ancestor` is anywhere above `target` in the parent chain. */
async function isAbove(c: Pick<PoolClient, 'query'>, ancestor: string, target: string) {
  const r = await c.query(`WITH RECURSIVE up AS (
      SELECT user_id, parent_user_id, 1 AS d FROM staff_members WHERE user_id=$2
      UNION ALL SELECT s.user_id, s.parent_user_id, up.d+1 FROM staff_members s JOIN up ON s.user_id=up.parent_user_id WHERE up.d < 50)
    SELECT 1 FROM up WHERE parent_user_id=$1 LIMIT 1`, [ancestor, target]);
  return (r.rowCount ?? 0) > 0;
}

/** The actor may act on `target` only when they are the owner or above them in the tree; never on themselves or an owner. */
async function assertCanManage(c: PoolClient, actor: AdminAccess, targetId: string) {
  if (targetId === actor.userId) throw forbidden('نمی‌توانید دسترسی‌های خودتان را تغییر دهید.');
  if (await isOwner(c, targetId)) throw forbidden('مالک قابل تغییر نیست.');
  if (actor.kind !== 'owner' && !(await isAbove(c, actor.userId, targetId))) throw forbidden('این عضو زیرمجموعه‌ی شما نیست.');
}

export async function getTeam(actorUserId: string): Promise<TeamOverview> {
  const a = await requirePermission(actorUserId, 'team.manage');
  const owners = await query<{ id: string; name: string; email: string | null }>(
    `SELECT DISTINCT u.id, COALESCE(NULLIF(u.display_name,''), u.phone, u.email, 'مالک') AS name, u.email
     FROM workspace_members wm JOIN member_roles mr ON mr.member_id=wm.id JOIN roles r ON r.id=mr.role_id JOIN users u ON u.id=wm.user_id
     WHERE wm.status='ACTIVE' AND r.name='platform_admin' AND r.workspace_id IS NULL AND r.is_system ORDER BY name`);
  const scope = a.kind === 'owner'
    ? `TRUE`
    : `s.user_id IN (WITH RECURSIVE down AS (SELECT user_id FROM staff_members WHERE parent_user_id=$1 UNION ALL SELECT s2.user_id FROM staff_members s2 JOIN down ON s2.parent_user_id=down.user_id) SELECT user_id FROM down)`;
  const m = await query<{ user_id: string; name: string; email: string | null; phone: string | null; status: 'ACTIVE' | 'SUSPENDED'; title: string | null; preset: string | null; permissions: string[]; parent_user_id: string | null; pname: string | null; created_at: string }>(
    `SELECT s.user_id, COALESCE(NULLIF(u.display_name,''), u.phone, u.email, 'عضو') AS name, u.email, u.phone, s.status, s.title, s.preset, s.permissions, s.parent_user_id,
            COALESCE(NULLIF(pu.display_name,''), pu.phone, pu.email) AS pname, s.created_at::text
     FROM staff_members s JOIN users u ON u.id=s.user_id LEFT JOIN users pu ON pu.id=s.parent_user_id WHERE ${scope} ORDER BY s.created_at`, a.kind === 'owner' ? [] : [a.userId]);
  const inv = await query<{ id: string; contact_kind: 'email' | 'phone'; contact_value: string; title: string | null; permissions: string[]; created_at: string; expires_at: string; pname: string | null }>(
    `SELECT i.id, i.contact_kind, i.contact_value, i.title, i.permissions, i.created_at::text, i.expires_at::text, COALESCE(NULLIF(pu.display_name,''), pu.phone, pu.email) AS pname
     FROM staff_invites i LEFT JOIN users pu ON pu.id=i.parent_user_id
     WHERE i.claimed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now() ${a.kind === 'owner' ? '' : 'AND i.invited_by=$1'} ORDER BY i.created_at DESC`, a.kind === 'owner' ? [] : [a.userId]);
  return {
    me: { userId: a.userId, kind: a.kind, permissions: [...a.permissions] },
    owners: owners.rows.map(o => ({ userId: o.id, name: o.name, email: o.email })),
    members: m.rows.map(x => {
      const perms = normalizePermissions(x.permissions);
      return { userId: x.user_id, name: x.name, email: x.email, phone: x.phone, status: x.status, title: x.title, preset: x.preset, presetLabel: (presetById(x.preset) ?? matchPreset(perms))?.label ?? null,
        permissions: perms, parentUserId: x.parent_user_id, parentName: x.pname, createdAt: x.created_at, editable: x.user_id !== a.userId };
    }),
    invites: inv.rows.map(i => ({ id: i.id, contact: i.contact_value, kind: i.contact_kind, title: i.title, permissions: normalizePermissions(i.permissions), createdAt: i.created_at, expiresAt: i.expires_at, parentName: i.pname })),
  };
}

const cleanTitle = (v: unknown) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw bad('عنوان معتبر نیست.');
  const t = v.replace(/\s+/g, ' ').trim();
  if (Array.from(t).length > 60) throw bad('عنوان حداکثر ۶۰ حرف است.');
  return t || null;
};

/** Email or Iranian mobile -> {kind, value}. Persian digits are accepted. */
export function parseContact(input: unknown): { kind: 'email'; value: string } | { kind: 'phone'; value: string } {
  if (typeof input !== 'string' || !input.trim()) throw bad('ایمیل یا شماره‌ی موبایل را وارد کنید.');
  const t = input.trim();
  if (t.includes('@')) {
    const e = t.toLowerCase();
    if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e) || e.length > 200) throw bad('ایمیل معتبر نیست.');
    return { kind: 'email', value: e };
  }
  const p = normalizeIranMobile(t);
  if (!p) throw bad('شماره‌ی موبایل معتبر نیست.');
  return { kind: 'phone', value: p };
}

function requestedPermissions(input: { preset?: unknown; permissions?: unknown }): { preset: string | null; permissions: unknown[] } {
  if (Array.isArray(input.permissions)) {
    const unknown = input.permissions.filter(k => !(ALL_PERMISSIONS as string[]).includes(String(k)));
    if (unknown.length) throw bad('دسترسی نامعتبر ارسال شد.');
    return { preset: typeof input.preset === 'string' ? input.preset : null, permissions: input.permissions };
  }
  const p = presetById(typeof input.preset === 'string' ? input.preset : null);
  if (!p) throw bad('یک الگو یا فهرست دسترسی انتخاب کنید.');
  return { preset: p.id, permissions: p.permissions };
}

export async function addMember(input: { actorUserId: string; contact: unknown; title?: unknown; preset?: unknown; permissions?: unknown }) {
  const a = await requirePermission(input.actorUserId, 'team.manage');
  const contact = parseContact(input.contact);
  const title = cleanTitle(input.title);
  const req = requestedPermissions(input);
  const { next } = resolveGrant(grantable(a), [], req.permissions);
  if (next.length === 0) throw bad('حداقل یک دسترسی انتخاب کنید.');
  const preset = req.preset && matchPreset(next)?.id === req.preset ? req.preset : null;
  const user = (await query<{ id: string; status: string }>(
    contact.kind === 'email' ? `SELECT id, status::text FROM users WHERE lower(email)=$1 AND deleted_at IS NULL` : `SELECT id, status::text FROM users WHERE phone=$1 AND deleted_at IS NULL`, [contact.value])).rows[0];
  return withUserTransaction(input.actorUserId, async c => {
    if (user) {
      if (user.status !== 'ACTIVE') throw bad('حساب این کاربر فعال نیست.');
      if (user.id === a.userId) throw bad('خودتان را نمی‌توانید اضافه کنید.');
      if (await isOwner(c, user.id)) throw bad('این شخص مالک است و همه‌ی دسترسی‌ها را دارد.');
      const exists = await c.query(`SELECT 1 FROM staff_members WHERE user_id=$1`, [user.id]);
      if ((exists.rowCount ?? 0) > 0) throw new AppError('CONFLICT', 'این شخص پیش‌تر عضو تیم است.');
      await c.query(`INSERT INTO staff_members(user_id,parent_user_id,title,preset,permissions,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$2,$2)`, [user.id, a.userId, title, preset, next]);
      await writeAudit({ actorUserId: a.userId, action: 'admin.team.add', entityType: 'staff_member', entityId: user.id, metadata: { granted: next, preset, title, parent: a.userId } }, c);
      return { kind: 'member' as const, userId: user.id };
    }
    const dup = await c.query(`SELECT 1 FROM staff_invites WHERE contact_kind=$1 AND lower(contact_value)=$2 AND claimed_at IS NULL AND revoked_at IS NULL AND expires_at > now()`, [contact.kind, contact.value.toLowerCase()]);
    if ((dup.rowCount ?? 0) > 0) throw new AppError('CONFLICT', 'برای این مخاطب دعوت‌نامه‌ی فعال وجود دارد.');
    await c.query(`DELETE FROM staff_invites WHERE contact_kind=$1 AND lower(contact_value)=$2 AND (claimed_at IS NOT NULL OR revoked_at IS NOT NULL OR expires_at <= now())`, [contact.kind, contact.value.toLowerCase()]);
    const r = await c.query<{ id: string }>(`INSERT INTO staff_invites(contact_kind,contact_value,parent_user_id,title,preset,permissions,invited_by) VALUES($1,$2,$3,$4,$5,$6,$3) RETURNING id`, [contact.kind, contact.value, a.userId, title, preset, next]);
    await writeAudit({ actorUserId: a.userId, action: 'admin.team.invite', entityType: 'staff_invite', entityId: r.rows[0].id, metadata: { contactKind: contact.kind, granted: next, preset, title } }, c);
    return { kind: 'invite' as const, inviteId: r.rows[0].id };
  });
}

export async function updateMember(input: { actorUserId: string; userId: unknown; title?: unknown; preset?: unknown; permissions?: unknown }) {
  const a = await requirePermission(input.actorUserId, 'team.manage');
  if (!isUuid(input.userId)) throw new AppError('NOT_FOUND', 'عضو پیدا نشد.');
  const targetId = input.userId;
  return withUserTransaction(input.actorUserId, async c => {
    await assertCanManage(c, a, targetId);
    const cur = (await c.query<{ permissions: string[]; title: string | null; preset: string | null }>(`SELECT permissions, title, preset FROM staff_members WHERE user_id=$1 FOR UPDATE`, [targetId])).rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'عضو پیدا نشد.');
    const before = normalizePermissions(cur.permissions);
    let next = before; let granted: PermissionKey[] = []; let revoked: PermissionKey[] = [];
    if (input.permissions !== undefined || input.preset !== undefined) {
      const req = requestedPermissions(input);
      ({ next, granted, revoked } = resolveGrant(grantable(a), before, req.permissions));
      if (next.length === 0) throw bad('حداقل یک دسترسی باید باقی بماند؛ برای حذف، گزینه‌ی حذف عضو را بزنید.');
    }
    const title = input.title === undefined ? cur.title : cleanTitle(input.title);
    const preset = matchPreset(next)?.id ?? null;
    if (granted.length === 0 && revoked.length === 0 && title === cur.title) return { changed: false, permissions: next };
    await c.query(`UPDATE staff_members SET permissions=$2, title=$3, preset=$4, updated_by=$5, updated_at=now() WHERE user_id=$1`, [targetId, next, title, preset, a.userId]);
    await writeAudit({ actorUserId: a.userId, action: 'admin.team.update', entityType: 'staff_member', entityId: targetId, metadata: { granted, revoked, titleFrom: cur.title, titleTo: title, preset } }, c);
    return { changed: true, permissions: next };
  });
}

export async function setMemberStatus(input: { actorUserId: string; userId: unknown; status: unknown }) {
  const a = await requirePermission(input.actorUserId, 'team.manage');
  if (!isUuid(input.userId)) throw new AppError('NOT_FOUND', 'عضو پیدا نشد.');
  if (input.status !== 'ACTIVE' && input.status !== 'SUSPENDED') throw bad('وضعیت نامعتبر است.');
  const to = input.status; const targetId = input.userId;
  return withUserTransaction(input.actorUserId, async c => {
    await assertCanManage(c, a, targetId);
    const cur = (await c.query<{ status: string }>(`SELECT status FROM staff_members WHERE user_id=$1 FOR UPDATE`, [targetId])).rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'عضو پیدا نشد.');
    if (cur.status === to) return { status: to, changed: false };
    await c.query(`UPDATE staff_members SET status=$2, updated_by=$3, updated_at=now() WHERE user_id=$1`, [targetId, to, a.userId]);
    await writeAudit({ actorUserId: a.userId, action: to === 'SUSPENDED' ? 'admin.team.suspend' : 'admin.team.reactivate', entityType: 'staff_member', entityId: targetId, metadata: { from: cur.status, to } }, c);
    return { status: to, changed: true };
  });
}

/** Removes the person from the team (all access revoked at once). Their own subordinates move up to the removed person's manager. */
export async function removeMember(input: { actorUserId: string; userId: unknown }) {
  const a = await requirePermission(input.actorUserId, 'team.manage');
  if (!isUuid(input.userId)) throw new AppError('NOT_FOUND', 'عضو پیدا نشد.');
  const targetId = input.userId;
  return withUserTransaction(input.actorUserId, async c => {
    await assertCanManage(c, a, targetId);
    const cur = (await c.query<{ permissions: string[]; parent_user_id: string | null }>(`SELECT permissions, parent_user_id FROM staff_members WHERE user_id=$1 FOR UPDATE`, [targetId])).rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'عضو پیدا نشد.');
    await c.query(`UPDATE staff_members SET parent_user_id=$2 WHERE parent_user_id=$1`, [targetId, cur.parent_user_id]);
    await c.query(`DELETE FROM staff_members WHERE user_id=$1`, [targetId]);
    await writeAudit({ actorUserId: a.userId, action: 'admin.team.remove', entityType: 'staff_member', entityId: targetId, metadata: { revoked: normalizePermissions(cur.permissions), movedUpTo: cur.parent_user_id } }, c);
    return { removed: true };
  });
}

export async function revokeInvite(input: { actorUserId: string; inviteId: unknown }) {
  const a = await requirePermission(input.actorUserId, 'team.manage');
  if (!isUuid(input.inviteId)) throw new AppError('NOT_FOUND', 'دعوت‌نامه پیدا نشد.');
  return withUserTransaction(input.actorUserId, async c => {
    const r = await c.query<{ invited_by: string | null }>(`SELECT invited_by FROM staff_invites WHERE id=$1 AND claimed_at IS NULL AND revoked_at IS NULL FOR UPDATE`, [input.inviteId]);
    const inv = r.rows[0];
    if (!inv) throw new AppError('NOT_FOUND', 'دعوت‌نامه پیدا نشد.');
    if (a.kind !== 'owner' && inv.invited_by !== a.userId) throw forbidden('این دعوت‌نامه را شما نفرستاده‌اید.');
    await c.query(`UPDATE staff_invites SET revoked_at=now() WHERE id=$1`, [input.inviteId]);
    await writeAudit({ actorUserId: a.userId, action: 'admin.team.invite.revoke', entityType: 'staff_invite', entityId: String(input.inviteId), metadata: {} }, c);
    return { revoked: true };
  });
}

export { PRESETS };
