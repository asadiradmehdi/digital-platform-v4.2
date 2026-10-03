import { query } from '../core/db';
import type { FxProvider } from './providers';

export async function storeVerifiedFxRate(input: {
  baseCurrency: string;
  quoteCurrency: string;
  numerator: bigint;
  denominator: bigint;
  source: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  if (input.numerator <= 0n || input.denominator <= 0n) throw new Error('FX rate must be positive.');
  const result = await query<{id:string}>(`
    INSERT INTO fx_rates(base_currency,quote_currency,rate_numerator,rate_denominator,source,source_id,is_verified,observed_at,metadata)
    VALUES($1,$2,$3,$4,$5,$6,true,now(),$7)
    RETURNING id
  `,[input.baseCurrency.toUpperCase(),input.quoteCurrency.toUpperCase(),input.numerator.toString(),input.denominator.toString(),input.source,input.sourceId ?? null,input.metadata ?? {}]);
  return result.rows[0].id;
}

export async function getLatestVerifiedFx(baseCurrency: string, quoteCurrency = 'IRT', maxAgeSeconds = 3600) {
  const result = await query<any>(`
    SELECT id,base_currency AS "baseCurrency",quote_currency AS "quoteCurrency",rate_numerator AS numerator,rate_denominator AS denominator,source,fetched_at AS "fetchedAt",is_verified AS verified
    FROM fx_rates
    WHERE base_currency=$1 AND quote_currency=$2 AND is_verified=true
      AND fetched_at >= now() - ($3::integer * interval '1 second')
    ORDER BY fetched_at DESC LIMIT 1
  `,[baseCurrency.toUpperCase(),quoteCurrency.toUpperCase(),maxAgeSeconds]);
  return result.rows[0] ?? null;
}

export async function fetchWithFallback(providers: FxProvider[], baseCurrency: string, quoteCurrency = 'IRT') {
  const errors: string[] = [];
  for (const provider of providers) {
    try { return { provider: provider.name, rate: await provider.getRate(baseCurrency,quoteCurrency) }; }
    catch (error) { errors.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  throw new Error(`All FX providers failed. ${errors.join(' | ')}`);
}
