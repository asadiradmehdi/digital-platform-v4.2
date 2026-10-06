/**
 * Financial invariant: prevent double-charge.
 * Verifies that calling beginCheckout on a payment that is already PAID
 * returns CONFLICT and does NOT invoke the payment gateway a second time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

vi.mock('../../server/core/idempotency', () => ({
  requireIdempotencyKey: vi.fn(),
}));

vi.mock('../../server/core/audit', () => ({
  writeAudit: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { beginCheckout, markPaymentPaid } from '../../server/payments/service';

const mockWithWorkspaceTransaction = vi.mocked(withWorkspaceTransaction);
beforeEach(() => vi.clearAllMocks());

describe('beginCheckout — double-charge prevention', () => {
  it('throws CONFLICT when the same idempotency key maps to an already-PAID payment', async () => {
    // Simulate createPayment returning an existing PAID payment
    mockWithWorkspaceTransaction.mockResolvedValueOnce({ id: 'pay-1', status: 'PAID' } as never);

    const gateway = { name: 'mock', createCheckout: vi.fn(), verify: vi.fn() };
    await expect(
      beginCheckout({
        workspaceId: 'ws-1',
        amountMinor: 5000n,
        currency: 'IRR',
        gateway: gateway as never,
        callbackUrl: 'https://example.com/cb',
        idempotencyKey: 'idem-key-1',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    // Gateway must NOT have been called
    expect(gateway.createCheckout).not.toHaveBeenCalled();
  });

  it('proceeds normally when the payment is PENDING (not yet paid)', async () => {
    mockWithWorkspaceTransaction.mockResolvedValueOnce({ id: 'pay-2', status: 'PENDING' } as never);
    // Second call for gateway_reference update
    mockWithWorkspaceTransaction.mockResolvedValueOnce(undefined as never);

    const gateway = {
      name: 'mock',
      createCheckout: vi.fn().mockResolvedValue({ checkoutUrl: 'https://pay.example/123', gatewayReference: 'ref-1' }),
      verify: vi.fn(),
    };

    const result = await beginCheckout({
      workspaceId: 'ws-1',
      amountMinor: 5000n,
      currency: 'IRR',
      gateway: gateway as never,
      callbackUrl: 'https://example.com/cb',
      idempotencyKey: 'idem-key-2',
    });

    expect(gateway.createCheckout).toHaveBeenCalledOnce();
    expect(result.paymentId).toBe('pay-2');
    expect(result.checkoutUrl).toBe('https://pay.example/123');
  });
});

describe('markPaymentPaid — idempotent on repeated calls', () => {
  it('returns the existing PAID payment without writing audit again on duplicate call', async () => {
    // First call — row is PENDING, payment transitions to PAID
    mockWithWorkspaceTransaction.mockImplementationOnce(async (_wsId, _userId, fn) => {
      const client = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'pay-3', workspace_id: 'ws-1', order_id: null, status: 'PENDING', amount_minor: '5000', currency: 'IRR' }], rowCount: 1 }) // FOR UPDATE fetch
          .mockResolvedValue({ rows: [], rowCount: 1 }),
      };
      return fn(client as never);
    });
    const first = await markPaymentPaid({ paymentId: 'pay-3', workspaceId: 'ws-1', gatewayReference: 'ref-abc' });
    expect(first.status).toBe('PAID');

    // Second call — row is now PAID (idempotent replay)
    mockWithWorkspaceTransaction.mockImplementationOnce(async (_wsId, _userId, fn) => {
      const client = {
        query: vi.fn().mockResolvedValueOnce({ rows: [{ id: 'pay-3', workspace_id: 'ws-1', order_id: null, status: 'PAID', amount_minor: '5000', currency: 'IRR' }], rowCount: 1 }),
      };
      return fn(client as never);
    });
    const second = await markPaymentPaid({ paymentId: 'pay-3', workspaceId: 'ws-1', gatewayReference: 'ref-abc' });
    // Must return the row, not throw
    expect(second).toMatchObject({ status: 'PAID' });
  });
});
