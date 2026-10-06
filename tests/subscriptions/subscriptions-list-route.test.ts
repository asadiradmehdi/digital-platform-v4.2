/**
 * Unit tests for GET /api/v1/subscriptions
 * Verifies auth-gated subscription listing across user workspaces.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));
vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));

import { query, withWorkspaceTransaction } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';
import { AppError } from '../../server/core/errors';

const mockQuery = vi.mocked(query);
const mockTx = vi.mocked(withWorkspaceTransaction);
const mockRequireUser = vi.mocked(requireRequestUser);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/subscriptions/route');
let GET: RouteModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/subscriptions/route'));
}, 60000);

function makeRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/subscriptions',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

const subRow = {
  id: 'sub-1', plan: 'pro', status: 'ACTIVE',
  renewalDate: '2026-11-01T00:00:00Z', priceMinor: '9900000', currency: 'IRR',
  usagePercent: 0, entitlements: [],
};

describe('GET /api/v1/subscriptions', () => {
  it('returns 200 with subscription items across memberships', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ workspaceId: 'ws-1' }], rowCount: 1 } as never);
    mockTx.mockResolvedValueOnce({ rows: [subRow] } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('sub-1');
    expect(data.nextCursor).toBeNull();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 200 with empty items when user has no memberships', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(0);
  });

  it('returns 200 with empty items when workspace has no active subscriptions', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ workspaceId: 'ws-1' }], rowCount: 1 } as never);
    mockTx.mockResolvedValueOnce({ rows: [] } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(0);
  });
});
