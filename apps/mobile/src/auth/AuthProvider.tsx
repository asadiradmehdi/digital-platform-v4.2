import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { OtpRequestResponse } from '@digital-platform/api-contracts';
import { apiFetch, clearAccessToken, getAccessToken, setAccessToken } from '../api/client';

/** What a sign-in step returns: signed in, or a second factor is needed (TOTP enabled on the account). */
export type SignInResult = { kind: 'done'; created: boolean } | { kind: 'mfa'; challengeToken: string };
type SessionReply = { ok: true; accessToken?: string; tokenType?: 'Bearer'; created?: boolean; mfaRequired?: boolean; challengeToken?: string };

type AuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  signIn: (identifier: string, password: string) => Promise<SignInResult>;
  requestOtp: (phone: string) => Promise<OtpRequestResponse>;
  verifyOtp: (challengeId: string, code: string, referralCode?: string) => Promise<SignInResult>;
  completeMfa: (challengeToken: string, code: string) => Promise<SignInResult>;
  exchangeGoogleHandoff: (handoff: string, verifier: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
const DEVICE_KEY = 'dp.device.id.v1';

/** Pseudonymous install id (server stores only its hash) + platform, sent with every app sign-in. */
async function device() {
  let deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!deviceId) { deviceId = Crypto.randomUUID(); await SecureStore.setItemAsync(DEVICE_KEY, deviceId, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); }
  return { platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID', deviceId, deviceName: Platform.OS === 'ios' ? 'اپ زُحل پی — iOS' : 'اپ زُحل پی — Android', platformVersion: String(Platform.Version) };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => { getAccessToken().then((token) => { setAuthenticated(Boolean(token)); setReady(true); }); }, []);

  const value = useMemo<AuthContextValue>(() => {
    // Session tokens go only to the OS secure store (Keychain / Keystore), never to plain storage.
    const finish = async (r: SessionReply): Promise<SignInResult> => {
      if (r.mfaRequired && r.challengeToken) return { kind: 'mfa', challengeToken: r.challengeToken };
      if (!r.accessToken) throw new Error('ورود انجام نشد. دوباره تلاش کنید.');
      await setAccessToken(r.accessToken);
      setAuthenticated(true);
      return { kind: 'done', created: Boolean(r.created) };
    };
    const post = async (path: string, body: Record<string, unknown>) =>
      apiFetch<SessionReply>(path, { method: 'POST', body: JSON.stringify({ ...body, ...(await device()) }) });
    return {
      ready,
      authenticated,
      signIn: async (identifier, password) => finish(await post('/api/v1/auth/mobile/session', { identifier, password })),
      requestOtp: phone => apiFetch<OtpRequestResponse>('/api/v1/auth/mobile/otp/request', { method: 'POST', body: JSON.stringify({ phone }) }),
      verifyOtp: async (challengeId, code, referralCode) => finish(await post('/api/v1/auth/mobile/otp/verify', { challengeId, code, referralCode })),
      completeMfa: async (challengeToken, code) => finish(await post('/api/v1/auth/mobile/mfa', { challengeToken, code })),
      exchangeGoogleHandoff: async (handoff, verifier) => finish(await post('/api/v1/auth/google/mobile/exchange', { handoff, verifier })),
      async signOut() {
        try { await apiFetch('/api/v1/auth/mobile/logout', { method: 'POST' }); } finally { await clearAccessToken(); setAuthenticated(false); }
      },
    };
  }, [ready, authenticated]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is required'); return value; }
