import Link from 'next/link';
import { requireCurrentUser } from '../../../../server/identity/request-user';
import { ORDER_STATUSES, PAGE_SIZE, searchOrders } from '../../../../server/admin/orders';
import { CATEGORIES, categoryMeta } from '../../../../lib/catalog-ui';
import { normalizeDigits } from '../../../../lib/admin-pricing';
import { Chips, EmptyState, PageHead, Pager, StatusTag, ago, categoryName, fa, toman } from '../ui';

const QUICK: Array<[string, string]> = [['', 'همه'], ['PAID', 'پرداخت‌شده'], ['QUEUED', 'در صف'], ['IN_PROGRESS', 'در حال انجام'], ['COMPLETED', 'تکمیل'], ['FAILED', 'ناموفق'], ['REFUND_PENDING', 'بازگشت وجه']];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const userId = await requireCurrentUser();
  const sp = await searchParams;
  const status = sp.status && (ORDER_STATUSES as readonly string[]).includes(sp.status) ? sp.status : '';
  const q = normalizeDigits(sp.q ?? '').trim().slice(0, 80);
  const category = sp.category && categoryMeta(sp.category) ? sp.category : '';
  const attention = sp.attention === '1';
  const { rows, total, page } = await searchOrders(userId, { status: status || null, search: q || null, category: category || null, attention, from: sp.from, to: sp.to, userId: sp.user, page: Number(sp.page) });

  const params = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { status, q, category, attention: attention ? '1' : '', from: sp.from ?? '', to: sp.to ?? '', user: sp.user ?? '', ...over };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/orders?${s}` : '/admin/orders';
  };
  const chips = [
    { href: params({ attention: attention ? '' : '1', status: '' }), label: 'نیازمند توجه', active: attention },
    ...QUICK.map(([s, l]) => ({ href: params({ status: s, attention: '' }), label: l, active: !attention && status === s })),
  ];

  return (
    <>
      <PageHead title="سفارش‌ها" hint={`${fa(total)} سفارش${attention ? ' نیازمند توجه' : ''}`} />
      <form method="get" action="/admin/orders" className="zpa-filters" role="search">
        <div className="zpa-search">
          <input type="search" name="q" defaultValue={q} placeholder="کد سفارش، نام، موبایل یا خدمت" maxLength={80} aria-label="جست‌وجوی سفارش" enterKeyHint="search" />
          <button className="zpa-btn" type="submit">جست‌وجو</button>
        </div>
        <select name="category" defaultValue={category} aria-label="دسته">
          <option value="">همه‌ی دسته‌ها</option>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
        <input type="hidden" name="status" value={status} /><input type="hidden" name="attention" value={attention ? '1' : ''} />
      </form>
      <Chips items={chips} label="فیلتر وضعیت" />
      {rows.length === 0 ? <div className="zpa-panel"><EmptyState title="سفارشی پیدا نشد" hint={q || status || category || attention ? 'فیلترها را کم کنید یا عبارت دیگری بزنید.' : 'هنوز سفارشی ثبت نشده است.'} /></div> : (
        <ul className="zpa-list">
          {rows.map(o => (
            <li key={o.orderId}>
              <Link className="zpa-item" href={`/admin/orders/${o.orderId}`}>
                <div className="zpa-item-top"><b>{o.serviceName ?? 'سفارش'}{o.quantity ? <span style={{ color: 'var(--muted)', fontWeight: 500 }}> × {fa(o.quantity)}</span> : null}</b><span className="zpa-item-end">{toman(o.totalToman)}</span></div>
                <div className="zpa-item-sub">
                  <StatusTag status={o.status} />
                  <span>{o.ownerName ?? '—'}</span>
                  <span className="zpa-ltr">{o.code}</span>
                  <span>{ago(o.createdAt)}</span>
                  {o.productSlug ? <span>{categoryName(o.productSlug)}</span> : null}
                  {o.fulfillmentMode === 'MANUAL' ? <span className="zpa-tag info">دستی</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager base={params({})} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
