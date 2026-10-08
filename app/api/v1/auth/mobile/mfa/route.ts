import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { clientFingerprint } from '../../../../../../server/core/security-boundary';
import { readBoundedBody } from '../../../../../../server/core/body';
import { consumeDistributedRateLimit } from '../../../../../../server/core/distributed-rate-limit';
import { recordSecurityEvent } from '../../../../../../server/core/security-events';
import { requireString } from '../../../../../../server/core/validation';
import { AppError } from '../../../../../../server/core/errors';
import { verifyMfaChallenge } from '../../../../../../server/identity/mfa-service';
import { createMobileSession } from '../../../../../../server/identity/mobile-sessions';
import { readMobileDevice } from '../../../../../../server/identity/sign-in';
import { recordLoginSuccess } from '../../../../../../server/identity/account-security';

/** App: second factor after a phone/Google sign-in for accounts with TOTP enabled → bearer session. */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const ip = clientFingerprint(request);
    await consumeDistributedRateLimit({ key: `mobile-mfa:${ip}`, scope: 'auth.mobile.mfa.ip', windowSeconds: 60, maxRequests: ip === 'unknown' ? 300 : 10 });
    const body = await readBoundedBody(request, 4096);
    const device = readMobileDevice(body);
    const challengeToken = requireString(body.challengeToken, 'challengeToken', 10, 200);
    const code = requireString(body.code, 'code', 6, 20);
    const codeType = body.codeType === 'recovery' ? 'recovery' : 'totp';
    const userId = await verifyMfaChallenge(challengeToken, code, codeType);
    if (!userId) {
      await recordSecurityEvent({ eventType: 'MFA_CHALLENGE_FAILED', severity: 'WARNING', sourceIp: ip, correlationId: id, metadata: { codeType, platform: device.platform } });
      throw new AppError('UNAUTHORIZED', 'کد تأیید دومرحله‌ای درست نیست یا منقضی شده است.');
    }
    await recordLoginSuccess(userId);
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const session = await createMobileSession({ userId, ...device, ip, userAgent, authMethod: 'MFA' });
    await recordSecurityEvent({ eventType: 'MOBILE_LOGIN_SUCCESS', severity: 'INFO', userId, sourceIp: ip, userAgent, correlationId: id, metadata: { platform: device.platform, mfaVerified: true } });
    return json({ ok: true, accessToken: session.token, tokenType: 'Bearer', created: false }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
