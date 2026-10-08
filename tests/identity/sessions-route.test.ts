import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/identity/sessions', async () => {
  const { createHash } = await import('node:crypto');
  return { revokeAllOtherSessions: vi.fn(), listSignedInDevices: vi.fn(), hashSessionToken: (t: string) => createHash('sha256').update(t).digest('hex') };
});
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/core/security-events', () => ({ recordSecurityEvent: vi.fn() }));
vi.mock('../../server/identity/session-cookie', () => ({
  SESSION_COOKIE_NAME: '__Host-session',
}));

const mockCookieStore = { get: vi.fn() };
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { cookies } from 'next/headers';
import { query } from '../../server/core/db';
import { listSignedInDevices, revokeAllOtherSessions } from '../../server/identity/sessions';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockCookies = vi.mocked(cookies);
const mockQuery = vi.mocked(query);
const mockList = vi.mocked(listSignedInDevices);
void mockQuery;
const mockRevokeAll = vi.mocked(revokeAllOtherSessions);

beforeEach(() => {
  vi.resetAllMocks();
  mockCookies.mockResolvedValue(mockCookieStore as never);
  mockCookieStore.get.mockReturnValue(null);
});

type RouteModule = typeof import('../../app/api/v1/auth/sessions/route');
let GET: RouteModule['GET'];
let DELETE: RouteModule['DELETE'];

beforeAll(async () => {
  ({ GET, DELETE } = await import('../../app/api/v1/auth/sessions/route'));
}, 60000);

function makeRequest(method: 'GET' | 'DELETE'): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/auth/sessions',
    method,
  } as unknown as import('next/server').NextRequest;
}

describe('GET /api/v1/auth/sessions', () => {
  it('returns 200 with session list', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockCookieStore.get.mockReturnValueOnce({ value: 'session-token' });
    mockList.mockResolvedValueOnce([{ id: 's-1', clientType: 'WEB', deviceName: 'Chrome', lastSeenAt: null, createdAt: '2026-10-01', current: true }] as never);

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].current).toBe(true);
  });

  it('returns 200 with empty list when no active sessions', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockList.mockResolvedValueOnce([] as never);

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(0);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('marks current session by hashing session cookie', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockCookieStore.get.mockReturnValueOnce({ value: 'my-token' });
    mockList.mockResolvedValueOnce([] as never);

    await GET(makeRequest('GET'));
    expect(mockList).toHaveBeenCalledWith('user-1', expect.stringMatching(/^[0-9a-f]{64}$/)); // sha256 of the cookie
  });

  it('identifies the app\'s own session from its bearer token', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockList.mockResolvedValueOnce([] as never);
    const req = { headers: { get: (k: string) => (k === 'authorization' ? 'Bearer app-token' : null) }, url: 'http://localhost:3000/api/v1/auth/sessions', method: 'GET' } as unknown as import('next/server').NextRequest;
    await GET(req);
    const { createHash } = await import('node:crypto');
    expect(mockList).toHaveBeenCalledWith('user-1', createHash('sha256').update('app-token').digest('hex'));
  });
});

describe('DELETE /api/v1/auth/sessions', () => {
  it('returns 200 and revokes all other sessions', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockCookieStore.get.mockReturnValueOnce({ value: 'my-token' });
    mockRevokeAll.mockResolvedValueOnce(undefined as never);

    const res = await DELETE(makeRequest('DELETE'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const res = await DELETE(makeRequest('DELETE'));
    expect(res.status).toBe(401);
  });

  it('passes current session hash to revokeAllOtherSessions', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockCookieStore.get.mockReturnValueOnce({ value: 'tok' });
    mockRevokeAll.mockResolvedValueOnce(undefined as never);

    await DELETE(makeRequest('DELETE'));
    expect(mockRevokeAll).toHaveBeenCalledWith('user-1', expect.stringMatching(/^[0-9a-f]{64}$/));
  });
});
