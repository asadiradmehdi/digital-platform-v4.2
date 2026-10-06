/**
 * Unit tests for GET /api/v1/services and GET /api/v1/services/:id
 * Verifies public catalog listing and authenticated service detail retrieval.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/pagination', () => ({
  parseLimit: vi.fn().mockReturnValue(20),
  decodeCursor: vi.fn().mockReturnValue(null),
  encodeCursor: vi.fn().mockReturnValue(null),
}));
vi.mock('../../server/commerce/catalog', () => ({
  listServices: vi.fn(),
  getService: vi.fn(),
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { listServices, getService } from '../../server/commerce/catalog';
import { parseLimit, decodeCursor } from '../../server/core/pagination';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockListServices = vi.mocked(listServices);
const mockGetService = vi.mocked(getService);
const mockParseLimit = vi.mocked(parseLimit);
const mockDecodeCursor = vi.mocked(decodeCursor);

beforeEach(() => {
  vi.resetAllMocks();
  mockParseLimit.mockReturnValue(20 as never);
  mockDecodeCursor.mockReturnValue(null as never);
});

type ListRouteModule = typeof import('../../app/api/v1/services/route');
type DetailRouteModule = typeof import('../../app/api/v1/services/[id]/route');
let GET_LIST: ListRouteModule['GET'];
let GET_DETAIL: DetailRouteModule['GET'];

beforeAll(async () => {
  ({ GET: GET_LIST } = await import('../../app/api/v1/services/route'));
  ({ GET: GET_DETAIL } = await import('../../app/api/v1/services/[id]/route'));
}, 60000);

function makeListRequest(serviceType?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/services');
  if (serviceType) url.searchParams.set('serviceType', serviceType);
  return {
    headers: { get: () => null },
    url: url.toString(),
    nextUrl: url,
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makeDetailRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/services/svc-1',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const sampleService = {
  id: 'svc-1', name: 'فالوور اینستاگرام', serviceType: 'INSTAGRAM_FOLLOWERS',
  priceMinor: '1200000', currency: 'IRR', active: true,
};

describe('GET /api/v1/services (public catalog)', () => {
  it('returns 200 with service list without authentication', async () => {
    mockListServices.mockResolvedValueOnce({ items: [sampleService], nextCursor: null } as never);

    const response = await GET_LIST(makeListRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('svc-1');
    expect(data.nextCursor).toBeNull();
  });

  it('returns 200 with empty items when no services exist', async () => {
    mockListServices.mockResolvedValueOnce({ items: [], nextCursor: null } as never);

    const response = await GET_LIST(makeListRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(0);
  });

  it('passes serviceType filter to listServices', async () => {
    mockListServices.mockResolvedValueOnce({ items: [], nextCursor: null } as never);

    await GET_LIST(makeListRequest('INSTAGRAM_FOLLOWERS'));
    expect(mockListServices).toHaveBeenCalledWith(20, null, 'INSTAGRAM_FOLLOWERS');
  });
});

describe('GET /api/v1/services/:id', () => {
  it('returns 200 with service detail when authenticated', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockGetService.mockResolvedValueOnce(sampleService as never);

    const response = await GET_DETAIL(makeDetailRequest(), makeParams('svc-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe('svc-1');
  });

  it('returns 401 when not authenticated for detail', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET_DETAIL(makeDetailRequest(), makeParams('svc-1'));
    expect(response.status).toBe(401);
  });

  it('returns 404 when service not found', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockGetService.mockRejectedValueOnce(new AppError('NOT_FOUND', 'Service not found.'));

    const response = await GET_DETAIL(makeDetailRequest(), makeParams('svc-missing'));
    expect(response.status).toBe(404);
  });
});
