import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

import { query } from '../../server/core/db';
import {
  startAgentRun,
  completeAgentRun,
  failAgentRun,
  recordToolCall,
  completeToolCall,
  getAgentRun,
  getAgentRunToolCalls,
} from '../../server/ai/agent-run';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('startAgentRun', () => {
  it('inserts a RUNNING agent_run and returns the id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'run-1' }], rowCount: 1 } as never);
    const id = await startAgentRun({ agentDefinitionId: 'agent-1', workspaceId: 'ws-1', runInput: { prompt: 'hi' } });
    expect(id).toBe('run-1');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('RUNNING');
    expect(sql).toContain('INSERT INTO agent_runs');
    expect(params).toContain('agent-1');
    expect(params).toContain('ws-1');
  });

  it('returns empty string when DB returns no row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const id = await startAgentRun({ agentDefinitionId: 'x', workspaceId: 'y', runInput: {} });
    expect(id).toBe('');
  });
});

describe('completeAgentRun', () => {
  it('updates status to COMPLETED with output and completed_at', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await completeAgentRun('run-1', { answer: '42' });
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status='COMPLETED'");
    expect(sql).toContain('completed_at');
    expect(params[0]).toBe('run-1');
    expect(params[1]).toEqual({ answer: '42' });
  });
});

describe('failAgentRun', () => {
  it('updates status to FAILED with error and completed_at', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await failAgentRun('run-1', { message: 'timeout', code: 'TIMEOUT' });
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status='FAILED'");
    expect(sql).toContain('completed_at');
    expect(params[0]).toBe('run-1');
    expect(params[1]).toEqual({ message: 'timeout', code: 'TIMEOUT' });
  });
});

describe('recordToolCall', () => {
  it('inserts agent_tool_call with PENDING status and returns id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tc-1' }], rowCount: 1 } as never);
    const id = await recordToolCall({
      agentRunId: 'run-1',
      toolName: 'search',
      authorizationScope: 'tools.search',
      toolInput: { query: 'hello' },
    });
    expect(id).toBe('tc-1');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('agent_tool_calls');
    expect(sql).toContain("'PENDING'");
    expect(params).toContain('run-1');
    expect(params).toContain('search');
  });

  it('returns empty string when DB returns no row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const id = await recordToolCall({ agentRunId: 'r', toolName: 't', authorizationScope: 's', toolInput: {} });
    expect(id).toBe('');
  });
});

describe('completeToolCall', () => {
  it('updates tool call to COMPLETED by default', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await completeToolCall('tc-1', { result: 'ok' });
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('agent_tool_calls');
    expect(params[0]).toBe('tc-1');
    expect(params[2]).toBe('COMPLETED');
  });

  it('updates tool call to FAILED when status=FAILED', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await completeToolCall('tc-2', null, 'FAILED');
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[2]).toBe('FAILED');
  });
});

describe('getAgentRun', () => {
  it('fetches agent run scoped by workspaceId', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'run-1', status: 'COMPLETED' }], rowCount: 1 } as never);
    const run = await getAgentRun('run-1', 'ws-1');
    expect(run).toMatchObject({ id: 'run-1', status: 'COMPLETED' });
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('workspace_id=$2');
    expect(params).toEqual(['run-1', 'ws-1']);
  });

  it('returns null when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const run = await getAgentRun('missing', 'ws-1');
    expect(run).toBeNull();
  });
});

describe('getAgentRunToolCalls', () => {
  it('queries tool calls for a run ordered by created_at', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'tc-1', tool_name: 'search' }], rowCount: 1 } as never);
    const calls = await getAgentRunToolCalls('run-1');
    expect(calls).toHaveLength(1);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('agent_run_id=$1');
    expect(sql).toContain('ORDER BY created_at');
    expect(params).toEqual(['run-1']);
  });
});
