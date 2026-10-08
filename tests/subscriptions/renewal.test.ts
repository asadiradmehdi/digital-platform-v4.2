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

/** The tenant-transaction client; every renewal statement must go through it. */
const client = { query: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  mockTx.mockImplementation((async (_ws: string, _u: string | undefined, fn: (c: typeof client) => unknown) => fn(client)) as never);
  mockResetUsage.mockResolvedValue(undefined);
});

/** Queues the locked subscription row, then answers every later statement with an empty result. */
function lockReturns(row: Record<string, unknown> | undefined) {
  client.query.mockResolvedValueOnce({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });
  client.query.mockResolvedValue({ rows: [], rowCount: 1 });
}

const sqlCalls = () => client.query.mock.calls.map(c => String(c[0]));

const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

const activeSubscription = {
  id: 'sub-1',
  workspace_id: 'ws-1',
  status: 'ACTIVE',
  auto_renew: true,
  cancel_at_period_end: false,
  current_period_end: pastDate,
  plan_interval: 'monthly',
  price_minor: '0',
  currency: 'IRT',
};

describe('advanceSubscriptionPeriod', () => {
  it('throws NOT_FOUND when subscription does not exist', async () => {
    lockReturns(undefined);
    await expect(advanceSubscriptionPeriod('sub-missing', 'ws-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns SKIPPED when subscription status is not ACTIVE or TRIALING', async () => {
    lockReturns({ ...activeSubscription, status: 'CANCELLED' });
    const result = await advanceSubscriptionPeriod('sub-1', 'ws-1');
    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'status=CANCELLED' });
  });

  it('returns SKIPPED when auto_renew is false', async () => {
    lockReturns({ ...activeSubscription, auto_renew: false });
    const result = await advanceSubscriptionPeriod('sub-1', 'ws-1');
    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'auto_renew=false' });
  });

  it('cancels subscription when cancel_at_period_end=true', async () => {
    lockReturns({ ...activeSubscription, cancel_at_period_end: true });
    const result = await advanceSubscriptionPeriod('sub-1', 'ws-1');
    expect(result).toMatchObject({ status: 'SKIPPED' });
    if (result.status === 'SKIPPED') expect(result.reason).toContain('cancel_at_period_end=true');
    expect(sqlCalls().find(sql => sql.includes("status='CANCELLED'"))).toBeDefined();
  });

  it('returns SKIPPED when period has not yet ended', async () => {
    lockReturns({ ...activeSubscription, current_period_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
    const result = await advanceSubscriptionPeriod('sub-1', 'ws-1');
    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'period has not yet ended' });
  });

  it('advances period by 30 days for monthly billing_interval, starting at the old period end', async () => {
    lockReturns(activeSubscription);
    const result = await advanceSubscriptionPeriod('sub-1', 'ws-1');
    expect(result.status).toBe('RENEWED');
    if (result.status === 'RENEWED') {
      expect(result.newPeriodStart.getTime()).toBe(pastDate.getTime());
      expect(result.newPeriodEnd.getTime() - result.newPeriodStart.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    }
  });

  it('calls resetUsagePeriod with the new period boundaries on the same transaction client', async () => {
    lockReturns(activeSubscription);
    const result = await advanceSubscriptionPeriod('sub-1', 'ws-1');
    expect(result.status).toBe('RENEWED');
    if (result.status === 'RENEWED') {
      expect(mockResetUsage).toHaveBeenCalledWith(
        { subscriptionId: 'sub-1', workspaceId: 'ws-1', newPeriodStart: result.newPeriodStart, newPeriodEnd: result.newPeriodEnd },
        client,
      );
    }
  });

  it('inserts RENEWED subscription_event', async () => {
    lockReturns(activeSubscription);
    await advanceSubscriptionPeriod('sub-1', 'ws-1');
    expect(sqlCalls().find(sql => sql.includes('RENEWED'))).toBeDefined();
  });

  it('handles weekly and annual billing intervals', async () => {
    lockReturns({ ...activeSubscription, plan_interval: 'weekly' });
    const weekly = await advanceSubscriptionPeriod('sub-1', 'ws-1');
    lockReturns({ ...activeSubscription, plan_interval: 'annual' });
    const annual = await advanceSubscriptionPeriod('sub-1', 'ws-1');
    if (weekly.status === 'RENEWED') expect(weekly.newPeriodEnd.getTime() - weekly.newPeriodStart.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    if (annual.status === 'RENEWED') expect(annual.newPeriodEnd.getTime() - annual.newPeriodStart.getTime()).toBe(365 * 24 * 60 * 60 * 1000);
    expect(weekly.status).toBe('RENEWED');
    expect(annual.status).toBe('RENEWED');
  });

  it('locks the subscription inside the workspace RLS transaction (regression: pool lock saw no row)', async () => {
    lockReturns(activeSubscription);
    await advanceSubscriptionPeriod('sub-1', 'ws-9');
    expect(mockTx).toHaveBeenCalledWith('ws-9', undefined, expect.any(Function));
    expect(mockQuery).not.toHaveBeenCalled();
    expect(sqlCalls()[0]).toContain('FOR UPDATE OF s');
  });
});

describe('findSubscriptionsDueForRenewal', () => {
  it('scans through system_due_subscription_renewals() and returns (subscription, workspace) pairs', async () => {
    // Regression: subscriptions has FORCE RLS; the plain-pool cross-tenant scan always found nothing.
    mockQuery.mockResolvedValueOnce({
      rows: [{ subscription_id: 'sub-1', workspace_id: 'ws-1' }, { subscription_id: 'sub-2', workspace_id: 'ws-2' }], rowCount: 2,
    } as never);

    const due = await findSubscriptionsDueForRenewal();
    expect(due).toEqual([{ subscriptionId: 'sub-1', workspaceId: 'ws-1' }, { subscriptionId: 'sub-2', workspaceId: 'ws-2' }]);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM system_due_subscription_renewals($1)');
    expect(sql).not.toMatch(/FROM subscriptions/);
    expect(params).toEqual([50]);
  });

  it('returns empty array when none are due', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    expect(await findSubscriptionsDueForRenewal()).toHaveLength(0);
  });

  it('accepts custom limit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await findSubscriptionsDueForRenewal(10);
    expect(mockQuery.mock.calls[0][1]).toEqual([10]);
  });
});

