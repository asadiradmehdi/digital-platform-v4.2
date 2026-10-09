import Link from 'next/link';
import { Bell, CreditCard, ShieldCheck, UserRound } from 'lucide-react';
import { AppShell } from '../../components/AppShell';

export const metadata = { title: 'تنظیمات', robots: { index: false, follow: false } };

const sections = [
  {
    icon: UserRound,
    title: 'پروفایل',
    description: 'نام نمایشی، شماره موبایل و اطلاعات هویتی حساب را ویرایش کنید.',
    href: '/settings/profile',
    cta: 'ویرایش پروفایل',
  },
  {
    icon: ShieldCheck,
    title: 'امنیت',
    description: 'رمز عبور، احراز هویت دومرحله‌ای، ورود با اثر انگشت، نشست‌های فعال و دستگاه‌های مورد اعتماد.',
    href: '/settings/security',
    cta: 'مدیریت امنیت',
  },
  {
    icon: Bell,
    title: 'اعلان‌ها',
    description: 'تعیین کنید چه رویدادهایی را از طریق ایمیل، اعلان فوری یا پیامک دریافت کنید.',
    href: '/settings/notifications',
    cta: 'تنظیم اعلان‌ها',
  },
  {
    icon: CreditCard,
    title: 'پرداخت و صورتحساب',
    description: 'وضعیت اشتراک، موجودی کیف پول، تاریخچه فاکتورها و تمدید خودکار.',
    href: '/settings/billing',
    cta: 'مشاهده صورتحساب',
  },
] as const;

export default function Settings() {
  return (
    <AppShell>
      <main className="workspace-page-content">
        <div className="dash-hero">
          <div>
            <span className="eyebrow">حساب کاربری · تنظیمات</span>
            <h1>تنظیمات</h1>
            <p>مدیریت پروفایل، امنیت، اعلان‌ها و دسترسی‌های فنی فضای کاری.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {sections.map(({ icon: Icon, title, description, href, cta }) => (
            <Link
              key={href}
              href={href}
              style={{ textDecoration: 'none' }}
            >
              <article
                className="surface-panel"
                style={{
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
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
                    flex: 'none',
                  }}
                >
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 14, color: 'var(--ink)', letterSpacing: '-.015em' }}>
                    {title}
                  </strong>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 3, lineHeight: 1.7 }}>
                    {description}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--accent)',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    flex: 'none',
                  }}
                >
                  {cta} ←
                </span>
              </article>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
