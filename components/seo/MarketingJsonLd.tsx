import { JsonLd } from './JsonLd';
import { absoluteUrl, siteConfig } from '../../lib/seo/site';

export function MarketingJsonLd() {
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${absoluteUrl('/')}#organization`,
      name: siteConfig.name,
      url: absoluteUrl('/'),
      description: siteConfig.description,
    },
    {
      '@type': 'WebSite',
      '@id': `${absoluteUrl('/')}#website`,
      url: absoluteUrl('/'),
      name: siteConfig.name,
      inLanguage: siteConfig.language,
      publisher: { '@id': `${absoluteUrl('/')}#organization` },
    },
  ];

  return <JsonLd data={{ '@context': 'https://schema.org', '@graph': graph }} />;
}
