import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CreditCard, Download, ExternalLink, Sparkles } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { formatMoney, statusLabel } from '../../../lib/format';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { query, withWorkspaceTransaction } from '../../../server/core/db';
import { CancelSubscriptionButton } from './CancelSubscriptionButton';

export const metadata: Metadata = { title: 'پرداخت و صورتحساب', robots: { index: false, follow: false } };

async function getBillingData(workspaceId: string) {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const sub = await client.query<{ id: string; planName: string; priceMinor: string | null; currency: string; currentPeriodEnd: string; status: string }>(
      `SELECT s.id, p.name AS "planName", s.price_minor::text AS "priceMinor", COALESCE(s.currency, p.currency) AS currency,
              s.current_period_end AS "currentPeriodEnd", s.status
       FROM subscriptions s JOIN plans p ON p.id=s.plan_id
       WHERE s.workspace_id=$1 AND s.status IN ('ACTIVE','TRIALING')
       ORDER BY s.created_at DESC LIMIT 1`,
      [workspaceId],
    );
    const balance = await client.query<{ balanceMinor: string; currency: string }>(
      `SELECT COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE -le.amount_minor END),0)::text AS "balanceMinor",
              w.currency
       FROM wallets w
       LEFT JOIN ledger_accounts la ON la.wallet_id=w.id
       LEFT JOIN ledger_entries le ON le.account_id=la.id
       WHERE w.workspace_id=$1
       GROUP BY w.id, w.currency`,
      [workspaceId],
    );
    const invoices = await client.query<{ id: string; invoiceNumber: string; totalMinor: string; currency: string; status: string; issuedAt: string | null; createdAt: string }>(
      `SELECT id, invoice_number AS "invoiceNumber", total_minor::text AS "totalMinor", currency,
              status, issued_at AS "issuedAt", created_at AS "createdAt"
       FROM invoices WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [workspaceId],
    );
    return {
      sub: sub.rows[0] ?? null,
      balanceMinor: Number(balance.rows[0]?.balanceMinor ?? '0'),
      walletCurrency: String(balance.rows[0]?.currency ?? 'IRR').trim(),
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
  const walletCurrency = data?.walletCurrency ?? 'IRR';
  const invoices = data?.invoices ?? [];

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div>
            <span className="eyebrow">حساب کاربری · پرداخت</span>
            <h1>پرداخت و صورتحساب</h1>
            <p>اشتراک فعال، کیف پول و تاریخچه فاکتورها.</p>
          </div>
          <Link className="button secondary" href="/settings">
            <ArrowRight size={15} />
            تنظیمات
          </Link>
        </header>

        <div className="settings-layout">
          {/* Subscription */}
          <article className="surface-panel" style={{ padding: 28 }}>
            <div className="panel-head">
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '.07em',
                    color: 'var(--accent)',
                    marginBottom: 4,
                    fontFamily: 'var(--font-latin)',
                  }}
                >
                  SUBSCRIPTION
                </span>
                <h2>اشتراک فعال</h2>
              </div>
              {sub ? (
                <span className={`status-pill ${sub.status === 'TRIALING' ? 'info' : 'success'}`}>
                  {statusLabel(sub.status)}
                </span>
              ) : (
                <span className="status-pill warning">بدون اشتراک</span>
              )}
            </div>

            {sub ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 10,
                  marginTop: 16,
                  marginBottom: 20,
                }}
              >
                {[
                  { label: 'پلن', value: sub.planName },
                  {
                    label: 'هزینه ماهانه',
                    value: sub.priceMinor ? formatMoney(sub.priceMinor, sub.currency) : '—',
                  },
                  {
                    label: 'تمدید بعدی',
                    value: new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(sub.currentPeriodEnd)),
                  },
                  { label: 'روش پرداخت', value: 'کیف پول' },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      padding: '14px 16px',
                      background: 'var(--surface-2)',
                      borderRadius: 12,
                      border: '1px solid var(--line)',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--subtle)', marginBottom: 6 }}>
                      {label}
                    </span>
                    <strong style={{ fontSize: 14, color: 'var(--ink)', letterSpacing: '-.015em' }}>
                      {value}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '28px 20px',
                  textAlign: 'center',
                  gap: 10,
                }}
              >
                <Sparkles size={24} style={{ color: 'var(--subtle)' }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  اشتراک فعالی ندارید.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="button secondary" href="/pricing">مقایسه پلن‌ها</Link>
              {sub && workspaceId && (
                <CancelSubscriptionButton subscriptionId={sub.id} workspaceId={workspaceId} />
              )}
            </div>
          </article>

          {/* Wallet */}
          <article className="surface-panel" style={{ padding: 28 }}>
            <div className="panel-head">
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '.07em',
                    color: 'var(--accent)',
                    marginBottom: 4,
                    fontFamily: 'var(--font-latin)',
                  }}
                >
                  WALLET
                </span>
                <h2>کیف پول</h2>
              </div>
              <Link
                className="button secondary"
                style={{ padding: '0 14px', height: 34, fontSize: 11 }}
                href="/wallet"
              >
                مشاهده کامل
              </Link>
            </div>

            <div
              data-stack
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginTop: 8,
                marginBottom: 20,
              }}
            >
              {[
                { label: 'موجودی', value: formatMoney(balanceMinor, walletCurrency) },
                { label: 'معلق', value: formatMoney(0, walletCurrency) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    padding: '16px',
                    background: 'var(--surface-2)',
                    borderRadius: 12,
                    border: '1px solid var(--line)',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--subtle)', marginBottom: 6 }}>
                    {label}
                  </span>
                  <strong style={{ fontSize: 16, color: 'var(--ink)', letterSpacing: '-.02em' }}>
                    {value}
                  </strong>
                </div>
              ))}
            </div>

            <Link
              className="button primary"
              href="/wallet#topup"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <CreditCard size={15} />
              افزایش موجودی
            </Link>
          </article>

          {/* Invoices */}
          <article className="surface-panel" style={{ padding: 28 }}>
            <div className="panel-head">
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '.07em',
                    color: 'var(--accent)',
                    marginBottom: 4,
                    fontFamily: 'var(--font-latin)',
                  }}
                >
                  INVOICES
                </span>
                <h2>فاکتورها</h2>
              </div>
            </div>

            {invoices.length === 0 ? (
              <div
                style={{
                  padding: '28px 20px',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  fontSize: 12,
                  background: 'var(--surface-2)',
                  borderRadius: 12,
                  marginTop: 8,
                }}
              >
                هنوز فاکتوری صادر نشده.
              </div>
            ) : (
              <table className="data-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>کد فاکتور</th>
                    <th>تاریخ</th>
                    <th>مبلغ</th>
                    <th>وضعیت</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const date = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(
                      new Date(inv.issuedAt ?? inv.createdAt),
                    );
                    return (
                      <tr key={inv.id}>
                        <td>
                          <strong className="text-ltr">{inv.invoiceNumber}</strong>
                        </td>
                        <td>{date}</td>
                        <td>{formatMoney(inv.totalMinor, inv.currency)}</td>
                        <td>
                          <span className={`status-pill ${inv.status === 'PAID' || inv.status === 'ISSUED' ? 'success' : 'warning'}`}>
                            {statusLabel(inv.status)}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: 8 }}>
                          <Link href={`/invoices/${inv.id}`} aria-label="دانلود PDF" style={{ color: 'var(--subtle)' }}>
                            <Download size={14} />
                          </Link>
                          <Link href={`/invoices/${inv.id}`} aria-label="مشاهده" style={{ color: 'var(--subtle)' }}>
                            <ExternalLink size={14} />
                          </Link>
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
