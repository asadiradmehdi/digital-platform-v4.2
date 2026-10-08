/**
 * Invoice documents («فاکتورها»): issued on the caller's payment transaction, once per source key,
 * with VAT broken out only when the platform setting enables it, and an in-app notification for the
 * buyer. Reads go through the workspace transaction (FORCE RLS).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withWorkspaceTransaction: vi.fn(async (_wid: string, _opts: unknown, fn: (c: unknown) => unknown) => fn({ query })) };
});

import { withWorkspaceTransaction } from '../../server/core/db';
import * as db from '../../server/core/db';
import { getInvoice, issueInvoice, issueOrderInvoice, issueSubscriptionInvoice, issueTopupReceipt, listInvoices } from '../../server/payments/invoice';

const mockTx = vi.mocked(withWorkspaceTransaction);
const mockQuery = vi.mocked(db.query);

type Call = { sql: string; values: unknown[] };

/** A fake tenant-transaction client answering by statement. */
function fakeClient(opts: { existing?: { id: string; invoice_number: string }; vatEnabled?: boolean; vatRateBps?: number; owner?: boolean; order?: { currency: string; discount_minor: string }; orderItems?: Array<Record<string, unknown>>; sub?: Record<string, unknown> } = {}) {
  const calls: Call[] = [];
  const client = {
    query: vi.fn(async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      if (sql.includes('FROM invoices') && sql.includes('source_key=$2')) return { rows: opts.existing ? [opts.existing] : [] };
      if (sql.includes('FROM invoice_settings')) return { rows: [{ seller_legal_name: '', seller_national_id: '', seller_economic_code: '', seller_address: '', seller_postal_code: '', seller_phone: '', vat_enabled: opts.vatEnabled ?? false, vat_rate_bps: opts.vatRateBps ?? 1000 }] };
      if (sql.includes('FROM workspaces w JOIN users u')) return { rows: opts.owner === false ? [] : [{ user_id: 'user-1', display_name: 'علی', phone: '09121234567', email: null }] };
      if (sql.includes('app_next_invoice_number')) return { rows: [{ n: 'INV-2026-000042' }] };
      if (sql.includes('INSERT INTO invoices(')) return { rows: [{ id: 'inv-1' }] };
      if (sql.includes('FROM orders WHERE id=$1')) return { rows: opts.order ? [{ id: 'ord-1', ...opts.order }] : [] };
      if (sql.includes('FROM order_items oi')) return { rows: opts.orderItems ?? [] };
      if (sql.includes('FROM subscriptions s JOIN plans p')) return { rows: opts.sub ? [opts.sub] : [] };
      return { rows: [], rowCount: 1 };
    }),
  };
  return { client: client as unknown as Parameters<typeof issueInvoice>[0], calls, insert: () => calls.find(c => c.sql.includes('INSERT INTO invoices('))! };
}

const COLS = ['workspace_id', 'invoice_number', 'document_type', 'source_key', 'title', 'currency', 'subtotal_minor', 'discount_minor', 'total_minor', 'vat_minor', 'vat_rate_bps'];
const col = (c: Call, name: string) => c.values[COLS.indexOf(name)];

const line = (total: bigint) => ({ description: 'فالوور اینستاگرام', quantity: 1n, unitPriceMinor: total, totalMinor: total });

beforeEach(() => vi.clearAllMocks());

