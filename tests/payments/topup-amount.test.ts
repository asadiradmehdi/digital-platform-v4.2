import { describe, expect, it } from 'vitest';
import {
  TOPUP_PRESETS_TOMAN, parseTomanInput, suggestedTopupToman, tomanToRial, topupAmountProblem,
} from '../../packages/api-contracts/src/topup';

describe('wallet top-up amounts', () => {
  it('offers six presets from ۲۰۰ هزار to ۱۰ میلیون تومان, all valid', () => {
    expect(TOPUP_PRESETS_TOMAN).toEqual([200_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000]);
    for (const a of TOPUP_PRESETS_TOMAN) expect(topupAmountProblem(a)).toBeNull();
  });

  it('parses Persian, Arabic and Latin digits with separators', () => {
    expect(parseTomanInput('۱٬۲۵۰٬۰۰۰')).toBe(1_250_000);
    expect(parseTomanInput('٣٠٠,٠٠٠')).toBe(300_000);
    expect(parseTomanInput(' 75 000 ')).toBe(75_000);
    expect(parseTomanInput('')).toBeNull();
    expect(parseTomanInput('12a')).toBeNull();
    expect(parseTomanInput('-5')).toBeNull();
  });

  it('enforces the ۱۰ هزار – ۵۰ میلیون تومان range with Persian messages', () => {
    expect(topupAmountProblem(9_999)).toContain('حداقل');
    expect(topupAmountProblem(10_000)).toBeNull();
    expect(topupAmountProblem(50_000_000)).toBeNull();
    expect(topupAmountProblem(50_000_001)).toContain('حداکثر');
    expect(topupAmountProblem(0)).not.toBeNull();
    expect(topupAmountProblem(1.5)).not.toBeNull();
  });

  it('charges the gateway in rial (toman × 10)', () => {
    expect(tomanToRial(1_250_000)).toBe(12_500_000);
  });

  it('suggests a top-up that covers a shortfall, rounded up to ۱۰ هزار', () => {
    expect(suggestedTopupToman(1_800_000)).toBe(1_800_000);
    expect(suggestedTopupToman(123_456)).toBe(130_000);
    expect(suggestedTopupToman(2_000)).toBe(10_000);
    expect(suggestedTopupToman(80_000_000)).toBe(50_000_000);
  });
});
