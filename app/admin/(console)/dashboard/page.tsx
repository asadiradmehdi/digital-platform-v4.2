import Link from 'next/link';
import { requireCurrentUser } from '../../../../server/identity/request-user';
import { getRevenueDashboard, type Period } from '../../../../server/admin/console';
import { EmptyState, HiddenFlag, ORDER_STATUS_FA, PageHead, categoryName, fa, statusTone, toman } from '../ui';

const LABEL: Record<Period, string> = { today: 'امروز', d7: '۷ روز گذشته', d30: '۳۰ روز گذشته' };
const isPeriod = (p: string | undefined): p is Period => p === 'today' || p === 'd7' || p === 'd30';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const userId = await requireCurrentUser();
  const sp = await searchParams;
  const period: Period = isPeriod(sp.p) ? sp.p : 'd7';
  const data = await getRevenueDashboard(userId);
  const sales = data.sales[period];
  const topup = data.topups[period];
  const direct = data.direct[period];
  const payTotal = topup.toman + direct.toman;
  const cats = data.categories[period];
  const catMax = Math.max(1, ...cats.map(c => c.toman));
  const statuses = Object.entries(data.ordersByStatus[period]).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHead title="داشبورد" hint="درآمد و وضعیت سفارش‌ها؛ ساعت‌ها به وقت تهران است.">
        <div className="zpa-seg" role="tablist" aria-label="بازه‌ی زمانی">
          {(['today', 'd7', 'd30'] as Period[]).map(p => (
            <Link key={p} href={`/admin/dashboard?p=${p}`} aria-current={p === period}>{LABEL[p]}</Link>
          ))}
        </div>
      </PageHead>

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
                    <span className="zpa-num">{toman(x.toman)} · {fa(x.count)} پرداخت</span>
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
      <p style={{ color: 'var(--muted)', fontSize: 12 }}>فروش یعنی سفارش‌هایی که پرداخت شده‌اند (شامل در حال انجام و تکمیل‌شده)؛ سفارش‌های لغو یا ناموفق حساب نمی‌شوند.</p>
    </>
  );
}
