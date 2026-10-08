/**
 * Unit tests for GET /api/v1/checkout/:id and POST /api/v1/checkout/:id/pay
 * Verifies checkout session retrieval and payment initiation.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/core/db', () => ({ query: vi.fn(), withTenantTransaction: vi.fn() }));
vi.mock('../../server/payments/service', () => ({ beginCheckout: vi.fn() }));
vi.mock('../../server/payments/mock-gateway', () => ({
  mockGateway: { initiatePayment: vi.fn() },
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { query, withTenantTransaction } from '../../server/core/db';
import { beginCheckout } from '../../server/payments/service';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockQuery = vi.mocked(query);
const mockBeginCheckout = vi.mocked(beginCheckout);

const mockTx = vi.mocked(withTenantTransaction);
const WS = '11111111-1111-4111-8111-111111111111';
const SESS = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.resetAllMocks();
  mockTx.mockImplementation((async (_ws: string, _u: string | undefined, fn: (c: unknown) => unknown) => fn({ query: mockQuery })) as never);
});

type DetailModule = typeof import('../../app/api/v1/checkout/[id]/route');
type PayModule = typeof import('../../app/api/v1/checkout/[id]/pay/route');

let GET_DETAIL: DetailModule['GET'];
let POST_PAY: PayModule['POST'];

beforeAll(async () => {
  ({ GET: GET_DETAIL } = await import('../../app/api/v1/checkout/[id]/route'));
  ({ POST: POST_PAY } = await import('../../app/api/v1/checkout/[id]/pay/route'));
}, 60000);

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(workspaceId: string | null = WS): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: `http://localhost:3000/api/v1/checkout/sess-1${workspaceId ? `?workspaceId=${workspaceId}` : ''}`,
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePayRequest(body: Record<string, unknown>): import('next/server').NextRequest {
  return {
    json: async () => ({ workspaceId: WS, ...body }),
    headers: { get: (k: string) => k === 'idempotency-key' ? 'idem-pay-0123456789' : null },
    url: 'http://localhost:3000/api/v1/checkout/sess-1/pay',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const sessionRow = {
  workspace_id: '11111111-1111-4111-8111-111111111111', status: 'OPEN',
  total_minor: '1200000', currency: 'IRR',
  quote_hash: 'hash-abc', expires_at: new Date(Date.now() + 900_000).toISOString(),
};
const itemRows = [{ service_id: 'svc-1', plan_id: null, quantity: '2', unit_price_minor: '600000', total_minor: '1200000', currency: 'IRR' }];

describe('GET /api/v1/checkout/:id', () => {
  it('returns 200 with session and items', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery
      .mockResolvedValueOnce({ rows: [sessionRow], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: itemRows, rowCount: 1 } as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    const response = await GET_DETAIL(makeGetRequest(), makeParams('sess-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe('sess-1');
    expect(data.items).toHaveLength(1);
  });

  it('returns 404 when checkout session does not exist', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await GET_DETAIL(makeGetRequest(), makeParams('sess-missing'));
    expect(response.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET_DETAIL(makeGetRequest(), makeParams('sess-1'));
    expect(response.status).toBe(401);
  });
});

describe('POST /api/v1/checkout/:id/pay', () => {
  const validPayBody = { quoteHash: 'hash-abc', gateway: 'mock' };

  it('returns 200 with payment URL on success', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery
      .mockResolvedValueOnce({ rows: [sessionRow], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'sess-1' }], rowCount: 1 } as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockBeginCheckout.mockResolvedValueOnce({ paymentId: 'pay-1', redirectUrl: 'https://pay.example.com/pay-1' } as never);

    const response = await POST_PAY(makePayRequest(validPayBody), makeParams(SESS));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.paymentId).toBe('pay-1');
  });

  it('returns 404 when checkout session does not exist', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await POST_PAY(makePayRequest(validPayBody), makeParams(SESS));
    expect(response.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST_PAY(makePayRequest(validPayBody), makeParams(SESS));
    expect(response.status).toBe(401);
  });

  it('returns 409 when session is already PAID', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ ...sessionRow, status: 'PAID' }], rowCount: 1 } as never);

    const response = await POST_PAY(makePayRequest(validPayBody), makeParams(SESS));
    expect(response.status).toBe(409);
  });

  it('returns 409 when quoteHash does not match', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [sessionRow], rowCount: 1 } as never);

    const response = await POST_PAY(makePayRequest({ ...validPayBody, quoteHash: 'stale-hash' }), makeParams(SESS));
    expect(response.status).toBe(409);
  });
});

describe('POST /api/v1/checkout/:id/pay — idempotency and gateway policy', () => {
  it('requires an Idempotency-Key (no random fallback)', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [sessionRow], rowCount: 1 } as never);
    const req = { ...makePayRequest({ quoteHash: 'hash-abc' }), headers: { get: () => null } } as unknown as import('next/server').NextRequest;
    const response = await POST_PAY(req, makeParams(SESS));
    expect(response.status).toBe(400);
    expect(mockBeginCheckout).not.toHaveBeenCalled();
  });

  it('fails closed (503, Persian message) in production without a real gateway', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAYMENTS_MOCK_ALLOWED', '');
    try {
      mockRequireUser.mockResolvedValueOnce('user-1' as never);
      mockRequirePermission.mockResolvedValueOnce(undefined as never);
      mockQuery.mockResolvedValueOnce({ rows: [sessionRow], rowCount: 1 } as never);
      const response = await POST_PAY(makePayRequest({ quoteHash: 'hash-abc' }), makeParams(SESS));
      expect(response.status).toBe(503);
      expect((await response.json()).error.message).toMatch(/درگاه/);
      expect(mockBeginCheckout).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('checkout session RLS context', () => {
  // Regression: checkout_sessions has FORCE RLS; the id-only pool lookup found nothing under the
  // production role, so GET and pay always answered 404.
  it('GET checks permission on the named workspace, then reads inside its tenant context', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery
      .mockResolvedValueOnce({ rows: [sessionRow], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: itemRows, rowCount: 1 } as never);
    const response = await GET_DETAIL(makeGetRequest(), makeParams('sess-1'));
    expect(response.status).toBe(200);
    expect(mockRequirePermission).toHaveBeenCalledWith('user-1', WS, 'orders.create');
    expect(mockTx).toHaveBeenCalledWith(WS, 'user-1', expect.any(Function));
    expect(mockRequirePermission.mock.invocationCallOrder[0]).toBeLessThan(mockTx.mock.invocationCallOrder[0]);
    expect(mockQuery.mock.calls[0][1]).toEqual(['sess-1', WS]);
  });

  it('GET rejects a request without a workspaceId before touching the database', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    const response = await GET_DETAIL(makeGetRequest(null), makeParams('sess-1'));
    expect(response.status).toBe(400);
    expect(mockTx).not.toHaveBeenCalled();
  });

  it('pay reads and updates the session inside the named workspace context', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery
      .mockResolvedValueOnce({ rows: [sessionRow], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    mockBeginCheckout.mockResolvedValueOnce({ paymentId: 'pay-1', checkoutUrl: 'https://pay.example.com/pay-1' } as never);
    const response = await POST_PAY(makePayRequest({ quoteHash: 'hash-abc', gateway: 'mock' }), makeParams(SESS));
    expect(response.status).toBe(200);
    expect(mockTx.mock.calls.map(c => c[0])).toEqual([WS, WS]);
    expect(String(mockQuery.mock.calls[1][0])).toContain("SET status='PAYMENT_PENDING'");
    expect(mockQuery.mock.calls[1][1]).toEqual([SESS, WS]);
    // Regression (C-4): the gateway intent is tied to this checkout session, never a bare top-up.
    expect(mockBeginCheckout).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'CHECKOUT', checkoutSessionId: SESS, idempotencyKey: 'idem-pay-0123456789' }));
  });
});
