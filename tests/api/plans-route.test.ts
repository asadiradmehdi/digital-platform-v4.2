/**
 * Unit tests for GET /api/v1/plans
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
const mockQuery = vi.mocked(query);

type PlansModule = typeof import('../../app/api/v1/plans/route');
let GET: PlansModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/plans/route'));
}, 60000);

function makeRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    nextUrl: { searchParams: new URLSearchParams() },
    url: 'http://localhost:3000/api/v1/plans',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

const planRows = [
  { id: 'plan-1', name: 'رایگان', slug: 'free', price_minor: '0', currency: 'IRT', billing_interval: 'monthly', description: null },
  { id: 'plan-2', name: 'پایه', slug: 'basic', price_minor: '9900000', currency: 'IRT', billing_interval: 'monthly', description: 'پایه' },
];
const entitlementRows = [{ entitlement_key: 'ai_usage', value: { enabled: true, limit: 10 } }];

beforeEach(() => {
  vi.resetAllMocks();
  mockQuery
    .mockResolvedValueOnce({ rows: planRows, rowCount: planRows.length } as never)
    .mockResolvedValue({ rows: entitlementRows, rowCount: entitlementRows.length } as never);
});

describe('GET /api/v1/plans', () => {
  it('returns 200 with items array', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(planRows.length);
  });

  it('fetches entitlements for each plan', async () => {
    await GET(makeRequest());
    // 1 call for plans + 1 per plan
    expect(mockQuery).toHaveBeenCalledTimes(1 + planRows.length);
    const entitlementCall = mockQuery.mock.calls[1];
    expect((entitlementCall[0] as string)).toContain('plan_entitlements');
    expect(entitlementCall[1]).toContain('plan-1');
  });

  it('each item includes entitlements array', async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    for (const item of body.items) {
      expect(Array.isArray(item.entitlements)).toBe(true);
    }
  });

  it('returns 500 when DB throws', async () => {
    vi.resetAllMocks();
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
