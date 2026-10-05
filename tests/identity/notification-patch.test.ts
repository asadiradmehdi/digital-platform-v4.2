/**
 * Unit tests for PATCH /api/v1/notifications/:id
 * Verifies mark-as-read mutation with auth and ownership enforcement.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

vi.mock('../../server/identity/request-user', () => ({
  requireRequestUser: vi.fn(),
}));

vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));

import { query } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';
import { AppError } from '../../server/core/errors';

const mockQuery = vi.mocked(query);
const mockRequireUser = vi.mocked(requireRequestUser);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/notifications/[id]/route');
let PATCH: RouteModule['PATCH'];

beforeAll(async () => {
  ({ PATCH } = await import('../../app/api/v1/notifications/[id]/route'));
});

function makeRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (_k: string) => null },
    url: 'http://localhost:3000/api/v1/notifications/notif-1',
    method: 'PATCH',
  } as unknown as import('next/server').NextRequest;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/v1/notifications/:id', () => {
  it('returns 200 with id and readAt when notification is marked read', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'notif-1', readAt: '2026-10-05T12:00:00Z' }],
      rowCount: 1,
    } as never);

    const response = await PATCH(makeRequest({ action: 'read' }), makeParams('notif-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe('notif-1');
    expect(data.readAt).toBeTruthy();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await PATCH(makeRequest({ action: 'read' }), makeParams('notif-1'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when action is not "read"', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const response = await PATCH(makeRequest({ action: 'delete' }), makeParams('notif-1'));
    expect(response.status).toBe(400);
  });

  it('returns 404 when notification not found or belongs to another user', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await PATCH(makeRequest({ action: 'read' }), makeParams('notif-missing'));
    expect(response.status).toBe(404);
  });

  it('UPDATE SQL uses COALESCE to preserve first read_at timestamp', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'notif-1', readAt: '2026-10-01T00:00:00Z' }],
      rowCount: 1,
    } as never);

    await PATCH(makeRequest({ action: 'read' }), makeParams('notif-1'));

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('COALESCE(read_at, now())');
    expect(sql).toContain('user_id=$2');
    expect(params[0]).toBe('notif-1');
    expect(params[1]).toBe('user-1');
  });
});
