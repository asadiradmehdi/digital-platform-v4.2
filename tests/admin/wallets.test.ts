import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/notifications/inbox', () => ({ notifyUser: vi.fn() }));
vi.mock('../../server/core/platform-settings', () => ({ getPlatformSetting: vi.fn(async () => ({ value: null, secret: null, updatedAt: null })) }));
vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withTenantTransaction: vi.fn(async (_w: string, _u: string, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});
import { writeAudit } from '../../server/core/audit';
import { query } from '../../server/core/db';
import { notifyUser } from '../../server/notifications/inbox';
import { adjustWallet, MAX_ADJUSTMENT_TOMAN } from '../../server/admin/wallets';
import { ladderFromThresholds, tierForLadder, validateThresholds } from '../../lib/tier-ladder';
import { getTierLadder } from '../../server/loyalty/tier-ladder';
import { TIERS } from '../../lib/tiers';

const A = '11111111-1111-4111-8111-111111111111';
const U = '40000000-0000-4000-8000-000000000004';
const W = '30000000-0000-4000-8000-000000000003';
const q = vi.mocked(query);
const ok = { actorUserId: A, userId: U, direction: 'CREDIT', amountToman: 50_000, reason: 'جبران خطای سیستم', idempotencyKey: 'idem-key-123' };

function ledger(balanceIrr: string, inserted = true) {
  q.mockImplementation((async (sql: string) => {
    if (/FROM workspaces w JOIN users/.test(sql)) return { rows: [{ id: W }] };
    if (/FROM wallets w/.test(sql)) return { rows: [{ account_id: 'acc', wallet_currency: 'IRR' }] };
    if (/INSERT INTO ledger_entries/.test(sql)) return { rowCount: inserted ? 1 : 0, rows: [] };
    if (/SUM\(CASE WHEN direction/.test(sql)) return { rows: [{ balance: balanceIrr }] };
    return { rows: [] };
  }) as never);
}
beforeEach(() => { vi.clearAllMocks(); });

describe('adjustWallet', () => {
  it('validates input before touching the database', async () => {
    for (const bad of [
      { ...ok, direction: 'X' }, { ...ok, amountToman: 0 }, { ...ok, amountToman: 1.5 }, { ...ok, amountToman: '5' }, { ...ok, amountToman: MAX_ADJUSTMENT_TOMAN + 1 },
      { ...ok, reason: 'کوتاه' }, { ...ok, reason: '' }, { ...ok, idempotencyKey: null }, { ...ok, idempotencyKey: 'x' },
    ]) await expect(adjustWallet(bad as never)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(q).not.toHaveBeenCalled();
  });
  it('credits in the wallet currency (toman x10), records who/why, audits and notifies', async () => {
    ledger('500000');
    const r = await adjustWallet(ok as never);
    expect(r).toEqual({ replayed: false, balanceToman: 50_000 });
    const ins = q.mock.calls.find(c => /INSERT INTO ledger_entries/.test(String(c[0])))!;
    const v = ins[1] as unknown[];
    expect(v[1]).toBe('CREDIT'); expect(v[2]).toBe('500000'); expect(v[3]).toBe('IRR'); expect(v[4]).toBe('ADMIN_ADJUSTMENT'); expect(v[6]).toBe('admin-adj:idem-key-123');
    expect(v[7]).toMatchObject({ actorUserId: A, reason: 'جبران خطای سیستم' });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.wallet.credit', workspaceId: W }), expect.anything());
    expect(notifyUser).toHaveBeenCalledWith(expect.objectContaining({ userId: U, category: 'payments' }), expect.anything());
  });
  it('a replay with the same key changes nothing and does not audit or notify twice', async () => {
    ledger('500000', false);
    expect((await adjustWallet(ok as never)).replayed).toBe(true);
    expect(writeAudit).not.toHaveBeenCalled(); expect(notifyUser).not.toHaveBeenCalled();
  });
  it('a debit larger than the balance is refused and writes nothing', async () => {
    ledger('100000'); // 10,000 toman
    await expect(adjustWallet({ ...ok, direction: 'DEBIT', amountToman: 50_000 } as never)).rejects.toMatchObject({ code: 'PAYMENT_REQUIRED' });
    expect(q.mock.calls.some(c => /INSERT INTO ledger_entries/.test(String(c[0])))).toBe(false);
    expect(writeAudit).not.toHaveBeenCalled();
  });
  it('a covered debit is posted as DEBIT and audited as admin.wallet.debit', async () => {
    ledger('1000000');
    await adjustWallet({ ...ok, direction: 'DEBIT', amountToman: 50_000 } as never);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.wallet.debit' }), expect.anything());
  });
});

describe('tier ladder', () => {
  it('defaults match the shipped ladder (0, 1M, 5M, 10M, 25M)', async () => {
    expect((await getTierLadder()).map(t => t.minToman)).toEqual([0, 1_000_000, 5_000_000, 10_000_000, 25_000_000]);
  });
  it('validates thresholds: first is 0 and strictly increasing', () => {
    expect(validateThresholds([0, 1, 2, 3, 4])).toBeNull();
    expect(validateThresholds([1, 2, 3, 4, 5])).not.toBeNull();
    expect(validateThresholds([0, 5, 5, 6, 7])).not.toBeNull();
    expect(validateThresholds([0, 5])).not.toBeNull();
    expect(validateThresholds([0, 1, 2, 3, 1.5])).not.toBeNull();
  });
  it('level math follows custom thresholds', () => {
    const l = ladderFromThresholds([0, 500_000, 2_000_000, 8_000_000, 20_000_000]);
    expect(tierForLadder(l, 499_999).tier.name).toBe(TIERS[0].name);
    expect(tierForLadder(l, 500_000).tier.name).toBe(TIERS[1].name);
    expect(tierForLadder(l, 30_000_000)).toMatchObject({ level: 5, next: null, progress: 1, remainingToman: 0 });
  });
});
