// «اتصال‌ها و تنظیمات»: integration settings editable from the admin console without a redeploy.
// Secrets (API keys, client secret, merchant id) are AES-256-GCM encrypted by platform-settings and are
// NEVER returned: the overview exposes only {set, last4, source}. Every change is audited (keys only, never values).
import { withUserTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { getPlatformSetting, setPlatformSetting } from '../core/platform-settings';
import { requireAnyPermission, requirePermission } from './access';
import { enforceStepUpPolicy } from '../identity/step-up';
import { GOOGLE_SETTINGS_KEY } from '../identity/google/config';
import { SMS_SETTINGS_KEY, type SmsSettingsSecret, type SmsSettingsValue } from '../notifications/sms/config';
import { LICENSES_SETTINGS_KEY, officialLicenseUrl, type LicenseUrls } from '../content/trust';
import { query } from '../core/db';
import { normalizeIranMobile } from '../../packages/api-contracts/src/phone';
import { getSmsProvider } from '../notifications/sms/config';
import { SmsProviderError } from '../notifications/sms/types';

export const GATEWAY_SETTINGS_KEY = 'payments.gateway';
export const GATEWAYS = ['zarinpal', 'zibal', 'idpay', 'nextpay'] as const;
export const SMS_PATTERN_KEYS = ['otp', 'order_registered', 'order_completed', 'payment_receipt', 'status_reply'] as const;

export type SecretView = { set: boolean; last4: string | null; source: 'panel' | 'env' | null };

/** Describes a secret without revealing it. Short secrets show no digits at all. */
export function secretView(stored: string | undefined | null, envValue?: string | null): SecretView {
  if (stored) return { set: true, last4: stored.length >= 12 ? stored.slice(-4) : null, source: 'panel' };
  if (envValue) return { set: true, last4: null, source: 'env' };
  return { set: false, last4: null, source: null };
}

export type SettingsOverview = {
  sms: { enabled: boolean; apiKey: SecretView; inboundSecret: SecretView; inboundEnabled: boolean; patterns: Record<string, string> };
  google: { enabled: boolean; clientId: string; clientSecret: SecretView };
  gateway: { gateway: string; enabled: boolean; merchantId: SecretView; adapterReady: boolean };
  invoice: { legalName: string; nationalId: string; economicCode: string; address: string; postalCode: string; phone: string; vatEnabled: boolean; vatPercent: number };
  licenses: { enamad: string; samandehi: string; union: string };
  support: { hours: string; contacts: Array<{ id: string; label: string; phone: string; active: boolean; sortOrder: number }> };
};

export async function getSettingsOverview(actorUserId: string, env: NodeJS.ProcessEnv = process.env): Promise<SettingsOverview> {
  await requireAnyPermission(actorUserId, ['settings.view', 'invoices.view', 'notifications.manage']);
  const [sms, google, gw, lic, inv, contacts, hours] = await Promise.all([
    getPlatformSetting<SmsSettingsValue, SmsSettingsSecret>(SMS_SETTINGS_KEY),
    getPlatformSetting<{ clientId?: string; enabled?: boolean }, { clientSecret?: string }>(GOOGLE_SETTINGS_KEY),
    getPlatformSetting<{ gateway?: string; enabled?: boolean }, { merchantId?: string }>(GATEWAY_SETTINGS_KEY),
    getPlatformSetting<LicenseUrls, never>(LICENSES_SETTINGS_KEY),
    query<{ seller_legal_name: string; seller_national_id: string; seller_economic_code: string; seller_address: string; seller_postal_code: string; seller_phone: string; vat_enabled: boolean; vat_rate_bps: number }>(
      `SELECT seller_legal_name,seller_national_id,seller_economic_code,seller_address,seller_postal_code,seller_phone,vat_enabled,vat_rate_bps FROM invoice_settings WHERE id=1`),
    query<{ id: string; label: string; phone: string; active: boolean; sort_order: number }>(`SELECT id,label,phone,active,sort_order FROM support_contacts ORDER BY sort_order, created_at LIMIT 20`),
    query<{ hours_text: string }>(`SELECT hours_text FROM support_settings WHERE id=1`),
  ]);
  const i = inv.rows[0];
  const patterns: Record<string, string> = {};
  for (const k of SMS_PATTERN_KEYS) if (sms.value?.patterns?.[k]) patterns[k] = String(sms.value.patterns[k]);
  return {
    sms: {
      enabled: Boolean(sms.secret?.apiKey || env.MELIPAYAMAK_API_KEY),
      apiKey: secretView(sms.secret?.apiKey, env.MELIPAYAMAK_API_KEY),
      inboundSecret: secretView(sms.secret?.inboundSecret, env.SMS_INBOUND_SECRET),
      inboundEnabled: Boolean(sms.value?.inbound?.enabled), patterns,
    },
    google: {
      enabled: google.value?.enabled !== false && Boolean(google.value?.clientId || env.GOOGLE_CLIENT_ID),
      clientId: google.value?.clientId ?? '', clientSecret: secretView(google.secret?.clientSecret, env.GOOGLE_CLIENT_SECRET),
    },
    gateway: {
      gateway: gw.value?.gateway ?? '', enabled: Boolean(gw.value?.enabled), merchantId: secretView(gw.secret?.merchantId),
      adapterReady: false, // no real gateway adapter is registered yet (server/payments/gateways.ts REAL_GATEWAYS)
    },
    invoice: {
      legalName: i?.seller_legal_name ?? '', nationalId: i?.seller_national_id ?? '', economicCode: i?.seller_economic_code ?? '',
      address: i?.seller_address ?? '', postalCode: i?.seller_postal_code ?? '', phone: i?.seller_phone ?? '',
      vatEnabled: Boolean(i?.vat_enabled), vatPercent: (i?.vat_rate_bps ?? 1000) / 100,
    },
    licenses: { enamad: lic.value?.enamad ?? '', samandehi: lic.value?.samandehi ?? '', union: lic.value?.union ?? '' },
    support: { hours: hours.rows[0]?.hours_text ?? '', contacts: contacts.rows.map(c => ({ id: c.id, label: c.label, phone: c.phone, active: c.active, sortOrder: c.sort_order })) },
  };
}

// ── input helpers ──────────────────────────────────────────────────────────────────────────────
const bad = (msg: string) => new AppError('VALIDATION_ERROR', msg);
const FA = '۰۱۲۳۴۵۶۷۸۹';
const latinDigits = (s: string) => s.replace(/[۰-۹]/g, d => String(FA.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
function text(v: unknown, label: string, max: number): string {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') throw bad(`${label} معتبر نیست.`);
  const t = v.replace(/\s+/g, ' ').trim();
  if (Array.from(t).length > max) throw bad(`${label} حداکثر ${max} حرف است.`);
  return t;
}
/** Optional secret: undefined/'' keeps the stored one, {clear:true} removes it. */
function secretInput(v: unknown, label: string, rx: RegExp, hint: string): string | null | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'object' && (v as { clear?: unknown }).clear === true) return null;
  if (typeof v !== 'string' || !rx.test(v.trim())) throw bad(`${label} معتبر نیست؛ ${hint}`);
  return v.trim();
}

export type ChangeContext = { actorUserId: string; stepUpEvidenceId?: string };

// ── SMS (ملی‌پیامک) ─────────────────────────────────────────────────────────────────────────────
export async function saveSms(ctx: ChangeContext, input: Record<string, unknown>) {
  await requirePermission(ctx.actorUserId, 'notifications.manage');
  const current = await getPlatformSetting<SmsSettingsValue, SmsSettingsSecret>(SMS_SETTINGS_KEY);
  const patterns: Record<string, string> = { ...(current.value?.patterns as Record<string, string> | undefined) };
  const given = (input.patterns ?? {}) as Record<string, unknown>;
  for (const k of SMS_PATTERN_KEYS) {
    if (!(k in given)) continue;
    const raw = latinDigits(text(given[k], 'شناسه‌ی الگو', 12));
    if (raw === '') delete patterns[k];
    else if (/^\d{1,12}$/.test(raw)) patterns[k] = raw;
    else throw bad('شناسه‌ی الگو (BodyId) فقط عدد است.');
  }
  const apiKey = secretInput(input.apiKey, 'کلید API', /^[\x21-\x7e]{8,200}$/, 'کلید را همان‌طور که در پنل ملی‌پیامک است وارد کنید.');
  const inboundSecret = secretInput(input.inboundSecret, 'رمز دریافت پیامک', /^[\x21-\x7e]{24,200}$/, 'حداقل ۲۴ نویسه.');
  const inboundEnabled = typeof input.inboundEnabled === 'boolean' ? input.inboundEnabled : current.value?.inbound?.enabled ?? false;
  const secret: SmsSettingsSecret | undefined = apiKey === undefined && inboundSecret === undefined ? undefined : {
    ...(current.secret ?? {}),
    ...(apiKey === undefined ? {} : { apiKey: apiKey ?? '' }),
    ...(inboundSecret === undefined ? {} : { inboundSecret: inboundSecret ?? '' }),
  };
  await guardCredentialChange(ctx, secret !== undefined);
  await setPlatformSetting(SMS_SETTINGS_KEY, {
    value: { ...(current.value ?? {}), provider: 'melipayamak', patterns, inbound: { ...(current.value?.inbound ?? {}), enabled: inboundEnabled } },
    secret,
  }, ctx.actorUserId);
}

/** Sends one real verification-pattern SMS to `phone` so the owner can prove the panel works right after saving. */
export async function sendSmsTest(ctx: ChangeContext, phone: unknown) {
  await requirePermission(ctx.actorUserId, 'notifications.manage');
  const to = normalizeIranMobile(phone);
  if (!to) throw bad('شماره موبایل معتبر نیست؛ مثل 09123456789 وارد کنید.');
  const { provider } = await getSmsProvider();
  if (!provider || provider.name === 'console') throw bad('پیامک هنوز کامل تنظیم نشده؛ کلید API و شناسه‌ی الگوی کد ورود را ذخیره کنید.');
  try {
    await provider.sendOtp(to, String(Math.floor(10000 + Math.random() * 90000)));
  } catch (e) {
    if (e instanceof SmsProviderError) throw bad(e.kind === 'unavailable' ? 'اتصال به پنل پیامک برقرار نشد؛ چند لحظه بعد دوباره امتحان کنید.' : 'پنل پیامک پیام را نپذیرفت؛ کلید API، شناسه‌ی الگو و اعتبار پنل را بررسی کنید.');
    throw e;
  }
  await writeAudit({ actorUserId: ctx.actorUserId, action: 'admin.sms.test', entityType: 'platform_setting', metadata: { provider: provider.name } });
}

// ── Google sign-in ─────────────────────────────────────────────────────────────────────────────
export async function saveGoogle(ctx: ChangeContext, input: Record<string, unknown>) {
  await requirePermission(ctx.actorUserId, 'settings.edit');
  const current = await getPlatformSetting<{ clientId?: string; enabled?: boolean }, { clientSecret?: string }>(GOOGLE_SETTINGS_KEY);
  const clientId = input.clientId === undefined ? current.value?.clientId ?? '' : text(input.clientId, 'شناسه‌ی کلاینت', 200);
  if (clientId && !/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw bad('شناسه‌ی کلاینت باید به «.apps.googleusercontent.com» ختم شود.');
  const clientSecret = secretInput(input.clientSecret, 'رمز کلاینت', /^[\x21-\x7e]{8,200}$/, 'همان رمز نمایش‌داده‌شده در کنسول گوگل.');
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : current.value?.enabled ?? true;
  if (enabled && !clientId) throw bad('برای فعال کردن ورود با گوگل، شناسه‌ی کلاینت را وارد کنید.');
  await guardCredentialChange(ctx, clientSecret !== undefined);
  await setPlatformSetting(GOOGLE_SETTINGS_KEY, {
    value: { clientId, enabled },
    secret: clientSecret === undefined ? undefined : clientSecret === null ? null : { clientSecret },
  }, ctx.actorUserId);
}

// ── Payment gateway ────────────────────────────────────────────────────────────────────────────
export async function saveGateway(ctx: ChangeContext, input: Record<string, unknown>) {
  await requirePermission(ctx.actorUserId, 'settings.edit');
  const current = await getPlatformSetting<{ gateway?: string; enabled?: boolean }, { merchantId?: string }>(GATEWAY_SETTINGS_KEY);
  const gateway = input.gateway === undefined ? current.value?.gateway ?? '' : text(input.gateway, 'درگاه', 20);
  if (gateway && !(GATEWAYS as readonly string[]).includes(gateway)) throw bad('درگاه انتخاب‌شده پشتیبانی نمی‌شود.');
  const merchantId = secretInput(input.merchantId, 'مرچنت‌کد', /^[A-Za-z0-9-]{8,64}$/, 'فقط حروف انگلیسی، عدد و خط تیره (۸ تا ۶۴ نویسه).');
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : current.value?.enabled ?? false;
  const hasMerchant = merchantId === undefined ? Boolean(current.secret?.merchantId) : merchantId !== null;
  if (enabled && (!gateway || !hasMerchant)) throw bad('برای فعال کردن درگاه، نام درگاه و مرچنت‌کد را ثبت کنید.');
  await guardCredentialChange(ctx, merchantId !== undefined);
  await setPlatformSetting(GATEWAY_SETTINGS_KEY, {
    value: { gateway, enabled },
    secret: merchantId === undefined ? undefined : merchantId === null ? null : { merchantId },
  }, ctx.actorUserId);
}

// ── Licences (eNamad / Samandehi) ──────────────────────────────────────────────────────────────
export async function saveLicenses(ctx: ChangeContext, input: Record<string, unknown>) {
  await requirePermission(ctx.actorUserId, 'settings.edit');
  const current = (await getPlatformSetting<LicenseUrls, never>(LICENSES_SETTINGS_KEY)).value ?? {};
  const next: LicenseUrls = { ...current };
  const names = { enamad: 'لینک اینماد', samandehi: 'لینک ساماندهی', union: 'لینک اتحادیه' } as const;
  for (const key of ['enamad', 'samandehi', 'union'] as const) {
    if (!(key in input)) continue;
    const raw = text(input[key], names[key], 300);
    if (raw === '') { delete next[key]; continue; }
    const ok = officialLicenseUrl(key, raw);
    if (!ok) throw bad(`${names[key]} باید یک نشانی https از سایت رسمی صادرکننده باشد.`);
    next[key] = ok;
  }
  await setPlatformSetting(LICENSES_SETTINGS_KEY, { value: next }, ctx.actorUserId);
}

// ── Invoice seller + VAT ───────────────────────────────────────────────────────────────────────
export async function saveInvoice(ctx: ChangeContext, input: Record<string, unknown>) {
  await requirePermission(ctx.actorUserId, 'invoices.edit');
  const digits = (v: unknown, label: string, rx: RegExp, hint: string) => {
    const t = latinDigits(text(v, label, 20)).replace(/[\s-]/g, '');
    if (t !== '' && !rx.test(t)) throw bad(`${label} معتبر نیست؛ ${hint}`);
    return t;
  };
  const row = {
    legalName: text(input.legalName, 'نام حقوقی', 120),
    nationalId: digits(input.nationalId, 'شناسه‌ی ملی', /^\d{10,11}$/, '۱۰ یا ۱۱ رقم.'),
    economicCode: digits(input.economicCode, 'کد اقتصادی', /^\d{12,14}$/, '۱۲ تا ۱۴ رقم.'),
    address: text(input.address, 'نشانی', 300),
    postalCode: digits(input.postalCode, 'کد پستی', /^\d{10}$/, '۱۰ رقم.'),
    phone: text(input.phone, 'تلفن', 20),
  };
  const vatEnabled = input.vatEnabled === true;
  const pct = typeof input.vatPercent === 'number' ? input.vatPercent : Number(latinDigits(String(input.vatPercent ?? '10')));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw bad('نرخ مالیات باید بین ۰ و ۱۰۰ درصد باشد.');
  const vatRateBps = Math.round(pct * 100);
  if (vatEnabled && (!row.legalName || !row.economicCode)) throw bad('برای روشن کردن مالیات ارزش افزوده، اول نام حقوقی و کد اقتصادی فروشنده را ثبت کنید.');
  await withUserTransaction(ctx.actorUserId, async client => {
    const prev = await client.query<{ vat_enabled: boolean; vat_rate_bps: number }>(`SELECT vat_enabled, vat_rate_bps FROM invoice_settings WHERE id=1 FOR UPDATE`);
    await client.query(
      `INSERT INTO invoice_settings(id,seller_legal_name,seller_national_id,seller_economic_code,seller_address,seller_postal_code,seller_phone,vat_enabled,vat_rate_bps,updated_at,updated_by_user_id)
       VALUES(1,$1,$2,$3,$4,$5,$6,$7,$8,now(),$9)
       ON CONFLICT (id) DO UPDATE SET seller_legal_name=EXCLUDED.seller_legal_name, seller_national_id=EXCLUDED.seller_national_id,
         seller_economic_code=EXCLUDED.seller_economic_code, seller_address=EXCLUDED.seller_address, seller_postal_code=EXCLUDED.seller_postal_code,
         seller_phone=EXCLUDED.seller_phone, vat_enabled=EXCLUDED.vat_enabled, vat_rate_bps=EXCLUDED.vat_rate_bps, updated_at=now(), updated_by_user_id=EXCLUDED.updated_by_user_id`,
      [row.legalName, row.nationalId, row.economicCode, row.address, row.postalCode, row.phone, vatEnabled, vatRateBps, ctx.actorUserId]);
    await writeAudit({ actorUserId: ctx.actorUserId, action: 'admin.settings.invoice', entityType: 'invoice_settings',
      metadata: { vatFrom: prev.rows[0] ? { enabled: prev.rows[0].vat_enabled, bps: prev.rows[0].vat_rate_bps } : null, vatTo: { enabled: vatEnabled, bps: vatRateBps }, fields: Object.keys(row) } }, client);
  });
}

// ── Support phone numbers and hours (tables support_contacts / support_settings) ────────────────
export { setSupportHours, upsertSupportContact } from '../content/trust';

/** Credential changes need recent step-up when the SECURITY_SETTINGS_CHANGE policy is active (no-op while inactive). */
async function guardCredentialChange(ctx: ChangeContext, changesSecret: boolean) {
  if (!changesSecret) return;
  await enforceStepUpPolicy(ctx.actorUserId, 'SECURITY_SETTINGS_CHANGE', ctx.stepUpEvidenceId);
}
