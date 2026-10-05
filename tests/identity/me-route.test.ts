/**
 * Unit tests for GET /api/v1/me
 * Verifies user profile and workspace list are returned correctly.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

vi.mock('../../server/identity/request-user', () => ({
  requireRequestUser: vi.fn(),
}));

import { query } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';
import { AppError } from '../../server/core/errors';

const mockQuery = vi.mocked(query);
const mockRequireUser = vi.mocked(requireRequestUser);

beforeEach(() => vi.clearAllMocks());

type RouteModule = typeof import('../../app/api/v1/me/route');
let GET: RouteModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/me/route'));
});

function makeRequest(): import('next/server').NextRequest {
  return {
    headers: { get: (_k: string) => null },
    url: 'http://localhost:3000/api/v1/me',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

describe('GET /api/v1/me', () => {
  it('returns 200 with user and workspaces when authenticated', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user-1', email: 'test@example.com', displayName: 'Test User', status: 'ACTIVE', createdAt: '2026-01-01' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({
        rows: [{ id: 'ws-1', name: 'Main Workspace', slug: 'main', status: 'ACTIVE', memberStatus: 'ACTIVE' }],
        rowCount: 1,
      } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.id).toBe('user-1');
    expect(data.user.email).toBe('test@example.com');
    expect(data.workspaces).toHaveLength(1);
    expect(data.workspaces[0].slug).toBe('main');
  });

  it('returns 401 when user is not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 500 when user record is not found in DB', async () => {
    mockRequireUser.mockResolvedValueOnce('user-missing' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
  });

  it('queries users table with correct userId', async () => {
    mockRequireUser.mockResolvedValueOnce('user-42' as never);
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user-42', email: 'u@e.com', displayName: 'U', status: 'ACTIVE', createdAt: '2026-01-01' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await GET(makeRequest());

    const [firstSql, firstParams] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(firstSql).toContain('FROM users WHERE id=$1');
    expect(firstParams[0]).toBe('user-42');
  });

  it('queries workspaces with ACTIVE membership filter', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user-1', email: 'a@b.com', displayName: 'A', status: 'ACTIVE', createdAt: '2026-01-01' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await GET(makeRequest());

    const [wsSql, wsParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(wsSql).toContain("wm.status='ACTIVE'");
    expect(wsParams[0]).toBe('user-1');
  });
});
