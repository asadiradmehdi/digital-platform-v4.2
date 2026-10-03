import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withWorkspaceTransaction: vi.fn() }));

import { query } from '../../server/core/db';
import {
  recordProviderServiceCost,
  getLatestProviderServiceCost,
  syncServicePriceCost,
} from '../../server/pricing/provider-cost';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('recordProviderServiceCost', () => {
  it('inserts a cost record and returns the new id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cost-uuid-1' }], rowCount: 1 } as never);
    const id = await recordProviderServiceCost({
      providerServiceId: 'ps-1',
      unitCostMinor: 500n,
      currency: 'USD',
    });
    expect(id).toBe('cost-uuid-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO provider_service_costs'),
      expect.arrayContaining(['ps-1', '500', 'USD'])
    );
  });

  it('uppercases currency before inserting', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cost-uuid-2' }], rowCount: 1 } as never);
    await recordProviderServiceCost({ providerServiceId: 'ps-2', unitCostMinor: 100n, currency: 'usd' });
    const callArgs = mockQuery.mock.calls[0][1] as unknown[];
    expect(callArgs[2]).toBe('USD');
  });

  it('defaults unit to UNIT when not provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cost-uuid-3' }], rowCount: 1 } as never);
    await recordProviderServiceCost({ providerServiceId: 'ps-3', unitCostMinor: 200n, currency: 'EUR' });
    const callArgs = mockQuery.mock.calls[0][1] as unknown[];
    expect(callArgs[3]).toBe('UNIT');
  });

  it('uses provided unit when specified', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cost-uuid-4' }], rowCount: 1 } as never);
    await recordProviderServiceCost({
      providerServiceId: 'ps-4',
      unitCostMinor: 300n,
      currency: 'EUR',
      unit: 'TOKEN',
    });
    const callArgs = mockQuery.mock.calls[0][1] as unknown[];
    expect(callArgs[3]).toBe('TOKEN');
  });
});

describe('getLatestProviderServiceCost', () => {
  it('returns the latest cost row for a provider service', async () => {
    const row = { id: 'cost-1', unitCostMinor: '400', currency: 'USD', unit: 'UNIT', effectiveFrom: '2024-01-01T00:00:00Z' };
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as never);
    const result = await getLatestProviderServiceCost('ps-1');
    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('provider_service_costs'),
      ['ps-1']
    );
  });

  it('returns null when no cost record is found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await getLatestProviderServiceCost('ps-unknown');
    expect(result).toBeNull();
  });
});

describe('syncServicePriceCost', () => {
  it('returns null when no provider route is found for the service price', async () => {
    // First query: find provider route — no result
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await syncServicePriceCost('sp-1');
    expect(result).toBeNull();
  });

  it('returns null when no active cost record exists for the provider service', async () => {
    // First query: provider route found
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-1', provider_service_id: 'ps-1' }], rowCount: 1 } as never);
    // Second query (getLatestProviderServiceCost): no cost found
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await syncServicePriceCost('sp-1');
    expect(result).toBeNull();
  });

  it('updates service_prices and returns cost when provider cost exists', async () => {
    const costRow = { id: 'cost-1', unitCostMinor: '500', currency: 'USD', unit: 'UNIT', effectiveFrom: '2024-01-01' };
    // First query: find provider route
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-1', provider_service_id: 'ps-1' }], rowCount: 1 } as never);
    // Second query (getLatestProviderServiceCost): cost found
    mockQuery.mockResolvedValueOnce({ rows: [costRow], rowCount: 1 } as never);
    // Third query: UPDATE service_prices
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    const result = await syncServicePriceCost('sp-1');
    expect(result).toEqual(costRow);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE service_prices'),
      expect.arrayContaining(['500', 'USD', 'sp-1'])
    );
  });
});
