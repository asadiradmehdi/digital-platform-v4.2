/**
 * Unit tests for POST /api/v1/checkout
 * Verifies auth, permission, item validation, and session creation.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/core/validation', () => ({ requireUuid: vi.fn() }));

const mockWithSpan = vi.fn();
const mockParseTraceparent = vi.fn();
vi.mock('../../server/observability/tracing', () => ({
  withSpan: mockWithSpan,
  parseTraceparent: mockParseTraceparent,
}));

vi.mock('../../server/commerce/checkout', () => ({ createCheckout: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { requireUuid } from '../../server/core/validation';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockRequireUuid = vi.mocked(requireUuid);

const sessionResult = {
  id: 'sess-1', workspaceId: 'ws-1',
  total: 1200000, currency: 'IRR',
  expiresAt: '2026-10-06T01:00:00Z',
};
const spanTrace = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: '01' };

beforeEach(() => {
  vi.resetAllMocks();
  mockParseTraceparent.mockReturnValue(null);
  mockRequireUuid.mockImplementation((v: unknown) => String(v));
});

type RouteModule = typeof import('../../app/api/v1/checkout/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/v1/checkout/route'));
}, 60000);

function makeRequest(
  body: unknown,
  extraHeaders: Record<string, string> = {},
): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: {
      get: (k: string) => {
        if (k === 'idempotency-key') return extraHeaders['idempotency-key'] ?? null;
        if (k === 'traceparent') return extraHeaders['traceparent'] ?? null;
        return null;
      },
    },
    url: 'http://localhost:3000/api/v1/checkout',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const validBody = { workspaceId: 'ws-1', items: [{ serviceId: 'svc-1', quantity: 2 }] };

describe('POST /api/v1/checkout', () => {
  it('returns 201 with checkout session on success', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockWithSpan.mockImplementationOnce(
      (_name: string, _meta: unknown, _fn: () => Promise<unknown>) =>
        Promise.resolve({ value: sessionResult, durationMs: 120, trace: spanTrace }),
    );

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBe('sess-1');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing orders.create permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(403);
  });

  it('returns 400 when items is an empty array', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    const response = await POST(makeRequest({ workspaceId: 'ws-1', items: [] }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when item quantity is not a positive integer', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    const response = await POST(makeRequest({ workspaceId: 'ws-1', items: [{ serviceId: 'svc-1', quantity: 0 }] }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when item has neither serviceId nor planId', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    const response = await POST(makeRequest({ workspaceId: 'ws-1', items: [{ quantity: 1 }] }));
    expect(response.status).toBe(400);
  });

  it('returns 409 on duplicate checkout (idempotency conflict)', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockWithSpan.mockImplementationOnce(() =>
      Promise.reject(new AppError('CONFLICT', 'Duplicate checkout session.')),
    );

    const response = await POST(makeRequest(validBody, { 'idempotency-key': 'idem-1' }));
    expect(response.status).toBe(409);
  });

  it('passes workspaceId and orders.create to requireWorkspacePermission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-42' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockWithSpan.mockImplementationOnce(() =>
      Promise.resolve({ value: sessionResult, durationMs: 120, trace: spanTrace }),
    );

    await POST(makeRequest(validBody));
    expect(mockRequirePermission).toHaveBeenCalledWith('user-42', 'ws-1', 'orders.create');
  });
});
