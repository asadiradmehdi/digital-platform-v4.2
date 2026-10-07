import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Bot, Lock, ShieldCheck, Zap } from 'lucide-react';
import { PublicPage } from '../../components/seo/PublicPage';

export const metadata: Metadata = {
  title: 'درباره ما',
  description: 'معرفی ZOHALPAY — معماری محصول، اصول امنیت و ارزش‌های تیم.',
  alternates: { canonical: '/about' },
};

const principles = [
  {
    icon: Zap,
    title: 'سرعت قابل اندازه‌گیری',
    body: 'هر ماژول باید در شرایط بار واقعی پاسخ‌دهی قابل قبول داشته باشد. مصرف منابع، SLA سفارش و تأخیر API با ابزار‌های observability داخلی رصد می‌شوند.',
  },
  {
    icon: Lock,
    title: 'امنیت پیش‌فرض',
    body: 'معماری از ابتدا برای tenant isolation، RLS، MFA، session rotation، HMAC webhook و rate-limit بر پایه OWASP ASVS 5.0 طراحی شده — نه به‌عنوان پچ نهایی.',
  },
  {
    icon: Bot,
    title: 'AI بدون هزینه پنهان',
    body: 'هر درخواست AI مدل، token مصرفی، هزینه و وضعیت اعتبار را ثبت می‌کند. سیستم AI Router کم‌هزینه‌ترین مدل کافی برای task را انتخاب می‌کند.',
  },
  {
    icon: ShieldCheck,
    title: 'شفافیت در عملیات',
    body: 'تراکنش‌های مالی idempotent هستند، هر تغییر حساسیت‌دار در audit log ثبت می‌شود، و refund workflow با guard از بازپرداخت مازاد جلوگیری می‌کند.',
  },
];

const stack: [string, string][] = [
  ['زبان و فریمورک', 'TypeScript · Next.js · React'],
  ['پایگاه داده', 'PostgreSQL با RLS row-level isolation'],
  ['صف و زمان‌بندی', 'Job queue با SKIP LOCKED · scheduled triggers'],
  ['هوش مصنوعی', 'Anthropic Claude · OpenAI — با AI Router و usage tracking'],
  ['اتوماسیون', 'Workflow engine با branching، delay، Webhook و agent run'],
  ['رابط‌های اجتماعی', 'Instagram · Telegram · TikTok · YouTube · Twitter/X'],
  ['API B2B', 'REST API نسخه‌دار با API Key، scope، sandbox و rate-limit'],
  ['طراحی', 'RTL-first فارسی · design tokens · responsive/mobile'],
];

export default function About() {
  return (
    <PublicPage
      eyebrow="ABOUT"
      title="ZOHALPAY چیست؟"
      description="یک پلتفرم یکپارچه برای خدمات دیجیتال، AI، اتوماسیون و عملیات کسب‌وکار — با معماری مدولار، امنیت پیش‌فرض و رابط فارسی‌محور."
    >
      <div className="public-info-card" style={{ marginBottom: 24 }}>
        <h2>چرا این پلتفرم ساخته شد؟</h2>
        <p>
          کسب‌وکارهای دیجیتال فارسی‌زبان به ابزاری نیاز داشتند که همزمان خدمات شبکه‌های اجتماعی، AI تولید محتوا،
          اتوماسیون فرآیند و مدیریت مالی را در یک محیط یکپارچه ارائه دهد — بدون نیاز به چند ابزار موازی
          و بدون محدودیت زبان و رابط کاربری.
        </p>
        <p style={{ marginBottom: 0 }}>
          هدف این است که هر تیم — از سولوپرنر تا آژانس سازمانی — بتواند عملیات دیجیتال خود را
          از یک داشبورد فارسی‌محور و امن مدیریت کند.
        </p>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          اصول محصول
        </h2>
        <div className="public-card-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {principles.map(({ icon: Icon, title, body }) => (
            <article className="public-info-card" key={title}>
              <span className="marketing-icon"><Icon size={18} /></span>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: '10px 0 6px' }}>{title}</h3>
              <p style={{ margin: 0 }}>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          معماری و فناوری
        </h2>
        <div className="public-info-card">
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 24px', margin: 0 }}>
            {stack.map(([label, value]) => (
              <><dt key={`dt-${label}`} style={{ fontWeight: 600, fontSize: 13, color: 'var(--subtle)', whiteSpace: 'nowrap' }}>{label}</dt>
              <dd key={`dd-${label}`} style={{ margin: 0, fontSize: 13 }}>{value}</dd></>
            ))}
          </dl>
        </div>
      </section>

      <div className="public-info-card">
        <h2>بیشتر بدانید</h2>
        <p style={{ marginBottom: 16 }}>
          برای دیدن ویژگی‌های دقیق هر ماژول، صفحه خدمات را ببینید. برای همکاری یا سؤال‌های سازمانی، با تیم ما در تماس باشید.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/services" className="card-link">خدمات <ArrowLeft size={13} /></Link>
          <Link href="/pricing" className="card-link">پلن‌ها <ArrowLeft size={13} /></Link>
          <Link href="/contact" className="card-link">تماس با ما <ArrowLeft size={13} /></Link>
        </div>
      </div>
    </PublicPage>
  );
}
