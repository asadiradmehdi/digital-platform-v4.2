// Forgotten password: an SMS code goes to the account's VERIFIED mobile number, and the code plus a new password
// are checked in one request. The request answer is identical whether or not an account matches (no account
// enumeration); every session of the account is ended once the password changes.
import { randomUUID } from 'node:crypto';
import { query } from '../core/db';
import { AppError } from '../core/errors';
import { consumeDistributedRateLimit } from '../core/distributed-rate-limit';
import { recordSecurityEvent } from '../core/security-events';
import { writeAudit } from '../core/audit';
import { normalizeIranMobile } from '../../packages/api-contracts/src/phone';
import { getSmsProvider } from '../notifications/sms/config';
import { smsErrorMessage, SmsProviderError } from '../notifications/sms/types';
import { OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_SECONDS, contactHash, requestOtp, verifyOtp } from './otp/service';
import { hashPassword } from './password';
import { assertStrongPassword } from './password-policy';
import { revokeAllSessions } from './sessions';

export const RESET_NOTICE = 'اگر حسابی با این مشخصات و یک شماره‌ی تأییدشده وجود داشته باشد، کد تأیید پیامک می‌شود.';

export type PasswordResetRequestResult = { challengeId: string; expiresIn: number; resendIn: number; notice: string };

async function findEligible(identifier: string) {
  const phone = normalizeIranMobile(identifier);
  const email = identifier.trim().toLowerCase();
  const r = phone
    ? await query<{ id: string; phone: string; status: string }>(`SELECT id, phone, status FROM users WHERE phone=$1 AND phone_verified_at IS NOT NULL`, [phone])
    : /^\S+@\S+\.\S+$/.test(email)
      ? await query<{ id: string; phone: string; status: string }>(`SELECT id, phone, status FROM users WHERE lower(email)=$1 AND phone IS NOT NULL AND phone_verified_at IS NOT NULL`, [email])
      : null;
  if (!r) throw new AppError('VALIDATION_ERROR', 'ایمیل یا شماره موبایل را درست وارد کنید.');
  const u = r.rows[0];
  return u && u.status === 'ACTIVE' ? u : null;
}

export async function requestPasswordReset(input: { identifier: unknown; ip: string; client: 'WEB' | 'MOBILE'; correlationId?: string; userAgent?: string }): Promise<PasswordResetRequestResult> {
  const identifier = typeof input.identifier === 'string' ? input.identifier.trim().slice(0, 320) : '';
  if (!identifier) throw new AppError('VALIDATION_ERROR', 'ایمیل یا شماره موبایل را وارد کنید.');
  const ip = input.ip;
  // Per-address ceiling for every attempt, matching accounts or not.
  await consumeDistributedRateLimit({ key: `pwreset-ip:${ip}`, scope: 'auth.pwreset.ip', windowSeconds: 3600, maxRequests: ip === 'unknown' ? 600 : 10 });
  await consumeDistributedRateLimit({ key: `pwreset-id:${contactHash(identifier.toLowerCase())}`, scope: 'auth.pwreset.id', windowSeconds: 3600, maxRequests: 5 });

  const { provider } = await getSmsProvider();
  if (!provider) throw new AppError('UNAVAILABLE', smsErrorMessage(new SmsProviderError('not_configured', 'no provider')));

  const user = await findEligible(identifier);
  const base = { expiresIn: OTP_TTL_SECONDS, resendIn: OTP_RESEND_COOLDOWN_SECONDS, notice: RESET_NOTICE };
  if (!user) {
    await recordSecurityEvent({ eventType: 'PASSWORD_RESET_NO_MATCH', severity: 'INFO', sourceIp: ip, correlationId: input.correlationId, metadata: { id: contactHash(identifier.toLowerCase()) } });
    return { challengeId: randomUUID(), ...base };
  }
  const sent = await requestOtp({ phone: user.phone, purpose: 'PASSWORD_RESET', userId: user.id, ip, client: input.client, correlationId: input.correlationId, userAgent: input.userAgent });
  return { challengeId: sent.challengeId, ...base };
}

export async function confirmPasswordReset(input: { challengeId: unknown; code: unknown; newPassword: unknown; ip: string; correlationId?: string; userAgent?: string }) {
  const password = typeof input.newPassword === 'string' ? input.newPassword : '';
  if ([...password].length < 14 || password.length > 200) throw new AppError('VALIDATION_ERROR', 'رمز عبور جدید باید دست‌کم ۱۴ کاراکتر باشد؛ یک عبارت ساده و به‌یادماندنی کافی است.');
  assertStrongPassword(password);
  const verified = await verifyOtp({ challengeId: input.challengeId, code: input.code, purpose: 'PASSWORD_RESET', ip: input.ip, correlationId: input.correlationId, userAgent: input.userAgent });
  if (!verified.userId) throw new AppError('UNAUTHORIZED', 'این کد منقضی شده است. یک کد تازه بگیرید.', { expired: true });
  const userId = verified.userId;
  const u = (await query<{ email: string | null }>(`SELECT email FROM users WHERE id=$1 AND status='ACTIVE'`, [userId])).rows[0];
  if (!u) throw new AppError('FORBIDDEN', 'این حساب غیرفعال است. با پشتیبانی تماس بگیرید.');
  if (u.email) assertStrongPassword(password, { email: u.email });
  const hash = await hashPassword(password);
  await query(
    `INSERT INTO user_credentials(user_id, credential_type, credential_hash) VALUES($1,'password',$2)
     ON CONFLICT(user_id, credential_type) DO UPDATE SET credential_hash=EXCLUDED.credential_hash, last_used_at=now()`,
    [userId, hash],
  );
  await revokeAllSessions(userId);
  await writeAudit({ actorUserId: userId, action: 'PASSWORD_RESET', entityType: 'user_credential', entityId: userId, metadata: { via: 'sms' } });
  await recordSecurityEvent({ eventType: 'PASSWORD_RESET', severity: 'WARNING', userId, sourceIp: input.ip, userAgent: input.userAgent, correlationId: input.correlationId, metadata: { via: 'sms', sessionsRevoked: true } });
  return { ok: true as const };
}
