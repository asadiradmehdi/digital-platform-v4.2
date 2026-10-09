import { AppError } from '../core/errors';

// OWASP ASVS 5.0 (V6.2): long passwords, no composition rules (no forced upper/lower/digit/symbol),
// and reject passwords that are trivially guessable. Length stays at 14 characters.
export const PASSWORD_MIN_LENGTH = 14;

const COMMON = ['password', 'qwerty', 'asdfgh', 'zxcvbn', '123456', '111111', 'iloveyou', 'admin', 'zohalpay', 'zohal'];

export function assertStrongPassword(password: string, context: { email?: string } = {}) {
  if ([...password].length < PASSWORD_MIN_LENGTH) throw new AppError('VALIDATION_ERROR', 'رمز عبور باید حداقل ۱۴ کاراکتر باشد.');
  const lower = password.toLowerCase();
  const distinct = new Set([...lower]).size;
  const local = context.email?.split('@')[0]?.toLowerCase() ?? '';
  const sequential = '0123456789abcdefghijklmnopqrstuvwxyz';
  const weak = distinct < 5
    || /^[0-9۰-۹\s-]+$/.test(password)
    || COMMON.some(w => lower.replace(/[^a-z0-9]/g, '').startsWith(w) && lower.replace(/[^a-z0-9]/g, '').length - w.length <= 6)
    || (sequential.includes(lower) || sequential.split('').reverse().join('').includes(lower))
    || (local.length >= 4 && lower.includes(local));
  if (weak) throw new AppError('VALIDATION_ERROR', 'این رمز عبور خیلی قابل حدس است. یک عبارت طولانی‌تر و شخصی‌تر انتخاب کنید.');
}
