'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bot, Film, Hash, Heart, Instagram, MessageCircle, Music2, Play, Sparkles, Star, Users, Workflow, Youtube, Zap } from 'lucide-react';
import type { CatalogService } from '../../server/commerce/catalog';

type Category = 'همه' | 'اینستاگرام' | 'تلگرام' | 'تیک‌تاک' | 'یوتیوب' | 'هوش مصنوعی' | 'اتوماسیون';

const slugMeta: Record<string, { icon: React.ElementType; badge?: string; unit: string }> = {
  'ig-followers':   { icon: Users,          badge: 'پرفروش', unit: '۱۰۰۰ فالوور' },
  'ig-likes':       { icon: Heart,                           unit: '۱۰۰۰ لایک'   },
  'ig-views':       { icon: Play,                            unit: '۱۰۰۰ ویو'    },
  'ig-comments':    { icon: MessageCircle,                   unit: '۱۰۰ کامنت'   },
  'ig-story-views': { icon: Instagram,                       unit: '۱۰۰۰ ویو'    },
  'tg-members':     { icon: Hash,                            unit: '۱۰۰۰ ممبر'   },
  'tg-views':       { icon: Film,                            unit: '۱۰۰۰ ویو'    },
  'tt-followers':   { icon: Music2,          badge: 'جدید',  unit: '۱۰۰۰ فالوور' },
  'tt-likes':       { icon: Zap,                             unit: '۱۰۰۰ لایک'   },
  'yt-views':       { icon: Youtube,                         unit: '۱۰۰۰ ویو'    },
  'yt-likes':       { icon: Star,                            unit: '۱۰۰۰ لایک'   },
  'ai-content':     { icon: Bot,             badge: 'Pro',   unit: '۱ محتوا'     },
  'auto-posting':   { icon: Workflow,                        unit: '۱ پست'       },
};

const productSlugToCategory: Record<string, Category> = {
  instagram: 'اینستاگرام',
  telegram:  'تلگرام',
  tiktok:    'تیک‌تاک',
  youtube:   'یوتیوب',
  ai:        'هوش مصنوعی',
  automation:'اتوماسیون',
};

type ServiceItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: Category;
  icon: React.ElementType;
  badge?: string;
  unit: string;
  productName: string;
};

const staticServices: ServiceItem[] = [
  { id: 'ig-followers',   slug: 'ig-followers',   icon: Users,          title: 'فالوور اینستاگرام',    description: 'افزایش فالوور واقعی با مسیردهی هوشمند تأمین‌کننده، تضمین کیفیت و پیگیری لحظه‌ای.', productName: 'اینستاگرام', category: 'اینستاگرام', badge: 'پرفروش', unit: '۱۰۰۰ فالوور' },
  { id: 'ig-likes',       slug: 'ig-likes',       icon: Heart,          title: 'لایک اینستاگرام',       description: 'لایک ارگانیک با تحویل سریع، مناسب برای پست‌ها و Reelها.',                          productName: 'اینستاگرام', category: 'اینستاگرام', unit: '۱۰۰۰ لایک'   },
  { id: 'ig-views',       slug: 'ig-views',       icon: Play,           title: 'ویو Reel اینستاگرام',   description: 'افزایش بازدید Reel و ویدیو با تضمین سرعت تحویل و ماندگاری.',                        productName: 'اینستاگرام', category: 'اینستاگرام', unit: '۱۰۰۰ ویو'    },
  { id: 'ig-comments',    slug: 'ig-comments',    icon: MessageCircle,  title: 'کامنت اینستاگرام',      description: 'کامنت‌های هدفمند برای افزایش تعامل پست‌های اینستاگرام.',                            productName: 'اینستاگرام', category: 'اینستاگرام', unit: '۱۰۰ کامنت'   },
  { id: 'ig-story-views', slug: 'ig-story-views', icon: Instagram,      title: 'Story View اینستاگرام', description: 'افزایش بازدید استوری برای تقویت الگوریتم و رتبه‌بندی.',                            productName: 'اینستاگرام', category: 'اینستاگرام', unit: '۱۰۰۰ ویو'    },
  { id: 'tg-members',     slug: 'tg-members',     icon: Hash,           title: 'ممبر تلگرام',           description: 'افزایش اعضای کانال یا گروه تلگرام با مسیردهی هوشمند.',                             productName: 'تلگرام',     category: 'تلگرام',    unit: '۱۰۰۰ ممبر'   },
  { id: 'tg-views',       slug: 'tg-views',       icon: Film,           title: 'ویو پست تلگرام',        description: 'افزایش بازدید پست‌های کانال تلگرام برای تقویت تعامل.',                              productName: 'تلگرام',     category: 'تلگرام',    unit: '۱۰۰۰ ویو'    },
  { id: 'tt-followers',   slug: 'tt-followers',   icon: Music2,         title: 'فالوور تیک‌تاک',        description: 'افزایش فالوور تیک‌تاک برای رشد سریع‌تر و دسترسی به بیشتر.',                         productName: 'تیک‌تاک',    category: 'تیک‌تاک',   badge: 'جدید', unit: '۱۰۰۰ فالوور' },
  { id: 'tt-likes',       slug: 'tt-likes',       icon: Zap,            title: 'لایک تیک‌تاک',          description: 'لایک‌های واقعی برای تقویت الگوریتم توصیه تیک‌تاک.',                                 productName: 'تیک‌تاک',    category: 'تیک‌تاک',   unit: '۱۰۰۰ لایک'   },
  { id: 'yt-views',       slug: 'yt-views',       icon: Youtube,        title: 'ویو یوتیوب',            description: 'افزایش بازدید ویدیو یوتیوب با تضمین ماندگاری بالای ۳۰ روز.',                        productName: 'یوتیوب',     category: 'یوتیوب',    unit: '۱۰۰۰ ویو'    },
  { id: 'yt-likes',       slug: 'yt-likes',       icon: Star,           title: 'لایک یوتیوب',           description: 'لایک‌های واقعی یوتیوب برای بهبود رتبه‌بندی ویدیو.',                                 productName: 'یوتیوب',     category: 'یوتیوب',    unit: '۱۰۰۰ لایک'   },
  { id: 'ai-content',     slug: 'ai-content',     icon: Bot,            title: 'تولید محتوا با AI',     description: 'تولید محتوای شبکه اجتماعی با هوش مصنوعی GPT-4 و Claude.',                          productName: 'هوش مصنوعی', category: 'هوش مصنوعی', badge: 'Pro', unit: '۱ محتوا' },
  { id: 'auto-posting',   slug: 'auto-posting',   icon: Workflow,       title: 'اتوماسیون پست',         description: 'زمان‌بندی و ارسال خودکار پست به کانال‌های انتخابی.',                               productName: 'اتوماسیون',  category: 'اتوماسیون', unit: '۱ پست'       },
];

