import Link from 'next/link';
import { KeyRound, Laptop2, ShieldCheck, Smartphone } from 'lucide-react';
import { AppShell } from '../../components/AppShell';

export const metadata = { title: 'مرکز امنیت', robots: { index: false, follow: false } };

const pillars = [
  {
    icon: ShieldCheck,
    label: 'AUTHENTICATION',
    title: 'احراز هویت',
    description: 'MFA، Passkey و پنجره recent-authentication برای عملیات حساس.',
    meta: 'High-assurance baseline',
    href: '/settings/security',
  },
  {
    icon: Laptop2,
    label: 'SESSIONS & DEVICES',
    title: 'نشست‌ها و دستگاه‌ها',
    description: 'نشست‌های فعال و دستگاه‌های شناخته‌شده را بررسی و revoke کنید.',
    meta: 'Revocable · Audited',
    href: '/settings/security',
  },
  {
    icon: Smartphone,
    label: 'MOBILE SECURITY',
    title: 'امنیت موبایل',
    description: 'Secure storage، session rotation و release gateهای اپ موبایل.',
    meta: 'MASVS-aligned baseline',
    href: '/settings/security',
  },
  {
    icon: KeyRound,
    label: 'ACCESS CONTROL',
    title: 'کنترل دسترسی',
    description: 'API keys، scopeها و permission boundaryهای workspace.',
    meta: 'Least privilege',
    href: '/settings/api-keys',
  },
] as const;

export default function SecurityCenter() {
  return (
    <AppShell>
      <main className="workspace-page-content">
        <div className="dash-hero">
          <div>
            <span className="eyebrow">SECURITY CONTROL PLANE</span>
            <h1>مرکز امنیت</h1>
            <p>
              MFA، Passkey، نشست‌ها، دستگاه‌های مورد اعتماد و رخدادهای امنیتی —
              قابل مشاهده، قابل مدیریت.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link className="button primary" href="/settings/security">تنظیمات امنیت</Link>
            <Link className="button secondary" href="/settings">تنظیمات حساب</Link>
          </div>
        </div>

        {/* Pillars grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {pillars.map(({ icon: Icon, label, title, description, meta, href }) => (
            <Link key={label} href={href} style={{ textDecoration: 'none' }}>
              <article
                className="surface-panel"
                style={{
                  padding: '24px 22px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  cursor: 'pointer',
                  transition: 'border-color .15s, box-shadow .15s',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '.07em',
                      color: 'var(--accent)',
                      marginBottom: 5,
                      fontFamily: 'var(--font-latin)',
                    }}
                  >
                    {label}
                  </span>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: 15,
                      color: 'var(--ink)',
                      marginBottom: 8,
                      letterSpacing: '-.02em',
                    }}
                  >
                    {title}
                  </strong>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
                    {description}
                  </p>
                </div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 9,
                    color: 'var(--subtle)',
                    fontFamily: 'var(--font-latin)',
                    letterSpacing: '.04em',
                    padding: '4px 9px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    alignSelf: 'flex-start',
                  }}
                >
                  {meta}
                </span>
              </article>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
