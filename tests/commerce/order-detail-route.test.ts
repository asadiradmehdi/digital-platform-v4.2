/**
 * Unit tests for GET /api/v1/orders/:id
 * Verifies auth, workspace permission, ownership check, and event timeline.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ withWorkspaceTransaction: vi.fn() }));
vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/validation', () => ({ requireUuid: vi.fn() }));

import { withWorkspaceTransaction } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { requireUuid } from '../../server/core/validation';
import { AppError } from '../../server/core/errors';

const mockTx = vi.mocked(withWorkspaceTransaction);
const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockRequireUuid = vi.mocked(requireUuid);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/orders/[id]/route');
let GET: RouteModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/orders/[id]/route'));
}, 60000);

function makeRequest(workspaceId?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/orders/ord-1');
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  return {
    headers: { get: () => null },
    url: url.toString(),
    nextUrl: url,
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const orderRow = {
  id: 'ord-1', workspaceId: 'ws-1', status: 'COMPLETED',
  currency: 'IRR', subtotalMinor: '2900000', discountMinor: '0', totalMinor: '2900000',
  createdAt: '2026-10-01T08:00:00Z',
};

describe('GET /api/v1/orders/:id', () => {
  it('returns 200 with order and events on success', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid
      .mockReturnValueOnce('ord-1' as never)
      .mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx
      .mockResolvedValueOnce({ rows: [orderRow] } as never)
      .mockResolvedValueOnce({ rows: [{ fromStatus: 'QUEUED', toStatus: 'COMPLETED', createdAt: '2026-10-01T08:01:00Z' }] } as never);

    const response = await GET(makeRequest('ws-1'), makeParams('ord-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.order.id).toBe('ord-1');
    expect(data.events).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeRequest('ws-1'), makeParams('ord-1'));
    expect(response.status).toBe(401);
  });

  it('returns 403 when user lacks orders.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid
      .mockReturnValueOnce('ord-1' as never)
      .mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET(makeRequest('ws-1'), makeParams('ord-1'));
    expect(response.status).toBe(403);
  });

  it('returns 404 when order does not belong to workspace', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid
      .mockReturnValueOnce('ord-1' as never)
      .mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockResolvedValueOnce({ rows: [] } as never);

    const response = await GET(makeRequest('ws-1'), makeParams('ord-missing'));
    expect(response.status).toBe(404);
  });
});
