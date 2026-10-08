import { describe, expect, it } from 'vitest';
import { documentToman, formatRateBps, maskTarget, persianWords, tomanInWords, vatPortion } from '../../lib/invoice-format';

describe('vatPortion (tax-inclusive prices)', () => {
  it('extracts total × rate/(1+rate), rounded down to whole toman', () => {
    expect(vatPortion(1_100_000n, 1000)).toBe(100_000n);
    expect(vatPortion(1_800_000n, 1000)).toBe(163_636n); // 163 636.36…
    expect(vatPortion(1_100_010n, 1000)).toBe(100_000n); // 100 000.9 → down
    expect(vatPortion(99n, 1000)).toBe(9n);
  });
  it('is zero for a zero rate or amount and refuses an invalid rate', () => {
    expect(vatPortion(1_000n, 0)).toBe(0n);
    expect(vatPortion(0n, 1000)).toBe(0n);
    expect(() => vatPortion(1_000n, 10_001)).toThrow(RangeError);
    expect(() => vatPortion(1_000n, 10.5)).toThrow(RangeError);
  });
  it('never exceeds the price and leaves net + vat = total', () => {
    for (const total of [1n, 7n, 11n, 123_457n, 9_999_999n]) {
      const vat = vatPortion(total, 1000);
      expect(vat).toBeLessThanOrEqual(total);
      expect((total - vat) * 1000n / 10_000n).toBeGreaterThanOrEqual(vat - 1n);
    }
  });
  it('formats the rate in Persian digits', () => {
    expect(formatRateBps(1000)).toBe('۱۰٪');
    expect(formatRateBps(950)).toBe('۹٫۵٪');
  });
});

describe('persianWords', () => {
  it.each([
    [0, 'صفر'],
    [7, 'هفت'],
    [15, 'پانزده'],
    [40, 'چهل'],
    [101, 'صد و یک'],
    [999, 'نهصد و نود و نه'],
    [1000, 'یک هزار'],
    [1_800_000, 'یک میلیون و هشتصد هزار'],
    [12_345, 'دوازده هزار و سیصد و چهل و پنج'],
    [2_000_000_500, 'دو میلیارد و پانصد'],
    [-20, 'منفی بیست'],
  ])('%d → %s', (n, words) => expect(persianWords(n)).toBe(words));
  it('handles bigint and appends تومان', () => {
    expect(tomanInWords(1_800_000n)).toBe('یک میلیون و هشتصد هزار تومان');
  });
});

describe('maskTarget', () => {
  it('masks e-mail addresses and phone numbers', () => {
    expect(maskTarget('ali.rezaei@gmail.com')).toBe('al•••@gmail.com');
    expect(maskTarget('a@b.io')).toBe('a•••@b.io');
    expect(maskTarget('0912 123 4567')).toBe('0912•••567');
    expect(maskTarget('+989121234567')).toBe('+989•••567');
  });
  it('keeps public links and usernames readable, drops empty values', () => {
    expect(maskTarget('https://instagram.com/zohalpay')).toBe('https://instagram.com/zohalpay');
    expect(maskTarget('@zohalpay')).toBe('@zohalpay');
    expect(maskTarget('  ')).toBeNull();
    expect(maskTarget(42)).toBeNull();
  });
});

describe('documentToman', () => {
  it('keeps IRT and converts IRR', () => {
    expect(documentToman(1500n, 'IRT')).toBe(1500n);
    expect(documentToman(15000n, 'IRR ')).toBe(1500n);
  });
});
