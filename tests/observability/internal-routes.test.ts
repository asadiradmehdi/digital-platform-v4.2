/**
 * Tests that internal API routes (/api/internal/metrics and /api/internal/alerts)
 * reject requests without the correct INTERNAL_API_SECRET header.
 * These tests exercise the route handler logic directly without a running server.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the observability modules to avoid side effects — must be hoisted before imports
vi.mock('../../server/observability/metrics', () => ({
  snapshotMetrics: vi.fn().mockReturnValue([]),
  resetMetrics: vi.fn(),
  increment: vi.fn(),
}));
vi.mock('../../server/observability/alerts', () => ({
  runAlertScan: vi.fn().mockResolvedValue([]),
  evaluateAlertRules: vi.fn().mockReturnValue([]),
  DEFAULT_ALERT_RULES: [],
}));

// Static imports — loaded once and reused across tests; env var is read at call time
import { GET as metricsGet } from '../../app/api/internal/metrics/route';
import { POST as alertsPost } from '../../app/api/internal/alerts/route';

const ORIGINAL_SECRET = process.env.INTERNAL_API_SECRET;

function metricsReq(secret?: string) {
  return new NextRequest('http://localhost/api/internal/metrics', {
    headers: secret ? { 'x-internal-secret': secret } : {},
  });
}

function alertsReq(secret?: string) {
  return new NextRequest('http://localhost/api/internal/alerts', {
    method: 'POST',
    headers: secret ? { 'x-internal-secret': secret } : {},
  });
}

afterEach(() => {
  if (ORIGINAL_SECRET !== undefined) {
    process.env.INTERNAL_API_SECRET = ORIGINAL_SECRET;
  } else {
    delete process.env.INTERNAL_API_SECRET;
  }
});

describe('GET /api/internal/metrics — secret protection', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = 'test-secret-xyz';
  });

  it('returns 401 when no secret header is provided', async () => {
    const res = await metricsGet(metricsReq());
    expect(res.status).toBe(401);
  }, 10000);

  it('returns 401 when wrong secret is provided', async () => {
    const res = await metricsGet(metricsReq('wrong-secret'));
    expect(res.status).toBe(401);
  }, 10000);

  it('returns 200 with metrics when correct secret is provided', async () => {
    const res = await metricsGet(metricsReq('test-secret-xyz'));
    expect(res.status).toBe(200);
    const body = await res.json() as { metrics: unknown[]; count: number };
    expect(body).toHaveProperty('metrics');
  }, 10000);

  it('returns 401 when INTERNAL_API_SECRET is not configured', async () => {
    delete process.env.INTERNAL_API_SECRET;
    // Any value in header should still fail because secret is not configured
    const res = await metricsGet(metricsReq('any-value'));
    expect(res.status).toBe(401);
  }, 10000);
});

describe('POST /api/internal/alerts — secret protection', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = 'alert-secret-abc';
  });

  it('returns 401 when no secret header is provided', async () => {
    const res = await alertsPost(alertsReq());
    expect(res.status).toBe(401);
  }, 10000);

  it('returns 401 when wrong secret is provided', async () => {
    const res = await alertsPost(alertsReq('bad-secret'));
    expect(res.status).toBe(401);
  }, 10000);

  it('returns 200 with firings when correct secret is provided', async () => {
    const res = await alertsPost(alertsReq('alert-secret-abc'));
    expect(res.status).toBe(200);
    const body = await res.json() as { firings: unknown[]; count: number };
    expect(body).toHaveProperty('firings');
  }, 10000);
});
