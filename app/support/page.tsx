import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Headphones, MessageSquareText, Plus, ShieldCheck } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { requireCurrentUser } from '../../server/identity/request-user';
import { query } from '../../server/core/db';

export const metadata: Metadata = { title: 'پشتیبانی', robots: { index: false, follow: false } };

const statusLabel: Record<string, string> = {
  OPEN: 'باز',
  PENDING: 'در انتظار',
  RESOLVED: 'حل‌شده',
  CLOSED: 'بسته',
};

const priorityLabel: Record<string, string> = {
  LOW: 'کم',
  NORMAL: 'معمولی',
  HIGH: 'زیاد',
  URGENT: 'فوری',
};

export default async function Support() {
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

  const tickets = workspaceId
    ? await query<{ id: string; subject: string; status: string; priority: string; createdAt: string }>(
        `SELECT id, subject, status, priority, created_at AS "createdAt"
         FROM support_tickets WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 30`,
        [workspaceId],
      ).then(r => r.rows)
    : [];

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <span className="eyebrow">SUPPORT / OPERATIONS</span>
            <h1>پشتیبانی</h1>
            <p>تیکت، پیام، سفارش و رخدادهای مرتبط در یک مسیر قابل ردیابی برای حل مسئله.</p>
          </div>
          <Link className="button primary" href="/support/new"><Plus size={15}/>تیکت جدید</Link>
        </header>
        <SystemStrip/>

        {tickets.length > 0 ? (
          <article className="surface-panel data-panel" style={{ marginBottom: 20 }}>
            <div className="panel-head" style={{ marginBottom: 14 }}>
              <div><span className="panel-kicker">TICKETS</span><h2>تیکت‌های پشتیبانی</h2></div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>موضوع</th>
                  <th>وضعیت</th>
                  <th>اولویت</th>
                  <th>تاریخ ثبت</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.subject}</strong></td>
                    <td>
                      <span className={`status-pill ${t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'success' : t.status === 'PENDING' ? 'info' : 'warning'}`}>
                        {statusLabel[t.status] ?? t.status}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${t.priority === 'URGENT' ? 'danger' : t.priority === 'HIGH' ? 'warning' : ''}`}>
                        {priorityLabel[t.priority] ?? t.priority}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 10 }}>
                      {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(t.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ) : (
          <div className="state-block state-empty" style={{ marginTop: 40, marginBottom: 32 }}>
            <MessageSquareText size={28}/>
            <h3>تیکتی ثبت نشده</h3>
            <p>اگر سؤال یا مشکلی دارید تیکت جدید باز کنید.</p>
            <Link href="/support/new" className="button primary" style={{ marginTop: 14, textDecoration: 'none' }}>
              <Plus size={14}/>تیکت جدید
            </Link>
          </div>
        )}

        <section className="product-card-grid-premium">
          <div className="product-card">
            <span className="product-card-icon"><Headphones size={18}/></span>
            <div>
              <h3>مسیر رسیدگی</h3>
              <p>هر درخواست با workspace، order و correlation ID قابل ردیابی است.</p>
              <span className="product-card-meta">Context aware</span>
            </div>
          </div>
          <div className="product-card">
            <span className="product-card-icon"><ShieldCheck size={18}/></span>
            <div>
              <h3>Security escalation</h3>
              <p>رخدادهای امنیتی از مسیر عادی پشتیبانی جدا می‌شوند.</p>
              <span className="product-card-meta">High priority · Audited</span>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
