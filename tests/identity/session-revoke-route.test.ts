import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({ assertSameOrigin: vi.fn(), clientFingerprint: vi.fn().mockReturnValue('127.0.0.1') }));
vi.mock('../../server/identity/sessions', () => ({ revokeSessionById: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../../server/core/security-events', () => ({ recordSecurityEvent: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { revokeSessionById } from '../../server/identity/sessions';
import { writeAudit } from '../../server/core/audit';

let DELETE: typeof import('../../app/api/v1/auth/sessions/[id]/route')['DELETE'];
beforeAll(async () => { ({ DELETE } = await import('../../app/api/v1/auth/sessions/[id]/route')); }, 60000);
beforeEach(() => vi.clearAllMocks());

const req = { headers: { get: () => null }, url: 'http://localhost:3000/api/v1/auth/sessions/x', method: 'DELETE' } as unknown as import('next/server').NextRequest;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('DELETE /api/v1/auth/sessions/[id] (device sign-out)', () => {
  it('revokes the caller\'s own device and leaves evidence', async () => {
    vi.mocked(requireRequestUser).mockResolvedValueOnce('user-1');
    vi.mocked(revokeSessionById).mockResolvedValueOnce(true);
    const res = await DELETE(req, ctx('11111111-1111-4111-8111-111111111111'));
    expect(res.status).toBe(200);
    expect(revokeSessionById).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'user-1');
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'SESSION_REVOKED' }));
  });

  it('answers 404 for another user\'s or an already-closed session', async () => {
    vi.mocked(requireRequestUser).mockResolvedValueOnce('user-1');
    vi.mocked(revokeSessionById).mockResolvedValueOnce(false);
    const res = await DELETE(req, ctx('22222222-2222-4222-8222-222222222222'));
    expect(res.status).toBe(404);
    expect(writeAudit).not.toHaveBeenCalled();
  });
});
