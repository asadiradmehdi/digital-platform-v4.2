import { describe, it, expect } from 'vitest';
import { assertOrderTransition, canTransitionOrder } from '../../server/core/order-state';

describe('assertOrderTransition', () => {
  it('allows CREATED → PAYMENT_PENDING', () => {
    expect(() => assertOrderTransition('CREATED', 'PAYMENT_PENDING')).not.toThrow();
  });

  it('allows CREATED → CANCELLED', () => {
    expect(() => assertOrderTransition('CREATED', 'CANCELLED')).not.toThrow();
  });

  it('throws CONFLICT for invalid transition CREATED → PAID', () => {
    expect(() => assertOrderTransition('CREATED', 'PAID')).toThrow(
      expect.objectContaining({ code: 'CONFLICT' }),
    );
  });

  it('allows PAYMENT_PENDING → PAID', () => {
    expect(() => assertOrderTransition('PAYMENT_PENDING', 'PAID')).not.toThrow();
  });

  it('allows PAID → QUEUED', () => {
    expect(() => assertOrderTransition('PAID', 'QUEUED')).not.toThrow();
  });

  it('allows PAID → REFUND_PENDING', () => {
    expect(() => assertOrderTransition('PAID', 'REFUND_PENDING')).not.toThrow();
  });

  it('throws CONFLICT for CANCELLED → anything', () => {
    expect(() => assertOrderTransition('CANCELLED', 'CREATED')).toThrow(
      expect.objectContaining({ code: 'CONFLICT' }),
    );
  });

  it('throws CONFLICT for REFUNDED → anything', () => {
    expect(() => assertOrderTransition('REFUNDED', 'REFUND_PENDING')).toThrow(
      expect.objectContaining({ code: 'CONFLICT' }),
    );
  });

  it('allows PROCESSING → PROVIDER_SUBMITTED', () => {
    expect(() => assertOrderTransition('PROCESSING', 'PROVIDER_SUBMITTED')).not.toThrow();
  });

  it('allows PROCESSING → FAILED', () => {
    expect(() => assertOrderTransition('PROCESSING', 'FAILED')).not.toThrow();
  });

  it('error message includes from and to states', () => {
    try {
      assertOrderTransition('CREATED', 'COMPLETED');
    } catch (err: unknown) {
      expect((err as { details?: { from: string; to: string } }).details).toMatchObject({
        from: 'CREATED',
        to: 'COMPLETED',
      });
    }
  });
});

describe('canTransitionOrder', () => {
  it('returns true for valid transition', () => {
    expect(canTransitionOrder('QUEUED', 'PROCESSING')).toBe(true);
  });

  it('returns false for invalid transition', () => {
    expect(canTransitionOrder('COMPLETED', 'CREATED')).toBe(false);
  });

  it('returns false for terminal states', () => {
    expect(canTransitionOrder('CANCELLED', 'PAYMENT_PENDING')).toBe(false);
    expect(canTransitionOrder('REFUNDED', 'COMPLETED')).toBe(false);
  });

  it('returns true for IN_PROGRESS → COMPLETED', () => {
    expect(canTransitionOrder('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });
});
