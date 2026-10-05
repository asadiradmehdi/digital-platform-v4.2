import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PublicPage } from '../../../components/seo/PublicPage';
import { BreadcrumbJsonLd } from '../../../components/seo/BreadcrumbJsonLd';

const channels = ['instagram', 'telegram', 'tiktok', 'youtube', 'x'] as const;
type Channel = (typeof channels)[number];

const channelMeta: Record<Channel, {
  titleFa: string;
  description: string;
  services: Array<{ name: string; note: string }>;
  capabilities: string[];
}> = {
  instagram: {
    titleFa: 'اینستاگرام',
    description: 'خدمات رشد اینستاگرام با مسیردهی هوشمند تأمین‌کننده، کنترل کیفیت و پیگیری لحظه‌ای.',
    services: [
      { name: 'فالوور واقعی', note: 'تحویل تدریجی · تضمین ماندگاری' },
      { name: 'لایک پست', note: 'سرعت بالا · هر نوع پست' },
      { name: 'ویو Reel', note: 'شامل ویدیوهای معمولی' },
      { name: 'کامنت سفارشی', note: 'فارسی و انگلیسی' },
    ],
    capabilities: [
      'مسیردهی خودکار به بهترین تأمین‌کننده',
      'پیگیری وضعیت لحظه‌ای',
      'ضمانت جبران در صورت ریزش',
      'پشتیبانی از پروفایل عمومی',
    ],
  },
  telegram: {
    titleFa: 'تلگرام',
    description: 'خدمات رشد کانال و گروه تلگرام با ممبرهای واقعی و پیگیری دقیق.',
    services: [
      { name: 'ممبر کانال', note: 'واقعی · تضمین ماندگاری' },
      { name: 'ممبر گروه', note: 'سرعت قابل تنظیم' },
      { name: 'ویو پست', note: 'تاریخی و جدید' },
    ],
    capabilities: [
      'پشتیبانی از کانال و گروه',
      'ارسال تدریجی یا سریع',
      'پیگیری لحظه‌ای وضعیت',
    ],
  },
  tiktok: {
    titleFa: 'تیک‌تاک',
    description: 'خدمات رشد تیک‌تاک با تأمین‌کننده‌های جهانی و پشتیبانی از اکانت‌های بین‌المللی.',
    services: [
      { name: 'فالوور', note: 'پروفایل عمومی' },
      { name: 'لایک ویدیو', note: 'تحویل سریع' },
      { name: 'ویو ویدیو', note: 'واقعی و طبیعی' },
    ],
    capabilities: [
      'پشتیبانی از اکانت‌های جهانی',
      'تحویل سریع',
      'پیگیری وضعیت سفارش',
    ],
  },
  youtube: {
    titleFa: 'یوتیوب',
    description: 'رشد کانال یوتیوب با رعایت کامل سیاست‌های پلتفرم و استانداردهای monetization.',
    services: [
      { name: 'ساب‌سکرایبر', note: 'سازگار با سیاست یوتیوب' },
      { name: 'ویو ویدیو', note: 'بدون ریسک monetization' },
      { name: 'لایک', note: 'طبیعی و واقعی' },
    ],
    capabilities: [
      'سازگار با قوانین یوتیوب',
      'بدون ریسک دیسیبل کانال',
      'مناسب برای کانال‌های در حال رشد',
    ],
  },
  x: {
    titleFa: 'X (توییتر)',
    description: 'خدمات رشد X با پشتیبانی از اکانت‌های فارسی و انگلیسی.',
    services: [
      { name: 'فالوور', note: 'در حال بررسی' },
      { name: 'لایک', note: 'در حال بررسی' },
    ],
    capabilities: [
      'پشتیبانی محدود — در مرحله بررسی',
      'API محدودیت‌های پلتفرم اعمال می‌شوند',
    ],
  },
};

export function generateStaticParams() {
  return channels.map((channel) => ({ channel }));
}

export async function generateMetadata({ params }: { params: Promise<{ channel: string }> }): Promise<Metadata> {
  const { channel } = await params;
  if (!channels.includes(channel as Channel)) return {};
  const meta = channelMeta[channel as Channel];
  return {
    title: `خدمات ${meta.titleFa}`,
    description: meta.description,
    alternates: { canonical: `/social/${channel}` },
  };
}

export default async function ChannelPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  if (!channels.includes(channel as Channel)) notFound();

  const meta = channelMeta[channel as Channel];

  return (
    <PublicPage
      eyebrow={`شبکه‌های اجتماعی · ${meta.titleFa}`}
      title={`خدمات ${meta.titleFa}`}
      description={meta.description}
    >
      <BreadcrumbJsonLd items={[
        { name: 'خانه', path: '/' },
        { name: 'شبکه‌های اجتماعی', path: '/social' },
        { name: meta.titleFa, path: `/social/${channel}` },
      ]} />

      <div className="public-card-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 40 }}>
        {meta.services.map(s => (
          <article className="public-info-card" key={s.name}>
            <h2>{s.name}</h2>
            <p>{s.note}</p>
          </article>
        ))}
      </div>

      <article className="public-info-card" style={{ marginBottom: 32 }}>
        <h2>قابلیت‌ها</h2>
        <ul>{meta.capabilities.map(c => <li key={c}>{c}</li>)}</ul>
        <h2>محدودیت‌ها</h2>
        <p>خدمات بر اساس سیاست‌ها و قوانین پلتفرم ارائه می‌شوند. استفاده برای اهداف اسپم یا نقض قوانین پلتفرم ممنوع است.</p>
      </article>

      <div style={{ textAlign: 'center' }}>
        <Link href="/services" className="marketing-cta" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          سفارش {meta.titleFa} <ArrowLeft size={16} />
        </Link>
      </div>
    </PublicPage>
  );
}