describe('issueInvoice', () => {
  it('returns the existing document for a repeated source key and writes nothing (idempotent)', async () => {
    const f = fakeClient({ existing: { id: 'inv-0', invoice_number: 'INV-2026-000001' } });
    const r = await issueInvoice(f.client, { workspaceId: 'ws-1', type: 'SALE', sourceKey: 'order:ord-1', title: 't', lines: [line(1000n)], orderId: 'ord-1', paymentMethod: 'WALLET' });
    expect(r).toEqual({ id: 'inv-0', invoiceNumber: 'INV-2026-000001', created: false });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].values).toEqual(['ws-1', 'order:ord-1', null, 'ord-1']);
  });

  it('VAT disabled (default): no VAT amount, no rate — the document makes no tax claim', async () => {
    const f = fakeClient({ vatEnabled: false });
    const r = await issueInvoice(f.client, { workspaceId: 'ws-1', type: 'SALE', sourceKey: 'order:ord-1', title: 't', lines: [line(1_800_000n)], paymentMethod: 'GATEWAY' });
    expect(r).toMatchObject({ id: 'inv-1', invoiceNumber: 'INV-2026-000042', created: true });
    const ins = f.insert();
    expect(col(ins, 'total_minor')).toBe('1800000');
    expect(col(ins, 'vat_minor')).toBe('0');
    expect(col(ins, 'vat_rate_bps')).toBeNull();
    expect(col(ins, 'currency')).toBe('IRT');
  });

  it('VAT enabled at 10%: breaks out total × rate/(1+rate), rounded down, inside the same total', async () => {
    const f = fakeClient({ vatEnabled: true, vatRateBps: 1000 });
    await issueInvoice(f.client, { workspaceId: 'ws-1', type: 'SALE', sourceKey: 'order:ord-1', title: 't', lines: [line(1_100_005n)], paymentMethod: 'GATEWAY' });
    const ins = f.insert();
    expect(col(ins, 'total_minor')).toBe('1100005'); // the price is final: VAT is not added on top
    expect(col(ins, 'vat_minor')).toBe('100000'); // floor(1 100 005 / 11)
    expect(col(ins, 'vat_rate_bps')).toBe(1000);
  });

  it('VAT applies after the discount', async () => {
    const f = fakeClient({ vatEnabled: true, vatRateBps: 1000 });
    await issueInvoice(f.client, { workspaceId: 'ws-1', type: 'SALE', sourceKey: 'order:ord-1', title: 't', lines: [line(1_210_000n)], discountMinor: 110_000n, paymentMethod: 'GATEWAY' });
    expect(col(f.insert(), 'vat_minor')).toBe('100000');
  });

  it('a top-up receipt never carries VAT, even when VAT is enabled', async () => {
    const f = fakeClient({ vatEnabled: true, vatRateBps: 1000 });
    await issueTopupReceipt(f.client, { workspaceId: 'ws-1', paymentId: 'pay-1', amountMinor: 500_000n, currency: 'IRT', reference: 'mock_pay-1', reason: 'TOPUP' });
    const ins = f.insert();
    expect(col(ins, 'document_type')).toBe('TOPUP_RECEIPT');
    expect(col(ins, 'source_key')).toBe('payment:pay-1');
    expect(col(ins, 'vat_minor')).toBe('0');
    expect(col(ins, 'vat_rate_bps')).toBeNull();
    expect(ins.values).toContain('mock_pay-1');
  });

  it('keeps documents in toman: an IRR amount is converted (÷10)', async () => {
    const f = fakeClient();
    await issueTopupReceipt(f.client, { workspaceId: 'ws-1', paymentId: 'pay-1', amountMinor: 5_000_000n, currency: 'IRR', reference: 'r', reason: 'TOPUP' });
    expect(col(f.insert(), 'total_minor')).toBe('500000');
    expect(col(f.insert(), 'currency')).toBe('IRT');
  });

  it('notifies the buyer in-app with a link to the document', async () => {
    const f = fakeClient();
    await issueInvoice(f.client, { workspaceId: 'ws-1', type: 'SALE', sourceKey: 'order:ord-1', title: '۲ هزار فالوور اینستاگرام', lines: [line(90_000n)], paymentMethod: 'WALLET' });
    const n = f.calls.find(c => c.sql.includes('INSERT INTO notifications'))!;
    expect(n.sql).toContain("'invoice.issued'");
    expect(n.values.slice(0, 2)).toEqual(['ws-1', 'user-1']);
    expect(n.values[2]).toMatchObject({ href: '/invoices/inv-1', invoiceId: 'inv-1', title: 'فاکتور خرید شما صادر شد', body: '۲ هزار فالوور اینستاگرام · ۹۰٬۰۰۰ تومان' });
  });

  it('writes no notification when the workspace owner is unknown', async () => {
    const f = fakeClient({ owner: false });
    await issueInvoice(f.client, { workspaceId: 'ws-1', type: 'SALE', sourceKey: 'order:ord-1', title: 't', lines: [line(1n)], paymentMethod: 'WALLET' });
    expect(f.calls.some(c => c.sql.includes('INSERT INTO notifications'))).toBe(false);
  });

  it('refuses a negative total (discount larger than the lines)', async () => {
    const f = fakeClient();
    await expect(issueInvoice(f.client, { workspaceId: 'ws-1', type: 'SALE', sourceKey: 'k', title: 't', lines: [line(5000n)], discountMinor: 9999n, paymentMethod: 'WALLET' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(f.calls.some(c => c.sql.includes('INSERT INTO invoices('))).toBe(false);
  });
});

describe('issueOrderInvoice', () => {
  it('lists the Persian service name, quantity in words, unit price, masked e-mail target and the tracking code', async () => {
    const f = fakeClient({
      order: { currency: 'IRT', discount_minor: '0' },
      orderItems: [{ quantity: '2000', unit_price_minor: '45', total_minor: '90000', parameters: { target: 'ali.rezaei@gmail.com' }, name: 'فالوور اینستاگرام', slug: 'ig-followers', product_slug: 'instagram' }],
    });
    await issueOrderInvoice(f.client, { workspaceId: 'ws-1', orderId: 'ord-1', paymentId: 'pay-1', method: 'WALLET' });
    const ins = f.insert();
    expect(col(ins, 'source_key')).toBe('order:ord-1');
    expect(col(ins, 'title')).toBe('۲ هزار فالوور اینستاگرام');
    const item = f.calls.find(c => c.sql.includes('INSERT INTO invoice_items'))!;
    expect(item.values.slice(0, 6)).toEqual(['inv-1', 1, 'فالوور اینستاگرام', '2000', '45', '90000']);
    expect(item.values[7]).toMatchObject({ target: 'al•••@gmail.com', quantityWords: '۲ هزار', unit: 'فالوور', category: 'اینستاگرام' });
    expect(ins.values.at(-1)).toMatchObject({ orderCode: 'ZP-ORD1' });
  });
});

describe('issueSubscriptionInvoice', () => {
  it('shows the list price and the checkout discount when less was paid', async () => {
    const f = fakeClient({ sub: { plan_name: 'پایه', price_minor: '9900000', currency: 'IRT', period_start: new Date(), period_end: new Date() } });
    await issueSubscriptionInvoice(f.client, { workspaceId: 'ws-1', subscriptionId: 'sub-1', paidMinor: 8_900_000n, currency: 'IRT', method: 'GATEWAY', paymentId: 'pay-1' });
    const ins = f.insert();
    expect(col(ins, 'source_key')).toBe('subscription:sub-1');
    expect(col(ins, 'title')).toBe('اشتراک پایه');
    expect([col(ins, 'subtotal_minor'), col(ins, 'discount_minor'), col(ins, 'total_minor')]).toEqual(['9900000', '1000000', '8900000']);
  });
});

describe('invoice reads (RLS context)', () => {
  // Regression: invoices has FORCE RLS; reads on the plain pool returned nothing under the app role.
  it('lists newest-first inside the workspace transaction with hasMore', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } as never);
    const r = await listInvoices('ws-list', { limit: 2 });
    expect(r).toEqual({ items: [{ id: 'a' }, { id: 'b' }], hasMore: true });
    expect(mockTx.mock.calls[0][0]).toBe('ws-list');
    expect(mockQuery.mock.calls[0][1]).toEqual(['ws-list', 3, 0]);
  });

  it('fetches one invoice with its lines in the workspace; NOT_FOUND for another tenant', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'inv-1' }] } as never).mockResolvedValueOnce({ rows: [{ id: 'l1' }] } as never);
    await expect(getInvoice('ws-get', 'inv-1')).resolves.toEqual({ id: 'inv-1', items: [{ id: 'l1' }] });
    expect(mockQuery.mock.calls[0][1]).toEqual(['inv-1', 'ws-get']);
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    await expect(getInvoice('ws-other', 'inv-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
