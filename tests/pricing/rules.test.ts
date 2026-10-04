import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

import { query } from '../../server/core/db';
import { upsertPricingRule, listPricingRules } from '../../server/pricing/rules';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

const baseInput = {
  targetType: 'SERVICE' as const,
  targetId: 'svc-1',
  baseAmountMinor: 10000n,
  baseCurrency: 'USD',
  marginPercent: 10,
};

describe('upsertPricingRule', () => {
  it('inserts a new pricing rule and records audit event', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'rule-1' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // audit

    const rule = await upsertPricingRule(baseInput);
    expect(rule.id).toBe('rule-1');
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('converts marginPercent to bps (10% → 1000 bps)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'rule-1' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await upsertPricingRule({ ...baseInput, marginPercent: 10 });
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain(1000);
  });

  it('uppercases baseCurrency', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'rule-1' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await upsertPricingRule({ ...baseInput, baseCurrency: 'usd' });
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain('USD');
  });

  it('defaults rounding to 1000 when not provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'rule-1' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await upsertPricingRule(baseInput);
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain('1000');
  });

  it('uses ON CONFLICT DO UPDATE SQL pattern', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'rule-1' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await upsertPricingRule(baseInput);
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO UPDATE');
  });

  it('throws on negative marginPercent', async () => {
    await expect(upsertPricingRule({ ...baseInput, marginPercent: -1 })).rejects.toThrow();
  });

  it('throws on marginPercent > 1000', async () => {
    await expect(upsertPricingRule({ ...baseInput, marginPercent: 1001 })).rejects.toThrow();
  });

  it('inserts pricing_audit_events after upsert', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'rule-1' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await upsertPricingRule(baseInput);
    const auditSql = mockQuery.mock.calls[1]?.[0] as string;
    expect(auditSql).toContain('pricing_audit_events');
    expect(auditSql).toContain('RULE_UPDATED');
  });
});

describe('listPricingRules', () => {
  it('returns all pricing rules ordered by target_type + target_id', async () => {
    const rows = [{ id: 'r-1', targetType: 'service', targetId: 'svc-1' }];
    mockQuery.mockResolvedValueOnce({ rows, rowCount: 1 } as never);

    const result = await listPricingRules();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r-1');
  });

  it('returns empty array when no rules exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await listPricingRules();
    expect(result).toEqual([]);
  });

  it('queries with camelCase aliases in SELECT', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await listPricingRules();
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('"targetType"');
    expect(sql).toContain('"baseAmountMinor"');
  });
});
