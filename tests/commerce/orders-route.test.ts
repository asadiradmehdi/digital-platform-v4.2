/**
 * Unit tests for GET+POST /api/v1/orders
 * Verifies order listing with pagination and order creation with idempotency.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/core/validation', () => ({
  requireUuid: vi.fn(),
  safePositiveInteger: vi.fn(),
}));
vi.mock('../../server/observability/tracing', () => ({
  withSpan: vi.fn(),
  parseTraceparent: vi.fn().mockReturnValue(null),
}));
vi.mock('../../server/core/pagination', () => ({
  parseLimit: vi.fn().mockReturnValue(20),
  decodeCursor: vi.fn().mockReturnValue(null),
  encodeCursor: vi.fn().mockReturnValue(null),
}));
vi.mock('../../server/commerce/orders', () => ({
  listOrders: vi.fn(),
  createOrder: vi.fn(),
}));
vi.mock('../../server/payments/service', () => ({
  payOrderFromWallet: vi.fn(),
}));
vi.mock('../../server/commerce/catalog', () => ({ getService: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { requireUuid, safePositiveInteger } from '../../server/core/validation';
import { withSpan } from '../../server/observability/tracing';
import { listOrders, createOrder } from '../../server/commerce/orders';
import { payOrderFromWallet } from '../../server/payments/service';
import { AppError } from '../../server/core/errors';
import { getService } from '../../server/commerce/catalog';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockRequireUuid = vi.mocked(requireUuid);
const mockSafeInt = vi.mocked(safePositiveInteger);
const mockWithSpan = vi.mocked(withSpan);
const mockListOrders = vi.mocked(listOrders);
const mockCreateOrder = vi.mocked(createOrder);
const mockPayFromWallet = vi.mocked(payOrderFromWallet);

const mockGetService = vi.mocked(getService);
const service = (slug: string, active = true) => ({ id: 'svc-1', slug, active, name: slug, serviceType: 'X', productName: 'p', productSlug: 'p', productId: 'p', description: null });

beforeEach(() => {
  vi.resetAllMocks();
  mockGetService.mockResolvedValue(service('ig-likes') as never);
});

type RouteModule = typeof import('../../app/api/v1/orders/route');
let GET: RouteModule['GET'];
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ GET, POST } = await import('../../app/api/v1/orders/route'));
}, 60000);

function makeGetRequest(workspaceId?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/orders');
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  return {
    headers: { get: () => null },
    url: url.toString(),
    nextUrl: url,
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePostRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (_k: string) => null },
    url: 'http://localhost:3000/api/v1/orders',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const sampleOrder = { id: 'ord-1', status: 'QUEUED', totalMinor: '2900000', currency: 'IRR' };

describe('GET /api/v1/orders', () => {
  it('returns 200 with order items and pagination', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockListOrders.mockResolvedValueOnce({ items: [sampleOrder], nextCursor: null } as never);

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('ord-1');
    expect(data.nextCursor).toBeNull();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when workspaceId is invalid', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockImplementationOnce(() => {
      throw new AppError('VALIDATION_ERROR', 'workspaceId required');
    });

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(400);
  });

  it('returns 403 when user lacks orders.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(403);
  });
});

describe('POST /api/v1/orders', () => {
  it('returns 201 with created order', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid
      .mockReturnValueOnce('ws-1' as never)
      .mockReturnValueOnce('svc-1' as never);
    mockSafeInt.mockReturnValueOnce(1000 as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockWithSpan.mockImplementationOnce((_name, _meta, fn) =>
      Promise.resolve({ value: sampleOrder, durationMs: 50, trace: { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: '01' } })
    );
    mockPayFromWallet.mockResolvedValueOnce({ id: 'pay-1', status: 'PAID' } as never);

    const response = await POST(makePostRequest({
      workspaceId: 'ws-1', serviceId: 'svc-1', quantity: 1000, parameters: {},
    }));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBe('ord-1');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', serviceId: 'svc-1', quantity: 1000 }));
    expect(response.status).toBe(401);
  });

  it('returns 403 when user lacks orders.create permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid
      .mockReturnValueOnce('ws-1' as never)
      .mockReturnValueOnce('svc-1' as never);
    mockSafeInt.mockReturnValueOnce(1000 as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', serviceId: 'svc-1', quantity: 1000 }));
    expect(response.status).toBe(403);
  });

  it('returns 409 on duplicate order (idempotency conflict)', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid
      .mockReturnValueOnce('ws-1' as never)
      .mockReturnValueOnce('svc-1' as never);
    mockSafeInt.mockReturnValueOnce(1000 as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockWithSpan.mockImplementationOnce((_name, _meta, fn) =>
      Promise.reject(new AppError('CONFLICT', 'Duplicate order.'))
    );

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', serviceId: 'svc-1', quantity: 1000 }));
    expect(response.status).toBe(409);
  });

  describe('creative services (design, automation, AI content)', () => {
    function arrange(slug: string) {
      mockRequireUser.mockResolvedValueOnce('user-1' as never);
      mockRequireUuid.mockReturnValueOnce('ws-1' as never).mockReturnValueOnce('svc-1' as never);
      mockSafeInt.mockReturnValueOnce(3 as never);
      mockRequirePermission.mockResolvedValueOnce(undefined as never);
      mockGetService.mockResolvedValueOnce(service(slug) as never);
      mockWithSpan.mockImplementationOnce((_n, _m, fn) => Promise.resolve((fn as () => unknown)()).then(value => ({ value, durationMs: 1, trace: { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: '01' } })) as never);
      mockCreateOrder.mockResolvedValueOnce({ id: 'ord-9', status: 'PAYMENT_PENDING' } as never);
      mockPayFromWallet.mockResolvedValueOnce({ id: 'pay-9', status: 'PAID' } as never);
    }

    it('stores a trimmed brief and optional page for a design order', async () => {
      arrange('ds-post');
      const res = await POST(makePostRequest({ workspaceId: 'ws-1', serviceId: 'svc-1', quantity: 3, parameters: { target: ' @brand ', brief: '  پست معرفی محصول جدید با رنگ سرمه‌ای  ', extra: 'x' } }));
      expect(res.status).toBe(201);
      expect(mockCreateOrder.mock.calls[0][0].parameters).toEqual({ target: '@brand', brief: 'پست معرفی محصول جدید با رنگ سرمه‌ای' });
    });

    it('rejects a design order without a usable brief (400, nothing charged)', async () => {
      arrange('ds-logo');
      const res = await POST(makePostRequest({ workspaceId: 'ws-1', serviceId: 'svc-1', quantity: 1, parameters: { brief: 'لوگو' } }));
      expect(res.status).toBe(400);
      expect((await res.json()).error.message).toContain('شرح سفارش');
      expect(mockCreateOrder).not.toHaveBeenCalled();
      expect(mockPayFromWallet).not.toHaveBeenCalled();
    });

    it('requires the page or channel for a monthly automation', async () => {
      arrange('au-dm-reply');
      const res = await POST(makePostRequest({ workspaceId: 'ws-1', serviceId: 'svc-1', quantity: 3, parameters: { brief: 'پاسخ به سؤال‌های قیمت و ارسال' } }));
      expect(res.status).toBe(400);
      expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it('rejects an oversized brief or target', async () => {
      arrange('ai-caption');
      const res = await POST(makePostRequest({ workspaceId: 'ws-1', serviceId: 'svc-1', quantity: 5, parameters: { brief: 'ب'.repeat(3001) } }));
      expect(res.status).toBe(400);
      arrange('ai-caption');
      const res2 = await POST(makePostRequest({ workspaceId: 'ws-1', serviceId: 'svc-1', quantity: 5, parameters: { target: 'x'.repeat(501), brief: 'کپشن برای کافه' } }));
      expect(res2.status).toBe(400);
      expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it('refuses an inactive service before charging', async () => {
      mockRequireUser.mockResolvedValueOnce('user-1' as never);
      mockRequireUuid.mockReturnValueOnce('ws-1' as never).mockReturnValueOnce('svc-1' as never);
      mockRequirePermission.mockResolvedValueOnce(undefined as never);
      mockGetService.mockResolvedValueOnce(service('ai-content', false) as never);
      const res = await POST(makePostRequest({ workspaceId: 'ws-1', serviceId: 'svc-1', quantity: 1, parameters: { topic: 'x' } }));
      expect(res.status).toBe(409);
      expect(mockCreateOrder).not.toHaveBeenCalled();
      expect(mockPayFromWallet).not.toHaveBeenCalled();
    });

    it('keeps social-service parameters as before but bounds the target', async () => {
      arrange('ig-likes');
      const res = await POST(makePostRequest({ workspaceId: 'ws-1', serviceId: 'svc-1', quantity: 3, parameters: { target: 'https://instagram.com/p/x' } }));
      expect(res.status).toBe(201);
      expect(mockCreateOrder.mock.calls[0][0].parameters).toEqual({ target: 'https://instagram.com/p/x' });
    });
  });
});
