import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Hash, Heart, Instagram, Music2, Play, Users, Youtube } from 'lucide-react';
import { PublicPage } from '../../components/seo/PublicPage';

export const metadata: Metadata = {
  title: 'خدمات شبکه‌های اجتماعی',
  description: 'خدمات رشد، فالوور، لایک، ویو و کامنت برای اینستاگرام، تلگرام، تیک‌تاک و یوتیوب.',
  alternates: { canonical: '/social' },
};

const channels = [
  {
    key: 'instagram',
    name: 'اینستاگرام',
    icon: Instagram,
    services: ['فالوور واقعی', 'لایک پست', 'ویو Reel', 'کامنت سفارشی'],
    href: '/services',
  },
  {
    key: 'telegram',
    name: 'تلگرام',
    icon: Hash,
    services: ['ممبر کانال', 'ویو پست', 'واکنش'],
    href: '/services',
  },
  {
    key: 'tiktok',
    name: 'تیک‌تاک',
    icon: Music2,
    services: ['فالوور', 'لایک ویدیو', 'ویو ویدیو'],
    href: '/services',
  },
  {
    key: 'youtube',
    name: 'یوتیوب',
    icon: Youtube,
    services: ['ساب‌سکرایبر', 'ویو ویدیو', 'لایک'],
    href: '/services',
  },
];

const serviceHighlights = [
  { icon: Users, label: 'فالوور واقعی', note: 'ماندگاری تضمین‌شده' },
  { icon: Heart, label: 'لایک و تعامل', note: 'تحویل سریع' },
  { icon: Play, label: 'ویو و بازدید', note: 'مسیردهی هوشمند' },
];

export default function Social() {
  return (
    <PublicPage
      eyebrow="خدمات شبکه‌های اجتماعی"
      title="همه کانال‌ها، یک تجربه یکپارچه"
      description="برای هر شبکه اجتماعی یک لایه مستقل از مسیردهی تأمین‌کننده، کنترل کیفیت و پیگیری وضعیت سفارش داریم."
    >
      {/* Feature highlights */}
      <div className="public-card-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 40 }}>
        {serviceHighlights.map(({ icon: Icon, label, note }) => (
          <article className="public-info-card" key={label}>
            <span className="marketing-icon"><Icon size={18} /></span>
            <h2>{label}</h2>
            <p>{note}</p>
          </article>
        ))}
      </div>

      {/* Channels */}
      <h2 style={{ fontSize: 20, marginBottom: 16, color: 'var(--ink)' }}>کانال‌های پشتیبانی‌شده</h2>
      <div className="public-list" style={{ marginBottom: 40 }}>
        {channels.map(ch => {
          const Icon = ch.icon;
          return (
            <article key={ch.key} className="public-info-card" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span className="marketing-icon" style={{ flexShrink: 0 }}><Icon size={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: '0 0 6px' }}>{ch.name}</h2>
                <p style={{ margin: 0 }}>{ch.services.join(' · ')}</p>
              </div>
              <Link href={ch.href} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-strong)', fontSize: 12, textDecoration: 'none', flexShrink: 0 }}>
                سفارش <ArrowLeft size={13} />
              </Link>
            </article>
          );
        })}
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '32px', border: '1px solid rgba(255,255,255,.07)', borderRadius: 22, background: 'rgba(155,124,255,.04)' }}>
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>آماده شروع هستید؟</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 20, maxWidth: 480, margin: '0 auto 20px' }}>
          کاتالوگ کامل خدمات با قیمت شفاف، تحویل لحظه‌ای و پیگیری آنلاین.
        </p>
        <Link href="/services" className="marketing-cta" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          مشاهده همه خدمات <ArrowLeft size={16} />
        </Link>
      </div>
    </PublicPage>
  );
}
