/**
 * Unit tests for POST /api/v1/auth/register
 * Covers successful registration, duplicate email, validation errors, rate limiting, and weak passwords.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ withTenantTransaction: vi.fn() }));
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

import { withTenantTransaction } from '../../server/core/db';
import { hashPassword } from '../../server/identity/password';
import { createSession } from '../../server/identity/sessions';
import { consumeDistributedRateLimit } from '../../server/core/distributed-rate-limit';
import { assertStrongPassword } from '../../server/identity/password-policy';
import { requireString } from '../../server/core/validation';
import { setSessionCookie } from '../../server/identity/session-cookie';
import { AppError } from '../../server/core/errors';

const mockWithTx = vi.mocked(withTenantTransaction);
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
    mockRateLimit.mockResolvedValueOnce(undefined as never);
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
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockHashPassword.mockResolvedValueOnce('hash-abc' as never);
    mockWithTx.mockRejectedValueOnce(new AppError('CONFLICT', 'An account with this email already exists.'));

    const response = await POST(makeRequest({ email: 'existing@example.com', password: 'SuperStrong!1234', name: 'Ali' }));
    expect(response.status).toBe(409);
  });

  it('returns 400 when email field is missing', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockRequireString.mockImplementationOnce(() => {
      throw new AppError('VALIDATION_ERROR', 'email is required');
    });

    const response = await POST(makeRequest({ password: 'SuperStrong!1234', name: 'Ali' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when password does not meet strength requirements', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockStrongPassword.mockImplementationOnce(() => {
      throw new AppError('VALIDATION_ERROR', 'Password is too weak.');
    });

    const response = await POST(makeRequest({ email: 'new@example.com', password: 'weak', name: 'Ali' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when email format is invalid', async () => {
    mockRateLimit.mockResolvedValueOnce(undefined as never);

    const response = await POST(makeRequest({ email: 'not-an-email', password: 'SuperStrong!1234', name: 'Ali' }));
    expect(response.status).toBe(400);
  });

  it('accepts the JSON body the sign-up form sends and answers with JSON + session cookie', async () => {
    // Regression: the web form posts JSON, but the route only read formData and failed with 500.
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockHashPassword.mockResolvedValueOnce('hash-abc' as never);
    mockWithTx.mockResolvedValueOnce(registrationResult as never);
    mockCreateSession.mockResolvedValueOnce('session-tok' as never);
    const request = {
      json: async () => ({ email: 'new@example.com', password: 'SuperStrong!1234', name: 'Ali' }),
      formData: async () => { throw new TypeError('not form data'); },
      headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
      url: 'http://localhost:3000/api/v1/auth/register',
      method: 'POST',
    } as unknown as import('next/server').NextRequest;
    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(vi.mocked(setSessionCookie)).toHaveBeenCalledWith(response, 'session-tok');
  });

  it("creates the wallet's MAIN ledger account that wallet payments post to", async () => {
    // Regression: only AVAILABLE/HELD/REFUNDS were created, so paying from the wallet always failed.
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockHashPassword.mockResolvedValueOnce('hash-abc' as never);
    mockCreateSession.mockResolvedValueOnce('session-tok' as never);
    const sqls: string[] = [];
    const client = { query: vi.fn(async (sql: string) => { sqls.push(sql); return { rows: /SELECT id FROM users/.test(sql) ? [] : [{ id: 'id-1', slug: 's' }] }; }) };
    mockWithTx.mockImplementationOnce((async (_ws: string, _u: string, fn: (c: typeof client) => unknown) => fn(client)) as never);
    await POST(makeRequest({ email: 'new@example.com', password: 'SuperStrong!1234', name: 'Ali' }));
    expect(sqls.find(q => q.includes('INSERT INTO ledger_accounts'))).toContain("'MAIN'");
  });

  it('creates the workspace and its wallet inside that workspace\'s RLS context', async () => {
    // Regression: signup ran in a generic transaction, so under a non-superuser role the wallets
    // insert failed with "new row violates row-level security policy for table wallets".
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockHashPassword.mockResolvedValueOnce('hash-abc' as never);
    mockCreateSession.mockResolvedValueOnce('session-tok' as never);
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const client = { query: vi.fn(async (sql: string, values: unknown[] = []) => { calls.push({ sql, values }); return { rows: /SELECT id FROM users/.test(sql) ? [] : [{ id: String(values[0]), slug: 's' }] }; }) };
    let ctx: { ws?: string; user?: string } = {};
    mockWithTx.mockImplementationOnce((async (ws: string, user: string, fn: (c: typeof client) => unknown) => { ctx = { ws, user }; return fn(client); }) as never);
    const response = await POST(makeRequest({ email: 'new@example.com', password: 'SuperStrong!1234', name: 'Ali' }));
    expect(response.status).toBe(307);
    expect(ctx.ws).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls.find(c => c.sql.includes('INSERT INTO workspaces'))?.values[0]).toBe(ctx.ws);
    expect(calls.find(c => c.sql.includes('INSERT INTO users'))?.values[0]).toBe(ctx.user);
    expect(calls.find(c => c.sql.includes('INSERT INTO wallets'))?.values[0]).toBe(ctx.ws);
  });
});
