import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Camera, Trash2 } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { query } from '../../../server/core/db';
import ProfileForm from './ProfileForm';

export const metadata: Metadata = { title: 'حساب و پروفایل', robots: { index: false, follow: false } };

export default async function ProfileSettings() {
  let userId: string;
  try {
    userId = await requireCurrentUser();
  } catch {
    redirect('/auth');
  }

  const r = await query<{ display_name: string; email: string | null; phone: string | null }>(
    `SELECT COALESCE(display_name, split_part(COALESCE(email,''), '@', 1)) AS display_name,
            email, phone
     FROM users WHERE id=$1`,
    [userId],
  );
  const user = r.rows[0];
  const initials = user?.display_name?.slice(0, 1) ?? '؟';

  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div><span className="eyebrow">SETTINGS / PROFILE</span><h1>حساب و پروفایل</h1><p>هویت، نام نمایشی، ایمیل و اطلاعات پایه حساب.</p></div>
          <Link className="button secondary" href="/settings"><ArrowRight size={15}/>تنظیمات</Link>
        </header>
        <SystemStrip/>
        <div className="settings-layout">
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">IDENTITY</span><h2>اطلاعات شخصی</h2></div></div>
            <div className="profile-avatar-row">
              <div className="profile-avatar"><span>{initials}</span><button className="avatar-edit" aria-label="تغییر تصویر"><Camera size={14}/></button></div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{user?.display_name ?? '—'}</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }} dir="ltr">{user?.email ?? '—'}</p>
              </div>
            </div>
            <label>ایمیل<input name="email" type="email" defaultValue={user?.email ?? ''} autoComplete="email" dir="ltr" readOnly style={{ opacity: 0.6 }}/></label>
            <ProfileForm initialDisplayName={user?.display_name ?? ''} initialPhone={user?.phone ?? ''} />
          </article>
          <article className="surface-panel" style={{ padding: 24 }}>
            <div className="panel-head"><div><span className="panel-kicker">DANGER ZONE</span><h2>حذف حساب</h2></div></div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 2, margin: '0 0 16px' }}>حذف حساب یک عملیات برگشت‌ناپذیر است. تمام داده‌های workspace، سفارش‌ها، فاکتورها و تاریخچه‌ها به‌طور دائم پاک می‌شوند.</p>
            <button className="button danger" type="button"><Trash2 size={15}/>حذف حساب کاربری</button>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
