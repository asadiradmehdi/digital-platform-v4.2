import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { getSupportContact, licensesView } from '../../../../../server/content/trust';

/** Public trust data for the native app: licences, support numbers and hours. No session needed. */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const support = await getSupportContact();
    return json({ licenses: licensesView(), phones: support.phones, hours: support.hours }, {
      correlationId: id,
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (error) { return handleRouteError(error, id); }
}
