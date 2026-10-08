/**
 * Regression (H-4 / H-3): the mock gateway approves everything, so it must be unusable in production
 * unless PAYMENTS_MOCK_ALLOWED=true is set explicitly; without a real gateway, card payment fails
 * closed with a Persian customer message. Verification must match the intent's amount and currency.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GATEWAY_UNAVAILABLE_MESSAGE, isMockPaymentsAllowed, parsePaymentMethod, resolvePaymentGateway } from '../../server/payments/gateways';
import { mockGateway } from '../../server/payments/mock-gateway';
import { verificationMatches } from '../../server/payments/service';

const prod = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;

afterEach(() => vi.unstubAllEnvs());

describe('mock gateway policy', () => {
  it('is allowed outside production', () => {
    expect(isMockPaymentsAllowed({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isMockPaymentsAllowed({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(true);
  });
  it('is refused in production unless PAYMENTS_MOCK_ALLOWED=true', () => {
    expect(isMockPaymentsAllowed(prod)).toBe(false);
    expect(isMockPaymentsAllowed({ ...prod, PAYMENTS_MOCK_ALLOWED: '1' })).toBe(false);
    expect(isMockPaymentsAllowed({ ...prod, PAYMENTS_MOCK_ALLOWED: 'true' })).toBe(true);
  });
  it('resolvePaymentGateway fails closed in production with a Persian 503 message', () => {
    expect(() => resolvePaymentGateway(null, prod)).toThrow(expect.objectContaining({ code: 'UNAVAILABLE', message: GATEWAY_UNAVAILABLE_MESSAGE }));
    expect(() => resolvePaymentGateway('mock', prod)).toThrow(expect.objectContaining({ code: 'UNAVAILABLE' }));
    expect(GATEWAY_UNAVAILABLE_MESSAGE).toMatch(/[؀-ۿ]/);
  });
  it('rejects unknown gateway names (including prototype keys) everywhere', () => {
    expect(() => resolvePaymentGateway('zarinpal', { NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toThrow(expect.objectContaining({ code: 'UNAVAILABLE' }));
    expect(() => resolvePaymentGateway('constructor', { NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toThrow(expect.objectContaining({ code: 'UNAVAILABLE' }));
  });
  it('the mock gateway itself refuses to verify in production, even when imported directly', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAYMENTS_MOCK_ALLOWED', '');
    await expect(mockGateway.verify({ paymentId: 'p', gatewayReference: 'mock_p', amountMinor: 1n, currency: 'IRT' })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    await expect(mockGateway.createCheckout({ paymentId: 'p', amountMinor: 1n, currency: 'IRT', callbackUrl: 'x' }, 'k')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});

describe('parsePaymentMethod', () => {
  it('defaults to wallet and accepts gateway', () => {
    expect(parsePaymentMethod(undefined)).toBe('wallet');
    expect(parsePaymentMethod('wallet')).toBe('wallet');
    expect(parsePaymentMethod('gateway')).toBe('gateway');
    expect(() => parsePaymentMethod('card')).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});

describe('verificationMatches (H-3)', () => {
  const expected = { amountMinor: 1_200_000n, currency: 'IRT' };
  it('accepts only the exact amount and currency', () => {
    expect(verificationMatches({ paid: true, amountMinor: 1_200_000n, currency: 'IRT' }, expected)).toBe(true);
    expect(verificationMatches({ paid: true, amountMinor: 1_000n, currency: 'IRT' }, expected)).toBe(false);
    expect(verificationMatches({ paid: true, amountMinor: 1_200_000n, currency: 'IRR' }, expected)).toBe(false);
  });
  it('fails closed when the gateway does not report the amount', () => {
    expect(verificationMatches({ paid: true }, expected)).toBe(false);
    expect(verificationMatches({ paid: false, amountMinor: 1_200_000n, currency: 'IRT' }, expected)).toBe(false);
  });
});
