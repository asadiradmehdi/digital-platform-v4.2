import { describe, expect, it } from 'vitest';
import { formatIranMobile, maskIranMobile, normalizeIranMobile, toLocalIranMobile } from '../../packages/api-contracts/src/phone';

describe('Iranian mobile normalisation', () => {
  it.each([
    ['09121234567', '+989121234567'],
    ['9121234567', '+989121234567'],
    ['989121234567', '+989121234567'],
    ['+989121234567', '+989121234567'],
    ['00989121234567', '+989121234567'],
    ['۰۹۱۲۱۲۳۴۵۶۷', '+989121234567'],          // Persian digits
    ['٠٩١٢١٢٣٤٥٦٧', '+989121234567'],          // Arabic-Indic digits
    ['0912 123 4567', '+989121234567'],
    ['(0912) 123-4567', '+989121234567'],
    ['‎+98 912 123 4567‏', '+989121234567'], // bidi marks pasted from RTL text
    ['۰۹۳۵-۱۲۳-۴۵۶۷', '+989351234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeIranMobile(input)).toBe(expected);
  });

  it.each(['', '0912123456', '091212345678', '08121234567', '+19121234567', '0212345678', 'abc', '09121234567a', '+98 21 1234 5678', null, 9121234567])(
    'rejects %s', input => { expect(normalizeIranMobile(input as unknown)).toBeNull(); },
  );

  it('renders local, masked and spaced forms', () => {
    expect(toLocalIranMobile('+989121234567')).toBe('09121234567');
    expect(maskIranMobile('+989121234567')).toBe('0912 ••• 4567');
    expect(formatIranMobile('+989121234567')).toBe('0912 123 4567');
  });
});
