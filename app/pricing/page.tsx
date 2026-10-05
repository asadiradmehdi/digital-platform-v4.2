import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Minus, Sparkles, Zap } from 'lucide-react';
import { PublicPage } from '../../components/seo/PublicPage';

export const metadata: Metadata = {
  title: 'قیمت‌گذاری',
  description: 'پلن‌های اشتراک، قیمت خدمات دیجیتال و مدل مصرف پلتفرم.',
  alternates: { canonical: '/pricing' },
};

const plans = [
  {
    id: 'free',
    name: 'رایگان',
    price: 0,
    period: 'ماهانه',
    badge: null,
    description: 'شروع بدون تعهد',
    features: [
      { label: 'هوش مصنوعی پایه', available: true },
      { label: 'تا ۵ سفارش در ماه', available: true },
      { label: 'گزارش پایه', available: true },
      { label: 'API دسترسی', available: false },
      { label: 'اتوماسیون پیشرفته', available: false },
      { label: 'تأمین‌کننده اختصاصی', available: false },
      { label: 'پشتیبانی اولویت‌دار', available: false },
    ],
    cta: 'شروع رایگان',
    ctaHref: '/auth',
    highlight: false,
  },
  {
    id: 'basic',
    name: 'پایه',
    price: 9_900_000,
    period: 'ماهانه',
    badge: null,
    description: 'برای کسب‌وکارهای در حال رشد',
    features: [
      { label: 'هوش مصنوعی پایه', available: true },
      { label: 'تا ۵۰ سفارش در ماه', available: true },
      { label: 'گزارش کامل', available: true },
      { label: 'API دسترسی', available: true },
      { label: 'اتوماسیون پیشرفته', available: false },
      { label: 'تأمین‌کننده اختصاصی', available: false },
      { label: 'پشتیبانی اولویت‌دار', available: false },
    ],
    cta: 'شروع با پایه',
    ctaHref: '/auth',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 18_900_000,
    period: 'ماهانه',
    badge: 'پرفروش',
    description: 'برای تیم‌های حرفه‌ای',
    features: [
      { label: 'هوش مصنوعی پیشرفته (GPT-4o · Claude)', available: true },
      { label: 'سفارش نامحدود', available: true },
      { label: 'گزارش و تحلیل کامل', available: true },
      { label: 'API کامل + Webhooks', available: true },
      { label: 'اتوماسیون پیشرفته', available: true },
      { label: 'تأمین‌کننده اختصاصی', available: false },
      { label: 'پشتیبانی اولویت‌دار', available: true },
    ],
    cta: 'شروع با Pro',
    ctaHref: '/auth',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'سازمانی',
    price: null,
    period: 'توافقی',
    badge: null,
    description: 'برای سازمان‌های بزرگ',
    features: [
      { label: 'همه چیز در Pro', available: true },
      { label: 'تأمین‌کننده اختصاصی', available: true },
      { label: 'SLA اختصاصی', available: true },
      { label: 'مدیریت چند workspace', available: true },
      { label: 'گزارش سازمانی', available: true },
      { label: 'SSO و SAML', available: true },
      { label: 'پشتیبانی ۲۴/۷', available: true },
    ],
    cta: 'تماس با ما',
    ctaHref: '/contact',
    highlight: false,
  },
];

function formatPrice(minor: number) {
  return new Intl.NumberFormat('fa-IR').format(Math.round(minor / 10));
}

export default function Pricing() {
  return (
    <PublicPage
      eyebrow="قیمت‌گذاری"
      title="شفاف، خودکار و قابل پیش‌بینی"
      description="قیمت پایه، نرخ تبدیل و مصرف از یک منبع داده مشترک تغذیه می‌شوند. قیمت تمدید در زمان ثبت snapshot می‌شود و ثابت می‌ماند."
    >
      {/* Pricing cards */}
      <div className="pricing-grid">
        {plans.map(plan => (
          <article key={plan.id} className={`pricing-card${plan.highlight ? ' pricing-card-highlight' : ''}`}>
            {plan.badge && (
              <div className="pricing-badge">
                <Sparkles size={10} />{plan.badge}
              </div>
            )}
            <div className="pricing-card-head">
              <h2>{plan.name}</h2>
              <p>{plan.description}</p>
            </div>
            <div className="pricing-price">
              {plan.price === null ? (
                <span className="pricing-price-value">تماس</span>
              ) : plan.price === 0 ? (
                <span className="pricing-price-value">رایگان</span>
              ) : (
                <>
                  <span className="pricing-price-value">{formatPrice(plan.price)}</span>
                  <span className="pricing-price-unit">تومان / ماه</span>
                </>
              )}
            </div>
            <ul className="pricing-features">
              {plan.features.map(f => (
                <li key={f.label} className={f.available ? '' : 'unavailable'}>
                  {f.available
                    ? <Check size={13} />
                    : <Minus size={13} />}
                  {f.label}
                </li>
              ))}
            </ul>
            <Link
              href={plan.ctaHref}
              className={plan.highlight ? 'pricing-cta-primary' : 'pricing-cta-secondary'}
            >
              {plan.highlight && <Zap size={13} />}
              {plan.cta}
            </Link>
          </article>
        ))}
      </div>

      {/* Service pricing note */}
      <div className="pricing-note">
        <h2>قیمت خدمات دیجیتال</h2>
        <p>
          قیمت سفارش‌های شبکه‌های اجتماعی (فالوور، لایک، ویو) از کاتالوگ خدمات به‌صورت لحظه‌ای محاسبه می‌شود و با مصرف کیف پول پرداخت می‌شود.
          هیچ محاسبه مالی در سمت کلاینت انجام نمی‌شود — تمام قیمت‌ها از Pricing Engine سمت سرور تأمین می‌شوند.
        </p>
        <Link href="/services" className="pricing-link">مشاهده کاتالوگ خدمات ←</Link>
      </div>
    </PublicPage>
  );
}
