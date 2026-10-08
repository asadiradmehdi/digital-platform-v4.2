import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withTenantTransaction: vi.fn(async (_ws: string, _u: string | undefined, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});

import { query, withTenantTransaction } from '../../server/core/db';
import { recordApiUsage, getApiUsageSummary, getApiKeyUsage } from '../../server/b2b/usage';

const mockQuery = vi.mocked(query);
const mockTx = vi.mocked(withTenantTransaction);

beforeEach(() => vi.clearAllMocks());

// Regression: api_usage_events and api_keys have FORCE RLS. Usage was written and read through the
// plain pool, so under the production role inserts were rejected and summaries were always empty.
describe('b2b usage RLS context', () => {
  it('records the usage event and last_used_at in one workspace transaction', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);
    await recordApiUsage({ apiKeyId: 'key-1', workspaceId: 'ws-1', route: '/v1/x', statusCode: 200, latencyMs: 12 });
    expect(mockTx).toHaveBeenCalledTimes(1);
    expect(mockTx).toHaveBeenCalledWith('ws-1', undefined, expect.any(Function));
    expect(String(mockQuery.mock.calls[0][0])).toContain('INSERT INTO api_usage_events');
    expect(mockQuery.mock.calls[0][1]).toEqual(['key-1', 'ws-1', '/v1/x', 200, 12]);
    expect(String(mockQuery.mock.calls[1][0])).toContain('UPDATE api_keys SET last_used_at=now()');
  });

  it('reads the usage summary and per-key events inside the workspace context', async () => {
    mockQuery.mockResolvedValue({ rows: [{ route: '/v1/x' }], rowCount: 1 } as never);
    expect(await getApiUsageSummary('ws-s')).toEqual([{ route: '/v1/x' }]);
    expect(await getApiKeyUsage('key-1', 'ws-k', 10)).toEqual([{ route: '/v1/x' }]);
    expect(mockTx.mock.calls.map(c => c[0])).toEqual(['ws-s', 'ws-k']);
    expect(mockQuery.mock.calls[1][1]).toEqual(['key-1', 'ws-k', 10]);
  });
});
