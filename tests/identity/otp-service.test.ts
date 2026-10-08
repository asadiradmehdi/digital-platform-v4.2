import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>>(), recent: [] as unknown[], sent: [] as Array<{ to: string; code: string }>, fail: false }));

vi.mock('../../server/core/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[]) => {
    if (sql.includes('GREATEST(1, CEIL')) return { rows: state.recent };
    if (sql.includes('gen_random_uuid() AS id')) return { rows: [{ id: '11111111-1111-4111-8111-111111111111' }] };
    if (sql.includes("delivery_status='FAILED'")) { const r = state.rows.get(params[0] as string); if (r) { r.delivery_status = 'FAILED'; r.superseded_at = 'now'; } return { rows: [] }; }
    if (sql.includes("delivery_status='SENT'")) { const r = state.rows.get(params[0] as string); if (r) r.delivery_status = 'SENT'; return { rows: [] }; }
    return { rows: [] };
  }),
  withTransaction: vi.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({
    query: async (sql: string, params: unknown[]) => {
      if (sql.startsWith('UPDATE otp_challenges SET superseded_at')) return { rows: [] };
      if (sql.includes('INSERT INTO otp_challenges')) {
        state.rows.set(params[0] as string, { id: params[0], purpose: params[1], phone: params[2], user_id: params[3], code_hash: params[4], attempts: 0, max_attempts: params[5], expired: false, consumed_at: null, locked_at: null, superseded_at: null, delivery_status: 'PENDING' });
        return { rows: [] };
      }
      if (sql.includes('FOR UPDATE')) { const r = state.rows.get(params[0] as string); return { rows: r && r.purpose === params[1] ? [{ ...r }] : [] }; }
      if (sql.includes('SET attempts=$2, locked_at')) { const r = state.rows.get(params[0] as string)!; r.attempts = params[1]; if (params[2]) r.locked_at = 'now'; return { rows: [] }; }
      if (sql.includes('consumed_at=now()')) { const r = state.rows.get(params[0] as string)!; r.attempts = params[1]; r.consumed_at = 'now'; r.proof_hash = params[2]; return { rows: [] }; }
      throw new Error(`unexpected SQL ${sql}`);
    },
  })),
}));
vi.mock('../../server/core/distributed-rate-limit', () => ({ consumeDistributedRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));
vi.mock('../../server/core/security-events', () => ({ recordSecurityEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../server/notifications/sms/config', () => ({
  getSmsProvider: vi.fn(async () => ({
    config: { provider: 'console' },
    provider: { name: 'test', sendPattern: vi.fn(), sendOtp: vi.fn(async (to: string, code: string) => {
      if (state.fail) { const { SmsProviderError } = await import('../../server/notifications/sms/types'); throw new SmsProviderError('unavailable', 'down'); }
      state.sent.push({ to, code }); return { providerReference: 'r' };
    }) },
  })),
}));

import { hashOtpCode, normalizeOtpCode, requestOtp, verifyOtp, OTP_MAX_ATTEMPTS } from '../../server/identity/otp/service';
import { recordSecurityEvent } from '../../server/core/security-events';

const PHONE = '+989121234567';
const req = () => requestOtp({ phone: PHONE, purpose: 'LOGIN', ip: '203.0.113.9', client: 'WEB' });
beforeEach(() => { state.rows.clear(); state.recent = []; state.sent = []; state.fail = false; vi.clearAllMocks(); });

describe('OTP service', () => {
  it('sends a 6-digit code and stores only its keyed hash', async () => {
    const r = await req();
    expect(r).toMatchObject({ expiresIn: 120, resendIn: 60, maskedPhone: '0912 ••• 4567' });
    const { code } = state.sent[0];
    expect(code).toMatch(/^\d{6}$/);
    const row = state.rows.get(r.challengeId)!;
    expect(row.code_hash).not.toContain(code);
    expect(row.code_hash).toBe(hashOtpCode(r.challengeId, code));
    expect(row.code_hash).not.toBe(hashOtpCode('22222222-2222-4222-8222-222222222222', code)); // bound to the challenge
  });

  it('refuses a resend inside the 60 s cooldown', async () => {
    state.recent = [{ wait: 42 }];
    await expect(req()).rejects.toMatchObject({ code: 'RATE_LIMITED', details: { retryAfter: 42 } });
    expect(state.sent).toHaveLength(0);
  });

  it('maps a provider failure to a Persian message and voids the code', async () => {
    state.fail = true;
    await expect(req()).rejects.toMatchObject({ code: 'UNAVAILABLE', message: expect.stringMatching(/پیامک/) });
    expect([...state.rows.values()][0].delivery_status).toBe('FAILED');
  });

  it('counts wrong attempts and locks the code on the fifth', async () => {
    const r = await req();
    const right = state.sent[0].code;
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) {
      await expect(verifyOtp({ challengeId: r.challengeId, code: wrong, purpose: 'LOGIN', ip: 'x' })).rejects.toMatchObject({ code: 'UNAUTHORIZED', details: { attemptsLeft: OTP_MAX_ATTEMPTS - i } });
    }
    await expect(verifyOtp({ challengeId: r.challengeId, code: wrong, purpose: 'LOGIN', ip: 'x' })).rejects.toMatchObject({ details: { locked: true } });
    expect(vi.mocked(recordSecurityEvent).mock.calls.some(c => c[0].eventType === 'OTP_LOCKED')).toBe(true);
    // Even the right code no longer works once locked.
    await expect(verifyOtp({ challengeId: r.challengeId, code: right, purpose: 'LOGIN', ip: 'x' })).rejects.toMatchObject({ details: { locked: true } });
  });

  it('accepts the right code once (Persian digits allowed) and never twice', async () => {
    const r = await req();
    const fa = state.sent[0].code.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
    await expect(verifyOtp({ challengeId: r.challengeId, code: fa, purpose: 'LOGIN', ip: 'x' })).resolves.toMatchObject({ phone: PHONE, proof: null });
    await expect(verifyOtp({ challengeId: r.challengeId, code: state.sent[0].code, purpose: 'LOGIN', ip: 'x' })).rejects.toMatchObject({ details: { expired: true } });
  });

  it('does not let a LOGIN code be used for another purpose', async () => {
    const r = await req();
    await expect(verifyOtp({ challengeId: r.challengeId, code: state.sent[0].code, purpose: 'REAUTH', ip: 'x', userId: null })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('normalises code input', () => {
    expect(normalizeOtpCode(' ۱۲۳ ۴۵۶ ')).toBe('123456');
    expect(normalizeOtpCode('12345')).toBeNull();
    expect(normalizeOtpCode('12345a')).toBeNull();
  });
});
