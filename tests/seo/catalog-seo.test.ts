import { describe, expect, it } from 'vitest';
import {
  categoryCopy, categoryFaq, findService, listPrice, orderHref, packageQuantities, relatedServices,
  serviceCopy, serviceHref, serviceSegment, tomanToIrr,
} from '../../lib/seo/catalog-seo';
import { CATEGORIES } from '../../lib/catalog-ui';
import { CATALOG, seededServices, svc } from './fixtures';

// Claims the product does not make. Copy must never promise them (spam signals + consumer-law risk).
const FORBIDDEN = ['تضمین', 'گارانتی', 'بدون ریزش', 'واقعی', 'ایرانی', 'فوری', 'ارزان‌ترین قیمت بازار', 'امتیاز', '★'];

describe('service URLs', () => {
  it('maps catalogue slugs to readable, unique segments in every seeded category', () => {
    const seeded = seededServices();
    expect(seeded.length).toBeGreaterThanOrEqual(50);
    const seen = new Set<string>();
    for (const s of seeded) {
      const href = serviceHref(s);
      expect(href).toMatch(/^\/services\/[a-z-]+\/[a-z0-9-]+$/);
      expect(seen.has(href), `duplicate ${href}`).toBe(false);
      seen.add(href);
    }
    expect(serviceSegment('ig-followers')).toBe('followers');
    expect(serviceSegment('ig-story-views')).toBe('story-views');
    expect(serviceSegment('sub-chatgpt-plus')).toBe('chatgpt-plus');
    expect(serviceSegment('auto-posting')).toBe('posting');
  });

  it('resolves a segment back to the service only inside its own category', () => {
    expect(findService(CATALOG, 'instagram', 'followers')?.slug).toBe('ig-followers');
    expect(findService(CATALOG, 'telegram', 'followers')).toBeUndefined();
    expect(findService(CATALOG, 'instagram', 'nope')).toBeUndefined();
  });

  it('sends visitors to register first and members straight to the order form', () => {
    expect(orderHref('ig-likes', true)).toBe('/orders/new?service=ig-likes');
    expect(orderHref('ig-likes', false)).toBe('/auth?mode=register&next=%2Forders%2Fnew%3Fservice%3Dig-likes');
  });
});

describe('prices', () => {
  it('quotes the same list price as the app (per 1000 / per 100 / per month)', () => {
    expect(listPrice(CATALOG[0])).toMatchObject({ per: 1000, toman: 180_000, perLabel: 'هر ۱ هزار فالوور' });
    expect(listPrice(CATALOG[2])).toMatchObject({ per: 100, toman: 60_000 });
    expect(listPrice(CATALOG[4])).toMatchObject({ per: 1, toman: 2_490_000, perLabel: 'ماهانه' });
  });

  it('converts toman to IRR exactly ×10', () => {
    expect(tomanToIrr(180_000)).toBe(1_800_000);
    expect(tomanToIrr(2_490_000)).toBe(24_900_000);
  });

  it('offers package sizes only inside the orderable range, both ends included', () => {
    const q = packageQuantities(CATALOG[0]);
    expect(q[0]).toBe(100);
    expect(q.at(-1)).toBe(100000);
    expect(q.length).toBeLessThanOrEqual(6);
    expect(q.every(x => x >= 100 && x <= 100000)).toBe(true);
    expect(packageQuantities(CATALOG[4])).toEqual([1, 3, 6, 12]);
    expect(packageQuantities(svc({ slug: 'ig-likes', category: 'instagram', minQuantity: 300, maxQuantity: 400 }))).toEqual([300]);
  });
});

describe('copy', () => {
  it('gives every category a unique title, description and H1', () => {
    const titles = new Set<string>(); const descs = new Set<string>();
    for (const c of CATEGORIES) {
      const copy = categoryCopy(c.key)!;
      expect(copy.h1.length).toBeGreaterThan(5);
      expect(titles.has(copy.title)).toBe(false);
      expect(descs.has(copy.description)).toBe(false);
      titles.add(copy.title); descs.add(copy.description);
    }
    expect(categoryCopy('social')).toBeUndefined();
  });

  it('writes 6–8 FAQs per category and per service, with live numbers and no invented guarantees', () => {
    for (const cat of ['instagram', 'telegram', 'ai-subscriptions']) {
      const faq = categoryFaq(cat, CATALOG.filter(s => s.category === cat), 'شنبه تا پنج‌شنبه');
      expect(faq.length).toBeGreaterThanOrEqual(6);
      expect(faq.length).toBeLessThanOrEqual(8);
      for (const f of faq) for (const w of FORBIDDEN) expect(`${f.q} ${f.a}`).not.toContain(w);
    }
    for (const s of CATALOG) {
      const copy = serviceCopy(s, 'شنبه تا پنج‌شنبه');
      expect(copy.faq.length).toBeGreaterThanOrEqual(6);
      expect(copy.faq.length).toBeLessThanOrEqual(8);
      const all = [copy.title, copy.description, ...copy.intro, ...copy.faq.flatMap(f => [f.q, f.a])].join(' ');
      for (const w of FORBIDDEN) expect(all, `${s.slug}: ${w}`).not.toContain(w);
      expect(copy.description).toContain(listPrice(s).text);
    }
  });

  it('puts the main keyword in the H1 and title', () => {
    const f = serviceCopy(CATALOG[0], 'x');
    expect(f.h1).toBe('خرید فالوور اینستاگرام');
    expect(f.title.startsWith('خرید فالوور اینستاگرام')).toBe(true);
    const g = serviceCopy(CATALOG[4], 'x');
    expect(g.h1).toBe('خرید اشتراک ChatGPT Plus');
    expect(g.description).toContain('۲٬۴۹۰٬۰۰۰ تومان در ماه');
  });

  it('links related services: same category first, then the same kind elsewhere', () => {
    const rel = relatedServices(CATALOG, CATALOG[0]);
    expect(rel.map(r => r.slug)).not.toContain('ig-followers');
    expect(rel[0].category).toBe('instagram');
  });
});
