import type { MetadataRoute } from 'next';
import { buildSitemap } from '../lib/seo/sitemap';
import { getPublicCatalog } from '../server/seo/public-catalog';

// Built from the live catalogue on each request: a new service or price change shows up immediately,
// with lastModified = the later of the service's own update and its active price's update.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(await getPublicCatalog());
}
