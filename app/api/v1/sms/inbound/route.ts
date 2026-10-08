import { NextRequest } from 'next/server';
import { correlationId, handleRouteError } from '../../../../../server/core/http';
import { readText } from '../../../../../server/core/body';
import { clientFingerprint } from '../../../../../server/core/security-boundary';
import { consumeDistributedRateLimit } from '../../../../../server/core/distributed-rate-limit';
import { authorizeInboundSms, handleInboundSms, INBOUND_MAX_BYTES } from '../../../../../server/notifications/sms/inbound';

/**
 * Inbound SMS forwarded by the SMS panel («استعلام وضعیت با پیامک»). Disabled (404) until configured.
 * Order of checks: address rate limit → size limit (before reading/parsing) → shared secret → fields.
 * Accepts GET query parameters, urlencoded forms or a flat JSON object.
 */
async function handle(request: NextRequest) {
  const id = correlationId(request);
  try {
    const ip = clientFingerprint(request);
    await consumeDistributedRateLimit({ key: `sms-inbound-ip:${ip}`, scope: 'sms.inbound.ip', windowSeconds: 60, maxRequests: 120 });
    const url = request.nextUrl;
    if (url.search.length > INBOUND_MAX_BYTES || Number(request.headers.get('content-length') ?? 0) > INBOUND_MAX_BYTES) {
      return new Response('Payload too large', { status: 413 });
    }
    const config = await authorizeInboundSms(request.headers.get('x-zp-sms-secret') ?? url.searchParams.get('key'), ip, id);
    if (!config) return new Response('Not found', { status: 404 });
    const raw = request.method === 'POST' ? await readText(request, INBOUND_MAX_BYTES) : '';
    const fields: Record<string, string> = {};
    for (const [k, v] of url.searchParams) if (k !== 'key') fields[k] = v;
    if (raw) {
      if ((request.headers.get('content-type') ?? '').includes('json')) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string' || typeof v === 'number') fields[k] = String(v);
        } catch { return new Response('Bad request', { status: 400 }); }
      } else for (const [k, v] of new URLSearchParams(raw)) fields[k] = v;
    }
    await handleInboundSms(config, fields);
    // Always a plain 200 for an authenticated delivery so the panel does not retry; the outcome is logged.
    return new Response('OK', { status: 200, headers: { 'content-type': 'text/plain', 'x-correlation-id': id } });
  } catch (error) { return handleRouteError(error, id); }
}

export const GET = handle;
export const POST = handle;
