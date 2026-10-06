import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, ArrowUpLeft, Package } from 'lucide-react';
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

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <span className="eyebrow">خرید و مالی · سفارش‌ها</span>
            <h1>سفارش‌ها</h1>
            <p>وضعیت، هزینه و timeline هر سفارش از یک منبع server-side.</p>
          </div>
          <Link className="button primary" href="/services"><Plus size={15}/>سفارش جدید</Link>
        </header>
        <SystemStrip/>
        {orders.length === 0 ? (
          <div className="state-block state-empty" style={{ marginTop: 40 }}>
            <Package size={28}/>
            <h3>هنوز سفارشی ثبت نشده</h3>
            <p>اولین سفارش خود را از کاتالوگ خدمات ثبت کنید.</p>
            <Link href="/services" className="button primary" style={{ marginTop: 14, textDecoration: 'none' }}>
              <Plus size={14}/>مشاهده خدمات
            </Link>
          </div>
        ) : (
          <article className="surface-panel data-panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>کد سفارش</th>
                  <th>وضعیت</th>
                  <th>تاریخ</th>
                  <th>مبلغ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td><strong className="text-ltr">{orderCode(o.id)}</strong></td>
                    <td>
                      <span className={`status-pill ${o.status === 'COMPLETED' ? 'success' : o.status === 'PROCESSING' ? 'info' : 'warning'}`}>
                        {statusLabel(o.status)}
                      </span>
                    </td>
                    <td>{new Intl.DateTimeFormat('fa-IR').format(new Date(o.createdAt))}</td>
                    <td>{formatTomanFromIRR(Number(o.totalMinor))}</td>
                    <td>
                      <Link
                        href={`/orders/${o.id}`}
                        aria-label={`جزئیات ${orderCode(o.id)}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 11, textDecoration: 'none' }}
                      >
                        <ArrowUpLeft size={14}/>جزئیات
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}
      </main>
    </AppShell>
  );
}
