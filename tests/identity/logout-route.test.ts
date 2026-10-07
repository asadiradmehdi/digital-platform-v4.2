/**
 * Unit tests for POST /api/v1/auth/logout
 * Verifies session revocation and cookie clearing on logout.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/sessions', () => ({
  revokeSession: vi.fn(),
  resolveSession: vi.fn(),
}));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('../../server/identity/session-cookie', () => ({
  SESSION_COOKIE_NAME: '__Host-session',
  clearSessionCookie: vi.fn(),
  setSessionCookie: vi.fn(),
}));

const mockCookieStore = { get: vi.fn() };
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));

import { revokeSession, resolveSession } from '../../server/identity/sessions';
import { cookies } from 'next/headers';

const mockRevoke = vi.mocked(revokeSession);
const mockResolve = vi.mocked(resolveSession);
const mockCookies = vi.mocked(cookies);

beforeEach(() => {
  vi.resetAllMocks();
  mockCookies.mockResolvedValue(mockCookieStore as never);
  mockResolve.mockResolvedValue('user-1' as never);
});

type RouteModule = typeof import('../../app/api/v1/auth/logout/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/v1/auth/logout/route'));
}, 60000);

function makeRequest(): import('next/server').NextRequest {
  return {
    headers: { get: (_k: string) => null },
    url: 'http://localhost:3000/api/v1/auth/logout',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

describe('POST /api/v1/auth/logout', () => {
  it('returns 200 with ok:true when session cookie exists', async () => {
    mockCookieStore.get.mockReturnValueOnce({ value: 'session-token-xyz' });
    mockRevoke.mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('revokes the correct session token', async () => {
    mockCookieStore.get.mockReturnValueOnce({ value: 'my-session-token' });
    mockRevoke.mockResolvedValueOnce(undefined);

    await POST(makeRequest());
    expect(mockRevoke).toHaveBeenCalledWith('my-session-token');
  });

  it('returns 200 with ok:true when no session cookie is present', async () => {
    mockCookieStore.get.mockReturnValueOnce(undefined);

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('writes a LOGOUT audit event when session is present', async () => {
    mockCookieStore.get.mockReturnValueOnce({ value: 'session-token-audit' });
    mockRevoke.mockResolvedValueOnce(undefined);
    // resolveSession is set to return 'user-1' in beforeEach

    await POST(makeRequest());
    const { writeAudit } = await import('../../server/core/audit');
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGOUT' }),
    );
  });
});
