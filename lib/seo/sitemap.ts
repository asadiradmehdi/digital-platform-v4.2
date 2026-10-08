// Sitemap entries from the live public catalogue (pure; app/sitemap.ts feeds it the database).
import type { MetadataRoute } from 'next';
import { CATEGORIES } from '../catalog-ui';
import { absoluteUrl } from './site';
import { STATIC_PUBLIC_ROUTES } from './routes';
import { serviceHref, type SeoService } from './catalog-seo';

type Dated = SeoService & { updatedAt: string };

export function buildSitemap(catalog: Dated[], now = new Date()): MetadataRoute.Sitemap {
  const latest = (items: Dated[]) =>
    items.reduce<Date | undefined>((max, s) => {
      const d = new Date(s.updatedAt);
      return !max || d > max ? d : max;
    }, undefined) ?? now;

  const entries: MetadataRoute.Sitemap = STATIC_PUBLIC_ROUTES.map(r => ({
    url: absoluteUrl(r.path),
    lastModified: r.path === '/' || r.path === '/services' ? latest(catalog) : undefined,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  for (const c of CATEGORIES) {
    const items = catalog.filter(s => s.category === c.key);
    if (!items.length) continue; // «به‌زودی» categories are noindex until something is on sale
    entries.push({
      url: absoluteUrl(`/services/${c.key}`),
      lastModified: latest(items),
      changeFrequency: 'daily',
      priority: 0.9,
      images: [absoluteUrl(`/og/${c.key}.jpg`)],
    });
    for (const s of items) {
      entries.push({ url: absoluteUrl(serviceHref(s)), lastModified: new Date(s.updatedAt), changeFrequency: 'weekly', priority: 0.8 });
    }
  }
  return entries;
}
