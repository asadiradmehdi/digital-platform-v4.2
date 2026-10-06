/**
 * Unit tests for POST /api/v1/auth/login
 * Covers JSON login, MFA flow, invalid credentials, locked account, and rate limiting.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/identity/password', () => ({ verifyPassword: vi.fn() }));
vi.mock('../../server/identity/sessions', () => ({ createSession: vi.fn() }));
vi.mock('../../server/core/validation', () => ({
  requireString: vi.fn((v: unknown) => {
    if (!v) throw { code: 'VALIDATION_ERROR', message: 'required' };
    return v;
  }),
}));
vi.mock('../../server/core/distributed-rate-limit', () => ({
  consumeDistributedRateLimit: vi.fn(),
}));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('../../server/core/security-events', () => ({
  recordSecurityEvent: vi.fn(),
}));
vi.mock('../../server/identity/session-cookie', () => ({
  setSessionCookie: vi.fn(),
}));
vi.mock('../../server/identity/account-security', () => ({
  isLoginLocked: vi.fn().mockResolvedValue(false),
  recordLoginFailure: vi.fn(),
  recordLoginSuccess: vi.fn(),
}));
vi.mock('../../server/identity/mfa-service', () => ({
  hasMfaEnabled: vi.fn().mockResolvedValue(false),
  issueMfaChallenge: vi.fn(),
}));

import { query } from '../../server/core/db';
import { verifyPassword } from '../../server/identity/password';
import { createSession } from '../../server/identity/sessions';
import { consumeDistributedRateLimit } from '../../server/core/distributed-rate-limit';
import { isLoginLocked, recordLoginFailure, recordLoginSuccess } from '../../server/identity/account-security';
import { hasMfaEnabled, issueMfaChallenge } from '../../server/identity/mfa-service';
import { AppError } from '../../server/core/errors';

const mockQuery = vi.mocked(query);
const mockVerify = vi.mocked(verifyPassword);
const mockCreateSession = vi.mocked(createSession);
const mockRateLimit = vi.mocked(consumeDistributedRateLimit);
const mockLocked = vi.mocked(isLoginLocked);
const mockFailure = vi.mocked(recordLoginFailure);
const mockSuccess = vi.mocked(recordLoginSuccess);
const mockHasMfa = vi.mocked(hasMfaEnabled);
const mockIssueMfa = vi.mocked(issueMfaChallenge);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/auth/login/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/v1/auth/login/route'));
}, 60000);

function makeRequest(body: unknown): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/auth/login');
  return {
    json: async () => body,
    formData: async () => new FormData(),
    headers: { get: (_k: string) => null },
    url: url.toString(),
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const validUser = { id: 'user-1', credentialHash: 'hash123' };

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with ok:true on successful JSON login', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [validUser], rowCount: 1 } as never);
    mockLocked.mockResolvedValueOnce(false);
    mockVerify.mockResolvedValueOnce(true);
    mockSuccess.mockResolvedValueOnce(undefined);
    mockHasMfa.mockResolvedValueOnce(false);
    mockCreateSession.mockResolvedValueOnce('session-token' as never);

    const response = await POST(makeRequest({ identifier: 'user@example.com', password: 'ValidPassword1' }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('returns 200 with mfaRequired when user has MFA enabled', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [validUser], rowCount: 1 } as never);
    mockLocked.mockResolvedValueOnce(false);
    mockVerify.mockResolvedValueOnce(true);
    mockSuccess.mockResolvedValueOnce(undefined);
    mockHasMfa.mockResolvedValueOnce(true);
    mockIssueMfa.mockResolvedValueOnce('challenge-token' as never);

    const response = await POST(makeRequest({ identifier: 'user@example.com', password: 'ValidPassword1' }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.mfaRequired).toBe(true);
    expect(data.challengeToken).toBe('challenge-token');
  });

  it('returns 401 when password is incorrect', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [validUser], rowCount: 1 } as never);
    mockLocked.mockResolvedValueOnce(false);
    mockVerify.mockResolvedValueOnce(false);

    const response = await POST(makeRequest({ identifier: 'user@example.com', password: 'WrongPassword!' }));
    expect(response.status).toBe(401);
    expect(mockFailure).toHaveBeenCalledWith('user-1');
  });

  it('returns 401 when account is locked', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [validUser], rowCount: 1 } as never);
    mockLocked.mockResolvedValueOnce(true);
    mockVerify.mockResolvedValueOnce(true);

    const response = await POST(makeRequest({ identifier: 'user@example.com', password: 'ValidPassword1' }));
    expect(response.status).toBe(401);
  });

  it('returns 401 when user is not found', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await POST(makeRequest({ identifier: 'unknown@example.com', password: 'ValidPassword1' }));
    expect(response.status).toBe(401);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockRateLimit.mockRejectedValueOnce(new AppError('RATE_LIMITED', 'Too many requests.'));

    const response = await POST(makeRequest({ identifier: 'user@example.com', password: 'ValidPassword1' }));
    expect(response.status).toBe(429);
  });

  it('records login success event on successful authentication', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [validUser], rowCount: 1 } as never);
    mockLocked.mockResolvedValueOnce(false);
    mockVerify.mockResolvedValueOnce(true);
    mockSuccess.mockResolvedValueOnce(undefined);
    mockHasMfa.mockResolvedValueOnce(false);
    mockCreateSession.mockResolvedValueOnce('token' as never);

    await POST(makeRequest({ identifier: 'user@example.com', password: 'ValidPassword1' }));
    expect(mockSuccess).toHaveBeenCalledWith('user-1');
  });
});
