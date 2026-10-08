import { describe, expect, it } from 'vitest';
import { breadcrumbLd, faqLd, graph, organizationLd, serviceProductLd, websiteLd } from '../../lib/seo/jsonld';
import { CATALOG } from './fixtures';

const BASE = 'http://localhost:3000';

describe('JSON-LD builders', () => {
  it('describes one Organization entity with both brand spellings and a logo', () => {
    const org = organizationLd({ phones: [{ tel: '+982112345678', label: 'پشتیبانی' }] });
    expect(org['@type']).toBe('Organization');
    expect(org['@id']).toBe(`${BASE}/#organization`);
    expect(org.name).toBe('زُحل پی');
    expect(org.alternateName).toContain('ZOHALPAY');
    expect((org.logo as { url: string }).url).toBe(`${BASE}/brand/zohalpay-logo-512.png`);
    const cps = org.contactPoint as Array<Record<string, string>>;
    expect(cps[0]).toMatchObject({ contactType: 'customer support', url: `${BASE}/contact` });
    expect(cps[1].telephone).toBe('+982112345678');
    expect(websiteLd().publisher).toEqual({ '@id': `${BASE}/#organization` });
  });

  it('prices a service Offer in IRR = toman × 10 with the quantity it is quoted for', () => {
    const ld = serviceProductLd(CATALOG[0], { description: 'd', categoryName: 'اینستاگرام' });
    const offer = ld.offers as Record<string, any>;
    expect(ld['@type']).toBe('Product');
    expect(ld.url).toBe(`${BASE}/services/instagram/followers`);
    expect(offer.priceCurrency).toBe('IRR');
    expect(offer.price).toBe(1_800_000); // 180 toman per follower × 1000 × 10
    expect(offer.priceSpecification.referenceQuantity.value).toBe(1000);
    expect(offer.eligibleQuantity).toMatchObject({ minValue: 100, maxValue: 100000 });
    expect(offer.availability).toBe('https://schema.org/InStock');

    const sub = serviceProductLd(CATALOG[4], { description: 'd', categoryName: 'اشتراک هوش مصنوعی' });
    expect((sub.offers as any).price).toBe(24_900_000);
    expect((sub.brand as any).name).toBe('ChatGPT');
  });

  it('never emits reviews or ratings', () => {
    const doc = JSON.stringify(graph(organizationLd(), websiteLd(), serviceProductLd(CATALOG[0], { description: 'd', categoryName: 'x' })));
    expect(doc).not.toMatch(/aggregateRating|"review"|ratingValue/i);
  });

  it('builds BreadcrumbList with absolute URLs and FAQPage with Q/A pairs', () => {
    const bc = breadcrumbLd([{ name: 'زُحل پی', path: '/' }, { name: 'خدمات', path: '/services' }]);
    const items = bc.itemListElement as Array<Record<string, unknown>>;
    expect(items.map(i => i.position)).toEqual([1, 2]);
    expect(items[1].item).toBe(`${BASE}/services`);
    const faq = faqLd([{ q: 'س؟', a: 'ج.' }]);
    expect(faq).toEqual({ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'س؟', acceptedAnswer: { '@type': 'Answer', text: 'ج.' } }] });
    const g = graph(bc);
    expect(g['@context']).toBe('https://schema.org');
    expect(JSON.parse(JSON.stringify(g))['@graph']).toHaveLength(1);
  });
});
