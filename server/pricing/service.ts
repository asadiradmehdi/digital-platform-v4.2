import { withTransaction, query } from '../core/db';
import { calculateSellPriceMinor } from './calculator';
import type { FxProvider } from './providers';
import { DISPLAY_CURRENCY } from './contracts';
import { storeVerifiedFxRate } from './fx';

export async function refreshPricing(provider: FxProvider, baseCurrencies = ['USD']) {
  const job = await query<{id:string}>(`INSERT INTO pricing_job_runs(job_type,status) VALUES('FX_AND_PRICES','RUNNING') RETURNING id`);
  const jobId = job.rows[0].id;
  try {
    let updated = 0;
    for (const baseCurrency of baseCurrencies) {
      const rate = await provider.getRate(baseCurrency, DISPLAY_CURRENCY);
      const fxId = await storeVerifiedFxRate({
        baseCurrency,
        quoteCurrency: DISPLAY_CURRENCY,
        numerator: rate.numerator,
        denominator: rate.denominator,
        source: provider.name,
        metadata: rate.metadata,
      });
      const rules = await query<any>(`
        SELECT id,target_type AS "targetType",target_id AS "targetId",base_currency AS "baseCurrency",
               base_amount_minor AS "baseAmountMinor",margin_bps AS "marginBps",margin_mode AS "marginMode",
               rounding_increment_minor AS "roundingIncrementMinor",min_price_minor AS "minPriceMinor",
               max_price_minor AS "maxPriceMinor",stale_rate_policy AS "staleRatePolicy"
        FROM pricing_rules WHERE active=true AND base_currency=$1
      `,[baseCurrency]);

      for (const rule of rules.rows) {
        const finalAmount = calculateSellPriceMinor({
          baseAmountMinor: BigInt(rule.baseAmountMinor),
          rateNumerator: rate.numerator,
          rateDenominator: rate.denominator,
          marginBps: rule.marginBps,
          marginMode: rule.marginMode,
          roundingIncrementMinor: BigInt(rule.roundingIncrementMinor),
          minPriceMinor: rule.minPriceMinor == null ? undefined : BigInt(rule.minPriceMinor),
          maxPriceMinor: rule.maxPriceMinor == null ? undefined : BigInt(rule.maxPriceMinor),
        });

        await withTransaction(async client => {
          await client.query(`INSERT INTO generated_prices(pricing_rule_id,target_type,target_id,base_amount_minor,base_currency,fx_rate_id,margin_bps,final_amount_minor,final_currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [rule.id,rule.targetType,rule.targetId,rule.baseAmountMinor,baseCurrency,fxId,rule.marginBps,finalAmount.toString(),DISPLAY_CURRENCY]);
          if (rule.targetType === 'PLAN') {
            await client.query(`UPDATE plans SET price_minor=$1,currency='IRT',price_generated_at=now(),price_source=$2,price_version=price_version+1,updated_at=now() WHERE id=$3 AND price_minor IS DISTINCT FROM $1`, [finalAmount.toString(),provider.name,rule.targetId]);
          } else {
            await client.query(`UPDATE service_prices SET unit_price_minor=$1,currency='IRT',price_generated_at=now(),price_source=$2,price_updated_at=now(),price_version=price_version+1 WHERE id=$3 AND unit_price_minor IS DISTINCT FROM $1`, [finalAmount.toString(),provider.name,rule.targetId]);
          }
        });
        updated++;
      }
    }
    await query(`UPDATE pricing_job_runs SET status='SUCCEEDED',targets_updated=$1,finished_at=now(),fx_rate_id=$2 WHERE id=$3`, [updated,await latestFxId(),jobId]);
    return {jobId, updated};
  } catch (error) {
    await query(`UPDATE pricing_job_runs SET status='FAILED',error_message=$1,finished_at=now() WHERE id=$2`, [error instanceof Error ? error.message : String(error),jobId]);
    throw error;
  }
}

async function latestFxId() {
  const result = await query<{id:string}>(`SELECT id FROM fx_rates ORDER BY fetched_at DESC LIMIT 1`);
  return result.rows[0]?.id ?? null;
}
