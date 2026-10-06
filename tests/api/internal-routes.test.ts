/**
 * Unit tests for internal API routes:
 *   GET  /api/internal/metrics    (observability metrics snapshot)
 *   POST /api/internal/alerts     (alert scan trigger)
 *   POST /api/internal/pricing/refresh (FX + pricing cron refresh)
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/observability/metrics', () => ({ snapshotMetrics: vi.fn() }));
vi.mock('../../server/observability/alerts', () => ({ runAlertScan: vi.fn() }));
vi.mock('../../server/pricing/service', () => ({ refreshPricing: vi.fn() }));
vi.mock('../../server/pricing/providers', () => ({
  HttpFxProvider: vi.fn().mockImplementation(() => ({ name: 'mock-fx-provider' })),
}));

import { snapshotMetrics } from '../../server/observability/metrics';
import { runAlertScan } from '../../server/observability/alerts';
import { refreshPricing } from '../../server/pricing/service';

const mockSnapshotMetrics = vi.mocked(snapshotMetrics);
const mockRunAlertScan = vi.mocked(runAlertScan);
const mockRefreshPricing = vi.mocked(refreshPricing);

beforeEach(() => {
  vi.resetAllMocks();
  process.env.INTERNAL_API_SECRET = 'test-internal-secret';
  process.env.PRICING_CRON_SECRET = 'test-cron-secret';
  process.env.FX_PROVIDER_URL = 'http://mock-fx.example.com/api';
});

type MetricsModule = typeof import('../../app/api/internal/metrics/route');
type AlertsModule = typeof import('../../app/api/internal/alerts/route');
type PricingRefreshModule = typeof import('../../app/api/internal/pricing/refresh/route');

let GET_METRICS: MetricsModule['GET'];
let POST_ALERTS: AlertsModule['POST'];
let POST_PRICING_REFRESH: PricingRefreshModule['POST'];

beforeAll(async () => {
  ({ GET: GET_METRICS } = await import('../../app/api/internal/metrics/route'));
  ({ POST: POST_ALERTS } = await import('../../app/api/internal/alerts/route'));
  ({ POST: POST_PRICING_REFRESH } = await import('../../app/api/internal/pricing/refresh/route'));
}, 60000);

function makeInternalRequest(method: string, secret?: string): import('next/server').NextRequest {
  return {
    json: async () => ({}),
    headers: {
      get: (k: string) => {
        if (k === 'x-internal-secret') return secret ?? 'test-internal-secret';
        return null;
      },
    },
    url: 'http://localhost:3000/api/internal/metrics',
    method,
  } as unknown as import('next/server').NextRequest;
}

function makeCronRequest(secret?: string): Request {
  return {
    headers: {
      get: (k: string) => {
        if (k === 'authorization') return `Bearer ${secret ?? 'test-cron-secret'}`;
        return null;
      },
    },
    url: 'http://localhost:3000/api/internal/pricing/refresh',
    method: 'POST',
  } as unknown as Request;
}

// ─── Internal Metrics ────────────────────────────────────────────────────────

describe('GET /api/internal/metrics', () => {
  it('returns 200 with metrics snapshot when secret is valid', async () => {
    mockSnapshotMetrics.mockReturnValueOnce([{ name: 'req_count', value: 42 }] as never);

    const response = await GET_METRICS(makeInternalRequest('GET'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.metrics).toHaveLength(1);
    expect(data.count).toBe(1);
  });

  it('returns 401 when internal secret is wrong', async () => {
    const response = await GET_METRICS(makeInternalRequest('GET', 'wrong-secret'));
    expect(response.status).toBe(401);
  });

  it('returns 401 when INTERNAL_API_SECRET is not configured', async () => {
    delete process.env.INTERNAL_API_SECRET;

    const response = await GET_METRICS(makeInternalRequest('GET', 'any-secret'));
    expect(response.status).toBe(401);
  });
});

// ─── Internal Alerts ─────────────────────────────────────────────────────────

describe('POST /api/internal/alerts', () => {
  it('returns 200 with alert firings when secret is valid', async () => {
    mockRunAlertScan.mockResolvedValueOnce([{ rule: 'high-error-rate', fired: true }] as never);

    const response = await POST_ALERTS(makeInternalRequest('POST'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.firings).toHaveLength(1);
    expect(data.count).toBe(1);
  });

  it('returns 401 when internal secret is wrong', async () => {
    const response = await POST_ALERTS(makeInternalRequest('POST', 'wrong-secret'));
    expect(response.status).toBe(401);
  });
});

// ─── Pricing Refresh ─────────────────────────────────────────────────────────

describe('POST /api/internal/pricing/refresh', () => {
  it('returns 200 after successful pricing refresh', async () => {
    mockRefreshPricing.mockResolvedValueOnce({ updated: 3 } as never);

    const response = await POST_PRICING_REFRESH(makeCronRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.updated).toBe(3);
  });

  it('returns 401 when cron secret is wrong', async () => {
    const response = await POST_PRICING_REFRESH(makeCronRequest('wrong-cron-secret'));
    expect(response.status).toBe(401);
  });
});
