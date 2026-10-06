/**
 * Unit tests for GET+PATCH /api/v1/workspaces/:id/members
 * Verifies member listing and member management (remove/role-change) with auth gates.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/core/security-events', () => ({ recordSecurityEvent: vi.fn() }));
vi.mock('../../server/core/validation', () => ({ requireString: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { query } from '../../server/core/db';
import { requireString } from '../../server/core/validation';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockQuery = vi.mocked(query);
const mockRequireString = vi.mocked(requireString);

beforeEach(() => {
  vi.resetAllMocks();
  mockRequireString.mockImplementation((v: unknown) => String(v));
});

type RouteModule = typeof import('../../app/api/v1/workspaces/[id]/members/route');
let GET: RouteModule['GET'];
let PATCH: RouteModule['PATCH'];

beforeAll(async () => {
  ({ GET, PATCH } = await import('../../app/api/v1/workspaces/[id]/members/route'));
}, 60000);

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/workspaces/ws-1/members',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePatchRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/workspaces/ws-1/members',
    method: 'PATCH',
  } as unknown as import('next/server').NextRequest;
}

const memberRow = { id: 'mem-1', user_id: 'user-2', status: 'ACTIVE', email: 'user@example.com', display_name: 'User', roles: [] };

describe('GET /api/v1/workspaces/:id/members', () => {
  it('returns 200 with member list', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [memberRow], rowCount: 1 } as never);

    const response = await GET(makeGetRequest(), makeParams('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('mem-1');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeGetRequest(), makeParams('ws-1'));
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing workspace.members.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET(makeGetRequest(), makeParams('ws-1'));
    expect(response.status).toBe(403);
  });
});

describe('PATCH /api/v1/workspaces/:id/members', () => {
  it('returns 200 after removing a member', async () => {
    mockRequireUser.mockResolvedValueOnce('admin-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-2' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    const response = await PATCH(makePatchRequest({ memberId: 'mem-1', action: 'remove' }), makeParams('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('returns 404 when member does not exist', async () => {
    mockRequireUser.mockResolvedValueOnce('admin-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await PATCH(makePatchRequest({ memberId: 'mem-missing', action: 'remove' }), makeParams('ws-1'));
    expect(response.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await PATCH(makePatchRequest({ memberId: 'mem-1', action: 'remove' }), makeParams('ws-1'));
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing workspace.members.manage permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await PATCH(makePatchRequest({ memberId: 'mem-1', action: 'remove' }), makeParams('ws-1'));
    expect(response.status).toBe(403);
  });
});
