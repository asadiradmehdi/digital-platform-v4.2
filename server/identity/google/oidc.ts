// Google OpenID Connect adapter: authorization URL, server-side code exchange (with PKCE verifier and the
// client secret), and ID-token verification against Google's published keys. All network calls to Google
// live here, with timeouts; nothing else in the codebase talks to Google.
import { createHash, createPublicKey, verify as verifySignature, type JsonWebKey } from 'node:crypto';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const CLOCK_SKEW_SECONDS = 60;

export class GoogleAuthError extends Error {
  constructor(public readonly reason: string, message: string) { super(message); this.name = 'GoogleAuthError'; }
}

export function pkceChallenge(verifier: string) { return createHash('sha256').update(verifier).digest('base64url'); }

export function buildAuthorizationUrl(input: { clientId: string; redirectUri: string; state: string; nonce: string; codeVerifier: string; loginHint?: string }) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', input.state);
  url.searchParams.set('nonce', input.nonce);
  url.searchParams.set('code_challenge', pkceChallenge(input.codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  if (input.loginHint) url.searchParams.set('login_hint', input.loginHint);
  return url.toString();
}

export async function exchangeAuthorizationCode(input: { code: string; codeVerifier: string; clientId: string; clientSecret: string; redirectUri: string }, fetchImpl: typeof fetch = fetch) {
  let res: Response;
  try {
    res = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code: input.code, code_verifier: input.codeVerifier, client_id: input.clientId, client_secret: input.clientSecret,
        redirect_uri: input.redirectUri, grant_type: 'authorization_code',
      }).toString(),
      signal: AbortSignal.timeout(8_000),
      redirect: 'error',
    });
  } catch { throw new GoogleAuthError('token_unreachable', 'Google token endpoint is unreachable.'); }
  const body = await res.json().catch(() => null) as { id_token?: string; error?: string } | null;
  if (!res.ok || !body?.id_token) throw new GoogleAuthError('token_rejected', `Google rejected the code exchange (${body?.error ?? res.status}).`);
  return { idToken: body.id_token };
}

type Jwk = JsonWebKey & { kid?: string; alg?: string; kty?: string };
let jwksCache: { keys: Jwk[]; expiresAt: number; fetchedAt: number } | null = null;

export async function getGoogleKeys(fetchImpl: typeof fetch = fetch, force = false): Promise<Jwk[]> {
  const now = Date.now();
  if (jwksCache && !force && jwksCache.expiresAt > now) return jwksCache.keys;
  // A forced refresh (unknown kid) is allowed at most once a minute so a bad token cannot hammer Google.
  if (jwksCache && force && now - jwksCache.fetchedAt < 60_000) return jwksCache.keys;
  let res: Response;
  try { res = await fetchImpl(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(8_000), redirect: 'error' }); }
  catch { throw new GoogleAuthError('jwks_unreachable', 'Google signing keys are unreachable.'); }
  const body = await res.json().catch(() => null) as { keys?: Jwk[] } | null;
  if (!res.ok || !Array.isArray(body?.keys)) throw new GoogleAuthError('jwks_invalid', 'Google signing keys could not be read.');
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  jwksCache = { keys: body.keys, fetchedAt: now, expiresAt: now + Math.min(Math.max(maxAge, 60), 86_400) * 1000 };
  return body.keys;
}
export function resetGoogleKeyCache() { jwksCache = null; }

export type GoogleIdentity = { sub: string; email: string; emailVerified: true; name: string | null; picture: string | null };

const b64json = (part: string) => { try { return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>; } catch { return null; } };

/** Verifies signature (RS256, Google JWKS), iss, aud/azp, exp/iat, nonce and email_verified. */
export async function verifyGoogleIdToken(idToken: string, expected: { clientId: string; nonce: string; now?: number }, keys: (force: boolean) => Promise<Jwk[]> = force => getGoogleKeys(fetch, force)): Promise<GoogleIdentity> {
  const parts = idToken.split('.');
  if (parts.length !== 3 || idToken.length > 8192) throw new GoogleAuthError('malformed', 'ID token is malformed.');
  const header = b64json(parts[0]);
  const claims = b64json(parts[1]);
  if (!header || !claims) throw new GoogleAuthError('malformed', 'ID token is malformed.');
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new GoogleAuthError('alg', 'ID token algorithm is not accepted.');
  let jwk = (await keys(false)).find(k => k.kid === header.kid);
  if (!jwk) jwk = (await keys(true)).find(k => k.kid === header.kid);
  if (!jwk || jwk.kty !== 'RSA') throw new GoogleAuthError('kid', 'ID token key is unknown.');
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const ok = verifySignature('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new GoogleAuthError('signature', 'ID token signature is invalid.');

  const now = Math.floor((expected.now ?? Date.now()) / 1000);
  if (typeof claims.iss !== 'string' || !ISSUERS.has(claims.iss)) throw new GoogleAuthError('iss', 'ID token issuer is wrong.');
  const aud = claims.aud;
  const audOk = aud === expected.clientId || (Array.isArray(aud) && aud.includes(expected.clientId) && claims.azp === expected.clientId);
  if (!audOk) throw new GoogleAuthError('aud', 'ID token audience is wrong.');
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) throw new GoogleAuthError('exp', 'ID token has expired.');
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > now) throw new GoogleAuthError('iat', 'ID token is issued in the future.');
  if (typeof claims.nonce !== 'string' || claims.nonce !== expected.nonce) throw new GoogleAuthError('nonce', 'ID token nonce does not match.');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new GoogleAuthError('sub', 'ID token has no subject.');
  if (typeof claims.email !== 'string' || !(claims.email_verified === true || claims.email_verified === 'true')) {
    throw new GoogleAuthError('email_unverified', 'Google account email is not verified.');
  }
  return {
    sub: claims.sub, email: claims.email.toLowerCase(), emailVerified: true,
    name: typeof claims.name === 'string' ? claims.name.slice(0, 120) : null,
    picture: typeof claims.picture === 'string' ? claims.picture : null,
  };
}
