import { describe, expect, it, vi } from 'vitest';
import {
  authorizeAgentTool,
  executeAgentTool,
  type AgentDefinition,
  type AgentTool,
  type AgentExecutionContext,
} from '../../server/ai/agent-framework';

// ── helpers ────────────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'agent-1',
    workspaceId: 'ws-1',
    active: true,
    permissions: ['read', 'write'],
    budget: { maxToolCalls: 5, maxRuntimeMs: 60_000 },
    ...overrides,
  };
}

function makeCtx(agent: AgentDefinition, overrides: Partial<AgentExecutionContext> = {}): AgentExecutionContext {
  return {
    runId: 'run-1',
    agent,
    startedAt: Date.now(),
    toolCalls: 0,
    estimatedCostMinor: 0n,
    ...overrides,
  };
}

const readTool: AgentTool = {
  name: 'readDocs',
  permissions: ['read'],
  execute: vi.fn().mockResolvedValue({ docs: ['doc1'] }),
};

const financialTool: AgentTool = {
  name: 'processRefund',
  permissions: ['financial'],
  sideEffecting: true,
  execute: vi.fn().mockResolvedValue({ refunded: true }),
};

const multiPermTool: AgentTool = {
  name: 'externalFetch',
  permissions: ['read', 'external_http'],
  execute: vi.fn().mockResolvedValue({ data: 'external' }),
};

// ── authorizeAgentTool ────────────────────────────────────────────────────

describe('authorizeAgentTool', () => {
  it('allows tool when agent has all required permissions', () => {
    const agent = makeAgent({ permissions: ['read'] });
    expect(() => authorizeAgentTool(agent, readTool)).not.toThrow();
  });

  it('throws FORBIDDEN when agent lacks a required permission', () => {
    const agent = makeAgent({ permissions: ['read'] });
    expect(() => authorizeAgentTool(agent, financialTool)).toThrow();
  });

  it('throws FORBIDDEN when agent is inactive', () => {
    const agent = makeAgent({ active: false, permissions: ['read', 'financial'] });
    expect(() => authorizeAgentTool(agent, financialTool)).toThrow('Agent is inactive');
  });

  it('requires all permissions in multi-permission tool', () => {
    const agent = makeAgent({ permissions: ['read'] }); // missing external_http
    expect(() => authorizeAgentTool(agent, multiPermTool)).toThrow();
  });

  it('allows multi-permission tool when agent has all required permissions', () => {
    const agent = makeAgent({ permissions: ['read', 'external_http'] });
    expect(() => authorizeAgentTool(agent, multiPermTool)).not.toThrow();
  });
});

// ── executeAgentTool — permission checks ──────────────────────────────────

describe('executeAgentTool — permission enforcement', () => {
  it('executes tool when authorized', async () => {
    const agent = makeAgent({ permissions: ['read'] });
    const ctx = makeCtx(agent);
    const result = await executeAgentTool(readTool, {}, ctx);
    expect(result).toMatchObject({ docs: ['doc1'] });
  });

  it('throws when agent lacks permission', async () => {
    const agent = makeAgent({ permissions: [] });
    const ctx = makeCtx(agent);
    await expect(executeAgentTool(readTool, {}, ctx)).rejects.toThrow();
  });
});

// ── executeAgentTool — budget enforcement ─────────────────────────────────

describe('executeAgentTool — tool-call budget', () => {
  it('throws RATE_LIMITED when tool-call budget is exactly at limit', async () => {
    const agent = makeAgent({ permissions: ['read'], budget: { maxToolCalls: 2, maxRuntimeMs: 60_000 } });
    const ctx = makeCtx(agent, { toolCalls: 2 }); // already at max
    await expect(executeAgentTool(readTool, {}, ctx)).rejects.toThrow('tool-call budget exceeded');
  });

  it('allows execution when toolCalls is one below the limit', async () => {
    const agent = makeAgent({ permissions: ['read'], budget: { maxToolCalls: 2, maxRuntimeMs: 60_000 } });
    const ctx = makeCtx(agent, { toolCalls: 1 });
    await expect(executeAgentTool(readTool, {}, ctx)).resolves.toBeDefined();
  });

  it('increments toolCalls counter after successful execution', async () => {
    const agent = makeAgent({ permissions: ['read'] });
    const ctx = makeCtx(agent, { toolCalls: 0 });
    await executeAgentTool(readTool, {}, ctx);
    expect(ctx.toolCalls).toBe(1);
  });
});

