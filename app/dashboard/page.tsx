import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, ArrowLeft, Bot, ChevronLeft, Clock3, Plus, Sparkles, WalletCards, Zap } from 'lucide-react';
import { SystemStrip } from '../../components/ProductSurface';
import { AppShell } from '../../components/AppShell';
import { formatTomanFromIRR, statusLabel } from '../../lib/format';
import { requireCurrentUser } from '../../server/identity/request-user';
import { query, withWorkspaceTransaction } from '../../server/core/db';

export const metadata: Metadata = { title: 'خانه', robots: { index: false, follow: false } };

async function getDashboardStats(workspaceId: string, userId: string) {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    // Wallet balance
    const wallet = await client.query<{ balanceMinor: string }>(
      `SELECT COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE -le.amount_minor END),0)::text AS "balanceMinor"
       FROM wallets w
       LEFT JOIN ledger_accounts la ON la.wallet_id=w.id
       LEFT JOIN ledger_entries le ON le.account_id=la.id
       WHERE w.workspace_id=$1`,
      [workspaceId],
    );

    // Active orders count
    const orders = await client.query<{ count: string; processing: string }>(
      `SELECT COUNT(*)::text AS count,
              COUNT(*) FILTER (WHERE status='PROCESSING' OR status='PROVIDER_SUBMITTED')::text AS processing
       FROM orders WHERE workspace_id=$1 AND status IN ('PAID','QUEUED','PROCESSING','PROVIDER_SUBMITTED')`,
      [workspaceId],
    );

    // Active subscription
    const sub = await client.query<{ planName: string; currentPeriodEnd: string }>(
      `SELECT p.name AS "planName", s.current_period_end AS "currentPeriodEnd"
       FROM subscriptions s JOIN plans p ON p.id=s.plan_id
       WHERE s.workspace_id=$1 AND s.status IN ('ACTIVE','TRIALING')
       ORDER BY s.created_at DESC LIMIT 1`,
      [workspaceId],
    );

    // Recent order events
    const recentEvents = await client.query<{
      orderId: string; toStatus: string; createdAt: string;
    }>(
      `SELECT oe.order_id AS "orderId", oe.to_status AS "toStatus", oe.created_at AS "createdAt"
       FROM order_events oe
       JOIN orders o ON o.id=oe.order_id
       WHERE o.workspace_id=$1
       ORDER BY oe.created_at DESC LIMIT 5`,
      [workspaceId],
    );

    return {
      balanceMinor: Number(wallet.rows[0]?.balanceMinor ?? '0'),
      activeOrders: Number(orders.rows[0]?.count ?? '0'),
      processingOrders: Number(orders.rows[0]?.processing ?? '0'),
      planName: sub.rows[0]?.planName ?? null,
      planRenewal: sub.rows[0]?.currentPeriodEnd ?? null,
      recentEvents: recentEvents.rows,
    };
  });
}

