// Search copy for the public catalogue: titles, descriptions, H1s, intros and FAQs per category and per
// service. Pure functions over the live catalogue (prices and limits come from the database), so every
// number on a page is the number the order flow charges. Keyword targets: docs/seo/KEYWORD_MAP.md.
//
// Honesty rules for this file: no invented guarantees («تضمینی»، «بدون ریزش»), no «واقعی/ایرانی» claims,
// no delivery-time promises, no ratings. Only what the product actually does.
import { CATEGORIES, KINDS, categoryMeta, perLabel, serviceKind, sortServices, targetField, type CategoryKey, type ServiceKind } from '../catalog-ui';
import { formatQuantityWords, formatTomanNumber } from '../format';

export type Faq = { q: string; a: string };

/** Minimal shape both the server read model and tests can supply. */
export type SeoService = {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  unitToman: number;
  minQuantity: number;
  maxQuantity: number | null;
  updatedAt?: string;
};

const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

// ─── URLs ────────────────────────────────────────────────────────────────────

/** `ig-followers` → `followers`, `sub-chatgpt-plus` → `chatgpt-plus`: the readable last URL segment. */
export function serviceSegment(slug: string): string {
  const s = slug.replace(/^[a-z]{2,4}-(?=[a-z0-9])/, '');
  return s || slug;
}

export function categoryHref(category: string) {
  return `/services/${category}`;
}

export function serviceHref(service: Pick<SeoService, 'slug' | 'category'>) {
  return `/services/${service.category}/${serviceSegment(service.slug)}`;
}

export function findService(catalog: SeoService[], category: string, segment: string): SeoService | undefined {
  return catalog.find(s => s.category === category && serviceSegment(s.slug) === segment);
}

/** Order entry: members go straight to the order form; visitors register first and come back to it. */
export function orderHref(slug: string, signedIn: boolean) {
  const target = `/orders/new?service=${encodeURIComponent(slug)}`;
  return signedIn ? target : `/auth?mode=register&next=${encodeURIComponent(target)}`;
}

// ─── Prices ──────────────────────────────────────────────────────────────────

export type ListPrice = { kind: ServiceKind; per: number; perLabel: string; toman: number; text: string };

/** The list price as shown everywhere: per 1000 (per 100 comments/hours, per month for AI plans). */
export function listPrice(s: Pick<SeoService, 'slug' | 'unitToman'>): ListPrice {
  const kind = serviceKind(s.slug);
  const meta = KINDS[kind];
  const toman = s.unitToman * meta.per;
  return { kind, per: meta.per, perLabel: perLabel(meta), toman, text: formatTomanNumber(toman) };
}

/** Toman → IRR for structured data (schema.org wants ISO 4217; the toman is not a currency code). */
export function tomanToIrr(toman: number): number {
  return Math.round(toman) * 10;
}

/** Up to `max` ready-made package sizes inside the service's min/max, always including both ends. */
export function packageQuantities(s: Pick<SeoService, 'slug' | 'minQuantity' | 'maxQuantity'>, max = 6): number[] {
  const kind = KINDS[serviceKind(s.slug)];
  const lo = s.minQuantity;
  const hi = s.maxQuantity ?? Number.POSITIVE_INFINITY;
  const inRange = kind.quantities.filter(q => q >= lo && q <= hi);
  if (!inRange.length) return [lo];
  if (inRange.length <= max) return inRange;
  const picks = new Set<number>();
  for (let i = 0; i < max; i++) picks.add(inRange[Math.round((i * (inRange.length - 1)) / (max - 1))]);
  return [...picks].sort((a, b) => a - b);
}

// ─── Vocabulary ──────────────────────────────────────────────────────────────

const SOCIAL: CategoryKey[] = ['instagram', 'telegram', 'youtube', 'tiktok', 'rubika', 'aparat', 'bale', 'eitaa'];
export function isSocialCategory(category: string) {
  return (SOCIAL as string[]).includes(category);
}

/** «پیج» on Instagram, «کانال» on Telegram/Bale/Eitaa/YouTube… — what the customer calls their account. */
function accountNoun(category: string): string {
  switch (category) {
    case 'instagram': case 'tiktok': return 'پیج';
    case 'telegram': case 'bale': case 'eitaa': return 'کانال یا گروه';
    case 'rubika': return 'کانال یا پیج';
    default: return 'کانال';
  }
}

