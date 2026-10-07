import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, ArrowLeft, Package, ShoppingBag, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { formatTomanFromIRR, statusLabel } from '../../lib/format';
import { requireCurrentUser } from '../../server/identity/request-user';
import { query } from '../../server/core/db';
import { listOrders } from '../../server/commerce/orders';

export const metadata: Metadata = { title: 'سفارش‌ها', robots: { index: false, follow: false } };

function orderCode(id: string) {
  return `#DP-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    COMPLETED:         { cls: 'success', icon: <CheckCircle2 size={11} />, label: statusLabel('COMPLETED') },
    PROCESSING:        { cls: 'info',    icon: <Loader2 size={11} />,      label: statusLabel('PROCESSING') },
    PROVIDER_SUBMITTED:{ cls: 'info',    icon: <Loader2 size={11} />,      label: statusLabel('PROVIDER_SUBMITTED') },
    QUEUED:            { cls: 'info',    icon: <Clock size={11} />,         label: statusLabel('QUEUED') },
    PAYMENT_PENDING:   { cls: 'warning', icon: <Clock size={11} />,         label: statusLabel('PAYMENT_PENDING') },
    PAID:              { cls: 'warning', icon: <Clock size={11} />,         label: statusLabel('PAID') },
    FAILED:            { cls: 'danger',  icon: <XCircle size={11} />,       label: statusLabel('FAILED') },
    CANCELLED:         { cls: 'danger',  icon: <XCircle size={11} />,       label: statusLabel('CANCELLED') },
    REFUNDED:          { cls: 'warning', icon: <ArrowLeft size={11} />,     label: statusLabel('REFUNDED') },
  };
  const cfg = map[status] ?? { cls: '', icon: null, label: status };
  return (
    <span className={`status-pill ${cfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

export default async function Orders() {
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

  const { items: orders } = workspaceId
    ? await listOrders(workspaceId, 50, null)
    : { items: [] };

  const totalCount = orders.length;
  const activeCount = orders.filter(o => ['PROCESSING', 'PROVIDER_SUBMITTED', 'QUEUED', 'PAID', 'PAYMENT_PENDING'].includes(o.status)).length;
  const completedCount = orders.filter(o => o.status === 'COMPLETED').length;
  const failedCount = orders.filter(o => ['FAILED', 'CANCELLED'].includes(o.status)).length;

  return (
    <AppShell>
      <main className="workspace-page-content">
        {/* Page header */}
        <header className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <span className="eyebrow">خرید و مالی · سفارش‌ها</span>
            <h1>سفارش‌ها</h1>
            <p>همه سفارش‌های شما با وضعیت و هزینه لحظه‌ای.</p>
          </div>
          <Link className="button primary" href="/services">
            <Plus size={15} />سفارش جدید
          </Link>
        </header>

        <SystemStrip />

        {orders.length === 0 ? (
          /* Empty state */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>
              <ShoppingBag size={28} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 17, letterSpacing: '-.03em' }}>هنوز سفارشی ثبت نشده</h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12, lineHeight: 1.8, maxWidth: 340 }}>
                اولین سفارش خود را از کاتالوگ خدمات ثبت کنید و رشد شبکه‌های اجتماعی را آغاز کنید.
              </p>
            </div>
            <Link href="/services" className="button primary" style={{ textDecoration: 'none', marginTop: 4 }}>
              <Plus size={14} />مشاهده خدمات
            </Link>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="metrics-band" style={{ marginBottom: 20 }}>
              <div className="metric-item">
                <strong style={{ color: 'var(--ink)' }}>{new Intl.NumberFormat('fa-IR').format(totalCount)}</strong>
                <span>کل سفارش‌ها</span>
              </div>
              <div className="metric-item">
                <strong style={{ color: 'var(--info)' }}>{new Intl.NumberFormat('fa-IR').format(activeCount)}</strong>
                <span>در حال پردازش</span>
              </div>
              <div className="metric-item">
                <strong style={{ color: 'var(--success)' }}>{new Intl.NumberFormat('fa-IR').format(completedCount)}</strong>
                <span>تکمیل‌شده</span>
              </div>
              <div className="metric-item">
                <strong style={{ color: 'var(--danger)' }}>{new Intl.NumberFormat('fa-IR').format(failedCount)}</strong>
                <span>ناموفق</span>
              </div>
            </div>

            {/* Orders table */}
            <article className="surface-panel data-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px 22px 0', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingBottom: 16 }}>
                <div>
                  <p className="panel-kicker" style={{ margin: '0 0 2px' }}>سفارش‌ها</p>
                  <h2 style={{ margin: 0, fontSize: 15, letterSpacing: '-.02em' }}>تمام سفارش‌ها</h2>
                </div>
                <Link href="/services" className="button secondary" style={{ textDecoration: 'none', fontSize: 11 }}>
                  <Plus size={13} />سفارش جدید
                </Link>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ paddingRight: 22 }}>کد سفارش</th>
                      <th>وضعیت</th>
                      <th>تاریخ</th>
                      <th>مبلغ</th>
                      <th style={{ paddingLeft: 22 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id} style={{ transition: 'background .12s' }}>
                        <td style={{ paddingRight: 22 }}>
                          <span className="text-ltr" style={{ fontWeight: 700, fontSize: 12, letterSpacing: '.03em', color: 'var(--ink)' }}>
                            {orderCode(o.id)}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(o.createdAt))}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                            {formatTomanFromIRR(Number(o.totalMinor))}
                          </span>
                        </td>
                        <td style={{ paddingLeft: 22 }}>
                          <Link
                            href={`/orders/${o.id}`}
                            aria-label={`جزئیات ${orderCode(o.id)}`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              color: 'var(--accent)', fontSize: 11, textDecoration: 'none',
                              fontWeight: 700, padding: '5px 10px',
                              background: 'var(--accent-soft)', borderRadius: 8,
                            }}
                          >
                            جزئیات<ArrowLeft size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        )}
      </main>
    </AppShell>
  );
}
