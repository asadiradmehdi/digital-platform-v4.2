// Catalogue search for the app: Persian-aware normalisation, synonyms and a best-seller priority list.
// Pure functions so the ranking is unit-testable; the catalogue itself always comes from the server.
// Structural types (a subset of AppCatalog/AppService) keep this module free of app imports.
type AppService = { slug: string; name: string; short: string; description: string | null; category: string; group: string; unit: string; per: number; unitPriceToman: number };
type AppCatalog<S extends AppService = AppService> = { categories: Array<{ key: string; name: string; hint?: string }>; services: S[] };

const DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Lower-case, unify Arabic/Persian letters and digits, drop diacritics, ZWNJ and punctuation. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه')
    .replace(/[۰-۹]/g, d => String(DIGITS.indexOf(d))).replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[ً-ٰٟ‌‍‏‎]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words people type that the catalogue spells differently. */
const SYNONYMS: Array<[RegExp, string]> = [
  [/follower|فالور|فالو\b|دنبال کننده|دنبالکننده/, 'فالوور'],
  [/member|عضو|ممبر/, 'ممبر'],
  [/subscriber|ساب|سابسکرایب/, 'سابسکرایبر'],
  [/like|لایک|پسند/, 'لایک'],
  [/view|ویو|بازدید|ویوو/, 'بازدید'],
  [/chatgpt|gpt|چت جی پی تی|چتجیپیتی|هوش مصنوعی|ai\b/, 'اشتراک هوش مصنوعی'],
  [/insta|اینستا/, 'اینستاگرام'],
  [/telegram|تلگرام|تلگرم/, 'تلگرام'],
  [/youtube|یوتوب|یوتیوب/, 'یوتیوب'],
  [/tiktok|تیک تاک|تیکتاک/, 'تیک‌تاک'],
];

/** Best-seller priority (Ali 2026-10-10): AI subscription first, then the Instagram staples, Telegram… */
const BEST_SELLERS: Array<{ category: string; group?: string }> = [
  { category: 'ai-subscriptions' },
  { category: 'instagram', group: 'فالوور' },
  { category: 'instagram', group: 'لایک' },
  { category: 'instagram', group: 'بازدید' },
  { category: 'telegram', group: 'ممبر' },
  { category: 'telegram', group: 'بازدید' },
  { category: 'youtube', group: 'سابسکرایبر' },
  { category: 'tiktok', group: 'فالوور' },
  { category: 'youtube', group: 'بازدید' },
  { category: 'tiktok', group: 'لایک' },
];

/** Rank used to order services when nothing is typed or when scores tie (lower = sells better). */
export function sellerRank(s: Pick<AppService, 'category' | 'group'>): number {
  const i = BEST_SELLERS.findIndex(b => b.category === s.category && (!b.group || b.group === s.group));
  return i === -1 ? BEST_SELLERS.length + 1 : i;
}

export function bestSellers<S extends AppService>(catalog: AppCatalog<S>, limit = 8): S[] {
  return [...catalog.services]
    .sort((a, b) => sellerRank(a) - sellerRank(b) || a.unitPriceToman * a.per - b.unitPriceToman * b.per)
    .slice(0, limit);
}

function haystack(s: AppService, catalog: AppCatalog<AppService>): string {
  const cat = catalog.categories.find(c => c.key === s.category);
  return normalize([s.name, s.short, s.group, s.unit, s.description ?? '', cat?.name ?? '', cat?.hint ?? '', s.category].join(' '));
}

/** Services matching every typed word (after synonym expansion), best score first, best sellers breaking ties. */
export function searchServices<S extends AppService>(catalog: AppCatalog<S>, query: string, limit = 30): S[] {
  const q = normalize(query);
  if (!q) return bestSellers(catalog, limit);
  const expanded = SYNONYMS.filter(([re]) => re.test(q)).map(([, w]) => normalize(w));
  const words = q.split(' ');
  const scored: Array<{ s: S; score: number }> = [];
  for (const s of catalog.services) {
    const h = haystack(s, catalog);
    const name = normalize(s.name + ' ' + s.short);
    let score = 0;
    let ok = true;
    for (const w of words) {
      if (name.includes(w)) score += 6;
      else if (h.includes(w)) score += 3;
      else if (expanded.some(e => h.includes(e))) score += 2;
      else { ok = false; break; }
    }
    if (ok) scored.push({ s, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || sellerRank(a.s) - sellerRank(b.s))
    .slice(0, limit)
    .map(x => x.s);
}
