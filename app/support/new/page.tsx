import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';

export const metadata: Metadata = { title: 'تیکت جدید', robots: { index: false, follow: false } };

export default function NewSupportTicket() {
  return <AppShell><main className="workspace-page-content">
    <header className="page-header"><div><span className="eyebrow">SUPPORT / NEW TICKET</span><h1>تیکت جدید</h1><p>شرح مسئله، سفارش مرتبط و سطح اهمیت را ثبت کنید.</p></div><Link className="button secondary" href="/support"><ArrowRight size={15}/>بازگشت</Link></header>
    <article className="surface-panel" style={{ padding: 24 }}>
      <div className="setting-mini"><ShieldCheck size={18}/><p>برای درخواست‌های امنیتی، اطلاعات محرمانه یا کلیدهای API را داخل متن تیکت قرار ندهید.</p></div>
      <form className="support-form" action="#" method="post">
        <label>موضوع<input name="subject" required maxLength={160}/></label>
        <label>شرح درخواست<textarea name="message" required maxLength={5000} rows={8}/></label>
        <div className="hero-actions"><button className="button primary" type="submit">ثبت تیکت</button><Link className="button secondary" href="/support">انصراف</Link></div>
      </form>
    </article>
  </main></AppShell>;
}
