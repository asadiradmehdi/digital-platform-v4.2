export const siteConfig = {
  name: 'پلتفرم دیجیتال',
  shortName: 'پلتفرم',
  description: 'پلتفرم یکپارچه خدمات دیجیتال، هوش مصنوعی، اتوماسیون و ابزارهای رشد برای افراد، برندها و کسب‌وکارها.',
  locale: 'fa_IR',
  language: 'fa',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  keywords: ['خدمات دیجیتال','هوش مصنوعی','اتوماسیون','خدمات شبکه های اجتماعی','AI','AI agents','automation','digital services'],
} as const;

export function absoluteUrl(path = '/') {
  return new URL(path, siteConfig.siteUrl).toString();
}

export function metadataForPage(input: { title: string; description: string; path: string; noIndex?: boolean }) {
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    robots: input.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: 'website' as const, title: input.title, description: input.description, url: absoluteUrl(input.path), locale: siteConfig.locale, siteName: siteConfig.name },
  };
}
