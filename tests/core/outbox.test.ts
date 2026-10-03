/**
 * Unit tests for server/core/outbox.ts — enqueueEvent
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
import { enqueueEvent } from '../../server/core/outbox';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('enqueueEvent', () => {
  it('inserts an outbox row and returns the generated id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'evt-uuid-1' }], rowCount: 1 } as never);
    const id = await enqueueEvent({
      aggregateType: 'order',
      aggregateId: 'ord-1',
      eventType: 'order.created',
      payload: { workspaceId: 'ws-1' },
    });
    expect(id).toBe('evt-uuid-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO outbox_events'),
      ['order', 'ord-1', 'order.created', { workspaceId: 'ws-1' }],
    );
  });

  it('inserts with an empty payload object', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'evt-uuid-2' }], rowCount: 1 } as never);
    const id = await enqueueEvent({
      aggregateType: 'payment',
      aggregateId: 'pay-1',
      eventType: 'payment.paid',
      payload: {},
    });
    expect(id).toBe('evt-uuid-2');
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[3]).toEqual({});
  });

  it('includes aggregate_type and event_type in SQL', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'evt-uuid-3' }], rowCount: 1 } as never);
    await enqueueEvent({
      aggregateType: 'subscription',
      aggregateId: 'sub-1',
      eventType: 'subscription.cancelled',
      payload: { reason: 'user_request' },
    });
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('aggregate_type');
    expect(sql).toContain('aggregate_id');
    expect(sql).toContain('event_type');
    expect(sql).toContain('RETURNING id');
  });

  it('propagates DB errors', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));
    await expect(
      enqueueEvent({ aggregateType: 'order', aggregateId: 'ord-2', eventType: 'order.failed', payload: {} }),
    ).rejects.toThrow('DB connection lost');
  });
});