function dbToItem(s: CatalogService): ServiceItem {
  const meta = slugMeta[s.slug] ?? { icon: Sparkles, unit: '۱ واحد' };
  const category = productSlugToCategory[s.productSlug] ?? 'همه' as Category;
  return { id: s.id, slug: s.slug, icon: meta.icon, title: s.name, description: s.description, badge: meta.badge, unit: meta.unit, productName: s.productName, category };
}

const categories: Category[] = ['همه', 'اینستاگرام', 'تلگرام', 'تیک‌تاک', 'یوتیوب', 'هوش مصنوعی', 'اتوماسیون'];

const badgeColors: Record<string, string> = {
  'پرفروش': 'success',
  'جدید':   'info',
  'Pro':    'accent',
};

export default function ServicesCatalog({ dbServices }: { dbServices?: CatalogService[] | null }) {
  const [active, setActive] = useState<Category>('همه');

  const items: ServiceItem[] = dbServices && dbServices.length > 0
    ? dbServices.map(dbToItem)
    : staticServices;

  const filtered = active === 'همه' ? items : items.filter(s => s.category === active);

  return (
    <>
      <div className="surface-hero" style={{marginBottom:24}}>
        <div className="surface-hero-copy">
          <span className="eyebrow">مارکت‌پلیس خدمات دیجیتال</span>
          <h1>خدمات دیجیتال حرفه‌ای</h1>
          <p>از اینستاگرام و تلگرام تا یوتیوب و تیک‌تاک — سفارش، پیگیری و تحویل خودکار.</p>
          <div className="surface-hero-actions">
            <Link href="/orders/new" className="button primary">سفارش جدید</Link>
            <Link href="/pricing" className="button secondary">مشاهده پلن‌ها</Link>
          </div>
        </div>
        <div className="surface-hero-visual">
          <div className="hero-orb-core">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>
        </div>
      </div>

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
                  {svc.description && <p>{svc.description}</p>}
                </div>
              </div>
              <div className="service-platforms">
                <span className="platform-tag">{svc.productName}</span>
              </div>
              <div className="service-card-foot">
                <div className="service-price">
                  <span>از {svc.unit}</span>
                </div>
                <Link href={`/orders/new?service=${svc.slug}`} className="service-order-btn">
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