/** Purchase verb by kind: «خرید فالوور…», «خرید اشتراک ChatGPT Plus», «سفارش تولید محتوا…». */
export function purchasePhrase(s: Pick<SeoService, 'slug' | 'name'>): string {
  const kind = serviceKind(s.slug);
  if (kind === 'months') return `خرید اشتراک ${s.name}`;
  if (kind === 'content' || kind === 'posts' || kind === 'other') return `سفارش ${s.name}`;
  return `خرید ${s.name}`;
}

/** Plain-language «what is it» sentence per kind (no outcome promises). */
const KIND_WHAT: Record<ServiceKind, (platform: string, category: string) => string> = {
  followers: (p, c) => `فالوور تعداد دنبال‌کننده‌های ${accountNoun(c)} ${p} را بالا می‌برد؛ عددی که مخاطب تازه پیش از دنبال‌کردن یا خرید، اول از همه می‌بیند.`,
  members: (p, c) => `ممبر تعداد اعضای ${accountNoun(c)} ${p} را بالا می‌برد؛ اولین عددی که بازدیدکننده برای اعتماد به یک کانال نگاه می‌کند.`,
  subscribers: p => `سابسکرایبر تعداد دنبال‌کننده‌های کانال ${p} را بالا می‌برد و کانال تازه را از صفر بودن بیرون می‌آورد.`,
  likes: p => `لایک نشان می‌دهد پست یا ویدیو دیده و پسندیده شده است؛ برای محتوای تازه‌ی ${p}، تعامل اولیه می‌سازد.`,
  views: p => `بازدید (ویو) تعداد دفعات دیده‌شدن ویدیو یا پست ${p} را بالا می‌برد و آمار شروع بهتری برای محتوای تازه می‌سازد.`,
  reach: p => `ریچ و ایمپرشن تعداد دفعات نمایش پست ${p} را بالا می‌برد.`,
  comments: p => `کامنت زیر پست یا ویدیو ${p} گفت‌وگو می‌سازد و محتوا را زنده‌تر نشان می‌دهد.`,
  shares: p => `اشتراک‌گذاری (Share) یعنی پست یا ویدیو ${p} برای دیگران فرستاده شده است؛ از نشانه‌های محتوای دیدنی.`,
  saves: p => `سیو (Save) یعنی مخاطب پست یا ویدیو ${p} را برای بعد ذخیره کرده است؛ از نشانه‌های محتوای کاربردی.`,
  reactions: p => `ری‌اکشن واکنش سریع مخاطب به پست‌های کانال ${p} است و پست را پرتعامل‌تر نشان می‌دهد.`,
  votes: p => `رأی نظرسنجی برای گزینه‌ی دلخواه شما در نظرسنجی کانال ${p} ثبت می‌شود.`,
  starts: p => `استارت ربات تعداد کاربرانی را بالا می‌برد که ربات ${p} شما را شروع کرده‌اند.`,
  watch: p => `ساعت تماشا مجموع زمانی است که ویدیوهای کانال ${p} تماشا شده‌اند.`,
  months: () => 'اشتراک ماهانه روی حساب شخصی خودتان (با ایمیل خودتان) فعال می‌شود و پرداخت آن تومانی است.',
  content: () => 'محتوا با هوش مصنوعی و بر اساس موضوعی که شما می‌دهید آماده می‌شود.',
  posts: () => 'پست‌ها در زمان‌بندی شما و به‌صورت خودکار در کانال یا صفحه‌ی مقصد منتشر می‌شوند.',
  other: () => 'این سرویس با قیمت مشخص و ثبت آنلاین سفارش ارائه می‌شود.',
};

/** Search synonyms used in intros and H2s (from the keyword map). */
const KIND_SYNONYM: Partial<Record<ServiceKind, string>> = {
  followers: 'افزایش فالوور', members: 'افزایش ممبر', subscribers: 'افزایش سابسکرایبر', likes: 'افزایش لایک',
  views: 'افزایش بازدید', comments: 'افزایش کامنت', reach: 'افزایش ریچ', reactions: 'افزایش ری‌اکشن',
  shares: 'افزایش اشتراک‌گذاری', saves: 'افزایش سیو', starts: 'افزایش استارت ربات', votes: 'افزایش رأی نظرسنجی',
  watch: 'افزایش ساعت تماشا',
};

