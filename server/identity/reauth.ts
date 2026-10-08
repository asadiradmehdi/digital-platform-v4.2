// Fresh-OTP requirement for sensitive account changes (phone, email, password).
// A change is allowed only with a single-use proof from a REAUTH code sent to the account's VERIFIED phone
// within the last 5 minutes. Client UX cannot lower this: the proof is checked and burned server-side.
import { query } from '../core/db';
import { AppError } from '../core/errors';
import { recordSecurityEvent } from '../core/security-events';
import { writeAudit } from '../core/audit';
import { maskIranMobile } from '../../packages/api-contracts/src/phone';
import { consumeOtpProof } from './otp/service';

export async function getContactState(userId: string) {
  const r = await query<{ phone: string | null; phone_verified: boolean; email: string | null; email_verified: boolean; has_password: boolean }>(
    `SELECT u.phone, (u.phone_verified_at IS NOT NULL) AS phone_verified, u.email, (u.email_verified_at IS NOT NULL) AS email_verified,
            EXISTS(SELECT 1 FROM user_credentials c WHERE c.user_id=u.id AND c.credential_type='password') AS has_password
       FROM users u WHERE u.id=$1`, [userId],
  );
  if (!r.rows[0]) throw new AppError('UNAUTHORIZED', 'Authentication required.');
  return r.rows[0];
}

/** The number REAUTH codes go to; sensitive changes are impossible until the account has one. */
export async function requireVerifiedPhone(userId: string) {
  const s = await getContactState(userId);
  if (!s.phone || !s.phone_verified) throw new AppError('CONFLICT', 'برای این کار ابتدا شماره موبایل خود را در «حساب کاربری» تأیید کنید.', { requiresVerifiedPhone: true });
  return s.phone;
}

/** Burns a REAUTH proof for this user (throws FORBIDDEN { requiresOtp } when missing/expired/used). */
export async function requireFreshOtp(userId: string, proof: unknown) {
  return consumeOtpProof({ userId, proof, purpose: 'REAUTH' });
}

/**
 * Sets a new VERIFIED phone. `changeProof` comes from a PHONE_CHANGE code sent to the new number; when the
 * account already has a verified phone, `reauthProof` (code to the current number) is required as well.
 */
export async function changeVerifiedPhone(input: { userId: string; changeProof: unknown; reauthProof: unknown; ip: string; correlationId: string }) {
  const before = await getContactState(input.userId);
  if (before.phone && before.phone_verified) await requireFreshOtp(input.userId, input.reauthProof);
  const phone = await consumeOtpProof({ userId: input.userId, proof: input.changeProof, purpose: 'PHONE_CHANGE' });
  const owner = await query<{ id: string }>(`SELECT id FROM users WHERE phone=$1 AND phone_verified_at IS NOT NULL AND id<>$2`, [phone, input.userId]);
  if (owner.rows[0]) throw new AppError('CONFLICT', 'این شماره به حساب دیگری متصل است.');
  // An unproven claim of this number elsewhere yields to the proven owner (same rule as phone sign-in).
  await query(`UPDATE users SET phone=NULL, updated_at=now() WHERE phone=$1 AND phone_verified_at IS NULL AND id<>$2 AND email IS NOT NULL`, [phone, input.userId]);
  await query(`UPDATE users SET phone=$2, phone_verified_at=now(), updated_at=now() WHERE id=$1`, [input.userId, phone]);
  await recordSecurityEvent({ eventType: 'PHONE_CHANGED', severity: 'WARNING', userId: input.userId, sourceIp: input.ip, correlationId: input.correlationId, metadata: { from: before.phone ? maskIranMobile(before.phone) : null, to: maskIranMobile(phone) } });
  await writeAudit({ actorUserId: input.userId, action: 'PHONE_CHANGED', entityType: 'user', entityId: input.userId, ip: input.ip === 'unknown' ? undefined : input.ip, metadata: { to: maskIranMobile(phone) } });
  return phone;
}
