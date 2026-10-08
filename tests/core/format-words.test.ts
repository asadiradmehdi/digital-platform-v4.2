import { describe, expect, it } from 'vitest';
import { formatQuantityWords, formatTomanWordsFromIRR, magnitudeParts } from '../../lib/format';

// Regression: wallet chips showed «۲٬۰۰۰» for two million toman (and «۵٬۰۰۰ تومان» for 5,000,000 toman).
describe('Persian magnitude words', () => {
  it('reads millions and thousands as words', () => {
    expect(formatQuantityWords(2_000_000)).toBe('۲ میلیون');
    expect(formatQuantityWords(1_000_000)).toBe('۱ میلیون');
    expect(formatQuantityWords(500_000)).toBe('۵۰۰ هزار');
    expect(formatQuantityWords(2_000)).toBe('۲ هزار');
    expect(formatQuantityWords(250)).toBe('۲۵۰');
  });
  it('keeps one decimal with the Persian separator', () => {
    expect(formatQuantityWords(3_200_000)).toBe('۳٫۲ میلیون');
    expect(formatQuantityWords(1_500)).toBe('۱٫۵ هزار');
  });
  it('promotes to the next magnitude when rounding reaches 1000', () => {
    expect(formatQuantityWords(999_999)).toBe('۱ میلیون');
    expect(magnitudeParts(999_960)).toEqual({ value: '۱', unit: 'میلیون' });
  });
  it('formats IRR minor units as toman words', () => {
    expect(formatTomanWordsFromIRR(20_000_000)).toBe('۲ میلیون تومان');
    expect(formatTomanWordsFromIRR(50_000_000)).toBe('۵ میلیون تومان');
    expect(formatTomanWordsFromIRR(1_000_000)).toBe('۱۰۰ هزار تومان');
  });
});
