/**
 * Unit tests for server/subscriptions/service.ts
 * createSubscription, cancelSubscription, listSubscriptions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClientQuery = vi.fn();
const mockWithWorkspaceTransaction = vi.fn(async (_ws: string, _opts: unknown, fn: (client: { query: typeof mockClientQuery }) => Promise<unknown>) => fn({ query: mockClientQuery }));

// Invoice issuing has its own tests (tests/payments/invoice.test.ts, tests/integration/invoices.pg.test.ts).
vi.mock('../../server/payments/invoice', () => ({ issueOrderInvoice: vi.fn(), issueTopupReceipt: vi.fn(), issueSubscriptionInvoice: vi.fn() }));
vi.mock('../../server/core/db', () => ({
  withWorkspaceTransaction: (ws: string, opts: unknown, fn: (client: { query: typeof mockClientQuery }) => Promise<unknown>) => mockWithWorkspaceTransaction(ws, opts, fn),
}));

vi.mock('../../server/core/idempotency', () => ({
  requireIdempotencyKey: vi.fn((key: string) => {
    if (!key || key.length < 16) throw Object.assign(new Error('Idempotency-Key required'), { code: 'VALIDATION_ERROR' });
    return key;
  }),
}));

import { createSubscription, cancelSubscription, listSubscriptions } from '../../server/subscriptions/service';
import { issueSubscriptionInvoice } from '../../server/payments/invoice';

beforeEach(() => {
  vi.clearAllMocks();
  mockWithWorkspaceTransaction.mockImplementation(async (_ws, _opts, fn) => fn({ query: mockClientQuery }));
});

// ─── createSubscription ───────────────────────────────────────────────────────

describe('createSubscription', () => {
  it('returns existing row when idempotency key matches', async () => {
    const isoKey = 'abcdef1234567890';
    mockClientQuery
      .mockResolvedValueOnce({ rows: [{ id: 'sub-existing', status: 'ACTIVE' }], rowCount: 1 }) // existing check
    ;
    const result = await createSubscription({
      workspaceId: 'ws-1',
      planId: 'plan-1',
      idempotencyKey: isoKey,
    });
    expect(result).toEqual({ id: 'sub-existing', status: 'ACTIVE' });
    // Only the idempotency check query should have run (no plan lookup or insert)
    expect(mockClientQuery).toHaveBeenCalledTimes(1);
  });

  function routeQueries(opts: { priceMinor: string; balance: string; subId?: string; status?: string }) {
    const sqlCalls: Array<[string, unknown[]]> = [];
    mockClientQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      sqlCalls.push([sql, params]);
      if (sql.includes('FROM subscriptions WHERE workspace_id=$1 AND idempotency_key')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM plans')) return { rows: [{ id: 'plan-1', active: true, price_minor: opts.priceMinor, currency: 'IRT', price_version: 1, pricing_rule_id: null }], rowCount: 1 };
      if (sql.includes('INSERT INTO subscriptions')) return { rows: [{ id: opts.subId ?? 'sub-new', status: opts.status ?? 'ACTIVE' }], rowCount: 1 };
      if (sql.includes('FROM wallets w')) return { rows: [{ account_id: 'acct-1', wallet_currency: 'IRR' }], rowCount: 1 };
      if (sql.includes('FROM ledger_entries')) return { rows: [{ balance: opts.balance }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    return sqlCalls;
  }

  it('inserts a new subscription and charges the wallet (IRT plan price converted to IRR)', async () => {
    // Regression (H-6): a paid plan used to be activated without charging anything.
    const sqlCalls = routeQueries({ priceMinor: '5000', balance: '50000' });
    const result = await createSubscription({ workspaceId: 'ws-1', planId: 'plan-1', idempotencyKey: 'freshkey1234567890' });
    expect(result).toEqual({ id: 'sub-new', status: 'ACTIVE' });
    const debit = sqlCalls.find(([sql]) => sql.includes('INSERT INTO ledger_entries'));
    expect(debit?.[1].slice(1, 7)).toEqual(['DEBIT', '50000', 'IRR', 'SUBSCRIPTION', 'sub-new', 'subscription:sub-new']);
    expect(sqlCalls.some(([sql]) => sql.includes("'CHARGED'"))).toBe(true);
    // The charge issues the subscription's sale invoice on the same transaction.
    expect(vi.mocked(issueSubscriptionInvoice)).toHaveBeenCalledWith(expect.anything(), { workspaceId: 'ws-1', subscriptionId: 'sub-new', paidMinor: 5000n, currency: 'IRT', method: 'WALLET' });
  });

  it('refuses a paid plan with 402 when the wallet balance is short (transaction rolls back)', async () => {
    const sqlCalls = routeQueries({ priceMinor: '5000', balance: '49999' });
    await expect(createSubscription({ workspaceId: 'ws-1', planId: 'plan-1', idempotencyKey: 'shortbalance123456' })).rejects.toMatchObject({ code: 'PAYMENT_REQUIRED' });
    expect(sqlCalls.some(([sql]) => sql.includes('INSERT INTO ledger_entries'))).toBe(false);
  });

  it('does not charge during a trial', async () => {
    const sqlCalls = routeQueries({ priceMinor: '5000', balance: '0', status: 'TRIALING' });
    const result = await createSubscription({ workspaceId: 'ws-1', planId: 'plan-1', idempotencyKey: 'trialnocharge12345', trialEndsAt: new Date(Date.now() + 86400000) });
    expect(result.status).toBe('TRIALING');
    expect(sqlCalls.some(([sql]) => sql.includes('ledger_entries'))).toBe(false);
  });

  it('throws NOT_FOUND when plan is inactive', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no existing
      .mockResolvedValueOnce({ rows: [{ id: 'plan-1', active: false }], rowCount: 1 }) // inactive plan
    ;
    await expect(
      createSubscription({ workspaceId: 'ws-1', planId: 'plan-1', idempotencyKey: 'freshkey123456789a' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws VALIDATION_ERROR when idempotency key is too short', async () => {
    await expect(
      createSubscription({ workspaceId: 'ws-1', planId: 'plan-1', idempotencyKey: 'short' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    // Transaction should not have started
    expect(mockWithWorkspaceTransaction).not.toHaveBeenCalled();
  });

  it('uses ACTIVE initial status when no trialEndsAt is provided', async () => {
    const isoKey = 'activestatus1234567';
    const sqlCalls: Array<[string, unknown[]]> = [];
    mockClientQuery.mockImplementation(async (sql: string, params: unknown[]) => {
      sqlCalls.push([sql, params]);
      if (sqlCalls.length === 1) return { rows: [], rowCount: 0 };
      if (sqlCalls.length === 2) return { rows: [{ id: 'plan-1', active: true, price_minor: '0', currency: 'IRT', price_generated_at: new Date(), price_version: 1, pricing_rule_id: null }], rowCount: 1 };
      return { rows: [{ id: 'sub-new', status: 'ACTIVE' }], rowCount: 1 };
    });
    await createSubscription({ workspaceId: 'ws-1', planId: 'plan-1', idempotencyKey: isoKey });
    const insertCall = sqlCalls.find(([sql]) => sql.includes('INSERT INTO subscriptions'));
    expect(insertCall).toBeDefined();
    if (insertCall) {
      // $10 in the parameterised INSERT is initialStatus; should be 'ACTIVE' when no trialEndsAt
      expect(insertCall[1]).toContain('ACTIVE');
      expect(insertCall[1]).not.toContain('TRIALING');
    }
  });

  it('uses TRIALING initial status when trialEndsAt is provided', async () => {
    const isoKey = 'trialstatus1234567a';
    const sqlCalls: Array<[string, unknown[]]> = [];
    mockClientQuery.mockImplementation(async (sql: string, params: unknown[]) => {
      sqlCalls.push([sql, params]);
      if (sqlCalls.length === 1) return { rows: [], rowCount: 0 };
      if (sqlCalls.length === 2) return { rows: [{ id: 'plan-1', active: true, price_minor: '0', currency: 'IRT', price_generated_at: new Date(), price_version: 1, pricing_rule_id: null }], rowCount: 1 };
      return { rows: [{ id: 'sub-new', status: 'TRIALING' }], rowCount: 1 };
    });
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await createSubscription({ workspaceId: 'ws-1', planId: 'plan-1', idempotencyKey: isoKey, trialEndsAt: trialEnd });
    const insertCall = sqlCalls.find(([sql]) => sql.includes('INSERT INTO subscriptions'));
    expect(insertCall).toBeDefined();
    if (insertCall) {
      expect(insertCall[1]).toContain('TRIALING');
    }
  });

  it('inserts the entitlement snapshot for the new subscription id', async () => {
    const sqlCalls = routeQueries({ priceMinor: '1000', balance: '10000', subId: 'sub-snap' });
    await createSubscription({ workspaceId: 'ws-1', planId: 'plan-1', idempotencyKey: 'snapshotkey12345678' });
    const snapshotCall = sqlCalls.find(([sql]) => sql.includes('subscription_entitlement_snapshots'));
    expect(snapshotCall).toBeDefined();
    expect(snapshotCall![0].toLowerCase()).toContain('insert');
    expect(snapshotCall![1]).toContain('sub-snap');
  });
});

// ─── cancelSubscription ───────────────────────────────────────────────────────

describe('cancelSubscription', () => {
  it('cancels an active subscription and inserts event', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', status: 'ACTIVE' }], rowCount: 1 }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', status: 'CANCELLED' }], rowCount: 1 }) // UPDATE
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // event INSERT
    ;
    const result = await cancelSubscription('sub-1', 'ws-1');
    expect(result.status).toBe('CANCELLED');
    expect(mockClientQuery).toHaveBeenCalledTimes(3);
  });

  it('is idempotent — returns success when subscription is already cancelled', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', status: 'CANCELLED' }], rowCount: 1 }) // SELECT FOR UPDATE
    ;
    const result = await cancelSubscription('sub-1', 'ws-1');
    expect(result.status).toBe('CANCELLED');
    expect(mockClientQuery).toHaveBeenCalledTimes(1);
  });

  it('throws CONFLICT when subscription is expired', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'sub-1', status: 'EXPIRED' }], rowCount: 1 });
    await expect(cancelSubscription('sub-expired', 'ws-1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('throws NOT_FOUND when subscription does not exist', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT returns nothing
    await expect(cancelSubscription('sub-ghost', 'ws-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ─── listSubscriptions ────────────────────────────────────────────────────────

describe('listSubscriptions', () => {
  it('returns subscription rows joined with plan names', async () => {
    const rows = [
      { id: 'sub-1', status: 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: new Date(), trialEndsAt: null, planId: 'plan-1', planName: 'Pro' },
    ];
    mockClientQuery.mockResolvedValueOnce({ rows, rowCount: 1 });
    const result = await listSubscriptions('ws-1');
    expect(result).toHaveLength(1);
    expect(result[0].planName).toBe('Pro');
  });

  it('returns empty array when workspace has no subscriptions', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const result = await listSubscriptions('ws-1');
    expect(result).toEqual([]);
  });
});
