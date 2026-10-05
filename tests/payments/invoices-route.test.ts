/**
 * Unit tests for GET /api/v1/invoices and GET /api/v1/invoices/:id
 * Verifies auth, workspace permission, listing, and detail retrieval.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/validation', () => ({ requireUuid: vi.fn() }));
vi.mock('../../server/payments/invoice', () => ({
  listInvoices: vi.fn(),
  getInvoice: vi.fn(),
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { requireUuid } from '../../server/core/validation';
import { listInvoices, getInvoice } from '../../server/payments/invoice';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockRequireUuid = vi.mocked(requireUuid);
const mockListInvoices = vi.mocked(listInvoices);
const mockGetInvoice = vi.mocked(getInvoice);

beforeEach(() => vi.resetAllMocks());

type ListRouteModule = typeof import('../../app/api/v1/invoices/route');
type DetailRouteModule = typeof import('../../app/api/v1/invoices/[id]/route');
let GET_LIST: ListRouteModule['GET'];
let GET_DETAIL: DetailRouteModule['GET'];

beforeAll(async () => {
  ({ GET: GET_LIST } = await import('../../app/api/v1/invoices/route'));
  ({ GET: GET_DETAIL } = await import('../../app/api/v1/invoices/[id]/route'));
}, 60000);

function makeListRequest(workspaceId?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/invoices');
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  return {
    headers: { get: () => null },
    url: url.toString(),
    nextUrl: url,
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makeDetailRequest(workspaceId?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/invoices/inv-1');
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  return {
    headers: { get: () => null },
    url: url.toString(),
    nextUrl: url,
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const sampleInvoice = { id: 'inv-1', workspaceId: 'ws-1', totalMinor: '50000', currency: 'IRR' };

describe('GET /api/v1/invoices', () => {
  it('returns 200 with invoice list', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockListInvoices.mockResolvedValueOnce([sampleInvoice] as never);

    const response = await GET_LIST(makeListRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('inv-1');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET_LIST(makeListRequest('ws-1'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when workspaceId is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockImplementationOnce(() => {
      throw new AppError('VALIDATION_ERROR', 'workspaceId required');
    });

    const response = await GET_LIST(makeListRequest());
    expect(response.status).toBe(400);
  });

  it('returns 403 when user lacks orders.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET_LIST(makeListRequest('ws-1'));
    expect(response.status).toBe(403);
  });

  it('returns empty items array when no invoices exist', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockListInvoices.mockResolvedValueOnce([] as never);

    const response = await GET_LIST(makeListRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(0);
  });
});

describe('GET /api/v1/invoices/:id', () => {
  it('returns 200 with invoice detail', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockGetInvoice.mockResolvedValueOnce(sampleInvoice as never);

    const response = await GET_DETAIL(makeDetailRequest('ws-1'), makeParams('inv-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe('inv-1');
  });

  it('returns 404 when invoice not found', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockGetInvoice.mockRejectedValueOnce(new AppError('NOT_FOUND', 'Invoice not found.'));

    const response = await GET_DETAIL(makeDetailRequest('ws-1'), makeParams('inv-missing'));
    expect(response.status).toBe(404);
  });

  it('returns 403 when user lacks orders.read permission for detail', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireUuid.mockReturnValueOnce('ws-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET_DETAIL(makeDetailRequest('ws-1'), makeParams('inv-1'));
    expect(response.status).toBe(403);
  });
});
