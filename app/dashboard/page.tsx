import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, ArrowLeft, Bot, CheckCircle2, ChevronLeft, Clock3, Plus, Sparkles, WalletCards, Zap } from 'lucide-react';
import { SystemStrip } from '../../components/ProductSurface';
import { AppShell } from '../../components/AppShell';

export const metadata: Metadata = { title: 'خانه', robots: { index: false, follow: false } };

const stats = [
  ['موجودی کیف پول','۱۲٬۵۰۰٬۰۰۰ تومان','+۸٪ این ماه',WalletCards],
  ['مصرف AI','۶۸٪','از اعتبار دوره',Bot],
  ['سفارش‌های فعال','۳','۲ مورد در حال پردازش',Activity],
  ['اشتراک فعال','Pro','تا ۲۸ مهر',Sparkles],
] as const;

export default function Dashboard() {
  return <AppShell><main className="workspace-page-content">
    <section className="dash-hero">
      <div><span className="eyebrow">امروز · فضای کاری اصلی</span><h1>صبح بخیر، اسد.</h1><p>همه‌چیز برای ادامه کار آماده است. امروز چه چیزی را جلو ببریم؟</p></div>
      <div className="hero-actions"><Link className="button secondary" href="/ai"><Sparkles size={17}/>شروع با AI</Link><Link className="button primary" href="/services"><Plus size={17}/>سفارش جدید</Link></div>
    </section>
    <SystemStrip/><section className="stat-grid-premium">{stats.map(([label,value,meta,Icon])=><article className="premium-stat" key={label}><div className="stat-top"><span>{label}</span><Icon size={17}/></div><strong>{value}</strong><small>{meta}</small></article>)}</section>
    <section className="dashboard-main-grid">
      <article className="surface-panel activity-panel"><div className="panel-head"><div><span className="panel-kicker">فعالیت‌ها</span><h2>آخرین فعالیت‌ها</h2></div><Link href="/dashboard?view=activity">همه <ChevronLeft size={15}/></Link></div><div className="activity-stream"><div className="activity-item"><span className="activity-dot success"><CheckCircle2 size={15}/></span><div><b>AI Writer Pro</b><p>درخواست با موفقیت تکمیل شد</p></div><time>۲ دقیقه پیش</time></div><div className="activity-item"><span className="activity-dot accent"><Zap size={15}/></span><div><b>#DP-10482</b><p>سفارش در حال پردازش است</p></div><time>۱۸ دقیقه پیش</time></div><div className="activity-item"><span className="activity-dot"><Clock3 size={15}/></span><div><b>اشتراک Pro</b><p>مصرف دوره‌ای به‌روزرسانی شد</p></div><time>امروز</time></div></div></article>
      <article className="surface-panel command-panel"><div className="panel-head"><div><span className="panel-kicker">دسترسی سریع</span><h2>دسترسی سریع</h2></div></div><div className="quick-actions"><Link href="/ai"><Sparkles size={18}/><span><b>فضای هوش مصنوعی</b><small>ساخت و اجرای پروژه</small></span><ArrowLeft size={15}/></Link><Link href="/services"><Zap size={18}/><span><b>خدمات</b><small>انتخاب و سفارش</small></span><ArrowLeft size={15}/></Link><Link href="/automation"><Activity size={18}/><span><b>اتوماسیون</b><small>ساخت فرآیند خودکار</small></span><ArrowLeft size={15}/></Link></div></article>
    </section>
  </main></AppShell>;
}
