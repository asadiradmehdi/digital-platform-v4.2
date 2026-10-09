import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { formatMoney } from '../../lib/format';
import { requireCurrentUser } from '../../server/identity/request-user';
import { isPlatformAdmin } from '../../server/identity/platform-admin';
import { query, withWorkspaceTransaction } from '../../server/core/db';

/** Every amount on this page is IRT (orders and plan prices are kept in toman). */
const formatIRT = (minor: number) => formatMoney(minor, 'IRT');

export const metadata: Metadata = { title: 'تحلیل و گزارش', robots: { index: false, follow: false } };

async function getAnalytics(workspaceId: string) {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const orders = await client.query<{
      revenueMinor: string; providerCostMinor: string; refundMinor: string;
    }>(
      // Orders are priced in IRT (toman); only IRT orders and same-currency provider costs are summed,
      // and revenue is summed per order (not per item row) so multi-item orders count once.
      `SELECT
         COALESCE(SUM(o.total_minor),0)::text AS "revenueMinor",
         COALESCE(SUM((SELECT SUM(oi.provider_cost_minor * oi.quantity) FROM order_items oi
                       WHERE oi.order_id=o.id AND oi.provider_cost_currency=o.currency)),0)::text AS "providerCostMinor",
         0::text AS "refundMinor"
       FROM orders o
       WHERE o.workspace_id=$1
         AND o.currency='IRT'
         AND o.status IN ('PAID','COMPLETED','PROCESSING','PROVIDER_SUBMITTED')
         AND o.created_at >= date_trunc('month', now())`,
      [workspaceId],
    );

    const mrr = await client.query<{ mrrMinor: string }>(
      `SELECT COALESCE(SUM(s.price_minor),0)::text AS "mrrMinor"
       FROM subscriptions s
       WHERE s.workspace_id=$1 AND s.status IN ('ACTIVE','TRIALING') AND s.currency='IRT'`,
      [workspaceId],
    );

    const members = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM workspace_members WHERE workspace_id=$1 AND status='ACTIVE'`,
      [workspaceId],
    );

    const rev = BigInt(orders.rows[0]?.revenueMinor ?? '0');
    const providerCost = BigInt(orders.rows[0]?.providerCostMinor ?? '0');
    const refund = BigInt(orders.rows[0]?.refundMinor ?? '0');
    const contribution = rev - providerCost - refund;

    return {
      revenueMinor: Number(rev),
      providerCostMinor: Number(providerCost),
      paymentCostMinor: 0,
      refundMinor: Number(refund),
      contributionMinor: Number(contribution > 0n ? contribution : 0n),
      mrrMinor: Number(mrr.rows[0]?.mrrMinor ?? '0'),
      activeUsers: Number(members.rows[0]?.count ?? '0'),
    };
  });
}

export default async function Analytics() {
  let userId: string;
  try {
    userId = await requireCurrentUser();
  } catch {
    redirect('/auth');
  }
  // Revenue, provider cost and margin are the business's own numbers: staff only, never customers.
  if (!(await isPlatformAdmin(userId))) redirect('/dashboard');

  const memberships = await query<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_members WHERE user_id=$1 AND status='ACTIVE' ORDER BY created_at LIMIT 1`,
    [userId],
  );
  const workspaceId = memberships.rows[0]?.workspace_id ?? null;

  const a = workspaceId
    ? await getAnalytics(workspaceId)
    : { revenueMinor: 0, providerCostMinor: 0, paymentCostMinor: 0, refundMinor: 0, contributionMinor: 0, mrrMinor: 0, activeUsers: 0 };

  const margin = a.revenueMinor > 0 ? a.contributionMinor / a.revenueMinor : 0;
  const providerRatio = a.revenueMinor > 0 ? a.providerCostMinor / a.revenueMinor : 0;
  const paymentRatio = a.revenueMinor > 0 ? a.paymentCostMinor / a.revenueMinor : 0;

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <span className="eyebrow">عملیات · تحلیل</span>
            <h1>تحلیل و گزارش</h1>
            <p>Revenue، هزینه‌ها و contribution margin از رویدادهای عملیاتی سمت سرور.</p>
          </div>
        </header>

        <section className="metric-grid-4" style={{ marginBottom: 16 }}>
          <article className="metric-tile">
            <span>Revenue</span>
            <strong>{formatIRT(a.revenueMinor)}</strong>
            <small>این ماه</small>
          </article>
          <article className="metric-tile">
            <span>Contribution</span>
            <strong>{formatIRT(a.contributionMinor)}</strong>
            <small style={{ color: a.revenueMinor > 0 ? 'var(--success)' : 'var(--muted)' }}>
              {(margin * 100).toFixed(1)}٪ margin
            </small>
          </article>
          <article className="metric-tile">
            <span>MRR</span>
            <strong>{formatIRT(a.mrrMinor)}</strong>
            <small>درآمد تکرارپذیر</small>
          </article>
          <article className="metric-tile">
            <span>اعضای فضای کاری</span>
            <strong>{new Intl.NumberFormat('fa-IR').format(a.activeUsers)}</strong>
            <small>عضو فعال</small>
          </article>
        </section>

        <div className="analytics-layout">
          <article className="surface-panel">
            <div className="panel-head" style={{ marginBottom: 18 }}>
              <div>
                <p className="panel-kicker">UNIT ECONOMICS</p>
                <h2>اقتصاد واحد</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {[
                { label: 'درآمد ناخالص', value: a.revenueMinor, color: 'var(--ink)', pct: 100 },
                { label: 'هزینه تأمین‌کننده', value: -a.providerCostMinor, color: 'var(--danger)', pct: providerRatio * 100 },
                { label: 'هزینه پرداخت', value: -a.paymentCostMinor, color: 'var(--warning)', pct: paymentRatio * 100 },
                { label: 'مرجوعی', value: -a.refundMinor, color: 'var(--danger)', pct: a.revenueMinor > 0 ? (a.refundMinor / a.revenueMinor) * 100 : 0 },
                { label: 'Contribution Margin', value: a.contributionMinor, color: 'var(--success)', pct: margin * 100 },
              ].map(({ label, value, color, pct }) => (
                <div key={label} style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                      {value >= 0 ? '' : '−'}{formatIRT(Math.abs(value))}
                    </span>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color === 'var(--success)' ? 'linear-gradient(90deg,var(--success),rgba(69,214,162,.6))' : color === 'var(--danger)' ? 'linear-gradient(90deg,var(--danger),rgba(255,113,135,.5))' : 'linear-gradient(90deg,var(--warning),rgba(244,189,97,.5))' }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <div>
                  <p className="panel-kicker">GROWTH</p>
                  <h2>شاخص‌های رشد</h2>
                </div>
              </div>
              <div className="order-meta-list">
                <div className="order-meta-row">
                  <span>MRR</span>
                  <strong>{formatIRT(a.mrrMinor)}</strong>
                </div>
                <div className="order-meta-row">
                  <span>اعضای فضای کاری</span>
                  <strong>{new Intl.NumberFormat('fa-IR').format(a.activeUsers)}</strong>
                </div>
                <div className="order-meta-row">
                  <span>ARPU</span>
                  <strong>{a.activeUsers > 0 ? formatIRT(Math.round(a.revenueMinor / a.activeUsers)) : '—'}</strong>
                </div>
              </div>
            </article>

            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <div>
                  <p className="panel-kicker">MARGIN SUMMARY</p>
                  <h2>خلاصه margin</h2>
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--success)', letterSpacing: '-.04em' }}>
                  {(margin * 100).toFixed(1)}٪
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Contribution Margin</div>
                <div className="progress-track" style={{ marginTop: 16 }}>
                  <i style={{ width: `${Math.min(margin * 100, 100)}%` }} />
                </div>
              </div>
            </article>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
