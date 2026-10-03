import { query } from '../core/db';
export type ProviderRoute = { providerId: string; priority: number; weight: number };
export async function routesForService(serviceId: string): Promise<ProviderRoute[]> {
  const result = await query<ProviderRoute>(`SELECT provider_id AS "providerId", priority, weight FROM provider_routes pr JOIN providers p ON p.id=pr.provider_id WHERE pr.service_id=$1 AND pr.active=true AND p.status='ACTIVE' ORDER BY priority ASC, weight DESC`, [serviceId]);
  return result.rows;
}
