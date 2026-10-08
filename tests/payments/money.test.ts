import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return {
    query,
    withWorkspaceTransaction: vi.fn(async (_wid: string, _opts: unknown, fn: Function) => fn({ query: vi.fn() })),
    withTenantTransaction: vi.fn(async (_wid: string, _opts: unknown, fn: Function) => fn({ query })),
  };
});
vi.mock('../../server/core/idempotency', () => ({
  requireIdempotencyKey: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { dispatchPaymentWebhook } from '../../server/payments/webhook-dispatcher';
import { query } from '../../server/core/db';

const mockQuery = vi.mocked(query);
const mockTx = vi.mocked(withWorkspaceTransaction);

beforeEach(() => {
  vi.clearAllMocks();
});

// Refund behaviour: tests/payments/refund.test.ts and tests/integration/money-flows.pg.test.ts.

describe('dispatchPaymentWebhook', () => {
  it('does nothing for unrecognized event types', async () => {
    await dispatchPaymentWebhook({ source: 'acme', eventType: 'customer.created', payload: {}, correlationId: 'c1' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('does nothing when no gateway reference in payload', async () => {
    await dispatchPaymentWebhook({ source: 'acme', eventType: 'payment.paid', payload: {}, correlationId: 'c2' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('ignores a webhook from a source that is not a usable gateway, without touching the database', async () => {
    // Regression (H-3): webhooks used to mark the payment paid from the payload alone.
    await dispatchPaymentWebhook({ source: 'acme', eventType: 'payment.paid', payload: { gateway_reference: 'gw-ref-1' }, correlationId: 'c3' });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockTx).not.toHaveBeenCalled();
  });
});
