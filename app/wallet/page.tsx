import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowDownLeft, ArrowUpLeft, CreditCard, Plus, ShieldCheck, TrendingUp, WalletCards } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { formatTomanFromIRR } from '../../lib/format';
import { requireCurrentUser } from '../../server/identity/request-user';
import { query, withWorkspaceTransaction } from '../../server/core/db';

export const metadata: Metadata = { title: 'کیف پول', robots: { index: false, follow: false } };

const topupAmounts = [50_000_000, 100_000_000, 200_000_000, 500_000_000];

const referenceTypeLabel: Record<string, string> = {
  DEPOSIT: 'افزایش موجودی',
  SERVICE_CHARGE: 'هزینه سرویس',
  REFUND: 'بازگشت وجه',
  SUBSCRIPTION: 'اشتراک',
  TOPUP: 'افزایش موجودی',
};

async function getWalletData(workspaceId: string) {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const wallet = await client.query<{ id: string; currency: string }>(
      `SELECT id, currency FROM wallets WHERE workspace_id=$1`,
      [workspaceId],
    );
    if (!wallet.rows[0]) return null;

    const balance = await client.query<{ balanceMinor: string; currency: string }>(
      `SELECT COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE -le.amount_minor END),0)::text AS "balanceMinor",
              w.currency
       FROM wallets w
       LEFT JOIN ledger_accounts la ON la.wallet_id=w.id
       LEFT JOIN ledger_entries le ON le.account_id=la.id
       WHERE w.id=$1
       GROUP BY w.id, w.currency`,
      [wallet.rows[0].id],
    );

    const entries = await client.query<{
      id: string; direction: string; amountMinor: string; referenceType: string; metadata: Record<string, unknown>; createdAt: string;
    }>(
      `SELECT le.id, le.direction, le.amount_minor::text AS "amountMinor",
              le.reference_type AS "referenceType", le.metadata, le.created_at AS "createdAt"
       FROM ledger_entries le
       JOIN ledger_accounts la ON la.id=le.account_id
       JOIN wallets w ON w.id=la.wallet_id
       WHERE w.id=$1
       ORDER BY le.created_at DESC LIMIT 50`,
      [wallet.rows[0].id],
    );

    return {
      balanceMinor: balance.rows[0]?.balanceMinor ?? '0',
      currency: balance.rows[0]?.currency ?? 'IRR',
      entries: entries.rows,
    };
  });
}

export default async function Wallet() {
  let userId: string;
  try {
    userId = await requireCurrentUser();
  } catch {
    redirect('/login');
  }

  const memberships = await query<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_members WHERE user_id=$1 AND status='ACTIVE' ORDER BY created_at LIMIT 1`,
    [userId],
  );
  const workspaceId = memberships.rows[0]?.workspace_id ?? null;

  const walletData = workspaceId ? await getWalletData(workspaceId) : null;

  const balanceMinor = walletData ? Number(walletData.balanceMinor) : 0;
  const entries = walletData?.entries ?? [];

  const thisMonthSpend = entries
    .filter(e => e.direction === 'DEBIT' && new Date(e.createdAt).getMonth() === new Date().getMonth())
    .reduce((sum, e) => sum + Number(e.amountMinor), 0);

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <span className="eyebrow">مالی · کیف پول</span>
            <h1>کیف پول</h1>
            <p>موجودی، تراکنش‌ها و افزایش اعتبار — همه از Ledger سمت سرور.</p>
          </div>
          <Link className="button primary" href="#topup"><Plus size={15} />افزایش موجودی</Link>
        </header>

        <SystemStrip />

        <section className="metric-grid-4" style={{ marginBottom: 16 }}>
          <article className="metric-tile" style={{ gridColumn: 'span 2' }}>
            <span>موجودی قابل استفاده</span>
            <strong style={{ fontSize: 32, letterSpacing: '-.04em' }}>
              {formatTomanFromIRR(balanceMinor)}
            </strong>
            <small style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--success)' }}>
              <ShieldCheck size={11} />موجودی تأییدشده
            </small>
          </article>
          <article className="metric-tile">
            <span>معلق</span>
            <strong>{formatTomanFromIRR(0)}</strong>
            <small>در انتظار تسویه</small>
          </article>
          <article className="metric-tile">
            <span>خرج این ماه</span>
            <strong>{formatTomanFromIRR(thisMonthSpend)}</strong>
            <small style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <TrendingUp size={11} />ماه جاری
            </small>
          </article>
        </section>

        <div className="wallet-layout">
          <article className="surface-panel data-panel">
            <div className="panel-head" style={{ marginBottom: 16 }}>
              <div>
                <p className="panel-kicker">LEDGER</p>
                <h2>تراکنش‌های اخیر</h2>
              </div>
            </div>
            {entries.length === 0 ? (
              <div className="state-block state-empty" style={{ padding: '32px 0' }}>
                <WalletCards size={24}/>
                <p>هنوز تراکنشی ثبت نشده است.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>نوع</th>
                    <th>شرح</th>
                    <th>تاریخ</th>
                    <th>مبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => {
                    const isCredit = e.direction === 'CREDIT';
                    const label = (e.metadata?.label as string | undefined) ?? referenceTypeLabel[e.referenceType] ?? e.referenceType;
                    return (
                      <tr key={e.id}>
                        <td>
                          <span className={`status-pill ${isCredit ? 'success' : 'danger'}`}>
                            {isCredit ? <><ArrowUpLeft size={12} /> ورود</> : <><ArrowDownLeft size={12} /> خروج</>}
                          </span>
                        </td>
                        <td><strong>{label}</strong></td>
                        <td style={{ color: 'var(--muted)', fontSize: 10 }}>
                          {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(e.createdAt))}
                        </td>
                        <td>
                          <span style={{ color: isCredit ? 'var(--success)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 12 }}>
                            {isCredit ? '+' : '−'}{formatTomanFromIRR(Number(e.amountMinor))}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </article>

          <aside id="topup" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <p className="panel-kicker">TOPUP</p>
                  <h2>افزایش موجودی</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                {topupAmounts.map(a => (
                  <button
                    key={a}
                    type="button"
                    className="button secondary"
                    style={{ justifyContent: 'space-between', width: '100%' }}
                  >
                    <span>{formatTomanFromIRR(a)}</span>
                    <CreditCard size={14} />
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.9 }}>
                پرداخت از طریق درگاه بانکی امن. موجودی بلافاصله پس از تأیید بانک به کیف پول اضافه می‌شود.
              </p>
            </article>

            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <div>
                  <p className="panel-kicker">QUICK ACTIONS</p>
                  <h2>عملیات سریع</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <Link href="/orders" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none', color: 'var(--muted)', fontSize: 11 }}>
                  <ArrowDownLeft size={15} />سفارش‌های من
                </Link>
                <Link href="/subscriptions" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none', color: 'var(--muted)', fontSize: 11 }}>
                  <ShieldCheck size={15} />اشتراک‌ها
                </Link>
              </div>
            </article>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
