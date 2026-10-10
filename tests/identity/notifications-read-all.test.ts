import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withUserTransaction: vi.fn() }));
vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({ assertSameOrigin: vi.fn(), clientFingerprint: vi.fn().mockReturnValue('1.2.3.4') }));

import { query, withUserTransaction } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';

let PATCH: typeof import('../../app/api/v1/notifications/route')['PATCH'];
beforeAll(async () => { ({ PATCH } = await import('../../app/api/v1/notifications/route')); }, 60000);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestUser).mockResolvedValue('00000000-0000-4000-8000-000000000001');
  vi.mocked(withUserTransaction).mockImplementation((async (_u: string, fn: (c: unknown) => unknown) => fn({ query: vi.mocked(query) })) as never);
});
const req = (b: unknown) => ({ json: async () => b, headers: { get: () => null } }) as unknown as import('next/server').NextRequest;

describe('PATCH /api/v1/notifications (read_all)', () => {
  it('marks only the caller\'s unread notifications as read', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 3 } as never);
    const res = await PATCH(req({ action: 'read_all' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, updated: 3 });
    const [sql, params] = vi.mocked(query).mock.calls[0];
    expect(String(sql)).toContain('user_id=$1');
    expect(String(sql)).toContain('read_at IS NULL');
    expect(params).toEqual(['00000000-0000-4000-8000-000000000001']);
  });

  it('rejects any other action', async () => {
    const res = await PATCH(req({ action: 'delete' }));
    expect(res.status).toBe(400);
  });
});
