import { describe, expect, it } from 'vitest';
import { calculateRenewalPeriod, decideUsage } from './policy';

describe('subscription policy', () => {
  it('allows usage inside entitlement plus rollover', () => {
    expect(decideUsage({ consumed: 90n, requested: 15n, limit: 100n, rollover: 10n }).allowed).toBe(true);
  });
  it('blocks usage over entitlement', () => {
    expect(decideUsage({ consumed: 95n, requested: 20n, limit: 100n, rollover: 0n }).allowed).toBe(false);
  });
  it('supports unlimited entitlements', () => {
    expect(decideUsage({ consumed: 999999n, requested: 1n, limit: null, rollover: 0n }).remaining).toBeNull();
  });
  it('calculates calendar renewal boundaries', () => {
    expect(calculateRenewalPeriod(new Date('2026-01-15T00:00:00Z'), 'MONTHLY').toISOString()).toBe('2026-02-15T00:00:00.000Z');
  });
});
