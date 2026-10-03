import { NextRequest } from 'next/server';
import { query } from '../../../../../../server/core/db';
import { verifyPassword } from '../../../../../../server/identity/password';
import { createMobileSession } from '../../../../../../server/identity/mobile-sessions';
import { AppError } from '../../../../../../server/core/errors';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireString } from '../../../../../../server/core/validation';
import { consumeDistributedRateLimit } from '../../../../../../server/core/distributed-rate-limit';
import { clientFingerprint } from '../../../../../../server/core/security-boundary';
import { recordSecurityEvent } from '../../../../../../server/core/security-events';
import { isLoginLocked, recordLoginFailure, recordLoginSuccess } from '../../../../../../server/identity/account-security';

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const ip = clientFingerprint(request);
    await consumeDistributedRateLimit({ key: `mobile-login:${ip}`, scope: 'auth.mobile.login.ip', windowSeconds: 60, maxRequests: 8 });
    const body = await request.json() as Record<string, unknown>;
    const identifier = requireString(body.identifier, 'identifier', 3, 320);
    const password = requireString(body.password, 'password', 12, 200);
    const platform = requireString(body.platform, 'platform', 3, 8).toUpperCase();
    const deviceId = requireString(body.deviceId, 'deviceId', 16, 256);
    const deviceName = typeof body.deviceName === 'string' ? body.deviceName.slice(0, 120) : undefined;
    const platformVersion = typeof body.platformVersion === 'string' ? body.platformVersion.slice(0, 80) : undefined;
    if (platform !== 'IOS' && platform !== 'ANDROID') throw new AppError('VALIDATION_ERROR', 'Unsupported mobile platform.');

    const result = await query<{ id: string; credentialHash: string }>(
      `SELECT u.id, uc.credential_hash AS "credentialHash"
       FROM users u JOIN user_credentials uc ON uc.user_id=u.id AND uc.credential_type='password'
       WHERE (lower(u.email)=lower($1) OR u.phone=$1) AND u.status='ACTIVE'`, [identifier]
    );
    const row = result.rows[0];
    const locked = row ? await isLoginLocked(row.id) : false;
    const validPassword = row ? await verifyPassword(password, row.credentialHash) : false;
    if (!row || locked || !validPassword) {
      if (row && validPassword === false) await recordLoginFailure(row.id);
      await recordSecurityEvent({ eventType: 'MOBILE_LOGIN_FAILURE', severity: 'WARNING', sourceIp: ip, userAgent: request.headers.get('user-agent') ?? undefined, correlationId: id });
      throw new AppError('UNAUTHORIZED', 'Invalid credentials.');
    }

    await recordLoginSuccess(row.id);
    const session = await createMobileSession({ userId: row.id, platform: platform as 'IOS' | 'ANDROID', deviceId, deviceName, platformVersion, ip, userAgent: request.headers.get('user-agent') ?? undefined });
    await recordSecurityEvent({ eventType: 'MOBILE_LOGIN_SUCCESS', severity: 'INFO', userId: row.id, sourceIp: ip, userAgent: request.headers.get('user-agent') ?? undefined, correlationId: id, metadata: { platform } });
    return json({ ok: true, accessToken: session.token, tokenType: 'Bearer' }, { correlationId: id });
  } catch (error) {
    return handleRouteError(error, id);
  }
}
