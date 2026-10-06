import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

vi.mock('../../server/subscriptions/usage', () => ({
  resetUsagePeriod: vi.fn(),
}));

import { query, withWorkspaceTransaction } from '../../server/core/db';
import { resetUsagePeriod } from '../../server/subscriptions/usage';
import { advanceSubscriptionPeriod, findSubscriptionsDueForRenewal, processSubscriptionRenewal } from '../../server/subscriptions/renewal';

const mockQuery = vi.mocked(query);
const mockTx = vi.mocked(withWorkspaceTransaction);
const mockResetUsage = vi.mocked(resetUsagePeriod);

beforeEach(() => vi.clearAllMocks());

const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

const activeSubscription = {
  id: 'sub-1',
  workspace_id: 'ws-1',
  status: 'ACTIVE',
  auto_renew: true,
  cancel_at_period_end: false,
  current_period_end: pastDate,
  plan_interval: 'monthly',
};

describe('advanceSubscriptionPeriod', () => {
  it('throws NOT_FOUND when subscription does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(advanceSubscriptionPeriod('sub-missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns SKIPPED when subscription status is not ACTIVE or TRIALING', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...activeSubscription, status: 'CANCELLED' }], rowCount: 1,
    } as never);
    const result = await advanceSubscriptionPeriod('sub-1');
    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'status=CANCELLED' });
  });

  it('returns SKIPPED when auto_renew is false', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...activeSubscription, auto_renew: false }], rowCount: 1,
    } as never);
    const result = await advanceSubscriptionPeriod('sub-1');
    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'auto_renew=false' });
  });

  it('cancels subscription when cancel_at_period_end=true', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...activeSubscription, cancel_at_period_end: true }], rowCount: 1,
    } as never);
    // UPDATE subscriptions + INSERT subscription_events
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

    const result = await advanceSubscriptionPeriod('sub-1');
    expect(result).toMatchObject({ status: 'SKIPPED' });
    if (result.status === 'SKIPPED') {
      expect(result.reason).toContain('cancel_at_period_end=true');
    }

    const cancelSql = mockQuery.mock.calls.find(
      (call) => (call[0] as string).includes("status='CANCELLED'"),
    );
    expect(cancelSql).toBeDefined();
  });

  it('returns SKIPPED when period has not yet ended', async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...activeSubscription, current_period_end: futureDate }], rowCount: 1,
    } as never);
    const result = await advanceSubscriptionPeriod('sub-1');
    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'period has not yet ended' });
  });

  it('advances period by 30 days for monthly billing_interval', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeSubscription], rowCount: 1 } as never);
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as never),
    );
    mockResetUsage.mockResolvedValue(undefined);

    const result = await advanceSubscriptionPeriod('sub-1');
    expect(result.status).toBe('RENEWED');
    if (result.status === 'RENEWED') {
      const diffMs = result.newPeriodEnd.getTime() - result.newPeriodStart.getTime();
      expect(diffMs).toBe(30 * 24 * 60 * 60 * 1000);
    }
  });

  it('sets newPeriodStart to old current_period_end', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeSubscription], rowCount: 1 } as never);
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as never),
    );
    mockResetUsage.mockResolvedValue(undefined);

    const result = await advanceSubscriptionPeriod('sub-1');
    if (result.status === 'RENEWED') {
      expect(result.newPeriodStart.getTime()).toBe(pastDate.getTime());
    }
  });

  it('calls resetUsagePeriod with new period boundaries', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeSubscription], rowCount: 1 } as never);
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as never),
    );
    mockResetUsage.mockResolvedValue(undefined);

    const result = await advanceSubscriptionPeriod('sub-1');
    expect(mockResetUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub-1',
        workspaceId: 'ws-1',
        newPeriodStart: expect.any(Date),
        newPeriodEnd: expect.any(Date),
      }),
    );
    if (result.status === 'RENEWED') {
      expect(mockResetUsage).toHaveBeenCalledWith(
        expect.objectContaining({ newPeriodStart: result.newPeriodStart, newPeriodEnd: result.newPeriodEnd }),
      );
    }
  });

  it('inserts RENEWED subscription_event', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeSubscription], rowCount: 1 } as never);
    const clientQueries: string[] = [];
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) =>
      fn({
        query: vi.fn(async (sql: string) => {
          clientQueries.push(sql);
          return { rows: [], rowCount: 1 };
        }),
      } as never),
    );
    mockResetUsage.mockResolvedValue(undefined);

    await advanceSubscriptionPeriod('sub-1');
    const renewedEvent = clientQueries.find(sql => sql.includes('RENEWED'));
    expect(renewedEvent).toBeDefined();
  });

  it('handles weekly billing_interval (7 days)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...activeSubscription, plan_interval: 'weekly' }], rowCount: 1,
    } as never);
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as never),
    );
    mockResetUsage.mockResolvedValue(undefined);

    const result = await advanceSubscriptionPeriod('sub-1');
    if (result.status === 'RENEWED') {
      const diffMs = result.newPeriodEnd.getTime() - result.newPeriodStart.getTime();
      expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
    }
  });

  it('handles annual billing_interval (365 days)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...activeSubscription, plan_interval: 'annual' }], rowCount: 1,
    } as never);
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as never),
    );
    mockResetUsage.mockResolvedValue(undefined);

    const result = await advanceSubscriptionPeriod('sub-1');
    if (result.status === 'RENEWED') {
      const diffMs = result.newPeriodEnd.getTime() - result.newPeriodStart.getTime();
      expect(diffMs).toBe(365 * 24 * 60 * 60 * 1000);
    }
  });
});