// ─── Category pages ──────────────────────────────────────────────────────────

export type CategoryCopy = { title: string; h1: string; description: string; intro: string[]; keywords: string[] };

const CATEGORY_COPY: Partial<Record<CategoryKey, Omit<CategoryCopy, 'description'> & { description: string }>> = {
  instagram: {
    title: 'خرید فالوور، لایک و بازدید اینستاگرام',
    h1: 'خرید فالوور و خدمات اینستاگرام',
    description: 'خرید فالوور اینستاگرام، لایک، بازدید ریلز و استوری، کامنت، سیو، شیر و ریچ با قیمت روز؛ قیمت هر بسته پیش از پرداخت مشخص است و وضعیت سفارش را لحظه‌ای پیگیری می‌کنید.',
    intro: [
      'همه‌ی خدمات رشد اینستاگرام در زُحل پی یک‌جا هستند: خرید فالوور برای پیج، لایک و بازدید ریلز، بازدید استوری و لایو، کامنت، سیو، اشتراک‌گذاری و ریچ پست.',
      'برای هر سرویس فقط نام کاربری یا لینک پست را وارد می‌کنید؛ رمز عبور اینستاگرام هیچ‌وقت لازم نیست.',
    ],
    keywords: ['خرید فالوور اینستاگرام', 'افزایش فالوور اینستاگرام', 'خرید لایک اینستاگرام', 'خرید بازدید ریلز', 'خرید ویو اینستاگرام', 'خدمات اینستاگرام'],
  },
  telegram: {
    title: 'خرید ممبر تلگرام، بازدید پست و ری‌اکشن',
    h1: 'خرید ممبر کانال تلگرام و خدمات تلگرام',
    description: 'خرید ممبر کانال و گروه تلگرام، بازدید (سین) پست، ری‌اکشن، رأی نظرسنجی و استارت ربات با قیمت روز؛ ثبت سفارش آنلاین با لینک کانال و پیگیری لحظه‌ای وضعیت.',
    intro: [
      'برای رشد کانال یا گروه تلگرام، در زُحل پی ممبر، بازدید پست (سین)، ری‌اکشن، رأی نظرسنجی و استارت ربات را با قیمت مشخص سفارش می‌دهید.',
      'لینک کانال، پست یا ربات کافی است؛ لازم نیست کسی را ادمین کنید یا به حساب تلگرامتان دسترسی بدهید.',
    ],
    keywords: ['خرید ممبر تلگرام', 'افزایش ممبر کانال تلگرام', 'خرید سین تلگرام', 'خرید بازدید پست تلگرام', 'خرید ری‌اکشن تلگرام'],
  },
  youtube: {
    title: 'خرید سابسکرایبر، بازدید و لایک یوتیوب',
    h1: 'خرید سابسکرایبر و بازدید یوتیوب',
    description: 'خرید سابسکرایبر یوتیوب، بازدید ویدیو و شورتز، لایک، کامنت و ساعت تماشا با قیمت روز؛ فقط لینک کانال یا ویدیو را وارد کنید و سفارش را لحظه‌ای پیگیری کنید.',
    intro: [
      'خدمات یوتیوب زُحل پی برای کانال‌هایی است که می‌خواهند زودتر دیده شوند: افزایش سابسکرایبر، بازدید ویدیو و Shorts، لایک، کامنت و ساعت تماشا.',
      'قیمت هر سرویس بر اساس تعداد محاسبه می‌شود و پیش از پرداخت دقیق نمایش داده می‌شود.',
    ],
    keywords: ['خرید سابسکرایبر یوتیوب', 'خرید سابسکرایب یوتیوب', 'خرید بازدید یوتیوب', 'خرید ویو یوتیوب', 'خرید ساعت تماشا یوتیوب'],
  },
  tiktok: {
    title: 'خرید فالوور، لایک و بازدید تیک‌تاک',
    h1: 'خرید فالوور و خدمات تیک‌تاک',
    description: 'خرید فالوور تیک‌تاک، لایک، بازدید، کامنت، اشتراک‌گذاری و سیو ویدیو با قیمت روز؛ ثبت سفارش با نام کاربری یا لینک ویدیو و پیگیری لحظه‌ای در زُحل پی.',
    intro: [
      'در زُحل پی فالوور، لایک، بازدید، کامنت، اشتراک‌گذاری و سیو تیک‌تاک را با قیمت شفاف سفارش می‌دهید.',
      'برای فالوور نام کاربری و برای بقیه‌ی خدمات لینک ویدیو کافی است؛ رمز عبور تیک‌تاک لازم نیست.',
    ],
    keywords: ['خرید فالوور تیک تاک', 'خرید لایک تیک تاک', 'خرید بازدید تیک تاک', 'افزایش فالوور تیک تاک'],
  },
  rubika: {
    title: 'خرید ممبر و فالوور روبیکا',
    h1: 'خرید ممبر کانال و فالوور روبیکا',
    description: 'خرید ممبر کانال روبیکا، فالوور پیج، لایک و بازدید پست روبیکا با قیمت روز؛ سفارش آنلاین با لینک کانال یا نام کاربری و پیگیری لحظه‌ای.',
    intro: [
      'خدمات روبیکا در زُحل پی شامل ممبر کانال، فالوور پیج، لایک و بازدید پست است.',
      'لینک کانال یا نام کاربری پیج را وارد می‌کنید، قیمت کل را می‌بینید و از کیف پول پرداخت می‌کنید.',
    ],
    keywords: ['خرید ممبر روبیکا', 'خرید فالوور روبیکا', 'افزایش ممبر کانال روبیکا', 'خرید بازدید روبیکا'],
  },
  aparat: {
    title: 'خرید دنبال‌کننده، بازدید و لایک آپارات',
    h1: 'خرید دنبال‌کننده و بازدید آپارات',
    description: 'خرید دنبال‌کننده کانال آپارات، بازدید ویدیو و لایک با قیمت روز؛ ثبت سفارش با نام کاربری یا لینک ویدیو و پیگیری لحظه‌ای در زُحل پی.',
    intro: [
      'برای کانال آپارات، در زُحل پی دنبال‌کننده، بازدید ویدیو و لایک را با قیمت مشخص سفارش می‌دهید.',
      'نام کاربری کانال یا لینک ویدیو کافی است؛ به رمز عبور حساب آپارات نیازی نیست.',
    ],
    keywords: ['خرید دنبال کننده آپارات', 'خرید فالوور آپارات', 'خرید بازدید آپارات', 'افزایش بازدید آپارات'],
  },
  bale: {
    title: 'خرید ممبر کانال بله و بازدید پست',
    h1: 'خرید ممبر کانال بله',
    description: 'خرید ممبر کانال پیام‌رسان بله و بازدید پست با قیمت روز؛ ثبت سفارش با لینک کانال یا پست و پیگیری لحظه‌ای وضعیت در زُحل پی.',
    intro: [
      'در زُحل پی برای کانال‌های پیام‌رسان بله ممبر و بازدید پست سفارش می‌دهید.',
      'لینک کانال یا پست را وارد می‌کنید و قیمت کل پیش از پرداخت نمایش داده می‌شود.',
    ],
    keywords: ['خرید ممبر بله', 'افزایش ممبر کانال بله', 'خرید بازدید بله'],
  },
  eitaa: {
    title: 'خرید ممبر کانال ایتا و بازدید پست',
    h1: 'خرید ممبر کانال ایتا',
    description: 'خرید ممبر کانال ایتا و بازدید پست با قیمت روز؛ ثبت سفارش با لینک کانال یا پست و پیگیری لحظه‌ای وضعیت در زُحل پی.',
    intro: [
      'در زُحل پی برای کانال‌های ایتا ممبر و بازدید پست سفارش می‌دهید.',
      'لینک کانال یا پست را وارد می‌کنید و قیمت کل پیش از پرداخت نمایش داده می‌شود.',
    ],
    keywords: ['خرید ممبر ایتا', 'افزایش ممبر کانال ایتا', 'خرید بازدید ایتا'],
  },
  'ai-subscriptions': {
    title: 'خرید اشتراک ChatGPT Plus، Claude، Gemini و Midjourney',
    h1: 'خرید اشتراک هوش مصنوعی با پرداخت تومانی',
    description: 'خرید اشتراک ChatGPT Plus و Pro، Claude Pro و Max، Gemini، SuperGrok، Perplexity، Midjourney، Cursor، GitHub Copilot، ElevenLabs و Suno با پرداخت تومانی؛ فعال‌سازی روی ایمیل حساب خودتان.',
    intro: [
      'پرداخت دلاری برای ابزارهای هوش مصنوعی از ایران ساده نیست. در زُحل پی اشتراک ChatGPT، Claude، Gemini، Grok، Perplexity، Midjourney و ابزارهای برنامه‌نویسی و صدا را با قیمت تومانی می‌خرید.',
      'اشتراک روی حساب شخصی خودتان و با ایمیل خودتان فعال می‌شود؛ فقط ایمیل حساب را وارد می‌کنید.',
    ],
    keywords: ['خرید اشتراک چت جی پی تی', 'خرید ChatGPT Plus', 'خرید اکانت Claude', 'خرید اشتراک Gemini', 'خرید اشتراک Midjourney', 'خرید اشتراک هوش مصنوعی'],
  },
  ai: {
    title: 'سفارش تولید محتوا با هوش مصنوعی',
    h1: 'تولید محتوا با هوش مصنوعی',
    description: 'سفارش تولید محتوای شبکه‌های اجتماعی با هوش مصنوعی در زُحل پی؛ موضوع را می‌دهید، قیمت هر محتوا را از پیش می‌بینید و وضعیت سفارش را پیگیری می‌کنید.',
    intro: [
      'برای کپشن، پست و متن شبکه‌های اجتماعی، در زُحل پی تولید محتوا با هوش مصنوعی را سفارش می‌دهید.',
      'موضوع محتوا را می‌نویسید و قیمت هر محتوا پیش از پرداخت مشخص است.',
    ],
    keywords: ['تولید محتوا با هوش مصنوعی', 'تولید محتوا با AI', 'نوشتن کپشن با هوش مصنوعی'],
  },
  automation: {
    title: 'اتوماسیون انتشار پست در شبکه‌های اجتماعی',
    h1: 'اتوماسیون و انتشار خودکار پست',
    description: 'زمان‌بندی و انتشار خودکار پست در کانال‌ها و صفحه‌های شبکه‌های اجتماعی با زُحل پی؛ قیمت هر پست از پیش مشخص است.',
    intro: [
      'با اتوماسیون زُحل پی، پست‌ها در زمان‌بندی شما و به‌صورت خودکار در کانال یا صفحه‌ی مقصد منتشر می‌شوند.',
    ],
    keywords: ['انتشار خودکار پست', 'زمان بندی پست تلگرام', 'اتوماسیون شبکه های اجتماعی'],
  },
  design: {
    title: 'سفارش طراحی و گرافیک',
    h1: 'طراحی و گرافیک',
    description: 'سفارش طراحی گرافیک برای شبکه‌های اجتماعی در زُحل پی.',
    intro: ['خدمات طراحی و گرافیک زُحل پی برای پست، استوری و هویت بصری شبکه‌های اجتماعی است.'],
    keywords: ['سفارش طراحی پست اینستاگرام', 'طراحی گرافیک'],
  },
};

