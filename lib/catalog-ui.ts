// Presentation metadata for the service catalogue (icons, Persian labels, quantity presets).
// Prices, availability and order rules always come from the server; nothing here is authoritative.
import type { IconName } from '../components/zp/ZIcon';
import type { BrandLogo } from '../packages/design-tokens/src/brand-logos';

export type CategoryKey =
  | 'instagram' | 'telegram' | 'youtube' | 'tiktok' | 'rubika' | 'aparat'
  | 'bale' | 'eitaa' | 'ai-subscriptions' | 'ai' | 'automation' | 'design';

/** `title` overrides the page heading «خدمات {name}» where that would read awkwardly; `hint` is the one-line teaser under the name. */
export type CategoryMeta = { key: CategoryKey; name: string; icon: IconName; hint: string; title?: string; note?: string };

/**
 * Every category the catalogue knows, in Ali's priority order (2026-10-09). The creative sections
 * (AI content, automation, design) stay defined so existing orders still render, but are hidden from
 * customers until they are ready to sell.
 */
export const ALL_CATEGORIES: CategoryMeta[] = [
  { key: 'ai-subscriptions', name: 'اشتراک هوش مصنوعی', icon: 'aiSub', hint: 'ChatGPT و Gemini', title: 'اشتراک هوش مصنوعی', note: 'فعال‌سازی روی ایمیل خودتان' },
  { key: 'instagram', name: 'اینستاگرام', icon: 'ig', hint: 'فالوور، لایک و بازدید' },
  { key: 'telegram', name: 'تلگرام', icon: 'tg', hint: 'ممبر، بازدید و ری‌اکشن' },
  { key: 'youtube', name: 'یوتیوب', icon: 'yt', hint: 'سابسکرایب، بازدید و لایک' },
  { key: 'tiktok', name: 'تیک‌تاک', icon: 'tt', hint: 'فالوور، لایک و بازدید' },
  { key: 'rubika', name: 'روبیکا', icon: 'rb', hint: 'عضو کانال و بازدید' },
  { key: 'aparat', name: 'آپارات', icon: 'ap', hint: 'دنبال‌کننده و بازدید' },
  { key: 'bale', name: 'بله', icon: 'bl', hint: 'عضو کانال و بازدید' },
  { key: 'eitaa', name: 'ایتا', icon: 'et', hint: 'عضو کانال و بازدید' },
  { key: 'ai', name: 'تولید محتوا با AI', icon: 'ai', hint: 'تولید با AI، بازبینی تیم', title: 'تولید محتوا با AI', note: 'تولید با AI، بازبینی تیم' },
  { key: 'automation', name: 'اتوماسیون', icon: 'au', hint: 'راه‌اندازی توسط تیم', note: 'راه‌اندازی و پشتیبانی توسط تیم' },
  { key: 'design', name: 'طراحی و گرافیک', icon: 'ds', hint: 'طراحی اختصاصی', title: 'طراحی و گرافیک', note: 'طراحی اختصاصی، ۲ بار اصلاح' },
];

/** Hidden from customers for now (Ali 2026-10-09); flip here to bring a section back. */
export const HIDDEN_CATEGORIES: readonly CategoryKey[] = ['ai', 'automation', 'design'];
export const isHiddenCategory = (key: string | null | undefined) => (HIDDEN_CATEGORIES as readonly string[]).includes(key ?? '');

/** What customers see: home grid, services list, app catalogue. */
export const CATEGORIES: CategoryMeta[] = ALL_CATEGORIES.filter(c => !isHiddenCategory(c.key));

export function categoryMeta(key: string): CategoryMeta | undefined {
  return ALL_CATEGORIES.find(c => c.key === key);
}

export type ServiceKind =
  | 'followers' | 'members' | 'subscribers' | 'likes' | 'views' | 'reach' | 'comments' | 'shares' | 'saves'
  | 'reactions' | 'votes' | 'starts' | 'watch' | 'months' | 'content' | 'posts'
  | 'design' | 'automation' | 'aicontent' | 'other';

/** `group` is the short service label inside a category; `per` is the quantity the list price is quoted for. */
export type KindMeta = { group: string; unit: string; icon: IconName; quantities: number[]; per: number };

