// One-time codes over SMS: login, re-authentication before sensitive changes, and phone-number change.
//
// Policy: 6 digits, valid 2 minutes, at most 5 wrong attempts per code (then the code is locked), one new
// code per number every 60 s, distributed per-number and per-address rate limits, HMAC-hashed at rest
// (the plaintext code exists only in memory and in the SMS), constant-time comparison, and security
// evidence for every send / lockout. Sending happens outside any database transaction with a timeout.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { query, withTransaction } from '../../core/db';
import { AppError } from '../../core/errors';
import { consumeDistributedRateLimit } from '../../core/distributed-rate-limit';
import { recordSecurityEvent } from '../../core/security-events';
import { maskIranMobile, normalizeIranMobile, toAsciiDigits } from '../../../packages/api-contracts/src/phone';
import { getSmsProvider } from '../../notifications/sms/config';
import { smsErrorMessage, SmsProviderError } from '../../notifications/sms/types';

export type OtpPurpose = 'LOGIN' | 'REAUTH' | 'PHONE_CHANGE';
export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 120;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_PROOF_TTL_SECONDS = 300;

const MSG = {
  badPhone: 'شماره موبایل معتبر نیست. شماره را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.',
  badCode: 'کد ۶ رقمی را کامل وارد کنید.',
  wrongCode: 'کد واردشده درست نیست.',
  expired: 'این کد منقضی شده است. یک کد تازه بگیرید.',
  locked: 'تعداد تلاش‌های نادرست زیاد شد. یک کد تازه بگیرید.',
  cooldown: 'کد قبلی همین الان ارسال شد. کمی صبر کنید و دوباره تلاش کنید.',
  tooMany: 'درخواست‌های زیادی برای این شماره ثبت شد. کمی بعد دوباره تلاش کنید.',
  proof: 'برای این کار، تأیید تازه با کد پیامکی لازم است.',
};

function otpKey() {
  const raw = process.env.SECRETS_MASTER_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') throw new Error('SECRETS_MASTER_KEY is required.');
    return createHash('sha256').update('zohalpay-dev-otp').digest();
  }
  return createHmac('sha256', raw).update('otp-code-v1').digest();
}

/** HMAC of the code bound to its challenge id: the same code under another challenge hashes differently. */
export function hashOtpCode(challengeId: string, code: string) {
  return createHmac('sha256', otpKey()).update(`${challengeId}:${code}`).digest('hex');
}
export function generateOtpCode() { return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0'); }
export function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, 'hex'); const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
/** Keyed hash for rate-limit keys and evidence, so raw numbers/addresses are not written there. */
export function contactHash(value: string) { return createHmac('sha256', otpKey()).update(`contact:${value}`).digest('hex').slice(0, 32); }

