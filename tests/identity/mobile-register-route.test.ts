/** POST /api/v1/auth/mobile/register: email sign-up from the native app returns a device-bound token. */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/identity/password', () => ({ hashPassword: vi.fn().mockResolvedValue('hash') }));
vi.mock('../../server/identity/mobile-sessions', () => ({ createMobileSession: vi.fn() }));
vi.mock('../../server/core/distributed-rate-limit', () => ({ consumeDistributedRateLimit: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({ clientFingerprint: vi.fn().mockReturnValue('1.2.3.4') }));
vi.mock('../../server/core/security-events', () => ({ recordSecurityEvent: vi.fn() }));
vi.mock('../../server/identity/signup', () => ({ createAccountWithWorkspace: vi.fn(), isUniqueViolation: (e: unknown) => (e as { code?: string })?.code === '23505' }));

import { query } from '../../server/core/db';
import { createMobileSession } from '../../server/identity/mobile-sessions';
import { createAccountWithWorkspace } from '../../server/identity/signup';

let POST: typeof import('../../app/api/v1/auth/mobile/register/route')['POST'];
beforeAll(async () => { ({ POST } = await import('../../app/api/v1/auth/mobile/register/route')); }, 60000);
beforeEach(() => {
  vi.mocked(query).mockReset().mockResolvedValue({ rows: [], rowCount: 0 } as never);
  vi.mocked(createAccountWithWorkspace).mockReset().mockResolvedValue({ userId: '00000000-0000-4000-8000-000000000001', workspaceId: '00000000-0000-4000-8000-000000000002' });
  vi.mocked(createMobileSession).mockReset().mockResolvedValue({ token: 'tok-new' } as never);
});

const body = { name: 'علی اسدی', email: 'Ali@Example.com', password: 'یک-عبارت-ساده-و-طولانی-۱۴۲۳', platform: 'android', deviceId: 'device-id-1234567890' };
const req = (b: unknown) => ({ json: async () => b, headers: { get: () => 'TestApp/1.0' } }) as unknown as import('next/server').NextRequest;

describe('POST /api/v1/auth/mobile/register', () => {
  it('creates the account and returns a bearer token', async () => {
    const res = await POST(req(body));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toMatchObject({ ok: true, accessToken: 'tok-new', tokenType: 'Bearer' });
    expect(vi.mocked(createAccountWithWorkspace).mock.calls[0][0]).toMatchObject({ email: 'ali@example.com', displayName: 'علی اسدی' });
  });

  it('answers a taken email in Persian with 409', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 } as never);
    const res = await POST(req(body));
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).toContain('قبلاً حساب ساخته شده');
    expect(createAccountWithWorkspace).not.toHaveBeenCalled();
  });

  it('rejects a short password without creating anything', async () => {
    const res = await POST(req({ ...body, password: 'short' }));
    expect(res.status).toBe(400);
    expect(createAccountWithWorkspace).not.toHaveBeenCalled();
  });
});
