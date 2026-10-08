export function formatIRR(minor: number, currency = 'IRR') {
  const value = new Intl.NumberFormat('fa-IR').format(Math.round(minor));
  return `${value} ${currency === 'IRR' ? 'ریال' : currency}`;
}
export function formatTomanFromIRR(minor: number) {
  return `${new Intl.NumberFormat('fa-IR').format(Math.round(minor / 10))} تومان`;
}
export function statusLabel(status: string) {
  const map: Record<string,string> = { PROCESSING:'در حال پردازش', COMPLETED:'تکمیل‌شده', QUEUED:'در صف', PAID:'پرداخت‌شده', ACTIVE:'فعال', FAILED:'ناموفق', REFUNDED:'مرجوع‌شده' };
  return map[status] ?? status;
}

const faNum = (n: number, maxFrac = 0) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: maxFrac }).format(n);

/** Split a count into a Persian magnitude word: 2_000_000 → { value: '۲', unit: 'میلیون' }. */
export function magnitudeParts(n: number): { value: string; unit: string } {
  const steps: Array<[number, string]> = [[1e9, 'میلیارد'], [1e6, 'میلیون'], [1e3, 'هزار']];
  for (let i = 0; i < steps.length; i++) {
    const [size, unit] = steps[i];
    const scaled = Math.round((Math.abs(n) / size) * 10) / 10;
    // 999_999 must read «۱ میلیون», not «۱٬۰۰۰ هزار»: promote when rounding reaches the next magnitude.
    if (scaled >= 1000 && i > 0) return { value: faNum(Math.sign(n) * Math.round(Math.abs(n) / steps[i - 1][0] * 10) / 10, 1), unit: steps[i - 1][1] };
    if (scaled >= 1) return { value: faNum(Math.sign(n) * scaled, 1), unit };
  }
  return { value: faNum(n), unit: '' };
}

/** Human quantity label: 2000 → «۲ هزار», 1_000_000 → «۱ میلیون», 250 → «۲۵۰». */
export function formatQuantityWords(n: number) {
  const { value, unit } = magnitudeParts(n);
  return unit ? `${value} ${unit}` : value;
}

/** Toman amount (from IRR minor units) in words for chips/buttons: 20_000_000 IRR → «۲ میلیون تومان». */
export function formatTomanWordsFromIRR(minor: number) {
  return `${formatQuantityWords(Math.round(minor / 10))} تومان`;
}
