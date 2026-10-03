import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/seo/site';
import { publicEntities } from '../content/marketing/catalog';

const staticRoutes = ['/', '/services', '/ai', '/social', '/automation', '/pricing', '/blog', '/about', '/contact', '/faq', '/privacy', '/terms'];
const channelRoutes = ['instagram', 'telegram', 'tiktok', 'youtube', 'x'].map((x) => `/social/${x}`);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [...staticRoutes, ...channelRoutes, ...publicEntities.map((x) => x.href)];
  return [...new Set(routes)].map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : path.startsWith('/blog') ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path.startsWith('/services') || path.startsWith('/ai') || path.startsWith('/social') ? 0.8 : 0.6,
  }));
}
