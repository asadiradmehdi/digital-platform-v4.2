/**
 * Unit tests for POST /api/v1/orders/:id/cancel
 * Verifies cancellation auth, ownership, state-machine guard, and permission binding.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({
  withWorkspaceTransaction: vi.fn(),
}));
vi.mock('../../server/identity/request-user', () => ({
  requireRequestUser: vi.fn(),
}));
vi.mock('../../server/identity/rbac', () => ({
  requireWorkspacePermission: vi.fn(),
}));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/core/validation', () => ({
  requireUuid: vi.fn(),
}));

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

type RouteModule = typeof import('../../app/api/v1/orders/[id]/cancel/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/v1/orders/[id]/cancel/route'));
}, 60000);

function makeRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (_k: string) => null },
    url: 'http://localhost:3000/api/v1/orders/order-1/cancel',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/v1/orders/:id/cancel', () => {
  it('returns 200 with cancelled order on success', async () => {
    mockRequireUuid
      .mockReturnValueOnce('order-1' as never)
      .mockReturnValueOnce('ws-1' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockResolvedValueOnce({ id: 'order-1', status: 'CANCELLED' } as never);

    const response = await POST(makeRequest({ workspaceId: 'ws-1' }), makeParams('order-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('CANCELLED');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUuid.mockReturnValueOnce('order-1' as never);
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST(makeRequest({ workspaceId: 'ws-1' }), makeParams('order-1'));
    expect(response.status).toBe(401);
  });

  it('returns 403 when user lacks orders.cancel permission', async () => {
    mockRequireUuid
      .mockReturnValueOnce('order-1' as never)
      .mockReturnValueOnce('ws-1' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await POST(makeRequest({ workspaceId: 'ws-1' }), makeParams('order-1'));
    expect(response.status).toBe(403);
  });

  it('returns 404 when order is not found', async () => {
    mockRequireUuid
      .mockReturnValueOnce('order-99' as never)
      .mockReturnValueOnce('ws-1' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockRejectedValueOnce(new AppError('NOT_FOUND', 'Order not found.'));

    const response = await POST(makeRequest({ workspaceId: 'ws-1' }), makeParams('order-99'));
    expect(response.status).toBe(404);
  });

  it('returns 409 when order is already cancelled', async () => {
    mockRequireUuid
      .mockReturnValueOnce('order-1' as never)
      .mockReturnValueOnce('ws-1' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockRejectedValueOnce(new AppError('CONFLICT', 'Order cannot be cancelled in status CANCELLED.'));

    const response = await POST(makeRequest({ workspaceId: 'ws-1' }), makeParams('order-1'));
    expect(response.status).toBe(409);
  });

  it('checks orders.cancel permission for the correct workspaceId', async () => {
    mockRequireUuid
      .mockReturnValueOnce('order-55' as never)
      .mockReturnValueOnce('ws-55' as never);
    mockRequireUser.mockResolvedValueOnce('user-9' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockResolvedValueOnce({ id: 'order-55', status: 'CANCELLED' } as never);

    await POST(makeRequest({ workspaceId: 'ws-55' }), makeParams('order-55'));
    expect(mockRequirePermission).toHaveBeenCalledWith('user-9', 'ws-55', 'orders.cancel');
  });
});
