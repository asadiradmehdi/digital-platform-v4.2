/**
 * Unit tests for POST /api/v1/ai/catalog/sync
 * Verifies platform-admin gate and catalog sync trigger.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/ai/model-catalog', () => ({ syncModelCatalog: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { requirePlatformAdmin } from '../../server/identity/platform-admin';
import { syncModelCatalog } from '../../server/ai/model-catalog';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePlatformAdmin = vi.mocked(requirePlatformAdmin);
const mockSyncModelCatalog = vi.mocked(syncModelCatalog);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/ai/catalog/sync/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/v1/ai/catalog/sync/route'));
}, 60000);

function makeRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/ai/catalog/sync',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

describe('POST /api/v1/ai/catalog/sync', () => {
  it('returns 200 with synced:true when admin triggers sync', async () => {
    mockRequireUser.mockResolvedValueOnce('admin-1' as never);
    mockRequirePlatformAdmin.mockResolvedValueOnce(undefined as never);
    mockSyncModelCatalog.mockResolvedValueOnce(undefined as never);

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.synced).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 403 when user is not a platform admin', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePlatformAdmin.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await POST(makeRequest());
    expect(response.status).toBe(403);
  });
});
