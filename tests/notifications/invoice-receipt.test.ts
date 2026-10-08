import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withTenantTransaction: vi.fn() }));
vi.mock('../../server/notifications/inbox', () => ({ notifyUser: vi.fn() }));
vi.mock('../../server/notifications/sms/config', () => ({ getSmsProvider: vi.fn() }));

import { query, withTenantTransaction } from '../../server/core/db';
import { notifyUser } from '../../server/notifications/inbox';
import { queueInvoiceReceiptSms } from '../../server/notifications/invoice-receipt';
import { onInvoiceIssued, type IssuedInvoice } from '../../server/payments/invoice-notify';
import { processCustomerMessageEvents } from '../../server/notifications/customer-messages';

const INV = '9b2f0c00-2222-4222-8222-222222222222';
const BUYER = '7c3d0a00-3333-4333-8333-333333333333';
const invoice: IssuedInvoice = {
  workspaceId: 'ws-1', invoiceId: INV, invoiceNumber: '1405-000123', type: 'SALE', title: 'فالوور',
  totalToman: 1_248_000n, buyerUserId: BUYER, buyerPhone: '+989121234567', href: `/invoices/${INV}`,
};

function fakeClient(method = 'GATEWAY', failOn?: RegExp) {
  const sql: Array<{ text: string; values?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (text: string, values?: unknown[]) => {
      sql.push({ text, values });
      if (failOn?.test(text)) throw new Error('boom');
      if (/FROM invoices/.test(text)) return { rows: [{ payment_method: method }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }),
  };
  return { client: client as unknown as Parameters<typeof queueInvoiceReceiptSms>[0], sql };
}

beforeEach(() => vi.resetAllMocks());

describe('invoice receipt SMS hook (runs inside the payment transaction)', () => {
  it('onInvoiceIssued only records an outbox event, inside a savepoint, and sends nothing inline', async () => {
    const { client, sql } = fakeClient();
    await onInvoiceIssued(client, invoice);
    const texts = sql.map(s => s.text.trim().split(/\s+/).slice(0, 3).join(' '));
    expect(texts[0]).toBe('SAVEPOINT zp_invoice_receipt_sms');
    const insert = sql.find(s => s.text.includes('INSERT INTO customer_message_events'));
    expect(insert?.values?.[0]).toBe(INV);
    expect(insert?.values?.[1]).toBe(`invoice.issued:${INV}`);
    expect(JSON.parse(String(insert?.values?.[2]))).toMatchObject({ workspaceId: 'ws-1', invoiceNumber: '1405-000123', totalToman: '1248000', buyerUserId: BUYER });
    expect(sql.at(-1)?.text).toBe('RELEASE SAVEPOINT zp_invoice_receipt_sms');
    expect(sql.some(s => /sms_outbox/.test(s.text))).toBe(false);
  });

  it('skips the receipt for an order paid from the wallet (no new money moved)', async () => {
    const { client, sql } = fakeClient('WALLET');
    await queueInvoiceReceiptSms(client, invoice);
    expect(sql.some(s => s.text.includes('INSERT INTO customer_message_events'))).toBe(false);
  });

  it('never throws and rolls back only its own savepoint when the write fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client, sql } = fakeClient('GATEWAY', /INSERT INTO customer_message_events/);
    await expect(onInvoiceIssued(client, invoice)).resolves.toBeUndefined();
    expect(sql.map(s => s.text)).toContain('ROLLBACK TO SAVEPOINT zp_invoice_receipt_sms');
    expect(sql.some(s => /^ROLLBACK$/i.test(s.text.trim()))).toBe(false);
    warn.mockRestore();
  });

  it('never throws even when the savepoint itself cannot be created', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client } = fakeClient('GATEWAY', /^SAVEPOINT/);
    await expect(onInvoiceIssued(client, invoice)).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe('messaging worker turns the invoice event into a receipt SMS', () => {
  function worker(event: Record<string, unknown>, opts: { verified?: boolean; prefs?: Array<{ enabled: boolean }> } = {}) {
    const outbox: unknown[][] = [];
    vi.mocked(query).mockImplementation((async (text: string) => {
      if (text.includes('UPDATE customer_message_events SET attempts')) return { rows: [event], rowCount: 1 };
      if (text.includes('FROM users u WHERE u.id=$1')) return { rows: [{ id: BUYER, phone: '+989121234567', verified: opts.verified ?? true, status: 'ACTIVE' }] };
      if (text.includes('notification_preferences')) return { rows: opts.prefs ?? [] };
      return { rows: [], rowCount: 1 };
    }) as never);
    vi.mocked(withTenantTransaction).mockImplementation((async (_w: string, _u: string, fn: (c: unknown) => unknown) => fn({
      query: vi.fn(async (text: string, values: unknown[]) => { if (text.includes('INSERT INTO sms_outbox')) outbox.push(values); return { rows: [] }; }),
    })) as never);
    return outbox;
  }
  const event = { id: 'e1', event_type: 'invoice.issued', entity_id: INV, attempts: 1, payload: { workspaceId: 'ws-1', invoiceId: INV, invoiceNumber: '1405-000123', totalToman: '1248000', buyerUserId: BUYER } };

  it('queues payment_receipt to the buyer’s verified number without a second in-app entry', async () => {
    const outbox = worker(event);
    await processCustomerMessageEvents();
    expect(outbox).toEqual([['payment_receipt', '+989121234567', BUYER, JSON.stringify(['۱٬۲۴۸٬۰۰۰', '1405-000123', INV]), `payment_receipt:${INV}`]]);
    expect(vi.mocked(notifyUser)).not.toHaveBeenCalled();
  });

  it('receipts stay on even when the customer switched off optional SMS', async () => {
    const outbox = worker(event, { prefs: [{ enabled: false }] });
    await processCustomerMessageEvents();
    expect(outbox).toHaveLength(1);
  });

  it('optional order SMS respects the opt-out', async () => {
    const order = { id: 'e2', event_type: 'order.registered', entity_id: INV, attempts: 1, payload: { workspaceId: 'ws-1', orderId: INV } };
    const outbox = worker(order, { prefs: [{ enabled: false }] });
    vi.mocked(query).mockImplementation((async (text: string) => {
      if (text.includes('UPDATE customer_message_events SET attempts')) return { rows: [order], rowCount: 1 };
      if (text.includes('owner_user_id')) return { rows: [{ id: BUYER, phone: '+989121234567', verified: true, status: 'ACTIVE' }] };
      if (text.includes('notification_preferences')) return { rows: [{ enabled: false }] };
      return { rows: [], rowCount: 1 };
    }) as never);
    await processCustomerMessageEvents();
    expect(outbox).toHaveLength(0);
    expect(vi.mocked(notifyUser)).toHaveBeenCalledTimes(1);
  });

  it('no SMS to an unverified number', async () => {
    const outbox = worker(event, { verified: false });
    await processCustomerMessageEvents();
    expect(outbox).toHaveLength(0);
  });
});
