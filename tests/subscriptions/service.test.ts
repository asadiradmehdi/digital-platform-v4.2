/**
 * Unit tests for server/subscriptions/service.ts
 * createSubscription, cancelSubscription, listSubscriptions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClientQuery = vi.fn();
const mockWithWorkspaceTransaction = vi.fn(async (_ws: string, _opts: unknown, fn: (client: { query: typeof mockClientQuery }) => Promise<unknown>) => fn({ query: mockClientQuery }));

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

  it('inserts a new subscription when plan is active and key is fresh', async () => {
    const isoKey = 'freshkey1234567890';
    mockClientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no existing
      .mockResolvedValueOnce({
        rows: [{
          id: 'plan-1',
          active: true,
          price_minor: '5000',
          currency: 'IRT',
          price_generated_at: new Date(),
          price_version: 1,
          pricing_rule_id: null,
        }],
        rowCount: 1,
      }) // plan lookup
      .mockResolvedValueOnce({ rows: [{ id: 'sub-new', status: 'TRIALING' }], rowCount: 1 }) // insert
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // event insert
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // entitlement snapshot insert
    ;
    const result = await createSubscription({
      workspaceId: 'ws-1',
      planId: 'plan-1',
      idempotencyKey: isoKey,
    });
    expect(result).toEqual({ id: 'sub-new', status: 'TRIALING' });
    expect(mockClientQuery).toHaveBeenCalledTimes(5);
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