export function categoryCopy(category: string): CategoryCopy | undefined {
  const meta = categoryMeta(category);
  if (!meta) return undefined;
  const c = CATEGORY_COPY[meta.key];
  if (c) return c;
  return {
    title: `خرید خدمات ${meta.name}`,
    h1: meta.title ?? `خدمات ${meta.name}`,
    description: `خرید خدمات ${meta.name} در زُحل پی با قیمت شفاف، ثبت آنلاین سفارش و پیگیری لحظه‌ای وضعیت.`,
    intro: [`خدمات ${meta.name} در زُحل پی با قیمت مشخص و ثبت آنلاین سفارش ارائه می‌شود.`],
    keywords: [`خرید خدمات ${meta.name}`],
  };
}

export function supportFaq(hours: string): Faq {
  return {
    q: 'اگر سؤال یا مشکلی داشتم با چه کسی صحبت کنم؟',
    a: `از بخش پشتیبانی در حساب کاربری تیکت ثبت کنید؛ پاسخ و پیگیری در همان تیکت انجام می‌شود. ساعات پاسخ‌گویی: ${hours}.`,
  };
}

const PAY_FAQ: Faq = {
  q: 'پرداخت چطور انجام می‌شود؟',
  a: 'پرداخت آنلاین است و مبلغ سفارش از موجودی کیف پول زُحل پی کسر می‌شود. هر وقت لازم باشد کیف پول را شارژ می‌کنید و همه‌ی تراکنش‌ها در بخش کیف پول ثبت می‌شوند.',
};

