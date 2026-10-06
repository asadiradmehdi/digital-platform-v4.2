import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ChevronLeft, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { formatTomanFromIRR, statusLabel } from '../../lib/format';
import { requireCurrentUser } from '../../server/identity/request-user';
import { query, withWorkspaceTransaction } from '../../server/core/db';

export const metadata: Metadata = { title: 'اشتراک‌ها', robots: { index: false, follow: false } };

const entitlementIcons: Record<string, typeof Sparkles> = {
  'ai_usage': Zap,
  'ai-usage': Zap,
  'priority_routing': TrendingUp,
  'automation_runs': Sparkles,
  'knowledge_base': ShieldCheck,
};

const entitlementLabel: Record<string, string> = {
  'ai_usage': 'مصرف هوش مصنوعی',
  'ai-usage': 'مصرف هوش مصنوعی',
  'priority_routing': 'مسیردهی اولویت',
  'automation_runs': 'اجرای اتوماسیون',
  'knowledge_base': 'پایگاه دانش',
};

async function getSubscriptions(workspaceId: string) {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const subs = await client.query<{
      id: string; status: string; planName: string; planId: string;
      priceMinor: string | null; currency: string | null;
      currentPeriodEnd: string; trialEndsAt: string | null;
    }>(
      `SELECT s.id, s.status, p.name AS "planName", p.id AS "planId",
              s.price_minor::text AS "priceMinor", s.currency,
              s.current_period_end AS "currentPeriodEnd",
              s.trial_ends_at AS "trialEndsAt"
       FROM subscriptions s
       JOIN plans p ON p.id=s.plan_id
       WHERE s.workspace_id=$1 AND s.status IN ('ACTIVE','TRIALING')
       ORDER BY s.created_at DESC`,
      [workspaceId],
    );

    const result = [];
    for (const sub of subs.rows) {
      const entitlements = await client.query<{ entitlement_key: string; value: string | null }>(
        `SELECT entitlement_key, value FROM plan_entitlements WHERE plan_id=$1 ORDER BY entitlement_key`,
        [sub.planId],
      );
      result.push({ ...sub, entitlements: entitlements.rows });
    }
    return result;
  });
}

export default async function Subscriptions() {
  let userId: string;
  try {
    userId = await requireCurrentUser();
  } catch {
    redirect('/auth');
  }

  const memberships = await query<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_members WHERE user_id=$1 AND status='ACTIVE' ORDER BY created_at LIMIT 1`,
    [userId],
  );
  const workspaceId = memberships.rows[0]?.workspace_id ?? null;

  const subscriptions = workspaceId ? await getSubscriptions(workspaceId) : [];
  const sub = subscriptions[0] ?? null;

  if (!sub) {
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
          <div className="state-block state-empty" style={{ marginTop: 40 }}>
            <Sparkles size={28}/>
            <h3>اشتراک فعالی ندارید</h3>
            <p>با انتخاب یک پلن، به امکانات پیشرفته دسترسی پیدا کنید.</p>
            <Link href="/pricing" className="button primary" style={{ marginTop: 14, textDecoration: 'none' }}>
              مشاهده پلن‌ها
            </Link>
          </div>
        </main>
      </AppShell>
    );
  }

  const renewalDate = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(sub.currentPeriodEnd));
  const isTrialing = sub.status === 'TRIALING';

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

        <article className="surface-panel" style={{ marginBottom: 14 }}>
          <div className="panel-head" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-soft)', border: '1px solid rgba(155,124,255,.18)', display: 'grid', placeItems: 'center', color: 'var(--accent-strong)' }}>
                <Sparkles size={20} />
              </div>
              <div>
                <p className="panel-kicker">CURRENT PLAN</p>
                <h2 style={{ marginTop: 3 }}>{sub.planName}</h2>
              </div>
            </div>
            <span className={`status-pill ${isTrialing ? 'info' : 'success'}`}>{statusLabel(sub.status)}</span>
          </div>

          <div className="metric-grid-4" style={{ marginBottom: 18 }}>
            <div className="metric-tile">
              <span>قیمت تمدید</span>
              <strong>{sub.priceMinor ? formatTomanFromIRR(Number(sub.priceMinor)) : '—'}</strong>
              <small>ثابت شده در زمان خرید</small>
            </div>
            <div className="metric-tile">
              <span>تمدید بعدی</span>
              <strong style={{ fontSize: 16 }}>{renewalDate}</strong>
              <small>تمدید خودکار</small>
            </div>
            {isTrialing && sub.trialEndsAt && (
              <div className="metric-tile">
                <span>پایان آزمایشی</span>
                <strong style={{ fontSize: 14 }}>
                  {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(sub.trialEndsAt))}
                </strong>
                <small>دوره رایگان</small>
              </div>
            )}
            <div className="metric-tile">
              <span>وضعیت</span>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 6, color: isTrialing ? 'var(--info)' : 'var(--success)' }}>
                <ShieldCheck size={18} />{statusLabel(sub.status)}
              </strong>
              <small>بدون محدودیت</small>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10, color: 'var(--muted)', paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <CalendarDays size={13} />
            قیمت renewal در زمان ثبت subscription snapshot می‌شود. هر بار تمدید در همان قیمت انجام می‌شود.
          </div>
        </article>

        {sub.entitlements.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p className="panel-kicker" style={{ marginBottom: 12 }}>ENTITLEMENTS</p>
            <div className="product-card-grid-premium">
              {sub.entitlements.map(({ entitlement_key, value }) => {
                const Icon = entitlementIcons[entitlement_key] ?? Sparkles;
                const label = entitlementLabel[entitlement_key] ?? entitlement_key;
                return (
                  <article className="product-card" key={entitlement_key} style={{ minHeight: 100 }}>
                    <div className="product-card-icon"><Icon size={16} /></div>
                    <div className="product-card-copy">
                      <div className="product-card-title"><h2>{label}</h2></div>
                      {value && <p style={{ color: 'var(--muted)', fontSize: 9 }}>{value}</p>}
                      <p style={{ color: 'var(--success)', fontSize: 9 }}>شامل پلن</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/wallet" className="button secondary">کیف پول</Link>
          <Link href="/pricing" className="button secondary">ارتقا پلن</Link>
        </div>
      </main>
    </AppShell>
  );
}
