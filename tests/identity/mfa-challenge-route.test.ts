/**
 * Unit tests for POST /api/v1/auth/mfa/challenge
 * Verifies MFA verification flow that upgrades a challenge token to a full session.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/mfa-service', () => ({ verifyMfaChallenge: vi.fn() }));
vi.mock('../../server/identity/sessions', () => ({ createSession: vi.fn() }));
vi.mock('../../server/identity/session-cookie', () => ({ setSessionCookie: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
  assertSameOrigin: vi.fn(),
}));
vi.mock('../../server/core/security-events', () => ({ recordSecurityEvent: vi.fn() }));
vi.mock('../../server/core/distributed-rate-limit', () => ({ consumeDistributedRateLimit: vi.fn() }));
vi.mock('../../server/core/validation', () => ({ requireString: vi.fn() }));

import { verifyMfaChallenge } from '../../server/identity/mfa-service';
import { createSession } from '../../server/identity/sessions';
import { consumeDistributedRateLimit } from '../../server/core/distributed-rate-limit';
import { requireString } from '../../server/core/validation';
import { AppError } from '../../server/core/errors';

const mockVerifyMfaChallenge = vi.mocked(verifyMfaChallenge);
const mockCreateSession = vi.mocked(createSession);
const mockConsumeRateLimit = vi.mocked(consumeDistributedRateLimit);
const mockRequireString = vi.mocked(requireString);

beforeEach(() => {
  vi.resetAllMocks();
  mockConsumeRateLimit.mockResolvedValue(undefined as never);
  mockRequireString.mockImplementation((v: unknown) => String(v));
});

type RouteModule = typeof import('../../app/api/v1/auth/mfa/challenge/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/v1/auth/mfa/challenge/route'));
}, 60000);

function makeRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (k: string) => k === 'user-agent' ? 'TestBrowser/1.0' : null },
    url: 'http://localhost:3000/api/v1/auth/mfa/challenge',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const validBody = { challengeToken: 'tok-challenge-valid', code: '123456' };

describe('POST /api/v1/auth/mfa/challenge', () => {
  it('returns 200 and sets session cookie on valid TOTP code', async () => {
    mockVerifyMfaChallenge.mockResolvedValueOnce('user-1' as never);
    mockCreateSession.mockResolvedValueOnce('session-token-abc' as never);

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('returns 401 when MFA code is invalid or challenge expired', async () => {
    mockVerifyMfaChallenge.mockResolvedValueOnce(null as never);

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(401);
  });

  it('returns 400 when challengeToken fails validation', async () => {
    mockRequireString.mockImplementationOnce(() => {
      throw new AppError('VALIDATION_ERROR', 'challengeToken is required');
    });

    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockConsumeRateLimit.mockRejectedValueOnce(new AppError('RATE_LIMITED', 'Too many requests.'));

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(429);
  });

  it('accepts recovery code type', async () => {
    mockVerifyMfaChallenge.mockResolvedValueOnce('user-1' as never);
    mockCreateSession.mockResolvedValueOnce('session-token-abc' as never);

    const response = await POST(makeRequest({ ...validBody, codeType: 'recovery' }));
    expect(response.status).toBe(200);
    expect(mockVerifyMfaChallenge).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'recovery',
    );
  });
});
