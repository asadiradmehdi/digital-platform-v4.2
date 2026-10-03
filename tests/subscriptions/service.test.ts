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
    ;
    const result = await createSubscription({
      workspaceId: 'ws-1',
      planId: 'plan-1',
      idempotencyKey: isoKey,
    });
    expect(result).toEqual({ id: 'sub-new', status: 'TRIALING' });
    expect(mockClientQuery).toHaveBeenCalledTimes(4);
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
});

// ─── cancelSubscription ───────────────────────────────────────────────────────

describe('cancelSubscription', () => {
  it('cancels an active subscription and inserts event', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', status: 'CANCELLED' }], rowCount: 1 }) // update
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // event
    ;
    const result = await cancelSubscription('sub-1', 'ws-1');
    expect(result.status).toBe('CANCELLED');
    expect(mockClientQuery).toHaveBeenCalledTimes(2);
  });

  it('throws NOT_FOUND when subscription is already cancelled or not found', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // nothing updated
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
