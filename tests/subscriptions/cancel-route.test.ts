/**
 * Unit tests for PATCH /api/v1/subscriptions/:id
 * Verifies subscription cancellation with auth, ownership, and permission checks.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

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
  requireString: vi.fn(),
}));

vi.mock('../../server/subscriptions/service', () => ({
  cancelSubscription: vi.fn(),
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { requireUuid, requireString } from '../../server/core/validation';
import { cancelSubscription } from '../../server/subscriptions/service';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockRequireUuid = vi.mocked(requireUuid);
const mockRequireString = vi.mocked(requireString);
const mockCancelSubscription = vi.mocked(cancelSubscription);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/subscriptions/[id]/route');
let PATCH: RouteModule['PATCH'];

beforeAll(async () => {
  ({ PATCH } = await import('../../app/api/v1/subscriptions/[id]/route'));
}, 60000);

function makeRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (_k: string) => null },
    url: 'http://localhost:3000/api/v1/subscriptions/sub-1',
    method: 'PATCH',
  } as unknown as import('next/server').NextRequest;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/v1/subscriptions/:id', () => {
  it('returns 200 with cancelled subscription on success', async () => {
    mockRequireUuid
      .mockReturnValueOnce('sub-1' as never) // subscriptionId
      .mockReturnValueOnce('ws-1' as never); // workspaceId
    mockRequireString.mockReturnValueOnce('cancel' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockCancelSubscription.mockResolvedValueOnce({ id: 'sub-1', status: 'CANCELLED' } as never);

    const response = await PATCH(makeRequest({ workspaceId: 'ws-1', action: 'cancel' }), makeParams('sub-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('CANCELLED');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUuid.mockReturnValueOnce('sub-1' as never);
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await PATCH(makeRequest({ workspaceId: 'ws-1', action: 'cancel' }), makeParams('sub-1'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when action is not cancel', async () => {
    mockRequireUuid
      .mockReturnValueOnce('sub-1' as never)
      .mockReturnValueOnce('ws-1' as never);
    mockRequireString.mockReturnValueOnce('upgrade' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const response = await PATCH(makeRequest({ workspaceId: 'ws-1', action: 'upgrade' }), makeParams('sub-1'));
    expect(response.status).toBe(400);
  });

  it('returns 403 when user lacks subscriptions.cancel permission', async () => {
    mockRequireUuid
      .mockReturnValueOnce('sub-1' as never)
      .mockReturnValueOnce('ws-1' as never);
    mockRequireString.mockReturnValueOnce('cancel' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await PATCH(makeRequest({ workspaceId: 'ws-1', action: 'cancel' }), makeParams('sub-1'));
    expect(response.status).toBe(403);
  });

  it('checks subscriptions.cancel permission for the correct workspaceId', async () => {
    mockRequireUuid
      .mockReturnValueOnce('sub-99' as never)
      .mockReturnValueOnce('ws-99' as never);
    mockRequireString.mockReturnValueOnce('cancel' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockCancelSubscription.mockResolvedValueOnce({ id: 'sub-99', status: 'CANCELLED' } as never);

    await PATCH(makeRequest({ workspaceId: 'ws-99', action: 'cancel' }), makeParams('sub-99'));
    expect(mockRequirePermission).toHaveBeenCalledWith('user-1', 'ws-99', 'subscriptions.cancel');
  });

  it('returns 404 when subscription not found', async () => {
    mockRequireUuid
      .mockReturnValueOnce('sub-missing' as never)
      .mockReturnValueOnce('ws-1' as never);
    mockRequireString.mockReturnValueOnce('cancel' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockCancelSubscription.mockRejectedValueOnce(new AppError('NOT_FOUND', 'Subscription not found.'));

    const response = await PATCH(makeRequest({ workspaceId: 'ws-1', action: 'cancel' }), makeParams('sub-missing'));
    expect(response.status).toBe(404);
  });
});
