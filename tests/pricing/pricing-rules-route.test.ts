/**
 * Unit tests for GET+POST /api/v1/pricing/rules
 * Verifies platform-admin gate for rule listing and upsert.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/pricing/rules', () => ({
  listPricingRules: vi.fn(),
  upsertPricingRule: vi.fn(),
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { requirePlatformAdmin } from '../../server/identity/platform-admin';
import { listPricingRules, upsertPricingRule } from '../../server/pricing/rules';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePlatformAdmin = vi.mocked(requirePlatformAdmin);
const mockListPricingRules = vi.mocked(listPricingRules);
const mockUpsertPricingRule = vi.mocked(upsertPricingRule);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/pricing/rules/route');
let GET: RouteModule['GET'];
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ GET, POST } = await import('../../app/api/v1/pricing/rules/route'));
}, 60000);

function makeGetRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/pricing/rules',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePostRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/pricing/rules',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const ruleRow = {
  id: 'rule-1', targetType: 'SERVICE', targetId: 'svc-1',
  baseAmountMinor: '1200000', baseCurrency: 'IRR', marginPercent: 10,
};

const validBody = {
  targetType: 'SERVICE', targetId: 'svc-1',
  baseAmountMinor: '1200000', baseCurrency: 'IRR', marginPercent: 10,
};

describe('GET /api/v1/pricing/rules', () => {
  it('returns 200 with rule list for platform admin', async () => {
    mockRequireUser.mockResolvedValueOnce('admin-1' as never);
    mockRequirePlatformAdmin.mockResolvedValueOnce(undefined as never);
    mockListPricingRules.mockResolvedValueOnce([ruleRow] as never);

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('rule-1');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(401);
  });

  it('returns 403 when not a platform admin', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePlatformAdmin.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(403);
  });
});

describe('POST /api/v1/pricing/rules', () => {
  it('returns 201 with rule id on creation', async () => {
    mockRequireUser.mockResolvedValueOnce('admin-1' as never);
    mockRequirePlatformAdmin.mockResolvedValueOnce(undefined as never);
    mockUpsertPricingRule.mockResolvedValueOnce({ id: 'rule-new' } as never);

    const response = await POST(makePostRequest(validBody));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBe('rule-new');
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

    const response = await POST(makePostRequest({ marginPercent: 10 }));
    expect(response.status).toBe(400);
  });
});
