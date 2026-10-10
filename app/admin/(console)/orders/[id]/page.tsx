import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCurrentUser } from '../../../../../server/identity/request-user';
import { getOrderDetail } from '../../../../../server/admin/orders';
import { AppError } from '../../../../../server/core/errors';
import { EmptyState, ORDER_STATUS_FA, PageHead, StatusTag, categoryName, fa, faDate, toman } from '../../ui';
import { CopyButton } from '../../kit';
import { OrderActions } from './OrderActions';

const PARAM_FA: Record<string, string> = { target: 'لینک / آیدی هدف', brief: 'توضیحات سفارش', username: 'نام کاربری', link: 'لینک', url: 'لینک', note: 'توضیح', comment: 'متن' };
const PAY_FA: Record<string, string> = { PAID: 'پرداخت شده', PENDING: 'در انتظار', FAILED: 'ناموفق', REFUNDED: 'بازگردانده شده', PARTIALLY_REFUNDED: 'بازگشت بخشی', CANCELLED: 'لغو شده' };
const GATEWAY_FA: Record<string, string> = { wallet: 'کیف پول' };
const SOURCE_FA: Record<string, string> = { admin: 'پشتیبان', manual_fulfilment: 'تحویل دستی', refund: 'بازگشت وجه', cancel: 'لغو', checkout: 'خرید' };

