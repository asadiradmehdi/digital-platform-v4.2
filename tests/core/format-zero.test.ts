// Regression: a zero balance rendered as «۰», which looks like a stray bullet («• تومان»).
import { describe, expect, it } from 'vitest';
import { formatTomanNumber } from '../../lib/format';

describe('formatTomanNumber', () => {
  it('writes zero as «صفر» and keeps other amounts as Persian digits', () => {
    expect(formatTomanNumber(0)).toBe('صفر');
    expect(formatTomanNumber(0.4)).toBe('صفر');
    expect(formatTomanNumber(180000)).toBe('۱۸۰٬۰۰۰');
  });
});
