import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

import { query } from '../../server/core/db';
import { recordWebhook } from '../../server/core/webhook-inbox';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

const base = {
  source: 'stripe',
  eventId: 'evt-123',
  eventType: 'payment.paid',
  signatureValid: true,
  payload: { id: 'evt-123' },
};

describe('recordWebhook', () => {
  it('throws UNAUTHORIZED when signatureValid is false', async () => {
    await expect(recordWebhook({ ...base, signatureValid: false })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns accepted=true when row is inserted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'wh-1' }], rowCount: 1 } as never);
    const result = await recordWebhook(base);
    expect(result.accepted).toBe(true);
    expect(result.duplicate).toBe(false);
  });

  it('returns duplicate=true when ON CONFLICT DO NOTHING yields no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await recordWebhook(base);
    expect(result.accepted).toBe(false);
    expect(result.duplicate).toBe(true);
  });

  it('passes source, eventId, eventType, payload to DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'wh-1' }], rowCount: 1 } as never);
    await recordWebhook(base);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO webhook_events');
    expect(sql).toContain('ON CONFLICT');
    expect(params).toContain('stripe');
    expect(params).toContain('evt-123');
    expect(params).toContain('payment.paid');
  });
});
