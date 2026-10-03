import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { apiFetch, clearAccessToken, getAccessToken, setAccessToken } from '../api/client';

type AuthContextValue = { ready: boolean; authenticated: boolean; signIn: (identifier: string, password: string) => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
const DEVICE_KEY = 'dp.device.id.v1';

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => { getAccessToken().then((token) => { setAuthenticated(Boolean(token)); setReady(true); }); }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ready,
    authenticated,
    async signIn(identifier: string, password: string) {
      let deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
      if (!deviceId) { deviceId = Crypto.randomUUID(); await SecureStore.setItemAsync(DEVICE_KEY, deviceId, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); }
      const result = await apiFetch<{ ok: true; accessToken: string; tokenType: 'Bearer' }>('/api/v1/auth/mobile/session', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID', deviceId, deviceName: 'Digital Platform Mobile' }),
      });
      await setAccessToken(result.accessToken);
      setAuthenticated(true);
    },
    async signOut() {
      try { await apiFetch('/api/v1/auth/mobile/logout', { method: 'POST' }); } finally { await clearAccessToken(); setAuthenticated(false); }
    },
  }), [ready, authenticated]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is required'); return value; }
