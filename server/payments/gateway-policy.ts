import { AppError } from '../core/errors';

/** Shown to the customer when no card gateway can take a payment; wallet payments are unaffected. */
export const GATEWAY_UNAVAILABLE_MESSAGE = 'پرداخت با درگاه بانکی در حال حاضر در دسترس نیست. می‌توانید از موجودی کیف پول پرداخت کنید یا کمی بعد دوباره تلاش کنید.';

/**
 * The mock gateway approves every payment it is asked about. It is usable only outside production,
 * or in production when an operator sets PAYMENTS_MOCK_ALLOWED=true explicitly (staging demos).
 */
export function isMockPaymentsAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.PAYMENTS_MOCK_ALLOWED === 'true';
}

export function assertMockPaymentsAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (!isMockPaymentsAllowed(env)) throw new AppError('UNAVAILABLE', GATEWAY_UNAVAILABLE_MESSAGE);
}
