// Shared guard for every /api/v1/admin/* route handler: same-origin check on browser mutations, a signed-in user,
// admin access (owner or active staff, server-side, every call; each function then checks its own permission), then the work. Errors become the standard envelope.
import type { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../core/http';
import { assertSameOrigin } from '../core/security-boundary';
import { requireRequestUser } from '../identity/request-user';
import { requireAdminAccess } from './access';
import { AppError } from '../core/errors';

export type AdminCall = { actorUserId: string; correlation: string; body: Record<string, unknown>; idempotencyKey: string | null; request: NextRequest };

async function run(request: NextRequest, mutation: boolean, work: (c: AdminCall) => Promise<unknown>, status = 200) {
  const correlation = correlationId(request);
  try {
    if (mutation) assertSameOrigin(request);
    const actorUserId = await requireRequestUser(request);
    await requireAdminAccess(actorUserId);
    let body: Record<string, unknown> = {};
    if (mutation) {
      const raw = await request.json().catch(() => ({})) as unknown;
      if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) body = raw as Record<string, unknown>;
    }
    const idem = request.headers.get('idempotency-key');
    return json(await work({ actorUserId, correlation, body, idempotencyKey: idem && idem.length >= 8 ? idem.slice(0, 80) : null, request }), { status, correlationId: correlation });
  } catch (e) {
    return handleRouteError(e, correlation);
  }
}

/** POST/PUT/PATCH/DELETE: origin-checked. */
export const adminMutation = (request: NextRequest, work: (c: AdminCall) => Promise<unknown>, status = 200) => run(request, true, work, status);
/** GET: admin-only read. */
export const adminRead = (request: NextRequest, work: (c: AdminCall) => Promise<unknown>) => run(request, false, work);

export const str = (v: unknown, label: string, max = 500): string => {
  if (typeof v !== 'string') throw new AppError('VALIDATION_ERROR', `${label} نامعتبر است.`);
  const t = v.trim();
  if (Array.from(t).length > max) throw new AppError('VALIDATION_ERROR', `${label} حداکثر ${max} حرف است.`);
  return t;
};
