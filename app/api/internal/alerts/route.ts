import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { runAlertScan } from '../../../../server/observability/alerts';

function requireInternalSecret(request: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  return request.headers.get('x-internal-secret') === secret;
}

export async function POST(request: NextRequest) {
  const correlationId = randomUUID();
  if (!requireInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'x-correlation-id': correlationId } });
  }
  const firings = await runAlertScan();
  return NextResponse.json({ firings, count: firings.length, correlationId }, { headers: { 'x-correlation-id': correlationId } });
}
