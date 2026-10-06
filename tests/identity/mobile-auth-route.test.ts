/**
 * Unit tests for mobile authentication routes:
 *   POST /api/v1/auth/mobile/session  (login → access token)
 *   POST /api/v1/auth/mobile/logout   (bearer token revocation)
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({
  requireRequestUser: vi.fn(),
  requireBearerToken: vi.fn(),
}));
vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/identity/password', () => ({ verifyPassword: vi.fn() }));
vi.mock('../../server/identity/mobile-sessions', () => ({
  createMobileSession: vi.fn(),
  revokeMobileSession: vi.fn(),
}));
vi.mock('../../server/core/distributed-rate-limit', () => ({ consumeDistributedRateLimit: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
  assertSameOrigin: vi.fn(),
}));
vi.mock('../../server/core/security-events', () => ({ recordSecurityEvent: vi.fn() }));
vi.mock('../../server/identity/account-security', () => ({
  isLoginLocked: vi.fn(),
  recordLoginFailure: vi.fn(),
  recordLoginSuccess: vi.fn(),
}));
vi.mock('../../server/core/validation', () => ({ requireString: vi.fn() }));

import { requireBearerToken } from '../../server/identity/request-user';
import { query } from '../../server/core/db';
import { verifyPassword } from '../../server/identity/password';
import { createMobileSession, revokeMobileSession } from '../../server/identity/mobile-sessions';
import { consumeDistributedRateLimit } from '../../server/core/distributed-rate-limit';
import { isLoginLocked, recordLoginFailure, recordLoginSuccess } from '../../server/identity/account-security';
import { requireString } from '../../server/core/validation';
import { AppError } from '../../server/core/errors';

const mockRequireBearerToken = vi.mocked(requireBearerToken);
const mockQuery = vi.mocked(query);
const mockVerifyPassword = vi.mocked(verifyPassword);
const mockCreateMobileSession = vi.mocked(createMobileSession);
const mockRevokeMobileSession = vi.mocked(revokeMobileSession);
const mockConsumeRateLimit = vi.mocked(consumeDistributedRateLimit);
const mockIsLoginLocked = vi.mocked(isLoginLocked);
const mockRecordLoginFailure = vi.mocked(recordLoginFailure);
const mockRecordLoginSuccess = vi.mocked(recordLoginSuccess);
const mockRequireString = vi.mocked(requireString);

type SessionModule = typeof import('../../app/api/v1/auth/mobile/session/route');
type LogoutModule = typeof import('../../app/api/v1/auth/mobile/logout/route');

let POST_SESSION: SessionModule['POST'];
let POST_LOGOUT: LogoutModule['POST'];

beforeAll(async () => {
  ({ POST: POST_SESSION } = await import('../../app/api/v1/auth/mobile/session/route'));
  ({ POST: POST_LOGOUT } = await import('../../app/api/v1/auth/mobile/logout/route'));
}, 60000);

beforeEach(() => {
  vi.resetAllMocks();
  mockConsumeRateLimit.mockResolvedValue(undefined as never);
  mockRequireString.mockImplementation((v: unknown) => String(v));
});

const validLoginBody = {
  identifier: 'user@example.com',
  password: 'SuperStrong!1234',
  platform: 'ios',
  deviceId: 'device-id-1234567890',
};

function makeSessionRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (k: string) => k === 'user-agent' ? 'TestApp/1.0' : null },
    url: 'http://localhost:3000/api/v1/auth/mobile/session',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

function makeLogoutRequest(): import('next/server').NextRequest {
  return {
    headers: { get: (k: string) => k === 'authorization' ? 'Bearer tok-123' : null },
    url: 'http://localhost:3000/api/v1/auth/mobile/logout',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

// ─── Mobile Session (Login) ───────────────────────────────────────────────────

describe('POST /api/v1/auth/mobile/session', () => {
  it('returns 200 with accessToken on valid credentials', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'user-1', credentialHash: 'hash' }], rowCount: 1 } as never);
    mockIsLoginLocked.mockResolvedValueOnce(false as never);
    mockVerifyPassword.mockResolvedValueOnce(true as never);
    mockRecordLoginSuccess.mockResolvedValueOnce(undefined as never);
    mockCreateMobileSession.mockResolvedValueOnce({ token: 'tok-abc' } as never);

    const response = await POST_SESSION(makeSessionRequest(validLoginBody));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.accessToken).toBe('tok-abc');
    expect(data.tokenType).toBe('Bearer');
  });

  it('returns 401 when credentials are invalid', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'user-1', credentialHash: 'hash' }], rowCount: 1 } as never);
    mockIsLoginLocked.mockResolvedValueOnce(false as never);
    mockVerifyPassword.mockResolvedValueOnce(false as never);
    mockRecordLoginFailure.mockResolvedValueOnce(undefined as never);

    const response = await POST_SESSION(makeSessionRequest(validLoginBody));
    expect(response.status).toBe(401);
  });

  it('returns 401 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await POST_SESSION(makeSessionRequest(validLoginBody));
    expect(response.status).toBe(401);
  });

  it('returns 401 when account is locked', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'user-1', credentialHash: 'hash' }], rowCount: 1 } as never);
    mockIsLoginLocked.mockResolvedValueOnce(true as never);
    mockVerifyPassword.mockResolvedValueOnce(true as never);

    const response = await POST_SESSION(makeSessionRequest(validLoginBody));
    expect(response.status).toBe(401);
  });

  it('returns 400 on unsupported platform', async () => {
    mockRequireString.mockImplementation((v: unknown, field?: string) => {
      const val = String(v);
      if (field === 'platform') return val.toUpperCase();
      return val;
    });

    const response = await POST_SESSION(makeSessionRequest({ ...validLoginBody, platform: 'windows' }));
    expect(response.status).toBe(400);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockConsumeRateLimit.mockRejectedValueOnce(new AppError('RATE_LIMITED', 'Too many requests.'));

    const response = await POST_SESSION(makeSessionRequest(validLoginBody));
    expect(response.status).toBe(429);
  });
});

// ─── Mobile Logout ───────────────────────────────────────────────────────────

describe('POST /api/v1/auth/mobile/logout', () => {
  it('returns 200 with ok:true when session is revoked', async () => {
    mockRequireBearerToken.mockReturnValueOnce('tok-123' as never);
    mockRevokeMobileSession.mockResolvedValueOnce(undefined as never);

    const response = await POST_LOGOUT(makeLogoutRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('returns 401 when bearer token is missing', async () => {
    mockRequireBearerToken.mockImplementationOnce(() => {
      throw new AppError('UNAUTHORIZED', 'Bearer token required.');
    });

    const response = await POST_LOGOUT(makeLogoutRequest());
    expect(response.status).toBe(401);
  });
});
