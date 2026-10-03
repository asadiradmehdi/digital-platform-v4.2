import { describe, expect, it, vi } from 'vitest';
import {
  validateWorkflowForExecution,
  executeWorkflow,
  type ActionExecutor,
  type WorkflowRunContext,
} from '../../server/automation/engine';
import type { WorkflowDefinition } from '../../server/automation/contracts';

// ── helpers ────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<WorkflowRunContext> = {}): WorkflowRunContext {
  return {
    runId: 'run-1',
    workspaceId: 'ws-1',
    startedAt: Date.now(),
    maxSteps: 10,
    stepsExecuted: 0,
    ...overrides,
  };
}

const webhookTrigger = { type: 'webhook' as const, config: {} };

// ── validateWorkflowForExecution ──────────────────────────────────────────

describe('validateWorkflowForExecution', () => {
  it('accepts a minimal valid workflow', () => {
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'a', action: { type: 'notification', config: {} } }],
    };
    expect(validateWorkflowForExecution(def)).toBe(true);
  });

  it('rejects step count exceeding maxSteps limit', () => {
    const steps = Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      action: { type: 'notification' as const, config: {} },
    }));
    const def: WorkflowDefinition = { version: 1, triggers: [webhookTrigger], steps };
    expect(() => validateWorkflowForExecution(def, { maxSteps: 5, maxDelayMs: 86_400_000 })).toThrow(
      'Workflow exceeds maximum step count',
    );
  });

  it('rejects delay step with ms exceeding maxDelayMs', () => {
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'a', action: { type: 'delay', config: { ms: 90_000_000 } } }],
    };
    expect(() => validateWorkflowForExecution(def)).toThrow('outside the allowed range');
  });

  it('rejects delay with negative ms', () => {
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'a', action: { type: 'delay', config: { ms: -1 } } }],
    };
    expect(() => validateWorkflowForExecution(def)).toThrow('outside the allowed range');
  });

  it('rejects delay with non-integer ms', () => {
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'a', action: { type: 'delay', config: { ms: 1.5 } } }],
    };
    expect(() => validateWorkflowForExecution(def)).toThrow('outside the allowed range');
  });

  it('accepts delay step within allowed range', () => {
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'a', action: { type: 'delay', config: { ms: 60_000 } } }],
    };
    expect(validateWorkflowForExecution(def)).toBe(true);
  });

  it('rejects HTTP step without explicit allowlist', () => {
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'a', action: { type: 'http', config: { url: 'https://example.com' } } }],
    };
    expect(() => validateWorkflowForExecution(def)).toThrow('explicit destination allowlist');
  });

  it('accepts HTTP step with allowlist:true', () => {
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'a', action: { type: 'http', config: { url: 'https://example.com', allowlist: true } } }],
    };
    expect(validateWorkflowForExecution(def)).toBe(true);
  });
});

// ── executeWorkflow ───────────────────────────────────────────────────────

describe('executeWorkflow', () => {
  it('executes a single-step workflow and returns output', async () => {
    const executor: ActionExecutor = vi.fn().mockResolvedValue({ result: 'ok' });
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'a', action: { type: 'notification', config: {} } }],
    };
    const output = await executeWorkflow(def, { input: 'data' }, executor, makeCtx());
    expect(output).toMatchObject({ input: 'data', result: 'ok' });
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('chains two steps in sequence, merging data', async () => {
    const executor: ActionExecutor = vi
      .fn()
      .mockResolvedValueOnce({ step1: 'done' })
      .mockResolvedValueOnce({ step2: 'done' });

    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [
        { id: 'a', action: { type: 'notification', config: {} }, next: ['b'] },
        { id: 'b', action: { type: 'notification', config: {} } },
      ],
    };
    const output = await executeWorkflow(def, {}, executor, makeCtx());
    expect(output).toMatchObject({ step1: 'done', step2: 'done' });
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('throws when step budget is exceeded mid-run', async () => {
    const executor: ActionExecutor = vi.fn().mockResolvedValue({});
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [
        { id: 'a', action: { type: 'notification', config: {} }, next: ['b'] },
        { id: 'b', action: { type: 'notification', config: {} } },
      ],
    };
    // maxSteps=1 but workflow has 2 steps in chain
    const ctx = makeCtx({ maxSteps: 1 });
    await expect(executeWorkflow(def, {}, executor, ctx)).rejects.toThrow('step budget exceeded');
  });

  it('propagates executor errors upward', async () => {
    const executor: ActionExecutor = vi.fn().mockRejectedValue(new Error('Provider unavailable'));
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'a', action: { type: 'provider', config: {} } }],
    };
    await expect(executeWorkflow(def, {}, executor, makeCtx())).rejects.toThrow('Provider unavailable');
  });

  it('executes SEND_MESSAGE (notification) step type', async () => {
    const executor: ActionExecutor = vi.fn().mockResolvedValue({ sent: true });
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'notify', action: { type: 'notification', config: { template: 'welcome' } } }],
    };
    const output = await executeWorkflow(def, {}, executor, makeCtx());
    expect(output).toMatchObject({ sent: true });
    const callArg = (executor as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.type).toBe('notification');
  });

  it('executes HTTP_REQUEST step type', async () => {
    const executor: ActionExecutor = vi.fn().mockResolvedValue({ status: 200 });
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'http', action: { type: 'http', config: { url: 'https://hook.example.com', allowlist: true } } }],
    };
    const output = await executeWorkflow(def, {}, executor, makeCtx());
    expect(output).toMatchObject({ status: 200 });
    const callArg = (executor as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.type).toBe('http');
  });

  it('executes AI step type', async () => {
    const executor: ActionExecutor = vi.fn().mockResolvedValue({ aiOutput: 'generated text' });
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'ai', action: { type: 'ai', config: { model: 'claude-3-haiku' } } }],
    };
    const output = await executeWorkflow(def, {}, executor, makeCtx());
    expect(output).toMatchObject({ aiOutput: 'generated text' });
  });

  it('executes DELAY step type', async () => {
    const executor: ActionExecutor = vi.fn().mockResolvedValue({ delayed: true });
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'wait', action: { type: 'delay', config: { ms: 1000 } } }],
    };
    const output = await executeWorkflow(def, {}, executor, makeCtx());
    expect(output).toMatchObject({ delayed: true });
    const callArg = (executor as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.type).toBe('delay');
    expect(callArg.config.ms).toBe(1000);
  });

  it('executes BRANCH step type with conditional routing', async () => {
    const executor: ActionExecutor = vi.fn().mockResolvedValue({ branched: 'yes' });
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [{ id: 'branch', action: { type: 'branch', config: { condition: '{{amount > 100}}' } }, next: ['b'] },
              { id: 'b', action: { type: 'notification', config: {} } }],
    };
    const output = await executeWorkflow(def, {}, executor, makeCtx());
    expect(output).toMatchObject({ branched: 'yes' });
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('increments stepsExecuted counter as steps run', async () => {
    const executor: ActionExecutor = vi.fn().mockResolvedValue({});
    const def: WorkflowDefinition = {
      version: 1,
      triggers: [webhookTrigger],
      steps: [
        { id: 'a', action: { type: 'notification', config: {} }, next: ['b'] },
        { id: 'b', action: { type: 'notification', config: {} } },
      ],
    };
    const ctx = makeCtx();
    await executeWorkflow(def, {}, executor, ctx);
    expect(ctx.stepsExecuted).toBe(2);
  });
});
