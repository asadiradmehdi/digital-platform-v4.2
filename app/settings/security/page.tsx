import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash } from 'node:crypto';
import { ArrowRight, CheckCircle2, Laptop2, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { query } from '../../../server/core/db';

export const metadata: Metadata = { title: 'امنیت', robots: { index: false, follow: false } };

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export default async function SecuritySettings() {
  let userId: string;
  try {
    userId = await requireCurrentUser();
  } catch {
    redirect('/auth');
  }

  const store = await cookies();
  const cookieName = process.env.SESSION_COOKIE_NAME ?? (process.env.NODE_ENV === 'production' ? '__Host-dp_session' : 'dp_session');
  const currentTokenHash = store.get(cookieName)?.value ? hashToken(store.get(cookieName)!.value) : null;

  const [sessionsResult, mfaResult] = await Promise.all([
    query<{
      id: string; tokenHash: string; clientType: string | null; deviceName: string | null;
      lastUserAgent: string | null; lastSeenAt: string | null; createdAt: string;
    }>(
      `SELECT id, token_hash AS "tokenHash", client_type AS "clientType",
              device_name AS "deviceName", last_user_agent AS "lastUserAgent",
              last_seen_at AS "lastSeenAt", created_at AS "createdAt"
       FROM sessions
       WHERE user_id=$1 AND revoked_at IS NULL AND expires_at > now()
       ORDER BY last_seen_at DESC NULLS LAST`,
      [userId],
    ),
    query<{ methodType: string; enabled: boolean }>(
      `SELECT method_type AS "methodType", enabled FROM mfa_methods WHERE user_id=$1`,
      [userId],
    ),
  ]);

  const sessions = sessionsResult.rows;
  const hasMfa = mfaResult.rows.some(m => m.enabled);

  function sessionLabel(s: typeof sessions[0]) {
    if (s.deviceName) return s.deviceName;
    const ua = s.lastUserAgent ?? '';
    if (/iPhone|iPad/.test(ua)) return `Safari — iOS`;
    if (/Android/.test(ua)) return `Chrome — Android`;
    if (/Chrome/.test(ua)) return `Chrome — Desktop`;
    if (/Firefox/.test(ua)) return `Firefox — Desktop`;
    if (/Safari/.test(ua)) return `Safari — Desktop`;
    if (s.clientType === 'IOS') return 'iOS App';
    if (s.clientType === 'ANDROID') return 'Android App';
    return 'مرورگر وب';
  }

  function sessionIcon(s: typeof sessions[0]) {
    const ua = s.lastUserAgent ?? '';
    if (/iPhone|iPad|Android/.test(ua) || s.clientType === 'IOS' || s.clientType === 'ANDROID') return Smartphone;
    return Laptop2;
  }

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
            <div className="panel-head">
              <div><span className="panel-kicker">MFA</span><h2>احراز هویت دو‌مرحله‌ای</h2></div>
              <span className={`status-pill ${hasMfa ? 'success' : 'warning'}`}>{hasMfa ? 'فعال' : 'غیرفعال'}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 2, margin: '0 0 16px' }}>
              {hasMfa
                ? 'TOTP با یک اپ مثل Google Authenticator فعال است.'
                : 'احراز هویت دومرحله‌ای فعال نیست. برای امنیت بیشتر آن را فعال کنید.'}
            </p>
            <div className="hero-actions">
              <Link className="button secondary" href="/api/v1/auth/mfa/totp/begin">پیکربندی TOTP</Link>
              {hasMfa && <Link className="button secondary" href="/api/v1/auth/recovery-codes">کدهای بازیابی</Link>}
            </div>
          </article>
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">SESSIONS</span><h2>نشست‌های فعال</h2></div></div>
            <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
              {sessions.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>نشست فعالی یافت نشد.</p>
              ) : (
                sessions.map(s => {
                  const isCurrent = s.tokenHash === currentTokenHash;
                  const Icon = sessionIcon(s);
                  const label = sessionLabel(s);
                  const lastSeen = s.lastSeenAt
                    ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s.lastSeenAt))
                    : new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(s.createdAt));
                  return (
                    <div key={s.id} className="session-row">
                      <span className="session-icon"><Icon size={17}/></span>
                      <div style={{ flex: 1 }}>
                        <b style={{ fontSize: 12 }}>{label}</b>
                        <small style={{ display: 'block', color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>
                          آخرین فعالیت: {lastSeen}
                        </small>
                      </div>
                      {isCurrent
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--success)' }}><CheckCircle2 size={13}/>این دستگاه</span>
                        : <button className="button secondary" style={{ padding: '0 12px', height: 32, fontSize: 10 }} type="button"><LogOut size={12}/>خروج</button>
                      }
                    </div>
                  );
                })
              )}
            </div>
            {sessions.length > 1 && (
              <button className="button danger" style={{ marginTop: 16, width: '100%' }} type="button">خروج از همه دستگاه‌ها به جز این</button>
            )}
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
