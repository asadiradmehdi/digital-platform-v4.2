import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash } from 'node:crypto';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { query } from '../../../server/core/db';
import { listPasskeys } from '../../../server/identity/passkey-service';
import { listTrustedDevices } from '../../../server/identity/trusted-devices';
import PasswordForm from './PasswordForm';
import SessionManager from './SessionManager';

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

  const [sessionsResult, mfaResult, passkeys, trustedDevices] = await Promise.all([
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
    listPasskeys(userId).catch(() => [] as Awaited<ReturnType<typeof listPasskeys>>),
    listTrustedDevices(userId).catch(() => [] as Awaited<ReturnType<typeof listTrustedDevices>>),
  ]);

  const sessions = sessionsResult.rows;
  const hasMfa = mfaResult.rows.some(m => m.enabled);

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
            <PasswordForm />
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
            <SessionManager sessions={sessions.map(s => {
              const isCurrent = s.tokenHash === currentTokenHash;
              const ua = s.lastUserAgent ?? '';
              let label = s.deviceName ?? '';
              if (!label) {
                if (/iPhone|iPad/.test(ua)) label = 'Safari — iOS';
                else if (/Android/.test(ua)) label = 'Chrome — Android';
                else if (/Chrome/.test(ua)) label = 'Chrome — Desktop';
                else if (/Firefox/.test(ua)) label = 'Firefox — Desktop';
                else if (/Safari/.test(ua)) label = 'Safari — Desktop';
                else if (s.clientType === 'IOS') label = 'iOS App';
                else if (s.clientType === 'ANDROID') label = 'Android App';
                else label = 'مرورگر وب';
              }
              const lastSeen = s.lastSeenAt
                ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s.lastSeenAt))
                : new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(s.createdAt));
              return { ...s, isCurrent, label, lastSeen };
            })} />
          </article>
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head">
              <div><span className="panel-kicker">PASSKEY</span><h2>Passkey</h2></div>
              <span className={`status-pill ${passkeys.length > 0 ? 'success' : 'neutral'}`}>
                {passkeys.length > 0 ? `${passkeys.length} ثبت‌شده` : 'ثبت‌نشده'}
              </span>
            </div>
            {passkeys.length === 0 ? (
              <div className="empty-state" style={{ minHeight: 100 }}>
                <div className="empty-mark"><ShieldCheck size={20}/></div>
                <h3>Passkey ثبت‌نشده</h3>
                <p>با ثبت Passkey می‌توانید بدون رمز عبور وارد شوید.</p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {passkeys.map(pk => (
                  <li key={pk.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--hairline)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{pk.label ?? 'Passkey'}</div>
                      <div style={{ fontSize: 11, color: 'var(--subtle)' }}>
                        {pk.lastUsedAt
                          ? `آخرین استفاده: ${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(pk.lastUsedAt))}`
                          : `ثبت‌شده: ${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(pk.createdAt))}`}
                      </div>
                    </div>
                    <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                  </li>
                ))}
              </ul>
            )}
            <button className="button primary" style={{ width: '100%', marginTop: 12 }} type="button">افزودن Passkey</button>
          </article>
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head">
              <div><span className="panel-kicker">TRUSTED DEVICES</span><h2>دستگاه‌های مورد اعتماد</h2></div>
              <span className="status-pill neutral">{trustedDevices.length} دستگاه</span>
            </div>
            {trustedDevices.length === 0 ? (
              <div className="empty-state" style={{ minHeight: 100 }}>
                <div className="empty-mark"><ShieldCheck size={20}/></div>
                <h3>دستگاه مورد اعتمادی ثبت نشده</h3>
                <p>دستگاه‌های تأییدشده برای احراز هویت سریع‌تر استفاده می‌شوند.</p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {trustedDevices.map(d => (
                  <li key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--hairline)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{d.deviceName ?? 'دستگاه ناشناس'}</div>
                      <div style={{ fontSize: 11, color: 'var(--subtle)' }}>
                        {d.platform ? `${d.platform} · ` : ''}
                        {d.lastSeenAt
                          ? `آخرین فعالیت: ${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(d.lastSeenAt))}`
                          : `ثبت‌شده: ${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(d.createdAt))}`}
                      </div>
                    </div>
                    <CheckCircle2 size={16} style={{ color: 'var(--accent)' }} />
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </main>
    </AppShell>
  );
}