/** «۱۲۳ ۴۵۶» / "123456" / "123-456" → "123456" or null. */
export function normalizeOtpCode(raw: unknown) {
  if (typeof raw !== 'string') return null;
  const code = toAsciiDigits(raw).replace(/[\s\-‌‎‏]/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

export function requirePhone(raw: unknown) {
  const phone = normalizeIranMobile(raw);
  if (!phone) throw new AppError('VALIDATION_ERROR', MSG.badPhone);
  return phone;
}

async function limit(key: string, scope: string, windowSeconds: number, maxRequests: number, message: string) {
  try { await consumeDistributedRateLimit({ key, scope, windowSeconds, maxRequests }); }
  catch (e) {
    if (e instanceof AppError && e.code === 'RATE_LIMITED') throw new AppError('RATE_LIMITED', message, e.details);
    throw e;
  }
}
/** Without TRUST_PROXY every client reads as 'unknown'; a shared bucket then gets a site-wide ceiling instead. */
const ipLimit = (ip: string, perAddress: number, sitewide: number) => (ip === 'unknown' ? sitewide : perAddress);

export type OtpRequestInput = {
  phone: string; purpose: OtpPurpose; userId?: string | null; ip: string; client: 'WEB' | 'MOBILE';
  correlationId?: string; userAgent?: string;
};
export type OtpRequestResult = { challengeId: string; expiresIn: number; resendIn: number; maskedPhone: string };

export async function requestOtp(input: OtpRequestInput): Promise<OtpRequestResult> {
  const { phone, purpose, ip } = input;
  // Cooldown first, so a too-early resend does not burn the number's hourly budget.
  const recent = await query<{ wait: number }>(
    `SELECT GREATEST(1, CEIL(EXTRACT(EPOCH FROM (created_at + ($3 || ' seconds')::interval - now()))))::int AS wait
       FROM otp_challenges
      WHERE phone=$1 AND purpose=$2 AND delivery_status<>'FAILED' AND created_at > now() - ($3 || ' seconds')::interval
      ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose, OTP_RESEND_COOLDOWN_SECONDS],
  );
  if (recent.rows[0]) throw new AppError('RATE_LIMITED', MSG.cooldown, { retryAfter: recent.rows[0].wait });

  const ph = contactHash(phone);
  await limit(`otp-send-ip:${ip}`, 'auth.otp.send.ip', 600, ipLimit(ip, 10, 600), MSG.tooMany);
  await limit(`otp-send-phone:${ph}`, 'auth.otp.send.phone', 3600, 5, MSG.tooMany);
  await limit(`otp-send-phone-day:${ph}`, 'auth.otp.send.phone.day', 86400, 10, MSG.tooMany);

  const { provider, config } = await getSmsProvider();
  if (!provider) throw new AppError('UNAVAILABLE', smsErrorMessage(new SmsProviderError('not_configured', 'no provider')));

  const code = generateOtpCode();
  const challengeId = (await query<{ id: string }>(`SELECT gen_random_uuid() AS id`)).rows[0].id;
  await withTransaction(async client => {
    await client.query(
      `UPDATE otp_challenges SET superseded_at=now()
        WHERE phone=$1 AND purpose=$2 AND consumed_at IS NULL AND superseded_at IS NULL AND locked_at IS NULL`,
      [phone, purpose],
    );
    await client.query(
      `INSERT INTO otp_challenges(id, purpose, phone, user_id, code_hash, max_attempts, expires_at, ip_hash, client)
       VALUES($1,$2,$3,$4,$5,$6,now()+($7 || ' seconds')::interval,$8,$9)`,
      [challengeId, purpose, phone, input.userId ?? null, hashOtpCode(challengeId, code), OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS, ip === 'unknown' ? null : contactHash(ip), input.client],
    );
  });

  try {
    const sent = await provider.sendOtp(phone, code);
    await query(`UPDATE otp_challenges SET delivery_status='SENT' WHERE id=$1`, [challengeId]);
    await recordSecurityEvent({
      eventType: 'OTP_SENT', severity: 'INFO', userId: input.userId ?? undefined, sourceIp: ip, userAgent: input.userAgent,
      correlationId: input.correlationId, metadata: { purpose, phone: maskIranMobile(phone), provider: config.provider, providerReference: sent.providerReference },
    });
  } catch (error) {
    await query(`UPDATE otp_challenges SET delivery_status='FAILED', superseded_at=now() WHERE id=$1`, [challengeId]);
    await recordSecurityEvent({
      eventType: 'OTP_DELIVERY_FAILED', severity: 'WARNING', userId: input.userId ?? undefined, sourceIp: ip, correlationId: input.correlationId,
      metadata: { purpose, phone: maskIranMobile(phone), provider: config.provider, kind: error instanceof SmsProviderError ? error.kind : 'unknown' },
    });
    throw new AppError('UNAVAILABLE', smsErrorMessage(error));
  }
  return { challengeId, expiresIn: OTP_TTL_SECONDS, resendIn: OTP_RESEND_COOLDOWN_SECONDS, maskedPhone: maskIranMobile(phone) };
}

export type OtpVerifyResult = { challengeId: string; phone: string; userId: string | null; proof: string | null };
type Row = {
  id: string; phone: string; user_id: string | null; code_hash: string; attempts: number; max_attempts: number;
  expired: boolean; consumed_at: string | null; locked_at: string | null; superseded_at: string | null; delivery_status: string;
};

/**
 * Checks a code. Wrong attempts are counted and committed even though the call then fails; the fifth wrong
 * attempt locks the code. Non-LOGIN purposes return a single-use proof valid for OTP_PROOF_TTL_SECONDS.
 */
export async function verifyOtp(input: { challengeId: unknown; code: unknown; purpose: OtpPurpose; userId?: string | null; ip: string; correlationId?: string; userAgent?: string }): Promise<OtpVerifyResult> {
  const challengeId = typeof input.challengeId === 'string' && /^[0-9a-f-]{36}$/i.test(input.challengeId) ? input.challengeId : null;
  const code = normalizeOtpCode(input.code);
  if (!challengeId || !code) throw new AppError('VALIDATION_ERROR', MSG.badCode);
  await limit(`otp-verify-ip:${input.ip}`, 'auth.otp.verify.ip', 300, ipLimit(input.ip, 30, 1500), MSG.tooMany);

  const outcome = await withTransaction(async client => {
    const row = (await client.query<Row>(
      `SELECT id, phone, user_id, code_hash, attempts, max_attempts, (expires_at <= now()) AS expired,
              consumed_at, locked_at, superseded_at, delivery_status
         FROM otp_challenges WHERE id=$1 AND purpose=$2 FOR UPDATE`,
      [challengeId, input.purpose],
    )).rows[0];
    if (!row || (input.userId !== undefined && (row.user_id ?? null) !== (input.userId ?? null))) return { kind: 'missing' as const };
    if (row.locked_at) return { kind: 'locked' as const, row };
    if (row.consumed_at || row.superseded_at || row.expired || row.delivery_status === 'FAILED') return { kind: 'expired' as const, row };
    const attempts = row.attempts + 1;
    if (!safeEqualHex(hashOtpCode(row.id, code), row.code_hash)) {
      const lock = attempts >= row.max_attempts;
      await client.query(`UPDATE otp_challenges SET attempts=$2, locked_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE id=$1`, [row.id, attempts, lock]);
      return { kind: lock ? 'locked_now' as const : 'wrong' as const, row, left: row.max_attempts - attempts };
    }
    let proof: string | null = null;
    if (input.purpose !== 'LOGIN') proof = randomBytes(32).toString('base64url');
    await client.query(
      `UPDATE otp_challenges SET attempts=$2, consumed_at=now(), proof_hash=$3,
              proof_expires_at=CASE WHEN $3::text IS NULL THEN NULL ELSE now()+($4 || ' seconds')::interval END
        WHERE id=$1`,
      [row.id, attempts, proof ? sha256(proof) : null, OTP_PROOF_TTL_SECONDS],
    );
    return { kind: 'ok' as const, row, proof };
  });

  // Per-number ceiling across codes: guessing by requesting many codes is bounded too.
  if (outcome.kind !== 'missing' && outcome.kind !== 'ok') {
    await limit(`otp-verify-phone:${contactHash(outcome.row.phone)}`, 'auth.otp.verify.phone', 900, 10, MSG.tooMany);
  }
  const meta = { purpose: input.purpose, challengeId };
  switch (outcome.kind) {
    case 'ok':
      return { challengeId: outcome.row.id, phone: outcome.row.phone, userId: outcome.row.user_id, proof: outcome.proof };
    case 'wrong':
      await recordSecurityEvent({ eventType: 'OTP_VERIFY_FAILED', severity: 'WARNING', userId: outcome.row.user_id ?? undefined, sourceIp: input.ip, userAgent: input.userAgent, correlationId: input.correlationId, metadata: { ...meta, attemptsLeft: outcome.left } });
      throw new AppError('UNAUTHORIZED', MSG.wrongCode, { attemptsLeft: outcome.left });
    case 'locked_now':
      await recordSecurityEvent({ eventType: 'OTP_LOCKED', severity: 'HIGH', userId: outcome.row.user_id ?? undefined, sourceIp: input.ip, userAgent: input.userAgent, correlationId: input.correlationId, metadata: { ...meta, phone: maskIranMobile(outcome.row.phone) } });
      throw new AppError('UNAUTHORIZED', MSG.locked, { attemptsLeft: 0, locked: true });
    case 'locked':
      throw new AppError('UNAUTHORIZED', MSG.locked, { attemptsLeft: 0, locked: true });
    case 'expired':
      throw new AppError('UNAUTHORIZED', MSG.expired, { expired: true });
    default:
      throw new AppError('UNAUTHORIZED', MSG.expired, { expired: true });
  }
}

/**
 * Sensitive actions call this with the proof returned by a REAUTH / PHONE_CHANGE verification.
 * Single use, bound to the user and purpose, valid for 5 minutes. Returns the verified number.
 */
export async function consumeOtpProof(input: { userId: string; proof: unknown; purpose: Exclude<OtpPurpose, 'LOGIN'> }) {
  if (typeof input.proof !== 'string' || input.proof.length < 20 || input.proof.length > 100) {
    throw new AppError('FORBIDDEN', MSG.proof, { requiresOtp: true });
  }
  const r = await query<{ phone: string }>(
    `UPDATE otp_challenges SET proof_used_at=now()
      WHERE proof_hash=$1 AND user_id=$2 AND purpose=$3 AND proof_used_at IS NULL AND proof_expires_at > now()
      RETURNING phone`,
    [sha256(input.proof), input.userId, input.purpose],
  );
  if (!r.rows[0]) throw new AppError('FORBIDDEN', MSG.proof, { requiresOtp: true });
  return r.rows[0].phone;
}
