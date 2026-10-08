import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/db', () => ({ query: vi.fn(), withTenantTransaction: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { query, withTenantTransaction } from '../../server/core/db';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(withTenantTransaction).mockImplementation((async (_ws: string, _u: string | undefined, fn: (c: unknown) => unknown) => fn({ query: mockQuery })) as never);
});

type RouteModule = typeof import('../../app/api/v1/support/tickets/route');
let GET: RouteModule['GET'];
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ GET, POST } = await import('../../app/api/v1/support/tickets/route'));
}, 60000);

function makeGetRequest(workspaceId?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/support/tickets');
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  return {
    headers: { get: () => null },
    nextUrl: url,
    url: url.toString(),
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePostRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/support/tickets',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

describe('GET /api/v1/support/tickets', () => {
  it('returns 200 with ticket list', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 't-1', subject: 'Help', status: 'OPEN', priority: 'NORMAL', createdAt: '2026-10-01' }],
      rowCount: 1,
    } as never);

    const res = await GET(makeGetRequest('ws-1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].subject).toBe('Help');
  });

  it('returns 400 when workspaceId is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const res = await GET(makeGetRequest('ws-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when lacking workspace.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const res = await GET(makeGetRequest('ws-1'));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/support/tickets', () => {
  const validBody = { workspaceId: 'ws-1', subject: 'Need help please', priority: 'HIGH' };

  it('returns 201 with ticket id on success', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ticket-1' }], rowCount: 1 } as never);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ticket.id).toBe('ticket-1');
  });

  it('returns 400 when workspaceId is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const res = await POST(makePostRequest({ subject: 'Help' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when subject is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const res = await POST(makePostRequest({ workspaceId: 'ws-1' }));
    expect(res.status).toBe(400);
  });

  it('defaults priority to NORMAL when not provided', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ticket-2' }], rowCount: 1 } as never);

    await POST(makePostRequest({ workspaceId: 'ws-1', subject: 'Help' }));
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain('NORMAL');
  });
});

describe('support_tickets RLS context', () => {
  // Regression: support_tickets has FORCE RLS; pool queries listed nothing and the insert was rejected.
  it('lists tickets inside the workspace context after the permission check', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await GET(makeGetRequest('ws-7'));
    const mockTx = vi.mocked(withTenantTransaction);
    expect(mockTx).toHaveBeenCalledWith('ws-7', 'user-1', expect.any(Function));
    expect(mockRequirePermission.mock.invocationCallOrder[0]).toBeLessThan(mockTx.mock.invocationCallOrder[0]);
  });

  it('creates a ticket inside the workspace context', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 't-9' }], rowCount: 1 } as never);
    const res = await POST(makePostRequest({ workspaceId: 'ws-7', subject: 'Need help' }));
    expect(res.status).toBe(201);
    expect(vi.mocked(withTenantTransaction)).toHaveBeenCalledWith('ws-7', 'user-1', expect.any(Function));
  });
});
