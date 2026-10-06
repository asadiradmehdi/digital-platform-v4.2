/**
 * Unit tests for GET+POST /api/v1/content/entities
 * Verifies public catalog listing and platform-admin content management.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/content/entities', () => ({
  listContentEntities: vi.fn(),
  upsertContentEntity: vi.fn(),
  auditOrphanContent: vi.fn(),
  findStaleContent: vi.fn(),
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { requirePlatformAdmin } from '../../server/identity/platform-admin';
import { query } from '../../server/core/db';
import { listContentEntities, upsertContentEntity, auditOrphanContent, findStaleContent } from '../../server/content/entities';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePlatformAdmin = vi.mocked(requirePlatformAdmin);
const mockQuery = vi.mocked(query);
const mockListEntities = vi.mocked(listContentEntities);
const mockUpsertEntity = vi.mocked(upsertContentEntity);
const mockAuditOrphans = vi.mocked(auditOrphanContent);
const mockFindStale = vi.mocked(findStaleContent);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/content/entities/route');
let GET: RouteModule['GET'];
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ GET, POST } = await import('../../app/api/v1/content/entities/route'));
}, 60000);

function makeGetRequest(params: Record<string, string> = {}): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/content/entities');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
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
    url: 'http://localhost:3000/api/v1/content/entities',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const entityRow = {
  id: 'ent-1', entityType: 'SERVICE_PAGE', slug: 'instagram-followers',
  canonicalPath: '/services/instagram/followers', title: 'فالوور اینستاگرام',
  description: 'خرید فالوور اینستاگرام', data: {}, indexable: true, updatedAt: '2026-01-01T00:00:00Z',
};

describe('GET /api/v1/content/entities (public list)', () => {
  it('returns 200 with entity list (public, no auth required)', async () => {
    mockListEntities.mockResolvedValueOnce([entityRow] as never);

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('ent-1');
  });

  it('returns 200 with empty list', async () => {
    mockListEntities.mockResolvedValueOnce([] as never);

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(0);
  });

  it('returns 200 with entity found by canonical path', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [entityRow], rowCount: 1 } as never);

    const response = await GET(makeGetRequest({ path: '/services/instagram/followers' }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.entity.id).toBe('ent-1');
  });

  it('returns 404 when canonical path not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await GET(makeGetRequest({ path: '/services/nonexistent' }));
    expect(response.status).toBe(404);
  });
});

describe('GET /api/v1/content/entities (admin actions)', () => {
  it('returns 200 with orphan audit results for platform admin', async () => {
    mockRequireUser.mockResolvedValueOnce('admin-1' as never);
    mockRequirePlatformAdmin.mockResolvedValueOnce(undefined as never);
    mockAuditOrphans.mockResolvedValueOnce([{ id: 'ent-orphan' }] as never);

    const response = await GET(makeGetRequest({ action: 'audit' }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.orphans).toHaveLength(1);
  });

  it('returns 403 when non-admin requests audit', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePlatformAdmin.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET(makeGetRequest({ action: 'audit' }));
    expect(response.status).toBe(403);
  });
});

describe('POST /api/v1/content/entities', () => {
  const validBody = {
    entityType: 'SERVICE_PAGE', slug: 'instagram-followers',
    canonicalPath: '/services/instagram/followers',
    title: 'فالوور اینستاگرام', description: 'خرید فالوور اینستاگرام',
  };

  it('returns 201 with entity id for platform admin', async () => {
    mockRequireUser.mockResolvedValueOnce('admin-1' as never);
    mockRequirePlatformAdmin.mockResolvedValueOnce(undefined as never);
    mockUpsertEntity.mockResolvedValueOnce('ent-new' as never);

    const response = await POST(makePostRequest(validBody));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBe('ent-new');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST(makePostRequest(validBody));
    expect(response.status).toBe(401);
  });

  it('returns 403 when not a platform admin', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePlatformAdmin.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await POST(makePostRequest(validBody));
    expect(response.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    mockRequireUser.mockResolvedValueOnce('admin-1' as never);
    mockRequirePlatformAdmin.mockResolvedValueOnce(undefined as never);

    const response = await POST(makePostRequest({ slug: 'instagram-followers' }));
    expect(response.status).toBe(400);
  });
});
