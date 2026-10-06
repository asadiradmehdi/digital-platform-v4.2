/**
 * Unit tests for POST /api/internal/queue/renewal
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/subscriptions/renewal', () => ({
  findSubscriptionsDueForRenewal: vi.fn(),
  processSubscriptionRenewal: vi.fn(),
}));
vi.mock('../../server/providers/health', () => ({
  recoverStuckQueuedOrders: vi.fn(),
}));
vi.mock('../../server/core/config', () => ({
  env: vi.fn((k: string) => {
    if (k === 'QUEUE_CRON_SECRET') return 'test-cron-secret';
    throw new Error(`env ${k} not set`);
  }),
}));

import { findSubscriptionsDueForRenewal, processSubscriptionRenewal } from '../../server/subscriptions/renewal';
import { recoverStuckQueuedOrders } from '../../server/providers/health';
const mockDue = vi.mocked(findSubscriptionsDueForRenewal);
const mockProcess = vi.mocked(processSubscriptionRenewal);
const mockRecover = vi.mocked(recoverStuckQueuedOrders);

type RouteModule = typeof import('../../app/api/internal/queue/renewal/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/internal/queue/renewal/route'));
}, 60000);

function makeRequest(secret = 'test-cron-secret'): Request {
  return {
    headers: { get: (k: string) => (k === 'authorization' ? `Bearer ${secret}` : null) },
    method: 'POST',
  } as unknown as Request;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockDue.mockResolvedValue([]);
  mockProcess.mockResolvedValue({ status: 'RENEWED' } as never);
  mockRecover.mockResolvedValue([]);
});

describe('POST /api/internal/queue/renewal', () => {
  it('returns 401 when cron secret is wrong', async () => {
    const res = await POST(makeRequest('wrong'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty results when nothing is due', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.renewals).toEqual([]);
    expect(body.recovered).toEqual([]);
  });

  it('processes each due subscription', async () => {
    mockDue.mockResolvedValue(['sub-1', 'sub-2']);
    mockProcess
      .mockResolvedValueOnce({ status: 'RENEWED' } as never)
      .mockResolvedValueOnce({ status: 'SKIPPED' } as never);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.renewals).toHaveLength(2);
    expect(body.renewals[0]).toMatchObject({ subscriptionId: 'sub-1', status: 'RENEWED' });
    expect(body.renewals[1]).toMatchObject({ subscriptionId: 'sub-2', status: 'SKIPPED' });
  });

  it('includes error in renewals when processSubscriptionRenewal returns error', async () => {
    mockDue.mockResolvedValue(['sub-bad']);
    mockProcess.mockResolvedValueOnce({ status: 'FAILED', error: 'db error' } as never);

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.renewals[0]).toMatchObject({ subscriptionId: 'sub-bad', status: 'FAILED', error: 'db error' });
  });

  it('calls recoverStuckQueuedOrders and includes recovered in response', async () => {
    mockRecover.mockResolvedValue([{ orderId: 'ord-1', status: 'dispatched' }] as never);

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.recovered).toHaveLength(1);
    expect(mockRecover).toHaveBeenCalledWith(15, 20);
  });
});
