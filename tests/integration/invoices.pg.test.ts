/**
 * Invoice documents against a real PostgreSQL (FORCE RLS, non-superuser owner role).
 *
 * Runs only when MONEY_IT_DATABASE_URL points at a migrated + seeded database (see
 * money-flows.pg.test.ts). Proves, with real SQL and real policies:
 *  - every successful payment issues exactly one document, in the payment's transaction, and a
 *    replayed verification / wallet payment never issues a second one;
 *  - a top-up is a TOPUP_RECEIPT, an order or subscription a SALE (wallet or gateway);
 *  - VAT is 0 / no rate by default and floor(total × r/(1+r)) when the platform switch is on;
 *  - another workspace cannot read the document or its lines; the buyer gets an inbox entry.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.MONEY_IT_DATABASE_URL;
if (URL) process.env.DATABASE_URL = URL;
process.env.PAYMENTS_MOCK_ALLOWED ??= 'true';

const IG_FOLLOWERS = '10000000-0000-0000-0000-000000000001';
const BASIC_PLAN = '20000000-0000-0000-0000-000000000002'; // 9,900,000 IRT

type Mods = {
  db: typeof import('../../server/core/db');
  pay: typeof import('../../server/payments/service');
  inv: typeof import('../../server/payments/invoice');
  orders: typeof import('../../server/commerce/orders');
  subs: typeof import('../../server/subscriptions/service');
  mock: typeof import('../../server/payments/mock-gateway');
};

describe.runIf(Boolean(URL))('invoices on real PostgreSQL (RLS enforced)', () => {
  let m: Mods;
  let unit = 0n;
  const key = () => `it-${randomUUID()}`;

  async function newWorkspace(balanceIrr = 0n) {
    const userId = randomUUID(); const workspaceId = randomUUID();
    await m.db.withTenantTransaction(workspaceId, userId, async c => {
      await c.query(`INSERT INTO users(id,email,phone,display_name) VALUES($1,$2,$3,'مشتری آزمایشی')`, [userId, `${userId}@it.test`, `09${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`]);
      await c.query(`INSERT INTO workspaces(id,owner_user_id,name,slug) VALUES($1,$2,'it',$3)`, [workspaceId, userId, `it-${workspaceId.slice(0, 8)}`]);
      await c.query(`INSERT INTO workspace_members(workspace_id,user_id,joined_at) VALUES($1,$2,now())`, [workspaceId, userId]);
      const w = await c.query<{ id: string }>(`INSERT INTO wallets(workspace_id,currency) VALUES($1,'IRR') RETURNING id`, [workspaceId]);
      const a = await c.query<{ id: string }>(`INSERT INTO ledger_accounts(wallet_id,account_code) VALUES($1,'MAIN') RETURNING id`, [w.rows[0].id]);
      if (balanceIrr > 0n) await c.query(`INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,idempotency_key) VALUES($1,'CREDIT',$2,'IRR','SEED',$3)`, [a.rows[0].id, balanceIrr.toString(), key()]);
    });
    return { userId, workspaceId };
  }

  async function docs(workspaceId: string) {
    return m.db.withWorkspaceTransaction(workspaceId, undefined, async c => (await c.query<{ id: string; document_type: string; total_minor: string; vat_minor: string; vat_rate_bps: number | null; payment_method: string; payment_reference: string | null; order_id: string | null; payment_id: string | null; subscription_id: string | null; buyer_name: string; currency: string; title: string }>(
      `SELECT id,document_type,total_minor::text AS total_minor,vat_minor::text AS vat_minor,vat_rate_bps,payment_method,payment_reference,order_id,payment_id,subscription_id,buyer_name,currency,title
       FROM invoices WHERE workspace_id=$1 ORDER BY created_at`, [workspaceId])).rows);
  }

  async function setVat(enabled: boolean) {
    await m.db.query(`UPDATE invoice_settings SET vat_enabled=$1, vat_rate_bps=1000 WHERE id=1`, [enabled]);
  }

  beforeAll(async () => {
    m = {
      db: await import('../../server/core/db'),
      pay: await import('../../server/payments/service'),
      inv: await import('../../server/payments/invoice'),
      orders: await import('../../server/commerce/orders'),
      subs: await import('../../server/subscriptions/service'),
      mock: await import('../../server/payments/mock-gateway'),
    };
    const role = await m.db.query<{ rolsuper: boolean; rolbypassrls: boolean }>(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const price = await m.db.query<{ unit_price_minor: string }>(`SELECT unit_price_minor::text AS unit_price_minor FROM service_prices WHERE service_id=$1 AND active AND currency='IRT' ORDER BY effective_from DESC LIMIT 1`, [IG_FOLLOWERS]);
    unit = BigInt(price.rows[0].unit_price_minor);
    await setVat(false);
  });
  afterAll(async () => { await setVat(false).catch(() => undefined); await m?.db.db().end(); });

  it('a verified top-up issues one TOPUP_RECEIPT (no VAT); replaying the verification issues nothing more', async () => {
    const { workspaceId, userId } = await newWorkspace();
    const intent = await m.pay.beginCheckout({ workspaceId, purpose: 'TOPUP', amountMinor: 500_000n, currency: 'IRT', gateway: m.mock.mockGateway, callbackUrl: 'http://localhost/cb', idempotencyKey: key() });
    await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway });
    await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway });
    await m.pay.confirmPaymentByGatewayReference({ gatewayReference: intent.gatewayReference!, gateway: m.mock.mockGateway });
    const d = await docs(workspaceId);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ document_type: 'TOPUP_RECEIPT', total_minor: '500000', vat_minor: '0', vat_rate_bps: null, payment_method: 'GATEWAY', payment_reference: intent.gatewayReference, payment_id: intent.paymentId, currency: 'IRT', buyer_name: 'مشتری آزمایشی' });
    // The owner's inbox (user scope, 0032) links to the document.
    const inbox = await m.db.withUserTransaction(userId, c => c.query<{ payload: { href: string } }>(`SELECT payload FROM notifications WHERE user_id=$1 AND notification_type='invoice.issued'`, [userId]));
    expect(inbox.rows.map(r => r.payload.href)).toEqual([`/invoices/${d[0].id}`]);
  });

  it('a wallet-paid order issues one SALE invoice (WALLET); a retried wallet payment issues nothing more', async () => {
    const { workspaceId } = await newWorkspace(100_000_000n);
    const order = await m.orders.createOrder({ workspaceId, serviceId: IG_FOLLOWERS, quantity: 1000n, parameters: { target: 'owner@example.com' }, idempotencyKey: key() });
    const k = key();
    await m.pay.payOrderFromWallet({ workspaceId, orderId: order.id, idempotencyKey: k });
    await m.pay.payOrderFromWallet({ workspaceId, orderId: order.id, idempotencyKey: k });
    await m.pay.payOrderFromWallet({ workspaceId, orderId: order.id, idempotencyKey: key() });
    const d = await docs(workspaceId);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ document_type: 'SALE', order_id: order.id, payment_method: 'WALLET', total_minor: (1000n * unit).toString(), vat_minor: '0' });
    expect(d[0].payment_id).toBeTruthy();
    const full = await m.inv.getInvoice(workspaceId, d[0].id);
    expect(full.items).toHaveLength(1);
    expect(full.items[0]).toMatchObject({ description: 'فالوور اینستاگرام', quantity: '1000', unitPriceMinor: unit.toString() });
    expect(full.items[0].metadata).toMatchObject({ target: 'ow•••@example.com', quantityWords: '۱ هزار' });
  });

  it('a gateway-paid order issues one SALE invoice with the gateway reference; replayed verification issues nothing more', async () => {
    const { workspaceId } = await newWorkspace();
    const order = await m.orders.createOrder({ workspaceId, serviceId: IG_FOLLOWERS, quantity: 1000n, parameters: { target: '@zohalpay' }, idempotencyKey: key() });
    const intent = await m.pay.payOrderByGateway({ workspaceId, orderId: order.id, gateway: m.mock.mockGateway, callbackUrl: 'http://localhost/cb', idempotencyKey: key() });
    await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway });
    await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway });
    const d = await docs(workspaceId);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ document_type: 'SALE', order_id: order.id, payment_id: intent.paymentId, payment_method: 'GATEWAY', payment_reference: intent.gatewayReference });
  });

  it('a second payment for an already-paid order becomes a top-up receipt, not a second sale invoice', async () => {
    const { workspaceId } = await newWorkspace(100_000_000n);
    const order = await m.orders.createOrder({ workspaceId, serviceId: IG_FOLLOWERS, quantity: 1000n, parameters: {}, idempotencyKey: key() });
    const intent = await m.pay.payOrderByGateway({ workspaceId, orderId: order.id, gateway: m.mock.mockGateway, callbackUrl: 'http://localhost/cb', idempotencyKey: key() });
    await m.pay.payOrderFromWallet({ workspaceId, orderId: order.id, idempotencyKey: key() });
    await m.pay.verifyPayment({ paymentId: intent.paymentId, workspaceId, gateway: m.mock.mockGateway });
    const d = await docs(workspaceId);
    expect(d.map(x => x.document_type)).toEqual(['SALE', 'TOPUP_RECEIPT']);
    expect(d[1]).toMatchObject({ order_id: null, payment_id: intent.paymentId });
  });

  it('VAT switch on: the sale invoice breaks out floor(total × 10/110) inside the same total', async () => {
    const { workspaceId } = await newWorkspace(100_000_000n);
    await setVat(true);
    try {
      const order = await m.orders.createOrder({ workspaceId, serviceId: IG_FOLLOWERS, quantity: 1000n, parameters: {}, idempotencyKey: key() });
      await m.pay.payOrderFromWallet({ workspaceId, orderId: order.id, idempotencyKey: key() });
    } finally { await setVat(false); }
    const [d] = await docs(workspaceId);
    const total = 1000n * unit;
    expect(d).toMatchObject({ total_minor: total.toString(), vat_minor: ((total * 1000n) / 11000n).toString(), vat_rate_bps: 1000 });
  });

  it('a wallet-paid subscription issues one SALE invoice for the plan', async () => {
    const { workspaceId } = await newWorkspace(200_000_000n);
    const k = key();
    const sub = await m.subs.createSubscription({ workspaceId, planId: BASIC_PLAN, idempotencyKey: k });
    await m.subs.createSubscription({ workspaceId, planId: BASIC_PLAN, idempotencyKey: k });
    const d = await docs(workspaceId);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ document_type: 'SALE', subscription_id: sub.id, payment_method: 'WALLET', total_minor: '9900000', title: 'اشتراک پایه' });
  });

  it('another workspace can read neither the invoice nor its lines', async () => {
    const a = await newWorkspace(100_000_000n);
    const b = await newWorkspace();
    const order = await m.orders.createOrder({ workspaceId: a.workspaceId, serviceId: IG_FOLLOWERS, quantity: 1000n, parameters: {}, idempotencyKey: key() });
    await m.pay.payOrderFromWallet({ workspaceId: a.workspaceId, orderId: order.id, idempotencyKey: key() });
    const [d] = await docs(a.workspaceId);
    await expect(m.inv.getInvoice(b.workspaceId, d.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const lines = await m.db.withWorkspaceTransaction(b.workspaceId, undefined, c => c.query(`SELECT id FROM invoice_items WHERE invoice_id=$1`, [d.id]));
    expect(lines.rows).toHaveLength(0);
    const pool = await m.db.query(`SELECT id FROM invoice_items WHERE invoice_id=$1`, [d.id]);
    expect(pool.rows).toHaveLength(0); // no tenant context: nothing visible
    expect((await m.inv.listInvoices(b.workspaceId)).items).toHaveLength(0);
  });
});
