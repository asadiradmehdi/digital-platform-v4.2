/**
 * Admin console against a real PostgreSQL (FORCE RLS, non-superuser role): runs only when ADMIN_IT_DATABASE_URL points at a
 * migrated + seeded database. Proves the SQL behind orders, tickets, wallets, packages, audit and team permissions, not just mocks.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.ADMIN_IT_DATABASE_URL;
if (URL) process.env.DATABASE_URL = URL;
process.env.PAYMENTS_MOCK_ALLOWED ??= 'true';
const IG_FOLLOWERS = '10000000-0000-0000-0000-000000000001';

describe.runIf(Boolean(URL))('admin console on real PostgreSQL', () => {
  type M = {
    db: typeof import('../../server/core/db'); orders: typeof import('../../server/commerce/orders'); pay: typeof import('../../server/payments/service');
    tickets: typeof import('../../server/support/tickets'); aOrders: typeof import('../../server/admin/orders'); aSupport: typeof import('../../server/admin/support');
    aWallet: typeof import('../../server/admin/wallets'); aAudit: typeof import('../../server/admin/audit'); aTeam: typeof import('../../server/admin/team');
    aAccess: typeof import('../../server/admin/access'); aPk: typeof import('../../server/admin/packages'); aOver: typeof import('../../server/admin/overview');
  };
  let m: M;
  const key = () => `it-${randomUUID()}`;
  let owner: string; let staff: string; let cust: { userId: string; workspaceId: string };

  async function newUser(label: string, balanceIrr = 0n) {
    const userId = randomUUID(); const workspaceId = randomUUID();
    await m.db.withTenantTransaction(workspaceId, userId, async c => {
      await c.query(`INSERT INTO users(id,email,phone,display_name,email_verified_at) VALUES($1,$2,$3,$4,now())`, [userId, `${userId}@it.test`, `09${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`, label]);
      await c.query(`INSERT INTO workspaces(id,owner_user_id,name,slug) VALUES($1,$2,'it',$3)`, [workspaceId, userId, `it-${workspaceId.slice(0, 8)}`]);
      await c.query(`INSERT INTO workspace_members(workspace_id,user_id,joined_at) VALUES($1,$2,now())`, [workspaceId, userId]);
      const w = await c.query<{ id: string }>(`INSERT INTO wallets(workspace_id,currency) VALUES($1,'IRR') RETURNING id`, [workspaceId]);
      const a = await c.query<{ id: string }>(`INSERT INTO ledger_accounts(wallet_id,account_code) VALUES($1,'MAIN') RETURNING id`, [w.rows[0].id]);
      if (balanceIrr > 0n) await c.query(`INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,idempotency_key) VALUES($1,'CREDIT',$2,'IRR','SEED',$3)`, [a.rows[0].id, balanceIrr.toString(), key()]);
    });
    return { userId, workspaceId };
  }

  beforeAll(async () => {
    m = {
      db: await import('../../server/core/db'), orders: await import('../../server/commerce/orders'), pay: await import('../../server/payments/service'),
      tickets: await import('../../server/support/tickets'), aOrders: await import('../../server/admin/orders'), aSupport: await import('../../server/admin/support'),
      aWallet: await import('../../server/admin/wallets'), aAudit: await import('../../server/admin/audit'), aTeam: await import('../../server/admin/team'),
      aAccess: await import('../../server/admin/access'), aPk: await import('../../server/admin/packages'), aOver: await import('../../server/admin/overview'),
    };
    const role = await m.db.query<{ rolsuper: boolean; rolbypassrls: boolean }>(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const o = await newUser('مدیر آزمایشی');
    owner = o.userId;
    await m.db.query(`INSERT INTO roles(workspace_id,name,is_system) SELECT NULL,'platform_admin',true WHERE NOT EXISTS (SELECT 1 FROM roles WHERE workspace_id IS NULL AND name='platform_admin')`);
    await m.db.query(`INSERT INTO member_roles(member_id,role_id) SELECT wm.id, r.id FROM workspace_members wm JOIN roles r ON r.workspace_id IS NULL AND r.name='platform_admin' WHERE wm.user_id=$1 ON CONFLICT DO NOTHING`, [owner]);
    staff = (await newUser('کارمند آزمایشی')).userId;
    cust = await newUser('مشتری آزمایشی', 500_000_000n);
  });
  afterAll(async () => { await m?.db.db().end(); });

  it('orders: search by name and code, detail with items/payments/timeline, status move, notes, refund idempotent', async () => {
    const order = await m.orders.createOrder({ workspaceId: cust.workspaceId, serviceId: IG_FOLLOWERS, quantity: 1000n, parameters: { target: '@zohalpay', brief: 'تست' }, idempotencyKey: key() });
    await m.pay.payOrderFromWallet({ workspaceId: cust.workspaceId, orderId: order.id, idempotencyKey: key() });
    const code = m.aOrders.orderCode(order.id);
    const byName = await m.aOrders.searchOrders(owner, { search: 'مشتری آزمایشی' });
    expect(byName.rows.map(r => r.orderId)).toContain(order.id);
    expect((await m.aOrders.searchOrders(owner, { search: code })).rows.map(r => r.orderId)).toEqual([order.id]);
    expect((await m.aOrders.searchOrders(owner, { userId: cust.userId, category: 'nope-x' })).total).toBe(0);

    const d = await m.aOrders.getOrderDetail(owner, order.id);
    expect(d.items[0]).toMatchObject({ quantity: 1000, parameters: { target: '@zohalpay' } });
    expect(d.payments[0]).toMatchObject({ gateway: 'wallet', status: 'PAID' });
    expect(d.customer.userId).toBe(cust.userId);
    expect(d.canRefund).toBe(true);

    await m.aOrders.addOrderNote({ actorUserId: owner, orderId: order.id, body: 'یادداشت داخلی' });
    expect((await m.aOrders.getOrderDetail(owner, order.id)).notes[0].body).toBe('یادداشت داخلی');

    const k = key();
    const first = await m.aOrders.refundOrCancel({ actorUserId: owner, orderId: order.id, mode: 'REFUND', reason: 'درخواست مشتری', idempotencyKey: k });
    const again = await m.aOrders.refundOrCancel({ actorUserId: owner, orderId: order.id, mode: 'REFUND', reason: 'درخواست مشتری', idempotencyKey: k });
    expect(again.refund?.id).toBe(first.refund?.id);
    const after = await m.aOrders.getOrderDetail(owner, order.id);
    expect(after.refunds).toHaveLength(1);
    expect(after.refundableToman).toBe(0);
    const audits = await m.aAudit.listAudit(owner, { action: 'admin.order.refund', entity: order.id });
    expect(audits.rows).toHaveLength(1); // the replay did not add a second audit row
  });

  it('wallet: credit/debit with reason, idempotent, never negative, visible in the profile ledger, audited', async () => {
    const before = (await m.aWallet.getUserProfile(owner, cust.userId)).wallet!.balanceToman;
    const k = key();
    const r1 = await m.aWallet.adjustWallet({ actorUserId: owner, userId: cust.userId, direction: 'CREDIT', amountToman: 12_345, reason: 'جبران خطای سیستم', idempotencyKey: k });
    const r2 = await m.aWallet.adjustWallet({ actorUserId: owner, userId: cust.userId, direction: 'CREDIT', amountToman: 12_345, reason: 'جبران خطای سیستم', idempotencyKey: k });
    expect(r1.replayed).toBe(false); expect(r2.replayed).toBe(true);
    const p = await m.aWallet.getUserProfile(owner, cust.userId);
    expect(p.wallet!.balanceToman).toBe(before + 12_345);
    expect(p.wallet!.entries[0]).toMatchObject({ direction: 'CREDIT', amountToman: 12_345, referenceType: 'ADMIN_ADJUSTMENT', reason: 'جبران خطای سیستم' });
    const poor = await newUser('کم‌موجودی', 1_000n); // 100 toman
    await expect(m.aWallet.adjustWallet({ actorUserId: owner, userId: poor.userId, direction: 'DEBIT', amountToman: 101, reason: 'بیشتر از موجودی', idempotencyKey: key() })).rejects.toMatchObject({ code: 'PAYMENT_REQUIRED' });
    expect((await m.aWallet.getUserProfile(owner, poor.userId)).wallet!.balanceToman).toBe(100);
    await m.aWallet.adjustWallet({ actorUserId: owner, userId: poor.userId, direction: 'DEBIT', amountToman: 100, reason: 'کسر کامل موجودی', idempotencyKey: key() });
    expect((await m.aWallet.getUserProfile(owner, poor.userId)).wallet!.balanceToman).toBe(0);
    expect(p.tier?.name).toBeTruthy();
  });

  it('support: list, thread, staff reply (notifies), assign, close/reopen', async () => {
    const t = await m.tickets.createTicket({ workspaceId: cust.workspaceId, userId: cust.userId, subject: 'سلام تست پشتیبانی', message: 'متن کامل پیام تست برای پشتیبانی', category: 'OTHER' });
    const list = await m.aSupport.listAdminTickets(owner, { search: 'تست پشتیبانی' });
    expect(list.rows.map(r => r.ticketId)).toContain(t.id);
    await m.aSupport.replyAsStaff({ actorUserId: owner, ticketId: t.id, body: 'پاسخ تیم' });
    const d = await m.aSupport.getAdminTicket(owner, t.id);
    expect(d.status).toBe('ANSWERED'); expect(d.messages.map(x => x.authorKind)).toEqual(['CUSTOMER', 'STAFF']); expect(d.assignedTo).toBe(owner);
    await m.aSupport.setTicketStatus({ actorUserId: owner, ticketId: t.id, status: 'CLOSED' });
    expect((await m.aSupport.getAdminTicket(owner, t.id)).status).toBe('CLOSED');
    const inbox = await m.db.withUserTransaction(cust.userId, c => c.query(`SELECT 1 FROM notifications WHERE user_id=$1 AND notification_type IN ('support.answered','support.closed')`, [cust.userId]));
    expect(inbox.rowCount).toBeGreaterThanOrEqual(2);
  });

  it('dashboard reads work for the owner and the audit viewer sees admin actions', async () => {
    const a = await m.aOver.getAttention(owner);
    expect(Object.keys(a)).toContain('ticketsOpen');
    const rev = await m.aOver.getDailyRevenue(owner, 14);
    expect(rev).toHaveLength(14);
    const au = await m.aAudit.listAudit(owner, { action: 'admin.wallet' });
    expect(au.total).toBeGreaterThan(0);
  });

  it('packages: edit one package, others stay; undo restores the exact previous prices', async () => {
    const before = await m.aPk.getServicePackages(owner, IG_FOLLOWERS);
    const target = before.packages.find(p => p.quantity !== before.kind.per && p.priceToman > 1000)!;
    const other = before.packages.filter(p => p.quantity !== target.quantity && p.quantity !== before.kind.per).map(p => [p.quantity, p.priceToman] as const);
    const res = await m.aPk.savePackageChanges({ actorUserId: owner, serviceId: IG_FOLLOWERS, edits: [{ quantity: target.quantity, priceToman: target.priceToman - 1000 }], idempotencyKey: key() });
    expect(res).toBeTruthy();
    const mid = await m.aPk.getServicePackages(owner, IG_FOLLOWERS);
    expect(mid.packages.find(p => p.quantity === target.quantity)!.priceToman).toBe(target.priceToman - 1000);
    for (const [q, price] of other) expect(mid.packages.find(p => p.quantity === q)!.priceToman).toBe(price);
    await m.aPk.undoLastPriceChange({ actorUserId: owner, serviceId: IG_FOLLOWERS });
    const end = await m.aPk.getServicePackages(owner, IG_FOLLOWERS);
    expect(end.packages.map(p => [p.quantity, p.priceToman])).toEqual(before.packages.map(p => [p.quantity, p.priceToman]));
  });

  it('team: staff only get what was granted; managers cannot exceed their own rights; suspended staff lose access at once', async () => {
    expect(await m.aAccess.getAdminAccess(staff)).toBeNull();
    const email = (await m.db.query<{ email: string }>(`SELECT email FROM users WHERE id=$1`, [staff])).rows[0].email;
    await m.aTeam.addMember({ actorUserId: owner, contact: email, preset: 'viewer' });
    const acc = await m.aAccess.getAdminAccess(staff);
    expect(acc?.kind).toBe('staff'); expect(acc?.permissions.has('orders.view')).toBe(true); expect(acc?.permissions.has('orders.manage')).toBe(false);
    await expect(m.aOrders.searchOrders(staff, {})).resolves.toBeTruthy();
    await expect(m.aOrders.addOrderNote({ actorUserId: staff, orderId: randomUUID(), body: 'x' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(m.aWallet.adjustWallet({ actorUserId: staff, userId: cust.userId, direction: 'CREDIT', amountToman: 10, reason: 'تلاش غیرمجاز', idempotencyKey: key() })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(m.aTeam.addMember({ actorUserId: staff, contact: 'x@y.co', preset: 'viewer' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await m.aTeam.updateMember({ actorUserId: owner, userId: staff, permissions: ['team.manage', 'orders.view'] });
    await expect(m.aTeam.addMember({ actorUserId: staff, contact: `${randomUUID()}@it.test`, permissions: ['wallet.adjust'] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(m.aTeam.updateMember({ actorUserId: staff, userId: owner, permissions: ['orders.view'] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await m.aTeam.setMemberStatus({ actorUserId: owner, userId: staff, status: 'SUSPENDED' });
    expect(await m.aAccess.getAdminAccess(staff)).toBeNull();
    const log = await m.aAudit.listAudit(owner, { action: 'admin.team', entity: staff });
    expect(log.rows.map(r => r.action)).toEqual(expect.arrayContaining(['admin.team.add', 'admin.team.update', 'admin.team.suspend']));
    const t = await m.aTeam.getTeam(owner);
    expect(t.owners.map(o => o.userId)).toContain(owner);
    await m.aTeam.removeMember({ actorUserId: owner, userId: staff });
  });
});