const SOCIAL_Q = [100, 250, 500, 1000, 2000, 3000, 5000, 7000, 10000, 20000, 30000, 50000, 75000, 100000, 200000, 300000, 500000, 1000000];
const SMALL_Q = [10, 25, 50, 100, 200, 300, 500, 750, 1000];
const UNIT_Q = [1, 3, 5, 10, 20, 30, 50, 75, 100];
const HOURS_Q = [100, 250, 500, 1000, 2000, 4000];
const MONTHS_Q = [1, 3, 6, 12];
const PIECES_Q = [1, 3, 5, 10];

export const KINDS: Record<ServiceKind, KindMeta> = {
  followers: { group: 'فالوور', unit: 'فالوور', icon: 'user', quantities: SOCIAL_Q, per: 1000 },
  members: { group: 'ممبر', unit: 'ممبر', icon: 'user', quantities: SOCIAL_Q, per: 1000 },
  subscribers: { group: 'سابسکرایبر', unit: 'سابسکرایبر', icon: 'user', quantities: SOCIAL_Q, per: 1000 },
  likes: { group: 'لایک', unit: 'لایک', icon: 'heart', quantities: SOCIAL_Q, per: 1000 },
  views: { group: 'بازدید', unit: 'بازدید', icon: 'eye', quantities: SOCIAL_Q, per: 1000 },
  reach: { group: 'ریچ و ایمپرشن', unit: 'ایمپرشن', icon: 'rise', quantities: SOCIAL_Q, per: 1000 },
  comments: { group: 'کامنت', unit: 'کامنت', icon: 'cmt', quantities: SMALL_Q, per: 100 },
  shares: { group: 'اشتراک‌گذاری', unit: 'اشتراک‌گذاری', icon: 'share', quantities: SOCIAL_Q, per: 1000 },
  saves: { group: 'سیو', unit: 'سیو', icon: 'save', quantities: SOCIAL_Q, per: 1000 },
  reactions: { group: 'ری‌اکشن', unit: 'ری‌اکشن', icon: 'react', quantities: SOCIAL_Q, per: 1000 },
  votes: { group: 'رأی نظرسنجی', unit: 'رأی', icon: 'poll', quantities: SOCIAL_Q, per: 1000 },
  starts: { group: 'استارت ربات', unit: 'استارت', icon: 'bot', quantities: SOCIAL_Q, per: 1000 },
  watch: { group: 'ساعت تماشا', unit: 'ساعت', icon: 'clock', quantities: HOURS_Q, per: 100 },
  months: { group: 'اشتراک', unit: 'ماه', icon: 'aiSub', quantities: MONTHS_Q, per: 1 },
  content: { group: 'تولید محتوا', unit: 'محتوا', icon: 'ai', quantities: UNIT_Q, per: 1 },
  posts: { group: 'انتشار خودکار', unit: 'پست', icon: 'au', quantities: UNIT_Q, per: 1 },
  design: { group: 'طراحی', unit: 'طرح', icon: 'ds', quantities: PIECES_Q, per: 1 },
  automation: { group: 'اتوماسیون', unit: 'ماه', icon: 'au', quantities: MONTHS_Q, per: 1 },
  aicontent: { group: 'تولید محتوا', unit: 'مورد', icon: 'ai', quantities: PIECES_Q, per: 1 },
  other: { group: 'سرویس‌ها', unit: 'عدد', icon: 'box', quantities: UNIT_Q, per: 1 },
};

/** Derive the presentation kind from a catalogue slug such as `ig-story-views`, `tg-bot-starts` or `sub-claude-pro`. */
export function serviceKind(slug: string): ServiceKind {
  const creative = CREATIVE_SERVICES[slug];
  if (creative) return creative.kind;
  if (/^sub-/.test(slug)) return 'months';
  if (/followers$/.test(slug)) return 'followers';
  if (/members$/.test(slug)) return 'members';
  if (/subscribers$/.test(slug)) return 'subscribers';
  if (/likes$/.test(slug)) return 'likes';
  if (/views$/.test(slug)) return 'views';
  if (/reach$/.test(slug)) return 'reach';
  if (/comments$/.test(slug)) return 'comments';
  if (/shares$/.test(slug)) return 'shares';
  if (/saves$/.test(slug)) return 'saves';
  if (/reactions$/.test(slug)) return 'reactions';
  if (/votes$/.test(slug)) return 'votes';
  if (/starts$/.test(slug)) return 'starts';
  if (/watch-hours$/.test(slug)) return 'watch';
  if (/content$/.test(slug)) return 'content';
  if (/posting$/.test(slug)) return 'posts';
  return 'other';
}

