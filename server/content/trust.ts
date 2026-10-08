// Licences (مجوزها) and public support contacts. Server-owned so web and the native app show the same thing.
// Support numbers and hours live in the database (admin-managed; env is only a fallback while empty). Licences come
// from the environment and are «فعال» only when their official verification link is configured.
import type { IconName } from '../../packages/design-tokens/src/icons';
import { query, withUserTransaction } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';

export type LicenseView = {
  key: 'enamad' | 'samandehi' | 'union';
  title: string; issuer: string; text: string; icon: IconName;
  status: 'active' | 'pending';
  /** Official verification page; only on hosts that belong to the issuer. */
  verifyUrl: string | null;
};

const LICENSES: Array<Omit<LicenseView, 'status' | 'verifyUrl'> & { env: string; hosts: string[] }> = [
  { key: 'enamad', title: 'نماد اعتماد الکترونیکی', issuer: 'مرکز توسعه تجارت الکترونیکی', icon: 'shield',
    text: 'اینماد نشان می‌دهد هویت و نشانی کسب‌وکار ما احراز شده و پاسخ‌گوی خرید شما هستیم.', env: 'LICENSE_ENAMAD_URL', hosts: ['trustseal.enamad.ir', 'enamad.ir'] },
  { key: 'samandehi', title: 'نشان ملی ثبت رسانه‌های دیجیتال', issuer: 'وزارت فرهنگ و ارشاد اسلامی (ساماندهی)', icon: 'cert',
    text: 'ثبت رسمی وب‌سایت زُحل پی در سامانه‌ی ساماندهی پایگاه‌های اینترنتی.', env: 'LICENSE_SAMANDEHI_URL', hosts: ['logo.samandehi.ir', 'samandehi.ir'] },
  { key: 'union', title: 'عضویت در اتحادیه کسب‌وکارهای مجازی', issuer: 'اتحادیه‌ی کشوری کسب‌وکارهای مجازی', icon: 'userCard',
    text: 'عضویت صنفی برای فعالیت قانونی فروش خدمات دیجیتال.', env: 'LICENSE_UNION_URL', hosts: ['ecunion.ir', 'www.ecunion.ir'] },
];

function officialUrl(raw: string | undefined, hosts: string[]): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && hosts.includes(u.hostname) ? u.toString() : null;
  } catch { return null; }
}

export function licensesView(env: Record<string, string | undefined> = process.env): LicenseView[] {
  return LICENSES.map(({ env: key, hosts, ...l }) => {
    const verifyUrl = officialUrl(env[key], hosts);
    return { ...l, status: verifyUrl ? 'active' : 'pending', verifyUrl };
  });
}

export type SupportPhone = { label: string; display: string; tel: string };

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/**
 * Validates and formats one Iranian landline/mobile number (+98…, 0098…, 0…; Persian digits accepted).
 * `tel` is the dialable E.164 form and `display` the grouped Persian-digit form. Invalid input → null.
 */
export function formatSupportPhone(label: string | undefined, raw: string | undefined): SupportPhone | null {
  const name = (label ?? '').trim();
  const digits = (raw ?? '').replace(/[\s()-]/g, '').replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)));
  const m = /^(?:\+98|0098|0)(\d{10})$/.exec(digits);
  if (!name || !m) return null;
  const local = `0${m[1]}`;
  const fa = (s: string) => s.replace(/\d/g, d => FA_DIGITS[Number(d)]);
  const grouped = local.startsWith('09') ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : `${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`;
  return { label: name.slice(0, 40), display: fa(grouped), tel: `+98${m[1]}` };
}

/** Env fallback: SUPPORT_PHONES="پشتیبانی فروش:02112345678;واتساپ و تلگرام:09121234567". */
export function supportPhones(env: Record<string, string | undefined> = process.env): SupportPhone[] {
  const out: SupportPhone[] = [];
  for (const part of (env.SUPPORT_PHONES ?? '').split(';')) {
    const [label, num] = part.split(':').map(s => s?.trim());
    const p = formatSupportPhone(label, num);
    if (p) out.push(p);
  }
  return out.slice(0, 4);
}

export const DEFAULT_SUPPORT_HOURS = 'شنبه تا پنج‌شنبه، ۹ صبح تا ۹ شب';

