// Owner settings that are not integrations: site switches, referral programme, loyalty tier thresholds.
// Every save writes one audit row with before and after (no secrets are involved here).
import { query, withUserTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { getPlatformSetting, setPlatformSetting } from '../core/platform-settings';
import { DEFAULT_MAINTENANCE_MESSAGE, SITE_SWITCHES_KEY, getSiteSwitches, type SiteSwitches } from '../core/site-switches';
import { TIER_SETTINGS_KEY, getTierLadder } from '../loyalty/tier-ladder';
import { ladderFromThresholds, validateThresholds } from '../../lib/tier-ladder';
import { TIERS } from '../../lib/tiers';
import { requirePermission } from './access';

const bad = (m: string) => new AppError('VALIDATION_ERROR', m);
const int = (v: unknown, label: string, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : NaN;
  if (!Number.isSafeInteger(n) || n < min || n > max) throw bad(`${label} باید عدد صحیح بین ${min.toLocaleString('fa-IR')} و ${max.toLocaleString('fa-IR')} باشد.`);
  return n;
};
/** Percent with up to 2 decimals -> basis points. */
const pctToBps = (v: unknown, label: string, max = 100): number => {
  const n = typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n) || n < 0 || n > max) throw bad(`${label} باید بین ۰ و ${max.toLocaleString('fa-IR')} درصد باشد.`);
  return Math.round(n * 100);
};

// ── site switches ───────────────────────────────────────────────────────────────────────────────
export async function getSiteAdmin(actorUserId: string): Promise<SiteSwitches> {
  await requirePermission(actorUserId, 'settings.view');
  return getSiteSwitches();
}
export async function saveSite(actorUserId: string, input: Record<string, unknown>) {
  await requirePermission(actorUserId, 'settings.edit');
  const cur = await getSiteSwitches();
  const next: SiteSwitches = {
    maintenance: typeof input.maintenance === 'boolean' ? input.maintenance : cur.maintenance,
    signupsOpen: typeof input.signupsOpen === 'boolean' ? input.signupsOpen : cur.signupsOpen,
    maintenanceMessage: typeof input.maintenanceMessage === 'string' ? input.maintenanceMessage.replace(/\s+/g, ' ').trim().slice(0, 200) || DEFAULT_MAINTENANCE_MESSAGE : cur.maintenanceMessage,
  };
  await setPlatformSetting(SITE_SWITCHES_KEY, { value: next }, actorUserId);
  await withUserTransaction(actorUserId, c => writeAudit({ actorUserId, action: 'admin.settings.site', entityType: 'platform_setting', metadata: { from: cur, to: next } }, c));
  return next;
}

// ── referral programme ──────────────────────────────────────────────────────────────────────────
export type ReferralAdmin = {
  enabled: boolean; tiers: { minActive: number; percent: number }[]; welcomePercent: number; welcomeCapToman: number; holdDays: number;
  attributionMonths: number; monthlyCapToman: number; maxSignupsPerIp: number; programmeBudgetToman: number;
};
const IRR = 10n;

export async function getReferralAdmin(actorUserId: string): Promise<ReferralAdmin> {
  await requirePermission(actorUserId, 'settings.view');
  const r = (await query<{ enabled: boolean; tiers: { minActive: number; bps: number }[]; welcome_bps: number; welcome_cap_minor: string; hold_days: number; attribution_months: number; monthly_cap_minor: string; max_signups_per_ip: number; budget: string }>(
    `SELECT enabled, tiers, welcome_bps, welcome_cap_minor::text, hold_days, attribution_months, monthly_cap_minor::text, max_signups_per_ip, programme_monthly_budget_minor::text AS budget FROM referral_settings WHERE id=1`)).rows[0];
  if (!r) throw new AppError('NOT_FOUND', 'تنظیمات معرفی دوستان پیدا نشد.');
  const toman = (m: string) => Number(BigInt(m) / IRR);
  return {
    enabled: r.enabled, tiers: (Array.isArray(r.tiers) ? r.tiers : []).map(t => ({ minActive: Number(t.minActive), percent: Number(t.bps) / 100 })),
    welcomePercent: r.welcome_bps / 100, welcomeCapToman: toman(r.welcome_cap_minor), holdDays: r.hold_days, attributionMonths: r.attribution_months,
    monthlyCapToman: toman(r.monthly_cap_minor), maxSignupsPerIp: r.max_signups_per_ip, programmeBudgetToman: toman(r.budget),
  };
}

