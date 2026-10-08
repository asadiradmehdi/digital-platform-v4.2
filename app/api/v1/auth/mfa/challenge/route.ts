import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { verifyMfaChallenge } from '../../../../../../server/identity/mfa-service';
import { requireString } from '../../../../../../server/core/validation';
import { clientFingerprint } from '../../../../../../server/core/security-boundary';
import { recordSecurityEvent } from '../../../../../../server/core/security-events';
import { createSession } from '../../../../../../server/identity/sessions';
import { describeUserAgent } from '../../../../../../server/identity/sign-in';
import { setSessionCookie } from '../../../../../../server/identity/session-cookie';
import { AppError } from '../../../../../../server/core/errors';
import { consumeDistributedRateLimit } from '../../../../../../server/core/distributed-rate-limit';

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const ip = clientFingerprint(request);
    await consumeDistributedRateLimit({ key: `mfa:${ip}`, scope: 'auth.mfa.ip', windowSeconds: 60, maxRequests: 10 });
    const body = await request.json() as Record<string, unknown>;
    const challengeToken = requireString(body.challengeToken, 'challengeToken', 10, 200);
    const code = requireString(body.code, 'code', 6, 20);
    const codeType = body.codeType === 'recovery' ? 'recovery' : 'totp';
    const userId = await verifyMfaChallenge(challengeToken, code, codeType);
    if (!userId) {
      await recordSecurityEvent({
        eventType: 'MFA_CHALLENGE_FAILED',
        severity: 'WARNING',
        sourceIp: ip,
        correlationId: id,
        metadata: { codeType },
      });
      throw new AppError('UNAUTHORIZED', 'Invalid or expired MFA challenge.');
    }
    await recordSecurityEvent({
      eventType: 'LOGIN_SUCCESS',
      severity: 'INFO',
      userId,
      sourceIp: ip,
      userAgent: request.headers.get('user-agent') ?? undefined,
      correlationId: id,
      metadata: { mfaVerified: true, codeType },
    });
    const token = await createSession(userId, undefined, { clientType: 'WEB', authMethod: 'MFA', lastIp: ip, lastUserAgent: request.headers.get('user-agent') ?? undefined, deviceName: describeUserAgent(request.headers.get('user-agent')) });
    const response = json({ ok: true }, { correlationId: id });
    setSessionCookie(response, token);
    return response;
  } catch (e) {
    return handleRouteError(e, id);
  }
}
