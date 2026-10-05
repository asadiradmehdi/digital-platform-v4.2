import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { subscriptionFixture } from '../../lib/product-fixtures';
import { formatTomanFromIRR } from '../../lib/format';

export const metadata: Metadata = { title: 'اشتراک‌ها', robots: { index: false, follow: false } };

const entitlementIcons: Record<string, typeof Sparkles> = {
  'AI usage': Zap,
  'Priority routing': TrendingUp,
  'Automation runs': Sparkles,
  'Knowledge base': ShieldCheck,
};

export default function Subscriptions() {
  const sub = subscriptionFixture;
  const renewalDate = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(sub.renewalDate));

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <span className="eyebrow">مالی · اشتراک‌ها</span>
            <h1>اشتراک‌ها</h1>
            <p>Entitlement، قیمت تمدید و مصرف از Pricing Engine سمت سرور.</p>
          </div>
          <Link className="button secondary" href="/pricing">
            مقایسه پلن‌ها <ChevronLeft size={14} />
          </Link>
        </header>

        <SystemStrip />

        {/* Plan card */}
        <article className="surface-panel" style={{ marginBottom: 14 }}>
          <div className="panel-head" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-soft)', border: '1px solid rgba(155,124,255,.18)', display: 'grid', placeItems: 'center', color: 'var(--accent-strong)' }}>
                <Sparkles size={20} />
              </div>
              <div>
                <p className="panel-kicker">CURRENT PLAN</p>
                <h2 style={{ marginTop: 3 }}>{sub.plan}</h2>
              </div>
            </div>
            <span className="status-pill success">فعال</span>
          </div>

          <div className="metric-grid-4" style={{ marginBottom: 18 }}>
            <div className="metric-tile">
              <span>قیمت تمدید</span>
              <strong>{formatTomanFromIRR(sub.priceMinor)}</strong>
              <small>ثابت شده در زمان خرید</small>
            </div>
            <div className="metric-tile">
              <span>تمدید بعدی</span>
              <strong style={{ fontSize: 16 }}>{renewalDate}</strong>
              <small>تمدید خودکار</small>
            </div>
            <div className="metric-tile">
              <span>مصرف دوره</span>
              <strong>{sub.usagePercent}٪</strong>
              <small>از سقف استفاده‌شده</small>
            </div>
            <div className="metric-tile">
              <span>وضعیت</span>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)' }}>
                <ShieldCheck size={18} />فعال
              </strong>
              <small>بدون محدودیت</small>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 8 }}>
              <span>مصرف این دوره</span>
              <span>{sub.usagePercent}٪</span>
            </div>
            <div className="progress-track">
              <i style={{ width: `${sub.usagePercent}%` }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10, color: 'var(--muted)', paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <CalendarDays size={13} />
            قیمت renewal در زمان ثبت subscription snapshot می‌شود. هر بار تمدید در همان قیمت انجام می‌شود.
          </div>
        </article>

        {/* Entitlements */}
        <div style={{ marginBottom: 14 }}>
          <p className="panel-kicker" style={{ marginBottom: 12 }}>ENTITLEMENTS</p>
          <div className="product-card-grid-premium">
            {sub.entitlements.map(name => {
              const Icon = entitlementIcons[name] ?? Sparkles;
              return (
                <article className="product-card" key={name} style={{ minHeight: 100 }}>
                  <div className="product-card-icon"><Icon size={16} /></div>
                  <div className="product-card-copy">
                    <div className="product-card-title"><h2>{name}</h2></div>
                    <p style={{ color: 'var(--success)', fontSize: 9 }}>شامل پلن</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/wallet" className="button secondary">کیف پول</Link>
          <Link href="/pricing" className="button secondary">ارتقا پلن</Link>
        </div>
      </main>
    </AppShell>
  );
}
