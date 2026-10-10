import { query } from '../core/db';
import { AppError } from '../core/errors';
import type { Page } from '../core/types';
export type CatalogService = { id: string; name: string; slug: string; serviceType: string; productName: string; productSlug: string; description: string | null };
export type CatalogServiceDetail = CatalogService & { description: string | null; active: boolean; productId: string };

export async function getService(id: string): Promise<CatalogServiceDetail> {
  const r = await query<CatalogServiceDetail>(
    `SELECT s.id, s.name, s.slug, s.service_type AS "serviceType",
            s.description, (s.active AND p.active) AS active, s.product_id AS "productId",
            p.name AS "productName", p.slug AS "productSlug"
     FROM services s JOIN products p ON p.id=s.product_id
     WHERE s.id=$1`,
    [id],
  );
  if (!r.rows[0]) throw new AppError('NOT_FOUND', 'Service not found.');
  return r.rows[0];
}

export async function getServiceBySlug(slug: string): Promise<CatalogService | null> {
  const r = await query<CatalogService>(
    `SELECT s.id,s.name,s.slug,s.service_type AS "serviceType",s.description,p.name AS "productName",p.slug AS "productSlug"
     FROM services s JOIN products p ON p.id=s.product_id
     WHERE s.slug=$1 AND s.active=true LIMIT 1`,
    [slug],
  );
  return r.rows[0] ?? null;
}

export async function listServices(limit: number, cursor?: string | null, serviceType?: string | null): Promise<Page<CatalogService>> {
  const params: unknown[] = [cursor ?? null, limit + 1];
  const typeFilter = serviceType ? ` AND s.service_type=$3` : '';
  if (serviceType) params.push(serviceType);
  const result = await query<CatalogService>(`SELECT s.id,s.name,s.slug,s.service_type AS "serviceType",s.description,p.name AS "productName",p.slug AS "productSlug" FROM services s JOIN products p ON p.id=s.product_id WHERE s.active=true AND ($1::uuid IS NULL OR s.id>$1::uuid)${typeFilter} ORDER BY s.id LIMIT $2`, params);
  const items = result.rows.slice(0, limit); return { items, nextCursor: result.rows.length > limit ? items.at(-1)?.id ?? null : null };
}
