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
vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/payments/service', () => ({ beginCheckout: vi.fn() }));
vi.mock('../../server/payments/mock-gateway', () => ({
  mockGateway: { initiatePayment: vi.fn() },
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { query } from '../../server/core/db';
import { beginCheckout } from '../../server/payments/service';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockQuery = vi.mocked(query);
const mockBeginCheckout = vi.mocked(beginCheckout);

beforeEach(() => vi.resetAllMocks());

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

function makeGetRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/checkout/sess-1',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePayRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (k: string) => k === 'idempotency-key' ? 'idem-pay-1' : null },
    url: 'http://localhost:3000/api/v1/checkout/sess-1/pay',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const sessionRow = {
  workspace_id: 'ws-1', status: 'OPEN',
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

    const response = await POST_PAY(makePayRequest(validPayBody), makeParams('sess-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.paymentId).toBe('pay-1');
  });

  it('returns 404 when checkout session does not exist', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await POST_PAY(makePayRequest(validPayBody), makeParams('sess-missing'));
    expect(response.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST_PAY(makePayRequest(validPayBody), makeParams('sess-1'));
    expect(response.status).toBe(401);
  });

  it('returns 409 when session is not OPEN', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ ...sessionRow, status: 'PAYMENT_PENDING' }], rowCount: 1 } as never);

    const response = await POST_PAY(makePayRequest(validPayBody), makeParams('sess-1'));
    expect(response.status).toBe(409);
  });

  it('returns 409 when quoteHash does not match', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [sessionRow], rowCount: 1 } as never);

    const response = await POST_PAY(makePayRequest({ ...validPayBody, quoteHash: 'stale-hash' }), makeParams('sess-1'));
    expect(response.status).toBe(409);
  });
});
