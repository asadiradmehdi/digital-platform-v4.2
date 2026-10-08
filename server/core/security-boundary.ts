import { AppError } from './errors';

/** Browser mutation boundary: rejects cross-site form/API submissions. External webhooks are exempt and verified separately. */
export function assertSameOrigin(request: Request) {
  const method = request.method.toUpperCase();
  if (!['POST','PUT','PATCH','DELETE'].includes(method)) return;
  const origin = request.headers.get('origin');
  const expected = new URL(request.url).origin;
  // Behind a TLS proxy request.url can read as http://host:port, so the configured public origin is accepted too.
  const site = siteOrigin();
  if (origin) {
    if (origin !== expected && origin !== site) throw new AppError('FORBIDDEN', 'Cross-origin mutation rejected.');
    return;
  }
  const referer = request.headers.get('referer');
  if (referer) {
    try { const o = new URL(referer).origin; if (o === expected || o === site) return; } catch { /* fall through */ }
  }
  // Browser session mutations must carry an origin signal. Non-browser clients
  // should authenticate with an API key and use the API surface rather than a session cookie.
  if (!request.headers.has('authorization')) throw new AppError('FORBIDDEN', 'Origin header required.');
}

function siteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return null;
  try { return new URL(raw).origin; } catch { return null; }
}

export function clientFingerprint(request: Request) {
  const trustProxy = process.env.TRUST_PROXY === 'true';
  const real = trustProxy ? request.headers.get('x-real-ip') : null;
  const forwarded = trustProxy ? request.headers.get('x-forwarded-for') : null;
  const value = real ?? forwarded?.split(',')[0]?.trim() ?? 'unknown';
  return value.slice(0, 128);
}
