import Link from 'next/link';
import { ArrowLeft, Bot, CreditCard, Globe, Layers3, Lock, ShieldCheck, Sparkles, Workflow, Zap } from 'lucide-react';
import { MarketingJsonLd } from '../components/seo/MarketingJsonLd';
import { Wordmark } from '../components/zp/brand';
import { siteConfig } from '../lib/seo/site';

export const metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  alternates: { canonical: '/' },
  openGraph: { title: siteConfig.name, description: siteConfig.description, type: 'website', locale: siteConfig.locale },
  twitter: { card: 'summary_large_image', title: siteConfig.name, description: siteConfig.description },
};

export default function MarketingHome() {
  return (
    <main className="marketing-shell">
      <MarketingJsonLd />

      {/* ── Header ── */}
      <header className="marketing-header">
        <Link href="/" className="brand zp-root" aria-label="زُحل پی"><Wordmark id="mk-mark" /></Link>
        <nav aria-label="ناوبری اصلی">
          <Link href="/services">خدمات</Link>
          <Link href="/ai">هوش مصنوعی</Link>
          <Link href="/automation">اتوماسیون</Link>
          <Link href="/pricing">قیمت‌گذاری</Link>
        </nav>
        <div className="marketing-actions">
          <Link className="marketing-login" href="/auth">ورود</Link>
          <Link className="marketing-cta" href="/auth?mode=register">ثبت‌نام <ArrowLeft size={15} /></Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="marketing-hero landing-hero-v2">
        <div className="hero-copy">
          <span className="eyebrow">زیرساخت دیجیتال فارسی</span>
          <h1>خدمات دیجیتال، هوش مصنوعی و اتوماسیون — در یک محیط حرفه‌ای</h1>
          <p>
            از خرید خدمات اینستاگرام تا اجرای مدل‌های AI و ساخت فرآیند خودکار؛
            همه در یک پلتفرم یکپارچه با کیف پول، اشتراک و مدیریت کامل.
          </p>
          <div className="hero-actions" style={{ marginTop: 28 }}>
            <Link className="marketing-cta large" href="/auth?mode=register">
              شروع رایگان <ArrowLeft size={17} />
            </Link>
            <Link className="marketing-secondary" href="/services">مشاهده خدمات</Link>
          </div>
          <div className="hero-trust">
            <span><ShieldCheck size={14} /> رمزگذاری AES-256</span>
            <span><CreditCard size={14} /> کیف پول یکپارچه</span>
            <span><Globe size={14} /> فارسی‌سرا، RTL‌محور</span>
          </div>
        </div>
      </section>

      {/* ── Platform pillars ── */}
      <div className="marketing-section-head">
        <span className="eyebrow">سه دامنه، یک پلتفرم</span>
        <h2 className="marketing-section-title">هر چیزی که برای رشد دیجیتال نیاز دارید</h2>
      </div>

      <div className="landing-platform-grid">
        {/* Pillar 1 — Services */}
        <div className="landing-pillar">
          <div className="landing-pillar-head">
            <div className="landing-pillar-icon"><Layers3 size={20} /></div>
            <h2>خدمات شبکه‌های اجتماعی</h2>
          </div>
          <p>
            کاتالوگ کامل خدمات اینستاگرام، تلگرام، یوتیوب و سایر پلتفرم‌ها.
            سفارش، پیگیری و مدیریت همه‌چیز از یک پنل.
          </p>
          <ul className="landing-pillar-list">
            <li>فالوور، لایک، ویو، ممبر و ری‌اکشن</li>
            <li>قیمت‌گذاری پویا از موتور سرور‌ساید</li>
            <li>پیگیری بلادرنگ وضعیت سفارش</li>
            <li>تاریخچه کامل و فیلتر پیشرفته</li>
          </ul>
          <Link href="/services" className="pillar-link">مشاهده کاتالوگ <ArrowLeft size={13} /></Link>
        </div>

        {/* Pillar 2 — AI */}
        <div className="landing-pillar">
          <div className="landing-pillar-head">
            <div className="landing-pillar-icon"><Sparkles size={20} /></div>
            <h2>هوش مصنوعی</h2>
          </div>
          <p>
            دسترسی یکپارچه به مدل‌های برجسته با مدیریت اعتبار، اشتراک و محیط
            کاری حرفه‌ای برای پروژه‌های AI.
          </p>
          <ul className="landing-pillar-list">
            <li>مدل‌های Claude، GPT و Gemini</li>
            <li>پروژه RAG با Knowledge Base</li>
            <li>اجرای Agent‌ها با tool‌call audit</li>
            <li>مدیریت مصرف و بودجه‌بندی</li>
          </ul>
          <Link href="/ai" className="pillar-link">فضای هوش مصنوعی <ArrowLeft size={13} /></Link>
        </div>

        {/* Pillar 3 — Automation */}
        <div className="landing-pillar">
          <div className="landing-pillar-head">
            <div className="landing-pillar-icon"><Workflow size={20} /></div>
            <h2>اتوماسیون</h2>
          </div>
          <p>
            ساخت فرآیندهای خودکار با trigger زمان‌بندی‌شده، webhook و agent.
            اجرای قابل اعتماد با مانیتورینگ کامل.
          </p>
          <ul className="landing-pillar-list">
            <li>Trigger زمان‌بندی و Webhook ورودی</li>
            <li>گام‌های شرطی و branching</li>
            <li>تأخیر، تکرار و مدیریت خطا</li>
            <li>گزارش اجرا و لاگ کامل</li>
          </ul>
          <Link href="/automation" className="pillar-link">ساخت workflow <ArrowLeft size={13} /></Link>
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="marketing-section-head">
        <span className="eyebrow">چگونه شروع کنید</span>
        <h2 className="marketing-section-title">سه قدم تا اولین نتیجه</h2>
      </div>

      <div className="landing-how-grid">
        <div className="landing-how-step">
          <div className="landing-how-num">۱</div>
          <h3>حساب بسازید</h3>
          <p>ثبت‌نام رایگان، بدون نیاز به کارت اعتباری. فضای کاری شما فوری آماده است.</p>
        </div>
        <div className="landing-how-arrow" aria-hidden="true">←</div>
        <div className="landing-how-step">
          <div className="landing-how-num">۲</div>
          <h3>کیف پول شارژ کنید</h3>
          <p>اعتبار به کیف پول اضافه کنید. تمام پرداخت‌ها از همین کیف پول کسر می‌شود.</p>
        </div>
        <div className="landing-how-arrow" aria-hidden="true">←</div>
        <div className="landing-how-step">
          <div className="landing-how-num">۳</div>
          <h3>سفارش دهید</h3>
          <p>سرویس انتخاب کنید، پارامتر بدهید و تأیید کنید. اجرا و پیگیری خودکار است.</p>
        </div>
      </div>

      {/* ── Differentiators ── */}
      <div className="marketing-section-head">
        <span className="eyebrow">چرا این پلتفرم</span>
        <h2 className="marketing-section-title">ساخته‌شده برای مقیاس</h2>
      </div>

      <div className="landing-diff-grid">
        <div className="landing-diff-item">
          <div className="landing-diff-icon"><Lock size={18} /></div>
          <h3>امنیت از ابتدا</h3>
          <p>
            رمزگذاری AES-256-GCM برای اطلاعات حساس. RBAC چندسطحی.
            Session‌های چرخشی. احراز هویت چندعاملی و Passkey.
          </p>
        </div>
        <div className="landing-diff-item">
          <div className="landing-diff-icon"><Zap size={18} /></div>
          <h3>مالی یکپارچه</h3>
          <p>
            کیف پول با دفترچه دوطرفه. اشتراک‌های تجدیدشونده. فاکتور خودکار.
            هیچ محاسبه مالی سمت کلاینت انجام نمی‌شود.
          </p>
        </div>
        <div className="landing-diff-item">
          <div className="landing-diff-icon"><Bot size={18} /></div>
          <h3>فارسی‌سرا</h3>
          <p>
            RTL کامل، اعداد فارسی، تقویم شمسی. رابط کاربری بهینه‌شده برای
            بازار ایران، با پشتیبانی از عربی و ترکی.
          </p>
        </div>
      </div>

      {/* ── Final CTA ── */}
      <section className="marketing-cta-section">
        <div className="cta-section-content">
          <h2>آماده‌اید شروع کنید؟</h2>
          <p>از پلن رایگان شروع کنید. بدون نیاز به کارت اعتباری.</p>
          <div className="cta-section-actions">
            <Link className="marketing-cta large" href="/auth?mode=register">
              حساب رایگان بسازید <ArrowLeft size={17} />
            </Link>
            <Link className="marketing-secondary" href="/pricing">مشاهده پلن‌ها</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
