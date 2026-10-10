import { describe, expect, it } from 'vitest';
import { bestSellers, normalize, searchServices } from '../../apps/mobile/src/zp/search';

const svc = (slug: string, name: string, category: string, group: string, price = 100) => ({
  id: slug, slug, name, description: null as string | null, category, short: name, group, unit: group,
  per: 1000, unitPriceToman: price,
});
const catalog = {
  categories: [
    { key: 'instagram', name: 'اینستاگرام',  },
    { key: 'telegram', name: 'تلگرام',  },
    { key: 'ai-subscriptions', name: 'اشتراک هوش مصنوعی',  },
  ],
  services: [
    svc('tg-members', 'ممبر تلگرام', 'telegram', 'ممبر'),
    svc('ig-likes', 'لایک اینستاگرام', 'instagram', 'لایک'),
    svc('ig-followers', 'فالوور اینستاگرام', 'instagram', 'فالوور'),
    svc('chatgpt-plus', 'چت‌جی‌پی‌تی پلاس', 'ai-subscriptions', 'اشتراک'),
  ],
};

describe('app search', () => {
  it('normalises Arabic letters, digits and ZWNJ', () => {
    expect(normalize('فالوور  ٣ك')).toBe('فالوور 3ک');
    expect(normalize('چت‌جی‌پی‌تی')).toBe('چتجیپیتی');
  });
  it('lists best sellers first: AI subscription, then Instagram followers', () => {
    expect(bestSellers(catalog).map(s => s.slug).slice(0, 3)).toEqual(['chatgpt-plus', 'ig-followers', 'ig-likes']);
  });
  it('matches by network, kind and synonym', () => {
    expect(searchServices(catalog, 'اینستا فالو').map(s => s.slug)[0]).toBe('ig-followers');
    expect(searchServices(catalog, 'follower instagram')[0]?.slug).toBe('ig-followers');
    expect(searchServices(catalog, 'gpt')[0]?.slug).toBe('chatgpt-plus');
  });
  it('returns nothing for unknown text and best sellers for empty text', () => {
    expect(searchServices(catalog, 'zzzz')).toEqual([]);
    expect(searchServices(catalog, '  ')[0]?.slug).toBe('chatgpt-plus');
  });
});
