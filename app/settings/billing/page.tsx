import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CreditCard, Download, ExternalLink, Sparkles } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
import { formatTomanFromIRR, statusLabel } from '../../../lib/format';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { query, withWorkspaceTransaction } from '../../../server/core/db';

export const metadata: Metadata = { title: 'پرداخت و صورتحساب', robots: { index: false, follow: false } };

async function getBillingData(workspaceId: string) {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const sub = await client.query<{ planName: string; priceMinor: string | null; currentPeriodEnd: string; status: string }>(
      `SELECT p.name AS "planName", s.price_minor::text AS "priceMinor",
              s.current_period_end AS "currentPeriodEnd", s.status
       FROM subscriptions s JOIN plans p ON p.id=s.plan_id
       WHERE s.workspace_id=$1 AND s.status IN ('ACTIVE','TRIALING')
       ORDER BY s.created_at DESC LIMIT 1`,
      [workspaceId],
    );
    const balance = await client.query<{ balanceMinor: string }>(
      `SELECT COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE -le.amount_minor END),0)::text AS "balanceMinor"
       FROM wallets w
       LEFT JOIN ledger_accounts la ON la.wallet_id=w.id
       LEFT JOIN ledger_entries le ON le.account_id=la.id
       WHERE w.workspace_id=$1`,
      [workspaceId],
    );
    const invoices = await client.query<{ id: string; invoiceNumber: string; totalMinor: string; status: string; issuedAt: string | null; createdAt: string }>(
      `SELECT id, invoice_number AS "invoiceNumber", total_minor::text AS "totalMinor",
              status, issued_at AS "issuedAt", created_at AS "createdAt"
       FROM invoices WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [workspaceId],
    );
    return {
      sub: sub.rows[0] ?? null,
      balanceMinor: Number(balance.rows[0]?.balanceMinor ?? '0'),
      invoices: invoices.rows,
    };
  });
}

export default async function BillingSettings() {
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
  const data = workspaceId ? await getBillingData(workspaceId) : null;

  const sub = data?.sub ?? null;
  const balanceMinor = data?.balanceMinor ?? 0;
  const invoices = data?.invoices ?? [];

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div><span className="eyebrow">SETTINGS / BILLING</span><h1>پرداخت و صورتحساب</h1><p>روش پرداخت، تاریخچه فاکتورها و مدیریت اشتراک.</p></div>
          <Link className="button secondary" href="/settings"><ArrowRight size={15}/>تنظیمات</Link>
        </header>
        <SystemStrip/>
        <div className="settings-layout">
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head">
              <div><span className="panel-kicker">CURRENT PLAN</span><h2>اشتراک فعال</h2></div>
              {sub ? <span className={`status-pill ${sub.status === 'TRIALING' ? 'info' : 'success'}`}>{statusLabel(sub.status)}</span> : <span className="status-pill warning">بدون اشتراک</span>}
            </div>
            {sub ? (
              <div className="metric-grid-4" style={{ marginTop: 16 }}>
                <div className="metric-tile"><span>پلن</span><strong>{sub.planName}</strong></div>
                <div className="metric-tile"><span>هزینه ماهانه</span><strong>{sub.priceMinor ? formatTomanFromIRR(Number(sub.priceMinor)) : '—'}</strong></div>
                <div className="metric-tile"><span>تمدید بعدی</span><strong style={{ fontSize: 14 }}>{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(sub.currentPeriodEnd))}</strong></div>
                <div className="metric-tile"><span>روش پرداخت</span><strong>کیف پول</strong></div>
              </div>
            ) : (
              <div className="state-block state-empty" style={{ padding: '20px 0' }}>
                <Sparkles size={20}/>
                <p>اشتراک فعالی ندارید.</p>
              </div>
            )}
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <Link className="button secondary" href="/pricing">مقایسه پلن‌ها</Link>
              {sub && <button className="button danger" type="button">لغو اشتراک</button>}
            </div>
          </article>

          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head">
              <div><span className="panel-kicker">WALLET</span><h2>کیف پول</h2></div>
              <Link className="button secondary" style={{ padding: '0 14px', height: 34, fontSize: 11 }} href="/wallet">مشاهده کامل</Link>
            </div>
            <div className="metric-grid-4" style={{ marginTop: 16 }}>
              <div className="metric-tile"><span>موجودی</span><strong>{formatTomanFromIRR(balanceMinor)}</strong></div>
              <div className="metric-tile"><span>معلق</span><strong>{formatTomanFromIRR(0)}</strong></div>
            </div>
            <Link className="button primary" style={{ marginTop: 16, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }} href="/wallet#topup">
              <CreditCard size={15}/>افزایش موجودی
            </Link>
          </article>

          <article className="surface-panel data-panel" style={{ padding: 24 }}>
            <div className="panel-head">
              <div><span className="panel-kicker">INVOICES</span><h2>فاکتورها</h2></div>
            </div>
            {invoices.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '16px 0 0' }}>هنوز فاکتوری صادر نشده.</p>
            ) : (
              <table className="data-table" style={{ marginTop: 8 }}>
                <thead><tr><th>کد فاکتور</th><th>تاریخ</th><th>مبلغ</th><th>وضعیت</th><th></th></tr></thead>
                <tbody>
                  {invoices.map(inv => {
                    const date = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(inv.issuedAt ?? inv.createdAt));
                    return (
                      <tr key={inv.id}>
                        <td><strong className="text-ltr">{inv.invoiceNumber}</strong></td>
                        <td>{date}</td>
                        <td>{formatTomanFromIRR(Number(inv.totalMinor))}</td>
                        <td><span className={`status-pill ${inv.status === 'PAID' ? 'success' : 'warning'}`}>{statusLabel(inv.status)}</span></td>
                        <td style={{ display: 'flex', gap: 8 }}>
                          <button aria-label="دانلود" style={{ background: 'none', color: 'var(--muted)' }}><Download size={14}/></button>
                          <button aria-label="مشاهده" style={{ background: 'none', color: 'var(--muted)' }}><ExternalLink size={14}/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </article>
        </div>
      </main>
    </AppShell>
  );
}
