import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { query } from '../../../../server/core/db';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const plans = await query<{
      id: string; name: string; slug: string; price_minor: string; currency: string;
      billing_interval: string; description: string | null;
    }>(
      `SELECT id, name, slug, price_minor::text AS price_minor, currency, billing_interval, description
       FROM plans WHERE active=true ORDER BY price_minor ASC`,
      [],
    );
    const items = await Promise.all(plans.rows.map(async p => {
      const ents = await query<{ entitlement_key: string; value: unknown }>(
        `SELECT entitlement_key, value FROM plan_entitlements WHERE plan_id=$1 AND (value->>'enabled')::boolean=true ORDER BY entitlement_key`,
        [p.id],
      );
      return { ...p, entitlements: ents.rows };
    }));
    return json({ items }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
