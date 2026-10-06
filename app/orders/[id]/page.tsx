import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CheckCircle2, Circle, Clock, Download, Package, RefreshCw, ShoppingBag } from 'lucide-react';
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
          <div className="state-block state-empty" style={{ marginTop: 40 }}>
            <Package size={28}/>
            <h3>سفارش پیدا نشد</h3>
            <p>این سفارش وجود ندارد یا به حساب شما تعلق ندارد.</p>
            <Link href="/orders" className="button secondary" style={{ marginTop: 14, textDecoration: 'none' }}>
              بازگشت به لیست
            </Link>
          </div>
        </main>
      </AppShell>
    );
  }

  const { order, item, events, provider } = data;
  const statusClass = order.status === 'COMPLETED' ? 'success' : order.status === 'PROCESSING' || order.status === 'PROVIDER_SUBMITTED' ? 'info' : 'warning';
  const target = item?.parameters?.target ? String(item.parameters.target) : '—';

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <Link href="/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 11, textDecoration: 'none', marginBottom: 8 }}>
              <ArrowRight size={13}/>سفارش‌ها
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 'clamp(22px,3vw,32px)' }}>{orderCode(order.id)}</h1>
              <span className={`status-pill ${statusClass}`}>{statusLabel(order.status)}</span>
            </div>
            <p>{item?.serviceName ?? '—'} · {item?.quantity ?? '—'} واحد</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {order.status === 'COMPLETED' && (
              <button className="button secondary" type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Download size={14}/>دریافت فاکتور
              </button>
            )}
            {(order.status === 'PROCESSING' || order.status === 'QUEUED') && (
              <button className="button secondary" type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <RefreshCw size={14}/>بروزرسانی وضعیت
              </button>
            )}
          </div>
        </header>

        <div className="order-detail-grid">
          <article className="surface-panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">TIMELINE</p>
                <h2>وضعیت سفارش</h2>
              </div>
            </div>
            <div className="timeline-list">
              {events.map((ev, i) => {
                const isLast = i === events.length - 1;
                const isActive = isLast && order.status !== 'COMPLETED' && order.status !== 'FAILED';
                return (
                  <div key={i} className="timeline-item">
                    <div className="timeline-dot-col">
                      <div className={`timeline-dot${isLast && !isActive ? ' done' : isActive ? ' active' : ' done'}`}>
                        {isActive ? <Clock size={14}/> : <CheckCircle2 size={14}/>}
                      </div>
                      {i < events.length - 1 && <div className="timeline-line"/>}
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
                    <div className="timeline-dot"><Circle size={14}/></div>
                  </div>
                  <div className="timeline-body">
                    <b>تحویل کامل</b>
                    <small>منتظر مرحله قبل</small>
                  </div>
                </div>
              )}
            </div>
          </article>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <div>
                  <p className="panel-kicker">DETAILS</p>
                  <h2>جزئیات</h2>
                </div>
              </div>
              <div className="order-meta-list">
                <div className="order-meta-row">
                  <span>کد سفارش</span>
                  <strong className="text-ltr">{orderCode(order.id)}</strong>
                </div>
                <div className="order-meta-row">
                  <span>سرویس</span>
                  <strong>{item?.serviceName ?? '—'}</strong>
                </div>
                <div className="order-meta-row">
                  <span>مقدار</span>
                  <strong>{item?.quantity ?? '—'} واحد</strong>
                </div>
                <div className="order-meta-row">
                  <span>هدف</span>
                  <strong className="text-ltr">{target}</strong>
                </div>
                <div className="order-meta-row">
                  <span>تأمین‌کننده</span>
                  <strong>{provider?.providerType ?? '—'}</strong>
                </div>
                <div className="order-meta-row">
                  <span>مبلغ</span>
                  <strong>{formatTomanFromIRR(Number(order.totalMinor))}</strong>
                </div>
              </div>
            </article>

            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <div>
                  <p className="panel-kicker">ACTIONS</p>
                  <h2>عملیات</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 9 }}>
                <Link href="/orders" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none', color: 'var(--muted)', fontSize: 11 }}>
                  <Package size={15}/>همه سفارش‌ها
                </Link>
                <Link href="/services" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none', color: 'var(--muted)', fontSize: 11 }}>
                  <ShoppingBag size={15}/>سفارش جدید
                </Link>
              </div>
            </article>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
