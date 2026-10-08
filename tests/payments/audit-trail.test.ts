/**
 * Audit trail completeness tests.
 * Verifies that createOrder, markPaymentPaid, and createRefund
 * each write an audit log entry.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

vi.mock('../../server/core/audit', () => ({
  writeAudit: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { writeAudit } from '../../server/core/audit';
import { createOrder } from '../../server/commerce/orders';
import { markPaymentPaid } from '../../server/payments/service';

const mockTx = vi.mocked(withWorkspaceTransaction);
const mockWriteAudit = vi.mocked(writeAudit);
beforeEach(() => vi.clearAllMocks());

// ─── createOrder audit ────────────────────────────────────────────────────────

describe('createOrder — audit trail', () => {
  it('calls writeAudit with action=order.created on successful order creation', async () => {
    const priceRow = {
      id: 'price-1', unit_price_minor: '100', currency: 'IRT', price_version: 1,
      pricing_rule_id: null, fx_rate_id: null, provider_cost_minor: null, provider_cost_currency: null,
    };
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                                           // idempotency
      .mockResolvedValueOnce({ rows: [priceRow] })                                   // catalog price
      .mockResolvedValueOnce({ rows: [{ id: 'ord-1', status: 'PAYMENT_PENDING' }] }) // INSERT orders
      .mockResolvedValueOnce({ rows: [] })                                           // INSERT order_items
      .mockResolvedValueOnce({ rows: [] })                                           // INSERT order_events
      .mockResolvedValueOnce({ rows: [] });                                          // INSERT outbox_events

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));
    mockWriteAudit.mockResolvedValueOnce(undefined);

    await createOrder({
      workspaceId: 'ws-1',
      serviceId: 'svc-1',
      quantity: 1n,
      parameters: {},
      idempotencyKey: 'idem-key-audit-test-001',
    });

    expect(mockWriteAudit).toHaveBeenCalledOnce();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        action: 'order.created',
        entityType: 'order',
        entityId: 'ord-1',
      }),
      expect.objectContaining({ query: expect.any(Function) }), // written on the tenant tx client
    );
  });

  it('does NOT call writeAudit when idempotency match returns existing order', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'ord-existing', status: 'PAYMENT_PENDING' }] });
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await createOrder({
      workspaceId: 'ws-1',
      serviceId: 'svc-1',
      quantity: 1n,
      parameters: {},
      idempotencyKey: 'idem-key-audit-test-002',
    });

    // No audit for idempotent replay
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });
});

// ─── markPaymentPaid audit ────────────────────────────────────────────────────

describe('markPaymentPaid — audit trail', () => {
  it('calls writeAudit with action=payment.paid on successful payment', async () => {
    const paymentRow = { id: 'pay-1', workspace_id: 'ws-1', order_id: null, checkout_session_id: null, purpose: 'TOPUP', status: 'PENDING', amount_minor: '10000', currency: 'IRT', gateway: 'mock' };
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql.includes('FROM payments WHERE id=$1')) return { rows: [paymentRow] };
      if (sql.includes('FROM wallets w')) return { rows: [{ account_id: 'acct-1', wallet_currency: 'IRR' }] };
      return { rows: [], rowCount: 1 };
    });

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));
    mockWriteAudit.mockResolvedValueOnce(undefined);

    await markPaymentPaid({
      paymentId: 'pay-1',
      workspaceId: 'ws-1',
      gatewayReference: 'gw-ref-123',
    });

    expect(mockWriteAudit).toHaveBeenCalledOnce();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        action: 'payment.paid',
        entityType: 'payment',
        entityId: 'pay-1',
      }),
      expect.objectContaining({ query: expect.any(Function) }), // written on the tenant tx client
    );
  });

  it('does NOT call writeAudit when payment is already PAID (idempotent)', async () => {
    const paymentRow = { id: 'pay-1', workspace_id: 'ws-1', order_id: null, status: 'PAID', amount_minor: '10000', currency: 'IRR' };
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows: [paymentRow] }); // already PAID
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await markPaymentPaid({ paymentId: 'pay-1', workspaceId: 'ws-1', gatewayReference: 'gw-ref' });

    expect(mockWriteAudit).not.toHaveBeenCalled();
  });
});

// Refund audit: tests/payments/refund.test.ts.
