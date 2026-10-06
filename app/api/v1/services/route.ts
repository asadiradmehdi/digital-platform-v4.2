import { NextRequest } from 'next/server';
import { getServiceBySlug, listServices } from '../../../../server/commerce/catalog';
import { parseLimit, decodeCursor, encodeCursor } from '../../../../server/core/pagination';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const slug = request.nextUrl.searchParams.get('slug');
    if (slug) {
      const service = await getServiceBySlug(slug);
      return service
        ? json({ item: service }, { correlationId: id })
        : json({ error: { code: 'NOT_FOUND', message: 'Service not found.' } }, { status: 404, correlationId: id });
    }
    const limit = parseLimit(request.nextUrl.searchParams.get('limit'));
    const cursor = decodeCursor(request.nextUrl.searchParams.get('cursor'));
    const serviceType = request.nextUrl.searchParams.get('serviceType') || null;
    const page = await listServices(limit, cursor, serviceType);
    return json({ ...page, nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null }, { correlationId: id });
  } catch(error){ return handleRouteError(error, id); }
}
