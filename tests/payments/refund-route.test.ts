/**
 * Unit tests for POST /api/v1/orders/:id/refund.
 * Regression (C-6): the route fell back to randomUUID() when Idempotency-Key was missing (so retries
 * created new refunds) and always "refunded" through the mock gateway. It now delegates to the shared
 * refundOrder(REFUND), passes the caller's key through (required) and validates amountMinor.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({ assertSameOrigin: vi.fn() }));
vi.mock('../../server/payments/refund', () => ({ refundOrder: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { refundOrder } from '../../server/payments/refund';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockRefundOrder = vi.mocked(refundOrder);

const WS = '11111111-1111-4111-8111-111111111111';
const ORDER = '33333333-3333-4333-8333-333333333333';
const KEY = 'refund-key-0123456789';

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/orders/[id]/refund/route');
let POST: RouteModule['POST'];
beforeAll(async () => { ({ POST } = await import('../../app/api/v1/orders/[id]/refund/route')); }, 60000);

function makeRequest(body: unknown, key: string | null = KEY): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (k: string) => (k === 'idempotency-key' ? key : null) },
    url: `http://localhost:3000/api/v1/orders/${ORDER}/refund`,
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}
const params = { params: Promise.resolve({ id: ORDER }) };
const outcome = { orderId: ORDER, orderStatus: 'REFUNDED', refund: { id: 'r1', status: 'PAID', amountMinor: '1200000', currency: 'IRT', destination: 'WALLET' as const } };

describe('POST /api/v1/orders/:id/refund', () => {
  it('delegates a full refund to refundOrder(REFUND) with the caller key', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRefundOrder.mockResolvedValueOnce(outcome);
    const response = await POST(makeRequest({ workspaceId: WS, reason: 'late' }), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(outcome);
    expect(mockRequirePermission).toHaveBeenCalledWith('user-1', WS, 'orders.refund');
    expect(mockRefundOrder).toHaveBeenCalledWith({ workspaceId: WS, orderId: ORDER, mode: 'REFUND', amountMinor: undefined, idempotencyKey: KEY, actorUserId: 'user-1', reason: 'late' });
  });

  it('passes a partial amount as bigint', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRefundOrder.mockResolvedValueOnce(outcome);
    await POST(makeRequest({ workspaceId: WS, amountMinor: '5000' }), params);
    expect(mockRefundOrder.mock.calls[0][0].amountMinor).toBe(5000n);
  });

  it('rejects a non-positive or non-integer amount with 400 before calling the service', async () => {
    for (const amountMinor of [0, -1, '1.5', 'abc']) {
      mockRequireUser.mockResolvedValueOnce('user-1' as never);
      expect((await POST(makeRequest({ workspaceId: WS, amountMinor }), params)).status).toBe(400);
    }
    expect(mockRefundOrder).not.toHaveBeenCalled();
  });

  it('never invents an idempotency key: a missing header reaches the service as null', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRefundOrder.mockRejectedValueOnce(new AppError('VALIDATION_ERROR', 'A valid Idempotency-Key is required.'));
    const response = await POST(makeRequest({ workspaceId: WS }, null), params);
    expect(response.status).toBe(400);
    expect(mockRefundOrder.mock.calls[0][0].idempotencyKey).toBeNull();
  });

  it('maps service conflicts (already refunded) to 409', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRefundOrder.mockRejectedValueOnce(new AppError('CONFLICT', 'مبلغ این سفارش پیش‌تر به‌طور کامل بازگردانده شده است.'));
    expect((await POST(makeRequest({ workspaceId: WS }), params)).status).toBe(409);
  });

  it('returns 401/403 without calling the service', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));
    expect((await POST(makeRequest({ workspaceId: WS }), params)).status).toBe(401);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));
    expect((await POST(makeRequest({ workspaceId: WS }), params)).status).toBe(403);
    expect(mockRefundOrder).not.toHaveBeenCalled();
  });
});
