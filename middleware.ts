import { NextResponse, type NextRequest } from 'next/server';

const PRIVATE_PREFIXES=['/dashboard','/account','/workspace','/settings','/orders','/wallet','/analytics','/subscriptions','/referrals','/support'];

export function buildCsp(nonce: string) {
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    // 'unsafe-eval' only for the local dev server (React dev tooling); never in production builds.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `media-src 'self' blob:`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

export function middleware(request: NextRequest){
  const pathname=request.nextUrl.pathname;
  if(PRIVATE_PREFIXES.some(p=>pathname===p||pathname.startsWith(`${p}/`))){
    const token=request.cookies.get(process.env.SESSION_COOKIE_NAME ?? (process.env.NODE_ENV === 'production' ? '__Host-dp_session' : 'dp_session'))?.value;
    if(!token){const url=new URL('/auth',request.url);url.searchParams.set('next',pathname);return NextResponse.redirect(url);}
  }
  const nonce = crypto.randomUUID().replaceAll('-','');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-csp-nonce', nonce);
  // Next.js reads the nonce from the request's CSP header and stamps it on its own scripts.
  requestHeaders.set('Content-Security-Policy', buildCsp(nonce));
  const response=NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy',buildCsp(nonce));
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('X-Frame-Options','DENY');
  response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  response.headers.set('X-DNS-Prefetch-Control','off');
  response.headers.set('Cross-Origin-Opener-Policy','same-origin');
  response.headers.set('Cross-Origin-Resource-Policy','same-origin');
  response.headers.set('Origin-Agent-Cluster','?1');
  if (process.env.NODE_ENV === 'production') response.headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains; preload');
  return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
