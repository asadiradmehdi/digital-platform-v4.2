import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Minus, Sparkles, Zap, Building2, ArrowLeft, HelpCircle } from 'lucide-react';
import { PublicPage } from '../../components/seo/PublicPage';
import { formatTomanNumber, toToman } from '../../lib/format';

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
    ctaHref: '/subscriptions/new',
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
    ctaHref: '/subscriptions/new',
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
    ctaHref: '/subscriptions/new',
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
      { label: 'تضمین کیفیت اختصاصی', available: true },
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

const faqs = [
  {
    q: 'آیا می‌توانم پلن خود را در هر زمان ارتقا دهم؟',
    a: 'بله. ارتقا فوری است و مابه‌التفاوت بر اساس روزهای باقیمانده محاسبه می‌شود.',
  },
  {
    q: 'قیمت سفارش‌های شبکه اجتماعی چگونه محاسبه می‌شود؟',
    a: 'قیمت هر بسته پیش از پرداخت به شما نشان داده می‌شود و همان مبلغ از کیف پول یا درگاه پرداخت می‌شود. هیچ هزینه‌ی پنهانی وجود ندارد.',
  },
  {
    q: 'آیا استرداد وجه امکان‌پذیر است؟',
    a: 'سفارش‌های ناموفق به‌طور خودکار مرجوع می‌شوند. برای اشتراک‌ها تا ۷ روز اول امکان لغو وجود دارد.',
  },
  {
    q: 'پشتیبانی اولویت‌دار یعنی چه؟',
    a: 'کاربران Pro و سازمانی در صف پشتیبانی اولویت‌دار قرار می‌گیرند و درخواست‌هایشان زودتر بررسی می‌شود.',
  },
];

/** The plan prices above mirror plans.price_minor, which is IRT (toman) — the unit renewals charge. */
function formatPrice(minor: number) {
  return formatTomanNumber(toToman(minor, 'IRT'));
}

export default function Pricing() {
  return (
    <PublicPage
      eyebrow="قیمت‌گذاری"
      title="شفاف، خودکار و قابل پیش‌بینی"
      description="قیمت پایه، نرخ تبدیل و مصرف از یک منبع داده مشترک تغذیه می‌شوند. قیمت تمدید در زمان ثبت snapshot می‌شود و ثابت می‌ماند."
    >
      {/* Pricing grid */}
      <div className="pricing-grid">
        {plans.map(plan => (
          <article key={plan.id} className={`pricing-card${plan.highlight ? ' pricing-card-highlight' : ''}`}>
            {plan.badge && (
              <div className="pricing-badge">
                <Sparkles size={10} />{plan.badge}
              </div>
            )}

            <div className="pricing-card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {plan.id === 'enterprise' && (
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                    <Building2 size={14} />
                  </span>
                )}
                {plan.highlight && (
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>
                    <Zap size={14} />
                  </span>
                )}
                <h2 style={{ margin: 0, fontSize: 18, letterSpacing: '-.03em' }}>{plan.name}</h2>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{plan.description}</p>
            </div>

            <div className="pricing-price">
              {plan.price === null ? (
                <span className="pricing-price-value" style={{ fontSize: 22 }}>توافقی</span>
              ) : plan.price === 0 ? (
                <span className="pricing-price-value" style={{ color: 'var(--success)' }}>رایگان</span>
              ) : (
                <>
                  <span className="pricing-price-value">{formatPrice(plan.price)}</span>
                  <span className="pricing-price-unit" style={{ alignSelf: 'flex-end', paddingBottom: 4 }}>تومان / ماه</span>
                </>
              )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: 0 }} />

            <ul className="pricing-features" style={{ flex: 1 }}>
              {plan.features.map(f => (
                <li key={f.label} className={f.available ? '' : 'unavailable'}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 6, display: 'grid', placeItems: 'center', flexShrink: 0,
                    background: f.available ? 'var(--success-soft)' : 'var(--surface-2)',
                    color: f.available ? 'var(--success)' : 'var(--subtle)',
                  }}>
                    {f.available ? <Check size={11} strokeWidth={2.5} /> : <Minus size={11} />}
                  </span>
                  {f.label}
                </li>
              ))}
            </ul>

            <Link
              href={plan.ctaHref}
              className={plan.highlight ? 'pricing-cta-primary' : 'pricing-cta-secondary'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}
            >
              {plan.highlight && <Zap size={13} />}
              {plan.cta}
              {!plan.highlight && <ArrowLeft size={12} />}
            </Link>
          </article>
        ))}
      </div>

      {/* Service pricing note */}
      <div className="pricing-note" style={{ marginBottom: 48, display: 'grid', gap: 12 }}>
        <p className="panel-kicker" style={{ margin: 0 }}>خدمات دیجیتال</p>
        <h2 style={{ margin: 0, fontSize: 18, letterSpacing: '-.03em' }}>قیمت فالوور، لایک، ویو و ممبر</h2>
        <p style={{ margin: 0, lineHeight: 2, fontSize: 13, color: 'var(--muted)', maxWidth: '60ch' }}>
          قیمت هر بسته در صفحه‌ی همان خدمت دیده می‌شود و پیش از پرداخت، مبلغ دقیق را می‌بینید. پرداخت از کیف پول یا درگاه بانکی انجام می‌شود.
        </p>
        <Link href="/services" className="button primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, justifySelf: 'start' }}>
          مشاهده‌ی خدمات و قیمت‌ها
          <ArrowLeft size={13} />
        </Link>
      </div>

      {/* FAQ section */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <HelpCircle size={16} style={{ color: 'var(--accent)' }} />
          <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-.03em' }}>سوالات متداول</h2>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: '18px 22px', background: 'var(--surface)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 13, letterSpacing: '-.02em', color: 'var(--ink)' }}>{faq.q}</h3>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.9 }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicPage>
  );
}
