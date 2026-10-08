import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { assertSameOrigin, clientFingerprint } from '../../../../../../server/core/security-boundary';
import { readBoundedBody } from '../../../../../../server/core/body';
import { AppError } from '../../../../../../server/core/errors';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { OTP_PROOF_TTL_SECONDS, verifyOtp } from '../../../../../../server/identity/otp/service';

/** Exchanges a REAUTH / PHONE_CHANGE code for a single-use proof (5 minutes) for the sensitive endpoint. */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await readBoundedBody(request, 2048);
    const purpose = body.purpose === 'PHONE_CHANGE' ? 'PHONE_CHANGE' : body.purpose === 'REAUTH' ? 'REAUTH' : null;
    if (!purpose) throw new AppError('VALIDATION_ERROR', 'purpose must be REAUTH or PHONE_CHANGE.');
    const r = await verifyOtp({ challengeId: body.challengeId, code: body.code, purpose, userId, ip: clientFingerprint(request), correlationId: id, userAgent: request.headers.get('user-agent') ?? undefined });
    return json({ ok: true, proof: r.proof, expiresIn: OTP_PROOF_TTL_SECONDS }, { correlationId: id, headers: { 'cache-control': 'no-store' } });
  } catch (error) { return handleRouteError(error, id); }
}
