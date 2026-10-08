// Presentation metadata for the service catalogue (icons, Persian labels, quantity presets).
// Prices, availability and order rules always come from the server; nothing here is authoritative.
import type { IconName } from '../components/zp/ZIcon';

export type CategoryKey =
  | 'instagram' | 'telegram' | 'youtube' | 'tiktok' | 'rubika' | 'aparat'
  | 'bale' | 'eitaa' | 'premium' | 'ai' | 'automation' | 'design';

export type CategoryMeta = { key: CategoryKey; name: string; icon: IconName };

/** Home grid order. Categories without active services in the catalogue render as «به‌زودی». */
export const CATEGORIES: CategoryMeta[] = [
  { key: 'instagram', name: 'اینستاگرام', icon: 'ig' },
  { key: 'telegram', name: 'تلگرام', icon: 'tg' },
  { key: 'youtube', name: 'یوتیوب', icon: 'yt' },
  { key: 'tiktok', name: 'تیک‌تاک', icon: 'tt' },
  { key: 'rubika', name: 'روبیکا', icon: 'rb' },
  { key: 'aparat', name: 'آپارات', icon: 'ap' },
  { key: 'bale', name: 'بله', icon: 'bl' },
  { key: 'eitaa', name: 'ایتا', icon: 'et' },
  { key: 'premium', name: 'اکانت پرمیوم', icon: 'pr' },
  { key: 'ai', name: 'هوش مصنوعی', icon: 'ai' },
  { key: 'automation', name: 'اتوماسیون', icon: 'au' },
  { key: 'design', name: 'طراحی و گرافیک', icon: 'ds' },
];

export function categoryMeta(key: string): CategoryMeta | undefined {
  return CATEGORIES.find(c => c.key === key);
}

export type ServiceKind = 'followers' | 'members' | 'likes' | 'views' | 'comments' | 'content' | 'posts' | 'other';

export type KindMeta = { group: string; unit: string; icon: IconName; quantities: number[]; per: number };

const SOCIAL_Q = [100, 250, 500, 1000, 2000, 3000, 5000, 7000, 10000, 20000, 30000, 50000, 75000, 100000, 200000, 300000, 500000, 1000000];
const SMALL_Q = [10, 25, 50, 100, 200, 300, 500, 750, 1000];
const UNIT_Q = [1, 3, 5, 10, 20, 30, 50, 75, 100];

export const KINDS: Record<ServiceKind, KindMeta> = {
  followers: { group: 'فالوور', unit: 'فالوور', icon: 'user', quantities: SOCIAL_Q, per: 1000 },
  members: { group: 'ممبر', unit: 'ممبر', icon: 'user', quantities: SOCIAL_Q, per: 1000 },
  likes: { group: 'لایک', unit: 'لایک', icon: 'heart', quantities: SOCIAL_Q, per: 1000 },
  views: { group: 'بازدید', unit: 'بازدید', icon: 'eye', quantities: SOCIAL_Q, per: 1000 },
  comments: { group: 'کامنت', unit: 'کامنت', icon: 'chat', quantities: SMALL_Q, per: 100 },
  content: { group: 'تولید محتوا', unit: 'محتوا', icon: 'ai', quantities: UNIT_Q, per: 1 },
  posts: { group: 'انتشار خودکار', unit: 'پست', icon: 'au', quantities: UNIT_Q, per: 1 },
  other: { group: 'سرویس‌ها', unit: 'عدد', icon: 'box', quantities: UNIT_Q, per: 1 },
};

/** Derive the presentation kind from a catalogue slug such as `ig-story-views` or `tg-members`. */
export function serviceKind(slug: string): ServiceKind {
  if (/followers$/.test(slug)) return 'followers';
  if (/members$/.test(slug)) return 'members';
  if (/likes$/.test(slug)) return 'likes';
  if (/views$/.test(slug)) return 'views';
  if (/comments$/.test(slug)) return 'comments';
  if (/content$/.test(slug)) return 'content';
  if (/posting$/.test(slug)) return 'posts';
  return 'other';
}

/** Order-form target field, by category and kind. The value is sent as `parameters.target`. */
export function targetField(category: string, kind: ServiceKind): { label: string; placeholder: string; ltr: boolean } {
  if (kind === 'content') return { label: 'موضوع محتوا', placeholder: 'مثلاً معرفی محصول جدید', ltr: false };
  if (kind === 'posts') return { label: 'کانال یا صفحه‌ی مقصد', placeholder: '@channel', ltr: true };
  if (category === 'telegram') return { label: kind === 'members' ? 'لینک کانال یا گروه' : 'لینک پست', placeholder: kind === 'members' ? 'https://t.me/your_channel' : 'https://t.me/your_channel/123', ltr: true };
  if (category === 'youtube') return { label: 'لینک ویدیو', placeholder: 'https://youtube.com/watch?v=…', ltr: true };
  if (kind === 'followers') return { label: 'نام کاربری', placeholder: '@username', ltr: true };
  if (category === 'tiktok') return { label: 'لینک ویدیو', placeholder: 'https://tiktok.com/@user/video/…', ltr: true };
  return { label: 'لینک پست یا ریلز', placeholder: 'https://instagram.com/p/…', ltr: true };
}
