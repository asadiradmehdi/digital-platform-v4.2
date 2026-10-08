import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/seo/site';
import { AI_CRAWLERS, robotsDisallowList } from '../lib/seo/routes';

// Public catalogue, landing and info pages are open to search engines and AI answer engines alike;
// account, money, session and API paths are closed to every crawler (they also send X-Robots-Tag: noindex).
export default function robots(): MetadataRoute.Robots {
  const disallow = robotsDisallowList();
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      { userAgent: [...AI_CRAWLERS], allow: '/', disallow },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
