import { query } from '../core/db';
import { AppError } from '../core/errors';
import { DISPLAY_CURRENCY } from './contracts';
import { enforceStaleRatePolicy } from './stale-guard';

export async function quoteServicePrice(servicePriceId: string, workspaceId?: string) {
  const result = await query<{
    id: string; service_id: string; unit_price_minor: string; currency: string; price_version: string;
    pricing_rule_id: string; provider_cost_minor: string | null; provider_cost_currency: string | null;
    base_amount_minor: string; base_currency: string; margin_bps: number; margin_mode: string;
    rounding_increment_minor: string; min_price_minor: string | null; max_price_minor: string | null;
    stale_rate_policy: string; max_rate_age_seconds: number;
    fx_rate_id: string | null; generated_at: string | null; final_amount_minor: string | null;
    rate_numerator: string | null; rate_denominator: string | null; fetched_at: string | null; is_verified: boolean | null;
  }>(`
    SELECT sp.id, sp.service_id, sp.unit_price_minor, sp.currency, sp.price_version,
           sp.pricing_rule_id, sp.provider_cost_minor, sp.provider_cost_currency,
           pr.base_amount_minor, pr.base_currency, pr.margin_bps, pr.margin_mode,
           pr.rounding_increment_minor, pr.min_price_minor, pr.max_price_minor,
           pr.stale_rate_policy, pr.max_rate_age_seconds,
           gp.fx_rate_id, gp.generated_at, gp.final_amount_minor,
           fx.rate_numerator, fx.rate_denominator, fx.fetched_at, fx.is_verified
    FROM service_prices sp
    JOIN pricing_rules pr ON pr.id=sp.pricing_rule_id AND pr.active=true
    LEFT JOIN LATERAL (
      SELECT * FROM generated_prices g WHERE g.pricing_rule_id=pr.id ORDER BY g.generated_at DESC LIMIT 1
    ) gp ON true
    LEFT JOIN fx_rates fx ON fx.id=gp.fx_rate_id
    WHERE sp.id=$1 AND sp.active=true
  `, [servicePriceId]);

  const row = result.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Service price not found.');
  if (!row.fx_rate_id || !row.is_verified || !row.fetched_at || !row.final_amount_minor) {
    throw new AppError('CONFLICT', 'No verified generated price is available.');
  }

  const staleGuard = await enforceStaleRatePolicy({
    fxRateId: row.fx_rate_id,
    fetchedAt: new Date(row.fetched_at),
    maxAgeSeconds: row.max_rate_age_seconds ?? 3600,
    staleRatePolicy: (row.stale_rate_policy as 'USE_LAST_KNOWN_GOOD' | 'FREEZE_PRICE' | 'BLOCK_PURCHASE') ?? 'USE_LAST_KNOWN_GOOD',
    frozenAmountMinor: BigInt(row.final_amount_minor),
    pricingRuleId: row.pricing_rule_id,
    workspaceId,
  });

  const amountMinor = staleGuard.stale && staleGuard.amountMinor != null
    ? staleGuard.amountMinor
    : BigInt(row.final_amount_minor);

  return {
    servicePriceId: row.id,
    serviceId: row.service_id,
    amountMinor,
    currency: DISPLAY_CURRENCY,
    pricingRuleId: row.pricing_rule_id,
    fxRateId: row.fx_rate_id,
    priceVersion: BigInt(row.price_version ?? 1),
    providerCostMinor: row.provider_cost_minor == null ? undefined : BigInt(row.provider_cost_minor),
    providerCostCurrency: row.provider_cost_currency ?? undefined,
    generatedAt: new Date(row.generated_at!),
    stale: staleGuard.stale,
    staleAgeSeconds: staleGuard.stale ? staleGuard.ageSeconds : undefined,
  };
}
