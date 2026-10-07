import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CheckCircle2, Circle, Clock, Package, ShoppingBag, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { OrderActions } from './OrderActions';
import { AppShell } from '../../../components/AppShell';
import { formatTomanFromIRR, statusLabel } from '../../../lib/format';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { query, withWorkspaceTransaction } from '../../../server/core/db';

function orderCode(id: string) {
  return `#DP-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

const statusEventLabel: Record<string, string> = {
  PAYMENT_PENDING: 'منتظر پرداخت',
  PAID: 'پرداخت تأیید شد',
  QUEUED: 'در صف پردازش',
  PROCESSING: 'در حال پردازش توسط تأمین‌کننده',
  PROVIDER_SUBMITTED: 'ارسال به تأمین‌کننده',
  COMPLETED: 'تحویل کامل',
  FAILED: 'ناموفق',
  CANCELLED: 'لغو شده',
  REFUNDED: 'مرجوع شده',
};

function StatusBadge({ status }: { status: string }) {
  const isSuccess = status === 'COMPLETED';
  const isDanger = status === 'FAILED' || status === 'CANCELLED';
  const isInfo = status === 'PROCESSING' || status === 'PROVIDER_SUBMITTED';
  const cls = isSuccess ? 'success' : isDanger ? 'danger' : isInfo ? 'info' : 'warning';
  const icon = isSuccess ? <CheckCircle2 size={12} /> : isDanger ? <XCircle size={12} /> : isInfo ? <Loader2 size={12} /> : <Clock size={12} />;
  return (
    <span className={`status-pill ${cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 10 }}>
      {icon}{statusLabel(status)}
    </span>
  );
}

