import { describe, expect, it } from 'vitest';
import { providerRetryDecision } from '../../server/providers/retry';

describe('providerRetryDecision', () => {
  // ── NEVER retry when external order state is unknown ────────────────────

  it('never retries when external order creation state is unknown', () => {
    const d = providerRetryDecision({
      attempt: 1,
      maxAttempts: 5,
      transportFailed: true,
      externalOrderCreatedUnknown: true,
    });
    expect(d.retry).toBe(false);
    expect(d.reason).toBe('external-order-state-unknown');
    expect(d.delayMs).toBe(0);
  });

  it('never retries for unknown state even at attempt 1 with transport failure', () => {
    const d = providerRetryDecision({
      attempt: 1,
      maxAttempts: 10,
      transportFailed: true,
      externalOrderCreatedUnknown: true,
    });
    expect(d.retry).toBe(false);
  });

  // ── RETRY on transient transport failure ────────────────────────────────

  it('retries on transport failure at attempt 1 (exponential backoff: 500 * 2^1 = 1000ms)', () => {
    const d = providerRetryDecision({ attempt: 1, maxAttempts: 3, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d.retry).toBe(true);
    expect(d.delayMs).toBe(1000);
    expect(d.reason).toBe('transient-transport-failure');
  });

  it('retries on transport failure at attempt 2 (500 * 2^2 = 2000ms)', () => {
    const d = providerRetryDecision({ attempt: 2, maxAttempts: 5, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d.retry).toBe(true);
    expect(d.delayMs).toBe(2000);
  });

  it('retries on transport failure at attempt 3 (500 * 2^3 = 4000ms)', () => {
    const d = providerRetryDecision({ attempt: 3, maxAttempts: 5, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d.retry).toBe(true);
    expect(d.delayMs).toBe(4000);
  });

  it('caps delay at 30_000ms (attempt 10 would be 512000ms without cap)', () => {
    const d = providerRetryDecision({ attempt: 10, maxAttempts: 20, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d.retry).toBe(true);
    expect(d.delayMs).toBe(30_000);
  });

  // ── STOP (not retry) when max attempts reached ──────────────────────────

  it('stops retrying exactly at maxAttempts', () => {
    const d = providerRetryDecision({ attempt: 3, maxAttempts: 3, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d.retry).toBe(false);
    expect(d.reason).toBe('not-retryable');
  });

  it('stops retrying when attempt exceeds maxAttempts', () => {
    const d = providerRetryDecision({ attempt: 5, maxAttempts: 3, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d.retry).toBe(false);
  });

  it('stops at maxAttempts=1 when attempt=1', () => {
    const d = providerRetryDecision({ attempt: 1, maxAttempts: 1, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d.retry).toBe(false);
    expect(d.reason).toBe('not-retryable');
  });

  // ── SKIP / no retry when transport did not fail ──────────────────────────

  it('does not retry when transport succeeded (non-transient failure)', () => {
    // transportFailed=false means the request reached the provider and got a terminal response
    const d = providerRetryDecision({ attempt: 1, maxAttempts: 3, transportFailed: false, externalOrderCreatedUnknown: false });
    expect(d.retry).toBe(false);
    expect(d.reason).toBe('not-retryable');
  });

  // ── delayMs is 0 when not retrying ──────────────────────────────────────

  it('delayMs is 0 when not retrying', () => {
    const d = providerRetryDecision({ attempt: 3, maxAttempts: 3, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d.delayMs).toBe(0);
  });

  it('delayMs is 0 for unknown external order state', () => {
    const d = providerRetryDecision({ attempt: 1, maxAttempts: 5, transportFailed: true, externalOrderCreatedUnknown: true });
    expect(d.delayMs).toBe(0);
  });

  // ── Backoff formula validation ──────────────────────────────────────────

  it('backoff formula is 500 * 2^attempt (not attempt-1)', () => {
    // attempt=0 would be 500 * 2^0 = 500ms
    const d = providerRetryDecision({ attempt: 0, maxAttempts: 3, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d.delayMs).toBe(500);
  });

  it('delayMs increases with each attempt', () => {
    const d1 = providerRetryDecision({ attempt: 1, maxAttempts: 10, transportFailed: true, externalOrderCreatedUnknown: false });
    const d2 = providerRetryDecision({ attempt: 2, maxAttempts: 10, transportFailed: true, externalOrderCreatedUnknown: false });
    const d3 = providerRetryDecision({ attempt: 3, maxAttempts: 10, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d2.delayMs).toBeGreaterThan(d1.delayMs);
    expect(d3.delayMs).toBeGreaterThan(d2.delayMs);
  });
});