const TRACK_FAQ: Faq = {
  q: 'وضعیت سفارش را کجا ببینم؟',
  a: 'در بخش «سفارش‌ها» در حساب کاربری. هر سفارش مرحله‌ی فعلی خود را نشان می‌دهد: پرداخت‌شده، در صف انجام، ارسال‌شده، در حال انجام و تکمیل‌شده.',
};

const FAIL_FAQ: Faq = {
  q: 'اگر سفارش انجام نشود چه می‌شود؟',
  a: 'اگر سفارشی ناموفق یا لغو شود، وضعیت آن و روند بازگشت وجه در صفحه‌ی همان سفارش نمایش داده می‌شود و از طریق تیکت پشتیبانی هم پیگیری می‌شود.',
};

/** 6–8 questions for a category page, answered with that category's live numbers. */
export function categoryFaq(category: string, services: SeoService[], supportHours: string): Faq[] {
  const meta = categoryMeta(category);
  if (!meta) return [];
  const p = meta.name;
  const out: Faq[] = [];
  const social = isSocialCategory(category);
  out.push({
    q: `چطور از زُحل پی خدمات ${p} بخرم؟`,
    a: `سرویس موردنظر را انتخاب کنید، تعداد را مشخص کنید و ${social ? 'نام کاربری یا لینک' : category === 'ai-subscriptions' ? 'ایمیل حساب' : 'اطلاعات خواسته‌شده'} را وارد کنید. قیمت کل پیش از پرداخت نمایش داده می‌شود و پس از پرداخت، سفارش خودکار در صف انجام قرار می‌گیرد.`,
  });
  out.push({
    q: `قیمت خدمات ${p} چطور محاسبه می‌شود؟`,
    a: 'مبلغ هر سفارش دقیقاً «تعداد × قیمت واحد» است؛ بدون هزینه‌ی پنهان. قیمت هر سرویس در جدول همین صفحه آمده و در لحظه‌ی ثبت سفارش ثابت می‌شود.',
  });
  const priced = services.map(s => ({ s, lp: listPrice(s) }));
  if (priced.length) {
    if (category === 'ai-subscriptions') {
      const cheapest = priced.reduce((a, b) => (b.lp.toman < a.lp.toman ? b : a));
      out.push({ q: 'ارزان‌ترین اشتراک هوش مصنوعی کدام است؟', a: `در حال حاضر ${cheapest.s.name} با ${cheapest.lp.text} تومان در ماه. قیمت همه‌ی اشتراک‌ها در جدول همین صفحه آمده است.` });
    } else {
      const lines = priced.slice(0, 4).map(x => `${x.s.name}: ${x.lp.perLabel} ${x.lp.text} تومان`).join('؛ ');
      out.push({ q: `قیمت پرطرفدارترین خدمات ${p} چقدر است؟`, a: `${lines}. فهرست کامل در جدول قیمت همین صفحه است.` });
    }
  }
  if (social) {
    out.push({ q: 'رمز عبور حسابم لازم است؟', a: `نه. برای خدمات ${p} فقط نام کاربری یا لینک لازم است و رمز عبور حساب‌تان را هیچ‌وقت نمی‌خواهیم.` });
    out.push({ q: `آیا ${accountNoun(category)} باید عمومی باشد؟`, a: `بله. تا پایان انجام سفارش، ${accountNoun(category)} یا پست باید عمومی (Public) بماند و نام کاربری یا لینک آن تغییر نکند؛ در غیر این صورت ممکن است سفارش کامل انجام نشود.` });
  } else if (category === 'ai-subscriptions') {
    out.push({ q: 'اشتراک روی چه حسابی فعال می‌شود؟', a: 'روی حساب شخصی خودتان با ایمیلی که هنگام سفارش وارد می‌کنید. ایمیل را دقیق وارد کنید.' });
    out.push({ q: 'اشتراک چند ماهه هم دارید؟', a: 'بله؛ اشتراک‌ها ماهانه قیمت‌گذاری شده‌اند و می‌توانید ۱، ۳، ۶ یا ۱۲ ماه سفارش دهید. مبلغ کل پیش از پرداخت نمایش داده می‌شود.' });
  }
  out.push(PAY_FAQ, TRACK_FAQ);
  out.push(supportFaq(supportHours));
  return out.slice(0, 8);
}

