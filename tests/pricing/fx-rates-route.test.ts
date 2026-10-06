/**
 * Unit tests for GET /api/v1/pricing/fx-rates
 * Verifies auth-gated FX rate listing with stale-rate annotation.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/pricing/stale-guard', () => ({ isRateStale: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { query } from '../../server/core/db';
import { isRateStale } from '../../server/pricing/stale-guard';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockQuery = vi.mocked(query);
const mockIsRateStale = vi.mocked(isRateStale);

beforeEach(() => {
  vi.resetAllMocks();
  mockIsRateStale.mockReturnValue(false);
});

type RouteModule = typeof import('../../app/api/v1/pricing/fx-rates/route');
let GET: RouteModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/pricing/fx-rates/route'));
}, 60000);

function makeRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/pricing/fx-rates',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

const rateRow = {
  id: 'rate-1', base_currency: 'USD', quote_currency: 'IRR',
  rate_numerator: '600000', rate_denominator: '1',
  source: 'manual', fetched_at: new Date().toISOString(), is_verified: true,
};

describe('GET /api/v1/pricing/fx-rates', () => {
  it('returns 200 with rate list when authenticated', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [rateRow], rowCount: 1 } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].baseCurrency).toBe('USD');
    expect(data.items[0].quoteCurrency).toBe('IRR');
    expect(data.items[0].stale).toBe(false);
  });

  it('returns 200 with empty list when no rates exist', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(0);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });
});
