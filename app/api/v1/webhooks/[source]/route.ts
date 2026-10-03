import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { verifyWebhookSignature } from '../../../../../server/core/webhook';
import { recordWebhook } from '../../../../../server/core/webhook-inbox';
import { dispatchPaymentWebhook } from '../../../../../server/payments/webhook-dispatcher';

export async function POST(request: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  const id = correlationId(request);
  try {
    const { source } = await params;
    const maxBytes = Number(process.env.WEBHOOK_MAX_BODY_BYTES ?? 1024 * 1024);
    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (declaredLength > maxBytes) return json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Webhook payload is too large.' }, correlationId: id }, { status: 413, correlationId: id });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) return json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Webhook payload is too large.' }, correlationId: id }, { status: 413, correlationId: id });
    const signature = request.headers.get('x-webhook-signature') ?? '';
    const timestamp = request.headers.get('x-webhook-timestamp') ?? '';
    const secret = process.env[`WEBHOOK_SECRET_${source.toUpperCase().replace(/[^A-Z0-9]/g,'_')}`] ?? '';
    const valid = Boolean(secret) && verifyWebhookSignature(secret, timestamp, raw, signature);
    if (!valid) return json({ error: { code: 'UNAUTHORIZED', message: 'Invalid webhook signature.' }, correlationId: id }, { status: 401, correlationId: id });
    let body: Record<string, unknown>;
    try { body = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch { return json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid webhook payload.' }, correlationId: id }, { status: 400, correlationId: id }); }
    const eventId = request.headers.get('x-event-id') ?? String(body.id ?? body.eventId ?? '');
    const eventType = String(body.type ?? request.headers.get('x-event-type') ?? 'unknown');
    if (!eventId) return json({ error: { code: 'VALIDATION_ERROR', message: 'Webhook event id required.' }, correlationId: id }, { status: 400, correlationId: id });
    const recorded = await recordWebhook({ source, eventId, eventType, signatureValid: true, payload: body });
    // Dispatch payment events only for deduplicated (non-duplicate) accepted events.
    if (recorded.accepted) {
      await dispatchPaymentWebhook({ source, eventType, payload: body, correlationId: id }).catch(() => {
        // Log but don't fail: outbox events ensure eventual consistency.
      });
    }
    return json(recorded, { status: 202, correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