// ─── Service pages ───────────────────────────────────────────────────────────

export type ServiceCopy = {
  title: string;
  h1: string;
  description: string;
  intro: string[];
  facts: Array<{ k: string; v: string }>;
  faq: Faq[];
  steps: Array<{ t: string; d: string }>;
  keywords: string[];
};

export function serviceCopy(s: SeoService, supportHours: string): ServiceCopy {
  const meta = categoryMeta(s.category);
  const platform = meta?.name ?? '';
  const lp = listPrice(s);
  const kind = KINDS[lp.kind];
  const target = targetField(s.category, lp.kind, s.slug);
  const phrase = purchasePhrase(s);
  const min = formatQuantityWords(s.minQuantity);
  const max = s.maxQuantity ? formatQuantityWords(s.maxQuantity) : null;
  const unit = kind.unit;
  const isMonths = lp.kind === 'months';
  const social = isSocialCategory(s.category);
  const synonym = KIND_SYNONYM[lp.kind];

  const title = isMonths ? `${phrase} با پرداخت تومانی` : `${phrase} | قیمت ${lp.perLabel}`;
  const description = isMonths
    ? `${phrase} با قیمت ${lp.text} تومان در ماه؛ فعال‌سازی روی ایمیل حساب خودتان، پرداخت تومانی از کیف پول و پیگیری لحظه‌ای سفارش در زُحل پی.`
    : `${phrase} با قیمت ${lp.perLabel} ${lp.text} تومان؛ سفارش از ${min}${max ? ` تا ${max}` : ''} ${unit}، قیمت کل پیش از پرداخت و پیگیری لحظه‌ای وضعیت در زُحل پی.`;

  const intro: string[] = [
    isMonths
      ? `${phrase} در زُحل پی: هر ماه ${lp.text} تومان. ${KIND_WHAT.months(platform, s.category)}`
      : `${phrase} در زُحل پی با قیمت ${lp.perLabel} ${lp.text} تومان${synonym ? ` — ساده‌ترین راه ${synonym} ${platform}` : ''}. ${KIND_WHAT[lp.kind](platform, s.category)}`,
  ];
  if (s.description) intro.push(s.description);
  intro.push(
    isMonths
      ? 'فقط ایمیل حسابی را وارد می‌کنید که اشتراک باید روی آن فعال شود؛ مبلغ کل پیش از پرداخت نمایش داده می‌شود.'
      : `برای سفارش فقط «${target.label}» را وارد می‌کنید${social ? ' و رمز عبور حساب لازم نیست' : ''}. مبلغ کل پیش از پرداخت نمایش داده می‌شود.`,
  );

  const facts: Array<{ k: string; v: string }> = [
    { k: 'ارائه‌دهنده', v: 'زُحل پی (ZOHALPAY)' },
    { k: 'قیمت', v: isMonths ? `${lp.text} تومان در ماه` : `${lp.perLabel}: ${lp.text} تومان` },
    { k: isMonths ? 'مدت' : 'حداقل سفارش', v: isMonths ? `۱ تا ${fa(s.maxQuantity ?? 12)} ماه` : `${min} ${unit}` },
  ];
  if (!isMonths && max) facts.push({ k: 'حداکثر سفارش', v: `${max} ${unit}` });
  facts.push(
    { k: 'اطلاعات لازم', v: target.label },
    { k: 'پرداخت', v: 'آنلاین، از کیف پول زُحل پی' },
    { k: 'پیگیری', v: 'مرحله‌به‌مرحله در بخش سفارش‌ها' },
  );

  const steps = [
    { t: isMonths ? 'مدت را انتخاب کنید' : 'تعداد را انتخاب کنید', d: isMonths ? '۱، ۳، ۶ یا ۱۲ ماه؛ مبلغ کل همان لحظه نمایش داده می‌شود.' : `از ${min}${max ? ` تا ${max}` : ''} ${unit}؛ مبلغ کل همان لحظه نمایش داده می‌شود.` },
    { t: `${target.label} را وارد کنید`, d: social ? 'رمز عبور لازم نیست؛ فقط لینک یا نام کاربری.' : isMonths ? 'اشتراک روی همین ایمیل فعال می‌شود.' : 'هر چه دقیق‌تر، نتیجه بهتر.' },
    { t: 'پرداخت از کیف پول', d: 'مبلغ از موجودی کسر و سفارش ثبت می‌شود.' },
    { t: 'پیگیری وضعیت', d: 'مرحله‌ی سفارش را در بخش «سفارش‌ها» می‌بینید.' },
  ];

  const faq: Faq[] = [
    {
      q: `قیمت ${s.name} چقدر است؟`,
      a: isMonths
        ? `در حال حاضر ${lp.text} تومان برای هر ماه. مبلغ کل سفارش «تعداد ماه × قیمت ماهانه» است و پیش از پرداخت نمایش داده می‌شود.`
        : `در حال حاضر ${lp.perLabel} ${lp.text} تومان. مبلغ هر سفارش دقیقاً «تعداد × قیمت واحد» است، پیش از پرداخت نمایش داده می‌شود و در لحظه‌ی ثبت سفارش ثابت می‌شود.`,
    },
    isMonths
      ? { q: 'اشتراک روی چه حسابی فعال می‌شود؟', a: 'روی حساب شخصی خودتان با ایمیلی که هنگام سفارش وارد می‌کنید؛ ایمیل را دقیق وارد کنید.' }
      : { q: 'حداقل و حداکثر تعداد سفارش چقدر است؟', a: `هر سفارش از ${min}${max ? ` تا ${max}` : ''} ${unit} است. برای تعداد بیشتر، سفارش دیگری ثبت کنید.` },
    {
      q: 'برای سفارش چه اطلاعاتی لازم است؟',
      a: isMonths
        ? 'فقط ایمیل حسابی که اشتراک باید روی آن فعال شود.'
        : `فقط «${target.label}».${social ? ' رمز عبور حساب‌تان را هیچ‌وقت نمی‌خواهیم.' : ''}`,
    },
  ];
  if (social) {
    faq.push({ q: `آیا ${accountNoun(s.category)} باید عمومی باشد؟`, a: `بله. تا پایان انجام سفارش، ${accountNoun(s.category)} یا پست باید عمومی (Public) بماند و نام کاربری یا لینک آن تغییر نکند؛ در غیر این صورت ممکن است سفارش کامل انجام نشود.` });
    faq.push({ q: 'برای چند پیج یا پست می‌توانم سفارش بدهم؟', a: 'هر سفارش برای یک لینک یا نام کاربری است؛ برای هر مورد، سفارش جداگانه ثبت کنید.' });
  } else if (isMonths) {
    faq.push({ q: 'اشتراک چند ماهه هم دارید؟', a: `بله؛ ۱، ۳، ۶ یا ۱۲ ماه (حداکثر ${fa(s.maxQuantity ?? 12)} ماه در هر سفارش).` });
  }
  faq.push(PAY_FAQ, TRACK_FAQ, FAIL_FAQ);
  if (faq.length < 8) faq.push(supportFaq(supportHours));

  const keywords = [phrase, synonym ? `${synonym} ${platform}` : '', `قیمت ${s.name}`].filter(Boolean);
  return { title, h1: phrase, description, intro, facts, faq: faq.slice(0, 8), steps, keywords };
}

