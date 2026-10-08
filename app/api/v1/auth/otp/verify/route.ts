import { NextRequest } from 'next/server';
import { correlationId, handleRouteError } from '../../../../../../server/core/http';
import { assertSameOrigin, clientFingerprint } from '../../../../../../server/core/security-boundary';
import { readBoundedBody } from '../../../../../../server/core/body';
import { verifyOtp } from '../../../../../../server/identity/otp/service';
import { findOrCreateUserByVerifiedPhone } from '../../../../../../server/identity/otp/sign-in';
import { completeWebSignIn } from '../../../../../../server/identity/sign-in';
import { referralCodeFromCookies } from '../../../../../../server/referrals/service';

/** Web: check the code; signs in, creating the account (and its workspace + wallet) on first use. */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const ip = clientFingerprint(request);
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const body = await readBoundedBody(request, 2048);
    const verified = await verifyOtp({ challengeId: body.challengeId, code: body.code, purpose: 'LOGIN', ip, correlationId: id, userAgent });
    const referralCode = typeof body.referralCode === 'string' && body.referralCode.trim() ? body.referralCode : referralCodeFromCookies(request.headers.get('cookie'));
    const { userId, created } = await findOrCreateUserByVerifiedPhone({ phone: verified.phone, ip, referralCode, correlationId: id, userAgent });
    return await completeWebSignIn({ userId, method: 'OTP', ip, userAgent, correlationId: id, created, next: body.next as string | undefined });
  } catch (error) { return handleRouteError(error, id); }
}
