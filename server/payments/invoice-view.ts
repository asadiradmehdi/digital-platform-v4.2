// Presentation model of an invoice document, owned by the server so the website and the native app
// print exactly the same wording, amounts (toman) and dates (Persian calendar, Tehran time).
import { formatQuantityWords, orderCode, toToman } from '../../lib/format';
import { formatRateBps, tomanInWords } from '../../lib/invoice-format';
import type { InvoiceListRow, InvoiceRecord } from './invoice';

export type InvoiceField = { label: string; value: string; ltr?: boolean };

export type InvoiceView = {
  id: string;
  number: string;
  type: 'SALE' | 'TOPUP_RECEIPT';
  /** «فاکتور فروش» or «رسید شارژ کیف پول». */
  typeLabel: string;
  title: string;
  statusLabel: string;
  issuedAt: string;
  dateLabel: string;
  timeLabel: string;
  seller: { name: string; fields: InvoiceField[] };
  buyer: { name: string; fields: InvoiceField[] };
  items: Array<{
    row: number; description: string; details: InvoiceField[];
    quantity: number; quantityLabel: string; unitPriceToman: number; totalToman: number;
  }>;
  totals: {
    subtotalToman: number; discountToman: number;
    /** Present only when VAT was enabled for this document; the amount is inside the total. */
    vat: { rateLabel: string; amountToman: number; netToman: number } | null;
    totalToman: number; totalWords: string;
  };
  payment: { methodLabel: string; reference: string | null; orderCode: string | null; orderId: string | null; paidLabel: string };
  /** Footer notes (final prices, tax wording). */
  notes: string[];
};

const BRAND = 'زُحل پی';

function tehran(date: string | Date) {
  const d = new Date(date);
  return {
    date: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tehran' }).format(d),
    time: new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Tehran' }).format(d),
  };
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function typeLabel(type: string) {
  return type === 'TOPUP_RECEIPT' ? 'رسید شارژ کیف پول' : 'فاکتور فروش';
}

export function paymentMethodLabel(method: string | null) {
  if (method === 'WALLET') return 'کیف پول زُحل پی';
  if (method === 'GATEWAY') return 'درگاه پرداخت آنلاین';
  return '—';
}

export function buildInvoiceView(inv: InvoiceRecord): InvoiceView {
  const cur = inv.currency.trim();
  const when = tehran(inv.issuedAt);
  const paid = tehran(inv.paidAt ?? inv.issuedAt);
  const seller = inv.seller ?? {};
  const sellerFields: InvoiceField[] = [];
  const add = (list: InvoiceField[], label: string, value: unknown, ltr = false) => { const v = str(value); if (v) list.push({ label, value: v, ...(ltr ? { ltr } : {}) }); };
  add(sellerFields, 'شناسه ملی', seller.nationalId, true);
  add(sellerFields, 'کد اقتصادی', seller.economicCode, true);
  add(sellerFields, 'تلفن', seller.phone, true);
  add(sellerFields, 'کد پستی', seller.postalCode, true);
  add(sellerFields, 'نشانی', seller.address);
  const buyerFields: InvoiceField[] = [];
  add(buyerFields, 'موبایل', inv.buyerPhone, true);
  add(buyerFields, 'ایمیل', inv.buyerEmail, true);

  const items = inv.items.map((it, i) => {
    const m = it.metadata ?? {};
    const q = Number(it.quantity);
    const details: InvoiceField[] = [];
    if (str(m.target)) details.push({ label: str(m.targetLabel) ?? 'مقصد', value: String(m.target), ltr: m.targetLtr !== false });
    if (str(m.category)) details.push({ label: 'دسته', value: String(m.category) });
    if (m.periodStart && m.periodEnd) {
      details.push({ label: 'دوره', value: `${tehran(String(m.periodStart)).date} تا ${tehran(String(m.periodEnd)).date}` });
    }
    const unit = str(m.unit);
    const words = str(m.quantityWords) ?? formatQuantityWords(q);
    return {
      row: i + 1,
      description: it.description,
      details,
      quantity: q,
      quantityLabel: unit ? `${words} ${unit}` : words,
      unitPriceToman: toToman(it.unitPriceMinor, it.currency),
      totalToman: toToman(it.totalMinor, it.currency),
    };
  });

  const total = toToman(inv.totalMinor, cur);
  const vatAmount = toToman(inv.vatMinor, cur);
  const vat = inv.vatRateBps != null && inv.type === 'SALE'
    ? { rateLabel: formatRateBps(inv.vatRateBps), amountToman: vatAmount, netToman: total - vatAmount }
    : null;
  const code = str(inv.metadata?.orderCode) ?? (inv.orderId ? orderCode(inv.orderId) : null);
  const receipt = inv.type === 'TOPUP_RECEIPT';
  const notes = [
    'همه‌ی مبالغ به تومان است.',
    ...(vat ? [`مبالغ نهایی است و ${vat.rateLabel} مالیات بر ارزش افزوده را در بر دارد.`] : []),
    ...(!receipt ? ['خریدار با ثبت و پرداخت این سفارش، قوانین و شرایط استفاده از زُحل پی را مطالعه و پذیرفته است.'] : []),
    ...(receipt ? ['این رسید، دریافت وجه برای شارژ کیف پول را تأیید می‌کند و فاکتور فروش نیست.'] : []),
  ];

  return {
    id: inv.id,
    number: inv.invoiceNumber,
    type: inv.type,
    typeLabel: typeLabel(inv.type),
    title: inv.title ?? typeLabel(inv.type),
    statusLabel: inv.status === 'PAID' || inv.status === 'ISSUED' ? 'پرداخت‌شده' : inv.status === 'REFUNDED' ? 'مسترد‌شده' : inv.status,
    issuedAt: new Date(inv.issuedAt).toISOString(),
    dateLabel: when.date,
    timeLabel: when.time,
    seller: { name: str(seller.legalName) ?? BRAND, fields: sellerFields },
    buyer: { name: str(inv.buyerName) ?? 'مشتری زُحل پی', fields: buyerFields },
    items,
    totals: {
      subtotalToman: toToman(inv.subtotalMinor, cur),
      discountToman: toToman(inv.discountMinor, cur),
      vat,
      totalToman: total,
      totalWords: tomanInWords(total),
    },
    payment: {
      methodLabel: paymentMethodLabel(inv.paymentMethod),
      reference: str(inv.paymentReference),
      orderCode: code,
      orderId: inv.orderId,
      paidLabel: `${paid.date}، ساعت ${paid.time}`,
    },
    notes,
  };
}

export type InvoiceListItem = { id: string; number: string; type: 'SALE' | 'TOPUP_RECEIPT'; typeLabel: string; title: string; when: string; amountToman: number };

export function invoiceListItemView(r: InvoiceListRow): InvoiceListItem {
  const t = tehran(r.issuedAt);
  return {
    id: r.id,
    number: r.invoiceNumber,
    type: r.type,
    typeLabel: r.type === 'TOPUP_RECEIPT' ? 'رسید شارژ' : 'فاکتور',
    title: r.title ?? typeLabel(r.type),
    when: `${t.date}، ${t.time}`,
    amountToman: toToman(r.totalMinor, r.currency),
  };
}
