// Google sign-in configuration: platform_settings 'auth.google' (client id as value, client secret encrypted)
// with GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET as fallback. Sign-in with Google stays hidden until both exist.
import { getPlatformSetting, setPlatformSetting } from '../../core/platform-settings';

export const GOOGLE_SETTINGS_KEY = 'auth.google';
export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string; mobileScheme: string };

export function siteUrl(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return null;
  try { return new URL(raw).origin; } catch { return null; }
}

export function mobileScheme(env: NodeJS.ProcessEnv = process.env) {
  const s = env.MOBILE_APP_SCHEME || 'digitalplatform';
  return /^[a-z][a-z0-9+.-]{2,40}$/.test(s) ? s : 'digitalplatform';
}

export async function loadGoogleConfig(env: NodeJS.ProcessEnv = process.env): Promise<GoogleConfig | null> {
  const stored = await getPlatformSetting<{ clientId?: string; enabled?: boolean }, { clientSecret?: string }>(GOOGLE_SETTINGS_KEY);
  if (stored.value?.enabled === false) return null;
  const clientId = stored.value?.clientId || env.GOOGLE_CLIENT_ID || '';
  const clientSecret = stored.secret?.clientSecret || env.GOOGLE_CLIENT_SECRET || '';
  const site = siteUrl(env);
  if (!clientId || !clientSecret || !site || !/\.apps\.googleusercontent\.com$/.test(clientId)) return null;
  return { clientId, clientSecret, redirectUri: `${site}/api/v1/auth/google/callback`, mobileScheme: mobileScheme(env) };
}

/** For the future admin app (after its platform-admin + step-up checks). */
export async function saveGoogleSettings(input: { clientId: string; enabled?: boolean; clientSecret?: string }, actorUserId: string) {
  if (!/\.apps\.googleusercontent\.com$/.test(input.clientId)) throw new Error('Client id must end with .apps.googleusercontent.com');
  await setPlatformSetting(GOOGLE_SETTINGS_KEY, {
    value: { clientId: input.clientId, enabled: input.enabled ?? true },
    secret: input.clientSecret === undefined ? undefined : { clientSecret: input.clientSecret },
  }, actorUserId);
}
