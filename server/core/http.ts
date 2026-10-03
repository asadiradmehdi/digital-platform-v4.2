import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { errorEnvelope } from './errors';

export function correlationId(request: Request) { return request.headers.get('x-correlation-id')?.slice(0, 100) || randomUUID(); }
export function json<T>(data: T, init?: ResponseInit & { correlationId?: string }) {
  const headers = new Headers(init?.headers); headers.set('x-correlation-id', init?.correlationId ?? randomUUID());
  return NextResponse.json(data, { ...init, headers });
}
export function handleRouteError(error: unknown, id: string) {
  const result = errorEnvelope(error, id);
  return json(result.body, { status: result.status, correlationId: id });
}
