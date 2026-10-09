import { NextRequest } from 'next/server';
import { query } from '../../../../../../server/core/db';
import { hashPassword } from '../../../../../../server/identity/password';
import { createMobileSession } from '../../../../../../server/identity/mobile-sessions';
import { AppError } from '../../../../../../server/core/errors';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireString } from '../../../../../../server/core/validation';
import { consumeDistributedRateLimit } from '../../../../../../server/core/distributed-rate-limit';
import { clientFingerprint } from '../../../../../../server/core/security-boundary';
import { recordSecurityEvent } from '../../../../../../server/core/security-events';
import { assertStrongPassword } from '../../../../../../server/identity/password-policy';
import { createAccountWithWorkspace, isUniqueViolation } from '../../../../../../server/identity/signup';

/** Field checks answer in Persian: the app shows the message to the customer as-is. */
function persianField<T>(read: () => T, message: string): T {
  try { return read(); } catch { throw new AppError('VALIDATION_ERROR', message); }
}

const TAKEN = 'با این ایمیل قبلاً حساب ساخته شده است. وارد شوید.';

/**
 * Email sign-up for the native app: the same rules as the web form (strong password, one account per
 * email, personal workspace + wallet), answered with a bearer token bound to this device instead of a cookie.
 */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const ip = clientFingerprint(request);
    await consumeDistributedRateLimit({ key: `mobile-register:${ip}`, scope: 'auth.mobile.register.ip', windowSeconds: 60, maxRequests: 5 });
    const body = await request.json() as Record<string, unknown>;
    const email = persianField(() => requireString(body.email, 'email', 5, 320), 'آدرس ایمیل درست نیست.').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new AppError('VALIDATION_ERROR', 'آدرس ایمیل درست نیست.');
    const password = persianField(() => requireString(body.password, 'password', 14, 200), 'رمز عبور باید بین ۱۴ تا ۲۰۰ کاراکتر باشد.');
    assertStrongPassword(password, { email });
    const name = persianField(() => requireString(body.name, 'name', 2, 120), 'نام و نام خانوادگی را کامل وارد کنید.');
    const platform = requireString(body.platform, 'platform', 3, 8).toUpperCase();
    const deviceId = requireString(body.deviceId, 'deviceId', 16, 256);
    const deviceName = typeof body.deviceName === 'string' ? body.deviceName.slice(0, 120) : undefined;
    const platformVersion = typeof body.platformVersion === 'string' ? body.platformVersion.slice(0, 80) : undefined;
    if (platform !== 'IOS' && platform !== 'ANDROID') throw new AppError('VALIDATION_ERROR', 'Unsupported mobile platform.');
    const referralCode = typeof body.referralCode === 'string' && body.referralCode.trim() ? body.referralCode.trim().slice(0, 64) : null;

    const existing = await query(`SELECT 1 FROM users WHERE lower(email)=lower($1)`, [email]);
    if (existing.rows[0]) throw new AppError('CONFLICT', TAKEN);
    const passwordHash = await hashPassword(password);
    let account: { userId: string; workspaceId: string };
    try {
      account = await createAccountWithWorkspace({
        displayName: name, email, referralCode, ip,
        withinTransaction: (client, ids) => client.query(`INSERT INTO user_credentials(user_id,credential_type,credential_hash) VALUES($1,'password',$2)`, [ids.userId, passwordHash]).then(() => undefined),
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppError('CONFLICT', TAKEN);
      throw e;
    }

    const userAgent = request.headers.get('user-agent') ?? undefined;
    await recordSecurityEvent({ eventType: 'ACCOUNT_REGISTERED', severity: 'INFO', userId: account.userId, workspaceId: account.workspaceId, sourceIp: ip, userAgent, correlationId: id, metadata: { platform } });
    const session = await createMobileSession({ userId: account.userId, platform: platform as 'IOS' | 'ANDROID', deviceId, deviceName, platformVersion, ip, userAgent, authMethod: 'PASSWORD' });
    return json({ ok: true, accessToken: session.token, tokenType: 'Bearer' }, { correlationId: id, status: 201 });
  } catch (error) {
    return handleRouteError(error, id);
  }
}