// ── executeAgentTool — runtime budget ────────────────────────────────────

describe('executeAgentTool — runtime budget', () => {
  it('throws RATE_LIMITED when runtime has exceeded budget', async () => {
    const agent = makeAgent({
      permissions: ['read'],
      budget: { maxToolCalls: 10, maxRuntimeMs: 100 }, // 100ms budget
    });
    // startedAt is far in the past to simulate elapsed time
    const ctx = makeCtx(agent, { startedAt: Date.now() - 200 });
    await expect(executeAgentTool(readTool, {}, ctx)).rejects.toThrow('runtime budget exceeded');
  });
});

// ── executeAgentTool — cost budget ────────────────────────────────────────

describe('executeAgentTool — estimated cost budget', () => {
  it('throws PAYMENT_REQUIRED when adding cost would exceed budget', async () => {
    const agent = makeAgent({
      permissions: ['read'],
      budget: { maxToolCalls: 10, maxRuntimeMs: 60_000, maxEstimatedCostMinor: 100n, currency: 'USD' },
    });
    const ctx = makeCtx(agent, { estimatedCostMinor: 90n });
    // Adding 20 would exceed 100
    await expect(executeAgentTool(readTool, {}, ctx, 20n)).rejects.toThrow('cost budget exceeded');
  });

  it('allows execution when cumulative cost is exactly at budget', async () => {
    const agent = makeAgent({
      permissions: ['read'],
      budget: { maxToolCalls: 10, maxRuntimeMs: 60_000, maxEstimatedCostMinor: 100n, currency: 'USD' },
    });
    const ctx = makeCtx(agent, { estimatedCostMinor: 80n });
    // 80 + 20 = 100, not exceeding
    await expect(executeAgentTool(readTool, {}, ctx, 20n)).resolves.toBeDefined();
  });

  it('accumulates estimated cost after execution', async () => {
    const agent = makeAgent({ permissions: ['read'] });
    const ctx = makeCtx(agent, { estimatedCostMinor: 50n });
    await executeAgentTool(readTool, {}, ctx, 30n);
    expect(ctx.estimatedCostMinor).toBe(80n);
  });

  it('allows unlimited cost when maxEstimatedCostMinor is not set', async () => {
    const agent = makeAgent({
      permissions: ['read'],
      budget: { maxToolCalls: 10, maxRuntimeMs: 60_000 }, // no cost budget
    });
    const ctx = makeCtx(agent, { estimatedCostMinor: 999_999n });
    await expect(executeAgentTool(readTool, {}, ctx, 999_999n)).resolves.toBeDefined();
  });
});

// ── executeAgentTool — input forwarding ──────────────────────────────────

describe('executeAgentTool — input forwarding', () => {
  it('passes input to tool execute', async () => {
    const executeFn = vi.fn().mockResolvedValue({});
    const tool: AgentTool = { name: 'passThrough', permissions: ['read'], execute: executeFn };
    const agent = makeAgent({ permissions: ['read'] });
    const ctx = makeCtx(agent);
    const input = { param: 'value', count: 42 };
    await executeAgentTool(tool, input, ctx);
    expect(executeFn).toHaveBeenCalledWith(input, ctx);
  });

  it('passes execution context to tool execute', async () => {
    const executeFn = vi.fn().mockResolvedValue({});
    const tool: AgentTool = { name: 'ctxTool', permissions: ['read'], execute: executeFn };
    const agent = makeAgent({ permissions: ['read'] });
    const ctx = makeCtx(agent, { runId: 'run-ctx-test' });
    await executeAgentTool(tool, {}, ctx);
    const calledCtx = executeFn.mock.calls[0][1] as AgentExecutionContext;
    expect(calledCtx.runId).toBe('run-ctx-test');
  });
});
