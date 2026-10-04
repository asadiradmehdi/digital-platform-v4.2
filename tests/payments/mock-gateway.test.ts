/**
 * Unit tests for server/payments/mock-gateway.ts
 * createCheckout, verify, refund
 */
import { describe, it, expect } from 'vitest';
import { mockGateway } from '../../server/payments/mock-gateway';

// ─── createCheckout ───────────────────────────────────────────────────────────

describe('mockGateway.createCheckout', () => {
  it('returns a checkoutUrl containing the paymentId', async () => {
    const result = await mockGateway.createCheckout(
      { paymentId: 'pay-123', amountMinor: 10000n, currency: 'IRT', callbackUrl: 'https://example.com/cb' },
      'idem-key-1',
    );
    expect(result.checkoutUrl).toContain('pay-123');
  });

  it('encodes paymentId in the URL using encodeURIComponent', async () => {
    const result = await mockGateway.createCheckout(
      { paymentId: 'pay/special+id', amountMinor: 5000n, currency: 'IRT', callbackUrl: 'https://example.com/cb' },
      'idem-key-2',
    );
    // paymentId with special chars should be encoded in the URL
    expect(result.checkoutUrl).not.toContain('pay/special+id');
    expect(result.checkoutUrl).toContain(encodeURIComponent('pay/special+id'));
  });

  it('returns a gatewayReference of form mock_{paymentId}', async () => {
    const result = await mockGateway.createCheckout(
      { paymentId: 'pay-456', amountMinor: 200n, currency: 'IRT', callbackUrl: 'https://example.com/cb' },
      'idem-key-3',
    );
    expect(result.gatewayReference).toBe('mock_pay-456');
  });

  it('includes idempotencyKey as key= param in the URL', async () => {
    const result = await mockGateway.createCheckout(
      { paymentId: 'pay-789', amountMinor: 1000n, currency: 'IRT', callbackUrl: 'https://example.com/cb' },
      'my-idem-key',
    );
    expect(result.checkoutUrl).toContain('my-idem-key');
  });

  it('URL starts with /checkout/mock', async () => {
    const result = await mockGateway.createCheckout(
      { paymentId: 'pay-000', amountMinor: 1n, currency: 'IRT', callbackUrl: 'https://example.com/cb' },
      'key',
    );
    expect(result.checkoutUrl.startsWith('/checkout/mock')).toBe(true);
  });
});

// ─── verify ───────────────────────────────────────────────────────────────────

describe('mockGateway.verify', () => {
  it('always returns paid: true', async () => {
    const result = await mockGateway.verify({ paymentId: 'pay-1', gatewayReference: 'mock_pay-1' });
    expect(result.paid).toBe(true);
  });

  it('includes simulated: true in raw response', async () => {
    const result = await mockGateway.verify({ paymentId: 'pay-2', gatewayReference: 'mock_pay-2' });
    expect((result.raw as Record<string, unknown>)?.simulated).toBe(true);
  });
});

// ─── refund ───────────────────────────────────────────────────────────────────

describe('mockGateway.refund', () => {
  it('returns a gatewayReference using the provided gatewayReference', async () => {
    const result = await mockGateway.refund!(
      { paymentId: 'pay-1', amountMinor: 500n, gatewayReference: 'existing-ref-xyz' },
      'refund-idem-1',
    );
    expect(result.gatewayReference).toBe('existing-ref-xyz');
  });

  it('generates a mock_refund_{paymentId} reference when no gatewayReference provided', async () => {
    const result = await mockGateway.refund!(
      { paymentId: 'pay-999', amountMinor: 100n },
      'refund-idem-2',
    );
    expect(result.gatewayReference).toBe('mock_refund_pay-999');
  });

  it('mock gateway has a refund function', () => {
    expect(typeof mockGateway.refund).toBe('function');
  });
});

// ─── gateway name ─────────────────────────────────────────────────────────────

describe('mockGateway', () => {
  it('has name "mock"', () => {
    expect(mockGateway.name).toBe('mock');
  });
});
