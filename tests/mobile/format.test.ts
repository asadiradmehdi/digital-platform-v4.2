/**
 * Unit tests for apps/mobile/src/format.ts
 */
import { describe, it, expect } from 'vitest';
import { formatToman, formatCount } from '../../apps/mobile/src/format';

describe('formatToman', () => {
  it('converts minor IRR to Toman string', () => {
    const result = formatToman(10_000_000, 'IRR');
    expect(result).toContain('تومان');
    expect(result).toContain('۱٬۰۰۰٬۰۰۰');
  });

  it('accepts string input', () => {
    const result = formatToman('50000', 'IRR');
    expect(result).toContain('تومان');
    expect(result).toContain('۵٬۰۰۰');
  });

  it('returns em-dash for NaN input', () => {
    expect(formatToman('not-a-number', 'IRR')).toBe('—');
  });

  it('returns em-dash for NaN number', () => {
    expect(formatToman(NaN, 'IRR')).toBe('—');
  });

  it('rounds to Toman (divides by 10)', () => {
    // 100 minor IRR = 10 Toman
    const result = formatToman(100, 'IRR');
    expect(result).toContain('۱۰');
  });

  // Regression (H-1): plan prices and order totals are IRT; dividing them by 10 showed 1/10 of the price.
  it('never divides an IRT (toman) amount by 10', () => {
    expect(formatToman(9_900_000, 'IRT')).toBe('۹٬۹۰۰٬۰۰۰ تومان');
    expect(formatToman(99_000_000, 'IRR')).toBe('۹٬۹۰۰٬۰۰۰ تومان');
  });

  it('handles zero', () => {
    const result = formatToman(0, 'IRR');
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

  // Regression (H-1): plan prices and order totals are IRT; dividing them by 10 showed 1/10 of the price.
  it('never divides an IRT (toman) amount by 10', () => {
    expect(formatToman(9_900_000, 'IRT')).toBe('۹٬۹۰۰٬۰۰۰ تومان');
    expect(formatToman(99_000_000, 'IRR')).toBe('۹٬۹۰۰٬۰۰۰ تومان');
  });

  it('handles zero', () => {
    expect(formatCount(0)).toContain('۰');
  });
});
