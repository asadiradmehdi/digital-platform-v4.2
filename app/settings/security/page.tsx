import Link from 'next/link';
import { ArrowRight, CheckCircle2, Laptop2, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
export const metadata = { title: 'امنیت', robots: { index: false, follow: false } };
const sessions = [
  { id: 's1', device: 'Chrome — macOS', ip: '185.x.x.x', lastSeen: 'الان', current: true, icon: Laptop2 },
  { id: 's2', device: 'Safari — iPhone 15', ip: '78.x.x.x', lastSeen: '۳ ساعت پیش', current: false, icon: Smartphone },
];
export default function SecuritySettings() {
  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div><span className="eyebrow">SETTINGS / SECURITY</span><h1>امنیت حساب</h1><p>MFA، Passkey، نشست‌های فعال و دستگاه‌های مورد اعتماد.</p></div>
          <Link className="button secondary" href="/settings"><ArrowRight size={15}/>تنظیمات</Link>
        </header>
        <SystemStrip/>
        <div className="settings-layout">
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">PASSWORD</span><h2>تغییر رمز عبور</h2></div></div>
            <form className="settings-form">
              <label>رمز عبور فعلی<input name="currentPassword" type="password" autoComplete="current-password"/></label>
              <label>رمز عبور جدید<input name="newPassword" type="password" autoComplete="new-password"/></label>
              <label>تکرار رمز عبور جدید<input name="confirmPassword" type="password" autoComplete="new-password"/></label>
              <p style={{ fontSize: 10, color: 'var(--muted)', margin: 0 }}>حداقل ۱۴ کاراکتر — ترکیب حروف بزرگ، کوچک، عدد و نماد.</p>
              <div className="form-actions"><button className="button primary" type="submit">تغییر رمز عبور</button></div>
            </form>
          </article>
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">MFA</span><h2>احراز هویت دو‌مرحله‌ای</h2></div><span className="status-pill success">فعال</span></div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 2, margin: '0 0 16px' }}>TOTP با یک اپ مثل Google Authenticator یا 1Password فعال است. Backup codeها نیز صادر شده‌اند.</p>
            <div className="hero-actions">
              <Link className="button secondary" href="/api/v1/auth/mfa/totp/begin">پیکربندی مجدد TOTP</Link>
              <Link className="button secondary" href="/api/v1/auth/recovery-codes">کدهای بازیابی</Link>
            </div>
          </article>
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">SESSIONS</span><h2>نشست‌های فعال</h2></div></div>
            <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
              {sessions.map(s => (
                <div key={s.id} className="session-row">
                  <span className="session-icon"><s.icon size={17}/></span>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 12 }}>{s.device}</b>
                    <small style={{ display: 'block', color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>
                      <span className="text-ltr">{s.ip}</span> · {s.lastSeen}
                    </small>
                  </div>
                  {s.current
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--success)' }}><CheckCircle2 size={13}/>این دستگاه</span>
                    : <button className="button secondary" style={{ padding: '0 12px', height: 32, fontSize: 10 }} type="button"><LogOut size={12}/>خروج</button>
                  }
                </div>
              ))}
            </div>
            <button className="button danger" style={{ marginTop: 16, width: '100%' }} type="button">خروج از همه دستگاه‌ها به جز این</button>
          </article>
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">PASSKEY</span><h2>Passkey و دستگاه‌های مورد اعتماد</h2></div></div>
            <div className="empty-state" style={{ minHeight: 120 }}>
              <div className="empty-mark"><ShieldCheck size={20}/></div>
              <h3>Passkey ثبت‌نشده</h3>
              <p>با ثبت Passkey می‌توانید بدون رمز عبور وارد شوید.</p>
            </div>
            <button className="button primary" style={{ width: '100%', marginTop: 8 }} type="button">افزودن Passkey</button>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
