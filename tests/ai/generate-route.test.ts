/**
 * Unit tests for POST /api/v1/ai/generate
 * Verifies auth, permission, model resolution, entitlement, and non-streaming generation.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/ai/model-catalog', () => ({
  resolveModelId: vi.fn(),
  getModelPrice: vi.fn(),
}));
vi.mock('../../server/ai/entitlement', () => ({
  checkAIEntitlement: vi.fn(),
  recordAIRequest: vi.fn(),
  completeAIRequest: vi.fn(),
  failAIRequest: vi.fn(),
  estimateAICost: vi.fn(),
}));
vi.mock('../../server/ai/cost-accounting', () => ({ recordAICost: vi.fn() }));
vi.mock('../../server/ai/streaming', () => ({ createStreamingResponse: vi.fn() }));
vi.mock('../../server/core/db', () => ({ withTenantTransaction: vi.fn() }));
vi.mock('../../server/observability/tracing', () => ({
  withSpan: vi.fn(),
  parseTraceparent: vi.fn().mockReturnValue(null),
}));
vi.mock('../../server/ai/providers/anthropic', () => ({ anthropicAdapter: {} }));
vi.mock('../../server/ai/providers/openai', () => ({ openaiAdapter: {} }));

const mockGenerate = vi.fn();
vi.mock('../../server/ai/gateway', () => ({
  AIGateway: vi.fn().mockImplementation(() => ({ generate: mockGenerate })),
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { resolveModelId, getModelPrice } from '../../server/ai/model-catalog';
import {
  checkAIEntitlement, recordAIRequest, completeAIRequest, estimateAICost,
} from '../../server/ai/entitlement';
import { recordAICost } from '../../server/ai/cost-accounting';
import { withSpan } from '../../server/observability/tracing';
import { AppError } from '../../server/core/errors';
import { withTenantTransaction } from '../../server/core/db';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockResolveModel = vi.mocked(resolveModelId);
const mockGetModelPrice = vi.mocked(getModelPrice);
const mockCheckEntitlement = vi.mocked(checkAIEntitlement);
const mockRecordAIRequest = vi.mocked(recordAIRequest);
const mockCompleteAIRequest = vi.mocked(completeAIRequest);
const mockEstimateCost = vi.mocked(estimateAICost);
const mockRecordAICost = vi.mocked(recordAICost);
const mockWithSpan = vi.mocked(withSpan);

const mockTx = vi.mocked(withTenantTransaction);
const txClient = { query: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  mockTx.mockImplementation((async (_ws: string, _u: string | undefined, fn: (c: typeof txClient) => unknown) => fn(txClient)) as never);
});

type RouteModule = typeof import('../../app/api/v1/ai/generate/route');
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ POST } = await import('../../app/api/v1/ai/generate/route'));
}, 60000);

function makeRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (_k: string) => null },
    url: 'http://localhost:3000/api/v1/ai/generate',
    method: 'POST',
    signal: { addEventListener: vi.fn() },
  } as unknown as import('next/server').NextRequest;
}

const validBody = {
  workspaceId: 'ws-1',
  model: 'claude-haiku-4-5-20251001',
  messages: [{ role: 'user', content: 'Hello' }],
};

const generateResult = {
  text: 'Hi there!',
  inputUnits: 10n,
  outputUnits: 5n,
  providerRequestId: 'pr-1',
};

describe('POST /api/v1/ai/generate', () => {
  it('returns 200 with generation result on success', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockResolveModel.mockResolvedValueOnce('claude-haiku-4-5-20251001' as never);
    mockCheckEntitlement.mockResolvedValueOnce(undefined as never);
    mockRecordAIRequest.mockResolvedValueOnce('ai-req-1' as never);
    mockWithSpan.mockImplementationOnce((_name, _meta, fn) =>
      Promise.resolve({ value: generateResult, durationMs: 350, trace: { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: '01' } })
    );
    mockCompleteAIRequest.mockResolvedValueOnce(undefined as never);
    mockGetModelPrice.mockResolvedValueOnce(null as never);

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.aiRequestId).toBe('ai-req-1');
    expect(data.text).toBe('Hi there!');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const response = await POST(makeRequest({ workspaceId: 'ws-1' }));
    expect(response.status).toBe(400);
  });

  it('returns 403 when user lacks ai.generate permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(403);
  });

  it('returns 404 when model is not found', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockResolveModel.mockResolvedValueOnce(null as never);

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(404);
  });

  it('returns 402 when AI entitlement is exhausted', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockResolveModel.mockResolvedValueOnce('claude-haiku-4-5-20251001' as never);
    mockCheckEntitlement.mockRejectedValueOnce(new AppError('PAYMENT_REQUIRED', 'AI quota exhausted.'));

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(402);
  });

  it('records AI cost when model price is available', async () => {
    const price = { inputUnitCostMinor: 1n, outputUnitCostMinor: 2n, currency: 'IRR' };
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockResolveModel.mockResolvedValueOnce('claude-haiku-4-5-20251001' as never);
    mockCheckEntitlement.mockResolvedValueOnce(undefined as never);
    mockRecordAIRequest.mockResolvedValueOnce('ai-req-2' as never);
    mockWithSpan.mockImplementationOnce((_name, _meta, fn) =>
      Promise.resolve({ value: generateResult, durationMs: 200, trace: { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: '01' } })
    );
    mockCompleteAIRequest.mockResolvedValueOnce(undefined as never);
    mockGetModelPrice.mockResolvedValueOnce(price as never);
    mockEstimateCost.mockReturnValueOnce(20n as never);
    mockRecordAICost.mockResolvedValueOnce(undefined as never);

    await POST(makeRequest(validBody));
    expect(mockRecordAICost).toHaveBeenCalledWith(
      expect.objectContaining({ aiRequestId: 'ai-req-2', costMinor: 20n })
    );
  });

  it('writes ai_cost_events through the workspace RLS transaction (regression: pool query was rejected)', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockResolveModel.mockResolvedValueOnce('claude-haiku-4-5-20251001' as never);
    mockCheckEntitlement.mockResolvedValueOnce(undefined as never);
    mockRecordAIRequest.mockResolvedValueOnce('ai-req-3' as never);
    mockWithSpan.mockImplementationOnce((_name, _meta, _fn) =>
      Promise.resolve({ value: generateResult, durationMs: 200, trace: { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: '01' } })
    );
    mockGetModelPrice.mockResolvedValueOnce({ inputUnitCostMinor: 1n, outputUnitCostMinor: 2n, currency: 'IRR' } as never);
    mockEstimateCost.mockReturnValueOnce(5n as never);
    mockRecordAICost.mockImplementationOnce(async input => { await input.query('INSERT INTO ai_cost_events', []); });

    await POST(makeRequest(validBody));
    expect(mockCompleteAIRequest).toHaveBeenCalledWith('ai-req-3', 'ws-1', 10n, 5n, 200);
    expect(mockTx).toHaveBeenCalledWith('ws-1', 'user-1', expect.any(Function));
    expect(txClient.query).toHaveBeenCalledWith('INSERT INTO ai_cost_events', []);
  });
});
