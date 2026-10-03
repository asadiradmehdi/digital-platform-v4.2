import { AppError } from './errors';

/** Browser mutation boundary: rejects cross-site form/API submissions. External webhooks are exempt and verified separately. */
export function assertSameOrigin(request: Request) {
  const method = request.method.toUpperCase();
  if (!['POST','PUT','PATCH','DELETE'].includes(method)) return;
  const origin = request.headers.get('origin');
  const expected = new URL(request.url).origin;
  if (origin) {
    if (origin !== expected) throw new AppError('FORBIDDEN', 'Cross-origin mutation rejected.');
    return;
  }
  const referer = request.headers.get('referer');
  if (referer) {
    try { if (new URL(referer).origin === expected) return; } catch { /* fall through */ }
  }
  // Browser session mutations must carry an origin signal. Non-browser clients
  // should authenticate with an API key and use the API surface rather than a session cookie.
  if (!request.headers.has('authorization')) throw new AppError('FORBIDDEN', 'Origin header required.');
}

export function clientFingerprint(request: Request) {
  const trustProxy = process.env.TRUST_PROXY === 'true';
  const real = trustProxy ? request.headers.get('x-real-ip') : null;
  const forwarded = trustProxy ? request.headers.get('x-forwarded-for') : null;
  const value = real ?? forwarded?.split(',')[0]?.trim() ?? 'unknown';
  return value.slice(0, 128);
}
