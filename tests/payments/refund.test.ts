/**
 * Unit tests for refundOrder() (server/payments/refund.ts) — the single refund/cancel path.
 * Real-PostgreSQL coverage of the wallet paths lives in tests/integration/money-flows.pg.test.ts.
 *
 * Regression (C-6): the old createRefund called the gateway inside the DB transaction, credited the
 * wallet even for card payments, looked idempotency keys up across tenants, and cancel used a
 * separate path, so refund + cancel paid back twice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let inTx = false;
vi.mock('../../server/core/db', () => ({
  withWorkspaceTransaction: vi.fn(),
}));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));

import { withWorkspaceTransaction } from '../../server/core/db';
import { refundOrder } from '../../server/payments/refund';
import type { PaymentGateway } from '../../server/payments/service';

const mockTx = vi.mocked(withWorkspaceTransaction);
const WS = 'ws-1';
const KEY = 'refund-key-0123456789';

type State = { order: { id: string; status: string } | null; payment: { id: string; amount_minor: string; currency: string; gateway: string; gateway_reference: string | null; status: string } | null; refunded: string; prior?: Record<string, string> | null; refundRowStatus: string };

function setup(state: State) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      if (sql.includes('FROM refunds r JOIN payments p')) return { rows: state.prior ? [state.prior] : [] };
      if (sql.includes('FROM orders WHERE id=$1 AND workspace_id=$2 FOR UPDATE') && !sql.includes('SELECT status FROM orders')) return { rows: state.order ? [state.order] : [] };
      if (sql.startsWith('SELECT status FROM orders')) return { rows: state.order ? [{ status: state.order.status }] : [] };
      if (sql.includes('FROM payments WHERE order_id=$1')) return { rows: state.payment ? [state.payment] : [] };
      if (sql.includes("status <> 'FAILED'")) return { rows: [{ total: state.refunded }] };
      if (sql.includes("status='PAID'") && sql.includes('SUM(amount_minor)')) return { rows: [{ total: state.payment?.amount_minor ?? '0' }] };
      if (sql.includes('INSERT INTO refunds')) return { rows: [{ id: 'ref-1' }] };
      if (sql.startsWith('SELECT status FROM refunds')) return { rows: [{ status: state.refundRowStatus }] };
      if (sql.includes('UPDATE orders SET status')) { if (state.order) state.order.status = String(values[1]); return { rows: [], rowCount: 1 }; }
      if (sql.includes('FROM wallets w')) return { rows: [{ account_id: 'acct-1', wallet_currency: 'IRR' }] };
      return { rows: [], rowCount: 1 };
    }),
  };
  mockTx.mockImplementation((async (_ws: string, _u: string | undefined, fn: (c: unknown) => unknown) => {
    inTx = true;
    try { return await fn(client); } finally { inTx = false; }
  }) as never);
  return { client, calls };
}

function gateway(over: Partial<PaymentGateway> = {}): PaymentGateway {
  return {
    name: 'card',
    createCheckout: vi.fn() as PaymentGateway['createCheckout'],
    verify: vi.fn() as PaymentGateway['verify'],
    refund: vi.fn(async () => {
      // The gateway HTTP call must never run while a DB transaction is open.
      expect(inTx).toBe(false);
      return { gatewayReference: 'gw-refund-1' };
    }) as PaymentGateway['refund'],
    ...over,
  };
}

const cardPayment = { id: 'pay-1', amount_minor: '1200000', currency: 'IRT', gateway: 'card', gateway_reference: 'gw-1', status: 'PAID' };
const walletPayment = { ...cardPayment, gateway: 'wallet', gateway_reference: 'wallet:o1' };

beforeEach(() => { vi.clearAllMocks(); inTx = false; });

describe('refundOrder', () => {
  it('requires an idempotency key before any database access', async () => {
    await expect(refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'REFUND', idempotencyKey: null })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'REFUND', idempotencyKey: 'short' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockTx).not.toHaveBeenCalled();
  });

  it('looks the key up inside this workspace and namespaces it per workspace', async () => {
    const { calls } = setup({ order: null, payment: null, refunded: '0', refundRowStatus: 'PENDING', prior: { id: 'ref-old', status: 'PAID', amount_minor: '100', currency: 'IRT', gateway: 'wallet', order_status: 'PAID' } });
    const out = await refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'REFUND', idempotencyKey: KEY });
    expect(out.refund?.id).toBe('ref-old');
    expect(calls[0].values).toEqual([`${WS}:${KEY}`, WS, 'o1']);
  });

  it('refunds a wallet payment to the wallet in IRR inside the transaction and completes the order', async () => {
    const { calls } = setup({ order: { id: 'o1', status: 'PAID' }, payment: walletPayment, refunded: '0', refundRowStatus: 'PENDING' });
    const resolveGateway = vi.fn();
    const out = await refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'REFUND', idempotencyKey: KEY, resolveGateway });
    expect(out).toMatchObject({ orderStatus: 'REFUNDED', refund: { status: 'PAID', amountMinor: '1200000', destination: 'WALLET' } });
    const credit = calls.find(c => c.sql.includes('INSERT INTO ledger_entries'))!;
    expect(credit.values.slice(1, 4)).toEqual(['CREDIT', '12000000', 'IRR']);
    expect(resolveGateway).not.toHaveBeenCalled();
    expect(mockTx).toHaveBeenCalledTimes(1);
  });

  it('refunds a card payment through its gateway outside the transaction, never to the wallet', async () => {
    const { calls } = setup({ order: { id: 'o1', status: 'COMPLETED' }, payment: cardPayment, refunded: '0', refundRowStatus: 'PENDING' });
    const gw = gateway();
    const out = await refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'REFUND', idempotencyKey: KEY, resolveGateway: () => gw });
    expect(gw.refund).toHaveBeenCalledWith({ paymentId: 'pay-1', amountMinor: 1200000n, gatewayReference: 'gw-1' }, `${WS}:${KEY}`);
    expect(out).toMatchObject({ orderStatus: 'REFUNDED', refund: { status: 'PAID', destination: 'GATEWAY' } });
    expect(calls.some(c => c.sql.includes('INSERT INTO ledger_entries'))).toBe(false);
    expect(mockTx).toHaveBeenCalledTimes(2);
  });

  it('records a failed gateway refund as FAILED and reports a Persian provider error', async () => {
    const { calls } = setup({ order: { id: 'o1', status: 'PAID' }, payment: cardPayment, refunded: '0', refundRowStatus: 'PENDING' });
    const gw = gateway({ refund: vi.fn(async () => { throw new Error('timeout'); }) as PaymentGateway['refund'] });
    await expect(refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'REFUND', idempotencyKey: KEY, resolveGateway: () => gw })).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
    expect(calls.some(c => c.sql.includes("UPDATE refunds SET status='FAILED'"))).toBe(true);
  });

  it('refuses up front (no refund row) when the card gateway cannot refund', async () => {
    const { calls } = setup({ order: { id: 'o1', status: 'PAID' }, payment: cardPayment, refunded: '0', refundRowStatus: 'PENDING' });
    const gw = gateway({ refund: undefined });
    await expect(refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'REFUND', idempotencyKey: KEY, resolveGateway: () => gw })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(calls.some(c => c.sql.includes('INSERT INTO refunds'))).toBe(false);
  });

  it('never refunds more than is left after earlier refunds (refund + cancel share one ledger)', async () => {
    setup({ order: { id: 'o1', status: 'QUEUED' }, payment: walletPayment, refunded: '1200000', refundRowStatus: 'PENDING' });
    await expect(refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'CANCEL', idempotencyKey: KEY })).rejects.toMatchObject({ code: 'CONFLICT' });
    setup({ order: { id: 'o1', status: 'PAID' }, payment: walletPayment, refunded: '1000000', refundRowStatus: 'PENDING' });
    await expect(refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'REFUND', amountMinor: 300000n, idempotencyKey: KEY })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('cancels only before provider submission', async () => {
    for (const status of ['PROCESSING', 'PROVIDER_SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'REFUND_PENDING']) {
      setup({ order: { id: 'o1', status }, payment: walletPayment, refunded: '0', refundRowStatus: 'PENDING' });
      await expect(refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'CANCEL', idempotencyKey: KEY })).rejects.toMatchObject({ code: 'CONFLICT' });
    }
  });

  it('refuses to cancel team work in progress with a Persian message and moves no money', async () => {
    const { calls } = setup({ order: { id: 'o1', status: 'IN_PROGRESS' }, payment: walletPayment, refunded: '0', refundRowStatus: 'PENDING' });
    await expect(refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'CANCEL', idempotencyKey: KEY }))
      .rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('کار روی این سفارش شروع شده است') });
    expect(calls.some(c => c.sql.includes('INSERT INTO refunds') || c.sql.includes('UPDATE orders SET status'))).toBe(false);
  });

  it('cancels a queued, wallet-paid order to CANCELLED with a full refund', async () => {
    setup({ order: { id: 'o1', status: 'QUEUED' }, payment: walletPayment, refunded: '0', refundRowStatus: 'PENDING' });
    const out = await refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'CANCEL', idempotencyKey: KEY });
    expect(out).toMatchObject({ orderStatus: 'CANCELLED', refund: { amountMinor: '1200000', destination: 'WALLET' } });
  });

  it('does not allow a full refund while the order is with the provider (state machine)', async () => {
    for (const status of ['QUEUED', 'PROCESSING', 'PROVIDER_SUBMITTED']) {
      setup({ order: { id: 'o1', status }, payment: walletPayment, refunded: '0', refundRowStatus: 'PENDING' });
      await expect(refundOrder({ workspaceId: WS, orderId: 'o1', mode: 'REFUND', idempotencyKey: KEY })).rejects.toMatchObject({ code: 'CONFLICT' });
    }
  });
});
