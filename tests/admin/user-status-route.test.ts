import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Owner-equivalent access derived from the (mocked) platform-admin check, so these tests keep proving "non-admins are refused".
vi.mock('../../server/admin/access', async () => {
  const pa = await import('../../server/identity/platform-admin');
  const { ALL_PERMISSIONS } = await import('../../lib/admin-permissions');
  const check = async (u: string) => { await pa.requirePlatformAdmin(u); return { userId: u, kind: 'owner' as const, permissions: new Set(ALL_PERMISSIONS), parentUserId: null }; };
  return { requireAdminAccess: check, requirePermission: check, requireAnyPermission: check, getAdminAccess: check };
});
vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/platform-admin', () => ({ requirePlatformAdmin: vi.fn(), isPlatformAdmin: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({ assertSameOrigin: vi.fn(), clientFingerprint: vi.fn().mockReturnValue('203.0.113.9') }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withUserTransaction: vi.fn(async (_u: string, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});

import { requireRequestUser } from '../../server/identity/request-user';
import { requirePlatformAdmin, isPlatformAdmin } from '../../server/identity/platform-admin';
import { assertSameOrigin, clientFingerprint } from '../../server/core/security-boundary';
import { writeAudit } from '../../server/core/audit';
import { query } from '../../server/core/db';
import { AppError } from '../../server/core/errors';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const mockQuery = vi.mocked(query);

type RouteModule = typeof import('../../app/api/v1/admin/users/[id]/status/route');
let POST: RouteModule['POST'];
beforeAll(async () => { ({ POST } = await import('../../app/api/v1/admin/users/[id]/status/route')); }, 60000);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestUser).mockResolvedValue(ADMIN as never);
  vi.mocked(isPlatformAdmin).mockResolvedValue(false);
  vi.mocked(clientFingerprint).mockReturnValue('203.0.113.9');
});

const req = (body: unknown) => ({ headers: { get: () => null }, url: 'http://localhost:3000/x', method: 'POST', json: async () => body }) as never;
const ctx = (id = TARGET) => ({ params: Promise.resolve({ id }) });

describe('POST /api/v1/admin/users/[id]/status', () => {
  it('suspends: updates the user, revokes sessions and writes an audit row in the same transaction', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'ACTIVE' }] } as never).mockResolvedValue({ rows: [] } as never);
    const res = await POST(req({ status: 'SUSPENDED', reason: ' فعالیت مشکوک ' }), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ changed: true, status: 'SUSPENDED' });
    const sqls = mockQuery.mock.calls.map(c => String(c[0]));
    expect(sqls.some(s => /UPDATE users SET status/.test(s))).toBe(true);
    expect(sqls.some(s => /UPDATE sessions SET revoked_at/.test(s))).toBe(true);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin.user.suspend', entityType: 'user', entityId: TARGET, ip: '203.0.113.9',
      metadata: { from: 'ACTIVE', to: 'SUSPENDED', reason: 'فعالیت مشکوک' },
    }), expect.anything());
  });

  it('activates without touching sessions and is a no-op when already in that state', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'SUSPENDED' }] } as never).mockResolvedValue({ rows: [] } as never);
    expect((await (await POST(req({ status: 'ACTIVE' }), ctx())).json()).changed).toBe(true);
    expect(mockQuery.mock.calls.some(c => /UPDATE sessions/.test(String(c[0])))).toBe(false);
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'ACTIVE' }] } as never);
    expect((await (await POST(req({ status: 'ACTIVE' }), ctx())).json()).changed).toBe(false);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledTimes(1);
  });

  it('rejects non-admins, cross-origin calls, bad input, self-suspension and suspending another admin', async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new AppError('FORBIDDEN', 'x'));
    expect((await POST(req({ status: 'SUSPENDED' }), ctx())).status).toBe(403);
    vi.mocked(assertSameOrigin).mockImplementationOnce(() => { throw new AppError('FORBIDDEN', 'cross'); });
    expect((await POST(req({ status: 'SUSPENDED' }), ctx())).status).toBe(403);
    expect((await POST(req({ status: 'DELETED' }), ctx())).status).toBe(400);
    expect((await POST(req({ status: 'SUSPENDED' }), ctx('not-a-uuid'))).status).toBe(400);
    expect((await POST(req({ status: 'SUSPENDED' }), ctx(ADMIN))).status).toBe(400);
    vi.mocked(isPlatformAdmin).mockResolvedValueOnce(true);
    expect((await POST(req({ status: 'SUSPENDED' }), ctx())).status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(vi.mocked(writeAudit)).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    expect((await POST(req({ status: 'SUSPENDED' }), ctx())).status).toBe(404);
  });
});
