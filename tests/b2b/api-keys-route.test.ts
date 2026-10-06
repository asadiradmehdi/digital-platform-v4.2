/**
 * Unit tests for GET+POST+DELETE /api/v1/b2b/api-keys
 * Verifies listing, creation (with optional rate-limit), and revocation of API keys.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/b2b/api-keys', () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
  resolveApiKey: vi.fn(),
}));
vi.mock('../../server/b2b/rate-limit', () => ({ upsertRateLimit: vi.fn() }));
vi.mock('../../server/identity/step-up', () => ({ enforceStepUpPolicy: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { createApiKey, listApiKeys, revokeApiKey, resolveApiKey } from '../../server/b2b/api-keys';
import { upsertRateLimit } from '../../server/b2b/rate-limit';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockCreateApiKey = vi.mocked(createApiKey);
const mockListApiKeys = vi.mocked(listApiKeys);
const mockRevokeApiKey = vi.mocked(revokeApiKey);
const mockResolveApiKey = vi.mocked(resolveApiKey);
const mockUpsertRateLimit = vi.mocked(upsertRateLimit);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/b2b/api-keys/route');
let GET: RouteModule['GET'];
let POST: RouteModule['POST'];
let DELETE: RouteModule['DELETE'];

beforeAll(async () => {
  ({ GET, POST, DELETE } = await import('../../app/api/v1/b2b/api-keys/route'));
}, 60000);

function makeGetRequest(workspaceId?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/b2b/api-keys');
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  return {
    headers: { get: () => null },
    url: url.toString(),
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePostRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/b2b/api-keys',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

function makeDeleteRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/b2b/api-keys',
    method: 'DELETE',
  } as unknown as import('next/server').NextRequest;
}

const keyRow = { id: 'key-1', workspaceId: 'ws-1', name: 'My Key', scopes: ['orders.read'], environment: 'live' };

describe('GET /api/v1/b2b/api-keys', () => {
  it('returns 200 with api key list', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockListApiKeys.mockResolvedValueOnce([keyRow] as never);

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('key-1');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when workspaceId is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(400);
  });

  it('returns 403 when missing api_keys.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(403);
  });
});

describe('POST /api/v1/b2b/api-keys', () => {
  const validBody = { workspaceId: 'ws-1', name: 'My Key', scopes: ['orders.read'] };

  it('returns 201 with new api key', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockCreateApiKey.mockResolvedValueOnce('dp_live_rawkey123' as never);

    const response = await POST(makePostRequest(validBody));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.key).toBe('dp_live_rawkey123');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST(makePostRequest(validBody));
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing api_keys.write permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await POST(makePostRequest(validBody));
    expect(response.status).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', scopes: ['orders.read'] }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when scopes is empty', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', name: 'Key', scopes: [] }));
    expect(response.status).toBe(400);
  });

  it('calls upsertRateLimit when rateLimitPerMinute is provided', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockCreateApiKey.mockResolvedValueOnce('dp_live_rawkey123' as never);
    mockResolveApiKey.mockResolvedValueOnce({ id: 'key-1' } as never);
    mockUpsertRateLimit.mockResolvedValueOnce(undefined as never);

    const response = await POST(makePostRequest({ ...validBody, rateLimitPerMinute: 100 }));
    expect(response.status).toBe(201);
    expect(mockUpsertRateLimit).toHaveBeenCalledWith('key-1', 60, 100);
  });
});

describe('DELETE /api/v1/b2b/api-keys', () => {
  const validBody = { workspaceId: 'ws-1', keyId: 'key-1' };

  it('returns 200 with revoked:true on success', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockRevokeApiKey.mockResolvedValueOnce(true as never);

    const response = await DELETE(makeDeleteRequest(validBody));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.revoked).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await DELETE(makeDeleteRequest(validBody));
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing api_keys.write permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await DELETE(makeDeleteRequest(validBody));
    expect(response.status).toBe(403);
  });

  it('returns 404 when key not found or already revoked', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockRevokeApiKey.mockResolvedValueOnce(false as never);

    const response = await DELETE(makeDeleteRequest(validBody));
    expect(response.status).toBe(404);
  });

  it('returns 400 when keyId is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    const response = await DELETE(makeDeleteRequest({ workspaceId: 'ws-1' }));
    expect(response.status).toBe(400);
  });
});