export function supportHours(env: Record<string, string | undefined> = process.env): string {
  return (env.SUPPORT_HOURS?.trim() || DEFAULT_SUPPORT_HOURS).slice(0, 80);
}

export type SupportContact = { phones: SupportPhone[]; hours: string };

/**
 * Public support contact card. The database (support_contacts / support_settings, managed from the admin
 * app) is the source of truth; SUPPORT_PHONES / SUPPORT_HOURS are used only while those tables are empty.
 * Stored numbers are re-validated on read, so a bad row is skipped rather than shown.
 */
export async function getSupportContact(env: Record<string, string | undefined> = process.env): Promise<SupportContact> {
  const [contacts, settings] = await Promise.all([
    query<{ label: string; phone: string }>(
      `SELECT label, phone FROM support_contacts WHERE active ORDER BY sort_order, created_at LIMIT 8`,
    ),
    query<{ hours: string }>(`SELECT hours_text AS hours FROM support_settings WHERE id=1`),
  ]);
  const phones = contacts.rows.length
    ? contacts.rows.map(r => formatSupportPhone(r.label, r.phone)).filter((p): p is SupportPhone => p !== null).slice(0, 4)
    : supportPhones(env);
  const hours = settings.rows[0]?.hours?.trim() ? settings.rows[0].hours.trim().slice(0, 80) : supportHours(env);
  return { phones, hours };
}

export type SupportContactInput = { id?: string; label: string; phone: string; sortOrder?: number; active?: boolean };

/**
 * Admin-side write (no HTTP endpoint yet): creates or updates one support number. The caller (future admin
 * app) must have authorized the platform admin. The number is stored in E.164 form.
 */
export async function upsertSupportContact(input: SupportContactInput, actorUserId: string): Promise<{ id: string }> {
  const p = formatSupportPhone(input.label, input.phone);
  if (!p) throw new AppError('VALIDATION_ERROR', 'عنوان یا شماره‌ی تماس معتبر نیست.');
  const sortOrder = Number.isInteger(input.sortOrder) ? Number(input.sortOrder) : 0;
  const active = input.active ?? true;
  if (input.id !== undefined && !/^[0-9a-f-]{36}$/i.test(input.id)) throw new AppError('VALIDATION_ERROR', 'شناسه معتبر نیست.');
  return withUserTransaction(actorUserId, async client => {
    const r = input.id
      ? await client.query<{ id: string }>(
          `UPDATE support_contacts SET label=$2, phone=$3, sort_order=$4, active=$5 WHERE id=$1 RETURNING id`,
          [input.id, p.label, p.tel, sortOrder, active],
        )
      : await client.query<{ id: string }>(
          `INSERT INTO support_contacts(label, phone, sort_order, active) VALUES($1,$2,$3,$4)
           ON CONFLICT (phone) DO UPDATE SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order, active=EXCLUDED.active
           RETURNING id`,
          [p.label, p.tel, sortOrder, active],
        );
    const row = r.rows[0];
    if (!row) throw new AppError('NOT_FOUND', 'شماره‌ی تماس پیدا نشد.');
    await writeAudit({ actorUserId, action: 'support.contact.upsert', entityType: 'support_contact', entityId: row.id, metadata: { label: p.label, phone: p.tel, active } }, client);
    return row;
  });
}

/** Admin-side write (no HTTP endpoint yet): the hours line shown under the support numbers. */
export async function setSupportHours(hoursText: string, actorUserId: string): Promise<void> {
  const text = (hoursText ?? '').replace(/\s+/g, ' ').trim();
  if (!text || Array.from(text).length > 80) throw new AppError('VALIDATION_ERROR', 'ساعت پاسخ‌گویی حداکثر ۸۰ حرف است.');
  await withUserTransaction(actorUserId, async client => {
    await client.query(
      `INSERT INTO support_settings(id, hours_text) VALUES(1,$1) ON CONFLICT (id) DO UPDATE SET hours_text=EXCLUDED.hours_text`,
      [text],
    );
    await writeAudit({ actorUserId, action: 'support.hours.update', entityType: 'support_settings', entityId: undefined, metadata: { hours: text } }, client);
  });
}
