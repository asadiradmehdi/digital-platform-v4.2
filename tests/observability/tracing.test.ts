import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('../../server/observability/metrics', () => ({
  increment: vi.fn(),
  observe: vi.fn(),
}));

import { newTraceContext, parseTraceparent, formatTraceparent, withSpan } from '../../server/observability/tracing';

beforeEach(() => vi.clearAllMocks());

describe('newTraceContext', () => {
  it('returns a traceContext with traceId, spanId, traceFlags', () => {
    const ctx = newTraceContext();
    expect(ctx.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(ctx.traceFlags).toBe('01');
  });

  it('inherits traceId from parent', () => {
    const parent = newTraceContext();
    const child = newTraceContext(parent);
    expect(child.traceId).toBe(parent.traceId);
  });

  it('generates new spanId for child', () => {
    const parent = newTraceContext();
    const child = newTraceContext(parent);
    expect(child.spanId).not.toBe(parent.spanId);
  });
});

describe('parseTraceparent', () => {
  it('returns undefined for null input', () => {
    expect(parseTraceparent(null)).toBeUndefined();
  });

  it('returns undefined for malformed string', () => {
    expect(parseTraceparent('not-a-traceparent')).toBeUndefined();
  });

  it('returns undefined for wrong version', () => {
    const valid = `01-${'a'.repeat(32)}-${'b'.repeat(16)}-01`;
    expect(parseTraceparent(valid)).toBeUndefined();
  });

  it('returns undefined for all-zero traceId', () => {
    const all0 = `00-${'0'.repeat(32)}-${'b'.repeat(16)}-01`;
    expect(parseTraceparent(all0)).toBeUndefined();
  });

  it('returns undefined for all-zero spanId', () => {
    const all0 = `00-${'a'.repeat(32)}-${'0'.repeat(16)}-01`;
    expect(parseTraceparent(all0)).toBeUndefined();
  });

  it('parses valid W3C traceparent', () => {
    const traceId = 'a'.repeat(32);
    const spanId = 'b'.repeat(16);
    const ctx = parseTraceparent(`00-${traceId}-${spanId}-01`);
    expect(ctx).toBeDefined();
    expect(ctx?.traceId).toBe(traceId);
    expect(ctx?.spanId).toBe(spanId);
    expect(ctx?.traceFlags).toBe('01');
  });

  it('lowercases parsed fields', () => {
    const traceId = 'A'.repeat(32);
    const spanId = 'B'.repeat(16);
    const ctx = parseTraceparent(`00-${traceId}-${spanId}-01`);
    expect(ctx?.traceId).toBe('a'.repeat(32));
    expect(ctx?.spanId).toBe('b'.repeat(16));
  });
});

describe('formatTraceparent', () => {
  it('formats as 00-traceId-spanId-flags', () => {
    const ctx = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: '01' };
    expect(formatTraceparent(ctx)).toBe(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`);
  });
});

describe('withSpan', () => {
  it('returns value from handler', async () => {
    const result = await withSpan('test.op', {}, async () => 42);
    expect(result.value).toBe(42);
  });

  it('returns traceContext and durationMs', async () => {
    const result = await withSpan('test.op', {}, async () => 'done');
    expect(result.trace).toBeDefined();
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('re-throws errors from handler', async () => {
    await expect(
      withSpan('test.fail', {}, async () => { throw new Error('handler error'); }),
    ).rejects.toThrow('handler error');
  });

  it('passes trace context to handler', async () => {
    let receivedTrace: unknown;
    await withSpan('test.ctx', {}, async (trace) => { receivedTrace = trace; });
    expect((receivedTrace as { traceId: string }).traceId).toMatch(/^[0-9a-f]{32}$/);
  });
});
