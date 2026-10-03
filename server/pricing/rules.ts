import { query } from '../core/db';
import type { MarginMode, PricingTargetType, StaleRatePolicy } from './contracts';

export async function upsertPricingRule(input: {
  targetType: PricingTargetType;
  targetId: string;
  baseAmountMinor: bigint;
  baseCurrency: string;
  marginPercent: number;
  marginMode?: MarginMode;
  roundingIncrementMinor?: bigint;
  minPriceMinor?: bigint;
  maxPriceMinor?: bigint;
  staleRatePolicy?: StaleRatePolicy;
  maxRateAgeSeconds?: number;
  actorUserId?: string;
}) {
  if (!Number.isFinite(input.marginPercent) || input.marginPercent < 0 || input.marginPercent > 1000) {
    throw new Error('Invalid margin percent.');
  }
  const marginBps = Math.round(input.marginPercent * 100);
  const rounding = input.roundingIncrementMinor ?? 1000n;
  const mode = input.marginMode ?? 'MARKUP';
  const stalePolicy = input.staleRatePolicy ?? 'USE_LAST_KNOWN_GOOD';
  const result = await query<{id:string; before_state: unknown}>(`
    WITH old AS (SELECT id, to_jsonb(pricing_rules) AS before_state FROM pricing_rules WHERE target_type=$1 AND target_id=$2)
    INSERT INTO pricing_rules(target_type,target_id,base_amount_minor,base_currency,margin_bps,margin_mode,rounding_increment_minor,min_price_minor,max_price_minor,stale_rate_policy,max_rate_age_seconds,updated_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT(target_type,target_id) DO UPDATE SET
      base_amount_minor=EXCLUDED.base_amount_minor,
      base_currency=EXCLUDED.base_currency,
      margin_bps=EXCLUDED.margin_bps,
      margin_mode=EXCLUDED.margin_mode,
      rounding_increment_minor=EXCLUDED.rounding_increment_minor,
      min_price_minor=EXCLUDED.min_price_minor,
      max_price_minor=EXCLUDED.max_price_minor,
      stale_rate_policy=EXCLUDED.stale_rate_policy,
      max_rate_age_seconds=EXCLUDED.max_rate_age_seconds,
      updated_by=EXCLUDED.updated_by,
      active=true,
      updated_at=now()
    RETURNING id
  `,[input.targetType,input.targetId,input.baseAmountMinor.toString(),input.baseCurrency.toUpperCase(),marginBps,mode,rounding.toString(),input.minPriceMinor?.toString() ?? null,input.maxPriceMinor?.toString() ?? null,stalePolicy,input.maxRateAgeSeconds ?? 3600,input.actorUserId ?? null]);
  const rule = result.rows[0];
  await query(`INSERT INTO pricing_audit_events(pricing_rule_id,target_type,target_id,event_type,actor_user_id,after_state) SELECT $1,$2,$3,'RULE_UPDATED',$4,to_jsonb(p) FROM pricing_rules p WHERE p.id=$1`, [rule.id,input.targetType,input.targetId,input.actorUserId ?? null]);
  return rule;
}

export async function listPricingRules() {
  const result = await query(`SELECT id,target_type AS "targetType",target_id AS "targetId",base_amount_minor AS "baseAmountMinor",base_currency AS "baseCurrency",margin_bps / 100.0 AS "marginPercent",margin_mode AS "marginMode",rounding_increment_minor AS "roundingIncrementMinor",min_price_minor AS "minPriceMinor",max_price_minor AS "maxPriceMinor",stale_rate_policy AS "staleRatePolicy",max_rate_age_seconds AS "maxRateAgeSeconds",active FROM pricing_rules ORDER BY target_type,target_id`);
  return result.rows;
}
