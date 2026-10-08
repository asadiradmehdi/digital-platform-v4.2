import type { NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || (process.env.NODE_ENV === 'production' ? '__Host-dp_session' : 'dp_session');
// The cookie lives as long as the absolute session cap; the server enforces the idle and absolute limits.
export const SESSION_TTL_SECONDS = Number(process.env.SESSION_ABSOLUTE_TTL_SECONDS || process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 30);

function options(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, options(SESSION_TTL_SECONDS));
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, '', options(0));
}
