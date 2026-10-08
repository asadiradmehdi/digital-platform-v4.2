/**
 * Money flows against a real PostgreSQL (FORCE RLS, non-superuser owner role), not mocked SQL.
 *
 * Runs only when MONEY_IT_DATABASE_URL points at a migrated + seeded database whose role is
 * NOSUPERUSER/NOBYPASSRLS (e.g. scripts used for the audit: a dedicated schema via
 * `?options=-c search_path=money_it,public`). Skipped otherwise, so the default unit run is unchanged.
 *
 * Regression coverage for the money audit: C-1/C-4 (top-up only on verified payment, converted to
 * IRR), C-2 (renewal charges the converted amount), C-3 (checkout SQL), C-4 (paid checkout delivers),
 * C-5 (gateway-paid order never touches the wallet), C-6 (one refund ledger, state machine),
 * H-3 (amount-verified gateway), H-6 (paid subscription charges), M-1 (min/max quantity).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.MONEY_IT_DATABASE_URL;
if (URL) process.env.DATABASE_URL = URL;

const IG_FOLLOWERS = '10000000-0000-0000-0000-000000000001'; // min quantity 100; unit price read from the seed
const BASIC_PLAN = '20000000-0000-0000-0000-000000000002'; // 9,900,000 IRT

type Mods = {
  db: typeof import('../../server/core/db');
  pay: typeof import('../../server/payments/service');
  refund: typeof import('../../server/payments/refund');
  orders: typeof import('../../server/commerce/orders');
  checkout: typeof import('../../server/commerce/checkout');
  subs: typeof import('../../server/subscriptions/service');
  renewal: typeof import('../../server/subscriptions/renewal');
  mock: typeof import('../../server/payments/mock-gateway');
};

describe.runIf(Boolean(URL))('money flows on real PostgreSQL (RLS enforced)', () => {
  let m: Mods;
  const key = () => `it-${randomUUID()}`;
  let unit = 0n; // IRT per unit of IG_FOLLOWERS
  const orderIrt = () => 1000n * unit; // a 1000-unit order, IRT
  const orderIrr = () => orderIrt() * 10n; // the same order in wallet IRR

  async function newWorkspace(balanceIrr = 0n) {
    const userId = randomUUID(); const workspaceId = randomUUID();
    await m.db.withTenantTransaction(workspaceId, userId, async c => {
      await c.query(`INSERT INTO users(id,email,display_name) VALUES($1,$2,'it')`, [userId, `${userId}@it.test`]);
      await c.query(`INSERT INTO workspaces(id,owner_user_id,name,slug) VALUES($1,$2,'it',$3)`, [workspaceId, userId, `it-${workspaceId.slice(0, 8)}`]);
      await c.query(`INSERT INTO workspace_members(workspace_id,user_id,joined_at) VALUES($1,$2,now())`, [workspaceId, userId]);
      const w = await c.query<{ id: string }>(`INSERT INTO wallets(workspace_id,currency) VALUES($1,'IRR') RETURNING id`, [workspaceId]);
      const a = await c.query<{ id: string }>(`INSERT INTO ledger_accounts(wallet_id,account_code) VALUES($1,'MAIN') RETURNING id`, [w.rows[0].id]);
      if (balanceIrr > 0n) await c.query(`INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,idempotency_key) VALUES($1,'CREDIT',$2,'IRR','SEED',$3)`, [a.rows[0].id, balanceIrr.toString(), key()]);
    });
    return { userId, workspaceId };
  }

  async function wallet(workspaceId: string) {
    return m.db.withWorkspaceTransaction(workspaceId, undefined, async c => {
      const r = await c.query<{ balance: string; currencies: string[] }>(
        `SELECT COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE -le.amount_minor END),0)::text AS balance,
                COALESCE(array_agg(DISTINCT le.currency) FILTER (WHERE le.id IS NOT NULL), '{}') AS currencies
         FROM wallets w JOIN ledger_accounts la ON la.wallet_id=w.id LEFT JOIN ledger_entries le ON le.account_id=la.id
         WHERE w.workspace_id=$1`, [workspaceId]);
      return { balance: BigInt(r.rows[0].balance), currencies: r.rows[0].currencies.map(x => x.trim()) };
    });
  }

  async function one<T extends Record<string, unknown>>(workspaceId: string, sql: string, values: unknown[]) {
    return m.db.withWorkspaceTransaction(workspaceId, undefined, async c => (await c.query<T>(sql, values)).rows[0]);
  }

  beforeAll(async () => {
    m = {
      db: await import('../../server/core/db'),
      pay: await import('../../server/payments/service'),
      refund: await import('../../server/payments/refund'),
      orders: await import('../../server/commerce/orders'),
      checkout: await import('../../server/commerce/checkout'),
      subs: await import('../../server/subscriptions/service'),
      renewal: await import('../../server/subscriptions/renewal'),
      mock: await import('../../server/payments/mock-gateway'),
    };
    const role = await m.db.query<{ rolsuper: boolean; rolbypassrls: boolean }>(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const price = await m.db.query<{ unit_price_minor: string }>(`SELECT unit_price_minor::text AS unit_price_minor FROM service_prices WHERE service_id=$1 AND active AND currency='IRT' ORDER BY effective_from DESC LIMIT 1`, [IG_FOLLOWERS]);
    unit = BigInt(price.rows[0].unit_price_minor);
    expect(unit).toBeGreaterThan(0n);
  });
  afterAll(async () => { await m?.db.db().end(); });

  it('C-3/M-1: createCheckout inserts a session and enforces the service min quantity', async () => {
    const { workspaceId } = await newWorkspace();
    const s = await m.checkout.createCheckout({ workspaceId, items: [{ serviceId: IG_FOLLOWERS, quantity: 1000n }], idempotencyKey: key() });
    expect(s.status).toBe('OPEN');
    expect(String(s.total_minor)).toBe(orderIrt().toString());
    await expect(m.checkout.createCheckout({ workspaceId, items: [{ serviceId: IG_FOLLOWERS, quantity: 1n }], idempotencyKey: key() })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(m.orders.createOrder({ workspaceId, serviceId: IG_FOLLOWERS, quantity: 1n, parameters: {}, idempotencyKey: key() })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('C-5: an order paid directly by gateway becomes PAID once and never touches the wallet', async () => {
    const { workspaceId } = await newWorkspace(5_000_000n);
    const order = await m.orders.createOrder({ workspaceId, serviceId: IG_FOLLOWERS, quantity: 1000n, parameters: { target: 'x' }, idempotencyKey: key() });
    const intent = await m.pay.payOrderByGateway({ workspaceId, orderId: order.id, gateway: m.mock.mockGateway, callbackUrl: 'http://localhost/cb', idempotencyKey: key() });
    const p = await one<{ status: string; amount_minor: string; currency: string; purpose: string }>(workspaceId, `SELECT status,amount_minor::text AS amount_minor,currency,purpose FROM payments WHERE id=$1`, [intent.paymentId]);
    expect(p).toMatchObject({ status: 'PENDING', amount_minor: orderIrt().toString(), currency: 'IRT', purpose: 'ORDER' });
    expect((await one<{ status: string }>(workspaceId, `SELECT status FROM orders WHERE id=$1`, [order.id]))!.status).toBe('PAYMENT_PENDING');

    expect(await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway })).toMatchObject({ verified: true, alreadyPaid: false });
    expect(await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway })).toMatchObject({ verified: true, alreadyPaid: true });
    expect((await one<{ status: string }>(workspaceId, `SELECT status FROM orders WHERE id=$1`, [order.id]))!.status).toBe('PAID');
    expect((await wallet(workspaceId)).balance).toBe(5_000_000n);
  });

  it('a second payment for an already-paid order is kept as wallet balance (IRR), not charged twice', async () => {
    const { workspaceId } = await newWorkspace(20_000_000n);
    const order = await m.orders.createOrder({ workspaceId, serviceId: IG_FOLLOWERS, quantity: 1000n, parameters: {}, idempotencyKey: key() });
    const intent = await m.pay.payOrderByGateway({ workspaceId, orderId: order.id, gateway: m.mock.mockGateway, callbackUrl: 'http://localhost/cb', idempotencyKey: key() });
    await m.pay.payOrderFromWallet({ workspaceId, orderId: order.id, idempotencyKey: key() }); // −orderIrr
    await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway }); // +orderIrr
    const w = await wallet(workspaceId);
    expect(w.balance).toBe(20_000_000n);
    expect(w.currencies).toEqual(['IRR']);
    const p = await one<{ purpose: string; order_id: string | null }>(workspaceId, `SELECT purpose,order_id FROM payments WHERE id=$1`, [intent.paymentId]);
    expect(p).toEqual({ purpose: 'TOPUP', order_id: null });
  });

  it('C-1/C-4: a top-up credits only after verification, once, converted to IRR', async () => {
    const { workspaceId } = await newWorkspace();
    const intent = await m.pay.beginCheckout({ workspaceId, purpose: 'TOPUP', amountMinor: 500_000n, currency: 'IRT', gateway: m.mock.mockGateway, callbackUrl: 'http://localhost/cb', idempotencyKey: key() });
    expect((await wallet(workspaceId)).balance).toBe(0n);
    await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway });
    await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway });
    await m.pay.markPaymentPaid({ paymentId: intent.paymentId, workspaceId, gatewayReference: `mock_${intent.paymentId}` });
    expect(await wallet(workspaceId)).toEqual({ balance: 5_000_000n, currencies: ['IRR'] });
  });

  it('webhook/callback path: a gateway reference is located across tenants and verified by its own gateway', async () => {
    const { workspaceId } = await newWorkspace();
    const intent = await m.pay.beginCheckout({ workspaceId, purpose: 'TOPUP', amountMinor: 100_000n, currency: 'IRT', gateway: m.mock.mockGateway, callbackUrl: 'http://localhost/cb', idempotencyKey: key() });
    const other = { ...m.mock.mockGateway, name: 'other' };
    expect(await m.pay.confirmPaymentByGatewayReference({ gatewayReference: intent.gatewayReference!, gateway: other })).toMatchObject({ verified: false, reason: 'GATEWAY_MISMATCH' });
    expect(await m.pay.confirmPaymentByGatewayReference({ gatewayReference: intent.gatewayReference!, gateway: m.mock.mockGateway })).toMatchObject({ verified: true, workspaceId });
    expect((await wallet(workspaceId)).balance).toBe(1_000_000n);
  });

  it('H-3: a gateway reporting a different amount does not mark the payment paid', async () => {
    const { workspaceId } = await newWorkspace();
    const intent = await m.pay.beginCheckout({ workspaceId, purpose: 'TOPUP', amountMinor: 500_000n, currency: 'IRT', gateway: m.mock.mockGateway, callbackUrl: 'http://localhost/cb', idempotencyKey: key() });
    const short = { ...m.mock.mockGateway, verify: async () => ({ paid: true, amountMinor: 1_000n, currency: 'IRT' }) };
    expect(await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: short })).toMatchObject({ verified: false, reason: 'AMOUNT_MISMATCH' });
    expect((await one<{ status: string }>(workspaceId, `SELECT status FROM payments WHERE id=$1`, [intent.paymentId]))!.status).toBe('PENDING');
    expect((await wallet(workspaceId)).balance).toBe(0n);
  });

  it('C-4: a paid plan checkout creates the subscription and leaves the wallet untouched', async () => {
    const { workspaceId } = await newWorkspace(1_000n);
    const s = await m.checkout.createCheckout({ workspaceId, items: [{ planId: BASIC_PLAN, quantity: 1n }], idempotencyKey: key() });
    const intent = await m.pay.beginCheckout({ workspaceId, purpose: 'CHECKOUT', checkoutSessionId: String(s.id), amountMinor: BigInt(s.total_minor), currency: String(s.currency), gateway: m.mock.mockGateway, callbackUrl: 'http://localhost/cb', idempotencyKey: key() });
    await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway });
    expect((await one<{ status: string }>(workspaceId, `SELECT status FROM checkout_sessions WHERE id=$1`, [s.id]))!.status).toBe('PAID');
    const sub = await one<{ status: string; price_minor: string; currency: string }>(workspaceId, `SELECT status,price_minor::text AS price_minor,currency FROM subscriptions WHERE workspace_id=$1`, [workspaceId]);
    expect(sub).toEqual({ status: 'ACTIVE', price_minor: '9900000', currency: 'IRT' });
    expect((await wallet(workspaceId)).balance).toBe(1_000n);
  });

  it('C-4: a paid service checkout creates one PAID order for the session total', async () => {
    const { workspaceId } = await newWorkspace();
    const s = await m.checkout.createCheckout({ workspaceId, items: [{ serviceId: IG_FOLLOWERS, quantity: 200n }], idempotencyKey: key() });
    const intent = await m.pay.beginCheckout({ workspaceId, purpose: 'CHECKOUT', checkoutSessionId: String(s.id), amountMinor: BigInt(s.total_minor), currency: 'IRT', gateway: m.mock.mockGateway, callbackUrl: 'http://localhost/cb', idempotencyKey: key() });
    await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway });
    const o = await one<{ status: string; total_minor: string }>(workspaceId, `SELECT o.status,o.total_minor::text AS total_minor FROM orders o JOIN payments p ON p.order_id=o.id WHERE p.id=$1`, [intent.paymentId]);
    expect(o).toEqual({ status: 'PAID', total_minor: (200n * unit).toString() });
    expect((await wallet(workspaceId)).balance).toBe(0n);
  });

  it('C-6: refund then cancel never refunds twice, and a full refund stops delivery', async () => {
    const { workspaceId, userId } = await newWorkspace(orderIrr());
    const order = await m.orders.createOrder({ workspaceId, serviceId: IG_FOLLOWERS, quantity: 1000n, parameters: {}, idempotencyKey: key() });
    await m.pay.payOrderFromWallet({ workspaceId, orderId: order.id, idempotencyKey: key() });
    expect((await wallet(workspaceId)).balance).toBe(0n);
    await expect(m.refund.refundOrder({ workspaceId, orderId: order.id, mode: 'REFUND', idempotencyKey: null, actorUserId: userId })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const k = key();
    const r1 = await m.refund.refundOrder({ workspaceId, orderId: order.id, mode: 'REFUND', idempotencyKey: k, actorUserId: userId });
    expect(r1).toMatchObject({ orderStatus: 'REFUNDED', refund: { status: 'PAID', amountMinor: orderIrt().toString(), destination: 'WALLET' } });
    const again = await m.refund.refundOrder({ workspaceId, orderId: order.id, mode: 'REFUND', idempotencyKey: k, actorUserId: userId });
    expect(again.refund?.id).toBe(r1.refund?.id);
    await expect(m.refund.refundOrder({ workspaceId, orderId: order.id, mode: 'CANCEL', idempotencyKey: key(), actorUserId: userId })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(m.refund.refundOrder({ workspaceId, orderId: order.id, mode: 'REFUND', idempotencyKey: key(), actorUserId: userId })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await wallet(workspaceId)).toEqual({ balance: orderIrr(), currencies: ['IRR'] });
    const p = await one<{ status: string }>(workspaceId, `SELECT status FROM payments WHERE order_id=$1`, [order.id]);
    expect(p!.status).toBe('REFUNDED');
  });

  it('C-6: cancel is refused once the order reached the provider; unpaid orders cancel without money', async () => {
    const { workspaceId, userId } = await newWorkspace(2n * orderIrr());
    const order = await m.orders.createOrder({ workspaceId, serviceId: IG_FOLLOWERS, quantity: 1000n, parameters: {}, idempotencyKey: key() });
    await m.pay.payOrderFromWallet({ workspaceId, orderId: order.id, idempotencyKey: key() });
    await m.orders.transitionOrder(order.id, workspaceId, 'QUEUED');
    await m.orders.transitionOrder(order.id, workspaceId, 'PROCESSING');
    await expect(m.refund.refundOrder({ workspaceId, orderId: order.id, mode: 'CANCEL', idempotencyKey: key(), actorUserId: userId })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await wallet(workspaceId)).balance).toBe(orderIrr());

    const unpaid = await m.orders.createOrder({ workspaceId, serviceId: IG_FOLLOWERS, quantity: 1000n, parameters: {}, idempotencyKey: key() });
    const c = await m.refund.refundOrder({ workspaceId, orderId: unpaid.id, mode: 'CANCEL', idempotencyKey: key(), actorUserId: userId });
    expect(c).toMatchObject({ orderStatus: 'CANCELLED', refund: null });
    expect((await wallet(workspaceId)).balance).toBe(orderIrr());
  });

  it('H-6: a paid plan subscription is charged (converted to IRR) or refused with 402', async () => {
    const poor = await newWorkspace(1_000n);
    await expect(m.subs.createSubscription({ workspaceId: poor.workspaceId, planId: BASIC_PLAN, idempotencyKey: key() })).rejects.toMatchObject({ code: 'PAYMENT_REQUIRED' });
    expect(await one(poor.workspaceId, `SELECT id FROM subscriptions WHERE workspace_id=$1`, [poor.workspaceId])).toBeUndefined();

    const rich = await newWorkspace(100_000_000n);
    const k = key();
    await m.subs.createSubscription({ workspaceId: rich.workspaceId, planId: BASIC_PLAN, idempotencyKey: k });
    await m.subs.createSubscription({ workspaceId: rich.workspaceId, planId: BASIC_PLAN, idempotencyKey: k });
    expect(await wallet(rich.workspaceId)).toEqual({ balance: 1_000_000n, currencies: ['IRR'] });
  });

  it('C-2: renewal charges the plan price converted into the wallet currency', async () => {
    const { workspaceId } = await newWorkspace(100_000_000n);
    const sub = await m.db.withWorkspaceTransaction(workspaceId, undefined, async c => (await c.query<{ id: string }>(
      `INSERT INTO subscriptions(workspace_id,plan_id,status,current_period_start,current_period_end,idempotency_key,price_minor,currency)
       VALUES($1,$2,'ACTIVE',now()-interval '31 days',now()-interval '1 day',$3,9900000,'IRT') RETURNING id`, [workspaceId, BASIC_PLAN, key()])).rows[0]);
    expect(await m.renewal.processSubscriptionRenewal(sub.id, workspaceId)).toMatchObject({ status: 'RENEWED' });
    expect(await wallet(workspaceId)).toEqual({ balance: 1_000_000n, currencies: ['IRR'] });
  });
});
