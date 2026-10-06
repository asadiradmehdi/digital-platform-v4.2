import { NextResponse } from 'next/server';
import { env } from '../../../../../server/core/config';
import { refreshPricing } from '../../../../../server/pricing/service';
import { HttpFxProvider } from '../../../../../server/pricing/providers';

function assertCron(request: Request) {
  const expected = env('PRICING_CRON_SECRET');
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (provided !== expected) throw new Error('Unauthorized');
}

export async function POST(request: Request) {
  try {
    assertCron(request);
    const provider = new HttpFxProvider(
      env('FX_PROVIDER_NAME', 'configured-fx-provider'),
      env('FX_PROVIDER_URL'),
      (payload: unknown) => {
        const value = (payload as { rate?: string | number }).rate;
        if (value === undefined) throw new Error('FX provider response has no rate.');
        const text = String(value);
        const [whole, fraction = ''] = text.split('.');
        const denominator = 10n ** BigInt(fraction.length);
        const numerator = BigInt(whole) * denominator + BigInt(fraction || '0');
        return {numerator, denominator};
      },
      process.env.FX_PROVIDER_API_KEY ? {Authorization:`Bearer ${process.env.FX_PROVIDER_API_KEY}`} : {},
    );
    return NextResponse.json(await refreshPricing(provider));
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({error:'PRICING_REFRESH_FAILED'}, {status});
  }
}
