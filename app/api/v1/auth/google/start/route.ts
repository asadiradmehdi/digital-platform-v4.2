import { NextRequest, NextResponse } from 'next/server';
import { correlationId } from '../../../../../../server/core/http';
import { clientFingerprint } from '../../../../../../server/core/security-boundary';
import { consumeDistributedRateLimit } from '../../../../../../server/core/distributed-rate-limit';
import { loadGoogleConfig, mobileScheme, siteUrl } from '../../../../../../server/identity/google/config';
import { OAUTH_BINDING_COOKIE, startGoogleFlow } from '../../../../../../server/identity/google/flow';
import { referralCodeFromCookies } from '../../../../../../server/referrals/service';

/**
 * GET /api/v1/auth/google/start?client=web|mobile[&next=/path][&app_challenge=…][&ref=CODE]
 * Starts a Google sign-in in this browser (top-level navigation) and redirects to Google.
 */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  const params = request.nextUrl.searchParams;
  const client = params.get('client') === 'mobile' ? 'MOBILE' : 'WEB';
  const base = siteUrl() ?? request.nextUrl.origin;
  const fail = (reason: string) => client === 'MOBILE'
    ? NextResponse.redirect(`${mobileScheme()}://auth/google?error=${reason}`)
    : NextResponse.redirect(new URL(`/auth?error=${reason}`, base));
  try {
    const ip = clientFingerprint(request);
    await consumeDistributedRateLimit({ key: `google-start:${ip}`, scope: 'auth.google.start.ip', windowSeconds: 300, maxRequests: ip === 'unknown' ? 1000 : 20 });
    const config = await loadGoogleConfig();
    if (!config) return fail('google_unavailable');
    const flow = await startGoogleFlow(config, {
      client, next: params.get('next'), appChallenge: params.get('app_challenge'),
      referralCode: params.get('ref') ?? referralCodeFromCookies(request.headers.get('cookie')),
    });
    const response = NextResponse.redirect(flow.url);
    // SameSite=Lax: the callback is a top-level navigation coming back from accounts.google.com.
    response.cookies.set(OAUTH_BINDING_COOKIE, flow.binding, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: flow.maxAge });
    response.headers.set('x-correlation-id', id);
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch {
    return fail('google_failed');
  }
}