const isLink = (v: string) => /^https?:\/\//i.test(v);
const show = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v));

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireCurrentUser();
  let o;
  try { o = await getOrderDetail(userId, id); } catch (e) { if (e instanceof AppError && (e.code === 'NOT_FOUND' || e.code === 'VALIDATION_ERROR')) notFound(); throw e; }
  const first = o.items[0];

  return (
    <>
      <PageHead title={`سفارش ${o.code}`} hint={`${faDate(o.createdAt)} | ${toman(o.totalToman)}`} back={{ href: '/admin/orders', label: 'همه‌ی سفارش‌ها' }}>
        <StatusTag status={o.status} />
      </PageHead>

      <OrderActions orderId={o.id} status={o.status} allowedTargets={o.allowedTargets} canDeliver={o.canDeliver} canCancel={o.canCancel} canRefund={o.canRefund} refundableToman={o.refundableToman}
        statusLabels={Object.fromEntries(o.allowedTargets.map(t => [t, ORDER_STATUS_FA[t]]))} />

      <section className="zpa-sec" aria-labelledby="o-cust"><h2 id="o-cust">مشتری</h2>
        <dl className="zpa-panel zpa-kv">
          <div><dt>نام</dt><dd><Link className="zpa-link" href={`/admin/users/${o.customer.userId}`}>{o.customer.name ?? '—'}</Link></dd></div>
          {o.customer.phone ? <div><dt>موبایل</dt><dd className="ltr">{o.customer.phone} <CopyButton text={o.customer.phone} /></dd></div> : null}
          {o.customer.email ? <div><dt>ایمیل</dt><dd className="ltr">{o.customer.email}</dd></div> : null}
        </dl>
      </section>

      <section className="zpa-sec" aria-labelledby="o-items"><h2 id="o-items">خدمت و مشخصات</h2>
        {o.items.map(i => (
          <div key={i.id} className="zpa-panel" style={{ marginBottom: 10 }}>
            <dl className="zpa-kv">
              <div><dt>خدمت</dt><dd><Link className="zpa-link" href={`/admin/catalog/${i.serviceId}`}>{i.serviceName}</Link> <span className="zpa-tag">{categoryName(i.productSlug)}</span></dd></div>
              <div><dt>تعداد</dt><dd>{fa(i.quantity)}</dd></div>
              <div><dt>قیمت هر واحد</dt><dd>{toman(i.unitToman)}</dd></div>
              <div><dt>جمع</dt><dd>{toman(i.totalToman)}</dd></div>
              {i.costToman !== null ? <div><dt>هزینه‌ی تأمین‌کننده</dt><dd>{toman(i.costToman)}</dd></div> : null}
              <div><dt>روش انجام</dt><dd>{i.fulfillmentMode === 'MANUAL' ? 'دستی (تیم)' : 'خودکار'}</dd></div>
              {Object.entries(i.parameters).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (
                <div key={k}><dt>{PARAM_FA[k] ?? k}</dt><dd className={isLink(show(v)) || /^[\w@.\-/:]+$/.test(show(v)) ? 'ltr' : undefined}>
                  {isLink(show(v)) ? <a className="zpa-link" href={show(v)} target="_blank" rel="noopener noreferrer nofollow">{show(v)}</a> : show(v)} <CopyButton text={show(v)} />
                </dd></div>
              ))}
            </dl>
          </div>
        ))}
        {o.discountToman > 0 ? <p className="zpa-muted" style={{ margin: '4px 0 0' }}>تخفیف: {toman(o.discountToman)}</p> : null}
      </section>

      <section className="zpa-sec" aria-labelledby="o-pay"><h2 id="o-pay">پرداخت</h2>
        {o.payments.length === 0 ? <div className="zpa-panel"><EmptyState title="پرداختی ثبت نشده" /></div> : (
          <div className="zpa-panel">
            <dl className="zpa-kv">
              {o.payments.map(p => (
                <div key={p.id}><dt>{GATEWAY_FA[p.gateway] ?? p.gateway}{p.reference ? <small className="zpa-ltr" style={{ display: 'block' }}>{p.reference}</small> : null}</dt>
                  <dd>{toman(p.amountToman)} <span className={`zpa-tag ${p.status === 'PAID' ? 'ok' : 'warn'}`}>{PAY_FA[p.status] ?? p.status}</span>{p.refundedToman > 0 ? <small style={{ display: 'block' }}>بازگردانده: {toman(p.refundedToman)}</small> : null}</dd></div>
              ))}
              {o.refunds.map(r => <div key={r.id}><dt>بازگشت وجه | {faDate(r.createdAt)}</dt><dd>{toman(r.amountToman)} <span className={`zpa-tag ${r.status === 'FAILED' ? 'bad' : 'ok'}`}>{PAY_FA[r.status] ?? r.status}</span></dd></div>)}
            </dl>
          </div>
        )}
      </section>

      <section className="zpa-sec" aria-labelledby="o-tl"><h2 id="o-tl">روند سفارش</h2>
        <div className="zpa-panel">
          <ol className="zpa-tl">
            {[...o.events].reverse().map(e => (
              <li key={e.id}>
                <b>{ORDER_STATUS_FA[e.to] ?? e.to}</b>
                <small>{faDate(e.createdAt)}{e.actorName ? ` · ${e.actorName}` : e.source ? ` · ${SOURCE_FA[e.source] ?? e.source}` : ''}</small>
                {e.note ? <small>{e.note}</small> : null}
                {e.proofUrl ? <small><a className="zpa-link" href={e.proofUrl} target="_blank" rel="noopener noreferrer nofollow">مدرک تحویل</a></small> : null}
              </li>
            ))}
            {o.events.length === 0 ? <li><b>ثبت شد</b><small>{faDate(o.createdAt)}</small></li> : null}
          </ol>
        </div>
      </section>

      <section className="zpa-sec" aria-labelledby="o-notes"><h2 id="o-notes">یادداشت‌های داخلی</h2>
        <div className="zpa-panel zpa-stack">
          <p className="zpa-muted" style={{ margin: 0 }}>فقط تیم می‌بیند؛ مشتری نمی‌بیند.</p>
          {o.notes.length === 0 ? <EmptyState title="یادداشتی نیست" /> : o.notes.map(n => (
            <div key={n.id} className="zpa-msg staff" style={{ maxWidth: '100%' }}><p>{n.body}</p><small>{n.authorName ?? 'پشتیبان'} | {faDate(n.createdAt)}</small></div>
          ))}
        </div>
      </section>
      <p className="zpa-muted" style={{ fontSize: 12 }}>{first ? `ریسک: ${o.riskState}` : ''}</p>
    </>
  );
}
