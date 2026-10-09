import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BRIEF_MAX, BRIEF_MIN, ALL_CATEGORIES, CATEGORIES, CREATIVE_SERVICES, KINDS, TEAM_CATEGORIES, orderForm, perLabel, serviceIcon, serviceKind,
  serviceMeta, sortServices, targetField,
} from '../../lib/catalog-ui';
import { ICONS } from '../../packages/design-tokens/src/icons';
import { catalogView } from '../../server/account/app-views';

const seed = readFileSync('db/seeds/003_creative_services.sql', 'utf8');
const migration = readFileSync('db/migrations/0045_service_fulfillment_mode.sql', 'utf8');
const CREATIVE = ['design', 'automation', 'ai'] as const;

/** Seeded rows: slug → { product, unit price, min, max } parsed from the generated seed. */
const productOf: Record<string, string> = { '00000000-0000-0000-0000-00000000000c': 'design', '00000000-0000-0000-0000-000000000006': 'automation', '00000000-0000-0000-0000-000000000005': 'ai' };
const rows = [...seed.matchAll(/product_id='([0-9a-f-]+)' AND slug='([a-z0-9-]+)'\), 'IRT', (\d+), (\d+), (\d+), true\)/g)]
  .map(m => ({ product: productOf[m[1]], slug: m[2], unit: Number(m[3]), min: Number(m[4]), max: Number(m[5]) }));

describe('creative service catalogue', () => {
  it('seeds 6–10 priced services in each of design, automation and AI content', () => {
    for (const cat of CREATIVE) {
      const n = rows.filter(r => r.product === cat).length;
      expect(n, cat).toBeGreaterThanOrEqual(6);
      expect(n, cat).toBeLessThanOrEqual(10);
      expect(ALL_CATEGORIES.some(c => c.key === cat)).toBe(true);
    }
    expect(seed).toContain("'design'");
    expect(seed).toMatch(/DRAFT PRICES/);
  });

  it('has UI metadata for exactly the seeded services, and vice versa', () => {
    expect(rows.map(r => r.slug).sort()).toEqual(Object.keys(CREATIVE_SERVICES).sort());
  });

  it('gives every service its own existing glyph, a creative kind, a target field and a sort position', () => {
    const icons = new Set<string>();
    for (const r of rows) {
      const icon = serviceIcon(r.slug);
      expect(ICONS[icon], r.slug).toBeTruthy();
      icons.add(icon);
      expect(['design', 'automation', 'aicontent']).toContain(serviceKind(r.slug));
      const t = targetField(r.product, serviceKind(r.slug), r.slug);
      expect(t.label.length, r.slug).toBeGreaterThan(2);
      expect(typeof t.required).toBe('boolean');
    }
    expect(icons.size).toBe(rows.length); // no two services share an icon
    // Display order follows the table (demand order), regardless of the catalogue's alphabetical order.
    const design = rows.filter(r => r.product === 'design').map(r => ({ slug: r.slug })).reverse();
    expect(sortServices(design)[0].slug).toBe('ds-post');
    expect(sortServices([{ slug: 'ai-dm-assistant' }, { slug: 'ai-caption' }]).map(s => s.slug)).toEqual(['ai-caption', 'ai-dm-assistant']);
  });

  it('offers quantity presets that the seeded price bounds accept, priced in whole toman', () => {
    for (const r of rows) {
      const meta = serviceMeta(r.slug);
      expect(Number.isInteger(r.unit) && r.unit > 0, r.slug).toBe(true);
      expect(meta.quantities.length, r.slug).toBeGreaterThan(0);
      for (const q of meta.quantities) expect(q >= r.min && q <= r.max, `${r.slug} ${q}`).toBe(true);
      expect(meta.quantities[0]).toBe(r.min);
      expect(meta.quantities.at(-1)).toBe(r.max);
    }
  });

  it('bills ongoing automation and AI services monthly, and one-off work per piece', () => {
    expect(perLabel(serviceMeta('au-dm-reply'))).toBe('ماهانه');
    expect(perLabel(serviceMeta('ai-dm-assistant'))).toBe('ماهانه');
    expect(serviceMeta('auto-posting').quantities).toEqual([1, 3, 6, 12]);
    expect(CREATIVE_SERVICES['au-telegram-bot'].billing).toBe('once');
    expect(perLabel(serviceMeta('ds-post'))).toBe('هر طرح');
    expect(perLabel(serviceMeta('ai-voiceover'))).toBe('هر دقیقه');
    expect(serviceMeta('ds-post').quantities).toEqual([1, 3, 5, 10]);
    expect(KINDS.design.per).toBe(1);
  });

  it('states delivery, revisions, no auto-renewal and the refund rule on the order form', () => {
    const design = orderForm('design', 'ds-post');
    expect(design.brief).toMatchObject({ min: BRIEF_MIN, max: BRIEF_MAX });
    expect(design.facts.map(f => f.text)).toEqual(['تحویل ۲ روز کاری', '۲ بار اصلاح رایگان', 'بازگشت وجه اگر تحویل نشود']);
    expect(design.target.required).toBe(false);
    const monthly = orderForm('automation', 'au-comment-reply');
    expect(monthly.facts.map(f => f.text)).toContain('ماهانه، بدون تمدید خودکار');
    expect(monthly.target.required).toBe(true);
    expect(orderForm('ai', 'ai-subtitle').target.required).toBe(true);
    for (const f of [...design.facts, ...monthly.facts]) expect(ICONS[f.icon]).toBeTruthy();
    expect(design.refund).toContain('کیف پول');
    // Social services keep their single required target and no brief.
    expect(orderForm('instagram', 'ig-likes')).toMatchObject({ brief: null, facts: [], target: { required: true } });
  });

  it('marks every team category as manual fulfilment in the seed, behind the 0045 migration', () => {
    expect(migration).toMatch(/fulfillment_mode text NOT NULL DEFAULT 'PROVIDER'/);
    expect(seed).toMatch(/SET fulfillment_mode = 'MANUAL'/);
    for (const key of TEAM_CATEGORIES) expect(seed).toContain(`'${key}'`);
    expect(seed).toMatch(/SET active = false[^;]*slug = 'ai-content'/);
  });

  it('serves the brief spec and terms to the native app through the catalog view', () => {
    const view = catalogView([
      { id: 's1', slug: 'ds-logo', name: 'طراحی لوگو', description: null, productSlug: 'design', unitPriceMinor: '4900000', currency: 'IRT', minQuantity: '1', maxQuantity: '1' },
      { id: 's2', slug: 'ig-likes', name: 'لایک اینستاگرام', description: null, productSlug: 'instagram', unitPriceMinor: '35', currency: 'IRT', minQuantity: '100', maxQuantity: '500000' },
    ]);
    const logo = view.services.find(s => s.slug === 'ds-logo')!;
    expect(logo).toMatchObject({ icon: 'dsLogo', unit: 'لوگو', quantities: [1], perLabel: 'هر لوگو', brief: { min: BRIEF_MIN } });
    expect(logo.facts.map(f => f.text)).toContain('تحویل ۷ روز کاری');
    expect(view.categories.find(c => c.key === 'design')).toBeUndefined(); // hidden from customers (Ali 2026-10-09)
    expect(view.services.find(s => s.slug === 'ig-likes')!.brief).toBeNull();
  });
});
