import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpLeft, CreditCard, Plus, ShieldCheck, TrendingUp } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SystemStrip } from '../../components/ProductSurface';
import { walletFixture } from '../../lib/product-fixtures';
import { formatTomanFromIRR } from '../../lib/format';

export const metadata: Metadata = { title: 'کیف پول', robots: { index: false, follow: false } };

const topupAmounts = [50_000_000, 100_000_000, 200_000_000, 500_000_000];

export default function Wallet() {
  const { balanceMinor, pendingMinor, transactions } = walletFixture;
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

        {/* Balance cards */}
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
            <strong>{formatTomanFromIRR(pendingMinor)}</strong>
            <small>در انتظار تسویه</small>
          </article>
          <article className="metric-tile">
            <span>خرج این ماه</span>
            <strong>{formatTomanFromIRR(
              transactions
                .filter(t => t.amountMinor < 0)
                .reduce((sum, t) => sum + Math.abs(t.amountMinor), 0)
            )}</strong>
            <small style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <TrendingUp size={11} />مهر ۱۴۰۵
            </small>
          </article>
        </section>

        <div className="wallet-layout">
          {/* Ledger */}
          <article className="surface-panel data-panel">
            <div className="panel-head" style={{ marginBottom: 16 }}>
              <div>
                <p className="panel-kicker">LEDGER</p>
                <h2>تراکنش‌های اخیر</h2>
              </div>
            </div>
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
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td>
                      <span className={`status-pill ${t.amountMinor < 0 ? 'danger' : 'success'}`}>
                        {t.amountMinor < 0
                          ? <><ArrowDownLeft size={12} /> خروج</>
                          : <><ArrowUpLeft size={12} /> ورود</>}
                      </span>
                    </td>
                    <td><strong>{t.label}</strong></td>
                    <td style={{ color: 'var(--muted)', fontSize: 10 }}>
                      {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t.createdAt))}
                    </td>
                    <td>
                      <span style={{ color: t.amountMinor < 0 ? 'var(--danger)' : 'var(--success)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 12 }}>
                        {t.amountMinor < 0 ? '−' : '+'}{formatTomanFromIRR(Math.abs(t.amountMinor))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          {/* Topup panel */}
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
