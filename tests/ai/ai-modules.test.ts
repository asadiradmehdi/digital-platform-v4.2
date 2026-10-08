import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withWorkspaceTransaction: vi.fn(), withTenantTransaction: vi.fn(async (_ws: string, _u: string | undefined, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});

import { query } from '../../server/core/db';
import { getModelPrice, resolveModelId, KNOWN_MODELS } from '../../server/ai/model-catalog';
import { estimateAICost } from '../../server/ai/entitlement';
import { startAgentRun, completeAgentRun, failAgentRun, recordToolCall, completeToolCall } from '../../server/ai/agent-run';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('model-catalog', () => {
  it('KNOWN_MODELS contains at least one anthropic and one openai model', () => {
    const providers = new Set(KNOWN_MODELS.map(m => m.providerName));
    expect(providers.has('anthropic')).toBe(true);
    expect(providers.has('openai')).toBe(true);
  });

  it('resolveModelId returns model id when found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'model-uuid-1' }], rowCount: 1 } as never);
    const id = await resolveModelId('claude-sonnet-4-6');
    expect(id).toBe('model-uuid-1');
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE m.model_key=$1'), ['claude-sonnet-4-6']);
  });

  it('resolveModelId returns null when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const id = await resolveModelId('nonexistent-model');
    expect(id).toBeNull();
  });

  it('getModelPrice returns parsed price', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ input_price_minor: '300', output_price_minor: '1500', currency: 'USD' }], rowCount: 1 } as never);
    const price = await getModelPrice('model-uuid-1');
    expect(price?.inputPriceMinorPer1K).toBe(300n);
    expect(price?.outputPriceMinorPer1K).toBe(1500n);
    expect(price?.currency).toBe('USD');
  });

  it('getModelPrice returns null when no price configured', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const price = await getModelPrice('model-uuid-2');
    expect(price).toBeNull();
  });
});

describe('estimateAICost', () => {
  it('calculates cost correctly for 1K tokens', () => {
    const cost = estimateAICost(1000n, 1000n, { inputPriceMinorPer1K: 300n, outputPriceMinorPer1K: 1500n });
    expect(cost).toBe(1800n); // (1000*300 + 1000*1500) / 1000 = 1800
  });

  it('rounds down for sub-1K token counts', () => {
    const cost = estimateAICost(500n, 100n, { inputPriceMinorPer1K: 300n, outputPriceMinorPer1K: 1500n });
    expect(cost).toBe(300n); // (500*300 + 100*1500) / 1000 = 300
  });

  it('returns 0 for 0 tokens', () => {
    const cost = estimateAICost(0n, 0n, { inputPriceMinorPer1K: 300n, outputPriceMinorPer1K: 1500n });
    expect(cost).toBe(0n);
  });
});

describe('agent-run persistence', () => {
  it('startAgentRun inserts and returns run id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'run-1' }], rowCount: 1 } as never);
    const runId = await startAgentRun({ agentDefinitionId: 'def-1', workspaceId: 'ws-1', runInput: { task: 'test' } });
    expect(runId).toBe('run-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agent_runs'),
      ['def-1', 'ws-1', { task: 'test' }]
    );
  });

  it('completeAgentRun updates status to COMPLETED', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await completeAgentRun('run-1', 'ws-1', { result: 'done' });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status='COMPLETED'"),
      ['run-1', { result: 'done' }]
    );
  });

  it('failAgentRun updates status to FAILED with error', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await failAgentRun('run-1', 'ws-1', { message: 'timeout', code: 'RATE_LIMITED' });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status='FAILED'"),
      ['run-1', { message: 'timeout', code: 'RATE_LIMITED' }]
    );
  });

  it('recordToolCall inserts tool call with PENDING status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tc-1' }], rowCount: 1 } as never);
    const tcId = await recordToolCall({ agentRunId: 'run-1', toolName: 'search', authorizationScope: 'read', toolInput: { q: 'hello' } });
    expect(tcId).toBe('tc-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agent_tool_calls'),
      ['run-1', 'search', 'read', { q: 'hello' }]
    );
  });

  it('completeToolCall updates status to COMPLETED', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await completeToolCall('tc-1', { results: [] });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE agent_tool_calls'),
      ['tc-1', { results: [] }, 'COMPLETED']
    );
  });

  it('completeToolCall can mark a tool call FAILED', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await completeToolCall('tc-1', { error: 'not found' }, 'FAILED');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      ['tc-1', { error: 'not found' }, 'FAILED']
    );
  });
});
