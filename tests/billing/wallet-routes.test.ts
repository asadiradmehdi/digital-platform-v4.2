/**
 * Unit tests for GET+POST /api/v1/wallet and GET /api/v1/wallet/balance
 * Verifies auth, permission, deposit recording, and balance retrieval.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));
vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/core/validation', async (orig) => ({ ...(await orig<typeof import('../../server/core/validation')>()), requireUuid: vi.fn() }));
vi.mock('../../server/payments/service', () => ({ beginCheckout: vi.fn() }));
vi.mock('../../server/billing/ledger', () => ({ postLedgerEntry: vi.fn() }));
vi.mock('../../server/core/distributed-rate-limit', () => ({ consumeDistributedRateLimit: vi.fn() }));

import { query, withWorkspaceTransaction } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { requireUuid } from '../../server/core/validation';
import { postLedgerEntry } from '../../server/billing/ledger';
import { consumeDistributedRateLimit } from '../../server/core/distributed-rate-limit';
import { beginCheckout } from '../../server/payments/service';
import { AppError } from '../../server/core/errors';

const mockQuery = vi.mocked(query);
const mockTx = vi.mocked(withWorkspaceTransaction);
const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockRequireUuid = vi.mocked(requireUuid);
const mockPostLedger = vi.mocked(postLedgerEntry);
const mockRateLimit = vi.mocked(consumeDistributedRateLimit);
const mockBeginCheckout = vi.mocked(beginCheckout);

beforeEach(() => vi.resetAllMocks());

type WalletRouteModule = typeof import('../../app/api/v1/wallet/route');
type BalanceRouteModule = typeof import('../../app/api/v1/wallet/balance/route');
let GET_WALLET: WalletRouteModule['GET'];
let POST_WALLET: WalletRouteModule['POST'];
let GET_BALANCE: BalanceRouteModule['GET'];

beforeAll(async () => {
  ({ GET: GET_WALLET, POST: POST_WALLET } = await import('../../app/api/v1/wallet/route'));
  ({ GET: GET_BALANCE } = await import('../../app/api/v1/wallet/balance/route'));
}, 60000);

function makeGetRequest(url = 'http://localhost:3000/api/v1/wallet'): import('next/server').NextRequest {
  return {
    headers: { get: (_k: string) => null },
    url,
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePostRequest(body: unknown, idempotencyKey?: string): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (k: string) => (k === 'idempotency-key' ? (idempotencyKey ?? null) : null) },
    url: 'http://localhost:3000/api/v1/wallet',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const walletRow = { id: 'w-1', currency: 'IRR', status: 'ACTIVE', balanceMinor: '500000' };
const balanceRow = { walletId: 'w-1', balanceMinor: '500000', currency: 'IRR', status: 'ACTIVE' };

describe('GET /api/v1/wallet', () => {
  it('returns 200 with wallet items for each membership', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ workspaceId: 'ws-1' }], rowCount: 1 } as never);
    mockTx.mockResolvedValueOnce({ rows: [walletRow] } as never);

    const response = await GET_WALLET(makeGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET_WALLET(makeGetRequest());
    expect(response.status).toBe(401);
  });

  it('returns 200 with empty items when user has no workspace memberships', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await GET_WALLET(makeGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(0);
  });
});

// Regression (C-1): the top-up used to post a CREDIT straight from the client body (any amount, any
// currency, no payment). It now only creates a gateway payment intent; nothing is credited here.
describe('POST /api/v1/wallet (top-up intent)', () => {
  const KEY = 'topup-key-0123456789';
  function okAuth() {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockRateLimit.mockResolvedValueOnce(undefined as never);
  }

  it('creates a TOPUP gateway intent in IRT and returns the checkout URL — never a ledger credit', async () => {
    okAuth();
    mockBeginCheckout.mockResolvedValueOnce({ paymentId: 'pay-1', checkoutUrl: '/checkout/mock?payment=pay-1', gatewayReference: 'mock_pay-1' } as never);
    const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', amountToman: 500000, amountMinor: 999999999, currency: 'USD', referenceType: 'REFUND' }, KEY));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ paymentId: 'pay-1', checkoutUrl: '/checkout/mock?payment=pay-1' });
    expect(mockBeginCheckout).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-1', purpose: 'TOPUP', amountMinor: 500000n, currency: 'IRT', idempotencyKey: KEY }));
    expect(mockPostLedger).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));
    const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', amountToman: 100000 }, KEY));
    expect(response.status).toBe(401);
  });

  it('returns 403 when user lacks wallet.deposit permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));
    const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', amountToman: 100000 }, KEY));
    expect(response.status).toBe(403);
    expect(mockBeginCheckout).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockRateLimit.mockRejectedValueOnce(new AppError('RATE_LIMITED', 'Rate limit exceeded'));
    const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', amountToman: 100000 }, KEY));
    expect(response.status).toBe(429);
    expect(mockRateLimit).toHaveBeenCalledWith(expect.objectContaining({ scope: 'wallet:deposit', windowSeconds: 3600, maxRequests: 20 }));
  });

  it('returns 400 for a zero, negative, fractional or missing amountToman', async () => {
    for (const amountToman of [0, -5, 1.5, undefined, '100000']) {
      okAuth();
      const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', amountToman }, KEY));
      expect(response.status).toBe(400);
    }
    expect(mockBeginCheckout).not.toHaveBeenCalled();
  });

  it('returns a Persian 400 for an amount below ۱۰ هزار or above ۵۰ میلیون تومان', async () => {
    for (const [amountToman, message] of [[9_999, 'حداقل'], [50_000_001, 'حداکثر']] as const) {
      okAuth();
      const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', amountToman }, KEY));
      expect(response.status).toBe(400);
      expect(JSON.stringify(await response.json())).toContain(message);
    }
    expect(mockBeginCheckout).not.toHaveBeenCalled();
  });

  it('returns 400 without an Idempotency-Key (no random fallback)', async () => {
    okAuth();
    const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', amountToman: 100000 }));
    expect(response.status).toBe(400);
    expect(mockBeginCheckout).not.toHaveBeenCalled();
  });

  it('fails closed with 503 and a Persian message in production without a gateway', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAYMENTS_MOCK_ALLOWED', '');
    try {
      okAuth();
      const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', amountToman: 100000 }, KEY));
      expect(response.status).toBe(503);
      expect((await response.json()).error.message).toMatch(/درگاه/);
      expect(mockBeginCheckout).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('GET /api/v1/wallet/balance', () => {
  it('returns 200 with balance items', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockResolvedValueOnce([balanceRow] as never);

    const url = 'http://localhost:3000/api/v1/wallet/balance?workspaceId=ws-1';
    const response = await GET_BALANCE(makeGetRequest(url));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.workspaceId).toBe('ws-1');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET_BALANCE(makeGetRequest('http://localhost:3000/api/v1/wallet/balance?workspaceId=ws-1'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when workspaceId is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const response = await GET_BALANCE(makeGetRequest('http://localhost:3000/api/v1/wallet/balance'));
    expect(response.status).toBe(400);
  });

  it('returns 403 when user lacks wallet.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET_BALANCE(makeGetRequest('http://localhost:3000/api/v1/wallet/balance?workspaceId=ws-1'));
    expect(response.status).toBe(403);
  });
});
