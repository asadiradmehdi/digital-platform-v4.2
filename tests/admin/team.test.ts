import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn(), isPlatformAdmin: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withUserTransaction: vi.fn(async (_u: string, fn: (c: { query: typeof query }) => unknown) => fn({ query })), withTenantTransaction: vi.fn(async (_w: string, _u: string, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});
import { requirePlatformAdmin } from '../../server/identity/platform-admin';
import { writeAudit } from '../../server/core/audit';
import { query } from '../../server/core/db';
import { AppError } from '../../server/core/errors';
import { getAdminAccess, requirePermission } from '../../server/admin/access';
import { addMember, parseContact, removeMember, resolveGrant, setMemberStatus, updateMember } from '../../server/admin/team';
import { refundOrCancel } from '../../server/admin/orders';
import { adjustWallet } from '../../server/admin/wallets';
import { normalizePermissions, PRESETS, type PermissionKey } from '../../lib/admin-permissions';

const OWNER = '10000000-0000-4000-8000-000000000001';
const MGR = '20000000-0000-4000-8000-000000000002';
const AGENT = '30000000-0000-4000-8000-000000000003';
const OTHER = '40000000-0000-4000-8000-000000000004';
const NEWBIE = '50000000-0000-4000-8000-000000000005';
const q = vi.mocked(query);
const forbiddenErr = () => new AppError('FORBIDDEN', 'Platform admin required.');

type Staff = { status?: string; permissions: PermissionKey[]; parent?: string | null; ustatus?: string };
/** DB double: owners, staff rows and the parent chain. */
function world(staff: Record<string, Staff>, owners: string[] = [OWNER], extra?: (sql: string, args: unknown[]) => unknown) {
  vi.mocked(requirePlatformAdmin).mockImplementation(async (u: string) => { if (!owners.includes(u)) throw forbiddenErr(); });
  q.mockImplementation((async (sql: string, args: unknown[] = []) => {
    const e = extra?.(sql, args); if (e !== undefined) return e;
    if (/FROM staff_members s JOIN users u/.test(sql)) { const s = staff[String(args[0])]; return { rows: s ? [{ status: s.status ?? 'ACTIVE', permissions: s.permissions, parent_user_id: s.parent ?? null, ustatus: s.ustatus ?? 'ACTIVE' }] : [] }; }
    if (/r.name='platform_admin'/.test(sql) && /LIMIT 1/.test(sql)) return { rowCount: owners.includes(String(args[0])) ? 1 : 0, rows: [] };
    if (/WITH RECURSIVE up/.test(sql)) { // is args[0] above args[1]?
      let cur = staff[String(args[1])]?.parent ?? null; let hops = 0;
      while (cur && hops++ < 20) { if (cur === args[0]) return { rowCount: 1, rows: [{}] }; cur = staff[cur]?.parent ?? null; }
      return { rowCount: 0, rows: [] };
    }
    if (/FROM staff_members WHERE user_id=\$1 FOR UPDATE/.test(sql) || /SELECT permissions, title, preset FROM staff_members/.test(sql)) { const s = staff[String(args[0])]; return { rows: s ? [{ permissions: s.permissions, title: null, preset: null, status: s.status ?? 'ACTIVE', parent_user_id: s.parent ?? null }] : [] }; }
    if (/SELECT 1 FROM staff_members WHERE user_id/.test(sql)) return { rowCount: staff[String(args[0])] ? 1 : 0, rows: [] };
    return { rows: [], rowCount: 0 };
  }) as never);
}
beforeEach(() => { vi.resetAllMocks(); });

describe('permission catalogue', () => {
  it('normalizes: drops unknown keys, adds required view keys, de-duplicates', () => {
    expect(normalizePermissions(['orders.manage', 'bogus', 'orders.manage'])).toEqual(['orders.view', 'orders.manage']);
    expect(normalizePermissions(['catalog.approve'])).toEqual(['catalog.view', 'catalog.approve']);
  });
  it('every preset is already normalized and non-empty; the viewer preset has no write permission', () => {
    for (const p of PRESETS) { expect(p.permissions.length).toBeGreaterThan(0); expect(normalizePermissions(p.permissions)).toEqual(p.permissions); }
    const viewer = PRESETS.find(p => p.id === 'viewer')!;
    expect(viewer.permissions.every(k => k.endsWith('.view'))).toBe(true);
  });
});

