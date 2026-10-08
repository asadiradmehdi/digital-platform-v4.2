// Presentation metadata for the service catalogue (icons, Persian labels, quantity presets).
// Prices, availability and order rules always come from the server; nothing here is authoritative.
import type { IconName } from '../components/zp/ZIcon';
import type { BrandLogo } from '../packages/design-tokens/src/brand-logos';

export type CategoryKey =
  | 'instagram' | 'telegram' | 'youtube' | 'tiktok' | 'rubika' | 'aparat'
  | 'bale' | 'eitaa' | 'ai-subscriptions' | 'ai' | 'automation' | 'design';

/** `title` overrides the page heading «خدمات {name}» where that would read awkwardly. */
export type CategoryMeta = { key: CategoryKey; name: string; icon: IconName; title?: string; note?: string };

/** Home grid order. Categories without active services in the catalogue render as «به‌زودی». */
export const CATEGORIES: CategoryMeta[] = [
  { key: 'instagram', name: 'اینستاگرام', icon: 'ig' },
  { key: 'telegram', name: 'تلگرام', icon: 'tg' },
  { key: 'youtube', name: 'یوتیوب', icon: 'yt' },
  { key: 'tiktok', name: 'تیک‌تاک', icon: 'tt' },
  { key: 'ai-subscriptions', name: 'اشتراک هوش مصنوعی', icon: 'aiSub', title: 'اشتراک هوش مصنوعی', note: 'فعال‌سازی روی ایمیل خودتان' },
  { key: 'rubika', name: 'روبیکا', icon: 'rb' },
  { key: 'aparat', name: 'آپارات', icon: 'ap' },
  { key: 'bale', name: 'بله', icon: 'bl' },
  { key: 'eitaa', name: 'ایتا', icon: 'et' },
  { key: 'ai', name: 'تولید محتوا با AI', icon: 'ai', title: 'تولید محتوا با AI' },
  { key: 'automation', name: 'اتوماسیون', icon: 'au' },
  { key: 'design', name: 'طراحی و گرافیک', icon: 'ds' },
];

export function categoryMeta(key: string): CategoryMeta | undefined {
  return CATEGORIES.find(c => c.key === key);
}

export type ServiceKind =
  | 'followers' | 'members' | 'subscribers' | 'likes' | 'views' | 'reach' | 'comments' | 'shares' | 'saves'
  | 'reactions' | 'votes' | 'starts' | 'watch' | 'months' | 'content' | 'posts' | 'other';

/** `group` is the short service label inside a category; `per` is the quantity the list price is quoted for. */
export type KindMeta = { group: string; unit: string; icon: IconName; quantities: number[]; per: number };

const SOCIAL_Q = [100, 250, 500, 1000, 2000, 3000, 5000, 7000, 10000, 20000, 30000, 50000, 75000, 100000, 200000, 300000, 500000, 1000000];
const SMALL_Q = [10, 25, 50, 100, 200, 300, 500, 750, 1000];
const UNIT_Q = [1, 3, 5, 10, 20, 30, 50, 75, 100];
const HOURS_Q = [100, 250, 500, 1000, 2000, 4000];
const MONTHS_Q = [1, 3, 6, 12];

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
  other: { group: 'سرویس‌ها', unit: 'عدد', icon: 'box', quantities: UNIT_Q, per: 1 },
};

/** Derive the presentation kind from a catalogue slug such as `ig-story-views`, `tg-bot-starts` or `sub-claude-pro`. */
export function serviceKind(slug: string): ServiceKind {
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

const KIND_ORDER: ServiceKind[] = ['months', 'followers', 'members', 'subscribers', 'likes', 'views', 'reach', 'comments', 'shares', 'saves', 'reactions', 'votes', 'starts', 'watch', 'content', 'posts', 'other'];

/** Stable display order inside a category: by kind (followers before likes …), then the catalogue order. */
export function sortServices<T extends { slug: string }>(items: T[]): T[] {
  const pos = (slug: string) => { const i = SERVICE_ORDER.indexOf(slug); return i < 0 ? SERVICE_ORDER.length + KIND_ORDER.indexOf(serviceKind(slug)) : i; };
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
];

/** Glyph for one service: a few services read better with their own icon than their kind's. */
export function serviceIcon(slug: string): IconName {
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
export function targetField(category: string, kind: ServiceKind, slug = ''): { label: string; placeholder: string; ltr: boolean } {
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
