import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(async (_wid: string, _opts: unknown, fn: Function) => fn({ query: vi.fn() })),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { generateInvoice, listInvoices, getInvoice } from '../../server/payments/invoice';
import * as db from '../../server/core/db';

const mockTx = vi.mocked(withWorkspaceTransaction);
const mockQuery = vi.mocked(db.query);

beforeEach(() => vi.clearAllMocks());

// ─── generateInvoice ─────────────────────────────────────────────────────────

describe('generateInvoice', () => {
  it('returns existing invoice when already created (idempotency)', async () => {
    const existing = { id: 'inv-1', invoice_number: 'INV-2026-000001' };
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({
      query: vi.fn().mockResolvedValueOnce({ rows: [existing] }),
    } as never));

    const result = await generateInvoice({
      workspaceId: 'ws-1',
      paymentId: 'pay-1',
      amountMinor: 10000n,
      currency: 'IRR',
      items: [{ description: 'Test', quantity: 1n, unitPriceMinor: 10000n, totalMinor: 10000n, currency: 'IRR' }],
    });

    expect(result).toEqual(existing);
  });

  it('inserts a new invoice and returns its id', async () => {
    const newInvoice = { id: 'inv-2', invoice_number: 'INV-2026-000002' };
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                           // SELECT existing -> none
      .mockResolvedValueOnce({ rows: [{ seq: '000002' }] })         // allocateInvoiceNumber sequence
      .mockResolvedValueOnce({ rows: [newInvoice] })                // INSERT invoices
      .mockResolvedValue({ rows: [] });                             // INSERT invoice_items
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    const result = await generateInvoice({
      workspaceId: 'ws-1',
      paymentId: 'pay-2',
      amountMinor: 5000n,
      currency: 'IRR',
      items: [{ description: 'Service', quantity: 1n, unitPriceMinor: 5000n, totalMinor: 5000n, currency: 'IRR' }],
    });

    expect(result).toEqual(newInvoice);
  });

  it('throws VALIDATION_ERROR when total is negative (discount exceeds subtotal)', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                  // SELECT existing -> none
      .mockResolvedValueOnce({ rows: [{ seq: '000003' }] }); // allocateInvoiceNumber
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    await expect(
      generateInvoice({
        workspaceId: 'ws-1',
        paymentId: 'pay-3',
        amountMinor: 5000n,
        discountMinor: 9999n,  // discount > subtotal
        currency: 'IRR',
        items: [{ description: 'Item', quantity: 1n, unitPriceMinor: 5000n, totalMinor: 5000n, currency: 'IRR' }],
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

// ─── listInvoices ─────────────────────────────────────────────────────────────

describe('listInvoices', () => {
  it('returns all invoices for the workspace', async () => {
    const rows = [
      { id: 'inv-10', invoice_number: 'INV-2026-000010', status: 'ISSUED' },
      { id: 'inv-11', invoice_number: 'INV-2026-000011', status: 'ISSUED' },
    ];
    mockQuery.mockResolvedValueOnce({ rows } as never);

    const result = await listInvoices('ws-1');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'inv-10' });
  });

  it('returns empty array when no invoices exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    const result = await listInvoices('ws-empty');
    expect(result).toEqual([]);
  });
});

// ─── getInvoice ────────────────────────────────────────────────────────────────

describe('getInvoice', () => {
  it('returns invoice with line items', async () => {
    const inv = { id: 'inv-20', invoice_number: 'INV-2026-000020', workspace_id: 'ws-1' };
    const items = [{ id: 'item-1', description: 'Test', quantity: 1 }];
    mockQuery
      .mockResolvedValueOnce({ rows: [inv] } as never)   // SELECT invoice
      .mockResolvedValueOnce({ rows: items } as never);   // SELECT items

    const result = await getInvoice('ws-1', 'inv-20');
    expect(result).toMatchObject({ id: 'inv-20', items });
  });

  it('throws NOT_FOUND when invoice does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    await expect(getInvoice('ws-1', 'inv-missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
