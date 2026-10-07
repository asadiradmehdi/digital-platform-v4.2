import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Package,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
  Server,
  TrendingUp,
  AlertCircle,
  Circle,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { requireCurrentUser } from '../../server/identity/request-user';
import { isPlatformAdmin } from '../../server/identity/platform-admin';
import { query } from '../../server/core/db';

export const metadata: Metadata = { title: 'Admin — پنل عملیاتی', robots: { index: false, follow: false } };

async function getAdminStats() {
  const [orders, orders24h, payments, subs, providers, alerts, users, queueStats] = await Promise.all([
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM orders GROUP BY status`,
      [],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM orders WHERE created_at > now() - interval '24 hours'`,
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
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM orders
       WHERE status IN ('QUEUED','PROCESSING','PROVIDER_SUBMITTED')
       GROUP BY status`,
      [],
    ),
  ]);

  const orderMap = Object.fromEntries(orders.rows.map(r => [r.status, Number(r.count)]));
  const paymentMap = Object.fromEntries(payments.rows.map(r => [r.status, { count: Number(r.count), total: BigInt(r.total) }]));
  const subMap = Object.fromEntries(subs.rows.map(r => [r.status, Number(r.count)]));
  const alertBySev = Object.fromEntries(alerts.rows.map(r => [r.severity, { count: Number(r.count), lastAt: r.last_at }]));
  const queueTotal = queueStats.rows.reduce((acc, r) => acc + Number(r.count), 0);
  const orders24hCount = Number(orders24h.rows[0]?.count ?? 0);

  return {
    orderMap,
    paymentMap,
    subMap,
    providers: providers.rows,
    alertBySev,
    userCount: Number(users.rows[0]?.count ?? 0),
    queueTotal,
    orders24hCount,
  };
}

/** Translates an order/subscription status to a human-readable Persian label */
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: 'تکمیل‌شده',
    FAILED: 'ناموفق',
    QUEUED: 'در صف',
    PROCESSING: 'در حال پردازش',
    PROVIDER_SUBMITTED: 'ارسال‌شده',
    REFUNDED: 'بازگشت‌خورده',
    ACTIVE: 'فعال',
    TRIALING: 'آزمایشی',
    PAST_DUE: 'سررسیدگذشته',
    CANCELED: 'لغوشده',
  };
  return map[status] ?? status;
}

function statusPillClass(status: string): string {
  if (['COMPLETED', 'ACTIVE', 'TRIALING', 'HEALTHY'].includes(status)) return 'success';
  if (['FAILED', 'PAST_DUE', 'ERROR', 'CRITICAL', 'OFFLINE'].includes(status)) return 'danger';
  if (['QUEUED', 'PROCESSING', 'PROVIDER_SUBMITTED'].includes(status)) return 'info';
  if (['REFUNDED', 'CANCELED', 'WARNING', 'DEGRADED'].includes(status)) return 'warning';
  return '';
}

function ProviderStatusIcon({ status }: { status: string }) {
  if (status === 'HEALTHY') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--success-soft)' }}>
        <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
      </span>
    );
  }
  if (status === 'DEGRADED') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--warning-soft)' }}>
        <AlertCircle size={13} style={{ color: 'var(--warning)' }} />
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--danger-soft)' }}>
      <Circle size={13} style={{ color: 'var(--danger)' }} />
    </span>
  );
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
            <ShieldCheck size={28} />
            <h3>دسترسی محدود</h3>
            <p>این صفحه تنها برای مدیران پلتفرم قابل دسترسی است.</p>
          </div>
        </main>
      </AppShell>
    );
  }

  const stats = await getAdminStats();
  const { orderMap, paymentMap, subMap, providers, alertBySev, userCount, queueTotal, orders24hCount } = stats;

  const totalOrders = Object.values(orderMap).reduce((a, b) => a + b, 0);
  const activeOrders = (orderMap['QUEUED'] ?? 0) + (orderMap['PROCESSING'] ?? 0) + (orderMap['PROVIDER_SUBMITTED'] ?? 0);
  const failedOrders = orderMap['FAILED'] ?? 0;
  const paidPayments = paymentMap['PAID']?.count ?? 0;
  const activeSubs = (subMap['ACTIVE'] ?? 0) + (subMap['TRIALING'] ?? 0);
  const criticalAlerts = alertBySev['CRITICAL']?.count ?? 0;
  const errorAlerts = alertBySev['ERROR']?.count ?? 0;
  const degradedProviders = providers.filter(p => p.status === 'DEGRADED' || p.status === 'OFFLINE');
  const healthyProviders = providers.filter(p => p.status === 'HEALTHY');
  const hasAlerts = (criticalAlerts + errorAlerts) > 0 || degradedProviders.length > 0;

  const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

  return (
    <AppShell>
      <main className="workspace-page-content">

        {/* ── Page header ── */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          paddingBottom: 18,
          marginBottom: 0,
          borderBottom: '1px solid var(--line)',
        }}>
          <div>
            <span style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: 'var(--accent)', fontFamily: 'var(--font-latin)', marginBottom: 3 }}>
              ADMIN · OPERATIONS
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 3px', color: 'var(--ink)' }}>
              پنل عملیاتی
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 11, margin: 0 }}>
              سفارش‌ها، ارائه‌دهندگان و رویدادهای ۲۴ ساعت گذشته
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <Link className="button secondary" href="/admin/orders" style={{ fontSize: 11, height: 36, minHeight: 36 }}>
              <Package size={13} />
              سفارش‌ها
            </Link>
            <Link className="button secondary" href="/admin/providers" style={{ fontSize: 11, height: 36, minHeight: 36 }}>
              <Server size={13} />
              ارائه‌دهندگان
            </Link>
            <Link className="button primary" href="/api/v1/health" target="_blank" style={{ fontSize: 11, height: 36, minHeight: 36 }}>
              <Activity size={13} />
              Health Check
            </Link>
          </div>
        </header>

        <SystemStrip />

        {/* ── Critical alert banner (only when issues present) ── */}
        {hasAlerts && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 18px',
            background: 'var(--danger-soft)',
            border: '1px solid rgba(220,38,38,.2)',
            borderRadius: 14,
            marginBottom: 16,
          }}>
            <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>
                هشدار عملیاتی
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--danger)', lineHeight: 1.7 }}>
                {degradedProviders.length > 0 && (
                  <span>{degradedProviders.length} ارائه‌دهنده با مشکل مواجه است. </span>
                )}
                {(criticalAlerts + errorAlerts) > 0 && (
                  <span>{fmt(criticalAlerts + errorAlerts)} رویداد خطا در ۲۴ ساعت اخیر ثبت شده است.</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* ── KPI stat band ── */}
        <div className="stat-grid-premium" style={{ marginBottom: 16 }}>
          {/* Orders in 24h */}
          <div className="premium-stat">
            <div className="stat-top">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--muted)' }}>
                <Clock size={12} />
                سفارش‌های ۲۴ ساعت
              </span>
              <TrendingUp size={13} style={{ color: 'var(--accent)', opacity: .7 }} />
            </div>
            <strong style={{ fontSize: 28, fontVariantNumeric: 'tabular-nums' }}>{fmt(orders24hCount)}</strong>
            <small style={{ fontSize: 10 }}>از {fmt(totalOrders)} کل سفارش</small>
          </div>

          {/* Queue depth */}
          <div className="premium-stat">
            <div className="stat-top">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--muted)' }}>
                <RefreshCw size={12} />
                صف پردازش فعال
              </span>
              {activeOrders > 0
                ? <span className="status-pill info">فعال</span>
                : <span className="status-pill success">خالی</span>
              }
            </div>
            <strong style={{
              fontSize: 28,
              fontVariantNumeric: 'tabular-nums',
              color: activeOrders > 0 ? 'var(--accent-strong)' : undefined,
            }}>{fmt(queueTotal)}</strong>
            <small style={{ fontSize: 9, fontFamily: 'var(--font-latin)' }}>QUEUED · PROCESSING · SUBMITTED</small>
          </div>

          {/* Providers health */}
          <div className="premium-stat">
            <div className="stat-top">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--muted)' }}>
                <Server size={12} />
                ارائه‌دهندگان سالم
              </span>
              {degradedProviders.length > 0
                ? <span className="status-pill warning">{degradedProviders.length} مشکل</span>
                : <span className="status-pill success">همه سالم</span>
              }
            </div>
            <strong style={{
              fontSize: 28,
              fontVariantNumeric: 'tabular-nums',
              color: degradedProviders.length > 0 ? 'var(--warning)' : undefined,
            }}>{fmt(healthyProviders.length)}</strong>
            <small style={{ fontSize: 10 }}>از {fmt(providers.length)} ارائه‌دهنده</small>
          </div>

          {/* Users */}
          <div className="premium-stat">
            <div className="stat-top">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--muted)' }}>
                <Users size={12} />
                کاربران پلتفرم
              </span>
              <Zap size={13} style={{ color: 'var(--accent)', opacity: .7 }} />
            </div>
            <strong style={{ fontSize: 28, fontVariantNumeric: 'tabular-nums' }}>{fmt(userCount)}</strong>
            <small style={{ fontSize: 10 }}>{fmt(activeSubs)} اشتراک فعال</small>
          </div>
        </div>

        {/* ── Main two-column grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(300px,.6fr)', gap: 14, alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'grid', gap: 14 }}>

            {/* Provider health table */}
            <article className="surface-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">PROVIDER HEALTH</span>
                  <h2>وضعیت ارائه‌دهندگان</h2>
                </div>
                {degradedProviders.length > 0 && (
                  <span className="status-pill warning">{degradedProviders.length} ناسالم</span>
                )}
              </div>
              {providers.length === 0 ? (
                <div className="state-block state-empty" style={{ minHeight: 120, border: 'none' }}>
                  <Server size={18} />
                  <p>هیچ ارائه‌دهنده‌ای ثبت نشده.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>شناسه ارائه‌دهنده</th>
                      <th>وضعیت</th>
                      <th>تأخیر</th>
                      <th>آخرین بررسی</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map(p => (
                      <tr key={p.provider_id}>
                        <td style={{ paddingInlineEnd: 4 }}>
                          <ProviderStatusIcon status={p.status} />
                        </td>
                        <td>
                          <code
                            className="latin"
                            style={{ fontSize: 11, background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 6, letterSpacing: '-.01em' }}
                          >
                            {p.provider_id.length > 18 ? `${p.provider_id.slice(0, 18)}…` : p.provider_id}
                          </code>
                        </td>
                        <td>
                          <span className={`status-pill ${statusPillClass(p.status)}`}>
                            {p.status === 'HEALTHY' ? 'سالم' : p.status === 'DEGRADED' ? 'ضعیف' : 'آفلاین'}
                          </span>
                        </td>
                        <td>
                          <span
                            className="latin"
                            style={{
                              fontSize: 11,
                              fontVariantNumeric: 'tabular-nums',
                              color: p.latency_ms > 5000
                                ? 'var(--danger)'
                                : p.latency_ms > 2000
                                  ? 'var(--warning)'
                                  : 'var(--muted)',
                            }}
                          >
                            {p.latency_ms}ms
                          </span>
                        </td>
                        <td style={{ color: 'var(--subtle)', fontSize: 11 }}>
                          {new Date(p.checked_at).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>

            {/* Orders by status */}
            <article className="surface-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">ORDER BREAKDOWN</span>
                  <h2>توزیع وضعیت سفارش‌ها</h2>
                </div>
                {failedOrders > 0 && (
                  <span className="status-pill danger">
                    <AlertTriangle size={9} style={{ marginInlineEnd: 3 }} />
                    {fmt(failedOrders)} ناموفق
                  </span>
                )}
              </div>
              {totalOrders === 0 ? (
                <div className="state-block state-empty" style={{ minHeight: 100, border: 'none' }}>
                  <Package size={18} />
                  <p>سفارشی ثبت نشده است.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>وضعیت</th>
                      <th>برچسب</th>
                      <th>تعداد</th>
                      <th>سهم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(orderMap)
                      .sort(([, a], [, b]) => b - a)
                      .map(([status, count]) => {
                        const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
                        return (
                          <tr key={status}>
                            <td>
                              <span className={`status-pill ${statusPillClass(status)}`} style={{ fontFamily: 'var(--font-latin)' }}>
                                {status}
                              </span>
                            </td>
                            <td style={{ color: 'var(--muted)', fontSize: 11 }}>{statusLabel(status)}</td>
                            <td><strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmt(count)}</strong></td>
                            <td style={{ minWidth: 90 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="progress-track" style={{ flex: 1 }}>
                                  <i style={{ width: `${pct}%` }} />
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 28, textAlign: 'end', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-latin)' }}>
                                  {pct}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </article>

          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'grid', gap: 14 }}>

            {/* Operational events 24h */}
            <article className="surface-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">EVENTS / 24H</span>
                  <h2>رویدادهای عملیاتی</h2>
                </div>
                {(criticalAlerts + errorAlerts) > 0 && (
                  <span className="status-pill danger">{fmt(criticalAlerts + errorAlerts)} خطا</span>
                )}
              </div>
              {Object.keys(alertBySev).length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 0', color: 'var(--success)', fontSize: 12 }}>
                  <CheckCircle2 size={16} />
                  <span>رویداد غیرعادی ثبت نشده</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
                  {Object.entries(alertBySev)
                    .sort(([a], [b]) => {
                      const order = ['CRITICAL', 'ERROR', 'WARNING', 'INFO'];
                      return order.indexOf(a) - order.indexOf(b);
                    })
                    .map(([sev, { count, lastAt }]) => (
                      <div
                        key={sev}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          alignItems: 'center',
                          padding: '11px 13px',
                          background: sev === 'CRITICAL' || sev === 'ERROR' ? 'var(--danger-soft)' : sev === 'WARNING' ? 'var(--warning-soft)' : 'var(--surface-2)',
                          borderRadius: 11,
                          border: `1px solid ${sev === 'CRITICAL' || sev === 'ERROR' ? 'rgba(220,38,38,.15)' : sev === 'WARNING' ? 'rgba(217,119,6,.15)' : 'var(--line)'}`,
                          gap: 10,
                        }}
                      >
                        <div>
                          <span
                            className={`status-pill ${statusPillClass(sev)}`}
                            style={{ fontFamily: 'var(--font-latin)', marginBottom: 5, display: 'inline-flex' }}
                          >
                            {sev}
                          </span>
                          <div style={{ fontSize: 10, color: 'var(--subtle)', marginTop: 3 }}>
                            {new Date(lastAt).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <strong style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>
                          {fmt(count)}
                        </strong>
                      </div>
                    ))}
                </div>
              )}
            </article>

            {/* Subscriptions */}
            <article className="surface-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">SUBSCRIPTIONS</span>
                  <h2>اشتراک‌ها</h2>
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(activeSubs)} فعال
                </span>
              </div>
              {Object.keys(subMap).length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 12, padding: '8px 0' }}>اشتراکی وجود ندارد.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {Object.entries(subMap)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => (
                      <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span className={`status-pill ${statusPillClass(status)}`}>
                          {statusLabel(status)}
                        </span>
                        <strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{fmt(count)}</strong>
                      </div>
                    ))}
                </div>
              )}
            </article>

            {/* Payments summary */}
            <article className="surface-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">PAYMENTS</span>
                  <h2>پرداخت‌ها</h2>
                </div>
                <CreditCard size={14} style={{ color: 'var(--muted)' }} />
              </div>
              {Object.keys(paymentMap).length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 12, padding: '8px 0' }}>پرداختی ثبت نشده.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {Object.entries(paymentMap)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([status, { count }]) => (
                      <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span className={`status-pill ${statusPillClass(status)}`} style={{ fontFamily: 'var(--font-latin)' }}>
                          {status}
                        </span>
                        <strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{fmt(count)}</strong>
                      </div>
                    ))}
                </div>
              )}
            </article>

            {/* Quick actions */}
            <article className="surface-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">OPERATIONS</span>
                  <h2>عملیات سریع</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <Link
                  href="/api/internal/metrics"
                  target="_blank"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr auto',
                    alignItems: 'center',
                    gap: 9,
                    padding: '11px 12px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    textDecoration: 'none',
                    color: 'var(--ink)',
                    transition: '.16s ease',
                  }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>
                    <Activity size={13} />
                  </span>
                  <div>
                    <b style={{ display: 'block', fontSize: 11 }}>Metrics JSON</b>
                    <small style={{ display: 'block', fontSize: 9, color: 'var(--muted)', marginTop: 2, fontFamily: 'var(--font-latin)', direction: 'ltr' }}>
                      GET /api/internal/metrics
                    </small>
                  </div>
                  <ExternalLink size={11} style={{ color: 'var(--subtle)' }} />
                </Link>

                <Link
                  href="/api/v1/health"
                  target="_blank"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr auto',
                    alignItems: 'center',
                    gap: 9,
                    padding: '11px 12px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    textDecoration: 'none',
                    color: 'var(--ink)',
                    transition: '.16s ease',
                  }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--success-soft)', display: 'grid', placeItems: 'center', color: 'var(--success)' }}>
                    <CheckCircle2 size={13} />
                  </span>
                  <div>
                    <b style={{ display: 'block', fontSize: 11 }}>Health Check</b>
                    <small style={{ display: 'block', fontSize: 9, color: 'var(--muted)', marginTop: 2, fontFamily: 'var(--font-latin)', direction: 'ltr' }}>
                      GET /api/v1/health
                    </small>
                  </div>
                  <ExternalLink size={11} style={{ color: 'var(--subtle)' }} />
                </Link>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr',
                  alignItems: 'center',
                  gap: 9,
                  padding: '11px 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  opacity: .65,
                }}>
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                    <RefreshCw size={13} />
                  </span>
                  <div>
                    <b style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>تمدید اشتراک‌ها</b>
                    <small style={{ display: 'block', fontSize: 9, color: 'var(--subtle)', marginTop: 2, fontFamily: 'var(--font-latin)', direction: 'ltr' }}>
                      POST /api/internal/queue/renewal
                    </small>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr',
                  alignItems: 'center',
                  gap: 9,
                  padding: '11px 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  opacity: .65,
                }}>
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                    <Clock size={13} />
                  </span>
                  <div>
                    <b style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>پردازش صف خروجی</b>
                    <small style={{ display: 'block', fontSize: 9, color: 'var(--subtle)', marginTop: 2, fontFamily: 'var(--font-latin)', direction: 'ltr' }}>
                      POST /api/internal/queue/outbox
                    </small>
                  </div>
                </div>
              </div>
            </article>

          </div>
        </div>
      </main>
    </AppShell>
  );
}
