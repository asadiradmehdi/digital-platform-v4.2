/**
 * Unit tests for MFA routes:
 *   GET  /api/v1/auth/mfa/status
 *   POST /api/v1/auth/mfa/totp/begin
 *   POST /api/v1/auth/mfa/totp/confirm
 *   POST /api/v1/auth/mfa/totp/disable
 *   GET  /api/v1/auth/recovery-codes
 *   POST /api/v1/auth/recovery-codes
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/core/validation', () => ({ requireString: vi.fn() }));
vi.mock('../../server/core/security-events', () => ({ recordSecurityEvent: vi.fn() }));
vi.mock('../../server/core/distributed-rate-limit', () => ({ consumeDistributedRateLimit: vi.fn() }));
vi.mock('../../server/identity/mfa-service', () => ({
  hasMfaEnabled: vi.fn(),
  getRecoveryCodeStatus: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
  beginTotpEnrollment: vi.fn(),
  confirmTotpEnrollment: vi.fn(),
  disableTotpMfa: vi.fn(),
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireString } from '../../server/core/validation';
import { consumeDistributedRateLimit } from '../../server/core/distributed-rate-limit';
import {
  hasMfaEnabled, getRecoveryCodeStatus, regenerateRecoveryCodes,
  beginTotpEnrollment, confirmTotpEnrollment, disableTotpMfa,
} from '../../server/identity/mfa-service';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequireString = vi.mocked(requireString);
const mockConsumeRateLimit = vi.mocked(consumeDistributedRateLimit);
const mockHasMfaEnabled = vi.mocked(hasMfaEnabled);
const mockGetRecoveryCodeStatus = vi.mocked(getRecoveryCodeStatus);
const mockRegenerateRecoveryCodes = vi.mocked(regenerateRecoveryCodes);
const mockBeginTotpEnrollment = vi.mocked(beginTotpEnrollment);
const mockConfirmTotpEnrollment = vi.mocked(confirmTotpEnrollment);
const mockDisableTotpMfa = vi.mocked(disableTotpMfa);

type StatusModule = typeof import('../../app/api/v1/auth/mfa/status/route');
type BeginModule = typeof import('../../app/api/v1/auth/mfa/totp/begin/route');
type ConfirmModule = typeof import('../../app/api/v1/auth/mfa/totp/confirm/route');
type DisableModule = typeof import('../../app/api/v1/auth/mfa/totp/disable/route');
type RecoveryModule = typeof import('../../app/api/v1/auth/recovery-codes/route');

let GET_STATUS: StatusModule['GET'];
let POST_BEGIN: BeginModule['POST'];
let POST_CONFIRM: ConfirmModule['POST'];
let POST_DISABLE: DisableModule['POST'];
let GET_RECOVERY: RecoveryModule['GET'];
let POST_RECOVERY: RecoveryModule['POST'];

beforeAll(async () => {
  ({ GET: GET_STATUS } = await import('../../app/api/v1/auth/mfa/status/route'));
  ({ POST: POST_BEGIN } = await import('../../app/api/v1/auth/mfa/totp/begin/route'));
  ({ POST: POST_CONFIRM } = await import('../../app/api/v1/auth/mfa/totp/confirm/route'));
  ({ POST: POST_DISABLE } = await import('../../app/api/v1/auth/mfa/totp/disable/route'));
  ({ GET: GET_RECOVERY, POST: POST_RECOVERY } = await import('../../app/api/v1/auth/recovery-codes/route'));
}, 60000);

beforeEach(() => {
  vi.resetAllMocks();
  mockRequireString.mockImplementation((v: unknown) => String(v));
  mockConsumeRateLimit.mockResolvedValue(undefined as never);
});

function makeGetRequest(url: string): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url,
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePostRequest(url: string, body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    url,
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

// ─── MFA Status ──────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/mfa/status', () => {
  it('returns 200 with mfaEnabled and recovery status', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockHasMfaEnabled.mockResolvedValueOnce(true as never);
    mockGetRecoveryCodeStatus.mockResolvedValueOnce({ total: 8, remaining: 6 } as never);

    const response = await GET_STATUS(makeGetRequest('http://localhost:3000/api/v1/auth/mfa/status'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.mfaEnabled).toBe(true);
    expect(data.recoveryCodes.remaining).toBe(6);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET_STATUS(makeGetRequest('http://localhost:3000/api/v1/auth/mfa/status'));
    expect(response.status).toBe(401);
  });
});

// ─── TOTP Begin ──────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/mfa/totp/begin', () => {
  it('returns 201 with otpauth uri and secret', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockBeginTotpEnrollment.mockResolvedValueOnce({ secret: 'JBSWY3DPEHPK3PXP' } as never);

    const response = await POST_BEGIN(makePostRequest('http://localhost:3000/api/v1/auth/mfa/totp/begin', { label: 'user@example.com' }));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.uri).toContain('otpauth://totp/');
    expect(data.secret).toBe('JBSWY3DPEHPK3PXP');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST_BEGIN(makePostRequest('http://localhost:3000/api/v1/auth/mfa/totp/begin', { label: 'user@example.com' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 when label fails validation', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequireString.mockImplementationOnce(() => { throw new AppError('VALIDATION_ERROR', 'label is required'); });

    const response = await POST_BEGIN(makePostRequest('http://localhost:3000/api/v1/auth/mfa/totp/begin', {}));
    expect(response.status).toBe(400);
  });
});

// ─── TOTP Confirm ────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/mfa/totp/confirm', () => {
  it('returns 200 with recovery codes on valid TOTP code', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockConfirmTotpEnrollment.mockResolvedValueOnce(['code1', 'code2'] as never);

    const response = await POST_CONFIRM(makePostRequest('http://localhost:3000/api/v1/auth/mfa/totp/confirm', { code: '123456' }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.recoveryCodes).toHaveLength(2);
  });

  it('returns 400 when TOTP code is invalid', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockConfirmTotpEnrollment.mockResolvedValueOnce(null as never);

    const response = await POST_CONFIRM(makePostRequest('http://localhost:3000/api/v1/auth/mfa/totp/confirm', { code: '000000' }));
    expect(response.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST_CONFIRM(makePostRequest('http://localhost:3000/api/v1/auth/mfa/totp/confirm', { code: '123456' }));
    expect(response.status).toBe(401);
  });
});

// ─── TOTP Disable ────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/mfa/totp/disable', () => {
  it('returns 200 with ok:true when MFA is successfully disabled', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockDisableTotpMfa.mockResolvedValueOnce(true as never);

    const response = await POST_DISABLE(makePostRequest('http://localhost:3000/api/v1/auth/mfa/totp/disable', { code: '123456' }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('returns 400 when TOTP code is wrong or MFA not enabled', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockDisableTotpMfa.mockResolvedValueOnce(false as never);

    const response = await POST_DISABLE(makePostRequest('http://localhost:3000/api/v1/auth/mfa/totp/disable', { code: '000000' }));
    expect(response.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST_DISABLE(makePostRequest('http://localhost:3000/api/v1/auth/mfa/totp/disable', { code: '123456' }));
    expect(response.status).toBe(401);
  });
});

// ─── Recovery Codes ──────────────────────────────────────────────────────────

describe('GET /api/v1/auth/recovery-codes', () => {
  it('returns 200 with recovery code status', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockGetRecoveryCodeStatus.mockResolvedValueOnce({ total: 8, remaining: 6 } as never);

    const response = await GET_RECOVERY(makeGetRequest('http://localhost:3000/api/v1/auth/recovery-codes'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.remaining).toBe(6);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET_RECOVERY(makeGetRequest('http://localhost:3000/api/v1/auth/recovery-codes'));
    expect(response.status).toBe(401);
  });
});

describe('POST /api/v1/auth/recovery-codes', () => {
  it('returns 200 with new recovery codes', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRegenerateRecoveryCodes.mockResolvedValueOnce(['r1', 'r2', 'r3'] as never);

    const response = await POST_RECOVERY(makePostRequest('http://localhost:3000/api/v1/auth/recovery-codes', {}));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.recoveryCodes).toHaveLength(3);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST_RECOVERY(makePostRequest('http://localhost:3000/api/v1/auth/recovery-codes', {}));
    expect(response.status).toBe(401);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockConsumeRateLimit.mockRejectedValueOnce(new AppError('RATE_LIMITED', 'Too many requests.'));

    const response = await POST_RECOVERY(makePostRequest('http://localhost:3000/api/v1/auth/recovery-codes', {}));
    expect(response.status).toBe(429);
  });
});
