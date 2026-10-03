import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { query } from '../../../../../server/core/db';
import { isRateStale } from '../../../../../server/pricing/stale-guard';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    await requireRequestUser(request);
    const r = await query<{
      id: string; base_currency: string; quote_currency: string;
      rate_numerator: string; rate_denominator: string; source: string;
      fetched_at: string; is_verified: boolean;
    }>(
      `SELECT DISTINCT ON (base_currency, quote_currency)
         id, base_currency, quote_currency, rate_numerator, rate_denominator,
         source, fetched_at, is_verified
       FROM fx_rates
       WHERE is_verified = true
       ORDER BY base_currency, quote_currency, fetched_at DESC`
    );
    const rates = r.rows.map(row => ({
      id: row.id,
      baseCurrency: row.base_currency,
      quoteCurrency: row.quote_currency,
      rateNumerator: row.rate_numerator,
      rateDenominator: row.rate_denominator,
      source: row.source,
      fetchedAt: row.fetched_at,
      isVerified: row.is_verified,
      stale: isRateStale(new Date(row.fetched_at), 3600),
      ageSeconds: Math.floor((Date.now() - new Date(row.fetched_at).getTime()) / 1000),
    }));
    return json({ items: rates }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
