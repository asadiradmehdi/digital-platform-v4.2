import { NextRequest, NextResponse } from 'next/server';
import { normalizeCode, REFERRAL_COOKIE } from '../../../server/referrals/service';

/** Invite link: remember the code for 30 days and open sign-up. Unknown codes just open sign-up. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const target = new URL(code ? `/auth?mode=register&ref=${code}` : '/auth?mode=register', site);
  const response = NextResponse.redirect(target, 303);
  if (code) {
    response.cookies.set(REFERRAL_COOKIE, code, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
}
