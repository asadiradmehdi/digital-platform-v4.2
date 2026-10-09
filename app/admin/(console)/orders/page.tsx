import Link from 'next/link';
import { requireCurrentUser } from '../../../../server/identity/request-user';
import { ORDER_STATUSES, PAGE_SIZE, listAdminOrders } from '../../../../server/admin/console';
import { EmptyState, HiddenFlag, ORDER_STATUS_FA, PageHead, Pager, categoryName, fa, faDate, statusTone, toman } from '../ui';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const userId = await requireCurrentUser();
  const sp = await searchParams;
  const status = sp.status && (ORDER_STATUSES as readonly string[]).includes(sp.status) ? sp.status : null;
  const { rows, total, page } = await listAdminOrders(userId, { status, page: Number(sp.page) });
  const base = status ? `/admin/orders?status=${status}` : '/admin/orders';

  return (
    <>
      <PageHead title="سفارش‌ها" hint={`${fa(total)} سفارش${status ? ` در وضعیت «${ORDER_STATUS_FA[status]}»` : ''}`}>
        <form method="get" action="/admin/orders" className="zpa-field" style={{ minWidth: 200 }}>
          <label htmlFor="st" className="sr-only" style={{ position: 'absolute', left: -9999 }}>فیلتر وضعیت</label>
          <select id="st" name="status" defaultValue={status ?? ''}>
            <option value="">همه‌ی وضعیت‌ها</option>
            {ORDER_STATUSES.map(s => <option key={s} value={s}>{ORDER_STATUS_FA[s]}</option>)}
          </select>
          <button className="zpa-btn sm" type="submit">اعمال فیلتر</button>
        </form>
      </PageHead>
      {rows.length === 0 ? <div className="zpa-panel"><EmptyState title="سفارشی پیدا نشد" hint="فیلتر را تغییر دهید یا بعداً دوباره سر بزنید." /></div> : (
        <div className="zpa-tablewrap">
          <table className="zpa-table">
            <thead><tr><th>زمان</th><th>مشتری</th><th>خدمت</th><th>مبلغ</th><th>وضعیت</th></tr></thead>
            <tbody>
              {rows.map(o => (
                <tr key={o.orderId}>
                  <td>{faDate(o.createdAt)}</td>
                  <td>{o.ownerName ?? '—'}{o.ownerPhone ? <><br /><span className="zpa-ltr" style={{ color: 'var(--muted)', fontSize: 12 }}>{o.ownerPhone}</span></> : null}</td>
                  <td>{o.serviceName ?? '—'} {o.quantity ? <span style={{ color: 'var(--muted)' }}>× {fa(o.quantity)}</span> : null} {o.productSlug ? <><br /><span style={{ color: 'var(--muted)', fontSize: 12 }}>{categoryName(o.productSlug)}</span> <HiddenFlag slug={o.productSlug} /></> : null}</td>
                  <td className="zpa-num">{toman(o.totalToman)}</td>
                  <td><span className={`zpa-tag ${statusTone(o.status)}`}>{ORDER_STATUS_FA[o.status] ?? o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base={base} page={page} total={total} size={PAGE_SIZE} />
      <p style={{ marginTop: 14, fontSize: 12 }}><Link href="/admin" style={{ color: 'var(--brand)', textDecoration: 'underline' }}>تحویل سفارش‌های دستی و وضعیت فنی</Link></p>
    </>
  );
}