describe('resolveGrant (nobody grants more than they hold)', () => {
  const mine = new Set<PermissionKey>(['orders.view', 'orders.manage', 'support.view']);
  it('refuses keys the actor lacks', () => {
    expect(() => resolveGrant(mine, [], ['wallet.adjust'])).toThrow(/ندارید/);
    expect(() => resolveGrant(mine, [], ['refunds.process'])).toThrow();
  });
  it('allows a subset and reports granted/revoked', () => {
    expect(resolveGrant(mine, ['support.view'], ['orders.manage'])).toMatchObject({ next: ['orders.view', 'orders.manage'], granted: ['orders.view', 'orders.manage'], revoked: ['support.view'] });
  });
  it('keys the actor does not hold stay untouched (cannot be revoked by them)', () => {
    const r = resolveGrant(mine, ['wallet.adjust', 'users.view'], ['orders.view']);
    expect(r.next).toContain('wallet.adjust'); expect(r.revoked).not.toContain('wallet.adjust'); expect(r.next).toContain('orders.view');
  });
});

describe('access resolution', () => {
  it('the owner (platform_admin) has every permission', async () => {
    world({});
    const a = await getAdminAccess(OWNER);
    expect(a?.kind).toBe('owner'); expect(a?.permissions.has('team.manage')).toBe(true); expect(a?.permissions.has('wallet.adjust')).toBe(true);
  });
  it('active staff get exactly their permissions; suspended staff, suspended users and strangers get none', async () => {
    world({ [AGENT]: { permissions: ['support.view', 'support.manage'] }, [OTHER]: { permissions: ['orders.view'], status: 'SUSPENDED' }, [MGR]: { permissions: ['orders.view'], ustatus: 'SUSPENDED' } });
    expect([...(await getAdminAccess(AGENT))!.permissions]).toEqual(['support.view', 'support.manage']);
    expect(await getAdminAccess(OTHER)).toBeNull();
    expect(await getAdminAccess(MGR)).toBeNull();
    expect(await getAdminAccess(NEWBIE)).toBeNull();
  });
  it('requirePermission refuses a missing key with FORBIDDEN and anyone without access', async () => {
    world({ [AGENT]: { permissions: ['support.view'] } });
    await expect(requirePermission(AGENT, 'support.manage')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(requirePermission(NEWBIE, 'orders.view')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(requirePermission(AGENT, 'support.view')).resolves.toMatchObject({ kind: 'staff' });
    await expect(requirePermission(OWNER, 'wallet.adjust')).resolves.toMatchObject({ kind: 'owner' });
  });
  it('a pending invite for the verified email is claimed on first access', async () => {
    let claimed = false;
    world({}, [OWNER], (sql) => {
      if (/FROM staff_members s JOIN users u/.test(sql)) return { rows: claimed ? [{ status: 'ACTIVE', permissions: ['orders.view'], parent_user_id: OWNER, ustatus: 'ACTIVE' }] : [] };
      if (/email_verified_at IS NOT NULL AS ev/.test(sql)) return { rows: [{ email: 'New@X.com', phone: null, ev: true, pv: false, status: 'ACTIVE' }] };
      if (/FROM staff_invites/.test(sql)) return { rows: [{ id: 'i1', parent_user_id: OWNER, title: null, preset: null, permissions: ['orders.view'], invited_by: OWNER }] };
      if (/INSERT INTO staff_members/.test(sql)) { claimed = true; return { rows: [] }; }
      return undefined;
    });
    const a = await getAdminAccess(NEWBIE);
    expect(a?.kind).toBe('staff'); expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.team.invite.claimed' }), expect.anything());
  });
  it('an unverified email is NOT claimed', async () => {
    world({}, [OWNER], (sql) => /email_verified_at IS NOT NULL AS ev/.test(sql) ? { rows: [{ email: 'a@x.com', phone: null, ev: false, pv: false, status: 'ACTIVE' }] } : undefined);
    expect(await getAdminAccess(NEWBIE)).toBeNull();
  });
});

describe('server-side enforcement on admin functions (negative tests)', () => {
  it('support-only staff cannot refund, adjust wallets or reach team management', async () => {
    world({ [AGENT]: { permissions: ['support.view', 'support.manage', 'orders.view'] } });
    await expect(refundOrCancel({ actorUserId: AGENT, orderId: 'x', mode: 'REFUND', reason: 'سلام دنیا', idempotencyKey: 'key-12345' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(adjustWallet({ actorUserId: AGENT, userId: OTHER, direction: 'CREDIT', amountToman: 1000, reason: 'تست تست تست', idempotencyKey: 'key-12345' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(addMember({ actorUserId: AGENT, contact: 'a@b.co', preset: 'viewer' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('a read-only viewer cannot use any write function', async () => {
    world({ [AGENT]: { permissions: PRESETS.find(p => p.id === 'viewer')!.permissions } });
    await expect(refundOrCancel({ actorUserId: AGENT, orderId: 'x', mode: 'CANCEL', reason: 'سلام دنیا', idempotencyKey: 'key-12345' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(adjustWallet({ actorUserId: AGENT, userId: OTHER, direction: 'DEBIT', amountToman: 1000, reason: 'تست تست تست', idempotencyKey: 'key-12345' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('team management rules', () => {
  const hierarchy: Record<string, Staff> = {
    [MGR]: { permissions: ['team.manage', 'orders.view', 'orders.manage', 'support.view'], parent: OWNER },
    [AGENT]: { permissions: ['support.view'], parent: MGR },
    [OTHER]: { permissions: ['orders.view', 'refunds.process'], parent: OWNER },
  };
  it('parseContact accepts email and Persian-digit mobiles, rejects junk', () => {
    expect(parseContact(' A@B.com ')).toEqual({ kind: 'email', value: 'a@b.com' });
    expect(parseContact('۰۹۱۲۳۴۵۶۷۸۹')).toMatchObject({ kind: 'phone' });
    for (const bad of ['', 'nope', '12345', 'a@b']) expect(() => parseContact(bad)).toThrow();
  });
  it('the owner adds an existing user under himself with a preset; the grant is audited', async () => {
    world(hierarchy, [OWNER], (sql) => /FROM users WHERE lower\(email\)/.test(sql) ? { rows: [{ id: NEWBIE, status: 'ACTIVE' }] } : undefined);
    const r = await addMember({ actorUserId: OWNER, contact: 'n@x.com', preset: 'support-agent', title: 'شیفت شب' });
    expect(r).toEqual({ kind: 'member', userId: NEWBIE });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.team.add', metadata: expect.objectContaining({ parent: OWNER, preset: 'support-agent' }) }), expect.anything());
  });
  it('an unknown contact becomes an invite', async () => {
    world(hierarchy, [OWNER], (sql) => /INSERT INTO staff_invites/.test(sql) ? { rows: [{ id: 'inv-1' }] } : undefined);
    expect(await addMember({ actorUserId: OWNER, contact: '09123456789', preset: 'viewer' })).toMatchObject({ kind: 'invite' });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.team.invite' }), expect.anything());
  });
  it('a manager cannot grant more than they hold (add or update)', async () => {
    world(hierarchy, [OWNER], (sql) => /FROM users WHERE lower\(email\)/.test(sql) ? { rows: [{ id: NEWBIE, status: 'ACTIVE' }] } : undefined);
    await expect(addMember({ actorUserId: MGR, contact: 'n@x.com', permissions: ['wallet.adjust'] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(addMember({ actorUserId: MGR, contact: 'n@x.com', preset: 'accountant' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(updateMember({ actorUserId: MGR, userId: AGENT, permissions: ['support.view', 'refunds.process'] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(writeAudit).not.toHaveBeenCalled();
  });
  it('a manager can change a subordinate within their own rights', async () => {
    world(hierarchy);
    const r = await updateMember({ actorUserId: MGR, userId: AGENT, permissions: ['support.view', 'orders.view'] });
    expect(r).toMatchObject({ changed: true });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.team.update', metadata: expect.objectContaining({ granted: ['orders.view'] }) }), expect.anything());
  });
  it('a manager cannot touch people outside their subtree, their own manager, an owner, or themselves', async () => {
    world(hierarchy);
    await expect(updateMember({ actorUserId: MGR, userId: OTHER, permissions: ['orders.view'] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(setMemberStatus({ actorUserId: AGENT, userId: MGR, status: 'SUSPENDED' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(removeMember({ actorUserId: MGR, userId: OWNER })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(updateMember({ actorUserId: MGR, userId: MGR, permissions: ['team.manage', 'orders.view'] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('nobody (not even the owner) can change or remove an owner from this screen — the last owner is always safe', async () => {
    world(hierarchy, [OWNER, 'a0000000-0000-4000-8000-00000000000a']);
    await expect(removeMember({ actorUserId: OWNER, userId: 'a0000000-0000-4000-8000-00000000000a' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(setMemberStatus({ actorUserId: OWNER, userId: OWNER, status: 'SUSPENDED' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('suspend and remove are audited; removing keeps nothing of the access', async () => {
    world(hierarchy);
    expect(await setMemberStatus({ actorUserId: OWNER, userId: AGENT, status: 'SUSPENDED' })).toMatchObject({ changed: true });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.team.suspend' }), expect.anything());
    await removeMember({ actorUserId: OWNER, userId: AGENT });
    expect(q.mock.calls.some(c => /DELETE FROM staff_members/.test(String(c[0])))).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.team.remove' }), expect.anything());
  });
  it('a member must keep at least one permission, and unknown keys are rejected', async () => {
    world(hierarchy);
    await expect(updateMember({ actorUserId: OWNER, userId: AGENT, permissions: [] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(updateMember({ actorUserId: OWNER, userId: AGENT, permissions: ['root.everything'] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
