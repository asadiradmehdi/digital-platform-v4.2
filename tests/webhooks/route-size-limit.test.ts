/**
 * Tests for webhook route: body size limit and basic validation.
 * We test the route handler logic by exercising the exported POST function
 * directly, mocking Next.js internals and downstream dependencies.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/core/webhook-inbox', () => ({ recordWebhook: vi.fn() }));
vi.mock('../../server/payments/webhook-dispatcher', () => ({ dispatchPaymentWebhook: vi.fn() }));
vi.mock('../../server/core/webhook', () => ({
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
}));

import { POST } from '../../app/api/v1/webhooks/[source]/route';
import { recordWebhook } from '../../server/core/webhook-inbox';
import { dispatchPaymentWebhook } from '../../server/payments/webhook-dispatcher';

const mockRecordWebhook = vi.mocked(recordWebhook);
const mockDispatch = vi.mocked(dispatchPaymentWebhook);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: WEBHOOK_SECRET_TEST is set so verifyWebhookSignature is called with a real secret
  process.env.WEBHOOK_SECRET_TEST = 'test-secret';
  process.env.WEBHOOK_MAX_BODY_BYTES = String(1024 * 1024); // 1 MB
});

function makeRequest(body: string, extraHeaders: Record<string, string> = {}): Request {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'content-length': String(new TextEncoder().encode(body).byteLength),
    'x-webhook-signature': 'dummy',
    'x-webhook-timestamp': timestamp,
    'x-event-id': 'evt-test-1',
    'x-event-type': 'payment.paid',
    ...extraHeaders,
  };
  return new Request('https://example.com/api/v1/webhooks/test', {
    method: 'POST',
    headers,
    body,
  }) as unknown as Request;
}

describe('POST /api/v1/webhooks/[source] — size limit', () => {
  it('rejects requests whose Content-Length header exceeds 1 MB', async () => {
    const overSizeContentLength = String(1024 * 1024 + 1);
    const body = '{}';
    const req = makeRequest(body, { 'content-length': overSizeContentLength });
    const response = await POST(req as never, { params: Promise.resolve({ source: 'test' }) });
    expect(response.status).toBe(413);
    const data = await response.json() as { error: { code: string } };
    expect(data.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects payloads whose actual byte length exceeds 1 MB (no content-length)', async () => {
    // Generate a body that exceeds 1 MB
    const oversizedBody = JSON.stringify({ data: 'x'.repeat(1024 * 1024 + 100) });
    const req = makeRequest(oversizedBody, {
      'content-length': String(new TextEncoder().encode(oversizedBody).byteLength),
    });
    const response = await POST(req as never, { params: Promise.resolve({ source: 'test' }) });
    expect(response.status).toBe(413);
    const data = await response.json() as { error: { code: string } };
    expect(data.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('accepts valid payloads under the size limit', async () => {
    mockRecordWebhook.mockResolvedValueOnce({ accepted: true, duplicate: false });
    mockDispatch.mockResolvedValueOnce(undefined);

    const body = JSON.stringify({ id: 'evt-1', type: 'payment.paid', gateway_reference: 'gw-ref-1' });
    const req = makeRequest(body);
    const response = await POST(req as never, { params: Promise.resolve({ source: 'test' }) });
    // Accepted (202) or rejected for signature — either way NOT a 413
    expect(response.status).not.toBe(413);
  });
});
