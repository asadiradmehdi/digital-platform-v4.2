import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { query } from '../../../../server/core/db';
export async function GET() {
  const correlationId = randomUUID();
  try { await query('SELECT 1'); return NextResponse.json({ ok:true, status:'healthy', checks:{database:'up'}, correlationId }, { headers:{'x-correlation-id':correlationId} }); }
  catch { return NextResponse.json({ ok:false, status:'degraded', checks:{database:'down'}, correlationId }, { status:503, headers:{'x-correlation-id':correlationId} }); }
}
