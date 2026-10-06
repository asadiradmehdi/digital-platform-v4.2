/**
 * Unit tests for GET /api/v1/health
 * Verifies liveness check with database connectivity status.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';

const mockQuery = vi.mocked(query);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/health/route');
let GET: RouteModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/health/route'));
}, 60000);

describe('GET /api/v1/health', () => {
  it('returns 200 with ok:true when database is reachable', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 } as never);

    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe('healthy');
    expect(data.checks.database).toBe('up');
  });

  it('returns 503 with ok:false when database is unreachable', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

    const response = await GET();
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.status).toBe('degraded');
    expect(data.checks.database).toBe('down');
  });
});
