// The printable invoice / top-up receipt («فاکتور» / «رسید شارژ کیف پول») in the v6 brand: lapis enamel
// header with Saturn-ring ornament and gilded wordmark, paper body, gold hairlines. Server component;
// every figure comes from the server-built InvoiceView (toman, Persian calendar, Tehran time).
import Link from 'next/link';
import type { InvoiceField, InvoiceView } from '../../server/payments/invoice-view';
import { BrandMark, Ornament } from './brand';

const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

function Fields({ fields }: { fields: InvoiceField[] }) {
  if (!fields.length) return null;
  return (
    <dl>
      {fields.map(f => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.ltr ? <bdi className="zp-ltr">{f.value}</bdi> : f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Money({ toman, strong }: { toman: number; strong?: boolean }) {
  return <span className={`zp-inv-money${strong ? ' s' : ''}`}>{fa(toman)}<small>تومان</small></span>;
}

export function InvoiceDocument({ invoice, orderHref }: { invoice: InvoiceView; orderHref?: string | null }) {
  const receipt = invoice.type === 'TOPUP_RECEIPT';
  const t = invoice.totals;
  return (
    <article className="zp-inv" aria-labelledby="inv-title">
      <header className="zp-inv-hd">
        <Ornament id="inv-orn" w={820} h={210} cx={120} cy={230} rot={-14} color="#F2D390" alpha={0.55} />
        <div className="top">
          <span className="zp-inv-brand">
            <BrandMark id="inv-mark" size={44} />
            <span>
              <b>زُحل <span className="zp-gtext">پی</span></b>
              <small>ZOHALPAY</small>
            </span>
          </span>
          <div className="kind">
            <h2 id="inv-title">{invoice.typeLabel}</h2>
            <bdi className="zp-ltr no">{invoice.number}</bdi>
          </div>
        </div>
        <div className="meta">
          <div><span>تاریخ صدور</span><b>{invoice.dateLabel}</b></div>
          <div><span>ساعت</span><b>{invoice.timeLabel}</b></div>
          <div><span>وضعیت</span><b><em className="zp-inv-paid">{invoice.statusLabel}</em></b></div>
        </div>
      </header>

      <section className="zp-inv-parties" aria-label="طرفین">
        <div className="zp-inv-party">
          <h3>{receipt ? 'دریافت‌کننده' : 'فروشنده'}</h3>
          <b>{invoice.seller.name}</b>
          <Fields fields={invoice.seller.fields} />
        </div>
        <div className="zp-inv-party">
          <h3>{receipt ? 'پرداخت‌کننده' : 'خریدار'}</h3>
          <b>{invoice.buyer.name}</b>
          <Fields fields={invoice.buyer.fields} />
        </div>
      </section>

      <section className="zp-inv-items" aria-label="شرح اقلام">
        <table>
          <caption className="zp-inv-sr">شرح {receipt ? 'رسید' : 'اقلام فاکتور'}</caption>
          <thead>
            <tr>
              <th scope="col" className="r">ردیف</th>
              <th scope="col">شرح</th>
              <th scope="col">تعداد</th>
              <th scope="col" className="n">مبلغ واحد</th>
              <th scope="col" className="n">مبلغ کل</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map(it => (
              <tr key={it.row}>
                <td className="r">{fa(it.row)}</td>
                <td className="d">
                  <b>{it.description}</b>
                  {it.details.map(d => (
                    <span key={d.label}>{d.label}: {d.ltr ? <bdi className="zp-ltr">{d.value}</bdi> : d.value}</span>
                  ))}
                </td>
                <td className="q" data-label="تعداد">{it.quantityLabel}</td>
                <td className="n" data-label="مبلغ واحد"><Money toman={it.unitPriceToman} /></td>
                <td className="n" data-label="مبلغ کل"><Money toman={it.totalToman} strong /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="zp-inv-sum" aria-label="جمع مبالغ">
        <div className="words">
          <span>مبلغ به حروف</span>
          <b>{t.totalWords}</b>
        </div>
        <dl className="totals">
          <div><dt>جمع اقلام</dt><dd><Money toman={t.subtotalToman} /></dd></div>
          {t.discountToman > 0 && <div className="disc"><dt>تخفیف</dt><dd>−<Money toman={t.discountToman} /></dd></div>}
          {t.vat && (
            <>
              <div className="sub"><dt>مبلغ پیش از مالیات</dt><dd><Money toman={t.vat.netToman} /></dd></div>
              <div className="sub"><dt>مالیات بر ارزش افزوده ({t.vat.rateLabel})</dt><dd><Money toman={t.vat.amountToman} /></dd></div>
            </>
          )}
          <div className="grand"><dt>{receipt ? 'مبلغ واریزی' : 'مبلغ پرداخت‌شده'}</dt><dd><Money toman={t.totalToman} strong /></dd></div>
        </dl>
      </section>

      <section className="zp-inv-pay" aria-label="جزئیات پرداخت">
        <h3>جزئیات پرداخت</h3>
        <dl>
          <div><dt>روش پرداخت</dt><dd>{invoice.payment.methodLabel}</dd></div>
          <div><dt>زمان پرداخت</dt><dd>{invoice.payment.paidLabel}</dd></div>
          {invoice.payment.orderCode && (
            <div>
              <dt>کد پیگیری سفارش</dt>
              <dd>{orderHref ? <Link href={orderHref}><bdi className="zp-ltr">{invoice.payment.orderCode}</bdi></Link> : <bdi className="zp-ltr">{invoice.payment.orderCode}</bdi>}</dd>
            </div>
          )}
          {invoice.payment.reference && (
            <div className="wide"><dt>شماره مرجع تراکنش</dt><dd><bdi className="zp-ltr ref">{invoice.payment.reference}</bdi></dd></div>
          )}
        </dl>
      </section>

      <footer className="zp-inv-ft">
        <span className="seal" aria-hidden="true"><BrandMark id="inv-seal" size={34} /></span>
        <div>
          {invoice.notes.map(n => <p key={n}>{n}</p>)}
          <p>این سند پس از پرداخت، به‌صورت خودکار در زُحل پی صادر شده است.</p>
        </div>
      </footer>
    </article>
  );
}
