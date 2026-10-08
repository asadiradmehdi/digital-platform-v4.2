import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => {
  const txQuery = vi.fn();
  return {
    query: vi.fn(),
    txQuery,
    withTenantTransaction: vi.fn(async (_wid: string, _u: unknown, fn: (client: { query: typeof txQuery }) => unknown) => fn({ query: txQuery })),
  };
});
vi.mock('../../server/payments/service', () => ({ markPaymentPaid: vi.fn() }));
vi.mock('../../server/payments/invoice', () => ({ generateInvoice: vi.fn() }));

import * as db from '../../server/core/db';
import { query, withTenantTransaction } from '../../server/core/db';
import { dispatchPaymentWebhook } from '../../server/payments/webhook-dispatcher';
import { markPaymentPaid } from '../../server/payments/service';
import { generateInvoice } from '../../server/payments/invoice';

const mockQuery = vi.mocked(query);
const mockTxQuery = (db as unknown as { txQuery: ReturnType<typeof vi.fn> }).txQuery;
const mockTx = vi.mocked(withTenantTransaction);
const mockMarkPaid = vi.mocked(markPaymentPaid);
const mockGenerateInvoice = vi.mocked(generateInvoice);

beforeEach(() => vi.clearAllMocks());

describe('dispatchPaymentWebhook', () => {
  it('ignores events that are not payment success types', async () => {
    await dispatchPaymentWebhook({
      source: 'stripe',
      eventType: 'customer.created',
      payload: {},
      correlationId: 'cid-1',
    });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it('ignores payment.paid events without a gateway reference', async () => {
    await dispatchPaymentWebhook({
      source: 'stripe',
      eventType: 'payment.paid',
      payload: { some_other_field: 'abc' },
      correlationId: 'cid-2',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('ignores already-paid payments (idempotency)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ payment_id: 'pay-1', workspace_id: 'ws-1' }] } as never);
    mockTxQuery.mockResolvedValueOnce({
      rows: [{ id: 'pay-1', workspace_id: 'ws-1', order_id: 'ord-1', amount_minor: '10000', currency: 'IRR', status: 'PAID' }],
    } as never);

    await dispatchPaymentWebhook({
      source: 'stripe',
      eventType: 'payment.paid',
      payload: { gateway_reference: 'gw-ref-1' },
      correlationId: 'cid-3',
    });

    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it('marks payment paid and generates invoice for a new payment event', async () => {
    const paymentRow = { id: 'pay-2', workspace_id: 'ws-2', order_id: 'ord-2', amount_minor: '5000', currency: 'IRR', status: 'INITIATED' };
    mockQuery.mockResolvedValueOnce({ rows: [{ payment_id: paymentRow.id, workspace_id: paymentRow.workspace_id }] } as never);
    mockTxQuery.mockResolvedValueOnce({ rows: [paymentRow] } as never);
    mockMarkPaid.mockResolvedValueOnce(undefined as never);
    mockGenerateInvoice.mockResolvedValueOnce({ id: 'inv-1', invoice_number: 'INV-2026-000001' } as never);

    await dispatchPaymentWebhook({
      source: 'stripe',
      eventType: 'charge.succeeded',
      payload: { gateway_reference: 'gw-ref-2' },
      correlationId: 'cid-4',
    });

    expect(mockMarkPaid).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay-2', workspaceId: 'ws-2', gatewayReference: 'gw-ref-2' })
    );
    expect(mockGenerateInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-2', paymentId: 'pay-2' })
    );
  });

  it('proceeds even if generateInvoice throws (invoice failure must not roll back payment)', async () => {
    const paymentRow = { id: 'pay-3', workspace_id: 'ws-3', order_id: null, amount_minor: '2000', currency: 'IRR', status: 'INITIATED' };
    mockQuery.mockResolvedValueOnce({ rows: [{ payment_id: paymentRow.id, workspace_id: paymentRow.workspace_id }] } as never);
    mockTxQuery.mockResolvedValueOnce({ rows: [paymentRow] } as never);
    mockMarkPaid.mockResolvedValueOnce(undefined as never);
    mockGenerateInvoice.mockRejectedValueOnce(new Error('DB error') as never);

    // Should not throw despite generateInvoice error
    await expect(
      dispatchPaymentWebhook({ source: 'stripe', eventType: 'payment.success', payload: { gateway_reference: 'gw-ref-3' }, correlationId: 'cid-5' })
    ).resolves.toBeUndefined();

    expect(mockMarkPaid).toHaveBeenCalled();
  });

  it('does nothing when no payment row matches the gateway reference', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    await dispatchPaymentWebhook({
      source: 'stripe',
      eventType: 'transaction.success',
      payload: { gateway_reference: 'gw-unknown' },
      correlationId: 'cid-6',
    });

    expect(mockMarkPaid).not.toHaveBeenCalled();
  });
});

describe('dispatchPaymentWebhook RLS access path', () => {
  // Regression: payments has FORCE RLS; the plain-pool lookup by gateway reference never matched under
  // the production role, so verified payment webhooks never marked anything paid.
  it('locates via system_find_payment_by_gateway_reference, then reads inside that workspace', async () => {
    const paymentRow = { id: 'pay-9', workspace_id: 'ws-9', order_id: null, amount_minor: '700', currency: 'IRR', status: 'INITIATED' };
    mockQuery.mockResolvedValueOnce({ rows: [{ payment_id: 'pay-9', workspace_id: 'ws-9' }] } as never);
    mockTxQuery.mockResolvedValueOnce({ rows: [paymentRow] } as never);
    mockGenerateInvoice.mockResolvedValueOnce({ id: 'inv-9' } as never);
    await dispatchPaymentWebhook({ source: 'mock', eventType: 'payment.paid', payload: { gateway_reference: 'ref-9' }, correlationId: 'c' });
    expect(String(mockQuery.mock.calls[0][0])).toContain('system_find_payment_by_gateway_reference($1)');
    expect(mockQuery.mock.calls[0][1]).toEqual(['ref-9']);
    expect(mockTx).toHaveBeenCalledWith('ws-9', undefined, expect.any(Function));
    expect(mockTxQuery.mock.calls[0][1]).toEqual(['pay-9', 'ws-9']);
    expect(mockMarkPaid).toHaveBeenCalledWith(expect.objectContaining({ paymentId: 'pay-9', workspaceId: 'ws-9' }));
  });

  it('refuses an ambiguous gateway reference instead of guessing a tenant', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ payment_id: 'p1', workspace_id: 'ws-a' }, { payment_id: 'p2', workspace_id: 'ws-b' }] } as never);
    await dispatchPaymentWebhook({ source: 'mock', eventType: 'payment.paid', payload: { gateway_reference: 'dup' }, correlationId: 'c' });
    expect(mockTx).not.toHaveBeenCalled();
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });
});
