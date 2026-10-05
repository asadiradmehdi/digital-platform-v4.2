import Link from 'next/link';
import { ArrowRight, Camera, Trash2 } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { SystemStrip } from '../../../components/ProductSurface';
export const metadata = { title: 'حساب و پروفایل', robots: { index: false, follow: false } };
export default function ProfileSettings() {
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
              <div className="profile-avatar"><span>ا</span><button className="avatar-edit" aria-label="تغییر تصویر"><Camera size={14}/></button></div>
              <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>اسد رضایی</p><p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>asad@example.com</p></div>
            </div>
            <form className="settings-form">
              <div className="form-row">
                <label>نام<input name="name" defaultValue="اسد رضایی" autoComplete="name"/></label>
                <label>نام نمایشی<input name="displayName" defaultValue="اسد" autoComplete="nickname"/></label>
              </div>
              <label>ایمیل<input name="email" type="email" defaultValue="asad@example.com" autoComplete="email" dir="ltr"/></label>
              <label>شماره موبایل<input name="phone" type="tel" defaultValue="" placeholder="اختیاری" autoComplete="tel" dir="ltr"/></label>
              <label>بیوگرافی کوتاه<textarea name="bio" rows={3} maxLength={200} placeholder="توضیح کوتاه درباره خود (اختیاری)"/></label>
              <div className="form-actions">
                <button className="button primary" type="submit">ذخیره تغییرات</button>
              </div>
            </form>
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
