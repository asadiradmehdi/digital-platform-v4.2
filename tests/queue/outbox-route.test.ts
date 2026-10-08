/**
 * Unit tests for POST /api/internal/queue/outbox (order.paid handling).
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/queue/outbox-dispatch', () => ({
  claimOutboxBatch: vi.fn(),
  markOutboxPublished: vi.fn(),
  markOutboxFailed: vi.fn(),
}));
vi.mock('../../server/providers/dispatch', () => ({ dispatchOrder: vi.fn() }));
vi.mock('../../server/commerce/orders', () => ({ transitionOrder: vi.fn() }));
vi.mock('../../server/core/db', () => ({ withTenantTransaction: vi.fn() }));
vi.mock('../../server/core/config', () => ({
  env: vi.fn((k: string) => {
    if (k === 'QUEUE_CRON_SECRET') return 'test-cron-secret';
    throw new Error(`env ${k} not set`);
  }),
}));

import { claimOutboxBatch, markOutboxPublished } from '../../server/queue/outbox-dispatch';
import { dispatchOrder } from '../../server/providers/dispatch';
import { transitionOrder } from '../../server/commerce/orders';
import { withTenantTransaction } from '../../server/core/db';

const mockClaim = vi.mocked(claimOutboxBatch);
const mockPublished = vi.mocked(markOutboxPublished);
const mockDispatch = vi.mocked(dispatchOrder);
const mockTransition = vi.mocked(transitionOrder);
const mockTx = vi.mocked(withTenantTransaction);
const txQuery = vi.fn();

type RouteModule = typeof import('../../app/api/internal/queue/outbox/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/internal/queue/outbox/route'));
}, 60000);

function makeRequest(secret = 'test-cron-secret'): Request {
  return { headers: { get: (k: string) => (k === 'authorization' ? `Bearer ${secret}` : null) }, method: 'POST' } as unknown as Request;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockTx.mockImplementation((async (_ws: string, _u: string | undefined, fn: (c: { query: typeof txQuery }) => unknown) => fn({ query: txQuery })) as never);
});

describe('POST /api/internal/queue/outbox order.paid', () => {
  it('reads the paid order inside the event workspace RLS context, then queues and dispatches it', async () => {
    // Regression: orders has FORCE RLS; the plain-pool lookup found no order under the production role,
    // so paid orders were acknowledged without ever being dispatched.
    mockClaim.mockResolvedValueOnce({ rows: [{ id: 'evt-1', aggregate_type: 'order', aggregate_id: 'ord-1', event_type: 'order.paid', payload: { orderId: 'ord-1', workspaceId: 'ws-1' } }] } as never);
    txQuery.mockResolvedValueOnce({ rows: [{ service_id: 'svc-1', status: 'PAID' }] });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockTx).toHaveBeenCalledWith('ws-1', undefined, expect.any(Function));
    expect(txQuery.mock.calls[0][1]).toEqual(['ord-1', 'ws-1']);
    expect(mockTransition).toHaveBeenCalledWith('ord-1', 'ws-1', 'QUEUED');
    expect(mockDispatch).toHaveBeenCalledWith({ workspaceId: 'ws-1', orderId: 'ord-1', serviceId: 'svc-1' });
    expect(mockPublished).toHaveBeenCalledWith('evt-1');
  });

  it('skips events without a workspace and never opens a tenant transaction for them', async () => {
    mockClaim.mockResolvedValueOnce({ rows: [{ id: 'evt-2', aggregate_type: 'order', aggregate_id: 'ord-2', event_type: 'order.paid', payload: { orderId: 'ord-2' } }] } as never);
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockTx).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong cron secret', async () => {
    const res = await POST(makeRequest('nope'));
    expect(res.status).toBe(401);
  });
});
