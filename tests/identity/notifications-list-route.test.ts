/**
 * Unit tests for GET /api/v1/notifications
 * Verifies auth-gated user notification list with pagination.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));

import { query } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';
import { AppError } from '../../server/core/errors';

const mockQuery = vi.mocked(query);
const mockRequireUser = vi.mocked(requireRequestUser);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/notifications/route');
let GET: RouteModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/notifications/route'));
}, 60000);

function makeRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/notifications',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

const sampleNotification = {
  id: 'notif-1', type: 'SYSTEM', title: 'تست', read: false,
  readAt: null, createdAt: '2026-10-01T00:00:00Z',
};

describe('GET /api/v1/notifications', () => {
  it('returns 200 with notification items', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [sampleNotification], rowCount: 1 } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('notif-1');
    expect(data.nextCursor).toBeNull();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 200 with empty items when no notifications exist', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(0);
  });

  it('queries notifications scoped to the authenticated user', async () => {
    mockRequireUser.mockResolvedValueOnce('user-42' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await GET(makeRequest());
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe('user-42');
  });
});
