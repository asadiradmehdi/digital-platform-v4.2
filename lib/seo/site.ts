// Site-wide SEO identity. One spelling of the brand everywhere (pages, JSON-LD, llms.txt, OG images):
// Persian «زُحل پی», Latin «ZOHALPAY». Search engines and LLMs build the entity from this consistency.
import type { Metadata } from 'next';

/** Absolute origin without a trailing slash. Production sets NEXT_PUBLIC_SITE_URL (e.g. https://zohalpay.com). */
export function normalizeSiteUrl(raw: string | undefined): string {
  const fallback = 'http://localhost:3000';
  if (!raw) return fallback;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return fallback;
    return u.origin;
  } catch {
    return fallback;
  }
}

export const siteConfig = {
  /** Display name (Persian). */
  name: 'زُحل پی',
  /** Latin brand name, used next to the Persian one and as the OG site name suffix. */
  nameEn: 'ZOHALPAY',
  /** Spellings people actually type; declared as `alternateName` so they resolve to one entity. */
  alternateNames: ['ZOHALPAY', 'Zohal Pay', 'ZohalPay', 'زحل پی', 'زحل‌پی', 'زُحل‌پی'],
  description:
    'زُحل پی (ZOHALPAY) فروشگاه آنلاین خدمات رشد شبکه‌های اجتماعی و اشتراک هوش مصنوعی است: خرید فالوور، لایک، بازدید و ممبر برای اینستاگرام، تلگرام، یوتیوب، تیک‌تاک، روبیکا، آپارات، بله و ایتا، و خرید اشتراک ChatGPT، Claude، Gemini و Midjourney با قیمت شفاف و پیگیری لحظه‌ای سفارش.',
  locale: 'fa_IR',
  language: 'fa',
  siteUrl: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  /** Default social image (1200×630), rendered by scripts/render-og-images.mjs. */
  ogImage: '/og/home.jpg',
  logo: '/brand/zohalpay-logo-512.png',
} as const;

export function absoluteUrl(path = '/') {
  return new URL(path, siteConfig.siteUrl).toString();
}

export type OgImage = { url: string; width: number; height: number; alt: string };

export function ogImage(path: string, alt: string): OgImage {
  return { url: path, width: 1200, height: 630, alt };
}

/**
 * Complete metadata for one public page: unique title/description, self-canonical, Open Graph + Twitter
 * with a branded image, and explicit robots. Every indexable page should go through this helper.
 */
export function metadataForPage(input: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  image?: OgImage;
  /** Use the title as-is (no « | زُحل پی» suffix) — for the home page. */
  absoluteTitle?: boolean;
  keywords?: string[];
}): Metadata {
  const image = input.image ?? ogImage(siteConfig.ogImage, `${siteConfig.name} — ${siteConfig.nameEn}`);
  const socialTitle = input.absoluteTitle ? input.title : `${input.title} | ${siteConfig.name}`;
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: { canonical: input.path },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    openGraph: {
      type: 'website',
      title: socialTitle,
      description: input.description,
      url: input.path,
      locale: siteConfig.locale,
      siteName: `${siteConfig.name} | ${siteConfig.nameEn}`,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: socialTitle, description: input.description, images: [image] },
  };
}
