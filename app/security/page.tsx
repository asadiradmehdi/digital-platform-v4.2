import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  KeyRound,
  Laptop2,
  Lock,
  Server,
  Shield,
  ShieldCheck,
  Smartphone,
  Webhook,
  Zap,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';

export const metadata = {
  title: 'معماری امنیتی',
  robots: { index: false, follow: false },
};

const pillars = [
  {
    icon: ShieldCheck,
    label: 'AUTHENTICATION',
    title: 'احراز هویت',
    description: 'رمز عبور با Argon2id هش می‌شود. MFA و Passkey پشتیبانی می‌شوند. عملیات حساس نیاز به recent-authentication دارند.',
    meta: 'Argon2id · MFA · Passkey',
    href: '/settings/security',
  },
  {
    icon: Laptop2,
    label: 'SESSIONS & DEVICES',
    title: 'نشست‌ها و دستگاه‌ها',
    description: 'کوکی‌های نشست HttpOnly، Secure، SameSite=Strict هستند. در production از __Host- cookie استفاده می‌شود.',
    meta: 'HttpOnly · SameSite=Strict · Revocable',
    href: '/settings/security',
  },
  {
    icon: Smartphone,
    label: 'MOBILE SECURITY',
    title: 'امنیت موبایل',
    description: 'داده‌های حساس در Secure Storage سیستم‌عامل ذخیره می‌شوند. Session rotation پیاده‌سازی شده است.',
    meta: 'MASVS-aligned · Secure Storage',
    href: '/settings/security',
  },
  {
    icon: KeyRound,
    label: 'ACCESS CONTROL',
    title: 'کنترل دسترسی',
    description: 'API keys با scope محدود صادر می‌شوند. Permission boundaryها در سطح workspace اعمال می‌شوند.',
    meta: 'Scoped API keys · Least privilege',
    href: '/settings/api-keys',
  },
] as const;

const controls = [
  {
    icon: Database,
    label: 'DATABASE ISOLATION',
    title: 'ایزولاسیون داده‌ها (RLS)',
    items: [
      'جداول مالی و حساس با PostgreSQL Row-Level Security محافظت می‌شوند.',
      'Context‌های tenant به صورت transaction-local تنظیم می‌شوند؛ هیچ داده‌ای بین تراکنش‌های مختلف نشت نمی‌کند.',
      'عملیات tenant-scoped از طریق withTenantTransaction() انجام می‌شوند.',
    ],
  },
  {
    icon: Webhook,
    label: 'WEBHOOKS',
    title: 'امنیت Webhook',
    items: [
      'payload تنها پس از تأیید امضا و بازه زمانی (freshness window) پردازش می‌شود.',
      'محدودیت حجم payload اعمال می‌شود.',
      'درخواست‌های فاقد امضای معتبر قبل از پردازش رد می‌شوند.',
    ],
  },
  {
    icon: Zap,
    label: 'FINANCIAL INTEGRITY',
    title: 'یکپارچگی مالی',
    items: [
      'تمام جهش‌های مالی idempotency key دارند.',
      'قیمت‌گذاری به‌صورت server-side انجام می‌شود؛ هیچ محاسبه‌ای سمت کلاینت نیست.',
      'تراکنش‌های پرداخت atomic هستند.',
    ],
  },
  {
    icon: Lock,
    label: 'BROWSER SECURITY',
    title: 'امنیت مرورگر',
    items: [
      'CSP nonce-based در production فعال است.',
      'Security headers در لایه مرکزی اعمال می‌شوند.',
      'درخواست‌های mutation نیاز به Same-Origin دارند.',
    ],
  },
  {
    icon: Server,
    label: 'RATE LIMITING & SSRF',
    title: 'Rate Limiting و SSRF',
    items: [
      'Rate limiting توزیع‌شده برای login و register فعال است.',
      'URLهای کنترل‌شده توسط کاربر نیاز به HTTPS و بررسی مقصد دارند.',
      'پروتکل‌های internal-only مسدود می‌شوند.',
    ],
  },
  {
    icon: FileText,
    label: 'AUDIT & EVIDENCE',
    title: 'لاگ‌ها و شواهد امنیتی',
    items: [
      'رویدادهای امنیتی به صورت append-only ثبت می‌شوند.',
      'لاگ‌های ساختارمند از فیلتر redaction عبور می‌کنند؛ secret وارد لاگ نمی‌شود.',
      'رویدادهای پرخطر شامل correlation ID، actor و timestamp هستند.',
    ],
  },
];

