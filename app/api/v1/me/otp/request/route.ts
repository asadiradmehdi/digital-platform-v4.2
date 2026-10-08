import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { assertSameOrigin, clientFingerprint } from '../../../../../../server/core/security-boundary';
import { readBoundedBody } from '../../../../../../server/core/body';
import { AppError } from '../../../../../../server/core/errors';
import { query } from '../../../../../../server/core/db';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requestOtp, requirePhone } from '../../../../../../server/identity/otp/service';
import { getContactState, requireVerifiedPhone } from '../../../../../../server/identity/reauth';

/**
 * Signed-in code requests:
 *  - purpose REAUTH: a fresh code to the account's verified phone, before changing phone/email/password;
 *  - purpose PHONE_CHANGE: a code to a NEW number, proving it before it replaces the current one.
 */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const ip = clientFingerprint(request);
    const body = await readBoundedBody(request, 2048);
    const purpose = body.purpose === 'PHONE_CHANGE' ? 'PHONE_CHANGE' : body.purpose === 'REAUTH' ? 'REAUTH' : null;
    if (!purpose) throw new AppError('VALIDATION_ERROR', 'purpose must be REAUTH or PHONE_CHANGE.');
    let phone: string;
    if (purpose === 'REAUTH') phone = await requireVerifiedPhone(userId);
    else {
      phone = requirePhone(body.phone);
      const current = await getContactState(userId);
      if (current.phone === phone && current.phone_verified) throw new AppError('VALIDATION_ERROR', 'این شماره همین حالا شماره‌ی تأییدشده‌ی شماست.');
      const taken = await query(`SELECT 1 FROM users WHERE phone=$1 AND phone_verified_at IS NOT NULL AND id<>$2`, [phone, userId]);
      if (taken.rows[0]) throw new AppError('CONFLICT', 'این شماره به حساب دیگری متصل است.');
    }
    const result = await requestOtp({ phone, purpose, userId, ip, client: request.headers.has('authorization') ? 'MOBILE' : 'WEB', correlationId: id, userAgent: request.headers.get('user-agent') ?? undefined });
    return json({ ok: true, ...result }, { correlationId: id, headers: { 'cache-control': 'no-store' } });
  } catch (error) { return handleRouteError(error, id); }
}
