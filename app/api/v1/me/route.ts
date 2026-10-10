import { NextRequest } from 'next/server';
import { query } from '../../../../server/core/db';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { assertSameOrigin, clientFingerprint } from '../../../../server/core/security-boundary';
import { AppError } from '../../../../server/core/errors';
import { writeAudit } from '../../../../server/core/audit';
import { recordSecurityEvent } from '../../../../server/core/security-events';
import { normalizeIranMobile } from '../../../../packages/api-contracts/src/phone';
import { requireFreshOtp, requireVerifiedPhone } from '../../../../server/identity/reauth';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const result = await query(
      `SELECT id,email,phone,display_name AS "displayName",status,created_at AS "createdAt",
              (phone_verified_at IS NOT NULL) AS "phoneVerified", (email_verified_at IS NOT NULL) AS "emailVerified",
              EXISTS(SELECT 1 FROM user_credentials c WHERE c.user_id=users.id AND c.credential_type='password') AS "hasPassword"
         FROM users WHERE id=$1`, [userId]);
    if (!result.rows[0]) throw new Error('User not found');
    const workspaces = await query(`SELECT w.id,w.name,w.slug,w.status,wm.status AS "memberStatus" FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE wm.user_id=$1 AND wm.status='ACTIVE' ORDER BY w.created_at`, [userId]);
    return json({ user: result.rows[0], workspaces: workspaces.rows }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}

/**
 * Profile edits. The display name is free; the phone changes only through the verified flow
 * (PUT /api/v1/me/phone); the email changes only with a fresh SMS code proof (`otpProof`).
 */
export async function PATCH(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as { displayName?: string; phone?: string; email?: string; otpProof?: string };
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 60) : undefined;
    if (displayName !== undefined && displayName.length < 2) throw new AppError('VALIDATION_ERROR', 'نام نمایشی حداقل ۲ کاراکتر باشد.');

    const current = (await query<{ phone: string | null; email: string | null }>(`SELECT phone, email FROM users WHERE id=$1`, [userId])).rows[0];
    if (!current) throw new AppError('UNAUTHORIZED', 'Authentication required.');
    if (typeof body.phone === 'string' && body.phone.trim() && normalizeIranMobile(body.phone) !== current.phone) {
      // Typing a number is not proof of owning it: phone sign-in trusts only verified numbers.
      throw new AppError('VALIDATION_ERROR', 'برای تغییر شماره موبایل از «تغییر شماره» و کد تأیید پیامکی استفاده کنید.');
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    if (email !== undefined && email !== (current.email ?? '')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw new AppError('VALIDATION_ERROR', 'ایمیل معتبر نیست.');
      await requireVerifiedPhone(userId);
      await requireFreshOtp(userId, body.otpProof);
      try {
        await query(`UPDATE users SET email=$1, email_verified_at=NULL, updated_at=now() WHERE id=$2`, [email, userId]);
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw new AppError('CONFLICT', 'این ایمیل به حساب دیگری متصل است.');
        throw e;
      }
      await recordSecurityEvent({ eventType: 'EMAIL_CHANGED', severity: 'WARNING', userId, sourceIp: clientFingerprint(request), correlationId: id });
      await writeAudit({ actorUserId: userId, action: 'EMAIL_CHANGED', entityType: 'user', entityId: userId, metadata: { otpVerified: true } });
    }
    if (displayName !== undefined) await query(`UPDATE users SET display_name=$1, updated_at=now() WHERE id=$2`, [displayName, userId]);
    return json({ ok: true }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