export default function SecurityCenter() {
  return (
    <AppShell>
      <main className="workspace-page-content">

        {/* Header */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          paddingBottom: 22,
          marginBottom: 28,
          borderBottom: '1px solid var(--line)',
        }}>
          <div>
            <span style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: 'var(--accent)', fontFamily: 'var(--font-latin)', marginBottom: 3 }}>
              SECURITY ARCHITECTURE
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 4px', color: 'var(--ink)' }}>
              معماری امنیتی
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
              کنترل‌های امنیتی پیاده‌سازی‌شده در پلتفرم — مستندات صادقانه، بدون ادعای اغراق‌آمیز.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Link className="button secondary" href="/settings/security" style={{ fontSize: 11, height: 36, minHeight: 36 }}>
              <ShieldCheck size={13} />
              تنظیمات امنیت
            </Link>
            <Link className="button secondary" href="/settings/api-keys" style={{ fontSize: 11, height: 36, minHeight: 36 }}>
              <KeyRound size={13} />
              API Keys
            </Link>
          </div>
        </header>

        {/* Scope notice */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 18px',
          background: 'var(--surface-2)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          marginBottom: 28,
        }}>
          <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
            این صفحه کنترل‌های امنیتی <strong style={{ color: 'var(--ink)' }}>پیاده‌سازی‌شده</strong> را توصیف می‌کند.
            راه‌اندازی در محیط production نیاز به penetration testing مستقل، بررسی وابستگی‌ها،
            hardening زیرساخت و بررسی‌های حقوقی/compliance دارد.
          </p>
        </div>

        {/* Pillar cards */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', letterSpacing: '.04em', fontFamily: 'var(--font-latin)', margin: '0 0 14px' }}>
            CORE SECURITY CONTROLS
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {pillars.map(({ icon: Icon, label, title, description, meta, href }) => (
              <Link key={label} href={href} style={{ textDecoration: 'none' }}>
                <article
                  className="surface-panel"
                  style={{
                    padding: '20px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'border-color .15s, box-shadow .15s',
                  }}
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      display: 'block',
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '.07em',
                      color: 'var(--accent)',
                      marginBottom: 4,
                      fontFamily: 'var(--font-latin)',
                    }}>
                      {label}
                    </span>
                    <strong style={{
                      display: 'block',
                      fontSize: 14,
                      color: 'var(--ink)',
                      marginBottom: 7,
                      letterSpacing: '-.02em',
                    }}>
                      {title}
                    </strong>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
                      {description}
                    </p>
                  </div>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 9,
                    color: 'var(--subtle)',
                    fontFamily: 'var(--font-latin)',
                    letterSpacing: '.03em',
                    padding: '4px 9px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    alignSelf: 'flex-start',
                  }}>
                    {meta}
                  </span>
                </article>
              </Link>
            ))}
          </div>
        </section>

        {/* Detailed control sections */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', letterSpacing: '.04em', fontFamily: 'var(--font-latin)', margin: '0 0 14px' }}>
            CONTROL DETAILS
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {controls.map(({ icon: Icon, label, title, items }) => (
              <article key={label} className="surface-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: 'var(--surface-2)',
                    color: 'var(--muted)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={16} />
                  </span>
                  <div>
                    <span style={{ display: 'block', fontSize: 8, fontWeight: 800, letterSpacing: '.08em', color: 'var(--subtle)', fontFamily: 'var(--font-latin)', marginBottom: 2 }}>
                      {label}
                    </span>
                    <strong style={{ fontSize: 13, color: 'var(--ink)', letterSpacing: '-.02em' }}>{title}</strong>
                  </div>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                  {items.map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                      <span style={{ marginTop: 2, flexShrink: 0 }}>
                        <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Reporting */}
        <article className="surface-panel" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <span style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--warning-soft)',
              color: 'var(--warning)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}>
              <Shield size={18} />
            </span>
            <div>
              <strong style={{ display: 'block', fontSize: 14, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-.02em' }}>
                گزارش آسیب‌پذیری
              </strong>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.9 }}>
                اگر آسیب‌پذیری امنیتی یافتید، از طریق کانال امنیتی با ما تماس بگیرید.
                لطفاً اطلاعات را بدون افشای عمومی (responsible disclosure) ارسال کنید.
                کلیه گزارش‌ها با جدیت بررسی می‌شوند.
              </p>
            </div>
          </div>
        </article>

      </main>
    </AppShell>
  );
}
