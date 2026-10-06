import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, AlertTriangle, CheckCircle2, Clock, CreditCard, Package, RefreshCw, ShieldCheck, Users, Zap } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { requireCurrentUser } from '../../server/identity/request-user';
import { isPlatformAdmin } from '../../server/identity/platform-admin';
import { query } from '../../server/core/db';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

async function getAdminStats() {
  const [orders, payments, subs, providers, alerts, users] = await Promise.all([
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM orders GROUP BY status`,
      [],
    ),
    query<{ status: string; count: string; total: string }>(
      `SELECT status, COUNT(*)::text AS count, COALESCE(SUM(amount_minor),0)::text AS total FROM payments GROUP BY status`,
      [],
    ),
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM subscriptions GROUP BY status`,
      [],
    ),
    query<{ provider_id: string; status: string; latency_ms: number; checked_at: string }>(
      `SELECT DISTINCT ON (provider_id) provider_id, status, latency_ms, checked_at
       FROM provider_health_checks ORDER BY provider_id, checked_at DESC`,
      [],
    ),
    query<{ severity: string; count: string; last_at: string }>(
      `SELECT severity, COUNT(*)::text AS count, MAX(created_at)::text AS last_at
       FROM operational_events WHERE created_at > now() - interval '24 hours'
       GROUP BY severity ORDER BY severity`,
      [],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users`,
      [],
    ),
  ]);

  const orderMap = Object.fromEntries(orders.rows.map(r => [r.status, Number(r.count)]));
  const paymentMap = Object.fromEntries(payments.rows.map(r => [r.status, { count: Number(r.count), total: BigInt(r.total) }]));
  const subMap = Object.fromEntries(subs.rows.map(r => [r.status, Number(r.count)]));
  const alertBySev = Object.fromEntries(alerts.rows.map(r => [r.severity, { count: Number(r.count), lastAt: r.last_at }]));

  return { orderMap, paymentMap, subMap, providers: providers.rows, alertBySev, userCount: Number(users.rows[0]?.count ?? 0) };
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'HEALTHY' ? 'var(--success)' : status === 'DEGRADED' ? 'var(--warning)' : 'var(--danger)';
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginInlineEnd: 6 }}/>;
}

export default async function AdminPage() {
  let userId: string;
  try { userId = await requireCurrentUser(); } catch { redirect('/auth'); }

  const isAdmin = await isPlatformAdmin(userId);
  if (!isAdmin) {
    return (
      <AppShell>
        <main className="workspace-page-content">
          <div className="state-block state-error" style={{ marginTop: 60 }}>
            <ShieldCheck size={28}/>
            <h3>دسترسی محدود</h3>
            <p>این صفحه تنها برای مدیران پلتفرم قابل دسترسی است.</p>
          </div>
        </main>
      </AppShell>
    );
  }

  const stats = await getAdminStats();
  const { orderMap, paymentMap, subMap, providers, alertBySev, userCount } = stats;

  const totalOrders = Object.values(orderMap).reduce((a, b) => a + b, 0);
  const activeOrders = (orderMap['QUEUED'] ?? 0) + (orderMap['PROCESSING'] ?? 0) + (orderMap['PROVIDER_SUBMITTED'] ?? 0);
  const failedOrders = (orderMap['FAILED'] ?? 0);
  const paidPayments = paymentMap['PAID']?.count ?? 0;
  const activeSubs = (subMap['ACTIVE'] ?? 0) + (subMap['TRIALING'] ?? 0);
  const criticalAlerts = alertBySev['CRITICAL']?.count ?? 0;
  const errorAlerts = alertBySev['ERROR']?.count ?? 0;

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div><span className="eyebrow">PLATFORM · ADMIN</span><h1>پنل مدیریت</h1><p>دید عملیاتی سفارش‌ها، پرداخت‌ها، ارائه‌دهندگان و رویدادهای ۲۴ ساعت اخیر.</p></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link className="button secondary" href="/admin/orders">سفارش‌ها</Link>
            <Link className="button secondary" href="/admin/providers">ارائه‌دهندگان</Link>
          </div>
        </header>
        <SystemStrip/>

        {/* KPI grid */}
        <div className="metric-grid-4" style={{ marginBottom: 20 }}>
          <div className="metric-tile">
            <span><Users size={13} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }}/>کاربران</span>
            <strong>{new Intl.NumberFormat('fa-IR').format(userCount)}</strong>
          </div>
          <div className="metric-tile">
            <span><Package size={13} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }}/>سفارش‌های فعال</span>
            <strong style={{ color: activeOrders > 0 ? 'var(--accent-strong)' : undefined }}>{new Intl.NumberFormat('fa-IR').format(activeOrders)}</strong>
            <small>از {new Intl.NumberFormat('fa-IR').format(totalOrders)} کل</small>
          </div>
          <div className="metric-tile">
            <span><CreditCard size={13} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }}/>پرداخت‌های موفق</span>
            <strong>{new Intl.NumberFormat('fa-IR').format(paidPayments)}</strong>
          </div>
          <div className="metric-tile">
            <span><Zap size={13} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }}/>اشتراک‌های فعال</span>
            <strong>{new Intl.NumberFormat('fa-IR').format(activeSubs)}</strong>
          </div>
        </div>

        <div className="settings-layout">
          {/* Orders by status */}
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">ORDERS</span><h2>وضعیت سفارش‌ها</h2></div></div>
            {totalOrders === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>سفارشی ثبت نشده.</p>
            ) : (
              <table className="data-table" style={{ marginTop: 10 }}>
                <thead><tr><th>وضعیت</th><th>تعداد</th></tr></thead>
                <tbody>
                  {Object.entries(orderMap).sort(([, a], [, b]) => b - a).map(([status, count]) => (
                    <tr key={status}>
                      <td>
                        <span className={`status-pill ${status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'error' : status === 'QUEUED' || status === 'PROCESSING' ? 'info' : 'warning'}`} style={{ fontSize: 9 }}>{status}</span>
                      </td>
                      <td><strong>{new Intl.NumberFormat('fa-IR').format(count)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {failedOrders > 0 && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--danger)' }}>
                <AlertTriangle size={14}/>{new Intl.NumberFormat('fa-IR').format(failedOrders)} سفارش ناموفق
              </div>
            )}
          </article>

          {/* Provider health */}
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">PROVIDERS</span><h2>سلامت ارائه‌دهندگان</h2></div></div>
            {providers.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>هیچ ارائه‌دهنده‌ای ثبت نشده.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {providers.map(p => (
                  <div key={p.provider_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12 }}>
                    <StatusDot status={p.status}/>
                    <code style={{ fontFamily: 'monospace', fontSize: 10, direction: 'ltr', flex: 1 }}>{p.provider_id.slice(0, 8)}…</code>
                    <span style={{ color: 'var(--muted)' }}>{p.latency_ms}ms</span>
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>{new Date(p.checked_at).toLocaleTimeString('fa-IR')}</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          {/* Subscriptions */}
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">SUBSCRIPTIONS</span><h2>اشتراک‌ها</h2></div></div>
            {Object.keys(subMap).length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>اشتراکی وجود ندارد.</p>
            ) : (
              <table className="data-table" style={{ marginTop: 10 }}>
                <thead><tr><th>وضعیت</th><th>تعداد</th></tr></thead>
                <tbody>
                  {Object.entries(subMap).map(([status, count]) => (
                    <tr key={status}>
                      <td><span className={`status-pill ${status === 'ACTIVE' ? 'success' : status === 'PAST_DUE' ? 'error' : 'info'}`} style={{ fontSize: 9 }}>{status}</span></td>
                      <td><strong>{new Intl.NumberFormat('fa-IR').format(count)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          {/* Operational events (last 24h) */}
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head">
              <div><span className="panel-kicker">EVENTS / 24H</span><h2>رویدادهای عملیاتی</h2></div>
              {(criticalAlerts + errorAlerts) > 0 && (
                <span className="status-pill error" style={{ fontSize: 10 }}>{criticalAlerts + errorAlerts} خطا</span>
              )}
            </div>
            {Object.keys(alertBySev).length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--success)', fontSize: 12 }}>
                <CheckCircle2 size={16}/>رویداد غیرعادی در ۲۴ ساعت گذشته ثبت نشده.
              </div>
            ) : (
              <table className="data-table" style={{ marginTop: 10 }}>
                <thead><tr><th>سطح</th><th>تعداد</th><th>آخرین بار</th></tr></thead>
                <tbody>
                  {Object.entries(alertBySev).map(([sev, { count, lastAt }]) => (
                    <tr key={sev}>
                      <td><span className={`status-pill ${sev === 'CRITICAL' || sev === 'ERROR' ? 'error' : sev === 'WARNING' ? 'warning' : 'info'}`} style={{ fontSize: 9 }}>{sev}</span></td>
                      <td><strong>{new Intl.NumberFormat('fa-IR').format(count)}</strong></td>
                      <td style={{ fontSize: 10, color: 'var(--muted)' }}>{new Date(lastAt).toLocaleString('fa-IR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          {/* Quick actions */}
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">ACTIONS</span><h2>عملیات سریع</h2></div></div>
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              <Link href="/api/internal/metrics" target="_blank" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, textDecoration: 'none', color: 'var(--ink)' }}>
                <Activity size={15} style={{ color: 'var(--accent-strong)' }}/>
                <span>Metrics JSON</span>
                <code style={{ fontSize: 10, color: 'var(--muted)', marginInlineStart: 'auto', fontFamily: 'monospace', direction: 'ltr' }}>GET /api/internal/metrics</code>
              </Link>
              <Link href="/api/v1/health" target="_blank" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, textDecoration: 'none', color: 'var(--ink)' }}>
                <CheckCircle2 size={15} style={{ color: 'var(--success)' }}/>
                <span>Health Check</span>
                <code style={{ fontSize: 10, color: 'var(--muted)', marginInlineStart: 'auto', fontFamily: 'monospace', direction: 'ltr' }}>GET /api/v1/health</code>
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
                <RefreshCw size={15}/>
                <span>تمدید اشتراک‌ها</span>
                <code style={{ fontSize: 10, marginInlineStart: 'auto', fontFamily: 'monospace', direction: 'ltr' }}>POST /api/internal/queue/renewal</code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
                <Clock size={15}/>
                <span>پردازش صف خروجی</span>
                <code style={{ fontSize: 10, marginInlineStart: 'auto', fontFamily: 'monospace', direction: 'ltr' }}>POST /api/internal/queue/outbox</code>
              </div>
            </div>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
