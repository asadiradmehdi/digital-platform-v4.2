'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bot, Camera, Film, Hash, Heart, Instagram, MessageCircle, Music2, Play, ShoppingBag, Sparkles, Star, TrendingUp, Users, Workflow, Youtube, Zap } from 'lucide-react';

type Category = 'همه' | 'اینستاگرام' | 'تلگرام' | 'تیک‌تاک' | 'یوتیوب' | 'هوش مصنوعی' | 'اتوماسیون';

const services = [
  {
    id: 'ig-followers',
    icon: Users,
    title: 'فالوور اینستاگرام',
    description: 'افزایش فالوور واقعی با مسیردهی هوشمند تأمین‌کننده، تضمین کیفیت و پیگیری لحظه‌ای.',
    platforms: ['اینستاگرام'],
    priceMinor: 1_200_000,
    unit: '۱۰۰۰ فالوور',
    category: 'اینستاگرام',
    badge: 'پرفروش',
  },
  {
    id: 'ig-likes',
    icon: Heart,
    title: 'لایک اینستاگرام',
    description: 'لایک ارگانیک با تحویل سریع، مناسب برای پست‌ها و Reelها.',
    platforms: ['اینستاگرام'],
    priceMinor: 350_000,
    unit: '۱۰۰۰ لایک',
    category: 'اینستاگرام',
  },
  {
    id: 'ig-views',
    icon: Play,
    title: 'ویو Reel اینستاگرام',
    description: 'افزایش بازدید Reel و ویدیو با تضمین سرعت تحویل و ماندگاری.',
    platforms: ['اینستاگرام'],
    priceMinor: 180_000,
    unit: '۱۰۰۰ ویو',
    category: 'اینستاگرام',
  },
  {
    id: 'ig-comments',
    icon: MessageCircle,
    title: 'کامنت اینستاگرام',
    description: 'کامنت‌های فارسی و انگلیسی سفارشی‌شده با تحویل طبیعی.',
    platforms: ['اینستاگرام'],
    priceMinor: 850_000,
    unit: '۱۰۰ کامنت',
    category: 'اینستاگرام',
  },
  {
    id: 'tg-members',
    icon: Hash,
    title: 'ممبر تلگرام',
    description: 'افزایش ممبر کانال و گروه تلگرام با ممبرهای واقعی و تضمین ماندگاری.',
    platforms: ['تلگرام'],
    priceMinor: 980_000,
    unit: '۱۰۰۰ ممبر',
    category: 'تلگرام',
  },
  {
    id: 'tg-views',
    icon: Film,
    title: 'ویو پست تلگرام',
    description: 'افزایش بازدید پست‌های کانال تلگرام به صورت تدریجی و طبیعی.',
    platforms: ['تلگرام'],
    priceMinor: 120_000,
    unit: '۱۰۰۰ ویو',
    category: 'تلگرام',
  },
  {
    id: 'tt-followers',
    icon: Music2,
    title: 'فالوور تیک‌تاک',
    description: 'رشد فالوور تیک‌تاک با مسیردهی بهینه تأمین‌کننده جهانی.',
    platforms: ['تیک‌تاک'],
    priceMinor: 1_450_000,
    unit: '۱۰۰۰ فالوور',
    category: 'تیک‌تاک',
    badge: 'جدید',
  },
  {
    id: 'yt-subscribers',
    icon: Youtube,
    title: 'ساب‌سکرایبر یوتیوب',
    description: 'افزایش ساب‌سکرایبر کانال یوتیوب با رعایت سیاست‌های پلتفرم.',
    platforms: ['یوتیوب'],
    priceMinor: 2_800_000,
    unit: '۱۰۰۰ ساب',
    category: 'یوتیوب',
  },
  {
    id: 'ai-writer',
    icon: Bot,
    title: 'AI Writer Pro',
    description: 'تولید محتوای فارسی و انگلیسی با مدل‌های پیشرفته GPT-4o، Claude و Gemini.',
    platforms: ['هوش مصنوعی'],
    priceMinor: 6_600_000,
    unit: 'ماهانه',
    category: 'هوش مصنوعی',
    badge: 'Pro',
  },
  {
    id: 'ai-image',
    icon: Camera,
    title: 'AI Image Studio',
    description: 'تولید تصویر با Midjourney، DALL-E و Stable Diffusion با یک API یکپارچه.',
    platforms: ['هوش مصنوعی'],
    priceMinor: 4_200_000,
    unit: 'ماهانه',
    category: 'هوش مصنوعی',
  },
  {
    id: 'automation-pro',
    icon: Workflow,
    title: 'Automation Pro',
    description: 'ساخت فرآیندهای خودکار با webhook، زمان‌بندی و Agent برای عملیات تکراری.',
    platforms: ['اتوماسیون'],
    priceMinor: 8_900_000,
    unit: 'ماهانه',
    category: 'اتوماسیون',
  },
  {
    id: 'growth-pack',
    icon: TrendingUp,
    title: 'پکیج رشد شبکه‌های اجتماعی',
    description: 'ترکیب فالوور، لایک و ویو با تخفیف ویژه پکیجی برای تمام پلتفرم‌ها.',
    platforms: ['اینستاگرام', 'تلگرام', 'تیک‌تاک'],
    priceMinor: 5_400_000,
    unit: 'ماهانه',
    category: 'اینستاگرام',
    badge: 'تخفیف',
  },
];

const categories: Category[] = ['همه', 'اینستاگرام', 'تلگرام', 'تیک‌تاک', 'یوتیوب', 'هوش مصنوعی', 'اتوماسیون'];

function formatPrice(minor: number) {
  return new Intl.NumberFormat('fa-IR').format(Math.round(minor / 10)) + ' تومان';
}

const badgeColors: Record<string, string> = {
  'پرفروش': 'success',
  'جدید': 'info',
  'Pro': 'accent',
  'تخفیف': 'warning',
};

export default function ServicesCatalog() {
  const [active, setActive] = useState<Category>('همه');

  const filtered = active === 'همه'
    ? services
    : services.filter(s => s.category === active);

  return (
    <>
      <div className="filter-bar">
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            className={`filter-btn${active === cat ? ' active' : ''}`}
            onClick={() => setActive(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="service-catalog">
        {filtered.map(svc => {
          const Icon = svc.icon;
          return (
            <div key={svc.id} className="service-card">
              <div className="service-card-head">
                <div className="service-icon"><Icon size={20}/></div>
                <div className="service-card-head-copy">
                  <h3>
                    {svc.title}
                    {svc.badge && (
                      <span
                        className={`status-pill ${badgeColors[svc.badge] ?? ''}`}
                        style={{ marginInlineStart: 8, verticalAlign: 'middle' }}
                      >{svc.badge}</span>
                    )}
                  </h3>
                  <p>{svc.description}</p>
                </div>
              </div>
              <div className="service-platforms">
                {svc.platforms.map(p => (
                  <span key={p} className="platform-tag">{p}</span>
                ))}
              </div>
              <div className="service-card-foot">
                <div className="service-price">
                  <strong>{formatPrice(svc.priceMinor)}</strong>
                  <span>به ازای {svc.unit}</span>
                </div>
                <Link href={`/orders/new?service=${svc.id}`} className="service-order-btn">
                  <Zap size={13}/>سفارش
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
