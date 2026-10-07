import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowUpLeft, CalendarDays, CheckCircle2, ChevronLeft,
  ShieldCheck, Sparkles, TrendingUp, Zap,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';
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

  /* ── Empty state ─────────────────────────────────────────────── */
  if (!sub) {
    return (
      <AppShell>
        <main className="workspace-page-content">
          <header className="page-header" style={{ marginBottom: 28 }}>
            <div>
              <span className="eyebrow">مالی · اشتراک‌ها</span>
              <h1>اشتراک‌ها</h1>
            </div>
            <Link className="button secondary" href="/pricing">
              مقایسه پلن‌ها <ChevronLeft size={14} />
            </Link>
          </header>

          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-xl)',
              padding: '56px 32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              marginTop: 8,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 20,
                background: 'var(--accent-soft)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--accent)',
                marginBottom: 4,
              }}
            >
              <Sparkles size={26} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-.02em' }}>
              اشتراک فعالی ندارید
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.85, maxWidth: 380, margin: 0 }}>
              با انتخاب یک پلن، به مدل‌های هوش مصنوعی، اتوماسیون و امکانات پیشرفته دسترسی پیدا کنید.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Link href="/pricing" className="button primary" style={{ textDecoration: 'none' }}>
                مشاهده پلن‌ها <ArrowUpLeft size={14} />
              </Link>
              <Link href="/wallet" className="button secondary" style={{ textDecoration: 'none' }}>
                کیف پول
              </Link>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  const renewalDate = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long' }).format(
    new Date(sub.currentPeriodEnd),
  );
  const isTrialing = sub.status === 'TRIALING';
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(sub.currentPeriodEnd).getTime() - Date.now()) / 86_400_000),
  );

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header" style={{ marginBottom: 28 }}>
          <div>
            <span className="eyebrow">مالی · اشتراک‌ها</span>
            <h1>اشتراک‌ها</h1>
          </div>
          <Link className="button secondary" href="/pricing">
            ارتقای پلن <ChevronLeft size={14} />
          </Link>
        </header>

        {/* ── Active plan hero card ─────────────────────────────── */}
        <article
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xl)',
            padding: '28px 28px 24px',
            marginBottom: 16,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* subtle accent backdrop */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              insetInlineEnd: -60,
              top: -60,
              width: 260,
              height: 260,
              borderRadius: '50%',
              background: 'var(--accent-soft)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
                marginBottom: 24,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: 'var(--accent-soft)',
                    border: '1px solid rgba(26,86,219,.15)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--accent)',
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={22} />
                </div>
                <div>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '.1em',
                      color: 'var(--accent)',
                      marginBottom: 3,
                      textTransform: 'uppercase',
                    }}
                  >
                    پلن فعال
                  </span>
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      margin: 0,
                      letterSpacing: '-.03em',
                    }}
                  >
                    {sub.planName}
                  </h2>
                </div>
              </div>
              <span className={`status-pill ${isTrialing ? 'info' : 'success'}`}>
                {isTrialing ? (
                  <>{statusLabel(sub.status)} · {sub.trialEndsAt ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(new Date(sub.trialEndsAt)) : ''}</>
                ) : statusLabel(sub.status)}
              </span>
            </div>

            {/* Metrics */}
            <div className="metric-grid-4">
              <div className="metric-tile">
                <span>قیمت تمدید</span>
                <strong>
                  {sub.priceMinor ? formatTomanFromIRR(Number(sub.priceMinor)) : '—'}
                </strong>
                <small>ثابت در زمان خرید</small>
              </div>
              <div className="metric-tile">
                <span>تمدید بعدی</span>
                <strong style={{ fontSize: 16, letterSpacing: 0 }}>{renewalDate}</strong>
                <small>تمدید خودکار</small>
              </div>
              <div className="metric-tile">
                <span>روزهای باقی‌مانده</span>
                <strong style={{ color: daysLeft < 7 ? 'var(--warning)' : 'var(--ink)' }}>
                  {daysLeft}
                </strong>
                <small>روز</small>
              </div>
              <div className="metric-tile">
                <span>وضعیت</span>
                <strong
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 18,
                    color: isTrialing ? 'var(--info)' : 'var(--success)',
                  }}
                >
                  {isTrialing ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
                  {statusLabel(sub.status)}
                </strong>
                <small>بدون قطعی</small>
              </div>
            </div>

            {/* Renewal note */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                color: 'var(--subtle)',
                paddingTop: 14,
                borderTop: '1px solid var(--line)',
              }}
            >
              <CalendarDays size={13} />
              قیمت renewal در زمان ثبت subscription snapshot می‌شود. هر تمدید در همان قیمت انجام می‌شود.
            </div>
          </div>
        </article>

        {/* ── Entitlements ─────────────────────────────────────── */}
        {sub.entitlements.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <span className="eyebrow">امکانات پلن</span>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 0', letterSpacing: '-.02em' }}>
                شامل در اشتراک شما
              </h2>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              {sub.entitlements.map(({ entitlement_key, value }) => {
                const Icon = entitlementIcons[entitlement_key] ?? Sparkles;
                const label = entitlementLabel[entitlement_key] ?? entitlement_key;
                return (
                  <div
                    key={entitlement_key}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px 18px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: 'var(--accent-soft)',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'var(--accent)',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{label}</div>
                      {value && (
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{value}</div>
                      )}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 9,
                          color: 'var(--success)',
                          marginTop: 4,
                        }}
                      >
                        <CheckCircle2 size={10} />
                        شامل پلن
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Actions ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/wallet" className="button secondary">
            کیف پول
          </Link>
          <Link href="/pricing" className="button secondary">
            مقایسه پلن‌ها
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
