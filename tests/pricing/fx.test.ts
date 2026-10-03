import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withWorkspaceTransaction: vi.fn() }));

import { query } from '../../server/core/db';
import { storeVerifiedFxRate, getLatestVerifiedFx, fetchWithFallback } from '../../server/pricing/fx';
import type { FxProvider } from '../../server/pricing/providers';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('storeVerifiedFxRate', () => {
  it('inserts a verified FX rate and returns the new id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'fx-uuid-1' }], rowCount: 1 } as never);
    const id = await storeVerifiedFxRate({
      baseCurrency: 'USD',
      quoteCurrency: 'IRT',
      numerator: 580000n,
      denominator: 1n,
      source: 'test-provider',
    });
    expect(id).toBe('fx-uuid-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO fx_rates'),
      expect.arrayContaining(['USD', 'IRT', '580000', '1', 'test-provider'])
    );
  });

  it('uppercases base and quote currencies', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'fx-uuid-2' }], rowCount: 1 } as never);
    await storeVerifiedFxRate({
      baseCurrency: 'usd',
      quoteCurrency: 'irt',
      numerator: 100n,
      denominator: 1n,
      source: 'provider',
    });
    const callArgs = mockQuery.mock.calls[0][1] as unknown[];
    expect(callArgs[0]).toBe('USD');
    expect(callArgs[1]).toBe('IRT');
  });

  it('throws when numerator is zero', async () => {
    await expect(
      storeVerifiedFxRate({
        baseCurrency: 'USD',
        quoteCurrency: 'IRT',
        numerator: 0n,
        denominator: 1n,
        source: 'test',
      })
    ).rejects.toThrow('FX rate must be positive');
  });

  it('throws when denominator is zero', async () => {
    await expect(
      storeVerifiedFxRate({
        baseCurrency: 'USD',
        quoteCurrency: 'IRT',
        numerator: 100n,
        denominator: 0n,
        source: 'test',
      })
    ).rejects.toThrow('FX rate must be positive');
  });

  it('throws when numerator is negative', async () => {
    await expect(
      storeVerifiedFxRate({
        baseCurrency: 'USD',
        quoteCurrency: 'IRT',
        numerator: -1n,
        denominator: 1n,
        source: 'test',
      })
    ).rejects.toThrow();
  });
});

describe('getLatestVerifiedFx', () => {
  it('returns the latest FX rate row', async () => {
    const row = {
      id: 'fx-1',
      baseCurrency: 'USD',
      quoteCurrency: 'IRT',
      numerator: '580000',
      denominator: '1',
      source: 'provider',
      fetchedAt: '2024-01-01T00:00:00Z',
      verified: true,
    };
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as never);
    const result = await getLatestVerifiedFx('USD', 'IRT');
    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('fx_rates'),
      expect.arrayContaining(['USD', 'IRT'])
    );
  });

  it('returns null when no rate is found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await getLatestVerifiedFx('EUR', 'IRT');
    expect(result).toBeNull();
  });

  it('uses default maxAgeSeconds of 3600', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await getLatestVerifiedFx('USD');
    const callArgs = mockQuery.mock.calls[0][1] as unknown[];
    expect(callArgs[2]).toBe(3600);
  });
});

describe('fetchWithFallback', () => {
  it('returns rate from the first successful provider', async () => {
    const provider: FxProvider = {
      name: 'provider-a',
      getRate: vi.fn().mockResolvedValue({ numerator: 580000n, denominator: 1n }),
    };
    const result = await fetchWithFallback([provider], 'USD', 'IRT');
    expect(result.provider).toBe('provider-a');
    expect(result.rate.numerator).toBe(580000n);
  });

  it('falls back to second provider when first throws', async () => {
    const providerA: FxProvider = {
      name: 'provider-a',
      getRate: vi.fn().mockRejectedValue(new Error('timeout')),
    };
    const providerB: FxProvider = {
      name: 'provider-b',
      getRate: vi.fn().mockResolvedValue({ numerator: 590000n, denominator: 1n }),
    };
    const result = await fetchWithFallback([providerA, providerB], 'USD', 'IRT');
    expect(result.provider).toBe('provider-b');
  });

  it('throws when all providers fail', async () => {
    const providerA: FxProvider = {
      name: 'provider-a',
      getRate: vi.fn().mockRejectedValue(new Error('err-a')),
    };
    const providerB: FxProvider = {
      name: 'provider-b',
      getRate: vi.fn().mockRejectedValue(new Error('err-b')),
    };
    await expect(fetchWithFallback([providerA, providerB], 'USD', 'IRT')).rejects.toThrow('All FX providers failed');
  });

  it('throws with descriptive error listing all provider failures', async () => {
    const provider: FxProvider = {
      name: 'only-provider',
      getRate: vi.fn().mockRejectedValue(new Error('network error')),
    };
    await expect(fetchWithFallback([provider], 'USD', 'IRT')).rejects.toThrow('only-provider');
  });
});