// ─── processSubscriptionRenewal ───────────────────────────────────────────────

const renewalSubscription = { ...activeSubscription, price_minor: '5000' };

describe('processSubscriptionRenewal', () => {
  it('returns FAILED when subscription not found', async () => {
    lockReturns(undefined);
    const result = await processSubscriptionRenewal('sub-missing', 'ws-1');
    expect(result).toMatchObject({ status: 'FAILED', error: 'Subscription not found.' });
  });

  it('returns SKIPPED when status is not ACTIVE or TRIALING', async () => {
    lockReturns({ ...renewalSubscription, status: 'CANCELLED' });
    const result = await processSubscriptionRenewal('sub-1', 'ws-1');
    expect(result).toMatchObject({ status: 'SKIPPED' });
  });

  it('returns SKIPPED when period has not yet ended', async () => {
    lockReturns({ ...renewalSubscription, current_period_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
    const result = await processSubscriptionRenewal('sub-1', 'ws-1');
    expect(result).toMatchObject({ status: 'SKIPPED', reason: 'period has not yet ended' });
  });

  it('returns FAILED and marks PAST_DUE when wallet balance is insufficient', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [renewalSubscription] }) // lock subscription
      .mockResolvedValueOnce({ rows: [{ account_id: 'acct-1' }] }) // lock MAIN
      .mockResolvedValueOnce({ rows: [{ balance: '1000' }] }) // balance < 5000
      .mockResolvedValue({ rows: [], rowCount: 1 });

    const result = await processSubscriptionRenewal('sub-1', 'ws-1');
    expect(result).toMatchObject({ status: 'FAILED', error: expect.stringContaining('Insufficient') });
    expect(sqlCalls().find(sql => sql.includes("'PAST_DUE'"))).toBeDefined();
    expect(sqlCalls().find(sql => sql.includes('INSERT INTO ledger_entries'))).toBeUndefined();
  });

  it('returns RENEWED after a successful wallet charge, all in one workspace transaction', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [renewalSubscription] })
      .mockResolvedValueOnce({ rows: [{ account_id: 'acct-1' }] })
      .mockResolvedValueOnce({ rows: [{ balance: '10000' }] })
      .mockResolvedValue({ rows: [], rowCount: 1 });

    const result = await processSubscriptionRenewal('sub-1', 'ws-1');
    expect(result.status).toBe('RENEWED');
    expect(mockTx).toHaveBeenCalledTimes(1);
    expect(mockTx).toHaveBeenCalledWith('ws-1', undefined, expect.any(Function));
    const sqls = sqlCalls();
    expect(sqls.findIndex(sql => sql.includes('INSERT INTO ledger_entries'))).toBeLessThan(sqls.findIndex(sql => sql.includes("'RENEWED'")));
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('locks the MAIN account with FOR UPDATE OF la before summing the balance', async () => {
    // Regression: lock and SUM ... GROUP BY were one statement, which PostgreSQL rejects
    // ("FOR UPDATE is not allowed with GROUP BY clause"), so every paid renewal failed.
    client.query
      .mockResolvedValueOnce({ rows: [renewalSubscription] })
      .mockResolvedValueOnce({ rows: [{ account_id: 'acct-1' }] })
      .mockResolvedValueOnce({ rows: [{ balance: '100' }] })
      .mockResolvedValue({ rows: [], rowCount: 1 });

    await processSubscriptionRenewal('sub-1', 'ws-1');
    const sqls = sqlCalls();
    expect(sqls[1]).toContain('FOR UPDATE OF la');
    expect(sqls[1]).not.toMatch(/GROUP BY|SUM\(/);
    expect(sqls[2]).toMatch(/SUM\(/);
  });

  it('skips wallet charge and goes straight to advance when price_minor is 0', async () => {
    lockReturns({ ...renewalSubscription, price_minor: '0' });
    const result = await processSubscriptionRenewal('sub-1', 'ws-1');
    expect(result.status).toBe('RENEWED');
    expect(sqlCalls().find(sql => sql.includes('ledger'))).toBeUndefined();
  });

  it('never charges a subscription that is set to cancel at period end', async () => {
    lockReturns({ ...renewalSubscription, cancel_at_period_end: true });
    const result = await processSubscriptionRenewal('sub-1', 'ws-1');
    expect(result).toMatchObject({ status: 'SKIPPED' });
    expect(sqlCalls().find(sql => sql.includes('ledger'))).toBeUndefined();
    expect(sqlCalls().find(sql => sql.includes("status='CANCELLED'"))).toBeDefined();
  });
});
