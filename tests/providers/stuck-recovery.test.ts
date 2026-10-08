import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withTenantTransaction: vi.fn() }));
vi.mock('../../server/providers/dispatch', () => ({ dispatchOrder: vi.fn() }));

import { query, withTenantTransaction } from '../../server/core/db';
import { dispatchOrder } from '../../server/providers/dispatch';
import { recoverStuckQueuedOrders, pollProcessingOrders } from '../../server/providers/health';

const mockQuery = vi.mocked(query);
const mockDispatch = vi.mocked(dispatchOrder);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(withTenantTransaction).mockImplementation((async (_ws: string, _u: string | undefined, fn: (c: unknown) => unknown) => fn({ query: mockQuery })) as never);
});

describe('recoverStuckQueuedOrders', () => {
  it('returns empty array when no stuck orders', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const results = await recoverStuckQueuedOrders();
    expect(results).toHaveLength(0);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('dispatches each stuck order and returns dispatched result', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { order_id: 'ord-1', workspace_id: 'ws-1', service_id: 'svc-1' },
        { order_id: 'ord-2', workspace_id: 'ws-1', service_id: 'svc-2' },
      ],
      rowCount: 2,
    } as never);
    mockDispatch.mockResolvedValue(undefined as never);

    const results = await recoverStuckQueuedOrders(15, 20);
    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'ord-1', workspaceId: 'ws-1', serviceId: 'svc-1' }),
    );
    expect(results).toEqual([
      { orderId: 'ord-1', result: 'dispatched' },
      { orderId: 'ord-2', result: 'dispatched' },
    ]);
  });

  it('passes staleMinutes and limit as SQL parameters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await recoverStuckQueuedOrders(30, 5);
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain(30);
    expect(params).toContain(5);
  });

  it('marks order FAILED and records event when dispatch throws UNAVAILABLE', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ order_id: 'ord-1', workspace_id: 'ws-1', service_id: 'svc-1' }],
      rowCount: 1,
    } as never);
    mockDispatch.mockRejectedValueOnce(new Error('UNAVAILABLE: no providers'));
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

    const results = await recoverStuckQueuedOrders();
    expect(results[0]).toMatchObject({ orderId: 'ord-1', result: expect.stringContaining('error') });
    const failSql = mockQuery.mock.calls.find(
      (call) => (call[0] as string).includes("'FAILED'"),
    );
    expect(failSql).toBeDefined();
  });

  it('records error result but does not mark FAILED for non-UNAVAILABLE errors', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ order_id: 'ord-1', workspace_id: 'ws-1', service_id: 'svc-1' }],
      rowCount: 1,
    } as never);
    mockDispatch.mockRejectedValueOnce(new Error('timeout'));

    const results = await recoverStuckQueuedOrders();
    expect(results[0].result).toContain('error');
    const failSql = mockQuery.mock.calls.find(
      (call) => (call[0] as string).includes("status='FAILED'"),
    );
    expect(failSql).toBeUndefined();
  });

  it('scans through the system_stale_queued_orders() function, not the RLS-protected orders table', async () => {
    // Regression: orders has FORCE RLS; the plain-pool cross-tenant scan always found 0 stuck orders.
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await recoverStuckQueuedOrders();
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM system_stale_queued_orders($1, $2)');
    expect(sql).not.toMatch(/FROM orders/);
    expect(params).toEqual([15, 20]);
  });

  it('marks an exhausted order FAILED inside that order\'s workspace context', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ order_id: 'ord-1', workspace_id: 'ws-77', service_id: 'svc-1' }], rowCount: 1 } as never);
    mockDispatch.mockRejectedValueOnce(new Error('UNAVAILABLE: no providers'));
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ord-1' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recoverStuckQueuedOrders();
    expect(vi.mocked(withTenantTransaction)).toHaveBeenCalledWith('ws-77', undefined, expect.any(Function));
    expect(String(mockQuery.mock.calls[1][0])).toContain("SET status='FAILED'");
    expect(String(mockQuery.mock.calls[2][0])).toContain('INSERT INTO order_events');
  });
});

describe('pollProcessingOrders', () => {
  // Regression: the orders join and the order status updates ran on the plain pool, so under the
  // production role no processing order was ever found or completed.
  it('scans and completes orders inside the workspace context, recording the real from-status', async () => {
    const adapter = { status: vi.fn().mockResolvedValue({ status: 'COMPLETED' }) };
    mockQuery
      .mockResolvedValueOnce({ rows: [{ order_id: 'ord-1', external_order_id: 'ext-1' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ status: 'PROVIDER_SUBMITTED' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const results = await pollProcessingOrders(adapter as never, 'prov-1', 'ws-3');
    expect(results).toEqual([{ orderId: 'ord-1', externalOrderId: 'ext-1', status: 'COMPLETED' }]);
    expect(vi.mocked(withTenantTransaction).mock.calls.map(c => c[0])).toEqual(['ws-3', 'ws-3']);
    expect(mockQuery.mock.calls[4][1]).toEqual(['ord-1', 'PROVIDER_SUBMITTED', 'COMPLETED', { source: 'provider_poll', externalOrderId: 'ext-1' }]);
  });
});
