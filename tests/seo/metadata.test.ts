import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG } from './fixtures';

vi.mock('../../server/seo/public-catalog', () => ({ getPublicCatalog: vi.fn(async () => CATALOG) }));

import { metadataForPage, normalizeSiteUrl } from '../../lib/seo/site';

type Meta = Record<string, any>;

describe('page metadata', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalises the site origin', () => {
    expect(normalizeSiteUrl('https://zohalpay.com/')).toBe('https://zohalpay.com');
    expect(normalizeSiteUrl('ftp://x')).toBe('http://localhost:3000');
    expect(normalizeSiteUrl(undefined)).toBe('http://localhost:3000');
  });

  it('gives each public page a self-canonical, OG image and Twitter card', () => {
    const m = metadataForPage({ title: 'ت', description: 'د', path: '/services/instagram' }) as Meta;
    expect(m.alternates.canonical).toBe('/services/instagram');
    expect(m.robots.index).toBe(true);
    expect(m.openGraph.images[0]).toMatchObject({ width: 1200, height: 630 });
    expect(m.openGraph.locale).toBe('fa_IR');
    expect(m.twitter.card).toBe('summary_large_image');
    expect((metadataForPage({ title: 'ت', description: 'د', path: '/x', noIndex: true }) as Meta).robots).toEqual({ index: false, follow: false });
  });

  it('the root layout has no inherited canonical and the home page has its own', async () => {
    const layout = (await import('../../app/layout')).metadata as Meta;
    expect(layout.alternates).toBeUndefined();
    expect(String(layout.metadataBase)).toBe('http://localhost:3000/');
    const home = (await import('../../app/page')).metadata as Meta;
    expect(home.title).toEqual({ absolute: 'زُحل پی | خرید فالوور، ممبر و اشتراک هوش مصنوعی' });
    expect(home.alternates.canonical).toBe('/');
  });

  it('category pages: unique keyword title, category OG image, noindex while empty', async () => {
    const { generateMetadata } = await import('../../app/services/[category]/page');
    const ig = (await generateMetadata({ params: Promise.resolve({ category: 'instagram' }) })) as Meta;
    expect(ig.title).toBe('خرید فالوور، لایک و بازدید اینستاگرام');
    expect(ig.alternates.canonical).toBe('/services/instagram');
    expect(ig.openGraph.images[0].url).toBe('/og/instagram.jpg');
    expect(ig.robots.index).toBe(true);
    const design = (await generateMetadata({ params: Promise.resolve({ category: 'design' }) })) as Meta;
    expect(design.robots).toEqual({ index: false, follow: false });
    const bogus = (await generateMetadata({ params: Promise.resolve({ category: 'social' }) })) as Meta;
    expect(bogus.robots).toEqual({ index: false, follow: false });
  });

  it('service pages: price in the description, canonical on the readable URL', async () => {
    const { generateMetadata } = await import('../../app/services/[category]/[slug]/page');
    const m = (await generateMetadata({ params: Promise.resolve({ category: 'instagram', slug: 'followers' }) })) as Meta;
    expect(m.title).toBe('خرید فالوور اینستاگرام | قیمت هر ۱ هزار فالوور');
    expect(m.description).toContain('۱۸۰٬۰۰۰ تومان');
    expect(m.alternates.canonical).toBe('/services/instagram/followers');
    const missing = (await generateMetadata({ params: Promise.resolve({ category: 'telegram', slug: 'followers' }) })) as Meta;
    expect(missing.robots.index).toBe(false);
  });

  it('about and catalogue pages are indexable with their own canonicals', async () => {
    const about = (await import('../../app/about/page')).metadata as Meta;
    expect(about.alternates.canonical).toBe('/about');
    const services = (await import('../../app/services/page')).metadata as Meta;
    expect(services.alternates.canonical).toBe('/services');
    expect(services.robots.index).toBe(true);
  });
});
