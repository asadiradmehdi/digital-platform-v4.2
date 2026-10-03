import { JsonLd } from './JsonLd';
import { absoluteUrl, siteConfig } from '../../lib/seo/site';
import type { PublicEntity } from '../../content/marketing/catalog';

export function EntityJsonLd({ entity }: { entity: PublicEntity }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: entity.name,
        description: entity.description,
        url: absoluteUrl(entity.href),
        provider: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.siteUrl },
        audience: entity.audience.map((name) => ({ '@type': 'Audience', audienceType: name })),
        category: entity.category,
      }}
    />
  );
}
