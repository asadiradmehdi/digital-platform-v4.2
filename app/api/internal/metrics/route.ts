import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { snapshotMetrics } from '../../../../server/observability/metrics';

function requireInternalSecret(request: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  return request.headers.get('x-internal-secret') === secret;
}

export async function GET(request: NextRequest) {
  const correlationId = randomUUID();
  if (!requireInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'x-correlation-id': correlationId } });
  }
  const metrics = snapshotMetrics();
  return NextResponse.json({ metrics, count: metrics.length, correlationId }, { headers: { 'x-correlation-id': correlationId } });
}
