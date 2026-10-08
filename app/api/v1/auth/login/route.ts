import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../server/core/db';
import { verifyPassword } from '../../../../../server/identity/password';
import { createSession } from '../../../../../server/identity/sessions';
import { AppError } from '../../../../../server/core/errors';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireString } from '../../../../../server/core/validation';
import { consumeDistributedRateLimit } from '../../../../../server/core/distributed-rate-limit';
import { assertSameOrigin, clientFingerprint } from '../../../../../server/core/security-boundary';
import { recordSecurityEvent } from '../../../../../server/core/security-events';
import { setSessionCookie } from '../../../../../server/identity/session-cookie';
import { isLoginLocked, recordLoginFailure, recordLoginSuccess } from '../../../../../server/identity/account-security';
import { hasMfaEnabled, issueMfaChallenge } from '../../../../../server/identity/mfa-service';

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const ip = clientFingerprint(request);
    await consumeDistributedRateLimit({ key: `login:${ip}`, scope: 'auth.login.ip', windowSeconds: 60, maxRequests: 10 });
    const isForm = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded');
    const body = isForm
      ? Object.fromEntries((await request.formData()).entries())
      : await request.json() as Record<string, unknown>;
    // The web form posts `email`; API clients send `identifier` (email or phone).
    const identifier = requireString(body.identifier ?? body.email, 'identifier', 3, 320);
    const password = requireString(body.password, 'password', 12, 200);
    const r = await query<{ id: string; credentialHash: string }>(
      `SELECT u.id, uc.credential_hash AS "credentialHash"
       FROM users u JOIN user_credentials uc ON uc.user_id=u.id AND uc.credential_type='password'
       WHERE (lower(u.email)=lower($1) OR u.phone=$1) AND u.status='ACTIVE'`,
      [identifier]
    );
    const row = r.rows[0];
    const locked = row ? await isLoginLocked(row.id) : false;
    const validPassword = row ? await verifyPassword(password, row.credentialHash) : false;
    if (!row || locked || !validPassword) {
      if (row && validPassword === false) await recordLoginFailure(row.id);
      await recordSecurityEvent({ eventType: 'LOGIN_FAILURE', severity: 'WARNING', sourceIp: ip, userAgent: request.headers.get('user-agent') ?? undefined, correlationId: id, metadata: { identifierType: identifier.includes('@') ? 'email' : 'other' } });
      throw new AppError('UNAUTHORIZED', 'Invalid credentials.');
    }
    await recordLoginSuccess(row.id);

    // If user has MFA enabled, issue a short-lived challenge instead of a full session.
    if (await hasMfaEnabled(row.id)) {
      await recordSecurityEvent({ eventType: 'MFA_CHALLENGE_ISSUED', severity: 'INFO', userId: row.id, sourceIp: ip, userAgent: request.headers.get('user-agent') ?? undefined, correlationId: id });
      const challengeToken = await issueMfaChallenge(row.id);
      return json({ mfaRequired: true, challengeToken }, { correlationId: id, status: 200 });
    }

    await recordSecurityEvent({ eventType: 'LOGIN_SUCCESS', severity: 'INFO', userId: row.id, sourceIp: ip, userAgent: request.headers.get('user-agent') ?? undefined, correlationId: id });
    const token = await createSession(row.id);
    const response = isForm ? NextResponse.redirect(new URL('/dashboard', request.url)) : json({ ok: true }, { correlationId: id });
    response.headers.set('x-correlation-id', id);
    setSessionCookie(response, token);
    return response;
  } catch (e) {
    return handleRouteError(e, id);
  }
}
