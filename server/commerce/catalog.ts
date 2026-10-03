import { query } from '../core/db';
import type { Page } from '../core/types';
export type CatalogService = { id: string; name: string; slug: string; serviceType: string; productName: string; productSlug: string };
export async function listServices(limit: number, cursor?: string | null): Promise<Page<CatalogService>> {
  const result = await query<CatalogService>(`SELECT s.id,s.name,s.slug,s.service_type AS "serviceType",p.name AS "productName",p.slug AS "productSlug" FROM services s JOIN products p ON p.id=s.product_id WHERE s.active=true AND ($1::uuid IS NULL OR s.id>$1::uuid) ORDER BY s.id LIMIT $2`, [cursor ?? null, limit + 1]);
  const items = result.rows.slice(0, limit); return { items, nextCursor: result.rows.length > limit ? items.at(-1)?.id ?? null : null };
}
