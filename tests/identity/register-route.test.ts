/**
 * Unit tests for POST /api/v1/auth/register
 * Covers successful registration, duplicate email, validation errors, rate limiting, and weak passwords.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ withTransaction: vi.fn() }));
vi.mock('../../server/identity/password', () => ({
  hashPassword: vi.fn(),
}));
vi.mock('../../server/identity/sessions', () => ({ createSession: vi.fn() }));
vi.mock('../../server/core/validation', () => ({
  requireString: vi.fn((v: unknown, _field: string) => {
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
vi.mock('../../server/identity/password-policy', () => ({
  assertStrongPassword: vi.fn(),
}));

import { withTransaction } from '../../server/core/db';
import { hashPassword } from '../../server/identity/password';
import { createSession } from '../../server/identity/sessions';
import { consumeDistributedRateLimit } from '../../server/core/distributed-rate-limit';
import { assertStrongPassword } from '../../server/identity/password-policy';
import { requireString } from '../../server/core/validation';
import { AppError } from '../../server/core/errors';

const mockWithTx = vi.mocked(withTransaction);
const mockHashPassword = vi.mocked(hashPassword);
const mockCreateSession = vi.mocked(createSession);
const mockRateLimit = vi.mocked(consumeDistributedRateLimit);
const mockStrongPassword = vi.mocked(assertStrongPassword);
const mockRequireString = vi.mocked(requireString);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/auth/register/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/v1/auth/register/route'));
}, 60000);

function makeRequest(body: Record<string, string>): import('next/server').NextRequest {
  const form = new FormData();
  for (const [k, v] of Object.entries(body)) form.append(k, v);
  return {
    formData: async () => form,
    headers: { get: (_k: string) => null },
    url: 'http://localhost:3000/api/v1/auth/register',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const registrationResult = { userId: 'user-new', workspaceId: 'ws-new' };

describe('POST /api/v1/auth/register', () => {
  it('redirects to /dashboard on successful registration', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined);
    mockHashPassword.mockResolvedValueOnce('hash-abc' as never);
    mockWithTx.mockResolvedValueOnce(registrationResult as never);
    mockCreateSession.mockResolvedValueOnce('session-tok' as never);

    const response = await POST(makeRequest({ email: 'new@example.com', password: 'SuperStrong!1234', name: 'Ali' }));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/dashboard');
  });

  it('returns 429 when registration rate limit is exceeded', async () => {
    mockRateLimit.mockRejectedValueOnce(new AppError('RATE_LIMITED', 'Too many registrations.'));

    const response = await POST(makeRequest({ email: 'new@example.com', password: 'SuperStrong!1234', name: 'Ali' }));
    expect(response.status).toBe(429);
  });

  it('returns 409 when email already exists', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined);
    mockHashPassword.mockResolvedValueOnce('hash-abc' as never);
    mockWithTx.mockRejectedValueOnce(new AppError('CONFLICT', 'An account with this email already exists.'));

    const response = await POST(makeRequest({ email: 'existing@example.com', password: 'SuperStrong!1234', name: 'Ali' }));
    expect(response.status).toBe(409);
  });

  it('returns 400 when email field is missing', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined);
    mockRequireString.mockImplementationOnce(() => {
      throw new AppError('VALIDATION_ERROR', 'email is required');
    });

    const response = await POST(makeRequest({ password: 'SuperStrong!1234', name: 'Ali' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when password does not meet strength requirements', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined);
    mockStrongPassword.mockImplementationOnce(() => {
      throw new AppError('VALIDATION_ERROR', 'Password is too weak.');
    });

    const response = await POST(makeRequest({ email: 'new@example.com', password: 'weak', name: 'Ali' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when email format is invalid', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest({ email: 'not-an-email', password: 'SuperStrong!1234', name: 'Ali' }));
    expect(response.status).toBe(400);
  });
});
