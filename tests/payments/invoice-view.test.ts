import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { InvoiceRecord } from '../../server/payments/invoice';
import { buildInvoiceView, invoiceListItemView } from '../../server/payments/invoice-view';
import { InvoiceDocument } from '../../components/zp/InvoiceDocument';

const base: InvoiceRecord = {
  id: '7d0c5f0e-1b2a-4c3d-8e9f-0a1b2c3d4e5f', invoiceNumber: 'INV-2026-000042', type: 'SALE', title: '۲ هزار فالوور اینستاگرام', currency: 'IRT',
  subtotalMinor: '1800000', discountMinor: '0', totalMinor: '1800000', vatMinor: '0', vatRateBps: null, status: 'PAID',
  orderId: '4a1c9e22-0000-4000-8000-000000000000', paymentId: 'p', subscriptionId: null, paymentMethod: 'GATEWAY', paymentReference: 'mock_abc-123',
  buyerName: 'علی', buyerPhone: '09121234567', buyerEmail: null,
  seller: { legalName: '', nationalId: '', economicCode: '', address: '', postalCode: '', phone: '' },
  issuedAt: '2026-10-08T10:12:00Z', paidAt: '2026-10-08T10:12:00Z', metadata: { orderCode: 'ZP-4A1C9E' },
  items: [{ id: 'l1', description: 'فالوور اینستاگرام', quantity: '2000', unitPriceMinor: '900', totalMinor: '1800000', currency: 'IRT', metadata: { quantityWords: '۲ هزار', unit: 'فالوور', target: 'al•••@gmail.com', targetLabel: 'ایمیل حساب', category: 'اینستاگرام' } }],
};

describe('buildInvoiceView', () => {
  it('prints toman amounts, the total in words, Tehran date/time and the paid status', () => {
    const v = buildInvoiceView(base);
    expect(v.typeLabel).toBe('فاکتور فروش');
    expect(v.statusLabel).toBe('پرداخت‌شده');
    expect(v.dateLabel).toBe('۱۶ مهر ۱۴۰۵');
    expect(v.timeLabel).toBe('۱۳:۴۲'); // 10:12 UTC = 13:42 Tehran
    expect(v.totals).toMatchObject({ subtotalToman: 1_800_000, totalToman: 1_800_000, discountToman: 0, vat: null, totalWords: 'یک میلیون و هشتصد هزار تومان' });
    expect(v.items[0]).toMatchObject({ quantityLabel: '۲ هزار فالوور', unitPriceToman: 900, totalToman: 1_800_000 });
    expect(v.items[0].details).toEqual([{ label: 'ایمیل حساب', value: 'al•••@gmail.com', ltr: true }, { label: 'دسته', value: 'اینستاگرام' }]);
    expect(v.payment).toMatchObject({ methodLabel: 'درگاه پرداخت آنلاین', reference: 'mock_abc-123', orderCode: 'ZP-4A1C9E' });
  });

  it('VAT off: no VAT line and no tax wording at all', () => {
    const v = buildInvoiceView(base);
    expect(v.totals.vat).toBeNull();
    expect(v.notes.join(' ')).not.toMatch(/مالیات/);
    expect(renderToStaticMarkup(createElement(InvoiceDocument, { invoice: v }))).not.toMatch(/مالیات|ارزش افزوده/);
  });

  it('VAT on: shows the rate, the VAT inside the total and the net amount', () => {
    const v = buildInvoiceView({ ...base, vatMinor: '163636', vatRateBps: 1000 });
    expect(v.totals.vat).toEqual({ rateLabel: '۱۰٪', amountToman: 163_636, netToman: 1_636_364 });
    const html = renderToStaticMarkup(createElement(InvoiceDocument, { invoice: v }));
    expect(html).toContain('مالیات بر ارزش افزوده (۱۰٪)');
    expect(html).toContain('۱۶۳٬۶۳۶');
  });

  it('hides empty seller fields and falls back to the brand name', () => {
    const v = buildInvoiceView(base);
    expect(v.seller).toEqual({ name: 'زُحل پی', fields: [] });
    const filled = buildInvoiceView({ ...base, seller: { ...base.seller, legalName: 'شرکت زحل پی', economicCode: '411111111111' } });
    expect(filled.seller).toEqual({ name: 'شرکت زحل پی', fields: [{ label: 'کد اقتصادی', value: '411111111111', ltr: true }] });
  });

  it('a top-up receipt is labelled as a receipt (not a sales invoice) and says so', () => {
    const v = buildInvoiceView({ ...base, type: 'TOPUP_RECEIPT', title: 'شارژ کیف پول', orderId: null, metadata: {} });
    expect(v.typeLabel).toBe('رسید شارژ کیف پول');
    expect(v.payment.orderCode).toBeNull();
    expect(v.notes.join(' ')).toContain('فاکتور فروش نیست');
    const html = renderToStaticMarkup(createElement(InvoiceDocument, { invoice: v }));
    expect(html).toContain('مبلغ واریزی');
    expect(html).toContain('پرداخت‌کننده');
  });

  it('isolates IDs, codes and references as LTR runs inside the RTL document', () => {
    const html = renderToStaticMarkup(createElement(InvoiceDocument, { invoice: buildInvoiceView(base), orderHref: '/orders/x' }));
    for (const ltr of ['INV-2026-000042', 'ZP-4A1C9E', 'mock_abc-123', '09121234567', 'al•••@gmail.com']) {
      expect(html).toContain(`<bdi class="zp-ltr${ltr === 'INV-2026-000042' ? ' no' : ltr === 'mock_abc-123' ? ' ref' : ''}">${ltr}</bdi>`);
    }
  });

  it('list rows carry a type pill label and toman amount', () => {
    expect(invoiceListItemView({ id: 'i', invoiceNumber: 'INV-2026-000001', type: 'TOPUP_RECEIPT', title: null, currency: 'IRT', totalMinor: '500000', status: 'PAID', orderId: null, issuedAt: '2026-10-08T10:12:00Z' }))
      .toEqual({ id: 'i', number: 'INV-2026-000001', type: 'TOPUP_RECEIPT', typeLabel: 'رسید شارژ', title: 'رسید شارژ کیف پول', when: '۱۶ مهر ۱۴۰۵، ۱۳:۴۲', amountToman: 500_000 });
  });
});
