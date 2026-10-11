import { requireCurrentUser } from '../../../../server/identity/request-user';
import { isPlatformAdmin } from '../../../../server/identity/platform-admin';
import { getPlatformAdminStats } from '../../../../server/admin/platform-stats';
import { NoAccess } from '../guard';
import { EmptyState, PageHead, fa } from '../ui';

const PROVIDER_STATE: Record<string, [string, string]> = { HEALTHY: ['سالم', 'ok'], DEGRADED: ['ضعیف', 'warn'], OFFLINE: ['قطع', 'bad'] };

/** Owner-only technical overview: queue, providers and recent errors in the console's own look. */
export default async function SystemPage() {
  const userId = await requireCurrentUser();
  if (!(await isPlatformAdmin(userId))) return <NoAccess />;
  const s = await getPlatformAdminStats(userId);
  const total = Object.values(s.orderMap).reduce((a, b) => a + b, 0);
  const failed = s.orderMap.FAILED ?? 0;
  const errors = (s.alertBySev.CRITICAL?.count ?? 0) + (s.alertBySev.ERROR?.count ?? 0);
  const sick = s.providers.filter(p => p.status !== 'HEALTHY');
  return (
    <>
      <PageHead title="وضعیت فنی" hint="صف انجام، ارائه‌دهندگان خدمت و خطاهای ۲۴ ساعت گذشته." back={{ href: '/admin/dashboard', label: 'داشبورد' }} />
      {sick.length > 0 || errors > 0 ? (
        <div className="zpa-state err" role="alert" style={{ marginBottom: 14 }}>
          <h3>نیاز به بررسی</h3>
          <p>{sick.length > 0 ? `${fa(sick.length)} ارائه‌دهنده سالم نیست. ` : ''}{errors > 0 ? `${fa(errors)} خطا در ۲۴ ساعت گذشته ثبت شده است.` : ''}</p>
        </div>
      ) : null}
      <section className="zpa-sec" aria-label="خلاصه">
        <div className="zpa-grid">
          <div className="zpa-panel zpa-stat"><small>سفارش ۲۴ ساعت گذشته</small><b>{fa(s.orders24hCount)}</b><span>از {fa(total)} سفارش کل</span></div>
          <div className="zpa-panel zpa-stat"><small>در صف انجام</small><b>{fa(s.queueTotal)}</b><span>{failed > 0 ? `${fa(failed)} سفارش ناموفق` : 'سفارش ناموفقی نیست'}</span></div>
          <div className="zpa-panel zpa-stat"><small>کاربران</small><b>{fa(s.userCount)}</b><span>{fa(s.providers.filter(p => p.status === 'HEALTHY').length)} از {fa(s.providers.length)} ارائه‌دهنده سالم</span></div>
        </div>
      </section>
      <section className="zpa-sec" aria-labelledby="sys-prov">
        <h2 id="sys-prov">ارائه‌دهندگان خدمت</h2>
        {s.providers.length === 0 ? <EmptyState title="هنوز ارائه‌دهنده‌ای ثبت نشده" hint="پس از اتصال حساب ارائه‌دهنده، وضعیتش اینجا دیده می‌شود." /> : (
          <ul className="zpa-list">
            {s.providers.map(p => {
              const [label, tone] = PROVIDER_STATE[p.status] ?? [p.status, 'warn'];
              return (
                <li key={p.provider_id} className="zpa-item">
                  <div className="zpa-item-top"><b className="zpa-ltr">{p.provider_id.length > 22 ? `${p.provider_id.slice(0, 22)}…` : p.provider_id}</b><span className={`zpa-tag ${tone}`}>{label}</span></div>
                  <div className="zpa-item-sub"><span>تأخیر {fa(p.latency_ms)} میلی‌ثانیه</span><span>{new Date(p.checked_at).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</span></div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
