import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Import after potentially setting up time mocks
import { memoryRateLimit, assertRateLimit } from '../../server/core/rate-limit';

describe('memoryRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows first request within limit', () => {
    const result = memoryRateLimit('key-a', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('tracks remaining count across multiple calls', () => {
    const key = `key-multi-${Date.now()}`;
    memoryRateLimit(key, 3, 60000);
    memoryRateLimit(key, 3, 60000);
    const third = memoryRateLimit(key, 3, 60000);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it('blocks when limit is exceeded', () => {
    const key = `key-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) memoryRateLimit(key, 3, 60000);
    const over = memoryRateLimit(key, 3, 60000);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
  });

  it('resets window after windowMs elapses', () => {
    const key = `key-reset-${Date.now()}`;
    for (let i = 0; i < 3; i++) memoryRateLimit(key, 3, 60000);
    vi.advanceTimersByTime(60001);
    const result = memoryRateLimit(key, 3, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('returns a resetAt timestamp in the future', () => {
    const now = Date.now();
    const result = memoryRateLimit(`key-ts-${now}`, 5, 30000);
    expect(result.resetAt).toBeGreaterThan(now);
  });

  it('different keys are tracked independently', () => {
    const k1 = `key-ind-1-${Date.now()}`;
    const k2 = `key-ind-2-${Date.now()}`;
    memoryRateLimit(k1, 1, 60000);
    memoryRateLimit(k1, 1, 60000); // block k1
    const k2result = memoryRateLimit(k2, 1, 60000);
    expect(k2result.allowed).toBe(true);
  });

  it('limit of 1 allows exactly one request then blocks', () => {
    const key = `key-limit1-${Date.now()}`;
    const first = memoryRateLimit(key, 1, 60000);
    const second = memoryRateLimit(key, 1, 60000);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });
});

describe('assertRateLimit', () => {
  it('does not throw when decision is allowed', () => {
    expect(() => assertRateLimit({ allowed: true, remaining: 5, resetAt: Date.now() + 1000 })).not.toThrow();
  });

  it('throws RATE_LIMITED when decision is not allowed', () => {
    expect(() =>
      assertRateLimit({ allowed: false, remaining: 0, resetAt: Date.now() + 5000 }),
    ).toThrow();
  });

  it('includes resetAt in the error details when rate limited', () => {
    const resetAt = Date.now() + 5000;
    try {
      assertRateLimit({ allowed: false, remaining: 0, resetAt });
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe('RATE_LIMITED');
      expect((err as { details?: { resetAt?: number } }).details?.resetAt).toBe(resetAt);
    }
  });
});
