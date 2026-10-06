/**
 * Unit tests for apps/mobile/src/format.ts
 */
import { describe, it, expect } from 'vitest';
import { formatToman, formatCount } from '../../apps/mobile/src/format';

describe('formatToman', () => {
  it('converts minor IRR to Toman string', () => {
    const result = formatToman(10_000_000);
    expect(result).toContain('تومان');
    expect(result).toContain('۱٬۰۰۰٬۰۰۰');
  });

  it('accepts string input', () => {
    const result = formatToman('50000');
    expect(result).toContain('تومان');
    expect(result).toContain('۵٬۰۰۰');
  });

  it('returns em-dash for NaN input', () => {
    expect(formatToman('not-a-number')).toBe('—');
  });

  it('returns em-dash for NaN number', () => {
    expect(formatToman(NaN)).toBe('—');
  });

  it('rounds to Toman (divides by 10)', () => {
    // 100 minor IRR = 10 Toman
    const result = formatToman(100);
    expect(result).toContain('۱۰');
  });

  it('handles zero', () => {
    const result = formatToman(0);
    expect(result).toContain('تومان');
    expect(result).toContain('۰');
  });
});

describe('formatCount', () => {
  it('formats a number with Persian locale', () => {
    const result = formatCount(1240);
    expect(result).toContain('۱٬۲۴۰');
  });

  it('accepts string input', () => {
    const result = formatCount('42');
    expect(result).toContain('۴۲');
  });

  it('returns em-dash for invalid string', () => {
    expect(formatCount('invalid')).toBe('—');
  });

  it('handles zero', () => {
    expect(formatCount(0)).toContain('۰');
  });
});
