import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(async (_wid: string, _opts: unknown, fn: (client: { query: ReturnType<typeof vi.fn> }) => unknown) => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    return fn(client);
  }),
}));
vi.mock('../../server/payments/service', () => ({ markPaymentPaid: vi.fn() }));
vi.mock('../../server/payments/invoice', () => ({ generateInvoice: vi.fn() }));

import { query } from '../../server/core/db';
import { dispatchPaymentWebhook } from '../../server/payments/webhook-dispatcher';
import { markPaymentPaid } from '../../server/payments/service';
import { generateInvoice } from '../../server/payments/invoice';

const mockQuery = vi.mocked(query);
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
    mockQuery.mockResolvedValueOnce({
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
    mockQuery.mockResolvedValueOnce({ rows: [paymentRow] } as never);
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
    mockQuery.mockResolvedValueOnce({ rows: [paymentRow] } as never);
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
