// Phone sign-in after a verified LOGIN code: find the account that owns this VERIFIED number, or create one.
import { query } from '../../core/db';
import { AppError } from '../../core/errors';
import { recordSecurityEvent } from '../../core/security-events';
import { maskIranMobile } from '../../../packages/api-contracts/src/phone';
import { createAccountWithWorkspace, isUniqueViolation } from '../signup';

export type PhoneSignInResult = { userId: string; created: boolean };

export async function findOrCreateUserByVerifiedPhone(input: {
  phone: string; ip: string; referralCode: string | null; correlationId?: string; userAgent?: string;
}): Promise<PhoneSignInResult> {
  const existing = await findVerified(input.phone);
  if (existing) return existing;

  // The number may be typed into another profile without ever being proven. That claim must not win over
  // the person who just proved possession (otherwise pre-claiming a number hijacks its owner's sign-in):
  // release it from that profile and record why.
  const claims = await query<{ id: string; email: string | null }>(
    `SELECT id, email FROM users WHERE phone=$1 AND phone_verified_at IS NULL`, [input.phone],
  );
  for (const claim of claims.rows) {
    if (!claim.email) throw new AppError('CONFLICT', 'این شماره به حساب دیگری متصل است. با پشتیبانی تماس بگیرید.');
    await query(`UPDATE users SET phone=NULL, updated_at=now() WHERE id=$1 AND phone_verified_at IS NULL`, [claim.id]);
    await recordSecurityEvent({
      eventType: 'PHONE_CLAIM_RELEASED', severity: 'WARNING', userId: claim.id, sourceIp: input.ip, correlationId: input.correlationId,
      metadata: { phone: maskIranMobile(input.phone), reason: 'unverified number proven by another sign-in' },
    });
  }

  try {
    const { userId, workspaceId } = await createAccountWithWorkspace({
      displayName: `کاربر ${input.phone.slice(-4)}`, phone: input.phone, phoneVerified: true, referralCode: input.referralCode, ip: input.ip,
    });
    await recordSecurityEvent({
      eventType: 'ACCOUNT_REGISTERED', severity: 'INFO', userId, workspaceId, sourceIp: input.ip, userAgent: input.userAgent,
      correlationId: input.correlationId, metadata: { method: 'OTP' },
    });
    return { userId, created: true };
  } catch (error) {
    // Two codes verified at once for a brand-new number: the second request joins the first account.
    if (isUniqueViolation(error)) {
      const raced = await findVerified(input.phone);
      if (raced) return raced;
    }
    throw error;
  }
}

async function findVerified(phone: string): Promise<PhoneSignInResult | null> {
  const r = await query<{ id: string; status: string }>(
    `SELECT id, status FROM users WHERE phone=$1 AND phone_verified_at IS NOT NULL`, [phone],
  );
  const row = r.rows[0];
  if (!row) return null;
  if (row.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'این حساب غیرفعال است. با پشتیبانی تماس بگیرید.');
  return { userId: row.id, created: false };
}
