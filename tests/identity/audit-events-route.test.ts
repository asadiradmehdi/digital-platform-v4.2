import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { query } from '../../server/core/db';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockQuery = vi.mocked(query);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/me/audit-events/route');
let GET: RouteModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/me/audit-events/route'));
}, 60000);

function makeRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/me/audit-events',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

describe('GET /api/v1/me/audit-events', () => {
  it('returns 200 with audit event items', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'ev-1', action: 'LOGIN', entityType: 'session', createdAt: '2026-10-01' }],
      rowCount: 1,
    } as never);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].action).toBe('LOGIN');
  });

  it('returns 200 with empty items when no audit events exist', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(0);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('queries audit_logs filtered by actor_user_id with LIMIT 20', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await GET(makeRequest());
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('audit_logs');
    expect(sql).toContain('actor_user_id=$1');
    expect(sql).toContain('LIMIT 20');
    expect(params).toContain('user-1');
  });
});
