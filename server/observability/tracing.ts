import { randomUUID } from 'node:crypto';
import { logger, type LogContext } from './logger';
import { increment, observe } from './metrics';

export type TraceContext = {
  traceId: string;
  spanId: string;
  traceFlags: string;
};

const HEX_32 = /^[0-9a-f]{32}$/i;
const HEX_16 = /^[0-9a-f]{16}$/i;

function hex(bytes: number): string {
  return randomUUID().replaceAll('-', '').slice(0, bytes * 2);
}

export function newTraceContext(parent?: TraceContext): TraceContext {
  return {
    traceId: parent?.traceId ?? hex(16),
    spanId: hex(8),
    traceFlags: parent?.traceFlags ?? '01',
  };
}

/** Parse W3C traceparent without accepting malformed or all-zero identifiers. */
export function parseTraceparent(value: string | null): TraceContext | undefined {
  if (!value) return undefined;
  const parts = value.trim().split('-');
  if (parts.length !== 4 || parts[0] !== '00') return undefined;
  const [version, traceId, spanId, flags] = parts;
  if (version !== '00' || !HEX_32.test(traceId) || !HEX_16.test(spanId) || !/^[0-9a-f]{2}$/i.test(flags)) return undefined;
  if (/^0+$/.test(traceId) || /^0+$/.test(spanId)) return undefined;
  return { traceId: traceId.toLowerCase(), spanId: spanId.toLowerCase(), traceFlags: flags.toLowerCase() };
}

export function formatTraceparent(ctx: TraceContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-${ctx.traceFlags}`;
}

export type SpanResult<T> = { value: T; trace: TraceContext; durationMs: number };

/** Lightweight OTel-compatible span boundary; an OTel SDK/exporter can be attached later without changing callers. */
export async function withSpan<T>(name: string, context: LogContext & { trace?: TraceContext } = {}, fn: (trace: TraceContext) => Promise<T>): Promise<SpanResult<T>> {
  const trace = newTraceContext(context.trace);
  const started = performance.now();
  logger.info('span.start', { ...context, correlationId: context.correlationId }, { spanName: name, traceId: trace.traceId, spanId: trace.spanId });
  try {
    const value = await fn(trace);
    const durationMs = performance.now() - started;
    observe('span.duration_ms', durationMs, { span: name });
    increment('span.completed_total', { span: name });
    logger.info('span.end', { ...context }, { spanName: name, traceId: trace.traceId, spanId: trace.spanId, durationMs: Math.round(durationMs) });
    return { value, trace, durationMs };
  } catch (error) {
    const durationMs = performance.now() - started;
    observe('span.duration_ms', durationMs, { span: name });
    increment('span.errors_total', { span: name });
    logger.error('span.error', { ...context }, { spanName: name, traceId: trace.traceId, spanId: trace.spanId, durationMs: Math.round(durationMs), error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
