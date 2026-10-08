import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(async (_wid: string, _opts: unknown, fn: Function) => fn({ query: vi.fn() })),
}));
vi.mock('../../server/core/idempotency', () => ({ requireIdempotencyKey: vi.fn() }));

import { query, withWorkspaceTransaction } from '../../server/core/db';
import { consumeSubscriptionUsage, resetUsagePeriod } from '../../server/subscriptions/usage';

const mockTx = vi.mocked(withWorkspaceTransaction);
const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

const baseInput = {
  subscriptionId: 'sub-1',
  workspaceId: 'ws-1',
  metricKey: 'api_calls',
  quantity: 10n,
  periodStart: new Date('2026-10-01'),
  periodEnd: new Date('2026-10-31'),
  limitQuantity: 100n,
  idempotencyKey: 'usage-key-1',
};

describe('consumeSubscriptionUsage', () => {
  it('throws VALIDATION_ERROR when quantity is zero', async () => {
    await expect(
      consumeSubscriptionUsage({ ...baseInput, quantity: 0n })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns duplicate:true when idempotency key already exists', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'evt-existing' }] }); // duplicate check
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    const result = await consumeSubscriptionUsage(baseInput);
    expect(result.duplicate).toBe(true);
    expect(result.usageEventId).toBe('evt-existing');
    expect(clientQuery).toHaveBeenCalledTimes(1);
  });

  it('throws CONFLICT when usage limit is exceeded', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                          // no duplicate
      .mockResolvedValueOnce({ rows: [{ id: 'cnt-1', consumed: '95', limit_quantity: '100', rollover_quantity: '0' }] }); // counter
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    // 95 consumed + 10 requested > 100 limit → blocked
    await expect(consumeSubscriptionUsage(baseInput)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('allows and records usage within limit', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                           // no duplicate
      .mockResolvedValueOnce({ rows: [{ id: 'cnt-1', consumed: '50', limit_quantity: '100', rollover_quantity: '0' }] }) // counter
      .mockResolvedValueOnce({ rows: [{ id: 'cnt-1', consumed: '60' }] }) // upsert counter
      .mockResolvedValueOnce({ rows: [{ id: 'evt-new' }] });         // insert event
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    const result = await consumeSubscriptionUsage(baseInput);
    expect(result.allowed).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.usageEventId).toBe('evt-new');
    expect(result.consumed).toBe(60n);
  });

  it('allows unlimited usage when limitQuantity is null', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                           // no duplicate
      .mockResolvedValueOnce({ rows: [] })                           // no existing counter (defaults to unlimited)
      .mockResolvedValueOnce({ rows: [{ id: 'cnt-1', consumed: '10' }] }) // upsert
      .mockResolvedValueOnce({ rows: [{ id: 'evt-new' }] });         // event
    mockTx.mockImplementationOnce(async (_wid, _opts, fn) => fn({ query: clientQuery } as never));

    const result = await consumeSubscriptionUsage({ ...baseInput, limitQuantity: null });
    expect(result.allowed).toBe(true);
  });
});

describe('resetUsagePeriod', () => {
  const resetInput = {
    subscriptionId: 'sub-1',
    workspaceId: 'ws-1',
    newPeriodStart: new Date('2026-11-01'),
    newPeriodEnd: new Date('2026-11-30'),
  };

  it('inserts new-period counters with consumed=0 for each existing metric', async () => {
    const insertedRows: unknown[][] = [];
    const clientQuery = vi.fn()
      // SELECT DISTINCT metric_key rows
      .mockResolvedValueOnce({ rows: [{ metric_key: 'api_calls', limit_quantity: '100' }, { metric_key: 'storage_gb', limit_quantity: null }], rowCount: 2 })
      // INSERT for api_calls
      .mockImplementation(async (_sql: string, params: unknown[]) => {
        insertedRows.push(params);
        return { rows: [], rowCount: 1 };
      });

    mockTx.mockImplementationOnce(async (_wid, _userId, fn) => fn({ query: clientQuery } as never));

    await resetUsagePeriod(resetInput);

    // Two INSERT calls (one per metric key)
    const insertCalls = clientQuery.mock.calls.filter((args) => String(args[0]).includes('INSERT INTO usage_counters'));
    expect(insertCalls).toHaveLength(2);
    const [_sql, params] = insertCalls[0];
    expect(params).toContain('0');         // consumed='0' (string for BigInt safety)
    expect(params).toContain('sub-1');
    expect(params).toContain('ws-1');
  });

  it('uses ON CONFLICT DO NOTHING for idempotency', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ metric_key: 'api_calls', limit_quantity: '50' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // conflict — do nothing
    mockTx.mockImplementationOnce(async (_wid, _userId, fn) => fn({ query: clientQuery } as never));

    // Should not throw even when row already exists
    await expect(resetUsagePeriod(resetInput)).resolves.not.toThrow();
    const insertCall = clientQuery.mock.calls.find((args) => String(args[0]).includes('ON CONFLICT'));
    expect(insertCall).toBeDefined();
    expect(insertCall![0]).toContain('DO NOTHING');
  });

  it('updates subscriptions table with new period dates', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // no metrics — nothing to reset
    mockTx.mockImplementationOnce(async (_wid, _userId, fn) => fn({ query: clientQuery } as never));

    await resetUsagePeriod(resetInput);

    // Regression: this UPDATE ran on the plain pool, where RLS on subscriptions matched no row.
    expect(mockQuery).not.toHaveBeenCalled();
    const [sql, params] = clientQuery.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('UPDATE subscriptions');
    expect(sql).toContain('current_period_start');
    expect(sql).toContain('current_period_end');
    expect(params).toContain('sub-1');
  });

  it('carries rolloverQuantity into the new period counter', async () => {
    let insertParams: unknown[] = [];
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ metric_key: 'tokens', limit_quantity: '1000' }], rowCount: 1 })
      .mockImplementation(async (sql: string, p: unknown[]) => { if (sql.includes('INSERT INTO usage_counters')) insertParams = p; return { rows: [], rowCount: 1 }; });
    mockTx.mockImplementationOnce(async (_wid, _userId, fn) => fn({ query: clientQuery } as never));

    await resetUsagePeriod({ ...resetInput, rolloverQuantity: 200n });

    expect(insertParams).toContain('200');
  });
});

describe('resetUsagePeriod tenant context', () => {
  it('opens a workspace transaction when none is passed, and joins the caller\'s when one is', async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    mockTx.mockImplementationOnce(async (_wid, _userId, fn) => fn({ query: clientQuery } as never));
    const input = { subscriptionId: 'sub-1', workspaceId: 'ws-r', newPeriodStart: new Date(), newPeriodEnd: new Date() };
    await resetUsagePeriod(input);
    expect(mockTx).toHaveBeenCalledWith('ws-r', undefined, expect.any(Function));

    mockTx.mockClear();
    const callerClient = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await resetUsagePeriod(input, callerClient as never);
    expect(mockTx).not.toHaveBeenCalled();
    expect(callerClient.query).toHaveBeenCalledTimes(2);
  });
});
