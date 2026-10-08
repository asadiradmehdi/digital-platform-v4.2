import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildAuthorizationUrl, pkceChallenge, verifyGoogleIdToken, GoogleAuthError } from '../../server/identity/google/oidc';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const keys = async () => [jwk];
const CLIENT = '123-abc.apps.googleusercontent.com';
const NOW = 1_800_000_000_000;

function token(claims: Record<string, unknown>, opts: { kid?: string; alg?: string; key?: typeof privateKey } = {}) {
  const h = Buffer.from(JSON.stringify({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'k1', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const s = sign('RSA-SHA256', Buffer.from(`${h}.${p}`), opts.key ?? privateKey).toString('base64url');
  return `${h}.${p}.${s}`;
}
const good = {
  iss: 'https://accounts.google.com', aud: CLIENT, sub: '1100', email: 'Ali@Example.com', email_verified: true,
  name: 'علی', nonce: 'n-1', iat: NOW / 1000 - 10, exp: NOW / 1000 + 3600,
};
const verify = (t: string, nonce = 'n-1') => verifyGoogleIdToken(t, { clientId: CLIENT, nonce, now: NOW }, keys);
const reason = async (p: Promise<unknown>) => ((await p.catch(e => e)) as GoogleAuthError).reason;

describe('Google ID token verification', () => {
  it('accepts a correctly signed token and lower-cases the email', async () => {
    const id = await verify(token(good));
    expect(id).toMatchObject({ sub: '1100', email: 'ali@example.com', emailVerified: true, name: 'علی' });
  });
  it('rejects a token signed by another key', async () => { expect(await reason(verify(token(good, { key: other.privateKey })))).toBe('signature'); });
  it('rejects a tampered payload', async () => {
    const [h, , s] = token(good).split('.');
    const forged = Buffer.from(JSON.stringify({ ...good, email: 'victim@example.com' })).toString('base64url');
    expect(await reason(verify(`${h}.${forged}.${s}`))).toBe('signature');
  });
  it('rejects alg none / HS256 / unknown kid', async () => {
    expect(await reason(verify(token(good, { alg: 'HS256' })))).toBe('alg');
    expect(await reason(verify(token(good, { kid: 'nope' })))).toBe('kid');
  });
  it('checks issuer, audience, expiry, nonce and email_verified', async () => {
    expect(await reason(verify(token({ ...good, iss: 'https://evil.example' })))).toBe('iss');
    expect(await reason(verify(token({ ...good, aud: 'other.apps.googleusercontent.com' })))).toBe('aud');
    expect(await reason(verify(token({ ...good, exp: NOW / 1000 - 3600 })))).toBe('exp');
    expect(await reason(verify(token(good), 'different-nonce'))).toBe('nonce');
    expect(await reason(verify(token({ ...good, email_verified: false })))).toBe('email_unverified');
  });
});

describe('authorization URL', () => {
  it('uses code flow with S256 PKCE, state and nonce', () => {
    const u = new URL(buildAuthorizationUrl({ clientId: CLIENT, redirectUri: 'https://zohalpay.ir/api/v1/auth/google/callback', state: 's', nonce: 'n', codeVerifier: 'v'.repeat(43) }));
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('code_challenge')).toBe(pkceChallenge('v'.repeat(43)));
    expect(u.searchParams.get('state')).toBe('s');
    expect(u.searchParams.get('nonce')).toBe('n');
    expect(u.searchParams.get('scope')).toBe('openid email profile');
  });
});
