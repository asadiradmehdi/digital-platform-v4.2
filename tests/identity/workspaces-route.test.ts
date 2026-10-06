/**
 * Unit tests for GET+POST /api/v1/workspaces
 * Verifies workspace listing and creation with auth and validation.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/identity/workspace-settings', () => ({
  createWorkspace: vi.fn(),
  updateWorkspaceSettings: vi.fn(),
}));

import { query } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';
import { createWorkspace } from '../../server/identity/workspace-settings';
import { AppError } from '../../server/core/errors';

const mockQuery = vi.mocked(query);
const mockRequireUser = vi.mocked(requireRequestUser);
const mockCreateWorkspace = vi.mocked(createWorkspace);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/workspaces/route');
let GET: RouteModule['GET'];
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ GET, POST } = await import('../../app/api/v1/workspaces/route'));
}, 60000);

function makeGetRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/workspaces',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePostRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/workspaces',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const workspaceRow = { id: 'ws-1', name: 'My Workspace', slug: 'my-workspace', status: 'ACTIVE', memberStatus: 'ACTIVE' };

describe('GET /api/v1/workspaces', () => {
  it('returns 200 with workspace list', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [workspaceRow], rowCount: 1 } as never);

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('ws-1');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(401);
  });

  it('queries workspaces scoped to the authenticated user', async () => {
    mockRequireUser.mockResolvedValueOnce('user-42' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await GET(makeGetRequest());
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe('user-42');
  });
});

describe('POST /api/v1/workspaces', () => {
  it('returns 201 with created workspace', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockCreateWorkspace.mockResolvedValueOnce({ id: 'ws-new', name: 'New WS', slug: 'new-ws' } as never);

    const response = await POST(makePostRequest({ name: 'New WS' }));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBe('ws-new');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST(makePostRequest({ name: 'New WS' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 when name is empty', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const response = await POST(makePostRequest({ name: '' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const response = await POST(makePostRequest({}));
    expect(response.status).toBe(400);
  });

  it('returns 409 when workspace slug already exists', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockCreateWorkspace.mockRejectedValueOnce(new AppError('CONFLICT', 'Slug already taken.'));

    const response = await POST(makePostRequest({ name: 'New WS', slug: 'taken' }));
    expect(response.status).toBe(409);
  });
});
