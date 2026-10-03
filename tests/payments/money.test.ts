import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(async (_wid: string, _opts: unknown, fn: Function) => fn({ query: vi.fn() })),
}));
vi.mock('../../server/core/idempotency', () => ({
  requireIdempotencyKey: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { createRefund } from '../../server/payments/refund';
import { dispatchPaymentWebhook } from '../../server/payments/webhook-dispatcher';
import { query } from '../../server/core/db';

const mockQuery = vi.mocked(query);
const mockTx = vi.mocked(withWorkspaceTransaction);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Refund ──────────────────────────────────────────────────────────────────

describe('createRefund', () => {
  it('returns existing refund when idempotency key matches', async () => {
    const clientMock = { query: vi.fn().mockResolvedValueOnce({ rows: [{ id: 'ref-1', status: 'PAID' }] }) };
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn(clientMock as never));
    const gw = { name: 'mock', createCheckout: vi.fn(), verify: vi.fn(), refund: vi.fn() };
    const result = await createRefund({ workspaceId: 'ws-1', paymentId: 'pay-1', amountMinor: 1000n, currency: 'IRR', idempotencyKey: 'idem-1', gateway: gw });
    expect(result).toEqual({ id: 'ref-1', status: 'PAID' });
    expect(gw.refund).not.toHaveBeenCalled();
  });

  it('throws when payment is not PAID', async () => {
    const clientMock = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })               // no existing refund
        .mockResolvedValueOnce({ rows: [{ id: 'pay-1', status: 'PENDING', gateway_reference: 'gw-1', amount_minor: '5000' }] }),
    };
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn(clientMock as never));
    const gw = { name: 'mock', createCheckout: vi.fn(), verify: vi.fn(), refund: vi.fn() };
    await expect(createRefund({ workspaceId: 'ws-1', paymentId: 'pay-1', amountMinor: 1000n, currency: 'IRR', idempotencyKey: 'idem-2', gateway: gw }))
      .rejects.toThrow('not in PAID status');
  });

  it('throws when refund would exceed payment amount', async () => {
    const clientMock = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })               // no existing refund
        .mockResolvedValueOnce({ rows: [{ id: 'pay-1', status: 'PAID', gateway_reference: 'gw-1', amount_minor: '1000' }] })
        .mockResolvedValueOnce({ rows: [{ total: '500' }] }), // already refunded 500
    };
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn(clientMock as never));
    const gw = { name: 'mock', createCheckout: vi.fn(), verify: vi.fn(), refund: vi.fn() };
    // Trying to refund 600, but only 500 (1000-500) remaining.
    await expect(createRefund({ workspaceId: 'ws-1', paymentId: 'pay-1', amountMinor: 600n, currency: 'IRR', idempotencyKey: 'idem-3', gateway: gw }))
      .rejects.toThrow('exceeds available payment balance');
  });

  it('marks refund FAILED when gateway throws', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                          // no existing refund
      .mockResolvedValueOnce({ rows: [{ id: 'pay-1', status: 'PAID', gateway_reference: 'gw-1', amount_minor: '5000' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })            // refunded so far
      .mockResolvedValueOnce({ rows: [{ id: 'ref-new', status: 'PENDING' }] }) // insert refund
      .mockResolvedValueOnce({ rows: [] });                         // update to FAILED
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));
    const gw = { name: 'mock', createCheckout: vi.fn(), verify: vi.fn(), refund: vi.fn().mockRejectedValueOnce(new Error('Gateway error')) };
    await expect(createRefund({ workspaceId: 'ws-1', paymentId: 'pay-1', amountMinor: 1000n, currency: 'IRR', idempotencyKey: 'idem-4', gateway: gw }))
      .rejects.toThrow('Gateway error');
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining("status='FAILED'"), ['ref-new']);
  });
});

// ─── Webhook Dispatcher ───────────────────────────────────────────────────────

describe('dispatchPaymentWebhook', () => {
  it('does nothing for unrecognized event types', async () => {
    await dispatchPaymentWebhook({ source: 'acme', eventType: 'customer.created', payload: {}, correlationId: 'c1' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('does nothing when no gateway reference in payload', async () => {
    await dispatchPaymentWebhook({ source: 'acme', eventType: 'payment.paid', payload: {}, correlationId: 'c2' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('skips already-paid payments', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'pay-1', workspace_id: 'ws-1', order_id: null, amount_minor: '5000', currency: 'IRR', status: 'PAID' }], rowCount: 1 } as never);
    await dispatchPaymentWebhook({ source: 'acme', eventType: 'payment.paid', payload: { gateway_reference: 'gw-ref-1' }, correlationId: 'c3' });
    // Only one query (the lookup), no markPaymentPaid transaction.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
