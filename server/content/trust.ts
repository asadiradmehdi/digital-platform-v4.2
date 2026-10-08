// Licences (مجوزها) and public support contacts. Server-owned so web and the native app show the same thing.
// Values come from the environment until the admin panel owns them; nothing here is ever shown unverified:
// a licence is «فعال» only when its official verification link is configured.
import type { IconName } from '../../packages/design-tokens/src/icons';

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

/**
 * SUPPORT_PHONES="پشتیبانی فروش:02112345678;واتساپ و تلگرام:09121234567". Only Iranian landline/mobile
 * numbers are accepted; `tel` is the dialable +98 form and `display` the Persian-digit form.
 */
export function supportPhones(env: Record<string, string | undefined> = process.env): SupportPhone[] {
  const out: SupportPhone[] = [];
  for (const part of (env.SUPPORT_PHONES ?? '').split(';')) {
    const [label, num] = part.split(':').map(s => s?.trim());
    const digits = (num ?? '').replace(/[\s-]/g, '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const m = /^(?:\+98|0098|0)(\d{10})$/.exec(digits);
    if (!label || !m) continue;
    const local = `0${m[1]}`;
    const fa = (s: string) => s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
    const grouped = local.startsWith('09') ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : `${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`;
    out.push({ label: label.slice(0, 40), display: fa(grouped), tel: `+98${m[1]}` });
  }
  return out.slice(0, 4);
}

export function supportHours(env: Record<string, string | undefined> = process.env): string {
  return (env.SUPPORT_HOURS ?? 'شنبه تا پنج‌شنبه، ۹ صبح تا ۹ شب').slice(0, 80);
}
