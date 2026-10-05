/**
 * Unit tests for GET /api/v1/analytics
 * Verifies workspace-scoped ledger metrics are returned correctly.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({
  withWorkspaceTransaction: vi.fn(),
}));

vi.mock('../../server/identity/request-user', () => ({
  requireRequestUser: vi.fn(),
}));

vi.mock('../../server/identity/rbac', () => ({
  requireWorkspacePermission: vi.fn(),
}));

vi.mock('../../server/core/validation', () => ({
  requireUuid: vi.fn(),
}));

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

type RouteModule = typeof import('../../app/api/v1/analytics/route');
let GET: RouteModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/analytics/route'));
});

function makeRequest(workspaceId?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/analytics');
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  return {
    headers: { get: (_k: string) => null },
    url: url.toString(),
    nextUrl: url,
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

describe('GET /api/v1/analytics', () => {
  it('returns 200 with credit/debit metrics when auth and permission pass', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockResolvedValueOnce({
      rows: [{ creditMinor: '48600000', debitMinor: '19350000' }],
    } as never);

    const response = await GET(makeRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.workspaceId).toBe('ws-1');
    expect(data.metrics.creditMinor).toBe('48600000');
    expect(data.metrics.debitMinor).toBe('19350000');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeRequest('ws-1'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when workspaceId is missing or invalid', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockImplementationOnce(() => { throw new AppError('VALIDATION_ERROR', 'workspaceId required'); });

    const response = await GET(makeRequest());
    expect(response.status).toBe(400);
  });

  it('returns 403 when user lacks analytics.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET(makeRequest('ws-1'));
    expect(response.status).toBe(403);
  });

  it('returns zero metrics when no ledger entries exist', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockResolvedValueOnce({ rows: [] } as never);

    const response = await GET(makeRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.metrics.creditMinor).toBe('0');
    expect(data.metrics.debitMinor).toBe('0');
  });

  it('checks analytics.read permission for the correct workspaceId', async () => {
    mockRequireUser.mockResolvedValueOnce('user-99' as never);
    mockRequireUuid.mockReturnValueOnce('ws-99' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockTx.mockResolvedValueOnce({ rows: [{ creditMinor: '0', debitMinor: '0' }] } as never);

    await GET(makeRequest('ws-99'));

    expect(mockRequirePermission).toHaveBeenCalledWith('user-99', 'ws-99', 'analytics.read');
  });
});
