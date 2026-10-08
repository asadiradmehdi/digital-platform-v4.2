/**
 * Unit tests for GET /api/v1/me
 * Verifies user profile and workspace list are returned correctly.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

vi.mock('../../server/identity/request-user', () => ({
  requireRequestUser: vi.fn(),
}));
vi.mock('../../server/identity/reauth', () => ({ requireFreshOtp: vi.fn(), requireVerifiedPhone: vi.fn() }));
vi.mock('../../server/core/security-events', () => ({ recordSecurityEvent: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));

import { query } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';
import { AppError } from '../../server/core/errors';

const mockQuery = vi.mocked(query);
const mockRequireUser = vi.mocked(requireRequestUser);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/me/route');
let GET: RouteModule['GET'];
let PATCH: RouteModule['PATCH'];

beforeAll(async () => {
  ({ GET, PATCH } = await import('../../app/api/v1/me/route'));
});

function makeRequest(): import('next/server').NextRequest {
  return {
    headers: { get: (_k: string) => null },
    url: 'http://localhost:3000/api/v1/me',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

describe('GET /api/v1/me', () => {
  it('returns 200 with user and workspaces when authenticated', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user-1', email: 'test@example.com', displayName: 'Test User', status: 'ACTIVE', createdAt: '2026-01-01' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({
        rows: [{ id: 'ws-1', name: 'Main Workspace', slug: 'main', status: 'ACTIVE', memberStatus: 'ACTIVE' }],
        rowCount: 1,
      } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.id).toBe('user-1');
    expect(data.user.email).toBe('test@example.com');
    expect(data.workspaces).toHaveLength(1);
    expect(data.workspaces[0].slug).toBe('main');
  });

  it('returns 401 when user is not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 500 when user record is not found in DB', async () => {
    mockRequireUser.mockResolvedValueOnce('user-missing' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
  });

  it('queries users table with correct userId', async () => {
    mockRequireUser.mockResolvedValueOnce('user-42' as never);
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user-42', email: 'u@e.com', displayName: 'U', status: 'ACTIVE', createdAt: '2026-01-01' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await GET(makeRequest());

    const [firstSql, firstParams] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(firstSql).toContain('FROM users WHERE id=$1');
    expect(firstParams[0]).toBe('user-42');
  });

  it('queries workspaces with ACTIVE membership filter', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user-1', email: 'a@b.com', displayName: 'A', status: 'ACTIVE', createdAt: '2026-01-01' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await GET(makeRequest());

    const [wsSql, wsParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(wsSql).toContain("wm.status='ACTIVE'");
    expect(wsParams[0]).toBe('user-1');
  });
});

describe('PATCH /api/v1/me (contact changes)', () => {
  const patch = (body: unknown) => ({
    json: async () => body,
    headers: { get: (k: string) => (k === 'origin' ? 'http://localhost:3000' : null), has: () => false },
    url: 'http://localhost:3000/api/v1/me',
    method: 'PATCH',
  } as unknown as import('next/server').NextRequest);

  // Regression: the profile form wrote any typed number into users.phone, which phone sign-in would trust.
  it('refuses to change the phone without the verified flow', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ phone: '+989121234567', email: 'a@b.c' }] } as never);
    const res = await PATCH(patch({ displayName: 'Ali', phone: '09351112233' }));
    expect(res.status).toBe(400);
    expect(mockQuery.mock.calls.some(c => String(c[0]).includes('SET phone'))).toBe(false);
  });

  it('accepts the unchanged number (in any notation) with a name change', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ phone: '+989121234567', email: 'a@b.c' }] } as never).mockResolvedValueOnce({ rows: [] } as never);
    const res = await PATCH(patch({ displayName: 'Ali', phone: '۰۹۱۲ ۱۲۳ ۴۵۶۷' }));
    expect(res.status).toBe(200);
  });

  it('requires a fresh OTP proof to change the email', async () => {
    const { requireFreshOtp } = await import('../../server/identity/reauth');
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ phone: '+989121234567', email: 'a@b.c' }] } as never);
    vi.mocked(requireFreshOtp).mockRejectedValueOnce(new AppError('FORBIDDEN', 'otp', { requiresOtp: true }));
    const res = await PATCH(patch({ email: 'new@b.c' }));
    expect(res.status).toBe(403);
    expect(mockQuery.mock.calls.some(c => String(c[0]).includes('SET email'))).toBe(false);
  });
});
