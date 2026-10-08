import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Trash2 } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { query } from '../../../server/core/db';
import ProfileForm from './ProfileForm';
import PhoneSection from './PhoneSection';

export const metadata: Metadata = { title: 'پروفایل', robots: { index: false, follow: false } };

export default async function ProfileSettings() {
  let userId: string;
  try {
    userId = await requireCurrentUser();
  } catch {
    redirect('/auth');
  }

  const r = await query<{ display_name: string; email: string | null; phone: string | null; phone_verified: boolean }>(
    `SELECT COALESCE(display_name, split_part(COALESCE(email,''), '@', 1)) AS display_name,
            email, phone, (phone_verified_at IS NOT NULL) AS phone_verified
     FROM users WHERE id=$1`,
    [userId],
  );
  const user = r.rows[0];
  const initials = user?.display_name?.slice(0, 2) ?? '؟';

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div>
            <span className="eyebrow">حساب کاربری · پروفایل</span>
            <h1>پروفایل</h1>
            <p>هویت، نام نمایشی و اطلاعات پایه حساب.</p>
          </div>
          <Link className="button secondary" href="/settings">
            <ArrowRight size={15} />
            تنظیمات
          </Link>
        </header>

        <div className="settings-layout">
          {/* Identity card */}
          <article className="surface-panel" style={{ padding: 28 }}>
            <div className="panel-head">
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '.07em',
                    color: 'var(--accent)',
                    marginBottom: 4,
                    fontFamily: 'var(--font-latin)',
                  }}
                >
                  IDENTITY
                </span>
                <h2>اطلاعات شخصی</h2>
              </div>
            </div>

            {/* Avatar row */}
            <div className="profile-avatar-row">
              <div className="profile-avatar">
                <span>{initials}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  {user?.display_name ?? '—'}
                </p>
                <p
                  style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}
                  dir="ltr"
                >
                  {user?.email ?? '—'}
                </p>
              </div>
            </div>

            {/* Email — read-only */}
            <div style={{ marginBottom: 6 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'grid',
                  gap: 7,
                  color: 'var(--ink)',
                }}
              >
                ایمیل
                <input
                  name="email"
                  type="email"
                  defaultValue={user?.email ?? ''}
                  autoComplete="email"
                  dir="ltr"
                  readOnly
                  style={{
                    padding: '10px 13px',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    fontSize: 13,
                    background: 'var(--surface-2)',
                    color: 'var(--muted)',
                    cursor: 'not-allowed',
                    fontFamily: 'var(--font-latin)',
                  }}
                />
              </label>
              <p style={{ margin: '5px 0 0', fontSize: 10, color: 'var(--subtle)' }}>
                ایمیل برای ورود با رمز عبور و گوگل استفاده می‌شود.
              </p>
            </div>

            <PhoneSection phone={user?.phone ?? null} verified={Boolean(user?.phone_verified)} />

            <ProfileForm initialDisplayName={user?.display_name ?? ''} />
          </article>

          {/* Danger zone */}
          <article
            className="surface-panel"
            style={{
              padding: 28,
              borderColor: 'rgba(220,38,38,.15)',
            }}
          >
            <div className="panel-head">
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '.07em',
                    color: 'var(--danger)',
                    marginBottom: 4,
                    fontFamily: 'var(--font-latin)',
                  }}
                >
                  DANGER ZONE
                </span>
                <h2>حذف حساب</h2>
              </div>
            </div>
            <p
              style={{
                fontSize: 12,
                color: 'var(--muted)',
                lineHeight: 2,
                margin: '0 0 20px',
              }}
            >
              حذف حساب یک عملیات برگشت‌ناپذیر است. تمام داده‌های workspace، سفارش‌ها، فاکتورها و
              تاریخچه‌ها به‌طور دائم پاک می‌شوند.
            </p>
            <button className="button danger" type="button">
              <Trash2 size={15} />
              حذف حساب کاربری
            </button>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