// ─── Listing helpers ─────────────────────────────────────────────────────────

export function servicesIn(catalog: SeoService[], category: string): SeoService[] {
  return sortServices(catalog.filter(s => s.category === category));
}

/** Other services in the same category, then the same kind on other platforms (internal links). */
export function relatedServices(catalog: SeoService[], s: SeoService, max = 8): SeoService[] {
  const kind = serviceKind(s.slug);
  const same = servicesIn(catalog, s.category).filter(x => x.slug !== s.slug);
  const cross = catalog.filter(x => x.category !== s.category && serviceKind(x.slug) === kind);
  const out: SeoService[] = [];
  for (const x of [...same.slice(0, 5), ...cross, ...same.slice(5)]) {
    if (out.length >= max) break;
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

/** Categories in home-grid order that have at least one priced service. */
export function liveCategories(catalog: SeoService[]) {
  const live = new Set(catalog.map(s => s.category));
  return CATEGORIES.filter(c => live.has(c.key));
}

/** Cheapest list price in a category (for «از … تومان» on cards). */
export function fromPrice(catalog: SeoService[], category: string): ListPrice | null {
  const items = catalog.filter(s => s.category === category);
  if (!items.length) return null;
  return items.map(listPrice).reduce((a, b) => (b.toman < a.toman ? b : a));
}