describe('findSubscriptionsDueForRenewal', () => {
  it('queries subscriptions with status ACTIVE/TRIALING, auto_renew=true, period_end past', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'sub-1' }, { id: 'sub-2' }], rowCount: 2,
    } as never);

    const ids = await findSubscriptionsDueForRenewal();
    expect(ids).toEqual(['sub-1', 'sub-2']);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status IN ('ACTIVE', 'TRIALING')");
    expect(sql).toContain('auto_renew = true');
    expect(sql).toContain('cancel_at_period_end = false');
    expect(sql).toContain('current_period_end <= now()');
    expect(params).toContain(50);
  });

  it('returns empty array when none are due', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const ids = await findSubscriptionsDueForRenewal();
    expect(ids).toHaveLength(0);
  });

  it('accepts custom limit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await findSubscriptionsDueForRenewal(10);
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain(10);
  });
});

// ─── processSubscriptionRenewal ───────────────────────────────────────────────

const renewalSubscription = {
  id: 'sub-1',
  workspace_id: 'ws-1',
  status: 'ACTIVE',
  price_minor: '5000',
  currency: 'IRT',
  auto_renew: true,
  cancel_at_period_end: false,
  current_period_end: pastDate,
};

describe('processSubscriptionRenewal', () => {
  it('returns FAILED when subscription not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await processSubscriptionRenewal('sub-missing');
    expect(result).toMatchObject({ status: 'FAILED', error: 'Subscription not found.' });
  });

  it('returns SKIPPED when status is not ACTIVE or TRIALING', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...renewalSubscription, status: 'CANCELLED' }], rowCount: 1,
    } as never);
    const result = await processSubscriptionRenewal('sub-1');
    expect(result).toMatchObject({ status: 'SKIPPED' });
  });

  it('returns SKIPPED when period has not yet ended', async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...renewalSubscription, current_period_end: futureDate }], rowCount: 1,
    } as never);
    const result = await processSubscriptionRenewal('sub-1');
    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'period has not yet ended' });
  });

  it('returns FAILED and marks PAST_DUE when wallet balance is insufficient', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [renewalSubscription], rowCount: 1 } as never);
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => {
      const clientQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [{ account_id: 'acct-1', balance: '1000' }] }) // balance < 5000
        .mockResolvedValue({ rows: [], rowCount: 1 });
      return fn({ query: clientQuery } as never);
    });
    // The charge fails (returns false) → UPDATE to PAST_DUE + INSERT event
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

    const result = await processSubscriptionRenewal('sub-1');
    expect(result).toMatchObject({ status: 'FAILED', error: expect.stringContaining('Insufficient') });
    const pastDueSql = mockQuery.mock.calls.find(
      (call) => (call[0] as string).includes("'PAST_DUE'"),
    );
    expect(pastDueSql).toBeDefined();
  });

  it('returns RENEWED after successful wallet charge when price > 0', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [renewalSubscription], rowCount: 1 } as never);
    // withWorkspaceTransaction: first for the wallet charge (balance sufficient, debit inserted)
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => {
      const clientQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [{ account_id: 'acct-1', balance: '10000' }] })
        .mockResolvedValue({ rows: [], rowCount: 1 });
      return fn({ query: clientQuery } as never);
    });
    // advanceSubscriptionPeriod: query (FOR UPDATE), then withWorkspaceTransaction for period update
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeSubscription }], rowCount: 1 } as never);
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as never),
    );
    mockResetUsage.mockResolvedValue(undefined);

    const result = await processSubscriptionRenewal('sub-1');
    expect(result.status).toBe('RENEWED');
  });

  it('skips wallet charge and goes straight to advance when price_minor is 0', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...renewalSubscription, price_minor: '0' }], rowCount: 1,
    } as never);
    // advanceSubscriptionPeriod internals
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeSubscription }], rowCount: 1 } as never);
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as never),
    );
    mockResetUsage.mockResolvedValue(undefined);

    const result = await processSubscriptionRenewal('sub-1');
    expect(result.status).toBe('RENEWED');
    // No wallet transaction should have been called for the charge
    expect(mockTx).toHaveBeenCalledTimes(1); // only from advanceSubscriptionPeriod
  });
});
