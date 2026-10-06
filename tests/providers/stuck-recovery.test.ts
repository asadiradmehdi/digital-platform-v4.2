import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/providers/dispatch', () => ({ dispatchOrder: vi.fn() }));

import { query } from '../../server/core/db';
import { dispatchOrder } from '../../server/providers/dispatch';
import { recoverStuckQueuedOrders } from '../../server/providers/health';

const mockQuery = vi.mocked(query);
const mockDispatch = vi.mocked(dispatchOrder);

beforeEach(() => vi.resetAllMocks());

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

  it('queries QUEUED orders with no external_order and updated_at below threshold', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await recoverStuckQueuedOrders();
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status = 'QUEUED'");
    expect(sql).toContain('external_orders');
    expect(sql).toContain('updated_at');
  });
});