async function getOrderDetail(orderId: string, workspaceId: string) {
  const r = await withWorkspaceTransaction(workspaceId, undefined, async client => {
    const order = await client.query<{
      id: string; status: string; currency: string;
      totalMinor: string; createdAt: string;
    }>(
      `SELECT id, status, currency, total_minor::text AS "totalMinor", created_at AS "createdAt"
       FROM orders WHERE id=$1 AND workspace_id=$2`,
      [orderId, workspaceId],
    );
    if (!order.rows[0]) return null;

    const items = await client.query<{
      serviceName: string; quantity: string; parameters: Record<string, unknown>;
    }>(
      `SELECT s.name AS "serviceName", oi.quantity::text AS quantity, oi.parameters
       FROM order_items oi JOIN services s ON s.id=oi.service_id WHERE oi.order_id=$1 LIMIT 1`,
      [orderId],
    );

    const events = await client.query<{
      toStatus: string; fromStatus: string | null; createdAt: string;
    }>(
      `SELECT to_status AS "toStatus", from_status AS "fromStatus", created_at AS "createdAt"
       FROM order_events WHERE order_id=$1 ORDER BY created_at ASC`,
      [orderId],
    );

    const externalOrder = await client.query<{ externalOrderId: string; providerType: string }>(
      `SELECT eo.external_order_id AS "externalOrderId", p.provider_type AS "providerType"
       FROM external_orders eo JOIN providers p ON p.id=eo.provider_id WHERE eo.order_id=$1 LIMIT 1`,
      [orderId],
    );

    return {
      order: order.rows[0],
      item: items.rows[0] ?? null,
      events: events.rows,
      provider: externalOrder.rows[0] ?? null,
    };
  });
  return r;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `سفارش ${orderCode(id)}`, robots: { index: false, follow: false } };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const data = workspaceId ? await getOrderDetail(id, workspaceId) : null;

  if (!data || !data.order) {
    return (
      <AppShell>
        <main className="workspace-page-content">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
              <Package size={28} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>سفارش پیدا نشد</h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12 }}>این سفارش وجود ندارد یا به حساب شما تعلق ندارد.</p>
            </div>
            <Link href="/orders" className="button secondary" style={{ textDecoration: 'none' }}>
              بازگشت به لیست
            </Link>
          </div>
        </main>
      </AppShell>
    );
  }

  const { order, item, events, provider } = data;
  const target = item?.parameters?.target ? String(item.parameters.target) : null;
  const isUrl = target?.startsWith('http');

  return (
    <AppShell>
      <main className="workspace-page-content">
        {/* Breadcrumb + header */}
        <header style={{ marginBottom: 28 }}>
          <Link
            href="/orders"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 11, textDecoration: 'none', marginBottom: 10 }}
          >
            <ArrowRight size={13} />سفارش‌ها
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <span className="eyebrow" style={{ marginBottom: 4 }}>جزئیات سفارش</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 'clamp(20px,3vw,28px)', letterSpacing: '-.05em' }} className="text-ltr">
                  {orderCode(order.id)}
                </h1>
                <StatusBadge status={order.status} />
              </div>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                {item?.serviceName ?? '—'} · {item?.quantity ?? '—'} واحد
              </p>
            </div>
            <OrderActions status={order.status} orderId={order.id} />
          </div>
        </header>

        <div className="order-detail-grid">
          {/* Timeline panel */}
          <article className="surface-panel">
            <div className="panel-head" style={{ marginBottom: 22 }}>
              <div>
                <p className="panel-kicker" style={{ margin: '0 0 2px' }}>TIMELINE</p>
                <h2 style={{ margin: 0 }}>وضعیت و تاریخچه</h2>
              </div>
            </div>
            <div className="timeline-list">
              {events.map((ev, i) => {
                const isLast = i === events.length - 1;
                const isActive = isLast && order.status !== 'COMPLETED' && order.status !== 'FAILED';
                const isDone = ev.toStatus === 'COMPLETED';
                return (
                  <div key={i} className="timeline-item">
                    <div className="timeline-dot-col">
                      <div className={`timeline-dot${isDone ? ' done' : isActive ? ' active' : ' done'}`}>
                        {isActive ? <Clock size={14} /> : <CheckCircle2 size={14} />}
                      </div>
                      {i < events.length - 1 && <div className="timeline-line" />}
                    </div>
                    <div className="timeline-body">
                      <b>{statusEventLabel[ev.toStatus] ?? ev.toStatus}</b>
                      <time>{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ev.createdAt))}</time>
                    </div>
                  </div>
                );
              })}
              {order.status !== 'COMPLETED' && order.status !== 'FAILED' && order.status !== 'CANCELLED' && (
                <div className="timeline-item">
                  <div className="timeline-dot-col">
                    <div className="timeline-dot">
                      <Circle size={14} />
                    </div>
                  </div>
                  <div className="timeline-body">
                    <b>تحویل کامل</b>
                    <small>منتظر مرحله قبل</small>
                  </div>
                </div>
              )}
            </div>
          </article>

          {/* Details sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Order details */}
            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <p className="panel-kicker" style={{ margin: '0 0 2px' }}>DETAILS</p>
                  <h2 style={{ margin: 0 }}>جزئیات سفارش</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { label: 'کد سفارش', value: orderCode(order.id), ltr: true },
                  { label: 'سرویس', value: item?.serviceName ?? '—' },
                  { label: 'مقدار', value: item?.quantity ? `${new Intl.NumberFormat('fa-IR').format(Number(item.quantity))} واحد` : '—' },
                  { label: 'تأمین‌کننده', value: provider?.providerType ?? '—', ltr: !!provider?.providerType },
                  { label: 'مبلغ', value: formatTomanFromIRR(Number(order.totalMinor)), mono: true },
                  { label: 'تاریخ ثبت', value: new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt)) },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 13px', background: 'var(--surface-2)', borderRadius: 12 }}>
                    <span style={{ fontSize: 10, color: 'var(--subtle)' }}>{row.label}</span>
                    <strong style={{
                      fontSize: 11,
                      fontVariantNumeric: row.mono ? 'tabular-nums' : undefined,
                      direction: row.ltr ? 'ltr' : undefined,
                      unicodeBidi: row.ltr ? 'isolate' : undefined,
                    }}>
                      {row.value}
                    </strong>
                  </div>
                ))}

                {target && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 13px', background: 'var(--surface-2)', borderRadius: 12 }}>
                    <span style={{ fontSize: 10, color: 'var(--subtle)' }}>هدف</span>
                    {isUrl ? (
                      <a
                        href={target}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)', textDecoration: 'none', direction: 'ltr', unicodeBidi: 'isolate' }}
                      >
                        {target.length > 32 ? target.slice(0, 32) + '…' : target}
                        <ExternalLink size={11} />
                      </a>
                    ) : (
                      <strong style={{ fontSize: 11, direction: 'ltr', unicodeBidi: 'isolate' }}>{target}</strong>
                    )}
                  </div>
                )}
              </div>
            </article>

            {/* Quick actions */}
            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <div>
                  <p className="panel-kicker" style={{ margin: '0 0 2px' }}>ACTIONS</p>
                  <h2 style={{ margin: 0 }}>عملیات سریع</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <Link
                  href="/orders"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
                    border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none',
                    color: 'var(--muted)', fontSize: 11, transition: 'border-color .12s',
                  }}
                >
                  <Package size={14} />همه سفارش‌ها
                </Link>
                <Link
                  href="/services"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
                    border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none',
                    color: 'var(--muted)', fontSize: 11, transition: 'border-color .12s',
                  }}
                >
                  <ShoppingBag size={14} />سفارش جدید
                </Link>
              </div>
            </article>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
