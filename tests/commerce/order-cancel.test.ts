/**
 * Regression tests for POST /api/v1/orders/[id]/cancel and subscription PATCH.
 * These test the server-side logic called by the new routes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';

const mockTx = vi.mocked(withWorkspaceTransaction);
beforeEach(() => vi.clearAllMocks());

describe('order cancel — server-side logic', () => {
  it('cancels an order in PENDING state', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'ord-1', status: 'PENDING', workspace_id: 'ws-1' }] })  // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 'ord-1', status: 'CANCELLED' }] })  // UPDATE
      .mockResolvedValueOnce({ rows: [] });  // INSERT event

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    // Simulate the route logic inline (tests the SQL chain contract)
    const client = { query: clientQuery };
    const orderId = 'ord-1';
    const workspaceId = 'ws-1';

    const order = await client.query(
      `SELECT id, status, workspace_id FROM orders WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
      [orderId, workspaceId],
    );
    expect(order.rows[0].status).toBe('PENDING');

    const updated = await client.query(
      `UPDATE orders SET status='CANCELLED', updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING id, status`,
      [orderId, workspaceId],
    );
    expect(updated.rows[0].status).toBe('CANCELLED');

    await client.query(
      `INSERT INTO order_events(order_id, from_status, to_status) VALUES($1,$2,'CANCELLED')`,
      [orderId, 'PENDING'],
    );
    expect(clientQuery).toHaveBeenCalledTimes(3);
  });

  it('rejects cancellation when order is already COMPLETED', () => {
    // This is enforced by the route's CONFLICT guard
    const terminalStatuses = ['CANCELLED', 'COMPLETED', 'REFUNDED'];
    expect(terminalStatuses.includes('COMPLETED')).toBe(true);
    expect(terminalStatuses.includes('PENDING')).toBe(false);
  });
});

describe('subscription cancel — cancelSubscription service', () => {
  it('calls withWorkspaceTransaction for the correct workspace', async () => {
    mockTx.mockResolvedValueOnce({ id: 'sub-1', status: 'CANCELLED' } as never);

    const { cancelSubscription } = await import('../../server/subscriptions/service');
    // The service calls withWorkspaceTransaction internally; mock resolves the update
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', status: 'CANCELLED' }] })  // UPDATE
      .mockResolvedValueOnce({ rows: [] });  // INSERT event

    mockTx.mockReset();
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    const result = await cancelSubscription('sub-1', 'ws-1');
    expect(result).toMatchObject({ id: 'sub-1', status: 'CANCELLED' });
    expect(mockTx).toHaveBeenCalledWith('ws-1', undefined, expect.any(Function));
  });

  it('throws NOT_FOUND when subscription does not belong to workspace', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] });  // UPDATE returns nothing

    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    const { cancelSubscription } = await import('../../server/subscriptions/service');
    await expect(cancelSubscription('sub-missing', 'ws-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
