import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(async (_wid: string, _opts: unknown, fn: Function) => fn({ query: vi.fn() })),
}));
vi.mock('../../server/core/idempotency', () => ({ requireIdempotencyKey: vi.fn() }));

import { withWorkspaceTransaction } from '../../server/core/db';
import { consumeSubscriptionUsage } from '../../server/subscriptions/usage';

const mockTx = vi.mocked(withWorkspaceTransaction);
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
