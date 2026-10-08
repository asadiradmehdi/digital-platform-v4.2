// Google sign-in for the app. The browser runs the server's own OAuth flow (state, nonce and PKCE stay on
// the server); the server deep-links back with a one-time handoff code that is only redeemable together
// with the verifier this install generated — a hijacked deep link alone cannot sign anyone in.
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { siteUrl } from '../api/app';
import type { SignInResult } from './AuthProvider';

const VERIFIER_KEY = 'dp.google.verifier.v1';
export const GOOGLE_RETURN_URL = 'digitalplatform://auth/google';

const GOOGLE_ERRORS: Record<string, string> = {
  google_unavailable: 'ورود با گوگل فعلاً در دسترس نیست.',
  google_cancelled: 'ورود با گوگل لغو شد.',
  google_email_unverified: 'ایمیل این حساب گوگل تأیید نشده است.',
};
export const googleErrorText = (code: string | null | undefined) =>
  (code && GOOGLE_ERRORS[code]) || 'ورود با گوگل کامل نشد. دوباره تلاش کنید.';

const toBase64Url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Opens Google in an auth session and returns the deep link it ended on (null when the user closed it). */
export async function openGoogleSignIn(): Promise<string | null> {
  // 64 hex chars from two v4 UUIDs (CSPRNG-backed), within RFC 7636's 43–128 verifier length.
  const verifier = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, '');
  const challenge = toBase64Url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  // Kept in the OS secure store so the deep-link route can finish even if the app was restarted meanwhile.
  await SecureStore.setItemAsync(VERIFIER_KEY, verifier, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  const url = siteUrl(`/api/v1/auth/google/start?client=mobile&app_challenge=${encodeURIComponent(challenge)}`);
  const result = await WebBrowser.openAuthSessionAsync(url, GOOGLE_RETURN_URL);
  return result.type === 'success' ? result.url : null;
}

export function parseGoogleReturn(url: string): { handoff: string | null; error: string | null } {
  const query = url.split('#')[0].split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  return { handoff: params.get('handoff'), error: params.get('error') };
}

// The same deep link can reach both the auth session and the router (Android); redeem it once.
const pending = new Map<string, Promise<SignInResult>>();

export function redeemGoogleHandoff(handoff: string, exchange: (handoff: string, verifier: string) => Promise<SignInResult>): Promise<SignInResult> {
  const existing = pending.get(handoff);
  if (existing) return existing;
  const run = (async () => {
    const verifier = await SecureStore.getItemAsync(VERIFIER_KEY);
    if (!verifier) throw new Error(googleErrorText(null));
    try { return await exchange(handoff, verifier); } finally { await SecureStore.deleteItemAsync(VERIFIER_KEY); }
  })();
  pending.set(handoff, run);
  return run;
}
