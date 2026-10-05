import type { Metadata } from 'next';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { analyticsFixture } from '../../lib/product-fixtures';
import { formatTomanFromIRR } from '../../lib/format';

export const metadata: Metadata = { title: 'تحلیل و گزارش', robots: { index: false, follow: false } };

export default function Analytics() {
  const a = analyticsFixture;
  const margin = a.contributionMinor / a.revenueMinor;
  const providerRatio = a.providerCostMinor / a.revenueMinor;
  const paymentRatio = a.paymentCostMinor / a.revenueMinor;

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

        <SystemStrip />

        {/* KPI Grid */}
        <section className="metric-grid-4" style={{ marginBottom: 16 }}>
          <article className="metric-tile">
            <span>Revenue</span>
            <strong>{formatTomanFromIRR(a.revenueMinor)}</strong>
            <small>این ماه</small>
          </article>
          <article className="metric-tile">
            <span>Contribution</span>
            <strong>{formatTomanFromIRR(a.contributionMinor)}</strong>
            <small style={{ color: 'var(--success)' }}>
              {(margin * 100).toFixed(1)}٪ margin
            </small>
          </article>
          <article className="metric-tile">
            <span>MRR</span>
            <strong>{formatTomanFromIRR(a.mrrMinor)}</strong>
            <small>درآمد تکرارپذیر</small>
          </article>
          <article className="metric-tile">
            <span>کاربران فعال</span>
            <strong>{new Intl.NumberFormat('fa-IR').format(a.activeUsers)}</strong>
            <small>این ماه</small>
          </article>
        </section>

        <div className="analytics-layout">
          {/* Unit Economics */}
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
                { label: 'مرجوعی', value: -a.refundMinor, color: 'var(--danger)', pct: (a.refundMinor / a.revenueMinor) * 100 },
                { label: 'Contribution Margin', value: a.contributionMinor, color: 'var(--success)', pct: margin * 100 },
              ].map(({ label, value, color, pct }) => (
                <div key={label} style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                      {value >= 0 ? '' : '−'}{formatTomanFromIRR(Math.abs(value))}
                    </span>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${Math.min(pct, 100)}%`, background: color === 'var(--success)' ? 'linear-gradient(90deg,var(--success),rgba(69,214,162,.6))' : color === 'var(--danger)' ? 'linear-gradient(90deg,var(--danger),rgba(255,113,135,.5))' : 'linear-gradient(90deg,var(--warning),rgba(244,189,97,.5))' }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* Growth metrics */}
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
                  <strong>{formatTomanFromIRR(a.mrrMinor)}</strong>
                </div>
                <div className="order-meta-row">
                  <span>کاربران فعال</span>
                  <strong>{new Intl.NumberFormat('fa-IR').format(a.activeUsers)}</strong>
                </div>
                <div className="order-meta-row">
                  <span>ARPU</span>
                  <strong>{formatTomanFromIRR(Math.round(a.revenueMinor / a.activeUsers))}</strong>
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
                  <i style={{ width: `${margin * 100}%` }} />
                </div>
              </div>
            </article>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
