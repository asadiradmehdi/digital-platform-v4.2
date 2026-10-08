// SMS configuration: platform_settings row 'sms.melipayamak' (edited later from the admin app; the API key
// and inbound secret are encrypted at rest) with environment-variable fallback for each field.
import { getPlatformSetting, setPlatformSetting } from '../../core/platform-settings';
import { allowConsoleSmsProvider, ConsoleSmsProvider } from './console';
import { MelipayamakSmsProvider } from './melipayamak';
import type { SmsProvider, SmsTemplate } from './types';

export const SMS_SETTINGS_KEY = 'sms.melipayamak';
const TEMPLATES: SmsTemplate[] = ['otp', 'order_registered', 'order_completed', 'payment_receipt', 'status_reply'];
const ENV_PATTERN: Record<SmsTemplate, string> = {
  otp: 'MELIPAYAMAK_PATTERN_OTP',
  order_registered: 'MELIPAYAMAK_PATTERN_ORDER_REGISTERED',
  order_completed: 'MELIPAYAMAK_PATTERN_ORDER_COMPLETED',
  payment_receipt: 'MELIPAYAMAK_PATTERN_PAYMENT_RECEIPT',
  status_reply: 'MELIPAYAMAK_PATTERN_STATUS_REPLY',
};

export type SmsSettingsValue = {
  provider?: 'melipayamak' | 'console';
  patterns?: Partial<Record<SmsTemplate, string>>;
  /** Inbound «استعلام وضعیت» webhook; off until the admin enables it AND sets a secret. */
  inbound?: { enabled?: boolean; fromField?: string; textField?: string; idField?: string };
};
export type SmsSettingsSecret = { apiKey?: string; inboundSecret?: string };

export type ResolvedSmsConfig = {
  provider: 'melipayamak' | 'console' | 'none';
  apiKey: string | null;
  patterns: Partial<Record<SmsTemplate, string>>;
  inbound: { enabled: boolean; secret: string | null; fromField: string; textField: string; idField: string };
};

export async function loadSmsConfig(env: NodeJS.ProcessEnv = process.env): Promise<ResolvedSmsConfig> {
  const stored = await getPlatformSetting<SmsSettingsValue, SmsSettingsSecret>(SMS_SETTINGS_KEY);
  const value = stored.value ?? {};
  const apiKey = stored.secret?.apiKey || env.MELIPAYAMAK_API_KEY || null;
  const patterns: Partial<Record<SmsTemplate, string>> = {};
  for (const t of TEMPLATES) {
    const id = value.patterns?.[t] || env[ENV_PATTERN[t]];
    if (id && /^\d{1,12}$/.test(String(id))) patterns[t] = String(id);
  }
  const wanted = (env.SMS_PROVIDER as ResolvedSmsConfig['provider'] | undefined) || value.provider;
  let provider: ResolvedSmsConfig['provider'] = 'none';
  if (wanted === 'console') provider = allowConsoleSmsProvider(env) ? 'console' : 'none';
  else if (apiKey && patterns.otp) provider = 'melipayamak';
  else if (!wanted && allowConsoleSmsProvider(env) && env.NODE_ENV !== 'production') provider = 'console';
  const inboundSecret = stored.secret?.inboundSecret || env.SMS_INBOUND_SECRET || null;
  const inboundEnabled = (value.inbound?.enabled ?? env.SMS_INBOUND_ENABLED === 'true') && Boolean(inboundSecret && inboundSecret.length >= 24);
  return {
    provider, apiKey, patterns,
    inbound: {
      enabled: inboundEnabled, secret: inboundSecret,
      fromField: value.inbound?.fromField || env.SMS_INBOUND_FROM_FIELD || 'from',
      textField: value.inbound?.textField || env.SMS_INBOUND_TEXT_FIELD || 'text',
      idField: value.inbound?.idField || env.SMS_INBOUND_ID_FIELD || 'id',
    },
  };
}

export function providerFor(config: ResolvedSmsConfig): SmsProvider | null {
  if (config.provider === 'console') return new ConsoleSmsProvider();
  if (config.provider === 'melipayamak' && config.apiKey && config.patterns.otp) {
    return new MelipayamakSmsProvider({ apiKey: config.apiKey, otpPatternId: config.patterns.otp });
  }
  return null;
}

export async function getSmsProvider() {
  const config = await loadSmsConfig();
  return { config, provider: providerFor(config) };
}

/**
 * For the future admin app: store Melipayamak settings. Pass `secret` only when changing the API key or
 * inbound secret (undefined keeps them). Callers must have checked platform-admin + step-up first.
 */
export async function saveSmsSettings(value: SmsSettingsValue, secret: SmsSettingsSecret | undefined, actorUserId: string) {
  for (const id of Object.values(value.patterns ?? {})) {
    if (id && !/^\d{1,12}$/.test(id)) throw new Error('Pattern ids are numeric (BodyId from the Melipayamak panel).');
  }
  if (secret?.inboundSecret && secret.inboundSecret.length < 24) throw new Error('Inbound secret must be at least 24 characters.');
  // Changing one secret keeps the other; an empty string clears a field.
  const merged = secret === undefined ? undefined
    : { ...((await getPlatformSetting<SmsSettingsValue, SmsSettingsSecret>(SMS_SETTINGS_KEY)).secret ?? {}), ...secret };
  await setPlatformSetting(SMS_SETTINGS_KEY, { value, secret: merged }, actorUserId);
}
