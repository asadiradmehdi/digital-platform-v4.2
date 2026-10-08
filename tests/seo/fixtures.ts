import { readFileSync } from 'node:fs';
import type { PublicService } from '../../server/seo/public-catalog';

const PRODUCT_BY_ID: Record<string, string> = {
  '1': 'instagram', '2': 'telegram', '3': 'tiktok', '4': 'youtube', '5': 'ai', '6': 'automation',
  '7': 'rubika', '8': 'aparat', '9': 'bale', a: 'eitaa', b: 'ai-subscriptions',
};

/** Every (category, slug, name) the seeds create — the real catalogue the URL scheme must handle. */
export function seededServices(): Array<{ category: string; slug: string; name: string }> {
  const out = new Map<string, { category: string; slug: string; name: string }>();
  for (const f of ['db/seeds/001_catalog.sql', 'db/seeds/002_catalog_expansion.sql']) {
    const sql = readFileSync(f, 'utf8');
    const rx = /\('10000000-[0-9-]+',\s*'00000000-0000-0000-0000-0000000000([0-9a-f]{2})',\s*'([^']+)',\s*'([a-z0-9-]+)'/g;
    for (const m of sql.matchAll(rx)) {
      const category = PRODUCT_BY_ID[m[1].replace(/^0/, '')];
      out.set(m[3], { category, slug: m[3], name: m[2] });
    }
  }
  return [...out.values()];
}

export const svc = (over: Partial<PublicService> & Pick<PublicService, 'slug' | 'category'>): PublicService => ({
  name: over.slug,
  description: null,
  unitToman: 100,
  minQuantity: 100,
  maxQuantity: 100000,
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

export const CATALOG: PublicService[] = [
  svc({ slug: 'ig-followers', category: 'instagram', name: 'فالوور اینستاگرام', unitToman: 180, description: 'افزایش فالوور پیج با تحویل تدریجی و پیگیری لحظه‌ای.' }),
  svc({ slug: 'ig-likes', category: 'instagram', name: 'لایک اینستاگرام', unitToman: 35, updatedAt: '2026-10-05T10:00:00.000Z' }),
  svc({ slug: 'ig-comments', category: 'instagram', name: 'کامنت اینستاگرام', unitToman: 600, minQuantity: 10, maxQuantity: 1000 }),
  svc({ slug: 'tg-members', category: 'telegram', name: 'ممبر تلگرام', unitToman: 90 }),
  svc({ slug: 'sub-chatgpt-plus', category: 'ai-subscriptions', name: 'ChatGPT Plus', unitToman: 2_490_000, minQuantity: 1, maxQuantity: 12 }),
  svc({ slug: 'sub-claude-pro', category: 'ai-subscriptions', name: 'Claude Pro', unitToman: 2_490_000, minQuantity: 1, maxQuantity: 12 }),
];
