// Read model for the public (crawlable) catalogue pages, sitemap and llms.txt.
// Platform products only (workspace_id IS NULL): a white-label tenant's private products never leak
// into public pages. Prices are the same active IRT row the order flow charges.
import { cache } from 'react';
import { query } from '../core/db';

export type PublicService = {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  /** Toman per single unit (IRT minor unit = toman). */
  unitToman: number;
  minQuantity: number;
  maxQuantity: number | null;
  updatedAt: string;
};

type Row = {
  slug: string; name: string; description: string | null; category: string;
  unit: string; min: string | null; max: string | null; updatedAt: Date | string;
};

const TTL_MS = 60_000;
let memo: { at: number; data: PublicService[] } | null = null;

async function load(): Promise<PublicService[]> {
  const r = await query<Row>(
    `SELECT s.slug, s.name, s.description, p.slug AS category,
            pr.unit_price_minor::text AS unit, pr.min_quantity::text AS min, pr.max_quantity::text AS max,
            GREATEST(s.updated_at, COALESCE(pr.price_updated_at, pr.effective_from)) AS "updatedAt"
     FROM services s
     JOIN products p ON p.id = s.product_id AND p.workspace_id IS NULL AND p.active = true
     JOIN LATERAL (
       SELECT sp.unit_price_minor, sp.min_quantity, sp.max_quantity, sp.price_updated_at, sp.effective_from
       FROM service_prices sp
       WHERE sp.service_id = s.id AND sp.active = true AND sp.currency = 'IRT'
         AND (sp.effective_to IS NULL OR sp.effective_to > now())
       ORDER BY sp.effective_from DESC LIMIT 1
     ) pr ON true
     WHERE s.active = true AND pr.unit_price_minor > 0
     ORDER BY p.slug, s.slug`,
  );
  return r.rows.map(row => ({
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    unitToman: Number(row.unit),
    minQuantity: Math.max(1, Number(row.min ?? 1)),
    maxQuantity: row.max == null ? null : Number(row.max),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));
}

/**
 * Every publicly sold service with its live price. Memoised for a minute across requests (crawlers hit
 * many pages at once) and per request via React `cache`. A database outage yields an empty catalogue:
 * pages render their «به‌زودی» state and stay up instead of erroring.
 */
export const getPublicCatalog = cache(async (): Promise<PublicService[]> => {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.data;
  try {
    const data = await load();
    memo = { at: Date.now(), data };
    return data;
  } catch {
    return memo?.data ?? [];
  }
});

/** Test hook: forget the memoised catalogue. */
export function resetPublicCatalogMemo() {
  memo = null;
}
