/**
 * Unit tests for GET /api/v1/b2b/usage
 * Verifies workspace-scoped usage summary and per-key usage retrieval.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/b2b/usage', () => ({
  getApiUsageSummary: vi.fn(),
  getApiKeyUsage: vi.fn(),
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { getApiUsageSummary, getApiKeyUsage } from '../../server/b2b/usage';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockGetUsageSummary = vi.mocked(getApiUsageSummary);
const mockGetApiKeyUsage = vi.mocked(getApiKeyUsage);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/b2b/usage/route');
let GET: RouteModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/b2b/usage/route'));
}, 60000);

function makeRequest(workspaceId?: string, keyId?: string, since?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/b2b/usage');
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  if (keyId) url.searchParams.set('keyId', keyId);
  if (since) url.searchParams.set('since', since);
  return {
    headers: { get: () => null },
    url: url.toString(),
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

const summaryRow = { keyId: 'key-1', requestCount: 42, errorCount: 1, lastUsedAt: '2026-10-06T00:00:00Z' };
const eventRow = { id: 'evt-1', keyId: 'key-1', endpoint: '/api/v1/orders', statusCode: 200, at: '2026-10-06T00:00:00Z' };

describe('GET /api/v1/b2b/usage (summary)', () => {
  it('returns 200 with usage summary for workspace', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockGetUsageSummary.mockResolvedValueOnce([summaryRow] as never);

    const response = await GET(makeRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].requestCount).toBe(42);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeRequest('ws-1'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when workspaceId is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(400);
  });

  it('returns 403 when missing api_keys.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET(makeRequest('ws-1'));
    expect(response.status).toBe(403);
  });
});

describe('GET /api/v1/b2b/usage (per-key events)', () => {
  it('returns 200 with per-key usage events when keyId provided', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockGetApiKeyUsage.mockResolvedValueOnce([eventRow] as never);

    const response = await GET(makeRequest('ws-1', 'key-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].endpoint).toBe('/api/v1/orders');
    expect(mockGetApiKeyUsage).toHaveBeenCalledWith('key-1', 'ws-1');
  });
});
