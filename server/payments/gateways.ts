import { AppError } from '../core/errors';
import type { PaymentGateway } from './service';
import { mockGateway } from './mock-gateway';
import { assertMockPaymentsAllowed, GATEWAY_UNAVAILABLE_MESSAGE } from './gateway-policy';

export { GATEWAY_UNAVAILABLE_MESSAGE, isMockPaymentsAllowed, assertMockPaymentsAllowed } from './gateway-policy';

export type PaymentMethod = 'wallet' | 'gateway';

/** 'wallet' (default) or 'gateway'; anything else is a validation error. */
export function parsePaymentMethod(value: unknown): PaymentMethod {
  if (value == null || value === '' || value === 'wallet') return 'wallet';
  if (value === 'gateway') return 'gateway';
  throw new AppError('VALIDATION_ERROR', 'paymentMethod must be "wallet" or "gateway".');
}

/** Where the gateway sends the customer back: always our own origin, never a client-supplied URL. */
export function paymentCallbackUrl(env: NodeJS.ProcessEnv = process.env): string {
  return `${env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/checkout/callback`;
}

/** Real gateway adapters register here. Until one exists, production has no card gateway. */
const REAL_GATEWAYS: Record<string, PaymentGateway> = {};

/**
 * Resolve a card payment gateway by name (default: PAYMENT_GATEWAY, else 'mock').
 * Fails closed with a Persian customer message when the gateway is unknown or not allowed here.
 * Wallet payments never go through this function, so they keep working without a gateway.
 */
export function resolvePaymentGateway(name?: string | null, env: NodeJS.ProcessEnv = process.env): PaymentGateway {
  const wanted = (name ?? '').trim() || (env.PAYMENT_GATEWAY ?? '').trim() || 'mock';
  if (wanted === 'mock') {
    assertMockPaymentsAllowed(env);
    return mockGateway;
  }
  const gateway = Object.prototype.hasOwnProperty.call(REAL_GATEWAYS, wanted) ? REAL_GATEWAYS[wanted] : undefined;
  if (!gateway) throw new AppError('UNAVAILABLE', GATEWAY_UNAVAILABLE_MESSAGE, { gateway: wanted });
  return gateway;
}
