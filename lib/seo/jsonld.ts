// schema.org JSON-LD builders. Pure data, unit-tested. Rules:
//  - One Organization/WebSite entity with stable @ids, referenced from everything else.
//  - Prices in IRR (ISO 4217): the catalogue stores toman, so IRR = toman × 10.
//  - No Review / AggregateRating: we have no verified review data, and fabricated ratings are spam.
import { BRAND_LOGOS, type BrandLogo } from '../../packages/design-tokens/src/brand-logos';
import { serviceBrand } from '../catalog-ui';
import { absoluteUrl, siteConfig } from './site';
import { listPrice, serviceHref, tomanToIrr, type Faq, type SeoService } from './catalog-seo';

type Ld = Record<string, unknown>;

export const ORG_ID = () => `${absoluteUrl('/')}#organization`;
export const WEBSITE_ID = () => `${absoluteUrl('/')}#website`;

export function organizationLd(opts: { phones?: Array<{ tel: string; label: string }> } = {}): Ld {
  const contactPoint: Ld[] = [
    { '@type': 'ContactPoint', contactType: 'customer support', url: absoluteUrl('/contact'), availableLanguage: ['fa', 'Persian'], areaServed: 'IR' },
    ...(opts.phones ?? []).map(p => ({ '@type': 'ContactPoint', contactType: 'customer support', telephone: p.tel, name: p.label, availableLanguage: ['fa'], areaServed: 'IR' })),
  ];
  return {
    '@type': 'Organization',
    '@id': ORG_ID(),
    name: siteConfig.name,
    alternateName: [...siteConfig.alternateNames],
    url: absoluteUrl('/'),
    logo: { '@type': 'ImageObject', url: absoluteUrl(siteConfig.logo), width: 512, height: 512 },
    image: absoluteUrl(siteConfig.ogImage),
    description: siteConfig.description,
    areaServed: { '@type': 'Country', name: 'Iran', alternateName: 'ایران' },
    knowsLanguage: ['fa'],
    contactPoint,
  };
}

export function websiteLd(): Ld {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID(),
    url: absoluteUrl('/'),
    name: siteConfig.name,
    alternateName: [...siteConfig.alternateNames],
    inLanguage: 'fa-IR',
    publisher: { '@id': ORG_ID() },
  };
}

export function breadcrumbLd(items: Array<{ name: string; path: string }>): Ld {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}

export function faqLd(faq: Faq[]): Ld {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

/** A page's own WebPage node (helps answer engines tie the page to the entity). */
export function webPageLd(input: { path: string; name: string; description: string; type?: 'WebPage' | 'CollectionPage' | 'AboutPage' | 'ItemPage' }): Ld {
  return {
    '@type': input.type ?? 'WebPage',
    '@id': `${absoluteUrl(input.path)}#webpage`,
    url: absoluteUrl(input.path),
    name: input.name,
    description: input.description,
    inLanguage: 'fa-IR',
    isPartOf: { '@id': WEBSITE_ID() },
    publisher: { '@id': ORG_ID() },
  };
}

function brandFor(slug: string): Ld {
  const b: BrandLogo | undefined = serviceBrand(slug);
  if (b) return { '@type': 'Brand', name: BRAND_LOGOS[b].label };
  return { '@type': 'Brand', name: siteConfig.name };
}

/**
 * Product + Offer for one catalogue service. The offer price is the list price (per 1000, per 100 or per
 * month) in IRR, with a UnitPriceSpecification saying what quantity it is for, and the orderable range.
 */
export function serviceProductLd(s: SeoService, input: { description: string; categoryName: string; image?: string }): Ld {
  const lp = listPrice(s);
  const url = absoluteUrl(serviceHref(s));
  const priceIrr = tomanToIrr(lp.toman);
  const unitText = lp.kind === 'months' ? 'ماه' : lp.perLabel;
  return {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: s.name,
    description: input.description,
    url,
    sku: s.slug,
    category: input.categoryName,
    brand: brandFor(s.slug),
    ...(input.image ? { image: absoluteUrl(input.image) } : {}),
    offers: {
      '@type': 'Offer',
      url,
      price: priceIrr,
      priceCurrency: 'IRR',
      availability: 'https://schema.org/InStock',
      seller: { '@id': ORG_ID() },
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: priceIrr,
        priceCurrency: 'IRR',
        referenceQuantity: { '@type': 'QuantitativeValue', value: lp.per, unitText },
      },
      eligibleQuantity: {
        '@type': 'QuantitativeValue',
        minValue: s.minQuantity,
        ...(s.maxQuantity ? { maxValue: s.maxQuantity } : {}),
      },
    },
  };
}

/** ItemList of service pages for a category (a summary page: URLs only, no nested products). */
export function serviceListLd(services: SeoService[]): Ld {
  return {
    '@type': 'ItemList',
    itemListElement: services.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(serviceHref(s)), name: s.name })),
  };
}

/** Wrap nodes in one @graph document. Undefined values are dropped by JSON.stringify. */
export function graph(...nodes: Ld[]): Ld {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
