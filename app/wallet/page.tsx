import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowDownLeft, ArrowUpLeft, Plus, ShieldCheck, TrendingUp,
  WalletCards, Package, RotateCcw, CreditCard, ChevronDown,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { formatTomanFromIRR } from '../../lib/format';
import { requireCurrentUser } from '../../server/identity/request-user';
import { query, withWorkspaceTransaction } from '../../server/core/db';
import WalletTopup from './WalletTopup';

export const metadata: Metadata = { title: 'کیف پول', robots: { index: false, follow: false } };

const referenceTypeLabel: Record<string, string> = {
  DEPOSIT: 'افزایش موجودی',
  SERVICE_CHARGE: 'هزینه سرویس',
  REFUND: 'بازگشت وجه',
  SUBSCRIPTION: 'اشتراک',
  TOPUP: 'افزایش موجودی',
};

function txBadge(direction: string, refType: string) {
  if (direction === 'CREDIT') {
    return { cls: 'success', icon: <ArrowUpLeft size={11} />, label: 'واریز' };
  }
  if (refType === 'REFUND') {
    return { cls: 'warning', icon: <RotateCcw size={11} />, label: 'بازگشت' };
  }
  return { cls: 'danger', icon: <ArrowDownLeft size={11} />, label: 'برداشت' };
}

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
    redirect('/auth');
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

  const totalDeposited = entries
    .filter(e => e.direction === 'CREDIT')
    .reduce((sum, e) => sum + Number(e.amountMinor), 0);

  return (
    <AppShell>
      <main className="workspace-page-content">
        {/* Page header */}
        <header className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <span className="eyebrow">مالی · کیف پول</span>
            <h1>کیف پول</h1>
            <p>موجودی، تراکنش‌ها و افزایش اعتبار در یک نگاه.</p>
          </div>
          <a href="#topup" className="button primary" style={{ textDecoration: 'none' }}>
            <Plus size={15} />افزایش موجودی
          </a>
        </header>

        <SystemStrip />

        {/* Balance hero + metrics */}
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) repeat(2,minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
          {/* Balance hero card */}
          <div style={{
            border: '1px solid rgba(26,86,219,.2)',
            borderRadius: 20,
            padding: '28px 28px 24px',
            background: 'linear-gradient(135deg, rgba(26,86,219,.06) 0%, var(--surface) 60%)',
            display: 'flex', flexDirection: 'column', gap: 10,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', background: 'rgba(26,86,219,.04)', top: -60, left: -60, pointerEvents: 'none' }} />
            <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 800, letterSpacing: '.08em' }}>موجودی قابل استفاده</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 800, letterSpacing: '-.055em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {formatTomanFromIRR(balanceMinor)}
              </strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: 10, fontWeight: 700, background: 'var(--success-soft)', padding: '3px 8px', borderRadius: 999 }}>
                <ShieldCheck size={10} />تأییدشده
              </span>
            </div>
          </div>

          {/* Spend this month */}
          <div className="metric-tile" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span>خرج این ماه</span>
            <strong style={{ color: 'var(--danger)' }}>{formatTomanFromIRR(thisMonthSpend)}</strong>
            <small style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrendingUp size={10} />ماه جاری
            </small>
          </div>

          {/* Total deposited */}
          <div className="metric-tile" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span>کل واریزی‌ها</span>
            <strong style={{ color: 'var(--success)' }}>{formatTomanFromIRR(totalDeposited)}</strong>
            <small style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <CreditCard size={10} />از ابتدا تاکنون
            </small>
          </div>
        </section>

        {/* Main layout */}
        <div className="wallet-layout">
          {/* Transaction history */}
          <article className="surface-panel data-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p className="panel-kicker" style={{ margin: '0 0 2px' }}>تراکنش‌ها</p>
                <h2 style={{ margin: 0 }}>تراکنش‌های اخیر</h2>
              </div>
              {entries.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {new Intl.NumberFormat('fa-IR').format(entries.length)} تراکنش
                </span>
              )}
            </div>

            {entries.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                  <WalletCards size={22} />
                </div>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>هنوز تراکنشی ثبت نشده</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>پس از اولین افزایش موجودی، تراکنش‌ها اینجا نمایش داده می‌شوند.</p>
                </div>
                <a href="#topup" className="button primary" style={{ textDecoration: 'none', marginTop: 4 }}>
                  <Plus size={13} />افزایش موجودی
                </a>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ paddingRight: 22 }}>نوع</th>
                        <th>شرح</th>
                        <th>تاریخ</th>
                        <th style={{ paddingLeft: 22 }}>مبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(e => {
                        const isCredit = e.direction === 'CREDIT';
                        const label = (e.metadata?.label as string | undefined) ?? referenceTypeLabel[e.referenceType] ?? e.referenceType;
                        const badge = txBadge(e.direction, e.referenceType);
                        return (
                          <tr key={e.id}>
                            <td style={{ paddingRight: 22 }}>
                              <span className={`status-pill ${badge.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {badge.icon}{badge.label}
                              </span>
                            </td>
                            <td>
                              <strong style={{ fontSize: 11 }}>{label}</strong>
                            </td>
                            <td style={{ color: 'var(--muted)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
                              {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(e.createdAt))}
                            </td>
                            <td style={{ paddingLeft: 22 }}>
                              <span style={{
                                color: isCredit ? 'var(--success)' : 'var(--danger)',
                                fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 12,
                              }}>
                                {isCredit ? '+' : '−'}{formatTomanFromIRR(Number(e.amountMinor))}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {entries.length >= 50 && (
                  <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'center' }}>
                    <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <ChevronDown size={13} />نمایش بیشتر
                    </button>
                  </div>
                )}
              </>
            )}
          </article>

          {/* Sidebar */}
          <aside id="topup" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Top-up panel */}
            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 18 }}>
                <div>
                  <p className="panel-kicker" style={{ margin: '0 0 2px' }}>افزایش موجودی</p>
                  <h2 style={{ margin: 0 }}>افزایش موجودی</h2>
                </div>
              </div>
              <WalletTopup />
            </article>

            {/* Quick links */}
            <article className="surface-panel">
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <div>
                  <p className="panel-kicker" style={{ margin: '0 0 2px' }}>دسترسی سریع</p>
                  <h2 style={{ margin: 0 }}>عملیات سریع</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <Link
                  href="/orders"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
                    border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none',
                    color: 'var(--muted)', fontSize: 11,
                  }}
                >
                  <Package size={14} />سفارش‌های من
                </Link>
                <Link
                  href="/subscriptions"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
                    border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none',
                    color: 'var(--muted)', fontSize: 11,
                  }}
                >
                  <ShieldCheck size={14} />اشتراک‌ها
                </Link>
              </div>
            </article>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
