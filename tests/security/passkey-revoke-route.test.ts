import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('../../server/identity/passkey-service', () => ({ revokePasskey: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { revokePasskey } from '../../server/identity/passkey-service';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRevokePasskey = vi.mocked(revokePasskey);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/me/passkeys/[id]/route');
let DELETE: RouteModule['DELETE'];

beforeAll(async () => {
  ({ DELETE } = await import('../../app/api/v1/me/passkeys/[id]/route'));
}, 60000);

function makeRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/me/passkeys/pk-1',
    method: 'DELETE',
  } as unknown as import('next/server').NextRequest;
}

const mockParams = Promise.resolve({ id: 'pk-1' });

describe('DELETE /api/v1/me/passkeys/[id]', () => {
  it('returns 200 ok:true on successful revocation', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRevokePasskey.mockResolvedValueOnce(undefined as never);

    const res = await DELETE(makeRequest(), { params: mockParams });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const res = await DELETE(makeRequest(), { params: mockParams });
    expect(res.status).toBe(401);
  });

  it('returns 404 when passkey not found or not owned by user', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRevokePasskey.mockRejectedValueOnce(new AppError('NOT_FOUND', 'Passkey not found'));

    const res = await DELETE(makeRequest(), { params: mockParams });
    expect(res.status).toBe(404);
  });

  it('calls revokePasskey with passkey id and user id', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRevokePasskey.mockResolvedValueOnce(undefined as never);

    await DELETE(makeRequest(), { params: mockParams });
    expect(mockRevokePasskey).toHaveBeenCalledWith('pk-1', 'user-1');
  });
});
