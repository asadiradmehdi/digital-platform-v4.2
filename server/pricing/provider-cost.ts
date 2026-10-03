import { query } from '../core/db';

export async function recordProviderServiceCost(input: {
  providerServiceId: string;
  unitCostMinor: bigint;
  currency: string;
  unit?: string;
  effectiveFrom?: Date;
  metadata?: Record<string, unknown>;
}) {
  const result = await query<{id:string}>(`
    INSERT INTO provider_service_costs(provider_service_id,unit_cost_minor,currency,unit,effective_from,metadata)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id
  `,[input.providerServiceId,input.unitCostMinor.toString(),input.currency.toUpperCase(),input.unit ?? 'UNIT',input.effectiveFrom ?? new Date(),input.metadata ?? {}]);
  return result.rows[0].id;
}

export async function getLatestProviderServiceCost(providerServiceId: string) {
  const result = await query<{ id: string; unitCostMinor: string; currency: string; unit: string; effectiveFrom: string }>(`
    SELECT id,unit_cost_minor AS "unitCostMinor",currency,unit,effective_from AS "effectiveFrom"
    FROM provider_service_costs
    WHERE provider_service_id=$1 AND active=true
      AND effective_from <= now()
      AND (effective_to IS NULL OR effective_to > now())
    ORDER BY effective_from DESC LIMIT 1
  `,[providerServiceId]);
  return result.rows[0] ?? null;
}

export async function syncServicePriceCost(servicePriceId: string) {
  const result = await query<{ id: string; provider_service_id: string }>(`
    SELECT sp.id, ps.id AS provider_service_id
    FROM service_prices sp
    JOIN provider_routes pr ON pr.service_id=sp.service_id AND pr.active=true
    JOIN provider_services ps ON ps.service_id=sp.service_id AND ps.provider_id=pr.provider_id AND ps.active=true
    WHERE sp.id=$1
    ORDER BY pr.priority ASC, pr.weight DESC LIMIT 1
  `,[servicePriceId]);
  const row = result.rows[0];
  if (!row) return null;
  const cost = await getLatestProviderServiceCost(row.provider_service_id);
  if (!cost) return null;
  await query(`UPDATE service_prices SET provider_cost_minor=$1,provider_cost_currency=$2 WHERE id=$3`,[cost.unitCostMinor,cost.currency,servicePriceId]);
  return cost;
}
