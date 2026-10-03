import { NextRequest } from 'next/server';
import { listServices } from '../../../../server/commerce/catalog';
import { parseLimit, decodeCursor, encodeCursor } from '../../../../server/core/pagination';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try { const limit=parseLimit(request.nextUrl.searchParams.get('limit')); const page=await listServices(limit,decodeCursor(request.nextUrl.searchParams.get('cursor'))); return json({...page,nextCursor:page.nextCursor?encodeCursor(page.nextCursor):null},{correlationId:id}); }
  catch(error){ return handleRouteError(error,id); }
}
