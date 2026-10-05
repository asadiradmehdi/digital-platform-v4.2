import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, ArrowUpLeft } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { ordersFixture } from '../../lib/product-fixtures';
import { formatTomanFromIRR, statusLabel } from '../../lib/format';
export const metadata: Metadata = { title: 'سفارش‌ها', robots: { index: false, follow: false } };
export default function Orders() {
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
              {ordersFixture.map(o => (
                <tr key={o.id}>
                  <td><strong className="text-ltr">{o.code}</strong></td>
                  <td>
                    <span className={`status-pill ${o.status === 'COMPLETED' ? 'success' : o.status === 'PROCESSING' ? 'info' : 'warning'}`}>
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td>{new Intl.DateTimeFormat('fa-IR').format(new Date(o.createdAt))}</td>
                  <td>{formatTomanFromIRR(o.totalMinor)}</td>
                  <td>
                    <Link
                      href={`/orders/${o.id}`}
                      aria-label={`جزئیات ${o.code}`}
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
      </main>
    </AppShell>
  );
}
