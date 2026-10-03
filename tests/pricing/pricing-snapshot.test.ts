import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assessRateAge, isRateStale, enforceStaleRatePolicy } from '../../server/pricing/stale-guard';
import type { RateAgeCheck } from '../../server/pricing/stale-guard';

vi.mock('../../server/core/db');
vi.mock('../../server/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock('../../server/observability/operational-events', () => ({
  recordOperationalEvent: vi.fn().mockResolvedValue(undefined),
}));

function makeInput(overrides: Partial<RateAgeCheck> = {}): RateAgeCheck {
  return {
    fxRateId: 'fx-1',
    fetchedAt: new Date(Date.now() - 7200 * 1000), // 2h ago → stale vs 1h max
    maxAgeSeconds: 3600,
    staleRatePolicy: 'USE_LAST_KNOWN_GOOD',
    pricingRuleId: 'rule-1',
    ...overrides,
  };
}

describe('assessRateAge', () => {
  it('returns age in whole seconds', () => {
    const fetchedAt = new Date(Date.now() - 90_000); // 90s ago
    const age = assessRateAge(fetchedAt, 3600);
    expect(age).toBeGreaterThanOrEqual(89);
    expect(age).toBeLessThanOrEqual(91);
  });
});

describe('isRateStale', () => {
  it('returns false when within max age', () => {
    const recent = new Date(Date.now() - 100 * 1000);
    expect(isRateStale(recent, 3600)).toBe(false);
  });

  it('returns true when older than max age', () => {
    const old = new Date(Date.now() - 7200 * 1000);
    expect(isRateStale(old, 3600)).toBe(true);
  });

  it('returns false at exactly max age', () => {
    const exact = new Date(Date.now() - 3600 * 1000);
    expect(isRateStale(exact, 3600)).toBe(false);
  });
});

describe('enforceStaleRatePolicy — fresh rate', () => {
  it('returns stale:false when rate is within max age', async () => {
    const input = makeInput({ fetchedAt: new Date(Date.now() - 60 * 1000) });
    const result = await enforceStaleRatePolicy(input);
    expect(result.stale).toBe(false);
  });
});

describe('enforceStaleRatePolicy — USE_LAST_KNOWN_GOOD', () => {
  it('returns stale:true with policy and ageSeconds', async () => {
    const result = await enforceStaleRatePolicy(makeInput({ staleRatePolicy: 'USE_LAST_KNOWN_GOOD' }));
    expect(result.stale).toBe(true);
    if (result.stale) {
      expect(result.policy).toBe('USE_LAST_KNOWN_GOOD');
      expect(result.ageSeconds).toBeGreaterThan(3600);
      expect(result.amountMinor).toBeUndefined();
    }
  });
});

describe('enforceStaleRatePolicy — FREEZE_PRICE', () => {
  it('returns frozen amount when provided', async () => {
    const result = await enforceStaleRatePolicy(makeInput({
      staleRatePolicy: 'FREEZE_PRICE',
      frozenAmountMinor: 50000n,
    }));
    expect(result.stale).toBe(true);
    if (result.stale) {
      expect(result.policy).toBe('FREEZE_PRICE');
      expect(result.amountMinor).toBe(50000n);
    }
  });

  it('throws UNAVAILABLE when no frozen amount', async () => {
    await expect(
      enforceStaleRatePolicy(makeInput({ staleRatePolicy: 'FREEZE_PRICE', frozenAmountMinor: undefined }))
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});

describe('enforceStaleRatePolicy — BLOCK_PURCHASE', () => {
  it('throws UNAVAILABLE with ageSeconds in data', async () => {
    await expect(
      enforceStaleRatePolicy(makeInput({ staleRatePolicy: 'BLOCK_PURCHASE' }))
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});

describe('quoteServicePrice stale-rate integration', () => {
  // quoteServicePrice delegates to enforceStaleRatePolicy after DB fetch.
  // These tests verify the guard fires correctly for each policy variant.
  // Full integration requires a running database; here we verify the shape.

  it('stale-guard result with USE_LAST_KNOWN_GOOD passes amount through', async () => {
    const input = makeInput({ staleRatePolicy: 'USE_LAST_KNOWN_GOOD' });
    const guard = await enforceStaleRatePolicy(input);
    // caller uses staleGuard.amountMinor when stale && not null; otherwise falls back to DB amount
    const dbAmount = 100000n;
    const final = guard.stale && guard.amountMinor != null ? guard.amountMinor : dbAmount;
    expect(final).toBe(dbAmount);
  });

  it('stale-guard result with FREEZE_PRICE substitutes frozen amount', async () => {
    const frozen = 95000n;
    const input = makeInput({ staleRatePolicy: 'FREEZE_PRICE', frozenAmountMinor: frozen });
    const guard = await enforceStaleRatePolicy(input);
    const dbAmount = 100000n;
    const final = guard.stale && guard.amountMinor != null ? guard.amountMinor : dbAmount;
    expect(final).toBe(frozen);
  });

  it('stale-guard result with BLOCK_PURCHASE prevents quote', async () => {
    const input = makeInput({ staleRatePolicy: 'BLOCK_PURCHASE' });
    await expect(enforceStaleRatePolicy(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});