export function parseReferralTiers(v: unknown): { minActive: number; bps: number }[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 8) throw bad('حداقل یک و حداکثر ۸ پله لازم است.');
  const tiers = v.map((t, i) => {
    const o = (t ?? {}) as Record<string, unknown>;
    return { minActive: int(o.minActive, `تعداد دوستِ پله‌ی ${i + 1}`, 0, 100000), bps: pctToBps(o.percent, `درصد پله‌ی ${i + 1}`, 50) };
  });
  if (tiers[0].minActive !== 0) throw bad('پله‌ی اول باید از صفر دوست شروع شود.');
  for (let i = 1; i < tiers.length; i++) if (tiers[i].minActive <= tiers[i - 1].minActive) throw bad('تعداد دوست‌ها در پله‌ها باید پیوسته زیاد شود.');
  return tiers;
}

export async function saveReferral(actorUserId: string, input: Record<string, unknown>) {
  await requirePermission(actorUserId, 'settings.edit');
  const before = await getReferralAdmin(actorUserId);
  const tiers = input.tiers === undefined ? before.tiers.map(t => ({ minActive: t.minActive, bps: Math.round(t.percent * 100) })) : parseReferralTiers(input.tiers);
  const row = {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : before.enabled,
    welcomeBps: input.welcomePercent === undefined ? Math.round(before.welcomePercent * 100) : pctToBps(input.welcomePercent, 'درصد هدیه‌ی خوش‌آمد', 50),
    welcomeCap: BigInt(input.welcomeCapToman === undefined ? before.welcomeCapToman : int(input.welcomeCapToman, 'سقف هدیه‌ی خوش‌آمد', 0, 100_000_000)) * IRR,
    holdDays: input.holdDays === undefined ? before.holdDays : int(input.holdDays, 'مدت نگه‌داری پاداش', 0, 90),
    attributionMonths: input.attributionMonths === undefined ? before.attributionMonths : int(input.attributionMonths, 'مدت اعتبار معرفی', 1, 120),
    monthlyCap: BigInt(input.monthlyCapToman === undefined ? before.monthlyCapToman : int(input.monthlyCapToman, 'سقف ماهانه‌ی هر نفر', 0, 10_000_000_000)) * IRR,
    maxIp: input.maxSignupsPerIp === undefined ? before.maxSignupsPerIp : int(input.maxSignupsPerIp, 'حداکثر ثبت‌نام از یک شبکه', 1, 1000),
    budget: BigInt(input.programmeBudgetToman === undefined ? before.programmeBudgetToman : int(input.programmeBudgetToman, 'بودجه‌ی ماهانه‌ی برنامه', 0, 100_000_000_000)) * IRR,
  };
  await withUserTransaction(actorUserId, async c => {
    await c.query(
      `UPDATE referral_settings SET enabled=$1, tiers=$2::jsonb, welcome_bps=$3, welcome_cap_minor=$4, hold_days=$5, attribution_months=$6,
         monthly_cap_minor=$7, max_signups_per_ip=$8, programme_monthly_budget_minor=$9, updated_at=now(), updated_by_user_id=$10 WHERE id=1`,
      [row.enabled, JSON.stringify(tiers), row.welcomeBps, row.welcomeCap.toString(), row.holdDays, row.attributionMonths, row.monthlyCap.toString(), row.maxIp, row.budget.toString(), actorUserId]);
    await writeAudit({ actorUserId, action: 'admin.settings.referral', entityType: 'referral_settings', metadata: { from: before, to: { ...row, tiers, welcomeCap: Number(row.welcomeCap / IRR), monthlyCap: Number(row.monthlyCap / IRR), budget: Number(row.budget / IRR) } } }, c);
  });
  return { saved: true };
}

// ── loyalty ladder ──────────────────────────────────────────────────────────────────────────────
export async function getLoyaltyAdmin(actorUserId: string) {
  await requirePermission(actorUserId, 'settings.view');
  const s = await getPlatformSetting<{ thresholds?: number[] }, never>(TIER_SETTINGS_KEY);
  return { ladder: await getTierLadder(), customised: Array.isArray(s.value?.thresholds), defaults: TIERS.map(t => ({ ...t })) };
}
export async function saveLoyalty(actorUserId: string, input: Record<string, unknown>) {
  await requirePermission(actorUserId, 'settings.edit');
  const reset = input.reset === true;
  const mins = reset ? TIERS.map(t => t.minToman) : Array.isArray(input.thresholds) ? input.thresholds.map(Number) : null;
  if (!mins) throw bad('مبلغ سطح‌ها ارسال نشده است.');
  const err = validateThresholds(mins);
  if (err) throw bad(err);
  const before = (await getTierLadder()).map(t => t.minToman);
  await setPlatformSetting(TIER_SETTINGS_KEY, { value: { thresholds: mins } }, actorUserId);
  await withUserTransaction(actorUserId, c => writeAudit({ actorUserId, action: 'admin.settings.loyalty', entityType: 'platform_setting', metadata: { from: before, to: mins, reset } }, c));
  return { ladder: ladderFromThresholds(mins) };
}
