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
vi.mock('../../server/core/validation', () => ({ requireUuid: vi.fn() }));
vi.mock('../../server/billing/ledger', () => ({ postLedgerEntry: vi.fn() }));

import { query, withWorkspaceTransaction } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { requireUuid } from '../../server/core/validation';
import { postLedgerEntry } from '../../server/billing/ledger';
import { AppError } from '../../server/core/errors';

const mockQuery = vi.mocked(query);
const mockTx = vi.mocked(withWorkspaceTransaction);
const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockRequireUuid = vi.mocked(requireUuid);
const mockPostLedger = vi.mocked(postLedgerEntry);

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

describe('POST /api/v1/wallet', () => {
  it('returns 201 with entryId and balanceMinor on successful deposit', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid
      .mockReturnValueOnce('ws-1' as never)
      .mockReturnValueOnce('w-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockPostLedger.mockResolvedValueOnce({ id: 'entry-1' } as never);
    mockTx.mockResolvedValueOnce({ rows: [{ balanceMinor: '600000', currency: 'IRR' }] } as never);

    const response = await POST_WALLET(makePostRequest({
      workspaceId: 'ws-1', walletId: 'w-1', amountMinor: 100000, currency: 'IRR',
    }));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.entryId).toBe('entry-1');
    expect(data.balanceMinor).toBe('600000');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', walletId: 'w-1', amountMinor: 100000, currency: 'IRR' }));
    expect(response.status).toBe(401);
  });

  it('returns 403 when user lacks wallet.deposit permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid
      .mockReturnValueOnce('ws-1' as never)
      .mockReturnValueOnce('w-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', walletId: 'w-1', amountMinor: 100000, currency: 'IRR' }));
    expect(response.status).toBe(403);
  });

  it('returns 400 when amountMinor is zero or negative', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid
      .mockReturnValueOnce('ws-1' as never)
      .mockReturnValueOnce('w-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', walletId: 'w-1', amountMinor: 0, currency: 'IRR' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when currency is not a 3-letter code', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid
      .mockReturnValueOnce('ws-1' as never)
      .mockReturnValueOnce('w-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    const response = await POST_WALLET(makePostRequest({ workspaceId: 'ws-1', walletId: 'w-1', amountMinor: 100000, currency: 'INVALID' }));
    expect(response.status).toBe(400);
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
