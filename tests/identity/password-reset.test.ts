import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/core/distributed-rate-limit', () => ({ consumeDistributedRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));
vi.mock('../../server/core/security-events', () => ({ recordSecurityEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../server/core/audit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../server/notifications/sms/config', () => ({ getSmsProvider: vi.fn() }));
vi.mock('../../server/identity/otp/service', () => ({
  OTP_RESEND_COOLDOWN_SECONDS: 60, OTP_TTL_SECONDS: 120,
  contactHash: (v: string) => `h:${v}`,
  requestOtp: vi.fn(), verifyOtp: vi.fn(),
}));
vi.mock('../../server/identity/password', () => ({ hashPassword: vi.fn().mockResolvedValue('new-hash') }));
vi.mock('../../server/identity/sessions', () => ({ revokeAllSessions: vi.fn().mockResolvedValue(undefined) }));

import { query } from '../../server/core/db';
import { getSmsProvider } from '../../server/notifications/sms/config';
import { requestOtp, verifyOtp } from '../../server/identity/otp/service';
import { revokeAllSessions } from '../../server/identity/sessions';
import { confirmPasswordReset, requestPasswordReset } from '../../server/identity/password-reset';

const USER = '00000000-0000-4000-8000-000000000001';
const CH = '11111111-1111-4111-8111-111111111111';
const GOOD = 'یک-عبارت-ساده-و-طولانی-۱۴۲۳';
const ip = '203.0.113.9';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSmsProvider).mockResolvedValue({ provider: {} as never, config: {} as never });
  vi.mocked(requestOtp).mockResolvedValue({ challengeId: CH, expiresIn: 120, resendIn: 60, maskedPhone: 'x' });
  vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 } as never);
});

describe('requestPasswordReset', () => {
  it('sends the code to the verified phone of a matching email', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: USER, phone: '+989121234567', status: 'ACTIVE' }] } as never);
    const r = await requestPasswordReset({ identifier: 'Ali@Example.com', ip, client: 'MOBILE' });
    expect(r.challengeId).toBe(CH);
    expect(requestOtp).toHaveBeenCalledWith(expect.objectContaining({ phone: '+989121234567', purpose: 'PASSWORD_RESET', userId: USER, client: 'MOBILE' }));
  });

  it('answers an unknown account the same way, without sending anything', async () => {
    const r = await requestPasswordReset({ identifier: 'nobody@example.com', ip, client: 'WEB' });
    expect(r.challengeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.notice).toContain('اگر حسابی');
    expect(requestOtp).not.toHaveBeenCalled();
  });

  it('does not send to a suspended account', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: USER, phone: '+989121234567', status: 'SUSPENDED' }] } as never);
    await requestPasswordReset({ identifier: '09121234567', ip, client: 'WEB' });
    expect(requestOtp).not.toHaveBeenCalled();
  });

  it('reports a missing SMS provider as unavailable for everyone', async () => {
    vi.mocked(getSmsProvider).mockResolvedValue({ provider: null, config: {} as never });
    await expect(requestPasswordReset({ identifier: 'nobody@example.com', ip, client: 'WEB' })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('rejects input that is neither an email nor a mobile number', async () => {
    await expect(requestPasswordReset({ identifier: 'abc', ip, client: 'WEB' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(requestPasswordReset({ identifier: '', ip, client: 'WEB' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('confirmPasswordReset', () => {
  it('sets the new password and ends every session', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ challengeId: CH, phone: '+989121234567', userId: USER, proof: 'p' });
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ email: 'ali@example.com' }] } as never).mockResolvedValue({ rows: [] } as never);
    await expect(confirmPasswordReset({ challengeId: CH, code: '123456', newPassword: GOOD, ip })).resolves.toEqual({ ok: true });
    expect(vi.mocked(query).mock.calls.some(c => String(c[0]).includes('user_credentials') && (c[1] as unknown[])[1] === 'new-hash')).toBe(true);
    expect(revokeAllSessions).toHaveBeenCalledWith(USER);
  });

  it('refuses a weak password before the code is spent', async () => {
    await expect(confirmPasswordReset({ challengeId: CH, code: '123456', newPassword: 'short', ip })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('changes nothing when the code is wrong', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(Object.assign(new Error('wrong'), { code: 'UNAUTHORIZED' }));
    await expect(confirmPasswordReset({ challengeId: CH, code: '000000', newPassword: GOOD, ip })).rejects.toThrow();
    expect(revokeAllSessions).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses a code that was not issued for a real account', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ challengeId: CH, phone: '+989121234567', userId: null, proof: 'p' });
    await expect(confirmPasswordReset({ challengeId: CH, code: '123456', newPassword: GOOD, ip })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
