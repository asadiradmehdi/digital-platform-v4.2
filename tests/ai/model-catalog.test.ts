import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
import { syncModelCatalog, resolveModelId, getModelPrice, KNOWN_MODELS } from '../../server/ai/model-catalog';

const mockQuery = vi.mocked(query);

beforeEach(() => vi.clearAllMocks());

// ─── syncModelCatalog ──────────────────────────────────────────────────────────

describe('syncModelCatalog', () => {
  it('upserts providers and models without throwing', async () => {
    // Provider upsert, model upsert, price insert
    mockQuery
      .mockResolvedValue({ rows: [{ id: 'provider-1' }] } as never);

    await expect(syncModelCatalog([KNOWN_MODELS[0]])).resolves.toBeUndefined();
    // Three queries per model: provider, model, price
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it('skips model when provider insert returns no row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] } as never); // provider -> no id

    await expect(syncModelCatalog([KNOWN_MODELS[0]])).resolves.toBeUndefined();
    // Provider query fires, model query must not fire
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('skips price insert when model upsert returns no row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'provider-2' }] } as never)  // provider
      .mockResolvedValueOnce({ rows: [] } as never);                      // model -> no id

    await expect(syncModelCatalog([KNOWN_MODELS[0]])).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('processes all KNOWN_MODELS without error', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'any-id' }] } as never);
    await expect(syncModelCatalog()).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledTimes(KNOWN_MODELS.length * 3);
  });
});

// ─── resolveModelId ────────────────────────────────────────────────────────────

describe('resolveModelId', () => {
  it('returns the model id when found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'model-uuid-1' }] } as never);
    const result = await resolveModelId('claude-sonnet-4-6');
    expect(result).toBe('model-uuid-1');
  });

  it('returns null when model is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    const result = await resolveModelId('unknown-model');
    expect(result).toBeNull();
  });
});

// ─── getModelPrice ─────────────────────────────────────────────────────────────

describe('getModelPrice', () => {
  it('returns input/output prices as bigint when price row exists', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ input_price_minor: '300', output_price_minor: '1500', currency: 'USD' }],
    } as never);

    const price = await getModelPrice('model-uuid-1');
    expect(price).not.toBeNull();
    expect(price?.inputPriceMinorPer1K).toBe(300n);
    expect(price?.outputPriceMinorPer1K).toBe(1500n);
    expect(price?.currency).toBe('USD');
  });

  it('returns null when no price row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    const price = await getModelPrice('model-no-price');
    expect(price).toBeNull();
  });
});
