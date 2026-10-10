import Link from 'next/link';
import { requireCurrentUser } from '../../../../server/identity/request-user';
import { getRevenueDashboard, type Period } from '../../../../server/admin/console';
import { getAdminAccess } from '../../../../server/admin/access';
import { getAttention, getDailyRevenue } from '../../../../server/admin/overview';
import { listLowMargin } from '../../../../server/admin/packages';
import { EmptyState, HiddenFlag, ORDER_STATUS_FA, PageHead, ago, categoryName, fa, faShortDay, statusTone, toman } from '../ui';
import { NoAccess } from '../guard';

const LABEL: Record<Period, string> = { today: 'امروز', d7: '۷ روز گذشته', d30: '۳۰ روز گذشته' };
const isPeriod = (p: string | undefined): p is Period => p === 'today' || p === 'd7' || p === 'd30';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const userId = await requireCurrentUser();
  const access = await getAdminAccess(userId);
  if (!access) return <NoAccess />;
  const can = (k: string) => access.permissions.has(k as never);
  const sp = await searchParams;
  const period: Period = isPeriod(sp.p) ? sp.p : 'd7';
  const [attention, daily, margin, data] = await Promise.all([
    getAttention(userId),
    can('orders.view') ? getDailyRevenue(userId, 14) : Promise.resolve(null),
    can('catalog.view') ? listLowMargin(userId, 10).catch(() => null) : Promise.resolve(null),
    can('orders.view') ? getRevenueDashboard(userId) : Promise.resolve(null),
  ]);
  const attn = [
    can('orders.view') && { href: '/admin/orders?status=FAILED', label: 'سفارش ناموفق', n: attention.ordersFailed.count, at: attention.ordersFailed.oldestAt },
    can('orders.view') && { href: '/admin/orders?status=REFUND_PENDING', label: 'در انتظار بازگشت وجه', n: attention.ordersRefundPending.count, at: attention.ordersRefundPending.oldestAt },
    can('orders.view') && { href: '/admin/orders?attention=1', label: 'سفارش گیرکرده (بیش از ۶ ساعت)', n: attention.ordersStale.count, at: attention.ordersStale.oldestAt },
    can('orders.view') && { href: '/admin/orders?attention=1', label: 'سفارش دستی منتظر تحویل', n: attention.ordersTeamWaiting.count, at: attention.ordersTeamWaiting.oldestAt },
    can('support.view') && { href: '/admin/support?status=ACTIVE', label: 'تیکت باز', n: attention.ticketsOpen.count, at: attention.ticketsOpen.oldestAt },
    can('support.view') && { href: '/admin/support?assignee=none', label: 'تیکت بدون مسئول', n: attention.ticketsUnassigned.count, at: attention.ticketsUnassigned.oldestAt },
  ].filter(Boolean) as Array<{ href: string; label: string; n: number; at: string | null }>;
  const maxDay = Math.max(1, ...(daily ?? []).map(d => d.toman));
  const topup = data?.topups[period] ?? { toman: 0, count: 0 };
  const direct = data?.direct[period] ?? { toman: 0, count: 0 };
  const payTotal = topup.toman + direct.toman;
  const cats = data?.categories[period] ?? [];
  const catMax = Math.max(1, ...cats.map(c => c.toman));
  const statuses = Object.entries(data?.ordersByStatus[period] ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHead title="داشبورد" hint="درآمد و وضعیت سفارش‌ها؛ ساعت‌ها به وقت تهران است.">
        <div className="zpa-seg" role="tablist" aria-label="بازه‌ی زمانی">
          {(['today', 'd7', 'd30'] as Period[]).map(p => (
            <Link key={p} href={`/admin/dashboard?p=${p}`} aria-current={p === period}>{LABEL[p]}</Link>
          ))}
        </div>
      </PageHead>

      <section className="zpa-sec" aria-labelledby="d-attn">
        <h2 id="d-attn">نیازمند توجه</h2>
        <div className="zpa-panel">
          {attn.length === 0 ? <EmptyState title="موردی برای نمایش نیست" hint="دسترسی‌های شما بخش‌های دیگر را نشان نمی‌دهد." />
            : attn.every(a => a.n === 0) ? <EmptyState title="همه‌چیز مرتب است" hint="سفارش یا تیکتی منتظر تصمیم شما نیست." /> : (
              <nav className="zpa-attn" aria-label="موارد نیازمند توجه">
                {attn.filter(a => a.n > 0).map(a => (
                  <Link key={a.label} href={a.href}><span>{a.label}{a.at ? <small style={{ color: 'var(--muted)', fontWeight: 500 }}> | قدیمی‌ترین {ago(a.at)}</small> : null}</span><span className="zpa-tag warn">{fa(a.n)}</span></Link>
                ))}
              </nav>
            )}
        </div>
      </section>

      {daily ? (
        <section className="zpa-sec" aria-labelledby="d-days">
          <h2 id="d-days">فروش ۱۴ روز گذشته</h2>
          <div className="zpa-panel">
            <div className="zpa-days" role="img" aria-label="نمودار فروش روزانه">
              {daily.map(d => (
                <div key={d.date} className="zpa-day" title={`${toman(d.toman)} | ${fa(d.count)} سفارش`}>
                  <i style={{ height: `${Math.max(3, Math.round((d.toman / maxDay) * 100))}%` }} />
                  <span>{faShortDay(d.date)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {margin && margin.rows.length > 0 ? (
        <section className="zpa-sec" aria-labelledby="d-margin">
          <h2 id="d-margin">هشدار حاشیه‌ی سود کم</h2>
          <ul className="zpa-list">
            {margin.rows.slice(0, 6).map(m => (
              <li key={m.serviceId}><Link className="zpa-item" href={`/admin/catalog/${m.serviceId}`}>
                <div className="zpa-item-top"><b>{m.name}</b><span className={`zpa-tag ${m.worstMarginPct < 0 ? 'bad' : 'warn'}`}>{fa(m.worstMarginPct)}٪</span></div>
                <div className="zpa-item-sub"><span>کم‌سودترین بسته: {fa(m.worstQuantity)} عدد</span><span>قیمت {toman(m.priceToman)} | هزینه {toman(m.costToman)}</span></div>
              </Link></li>
            ))}
          </ul>
          <p className="zpa-muted" style={{ fontSize: 12 }}>فقط خدماتی که هزینه‌ی تأمین‌کننده برایشان ثبت شده بررسی می‌شوند ({fa(margin.withCost)} از {fa(margin.total)} خدمت).</p>
        </section>
      ) : null}

      {data ? <>
      <section className="zpa-sec" aria-label="درآمد">
        <div className="zpa-grid">
          {(['today', 'd7', 'd30'] as Period[]).map(p => (
            <div key={p} className="zpa-panel zpa-stat">
              <small>فروش {LABEL[p]}</small>
              <b>{toman(data.sales[p].toman)}</b>
              <span>{fa(data.sales[p].count)} سفارش پرداخت‌شده</span>
            </div>
          ))}
        </div>
      </section>

      <section className="zpa-sec">
        <h2>شارژ کیف پول و پرداخت مستقیم — {LABEL[period]}</h2>
        <div className="zpa-panel">
          {payTotal === 0 ? <EmptyState title="در این بازه پرداختی ثبت نشده" hint="پرداخت‌های موفق درگاه اینجا دیده می‌شوند." /> : (
            <div className="zpa-rows">
              {[['شارژ کیف پول', topup], ['پرداخت مستقیم سفارش', direct]].map(([name, v]) => {
                const x = v as { count: number; toman: number };
                return (
                  <div className="zpa-row" key={name as string}>
                    <span>{name as string}</span>
                    <div className="zpa-bar" aria-hidden><i style={{ width: `${Math.round((x.toman / payTotal) * 100)}%` }} /></div>
                    <span className="zpa-num">{toman(x.toman)} | {fa(x.count)} پرداخت</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="zpa-grid two">
        <section className="zpa-sec">
          <h2>فروش هر بخش — {LABEL[period]}</h2>
          <div className="zpa-panel">
            {cats.length === 0 ? <EmptyState title="هنوز فروشی ثبت نشده" /> : (
              <div className="zpa-rows">
                {cats.map(c => (
                  <div className="zpa-row" key={c.slug}>
                    <span>{categoryName(c.slug)} <HiddenFlag slug={c.slug} /></span>
                    <div className="zpa-bar" aria-hidden><i style={{ width: `${Math.max(3, Math.round((c.toman / catMax) * 100))}%` }} /></div>
                    <span className="zpa-num">{toman(c.toman)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="zpa-sec">
          <h2>سفارش‌ها بر اساس وضعیت — {LABEL[period]}</h2>
          <div className="zpa-panel">
            {statuses.length === 0 ? <EmptyState title="سفارشی ثبت نشده" /> : (
              <div className="zpa-rows">
                {statuses.map(([s, n]) => (
                  <div className="zpa-row" key={s} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                    <Link href={`/admin/orders?status=${s}`}><span className={`zpa-tag ${statusTone(s)}`}>{ORDER_STATUS_FA[s] ?? s}</span></Link>
                    <span className="zpa-num">{fa(n)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      </>
      : null}
      {data ? <p style={{ color: 'var(--muted)', fontSize: 12 }}>فروش یعنی سفارش‌هایی که پرداخت شده‌اند (شامل در حال انجام و تکمیل‌شده)؛ سفارش‌های لغو یا ناموفق حساب نمی‌شوند.</p> : null}
    </>
  );
}
