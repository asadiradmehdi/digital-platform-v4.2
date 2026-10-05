/**
 * Unit tests for POST /api/v1/orders/:id/refund
 * Verifies auth, permission, payment lookup, and refund creation.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/core/validation', () => ({ requireUuid: vi.fn() }));
vi.mock('../../server/payments/refund', () => ({ createRefund: vi.fn() }));
vi.mock('../../server/payments/mock-gateway', () => ({ mockGateway: {} }));

import { query } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { requireUuid } from '../../server/core/validation';
import { createRefund } from '../../server/payments/refund';
import { AppError } from '../../server/core/errors';

const mockQuery = vi.mocked(query);
const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockRequireUuid = vi.mocked(requireUuid);
const mockCreateRefund = vi.mocked(createRefund);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/orders/[id]/refund/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/v1/orders/[id]/refund/route'));
}, 60000);

function makeRequest(body: unknown, idempotencyKey?: string): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: {
      get: (k: string) => (k === 'idempotency-key' ? (idempotencyKey ?? null) : null),
    },
    url: 'http://localhost:3000/api/v1/orders/order-1/refund',
    method: 'POST',
    signal: { addEventListener: vi.fn() },
  } as unknown as import('next/server').NextRequest;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const paymentRow = {
  id: 'pay-1', amount_minor: '100000', currency: 'IRR', workspace_id: 'ws-1',
};

describe('POST /api/v1/orders/:id/refund', () => {
  it('returns 200 with refund result on success', async () => {
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [paymentRow], rowCount: 1 } as never);
    mockCreateRefund.mockResolvedValueOnce({ id: 'ref-1', status: 'REFUNDED' } as never);

    const response = await POST(makeRequest({ workspaceId: 'ws-1' }), makeParams('order-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('REFUNDED');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST(makeRequest({ workspaceId: 'ws-1' }), makeParams('order-1'));
    expect(response.status).toBe(401);
  });

  it('returns 403 when user lacks orders.refund permission', async () => {
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await POST(makeRequest({ workspaceId: 'ws-1' }), makeParams('order-1'));
    expect(response.status).toBe(403);
  });

  it('returns 404 when no paid payment exists for the order', async () => {
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await POST(makeRequest({ workspaceId: 'ws-1' }), makeParams('order-missing'));
    expect(response.status).toBe(404);
  });

  it('returns 400 when amountMinor is zero or negative', async () => {
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [paymentRow], rowCount: 1 } as never);

    const response = await POST(makeRequest({ workspaceId: 'ws-1', amountMinor: '0' }), makeParams('order-1'));
    expect(response.status).toBe(400);
  });

  it('uses idempotency-key header when provided', async () => {
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [paymentRow], rowCount: 1 } as never);
    mockCreateRefund.mockResolvedValueOnce({ id: 'ref-2', status: 'REFUNDED' } as never);

    await POST(makeRequest({ workspaceId: 'ws-1' }, 'my-idem-key'), makeParams('order-1'));
    expect(mockCreateRefund).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'my-idem-key' }));
  });
});
