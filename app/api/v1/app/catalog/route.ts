import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { listCatalogWithPrices } from '../../../../../server/account/overview';
import { catalogView } from '../../../../../server/account/app-views';

/** Public catalogue for the native app: categories, priced services and order presets. */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    return json(catalogView(await listCatalogWithPrices()), { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
