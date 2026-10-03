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
