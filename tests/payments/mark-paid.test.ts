/**
 * markPaymentPaid: settles a gateway-verified payment exactly once, by purpose.
 * Regressions:
 *  - C-5: a gateway-paid order was also debited from the wallet. An ORDER payment now moves the
 *    order to PAID and never writes a ledger entry.
 *  - C-1/C-4: a top-up is credited in the wallet currency (IRT x10 -> IRR), once.
 * Also covers the onVerifiedGatewayPayment hook (IRR minor units, inside the same transaction).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let inTx = false;
vi.mock('../../server/core/db', () => ({ withWorkspaceTransaction: vi.fn(), query: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/commerce/checkout', () => ({ fulfilPaidCheckout: vi.fn() }));
vi.mock('../../server/payments/hooks', () => ({ onVerifiedGatewayPayment: vi.fn(async () => { expect(inTx).toBe(true); }) }));

import { withWorkspaceTransaction } from '../../server/core/db';
import { markPaymentPaid } from '../../server/payments/service';
import { onVerifiedGatewayPayment } from '../../server/payments/hooks';

const mockTx = vi.mocked(withWorkspaceTransaction);
const mockHook = vi.mocked(onVerifiedGatewayPayment);

type Payment = { id: string; workspace_id: string; order_id: string | null; checkout_session_id: string | null; purpose: string | null; status: string; amount_minor: string; currency: string; gateway: string };
type Order = { id: string; status: string; total_minor: string; currency: string } | null;

function setup(payment: Payment, order: Order = null) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      if (sql.includes('FROM payments WHERE id=$1 AND workspace_id=$2 FOR UPDATE')) return { rows: [payment] };
      if (sql.includes('FROM orders WHERE id=$1 AND workspace_id=$2 FOR UPDATE')) return { rows: order ? [order] : [] };
      if (sql.includes('FROM wallets w')) return { rows: [{ account_id: 'acct-1', wallet_currency: 'IRR' }] };
      return { rows: [], rowCount: 1 };
    }),
  };
  mockTx.mockImplementation((async (_ws: string, _u: unknown, fn: (c: unknown) => unknown) => {
    inTx = true;
    try { return await fn(client); } finally { inTx = false; }
  }) as never);
  return calls;
}

const base: Payment = { id: 'pay-1', workspace_id: 'ws-1', order_id: 'ord-1', checkout_session_id: null, purpose: 'ORDER', status: 'PENDING', amount_minor: '120000', currency: 'IRT', gateway: 'mock' };

beforeEach(() => { vi.clearAllMocks(); inTx = false; });

describe('markPaymentPaid', () => {
  it('marks a pending order PAID from a gateway payment without touching the wallet (C-5)', async () => {
    const calls = setup(base, { id: 'ord-1', status: 'PAYMENT_PENDING', total_minor: '120000', currency: 'IRT' });
    await markPaymentPaid({ paymentId: 'pay-1', workspaceId: 'ws-1', gatewayReference: 'ref-1' });
    expect(calls.some(c => c.sql.includes("UPDATE orders SET status='PAID'"))).toBe(true);
    expect(calls.some(c => c.sql.includes('ledger_entries') || c.sql.includes('FROM wallets'))).toBe(false);
    expect(mockHook).toHaveBeenCalledWith(expect.anything(), { workspaceId: 'ws-1', paymentId: 'pay-1', amountMinor: 1200000n, currency: 'IRR' });
  });

  it('credits a top-up to the wallet converted to IRR, keyed once per payment', async () => {
    const calls = setup({ ...base, order_id: null, purpose: 'TOPUP', amount_minor: '50000' });
    await markPaymentPaid({ paymentId: 'pay-1', workspaceId: 'ws-1', gatewayReference: 'ref-1' });
    const credit = calls.find(c => c.sql.includes('INSERT INTO ledger_entries'))!;
    expect(credit.values.slice(1, 7)).toEqual(['CREDIT', '500000', 'IRR', 'TOPUP', 'pay-1', 'topup:pay-1']);
    expect(credit.sql).toContain('ON CONFLICT');
    expect(mockHook).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amountMinor: 500000n, currency: 'IRR' }));
  });

  it('is a no-op for an already-paid payment (no second credit, no second hook call)', async () => {
    const calls = setup({ ...base, purpose: 'TOPUP', order_id: null, status: 'PAID' });
    await markPaymentPaid({ paymentId: 'pay-1', workspaceId: 'ws-1', gatewayReference: 'ref-1' });
    expect(calls).toHaveLength(1);
    expect(mockHook).not.toHaveBeenCalled();
  });

  it('credits the wallet (and unlinks the order) when the order is no longer payable', async () => {
    const calls = setup(base, { id: 'ord-1', status: 'CANCELLED', total_minor: '120000', currency: 'IRT' });
    await markPaymentPaid({ paymentId: 'pay-1', workspaceId: 'ws-1', gatewayReference: 'ref-1' });
    expect(calls.some(c => c.sql.includes("UPDATE orders SET status='PAID'"))).toBe(false);
    expect(calls.some(c => c.sql.includes("purpose='TOPUP',order_id=NULL"))).toBe(true);
    expect(calls.find(c => c.sql.includes('INSERT INTO ledger_entries'))!.values[2]).toBe('1200000');
  });

  it('refuses to settle a wallet payment through the gateway path', async () => {
    setup({ ...base, gateway: 'wallet' });
    await expect(markPaymentPaid({ paymentId: 'pay-1', workspaceId: 'ws-1', gatewayReference: 'ref-1' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
