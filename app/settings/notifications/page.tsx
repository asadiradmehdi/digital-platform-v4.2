import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
export const metadata = { title: 'اعلان‌ها', robots: { index: false, follow: false } };
const channels = [
  { key: 'email', label: 'ایمیل', desc: 'دریافت اعلان‌های مهم به ایمیل' },
  { key: 'push', label: 'Push notification', desc: 'اعلان فوری در مرورگر یا اپ موبایل' },
  { key: 'sms', label: 'پیامک', desc: 'رویدادهای مهم از جمله ورود و تراکنش' },
];
const categories = [
  { key: 'orders', label: 'سفارش‌ها', desc: 'تغییر وضعیت، تکمیل یا لغو سفارش' },
  { key: 'payments', label: 'پرداخت و کیف پول', desc: 'واریز، برداشت، تمدید اشتراک' },
  { key: 'security', label: 'امنیت', desc: 'ورود جدید، تغییر رمز، رویدادهای حساس', alwaysOn: true },
  { key: 'ai', label: 'هوش مصنوعی', desc: 'اتمام اعتبار، خطاهای مدل' },
  { key: 'automation', label: 'اتوماسیون', desc: 'Workflow تکمیل‌شده یا متوقف‌شده' },
  { key: 'updates', label: 'اخبار و به‌روزرسانی', desc: 'قابلیت‌های جدید و تغییرات مهم' },
];
export default function NotificationSettings() {
  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div><span className="eyebrow">SETTINGS / NOTIFICATIONS</span><h1>اعلان‌ها</h1><p>کانال‌های اطلاع‌رسانی و دسته‌بندی رویدادهایی که می‌خواهید دریافت کنید.</p></div>
          <Link className="button secondary" href="/settings"><ArrowRight size={15}/>تنظیمات</Link>
        </header>
        <SystemStrip/>
        <div className="settings-layout">
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">CHANNELS</span><h2>کانال‌های اطلاع‌رسانی</h2></div></div>
            <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
              {channels.map(ch => (
                <label key={ch.key} className="toggle-row">
                  <div>
                    <b style={{ fontSize: 12 }}>{ch.label}</b>
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{ch.desc}</span>
                  </div>
                  <input type="checkbox" role="switch" defaultChecked={ch.key === 'email'} aria-label={ch.label}/>
                </label>
              ))}
            </div>
          </article>
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">CATEGORIES</span><h2>دسته‌بندی رویدادها</h2></div></div>
            <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
              {categories.map(cat => (
                <label key={cat.key} className="toggle-row">
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 12 }}>{cat.label}</b>
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{cat.desc}</span>
                    {cat.alwaysOn && <span style={{ fontSize: 9, color: 'var(--accent-strong)', display: 'block', marginTop: 3 }}>همیشه فعال — برای امنیت حساب</span>}
                  </div>
                  <input type="checkbox" role="switch" defaultChecked={cat.key !== 'updates'} disabled={cat.alwaysOn} aria-label={cat.label}/>
                </label>
              ))}
            </div>
            <div className="form-actions" style={{ marginTop: 20 }}>
              <button className="button primary" type="button">ذخیره تنظیمات</button>
            </div>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
