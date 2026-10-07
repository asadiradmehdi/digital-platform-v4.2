import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/identity/password', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));
vi.mock('../../server/identity/step-up', () => ({ enforceStepUpPolicy: vi.fn() }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { query } from '../../server/core/db';
import { hashPassword, verifyPassword } from '../../server/identity/password';
import { enforceStepUpPolicy } from '../../server/identity/step-up';
import { writeAudit } from '../../server/core/audit';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockQuery = vi.mocked(query);
const mockHash = vi.mocked(hashPassword);
const mockVerify = vi.mocked(verifyPassword);
const mockEnforceStepUp = vi.mocked(enforceStepUpPolicy);
const mockWriteAudit = vi.mocked(writeAudit);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/me/password/route');
let PATCH: RouteModule['PATCH'];

beforeAll(async () => {
  ({ PATCH } = await import('../../app/api/v1/me/password/route'));
}, 60000);

function makeRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/me/password',
    method: 'PATCH',
  } as unknown as import('next/server').NextRequest;
}

const validBody = { currentPassword: 'OldP@ssw0rd!1234', newPassword: 'NewP@ssw0rd!5678', stepUpEvidenceId: 'ev-1' };

describe('PATCH /api/v1/me/password', () => {
  it('returns 200 on successful password change', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockEnforceStepUp.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ credential_hash: '$argon2id$hash' }], rowCount: 1 } as never);
    mockVerify.mockResolvedValueOnce(true as never);
    mockHash.mockResolvedValueOnce('$argon2id$newhash' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    mockWriteAudit.mockResolvedValueOnce(undefined as never);

    const res = await PATCH(makeRequest(validBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const res = await PATCH(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it('returns 400 when currentPassword or newPassword is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const res = await PATCH(makeRequest({ newPassword: 'NewP@ssw0rd!5678' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is shorter than 14 characters', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const res = await PATCH(makeRequest({ currentPassword: 'OldP@ss!1234', newPassword: 'Short1!' }));
    expect(res.status).toBe(400);
  });

  it('returns 403 when step-up evidence is rejected', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockEnforceStepUp.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Step-up required'));

    const res = await PATCH(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  it('returns 403 when current password is wrong', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockEnforceStepUp.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ credential_hash: '$argon2id$hash' }], rowCount: 1 } as never);
    mockVerify.mockResolvedValueOnce(false as never);

    const res = await PATCH(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  it('calls enforceStepUpPolicy with SECURITY_SETTINGS_CHANGE action', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockEnforceStepUp.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ credential_hash: '$argon2id$hash' }], rowCount: 1 } as never);
    mockVerify.mockResolvedValueOnce(true as never);
    mockHash.mockResolvedValueOnce('$argon2id$newhash' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    mockWriteAudit.mockResolvedValueOnce(undefined as never);

    await PATCH(makeRequest(validBody));
    expect(mockEnforceStepUp).toHaveBeenCalledWith('user-1', 'SECURITY_SETTINGS_CHANGE', 'ev-1');
  });

  it('writes PASSWORD_CHANGE audit event on success', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockEnforceStepUp.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ credential_hash: '$argon2id$hash' }], rowCount: 1 } as never);
    mockVerify.mockResolvedValueOnce(true as never);
    mockHash.mockResolvedValueOnce('$argon2id$newhash' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    mockWriteAudit.mockResolvedValueOnce(undefined as never);

    await PATCH(makeRequest(validBody));
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PASSWORD_CHANGE' }),
    );
  });
});
