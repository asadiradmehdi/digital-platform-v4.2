/**
 * Unit tests for GET /api/v1/transactions
 * Verifies workspace-scoped ledger transaction listing with auth and permission checks.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ withWorkspaceTransaction: vi.fn() }));
vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/validation', () => ({ requireUuid: vi.fn() }));

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

type RouteModule = typeof import('../../app/api/v1/transactions/route');
let GET: RouteModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/transactions/route'));
}, 60000);

function makeRequest(workspaceId?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/transactions');
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  return {
    headers: { get: () => null },
    url: url.toString(),
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

const sampleTx = {
  id: 'tx-1', currency: 'IRR', referenceType: 'ORDER',
  referenceId: 'order-1', idempotencyKey: 'idem-1', createdAt: '2026-10-01T00:00:00Z', entries: [],
};

describe('GET /api/v1/transactions', () => {
  it('returns 200 with transaction items', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockResolvedValueOnce({ rows: [sampleTx] } as never);

    const response = await GET(makeRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('tx-1');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeRequest('ws-1'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when workspaceId is missing or invalid', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockImplementationOnce(() => {
      throw new AppError('VALIDATION_ERROR', 'workspaceId required');
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(400);
  });

  it('returns 403 when user lacks wallet.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET(makeRequest('ws-1'));
    expect(response.status).toBe(403);
  });

  it('checks wallet.read permission for the correct workspaceId', async () => {
    mockRequireUser.mockResolvedValueOnce('user-99' as never);
    mockRequireUuid.mockReturnValueOnce('ws-99' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockResolvedValueOnce({ rows: [] } as never);

    await GET(makeRequest('ws-99'));
    expect(mockRequirePermission).toHaveBeenCalledWith('user-99', 'ws-99', 'wallet.read');
  });

  it('returns empty items when no transactions exist', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockResolvedValueOnce({ rows: [] } as never);

    const response = await GET(makeRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(0);
  });
});
