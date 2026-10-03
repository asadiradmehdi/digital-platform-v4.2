import Link from 'next/link';
import { ArrowLeft, Bot, Layers3, ShieldCheck, Sparkles, Workflow, Zap } from 'lucide-react';
import { MarketingJsonLd } from '../components/seo/MarketingJsonLd';
import { siteConfig } from '../lib/seo/site';

export const metadata = { title: siteConfig.name, description: siteConfig.description, alternates: { canonical: '/' }, openGraph: { title: siteConfig.name, description: siteConfig.description, type: 'website', locale: siteConfig.locale }, twitter: { card: 'summary_large_image', title: siteConfig.name, description: siteConfig.description } };

const pillars = [
  { icon: Sparkles, title: 'هوش مصنوعی', text: 'مدل‌ها، ابزارها، پروژه‌ها، RAG و Agentها در یک محیط یکپارچه و کنترل‌شده.', href: '/ai' },
  { icon: Layers3, title: 'خدمات شبکه‌های اجتماعی', text: 'خدمات اینستاگرام، تلگرام و سایر شبکه‌ها با سفارش، پیگیری و کنترل کیفیت.', href: '/services' },
  { icon: Workflow, title: 'اتوماسیون', text: 'فرآیندهای زمان‌بندی‌شده، وب‌هوک و Agentهای عملیاتی برای کارهای تکرارشونده.', href: '/automation' },
  { icon: Bot, title: 'اشتراک و اعتبار', text: 'اشتراک‌های AI، کیف پول، اعتبار و پرداخت در یک لایه مالی یکپارچه.', href: '/pricing' },
];

export default function MarketingHome() {
  return <main className="marketing-shell">
    <MarketingJsonLd/>
    <header className="marketing-header">
      <Link href="/" className="brand" aria-label={siteConfig.name}><span className="logo" aria-hidden="true">✦</span><span><b>پلتفرم</b><small>خدمات دیجیتال نسل جدید</small></span></Link>
      <nav aria-label="ناوبری اصلی"><Link href="/services">خدمات</Link><Link href="/ai">هوش مصنوعی</Link><Link href="/automation">اتوماسیون</Link><Link href="/pricing">قیمت‌گذاری</Link><Link href="/blog">مجله</Link></nav>
      <div className="marketing-actions"><Link href="/auth">ورود</Link><Link className="marketing-cta" href="/auth">شروع کنید <ArrowLeft size={16}/></Link></div>
    </header>

    <section className="marketing-hero">
      <div className="hero-copy">
        <span className="eyebrow">یک زیرساخت فارسی برای خدمات دیجیتال</span>
        <h1>هوش مصنوعی، خدمات دیجیتال و اتوماسیون؛ در یک محیط حرفه‌ای.</h1>
        <p>{siteConfig.description} همه‌چیز از انتخاب سرویس و اشتراک تا سفارش، پرداخت، مصرف AI و اتوماسیون، در یک تجربه یکپارچه و ساده.</p>
        <div className="hero-actions"><Link className="marketing-cta large" href="/auth">شروع کنید <ArrowLeft size={18}/></Link><Link className="marketing-secondary" href="/services">مشاهده خدمات</Link></div>
        <div className="hero-trust"><span><ShieldCheck size={15}/> امنیت از ابتدا</span><span><Zap size={15}/> قیمت‌گذاری شفاف</span><span><Bot size={15}/> آماده رشد</span></div>
      </div>
      <div className="hero-panel" aria-label="نمای کلی پلتفرم">
        <div className="hero-panel-top"><span>نمای زنده فضای کاری</span><span>امن · یکپارچه · فارسی</span></div>
        <div className="hero-metric"><b>همه‌چیز، یک‌جا و تحت کنترل.</b><span>سفارش‌ها، اشتراک‌ها، اعتبار، هوش مصنوعی و اتوماسیون را در یک تجربه سریع و حرفه‌ای مدیریت کنید.</span></div>
        <div className="hero-dashboard">
          <div className="mini-chart"><span className="mini-label">مصرف اعتبار این ماه</span><span className="mini-number">۶۸٪</span><div className="mini-bars"><i style={{width:'82%'}}/><i style={{width:'64%'}}/><i style={{width:'48%'}}/></div></div>
          <div className="mini-card"><div className="mini-card-row"><span>وضعیت سرویس</span><span className="mini-dot"/></div><div className="mini-card-row"><span>سفارش فعال</span><strong>۳</strong></div><div className="mini-card-row"><span>اشتراک</span><strong>حرفه‌ای</strong></div><div className="mini-card-row"><span>کیف پول</span><strong>۱۲٫۵M</strong></div></div>
        </div>
        <div className="hero-pills"><span>درگاه هوش مصنوعی</span><span>خدمات اجتماعی</span><span>اتوماسیون</span><span>کیف پول و اشتراک</span></div>
      </div>
    </section>

    <section className="marketing-grid" aria-label="قابلیت‌های اصلی">{pillars.map(({icon:Icon,title,text,href})=><Link className="marketing-card" href={href} key={title}><span className="marketing-icon"><Icon size={19}/></span><h2>{title}</h2><p>{text}</p><span className="card-link">مشاهده <ArrowLeft size={14}/></span></Link>)}</section>
  </main>;
}