function orderCode(id: string) {
  return `#DP-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export default async function Dashboard() {
  let userId: string;
  try {
    userId = await requireCurrentUser();
  } catch {
    redirect('/login');
  }

  const [memberships, userRow] = await Promise.all([
    query<{ workspace_id: string; workspace_name: string }>(
      `SELECT wm.workspace_id, w.name AS workspace_name
       FROM workspace_members wm JOIN workspaces w ON w.id=wm.workspace_id
       WHERE wm.user_id=$1 AND wm.status='ACTIVE' ORDER BY wm.created_at LIMIT 1`,
      [userId],
    ),
    query<{ display_name: string; email: string }>(
      `SELECT COALESCE(display_name, split_part(email,'@',1)) AS display_name, email FROM users WHERE id=$1`,
      [userId],
    ),
  ]);

  const workspaceId = memberships.rows[0]?.workspace_id ?? null;
  const workspaceName = memberships.rows[0]?.workspace_name ?? 'فضای کاری';
  const displayName = userRow.rows[0]?.display_name ?? 'کاربر';

  const stats = workspaceId ? await getDashboardStats(workspaceId, userId) : null;

  const statTiles = [
    {
      label: 'موجودی کیف پول',
      value: stats ? formatTomanFromIRR(stats.balanceMinor) : '—',
      meta: 'موجودی تأییدشده',
      Icon: WalletCards,
    },
    {
      label: 'سفارش‌های فعال',
      value: stats ? new Intl.NumberFormat('fa-IR').format(stats.activeOrders) : '—',
      meta: stats ? `${new Intl.NumberFormat('fa-IR').format(stats.processingOrders)} مورد در پردازش` : '',
      Icon: Activity,
    },
    {
      label: 'اشتراک فعال',
      value: stats?.planName ?? 'ندارید',
      meta: stats?.planRenewal ? `تا ${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(new Date(stats.planRenewal))}` : 'اشتراک فعال ندارید',
      Icon: Sparkles,
    },
    {
      label: 'هوش مصنوعی',
      value: '—',
      meta: 'بزودی',
      Icon: Bot,
    },
  ] as const;

  return (
    <AppShell>
      <main className="workspace-page-content">
        <section className="dash-hero">
          <div>
            <span className="eyebrow">امروز · {workspaceName}</span>
            <h1>سلام، {displayName}.</h1>
            <p>همه‌چیز برای ادامه کار آماده است. امروز چه چیزی را جلو ببریم؟</p>
          </div>
          <div className="hero-actions">
            <Link className="button secondary" href="/ai"><Sparkles size={17}/>شروع با AI</Link>
            <Link className="button primary" href="/services"><Plus size={17}/>سفارش جدید</Link>
          </div>
        </section>

        <SystemStrip/>

        <section className="stat-grid-premium">
          {statTiles.map(({ label, value, meta, Icon }) => (
            <article className="premium-stat" key={label}>
              <div className="stat-top"><span>{label}</span><Icon size={17}/></div>
              <strong>{value}</strong>
              <small>{meta}</small>
            </article>
          ))}
        </section>

        <section className="dashboard-main-grid">
          <article className="surface-panel activity-panel">
            <div className="panel-head">
              <div><span className="panel-kicker">فعالیت‌ها</span><h2>آخرین فعالیت‌ها</h2></div>
              <Link href="/orders">همه <ChevronLeft size={15}/></Link>
            </div>
            <div className="activity-stream">
              {stats && stats.recentEvents.length > 0 ? (
                stats.recentEvents.map((ev, i) => (
                  <div className="activity-item" key={i}>
                    <span className="activity-dot">
                      <Clock3 size={15}/>
                    </span>
                    <div>
                      <b>{orderCode(ev.orderId)}</b>
                      <p>{statusLabel(ev.toStatus)}</p>
                    </div>
                    <time>{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ev.createdAt))}</time>
                  </div>
                ))
              ) : (
                <div className="activity-item">
                  <span className="activity-dot"><Zap size={15}/></span>
                  <div><b>شروع کنید</b><p>اولین سفارش یا فعالیت خود را ثبت کنید.</p></div>
                </div>
              )}
            </div>
          </article>

          <article className="surface-panel command-panel">
            <div className="panel-head">
              <div><span className="panel-kicker">دسترسی سریع</span><h2>دسترسی سریع</h2></div>
            </div>
            <div className="quick-actions">
              <Link href="/ai">
                <Sparkles size={18}/><span><b>فضای هوش مصنوعی</b><small>ساخت و اجرای پروژه</small></span><ArrowLeft size={15}/>
              </Link>
              <Link href="/services">
                <Zap size={18}/><span><b>خدمات</b><small>انتخاب و سفارش</small></span><ArrowLeft size={15}/>
              </Link>
              <Link href="/automation">
                <Activity size={18}/><span><b>اتوماسیون</b><small>ساخت فرآیند خودکار</small></span><ArrowLeft size={15}/>
              </Link>
            </div>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
