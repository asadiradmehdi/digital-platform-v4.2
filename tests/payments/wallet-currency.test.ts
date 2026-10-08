/**
 * Regression: IRT (toman) orders were debited from IRR (rial) wallets with the raw toman amount,
 * charging customers a tenth of the price and mixing currencies in one ledger.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withWorkspaceTransaction: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));

import { withWorkspaceTransaction } from '../../server/core/db';
import { payOrderFromWallet } from '../../server/payments/service';
import { toWalletMinor } from '../../server/payments/currency';

const mockTx = vi.mocked(withWorkspaceTransaction);
beforeEach(() => vi.clearAllMocks());

describe('toWalletMinor', () => {
  it('converts toman to rial and keeps same-currency amounts', () => {
    expect(toWalletMinor(125_000n, 'IRT', 'IRR')).toBe(1_250_000n);
    expect(toWalletMinor(500n, 'IRR', 'IRR')).toBe(500n);
    expect(toWalletMinor(500n, 'IRT', 'IRR ')).toBe(5000n);
  });
  it('refuses unrelated currency pairs', () => {
    expect(() => toWalletMinor(1n, 'USD', 'IRR')).toThrow();
    expect(() => toWalletMinor(1n, 'IRR', 'IRT')).toThrow();
  });
});

function runWith(balanceRial: string) {
  const q = vi.fn()
    .mockResolvedValueOnce({ rows: [] }) // payment idempotency
    .mockResolvedValueOnce({ rows: [{ id: 'ord-1', status: 'PAYMENT_PENDING', total_minor: '120000', currency: 'IRT' }] })
    .mockResolvedValueOnce({ rows: [{ account_id: 'acct-1', wallet_currency: 'IRR' }] }) // lock MAIN
    .mockResolvedValueOnce({ rows: [{ balance: balanceRial }] }) // balance after the lock
    .mockResolvedValue({ rows: [{ id: 'pay-1', status: 'PAID' }] });
  mockTx.mockImplementationOnce(async (_w, _u, fn) => fn({ query: q } as never));
  return q;
}

describe('payOrderFromWallet currency', () => {
  it('debits the rial equivalent of a toman order', async () => {
    const q = runWith('5000000');
    await payOrderFromWallet({ workspaceId: 'ws-1', orderId: 'ord-1', idempotencyKey: 'pay:idem-key-0000001' });
    const debit = q.mock.calls.find(c => String(c[0]).includes("'DEBIT'"));
    expect(debit?.[1][1]).toBe(1_200_000n);
    expect(debit?.[1][2]).toBe('IRR');
  });
  it('rejects when the rial balance covers only the raw toman figure', async () => {
    runWith('500000'); // 50,000 toman, order costs 120,000 toman
    await expect(payOrderFromWallet({ workspaceId: 'ws-1', orderId: 'ord-1', idempotencyKey: 'pay:idem-key-0000002' }))
      .rejects.toMatchObject({ code: 'PAYMENT_REQUIRED' });
  });
});

describe('payOrderFromWallet locking', () => {
  // Regression: the lock query combined FOR UPDATE with GROUP BY, which PostgreSQL rejects
  // ("FOR UPDATE is not allowed with GROUP BY clause"), so every wallet purchase failed with 500.
  it('never combines a row lock with an aggregate in one statement', async () => {
    const q = runWith('5000000');
    await payOrderFromWallet({ workspaceId: 'ws-1', orderId: 'ord-1', idempotencyKey: 'pay:idem-key-0000003' });
    const sql = q.mock.calls.map(c => String(c[0]));
    for (const s of sql.filter(x => /FOR UPDATE/i.test(x))) expect(s).not.toMatch(/GROUP BY|SUM\(/i);
    const lockAt = sql.findIndex(x => /FOR UPDATE OF la/.test(x));
    const sumAt = sql.findIndex(x => /SUM\(/.test(x));
    expect(lockAt).toBeGreaterThan(-1);
    expect(sumAt).toBeGreaterThan(lockAt);
  });
});

describe('payOrderFromWallet gateway reference', () => {
  // Regression: every wallet payment used gateway_reference='wallet' under UNIQUE(gateway, gateway_reference),
  // so only the first wallet purchase in the whole system could ever succeed.
  it('uses a per-order wallet reference', async () => {
    const q = runWith('5000000');
    await payOrderFromWallet({ workspaceId: 'ws-1', orderId: 'ord-1', idempotencyKey: 'pay:idem-key-0000004' });
    const ins = q.mock.calls.find(c => /INSERT INTO payments\(/.test(String(c[0])));
    expect(String(ins?.[0])).not.toMatch(/'wallet'\)/);
    expect(ins?.[1]).toContain('wallet:ord-1');
  });
});
