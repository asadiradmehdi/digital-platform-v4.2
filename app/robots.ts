import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/seo/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/dashboard/', '/auth/', '/api/', '/workspace/'] },
      { userAgent: 'Googlebot', allow: '/', disallow: ['/dashboard/', '/auth/', '/api/', '/workspace/'] },
      { userAgent: 'Google-Extended', allow: '/' },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
