import { describe, expect, it } from 'vitest';
import { tierFor } from '../../lib/tiers';
import { orderCode, toToman } from '../../lib/format';

describe('tierFor', () => {
  it('starts at the first moon with no spend', () => {
    const t = tierFor(0);
    expect(t.tier.name).toBe('میماس');
    expect(t.level).toBe(1);
    expect(t.next?.name).toBe('تتیس');
    expect(t.progress).toBe(0);
  });
  it('promotes exactly at a threshold and reports progress to the next', () => {
    expect(tierFor(5_000_000).tier.name).toBe('ریچی');
    expect(tierFor(10_000_000).tier.name).toBe('تایتان');
    expect(tierFor(17_500_000).progress).toBeCloseTo(0.5);
  });
  it('caps at اسد with full progress', () => {
    const t = tierFor(900_000_000);
    expect(t.tier.name).toBe('اسد');
    expect(t.next).toBeNull();
    expect(t.progress).toBe(1);
  });
});

describe('money display helpers', () => {
  it('reads IRT as toman and IRR as rial', () => {
    expect(toToman('125000', 'IRT')).toBe(125000);
    expect(toToman(1_250_000, 'IRR')).toBe(125000);
    expect(toToman(10, 'IRR ')).toBe(1);
  });
  it('builds a stable tracking code', () => {
    expect(orderCode('4a1c9e00-0000-4000-8000-000000000000')).toBe('ZP-4A1C9E');
  });
});

describe('formatWhen', () => {
  it('renders Persian-calendar day and Tehran time on one line', async () => {
    const { formatWhen } = await import('../../lib/format');
    expect(formatWhen('2026-10-08T05:34:00Z')).toBe('۱۶ مهر · ۰۹:۰۴');
  });
  it('reports the toman still needed, so the bar and the wording never disagree', () => {
    expect(tierFor(0).remainingToman).toBe(1_000_000);
    const t = tierFor(200_000); // 20% of the way to تتیس, 800k to go
    expect(t.progress).toBeCloseTo(0.2);
    expect(t.remainingToman).toBe(800_000);
    expect(tierFor(900_000_000).remainingToman).toBe(0);
  });
});
