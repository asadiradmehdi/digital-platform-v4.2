import { NextRequest, NextResponse } from 'next/server';
import { correlationId } from '../../../../../../server/core/http';
import { clientFingerprint } from '../../../../../../server/core/security-boundary';
import { consumeDistributedRateLimit } from '../../../../../../server/core/distributed-rate-limit';
import { recordSecurityEvent } from '../../../../../../server/core/security-events';
import { loadGoogleConfig, mobileScheme, siteUrl } from '../../../../../../server/identity/google/config';
import { claimGoogleFlow, createMobileHandoff, findOrCreateUserForGoogle, identityFromCallback, OAUTH_BINDING_COOKIE } from '../../../../../../server/identity/google/flow';
import { GoogleAuthError } from '../../../../../../server/identity/google/oidc';
import { beginWebSession, safeNextPath } from '../../../../../../server/identity/sign-in';
import { setSessionCookie } from '../../../../../../server/identity/session-cookie';
import { REFERRAL_COOKIE } from '../../../../../../server/referrals/service';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/**
 * The SameSite=Strict session cookie is not sent on a navigation chain that started on accounts.google.com,
 * so a plain 302 to /dashboard would look signed-out. A same-origin page that refreshes into the app makes
 * the next request same-site.
 */
function continuePage(path: string) {
  const href = escapeHtml(path);
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${href}"><title>ورود</title></head><body style="font-family:system-ui,sans-serif;background:#F7F3EA;color:#0C1638;display:grid;place-items:center;min-height:100vh;margin:0"><p>در حال ورود… <a href="${href}">ادامه</a></p></body></html>`;
}

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  const ip = clientFingerprint(request);
  const userAgent = request.headers.get('user-agent') ?? undefined;
  const params = request.nextUrl.searchParams;
  const base = siteUrl() ?? request.nextUrl.origin;
  const binding = request.cookies.get(OAUTH_BINDING_COOKIE)?.value;
  let client: 'WEB' | 'MOBILE' = 'WEB';

  const finish = (response: NextResponse) => {
    response.cookies.set(OAUTH_BINDING_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    response.headers.set('cache-control', 'no-store');
    response.headers.set('x-correlation-id', id);
    return response;
  };
  const fail = (reason: string) => finish(client === 'MOBILE'
    ? NextResponse.redirect(`${mobileScheme()}://auth/google?error=${reason}`)
    : NextResponse.redirect(new URL(`/auth?error=${reason}`, base)));

  try {
    await consumeDistributedRateLimit({ key: `google-callback:${ip}`, scope: 'auth.google.callback.ip', windowSeconds: 300, maxRequests: ip === 'unknown' ? 1000 : 30 });
    const config = await loadGoogleConfig();
    if (!config) return fail('google_unavailable');
    const flow = await claimGoogleFlow(params.get('state'), binding);
    client = flow.client;
    if (params.get('error')) return fail(params.get('error') === 'access_denied' ? 'google_cancelled' : 'google_failed');

    const identity = await identityFromCallback(config, flow, params.get('code'));
    const { userId, created } = await findOrCreateUserForGoogle(identity, { ip, referralCode: flow.referral_code, correlationId: id, userAgent });

    if (flow.client === 'MOBILE') {
      const handoff = await createMobileHandoff(userId, flow.app_challenge!, created);
      return finish(NextResponse.redirect(`${config.mobileScheme}://auth/google?handoff=${encodeURIComponent(handoff)}`));
    }
    const session = await beginWebSession({ userId, method: 'GOOGLE', ip, userAgent, correlationId: id, created });
    if (session.kind === 'mfa') {
      // The fragment never reaches a server or a log; the sign-in page reads it and asks for the code.
      return finish(new NextResponse(continuePage(`/auth?next=${encodeURIComponent(safeNextPath(flow.next_path))}#mfa=${session.challengeToken}`), { headers: { 'content-type': 'text/html; charset=utf-8' } }));
    }
    const response = finish(new NextResponse(continuePage(safeNextPath(flow.next_path)), { headers: { 'content-type': 'text/html; charset=utf-8' } }));
    setSessionCookie(response, session.token);
    response.cookies.delete(REFERRAL_COOKIE);
    return response;
  } catch (error) {
    await recordSecurityEvent({
      eventType: 'GOOGLE_SIGN_IN_FAILED', severity: 'WARNING', sourceIp: ip, userAgent, correlationId: id,
      metadata: { reason: error instanceof GoogleAuthError ? error.reason : error instanceof Error ? error.message.slice(0, 120) : 'unknown', client },
    }).catch(() => undefined);
    return fail('google_failed');
  }
}
