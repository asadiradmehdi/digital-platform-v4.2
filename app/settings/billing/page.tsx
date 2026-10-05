import Link from 'next/link';
import { ArrowRight, CreditCard, Download, ExternalLink } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
import { formatTomanFromIRR } from '../../../lib/format';
export const metadata = { title: 'پرداخت و صورتحساب', robots: { index: false, follow: false } };
const invoices = [
  { id: 'inv-1', code: 'INV-202610-001', date: '۲ مهر ۱۴۰۵', amount: 18900000, status: 'PAID' },
  { id: 'inv-2', code: 'INV-202609-003', date: '۱ شهریور ۱۴۰۵', amount: 18900000, status: 'PAID' },
  { id: 'inv-3', code: 'INV-202608-002', date: '۱ مرداد ۱۴۰۵', amount: 14500000, status: 'PAID' },
];
export default function BillingSettings() {
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
            <div className="panel-head"><div><span className="panel-kicker">CURRENT PLAN</span><h2>اشتراک فعال</h2></div><span className="status-pill success">فعال</span></div>
            <div className="metric-grid-4" style={{ marginTop: 16 }}>
              <div className="metric-tile"><span>پلن</span><strong>Pro</strong></div>
              <div className="metric-tile"><span>هزینه ماهانه</span><strong>{formatTomanFromIRR(18900000)}</strong></div>
              <div className="metric-tile"><span>تمدید بعدی</span><strong>۲۸ مهر ۱۴۰۵</strong></div>
              <div className="metric-tile"><span>روش پرداخت</span><strong>کیف پول</strong></div>
            </div>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <Link className="button secondary" href="/pricing">تغییر پلن</Link>
              <button className="button danger" type="button">لغو اشتراک</button>
            </div>
          </article>
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">WALLET</span><h2>کیف پول</h2></div><Link className="button secondary" style={{ padding: '0 14px', height: 34, fontSize: 11 }} href="/wallet">مشاهده کامل</Link></div>
            <div className="metric-grid-4" style={{ marginTop: 16 }}>
              <div className="metric-tile"><span>موجودی</span><strong>{formatTomanFromIRR(12500000)}</strong></div>
              <div className="metric-tile"><span>معلق</span><strong>{formatTomanFromIRR(0)}</strong></div>
            </div>
            <button className="button primary" style={{ marginTop: 16 }} type="button"><CreditCard size={15}/>افزایش موجودی</button>
          </article>
          <article className="surface-panel data-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">INVOICES</span><h2>فاکتورها</h2></div><Link className="button secondary" style={{ padding: '0 14px', height: 34, fontSize: 11 }} href="/wallet">همه فاکتورها</Link></div>
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead><tr><th>کد فاکتور</th><th>تاریخ</th><th>مبلغ</th><th>وضعیت</th><th></th></tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><strong className="text-ltr">{inv.code}</strong></td>
                    <td>{inv.date}</td>
                    <td>{formatTomanFromIRR(inv.amount)}</td>
                    <td><span className="status-pill success">پرداخت‌شده</span></td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button aria-label="دانلود" style={{ background: 'none', color: 'var(--muted)' }}><Download size={14}/></button>
                      <button aria-label="مشاهده" style={{ background: 'none', color: 'var(--muted)' }}><ExternalLink size={14}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
