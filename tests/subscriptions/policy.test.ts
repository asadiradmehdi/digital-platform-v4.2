import { describe, it, expect } from 'vitest';
import { decideUsage, calculateRenewalPeriod } from '../../server/subscriptions/policy';

describe('decideUsage', () => {
  it('allows unlimited usage when limit is null', () => {
    const r = decideUsage({ consumed: 100n, requested: 999999n, limit: null, rollover: 0n });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBeNull();
  });

  it('allows when requested <= available', () => {
    const r = decideUsage({ consumed: 0n, requested: 100n, limit: 500n, rollover: 0n });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(500n);
  });

  it('denies when requested > available', () => {
    const r = decideUsage({ consumed: 400n, requested: 200n, limit: 500n, rollover: 0n });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(100n);
  });

  it('allows when rollover makes request possible', () => {
    const r = decideUsage({ consumed: 480n, requested: 50n, limit: 500n, rollover: 50n });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(70n);
  });

  it('allows exact match (requested == available)', () => {
    const r = decideUsage({ consumed: 0n, requested: 500n, limit: 500n, rollover: 0n });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(500n);
  });

  it('clamps remaining to 0n when consumed exceeds limit', () => {
    const r = decideUsage({ consumed: 600n, requested: 1n, limit: 500n, rollover: 0n });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0n);
  });

  it('throws VALIDATION_ERROR on negative consumed', () => {
    expect(() => decideUsage({ consumed: -1n, requested: 1n, limit: 100n, rollover: 0n })).toThrow();
  });

  it('throws VALIDATION_ERROR on zero requested', () => {
    expect(() => decideUsage({ consumed: 0n, requested: 0n, limit: 100n, rollover: 0n })).toThrow();
  });

  it('throws VALIDATION_ERROR on negative limit', () => {
    expect(() => decideUsage({ consumed: 0n, requested: 1n, limit: -1n, rollover: 0n })).toThrow();
  });
});

describe('calculateRenewalPeriod', () => {
  it('adds 7 days for WEEKLY', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = calculateRenewalPeriod(start, 'WEEKLY');
    expect(end.toISOString()).toBe('2026-01-08T00:00:00.000Z');
  });

  it('adds 1 month for MONTHLY', () => {
    const start = new Date('2026-01-31T00:00:00Z');
    const end = calculateRenewalPeriod(start, 'MONTHLY');
    expect(end.getUTCMonth()).toBe(2); // February → wraps to March 3rd (Feb has 28 days in 2026)
  });

  it('adds 1 year for YEARLY', () => {
    const start = new Date('2026-03-15T00:00:00Z');
    const end = calculateRenewalPeriod(start, 'YEARLY');
    expect(end.getUTCFullYear()).toBe(2027);
    expect(end.getUTCMonth()).toBe(2);
    expect(end.getUTCDate()).toBe(15);
  });

  it('does not mutate original start date', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const orig = start.getTime();
    calculateRenewalPeriod(start, 'MONTHLY');
    expect(start.getTime()).toBe(orig);
  });
});
