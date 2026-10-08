import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withTenantTransaction: vi.fn(async (_ws: string, _u: string | undefined, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});
vi.mock('../../server/core/security', () => ({
  redactSecrets: vi.fn((obj: unknown) => obj),
}));

import { query, withTenantTransaction } from '../../server/core/db';
import { recordOperationalEvent } from '../../server/observability/operational-events';
import { redactSecrets } from '../../server/core/security';

const mockQuery = vi.mocked(query);
const mockRedact = vi.mocked(redactSecrets);

beforeEach(() => vi.clearAllMocks());

describe('recordOperationalEvent', () => {
  it('inserts an operational event with all fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    await recordOperationalEvent({
      workspaceId: 'ws-1',
      correlationId: 'cid-1',
      requestId: 'req-1',
      eventType: 'ORDER_CREATED',
      severity: 'INFO',
      entityType: 'order',
      entityId: 'ord-1',
      metadata: { amount: 5000 },
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO operational_events'),
      expect.arrayContaining(['ws-1', 'cid-1', 'req-1', 'ORDER_CREATED', 'INFO', 'order', 'ord-1'])
    );
  });

  it('uses INFO severity by default when severity is omitted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    await recordOperationalEvent({ eventType: 'STALE_RATE_DETECTED' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['INFO'])
    );
  });

  it('passes null for optional omitted fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    await recordOperationalEvent({ eventType: 'TEST_EVENT' });

    const args = mockQuery.mock.calls[0][1] as unknown[];
    // First three args (workspaceId, correlationId, requestId) should all be null
    expect(args[0]).toBeNull();
    expect(args[1]).toBeNull();
    expect(args[2]).toBeNull();
  });

  it('calls redactSecrets on metadata before persisting', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    const metadata = { secret: 'super-secret', safe: 'value' };

    await recordOperationalEvent({ eventType: 'AUDIT', metadata });

    expect(mockRedact).toHaveBeenCalledWith(metadata);
  });

  it('propagates database errors', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB unavailable') as never);

    await expect(recordOperationalEvent({ eventType: 'FAIL_EVENT' })).rejects.toThrow('DB unavailable');
  });
});

describe('operational_events RLS context', () => {
  // Regression: operational_events has FORCE RLS; every insert through the plain pool was rejected under
  // the production role (and the callers swallowed the error), so no operational evidence was stored.
  it('writes workspace events inside that workspace\'s transaction', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    await recordOperationalEvent({ workspaceId: 'ws-5', eventType: 'pricing.stale_rate' });
    expect(vi.mocked(withTenantTransaction)).toHaveBeenCalledWith('ws-5', undefined, expect.any(Function));
  });

  it('writes platform events (no workspace) without any tenant context', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    await recordOperationalEvent({ eventType: 'alert.fired' });
    expect(vi.mocked(withTenantTransaction)).not.toHaveBeenCalled();
    expect((mockQuery.mock.calls[0][1] as unknown[])[0]).toBeNull();
  });
});
