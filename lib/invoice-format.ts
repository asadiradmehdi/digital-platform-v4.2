// Pure helpers for invoice documents («فاکتورها»): VAT math, amounts in Persian words and masking of
// sensitive order targets. No I/O; shared by the issuing service, the web invoice and the app API.

/**
 * VAT portion already contained in a final (tax-inclusive) price.
 * vat = floor(total × rate / (1 + rate)) with rate = rateBps / 10 000, computed in integers:
 *   floor(total × rateBps / (10 000 + rateBps)).
 * Rounded DOWN to the whole minor unit (toman on invoices) so the stated tax never exceeds what the
 * price contains; the remainder stays in the net amount. 1 100 000 at 10% → 100 000.
 */
export function vatPortion(totalMinor: bigint, rateBps: number): bigint {
  if (totalMinor <= 0n || rateBps <= 0) return 0n;
  if (!Number.isInteger(rateBps) || rateBps > 10_000) throw new RangeError('rateBps must be an integer in 0..10000');
  const bps = BigInt(rateBps);
  return (totalMinor * bps) / (10_000n + bps);
}

/** «۱۰٪» / «۹٫۵٪» from basis points. */
export function formatRateBps(rateBps: number): string {
  return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(rateBps / 100)}٪`;
}

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد', 'میلیون میلیارد'];

function under1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10]);
  else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) parts.push(TENS[t]);
    if (o) parts.push(ONES[o]);
  }
  return parts.join(' و ');
}

/**
 * Whole number in Persian words: 1 800 000 → «یک میلیون و هشتصد هزار». Negative numbers get «منفی».
 * Used for the «مبلغ به حروف» line on invoices (the formal style keeps «یک» before هزار/میلیون).
 */
export function persianWords(value: number | bigint): string {
  let n = typeof value === 'bigint' ? value : BigInt(Math.trunc(value));
  if (n === 0n) return 'صفر';
  const negative = n < 0n;
  if (negative) n = -n;
  const groups: string[] = [];
  let scale = 0;
  while (n > 0n) {
    const chunk = Number(n % 1000n);
    if (chunk) {
      if (scale >= SCALES.length) throw new RangeError('number too large for words');
      groups.unshift(SCALES[scale] ? `${under1000(chunk)} ${SCALES[scale]}` : under1000(chunk));
    }
    n /= 1000n;
    scale++;
  }
  return `${negative ? 'منفی ' : ''}${groups.join(' و ')}`;
}

/** «یک میلیون و هشتصد هزار تومان». */
export function tomanInWords(toman: number | bigint): string {
  return `${persianWords(toman)} تومان`;
}

/**
 * Hide personal data in an order target before it is printed on a document: emails keep their first
 * two characters and domain (ab•••@gmail.com), phone numbers keep their prefix and last digits.
 * Public links and @usernames (what a growth order is delivered to) stay readable.
 */
export function maskTarget(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, 200);
  if (!t) return null;
  const email = t.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
  if (email) {
    const local = email[1];
    return `${local.slice(0, Math.min(2, Math.max(1, local.length - 1)))}•••@${email[2]}`;
  }
  const digits = t.replace(/[\s()-]/g, '');
  if (/^\+?\d{9,15}$/.test(digits)) return `${digits.slice(0, 4)}•••${digits.slice(-3)}`;
  return t;
}

/** Amount in toman for a document: IRT minor units are toman, IRR minor units are rial (÷10, floored). */
export function documentToman(minor: bigint, currency: string): bigint {
  return currency.trim() === 'IRR' ? minor / 10n : minor;
}