/** AI subscriptions show the product's own mark (Claude, ChatGPT, Grok…) instead of the category glyph. */
const BRAND_BY_SLUG: Array<[RegExp, BrandLogo]> = [
  [/^sub-chatgpt-/, 'openai'], [/^sub-claude-/, 'claude'], [/^sub-gemini-/, 'gemini'], [/^sub-(super)?grok/, 'grok'],
  [/^sub-perplexity-/, 'perplexity'], [/^sub-midjourney-/, 'midjourney'], [/^sub-cursor-/, 'cursor'],
  [/^sub-copilot-/, 'copilot'], [/^sub-elevenlabs-/, 'elevenlabs'], [/^sub-suno-/, 'suno'],
];
export function serviceBrand(slug: string): BrandLogo | undefined {
  return BRAND_BY_SLUG.find(([rx]) => rx.test(slug))?.[1];
}

/** Name inside its own category: «سیو اینستاگرام» → «سیو» on the Instagram page; AI plans keep their full name. */
export function shortServiceName(name: string, categoryName: string): string {
  const s = name.replace(new RegExp(`\\s*${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), ' ').replace(/\s+/g, ' ').trim();
  return s || name;
}

const KIND_ORDER: ServiceKind[] = ['months', 'followers', 'members', 'subscribers', 'likes', 'views', 'reach', 'comments', 'shares', 'saves', 'reactions', 'votes', 'starts', 'watch', 'design', 'automation', 'aicontent', 'content', 'posts', 'other'];

/** Stable display order inside a category: by kind (followers before likes …), then the catalogue order. */
export function sortServices<T extends { slug: string }>(items: T[]): T[] {
  const order = [...SERVICE_ORDER, ...CREATIVE_ORDER()];
  const pos = (slug: string) => { const i = order.indexOf(slug); return i < 0 ? order.length + KIND_ORDER.indexOf(serviceKind(slug)) : i; };
  return items.map((it, i) => ({ it, i })).sort((a, b) => pos(a.it.slug) - pos(b.it.slug) || a.i - b.i).map(x => x.it);
}

/** Display order inside each category: what customers ask for most comes first. Unlisted slugs follow, by kind. */
const SERVICE_ORDER = [
  'ig-followers', 'ig-likes', 'ig-views', 'ig-story-views', 'ig-comments', 'ig-shares', 'ig-saves', 'ig-reach', 'ig-live-views',
  'tg-members', 'tg-views', 'tg-reactions', 'tg-votes', 'tg-bot-starts',
  'yt-views', 'yt-subscribers', 'yt-likes', 'yt-comments', 'yt-watch-hours', 'yt-shorts-views',
  'tt-followers', 'tt-likes', 'tt-views', 'tt-comments', 'tt-shares', 'tt-saves',
  'rb-members', 'rb-followers', 'rb-views', 'rb-likes', 'ap-followers', 'ap-views', 'ap-likes',
  'bl-members', 'bl-views', 'et-members', 'et-views',
  'sub-chatgpt-plus', 'sub-claude-pro', 'sub-gemini-pro', 'sub-supergrok', 'sub-chatgpt-pro', 'sub-claude-max',
  'sub-perplexity-pro', 'sub-midjourney-standard', 'sub-cursor-pro', 'sub-copilot-pro', 'sub-elevenlabs-creator', 'sub-suno-pro',
  // Creative services keep the priority order of their table below.
];
const CREATIVE_ORDER = (): string[] => Object.keys(CREATIVE_SERVICES);

/** Glyph for one service: a few services read better with their own icon than their kind's. */
export function serviceIcon(slug: string): IconName {
  const creative = CREATIVE_SERVICES[slug];
  if (creative) return creative.icon;
  if (/story-views$/.test(slug)) return 'story';
  if (/live-views$/.test(slug)) return 'live';
  if (/reach$/.test(slug)) return 'rise';
  return KINDS[serviceKind(slug)].icon;
}

/** Caption under a list price: «هر ۱ هزار لایک», «هر ۱۰۰ کامنت», «ماهانه». */
export function perLabel(kind: KindMeta): string {
  if (kind.unit === 'ماه') return 'ماهانه';
  if (kind.per === 1) return `هر ${kind.unit}`;
  return `هر ${kind.per === 1000 ? '۱ هزار' : new Intl.NumberFormat('fa-IR').format(kind.per)} ${kind.unit}`;
}

/** Order-form target field, by category and kind. The value is sent as `parameters.target`. */
export function targetField(category: string, kind: ServiceKind, slug = ''): TargetSpec {
  const creative = CREATIVE_SERVICES[slug];
  if (creative) return creative.target;
  return { ...socialTarget(category, kind, slug), required: true };
}

function socialTarget(category: string, kind: ServiceKind, slug: string): { label: string; placeholder: string; ltr: boolean } {
  const user = (host: string) => ({ label: 'نام کاربری یا لینک صفحه', placeholder: host ? `${host}/username` : '@username', ltr: true });
  if (kind === 'months') return { label: 'ایمیل حساب', placeholder: 'you@example.com', ltr: true };
  if (kind === 'content') return { label: 'موضوع محتوا', placeholder: 'مثلاً معرفی محصول جدید', ltr: false };
  if (kind === 'posts') return { label: 'کانال یا صفحه‌ی مقصد', placeholder: '@channel', ltr: true };
  if (kind === 'starts') return { label: 'لینک ربات', placeholder: 'https://t.me/your_bot', ltr: true };
  switch (category) {
    case 'instagram':
      if (kind === 'followers' || /story|live/.test(slug)) return user('instagram.com');
      return { label: 'لینک پست یا ریلز', placeholder: 'https://instagram.com/p/…', ltr: true };
    case 'telegram':
      return kind === 'members'
        ? { label: 'لینک کانال یا گروه', placeholder: 'https://t.me/your_channel', ltr: true }
        : { label: 'لینک پست', placeholder: 'https://t.me/your_channel/123', ltr: true };
    case 'youtube':
      return kind === 'subscribers' || kind === 'watch'
        ? { label: 'لینک کانال', placeholder: 'https://youtube.com/@channel', ltr: true }
        : { label: 'لینک ویدیو', placeholder: 'https://youtube.com/watch?v=…', ltr: true };
    case 'tiktok':
      return kind === 'followers' ? user('tiktok.com') : { label: 'لینک ویدیو', placeholder: 'https://tiktok.com/@user/video/…', ltr: true };
    case 'aparat':
      return kind === 'followers' ? user('aparat.com') : { label: 'لینک ویدیو', placeholder: 'https://aparat.com/v/…', ltr: true };
    case 'rubika':
      if (kind === 'followers') return user('rubika.ir');
      return kind === 'members' ? { label: 'لینک کانال', placeholder: 'https://rubika.ir/your_channel', ltr: true } : { label: 'لینک پست', placeholder: 'https://rubika.ir/post/…', ltr: true };
    case 'bale':
      return kind === 'members' ? { label: 'لینک کانال', placeholder: 'https://ble.ir/your_channel', ltr: true } : { label: 'لینک پست', placeholder: 'https://ble.ir/your_channel/123', ltr: true };
    case 'eitaa':
      return kind === 'members' ? { label: 'لینک کانال', placeholder: 'https://eitaa.com/your_channel', ltr: true } : { label: 'لینک پست', placeholder: 'https://eitaa.com/your_channel/123', ltr: true };
    default:
      return { label: 'لینک', placeholder: 'https://…', ltr: true };
  }
}

// ─── Creative services: design, automation and AI content ────────────────────────────────────────
// Fulfilled by the ZOHALPAY team (services.fulfillment_mode = 'MANUAL'), so the order form asks for a
// brief, and the order page states delivery time, revisions and the refund rule. Prices come from
// db/seeds/003_creative_services.sql; nothing here is authoritative for money.

export type TargetSpec = { label: string; placeholder: string; ltr: boolean; required: boolean };
export type BriefSpec = { label: string; placeholder: string; min: number; max: number };
export type CreativeService = {
  kind: 'design' | 'automation' | 'aicontent';
  icon: IconName;
  unit: string;
  quantities: number[];
  /** `monthly`: paid upfront per month, never renewed automatically. `once`: one-time per piece/project. */
  billing: 'once' | 'monthly';
  /** Working days to deliver (one-time) or to set up (monthly). */
  days: number;
  /** Free revision rounds included with each piece (design). */
  revisions?: number;
  target: TargetSpec;
  brief: BriefSpec;
};

/** Length bounds enforced by the server (server/commerce/order-input.ts). */
export const BRIEF_MIN = 10;
export const BRIEF_MAX = 3000;
export const TARGET_MAX = 500;

/** Categories whose orders are fulfilled by the team rather than an external provider. */
export const TEAM_CATEGORIES = ['design', 'automation', 'ai', 'ai-subscriptions'] as const;
export function isTeamFulfilled(category: string | null | undefined): boolean {
  return (TEAM_CATEGORIES as readonly string[]).includes(category ?? '');
}

const page = (required: boolean): TargetSpec => ({ label: required ? 'پیج یا کانال' : 'پیج یا برند (اختیاری)', placeholder: '@yourpage', ltr: true, required });
const site = (label: string, placeholder: string, required = false): TargetSpec => ({ label, placeholder, ltr: true, required });
const brief = (placeholder: string, label = 'شرح سفارش'): BriefSpec => ({ label, placeholder, min: BRIEF_MIN, max: BRIEF_MAX });
const design = (icon: IconName, unit: string, days: number, b: string, quantities = PIECES_Q, target = page(false)): CreativeService =>
  ({ kind: 'design', icon, unit, quantities, billing: 'once', days, revisions: 2, target, brief: brief(b) });
const monthly = (kind: 'automation' | 'aicontent', icon: IconName, days: number, b: string, target = page(true)): CreativeService =>
  ({ kind, icon, unit: 'ماه', quantities: MONTHS_Q, billing: 'monthly', days, target, brief: brief(b, 'توضیح نیاز') });
const ai = (icon: IconName, unit: string, quantities: number[], days: number, b: string, label?: string, target = page(false)): CreativeService =>
  ({ kind: 'aicontent', icon, unit, quantities, billing: 'once', days, target, brief: brief(b, label) });

/** Every creative service, in display (demand) order within its category. */
export const CREATIVE_SERVICES: Record<string, CreativeService> = {
  // طراحی و گرافیک
  'ds-post': design('dsPost', 'طرح', 2, 'موضوع، متن روی طرح، رنگ‌ها و یک نمونه‌ی مورد علاقه'),
  'ds-carousel': design('dsCarousel', 'کاروسل', 3, 'موضوع و متن هر اسلاید (تا ۷ اسلاید)، رنگ‌ها و نمونه'),
  'ds-story': design('dsStory', 'طرح', 2, 'موضوع استوری، متن، لینک یا کد تخفیف'),
  'ds-highlight': design('dsHighlight', 'کاور', 2, 'عنوان هر هایلایت و رنگ‌های برند', [3, 5, 10, 15]),
  'ds-logo': design('dsLogo', 'لوگو', 7, 'نام برند، حوزه‌ی کار، سلیقه‌ی رنگ و نمونه‌هایی که می‌پسندید', [1]),
  'ds-thumbnail': design('dsThumb', 'طرح', 2, 'عنوان ویدیو، متن روی کاور و حس مورد نظر', PIECES_Q, site('لینک کانال (اختیاری)', 'https://youtube.com/@channel')),
  'ds-banner': design('dsBanner', 'طرح', 3, 'محل استفاده (هدر یوتیوب، کاور تلگرام، بنر سایت)، ابعاد و متن', [1, 2, 3, 5]),
  'ds-mockup': design('dsMockup', 'طرح', 3, 'نوع محصول و بسته‌بندی؛ فایل لوگو را بعد از ثبت از پشتیبانی بفرستید'),
  'ds-identity': design('dsBrand', 'پکیج', 10, 'معرفی برند، مخاطب و سلیقه‌ی رنگ (پالت، فونت و ۳ قالب پست و استوری)', [1]),
  // اتوماسیون
  'auto-posting': monthly('automation', 'auSchedule', 2, 'شبکه‌ها و برنامه‌ی انتشار (مثلاً هر روز ساعت ۱۸)'),
  'au-comment-reply': monthly('automation', 'auComment', 2, 'کلیدواژه‌ها و پاسخی که برای هر کدام می‌خواهید'),
  'au-dm-reply': monthly('automation', 'auDm', 2, 'پیام‌های پرتکرار مشتری‌ها و پاسخ هر کدام'),
  'au-cross-post': monthly('automation', 'auCross', 2, 'شبکه‌ی مبدأ و شبکه‌های مقصد (اینستاگرام، تلگرام، بله، ایتا…)'),
  'au-lead-capture': monthly('automation', 'auLead', 3, 'چه اطلاعاتی از مشتری گرفته شود و کجا ذخیره شود'),
  'au-report': monthly('automation', 'auReport', 2, 'شاخص‌های مهم برای شما و مقصد گزارش (ایمیل یا تلگرام)'),
  'au-telegram-bot': {
    kind: 'automation', icon: 'auTgBot', unit: 'ربات', quantities: [1], billing: 'once', days: 10,
    target: site('آیدی کانال یا ربات (اختیاری)', '@your_bot'), brief: brief('ربات چه کاری انجام دهد؛ منوها، پاسخ‌ها و اتصال‌های لازم', 'توضیح نیاز'),
  },
  // تولید محتوا با AI
  'ai-caption': ai('aiCaption', 'کپشن', [5, 10, 20, 30], 1, 'موضوع پست‌ها، لحن (رسمی یا صمیمی) و مخاطب'),
  'ai-image': ai('aiImage', 'تصویر', [3, 5, 10, 20], 1, 'سوژه، سبک (واقعی، تصویرسازی، سه‌بعدی) و ابعاد'),
  'ai-script': ai('aiScript', 'سناریو', PIECES_Q, 2, 'موضوع ویدیو، مدت (مثلاً ۳۰ ثانیه) و پیام اصلی'),
  'ai-voiceover': ai('aiVoice', 'دقیقه', PIECES_Q, 1, 'متن نریشن یا موضوع آن؛ صدای زن یا مرد', 'متن یا موضوع نریشن'),
  'ai-product': ai('aiProduct', 'محصول', [5, 10, 20, 50], 2, 'نام و ویژگی‌های هر محصول', undefined, site('لینک فروشگاه (اختیاری)', 'https://')),
  'ai-article': ai('aiArticle', 'مقاله', PIECES_Q, 3, 'موضوع، کلمه‌ی کلیدی اصلی و مخاطب (هر مقاله حدود ۱۲۰۰ کلمه)', undefined, site('آدرس سایت (اختیاری)', 'https://')),
  'ai-subtitle': ai('aiSubtitle', 'دقیقه', [1, 5, 10, 30], 2, 'زبان ویدیو و زبان زیرنویس', undefined, site('لینک ویدیو', 'https://', true)),
  'ai-calendar': monthly('aicontent', 'aiCalendar', 3, 'حوزه‌ی کسب‌وکار، مخاطب و تعداد پست در هفته'),
  'ai-dm-assistant': monthly('aicontent', 'aiAssistant', 3, 'محصولات، قیمت‌ها و پرسش‌های پرتکرار مشتری‌ها'),
};

/** Presentation unit, presets and icon for one service (creative services override their kind's defaults). */
export function serviceMeta(slug: string): KindMeta {
  const creative = CREATIVE_SERVICES[slug];
  const kind = KINDS[serviceKind(slug)];
  return creative ? { ...kind, unit: creative.unit, quantities: creative.quantities, icon: creative.icon } : kind;
}

const faInt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

/** Order-form inputs and the plain terms shown before paying. */
export type OrderFact = { icon: IconName; text: string };
export type OrderForm = { target: TargetSpec; brief: BriefSpec | null; facts: OrderFact[]; refund: string };
export function orderForm(category: string, slug: string): OrderForm {
  const creative = CREATIVE_SERVICES[slug];
  const target = targetField(category, serviceKind(slug), slug);
  if (!creative) return { target, brief: null, facts: [], refund: 'بازگشت وجه در صورت لغو' };
  const facts: OrderFact[] = creative.billing === 'monthly'
    ? [{ icon: 'clock', text: `راه‌اندازی ${faInt(creative.days)} روز کاری` }, { icon: 'hist', text: 'ماهانه، بدون تمدید خودکار' }]
    : [{ icon: 'clock', text: `تحویل ${faInt(creative.days)} روز کاری` }];
  if (creative.revisions) facts.push({ icon: 'edit', text: `${faInt(creative.revisions)} بار اصلاح رایگان` });
  facts.push({ icon: 'shieldS', text: 'بازگشت وجه اگر تحویل نشود' });
  return { target, brief: creative.brief, facts, refund: 'هر بخشی که تحویل نشود، مبلغش به کیف پول برمی‌گردد.' };
}
