/**
 * Unit tests for POST /api/v1/orders/:id/cancel.
 * Regression (C-6): cancel used to credit the wallet by itself (separately from /refund, so the two
 * refunded twice), ignored the order state machine and needed no idempotency key. It now delegates to
 * the shared refundOrder() with mode CANCEL and requires the Idempotency-Key header.
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
const KEY = 'cancel-key-0123456789';

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/orders/[id]/cancel/route');
let POST: RouteModule['POST'];
beforeAll(async () => { ({ POST } = await import('../../app/api/v1/orders/[id]/cancel/route')); }, 60000);

function makeRequest(body: unknown, key: string | null = KEY): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (k: string) => (k === 'idempotency-key' ? key : null) },
    url: `http://localhost:3000/api/v1/orders/${ORDER}/cancel`,
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}
const params = (id = ORDER) => ({ params: Promise.resolve({ id }) });

describe('POST /api/v1/orders/:id/cancel', () => {
  it('delegates to refundOrder(CANCEL) with the caller key and returns the new status', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRefundOrder.mockResolvedValueOnce({ orderId: ORDER, orderStatus: 'CANCELLED', refund: { id: 'r1', status: 'PAID', amountMinor: '1000', currency: 'IRT', destination: 'WALLET' } });
    const response = await POST(makeRequest({ workspaceId: WS }), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: ORDER, status: 'CANCELLED', refund: { id: 'r1' } });
    expect(mockRequirePermission).toHaveBeenCalledWith('user-1', WS, 'orders.cancel');
    expect(mockRefundOrder).toHaveBeenCalledWith({ workspaceId: WS, orderId: ORDER, mode: 'CANCEL', idempotencyKey: KEY, actorUserId: 'user-1' });
  });

  it('passes a missing Idempotency-Key through so the service rejects it (400)', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRefundOrder.mockRejectedValueOnce(new AppError('VALIDATION_ERROR', 'A valid Idempotency-Key is required.'));
    const response = await POST(makeRequest({ workspaceId: WS }, null), params());
    expect(response.status).toBe(400);
    expect(mockRefundOrder.mock.calls[0][0].idempotencyKey).toBeNull();
  });

  it('returns 409 when the order already reached the provider', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRefundOrder.mockRejectedValueOnce(new AppError('CONFLICT', 'این سفارش به مرحله‌ی اجرا رسیده است و دیگر قابل لغو نیست.'));
    const response = await POST(makeRequest({ workspaceId: WS }), params());
    expect(response.status).toBe(409);
  });

  it('returns 401 when not authenticated and 403 without orders.cancel', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));
    expect((await POST(makeRequest({ workspaceId: WS }), params())).status).toBe(401);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));
    expect((await POST(makeRequest({ workspaceId: WS }), params())).status).toBe(403);
    expect(mockRefundOrder).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-UUID order id or workspace id', async () => {
    expect((await POST(makeRequest({ workspaceId: WS }), params('order-1'))).status).toBe(400);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    expect((await POST(makeRequest({ workspaceId: 'nope' }), params())).status).toBe(400);
    expect(mockRefundOrder).not.toHaveBeenCalled();
  });
});
