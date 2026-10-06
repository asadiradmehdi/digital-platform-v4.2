/**
 * Unit tests for POST /api/v1/webhooks/:source
 * Verifies signature verification, size limits, deduplication, and dispatch.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/webhook', () => ({ verifyWebhookSignature: vi.fn() }));
vi.mock('../../server/core/webhook-inbox', () => ({ recordWebhook: vi.fn() }));
vi.mock('../../server/payments/webhook-dispatcher', () => ({ dispatchPaymentWebhook: vi.fn() }));

import { verifyWebhookSignature } from '../../server/core/webhook';
import { recordWebhook } from '../../server/core/webhook-inbox';
import { dispatchPaymentWebhook } from '../../server/payments/webhook-dispatcher';

const mockVerify = vi.mocked(verifyWebhookSignature);
const mockRecord = vi.mocked(recordWebhook);
const mockDispatch = vi.mocked(dispatchPaymentWebhook);

beforeEach(() => {
  vi.resetAllMocks();
  process.env.WEBHOOK_SECRET_STRIPE = 'test-secret';
});

type RouteModule = typeof import('../../app/api/v1/webhooks/[source]/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/v1/webhooks/[source]/route'));
}, 60000);

function makeRequest(
  body: string,
  opts: { signature?: string; timestamp?: string; eventId?: string; contentLength?: string } = {},
): import('next/server').NextRequest {
  return {
    text: async () => body,
    headers: {
      get: (k: string) => {
        if (k === 'x-webhook-signature') return opts.signature ?? 'valid-sig';
        if (k === 'x-webhook-timestamp') return opts.timestamp ?? '1234567890';
        if (k === 'x-event-id') return opts.eventId ?? 'evt-1';
        if (k === 'content-length') return opts.contentLength ?? String(body.length);
        return null;
      },
    },
    url: 'http://localhost:3000/api/v1/webhooks/stripe',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

function makeParams(source: string) {
  return { params: Promise.resolve({ source }) };
}

const validBody = JSON.stringify({ type: 'payment.succeeded', id: 'evt-1', amount: 100000 });

describe('POST /api/v1/webhooks/:source', () => {
  it('returns 202 with recorded event on valid webhook', async () => {
    mockVerify.mockReturnValueOnce(true);
    mockRecord.mockResolvedValueOnce({ accepted: true, id: 'rec-1' } as never);
    mockDispatch.mockResolvedValueOnce(undefined as never);

    const response = await POST(makeRequest(validBody), makeParams('stripe'));
    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.accepted).toBe(true);
  });

  it('returns 401 when signature is invalid', async () => {
    mockVerify.mockReturnValueOnce(false);

    const response = await POST(makeRequest(validBody), makeParams('stripe'));
    expect(response.status).toBe(401);
  });

  it('returns 401 when webhook secret is not configured', async () => {
    delete process.env.WEBHOOK_SECRET_STRIPE;
    mockVerify.mockReturnValueOnce(false);

    const response = await POST(makeRequest(validBody), makeParams('stripe'));
    expect(response.status).toBe(401);
  });

  it('returns 413 when content-length exceeds limit', async () => {
    const response = await POST(
      makeRequest(validBody, { contentLength: String(2 * 1024 * 1024) }),
      makeParams('stripe'),
    );
    expect(response.status).toBe(413);
  });

  it('returns 400 when event id is missing', async () => {
    mockVerify.mockReturnValueOnce(true);

    const bodyWithoutId = JSON.stringify({ type: 'payment.succeeded', amount: 100000 });
    const response = await POST(
      makeRequest(bodyWithoutId, { eventId: '' }),
      makeParams('stripe'),
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 when body is invalid JSON', async () => {
    mockVerify.mockReturnValueOnce(true);

    const response = await POST(makeRequest('not-json'), makeParams('stripe'));
    expect(response.status).toBe(400);
  });

  it('does not dispatch when event is duplicate (accepted=false)', async () => {
    mockVerify.mockReturnValueOnce(true);
    mockRecord.mockResolvedValueOnce({ accepted: false, id: 'rec-dup' } as never);

    const response = await POST(makeRequest(validBody), makeParams('stripe'));
    expect(response.status).toBe(202);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
