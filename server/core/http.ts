import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { AppError, errorEnvelope } from './errors';
import { logger } from '../observability/logger';

export function correlationId(request: Request) { return request.headers.get('x-correlation-id')?.slice(0, 100) || randomUUID(); }
export function json<T>(data: T, init?: ResponseInit & { correlationId?: string }) {
  const headers = new Headers(init?.headers); headers.set('x-correlation-id', init?.correlationId ?? randomUUID());
  return NextResponse.json(data, { ...init, headers });
}
export function handleRouteError(error: unknown, id: string) {
  const result = errorEnvelope(error, id);
  // Anything that is not a deliberate AppError is a bug: log it (the customer only sees a generic message).
  if (!(error instanceof AppError) || result.status >= 500) {
    logger.error('route_unhandled_error', { correlationId: id }, { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error), stack: error instanceof Error ? error.stack?.split('\n').slice(0, 6).join(' | ') : undefined });
  }
  return json(result.body, { status: result.status, correlationId: id });
}
