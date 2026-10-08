import { NextRequest } from 'next/server';
import { correlationId, handleRouteError } from '../../../../../../../server/core/http';
import { clientFingerprint } from '../../../../../../../server/core/security-boundary';
import { readBoundedBody } from '../../../../../../../server/core/body';
import { verifyOtp } from '../../../../../../../server/identity/otp/service';
import { findOrCreateUserByVerifiedPhone } from '../../../../../../../server/identity/otp/sign-in';
import { completeMobileSignIn, readMobileDevice } from '../../../../../../../server/identity/sign-in';
import { normalizeCode } from '../../../../../../../server/referrals/service';

/** App: check the code and return a bearer session for the OS secure store (account created on first use). */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const ip = clientFingerprint(request);
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const body = await readBoundedBody(request, 4096);
    const device = readMobileDevice(body);
    const verified = await verifyOtp({ challengeId: body.challengeId, code: body.code, purpose: 'LOGIN', ip, correlationId: id, userAgent });
    const { userId, created } = await findOrCreateUserByVerifiedPhone({ phone: verified.phone, ip, referralCode: normalizeCode(body.referralCode), correlationId: id, userAgent });
    return await completeMobileSignIn({ userId, method: 'OTP', ip, userAgent, correlationId: id, created, device });
  } catch (error) { return handleRouteError(error, id); }
}
