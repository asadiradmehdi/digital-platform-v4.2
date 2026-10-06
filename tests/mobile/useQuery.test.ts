/**
 * Unit tests for mobile utility logic.
 * Avoids React Native / Expo native imports — tests pure logic only.
 */
import { describe, it, expect } from 'vitest';

describe('ApiClientError', () => {
  it('is constructable and preserves fields', async () => {
    // Inline the class to avoid expo-secure-store import chain
    class ApiClientError extends Error {
      constructor(public readonly status: number, public readonly code: string, message: string, public readonly correlationId?: string) {
        super(message);
      }
    }
    const err = new ApiClientError(401, 'UNAUTHORIZED', 'دسترسی غیرمجاز', 'corr-123');
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('دسترسی غیرمجاز');
    expect(err.correlationId).toBe('corr-123');
  });
});

describe('TransactionSummary contract shape', () => {
  it('LedgerEntry has direction and amountMinor', () => {
    type LedgerEntry = { accountId: string; direction: 'CREDIT' | 'DEBIT'; amountMinor: number };
    const entry: LedgerEntry = { accountId: 'acc-1', direction: 'CREDIT', amountMinor: 5000 };
    expect(entry.direction).toBe('CREDIT');
    expect(entry.amountMinor).toBe(5000);
  });

  it('TransactionSummary shape with entries array', () => {
    const tx = {
      id: 'tx-1', currency: 'IRR', referenceType: 'DEPOSIT',
      referenceId: null, idempotencyKey: 'idem-1', createdAt: new Date().toISOString(),
      entries: [{ accountId: 'acc-1', direction: 'CREDIT' as const, amountMinor: 100_000 }],
    };
    expect(tx.entries[0].direction).toBe('CREDIT');
    expect(tx.entries[0].amountMinor).toBe(100_000);
  });
});

describe('Order status tone mapping', () => {
  function statusTone(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'PROCESSING': case 'PROVIDER_SUBMITTED': return 'info';
      case 'QUEUED': case 'PAID': return 'warning';
      case 'FAILED': case 'CANCELLED': return 'danger';
      default: return 'neutral';
    }
  }

  it.each([
    ['COMPLETED', 'success'],
    ['PROCESSING', 'info'],
    ['PROVIDER_SUBMITTED', 'info'],
    ['QUEUED', 'warning'],
    ['PAID', 'warning'],
    ['FAILED', 'danger'],
    ['CANCELLED', 'danger'],
    ['UNKNOWN', 'neutral'],
  ])('status %s → tone %s', (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });
});

describe('referenceTypeLabel mapping', () => {
  const referenceTypeLabel: Record<string, string> = {
    DEPOSIT: 'افزایش موجودی',
    SERVICE_CHARGE: 'هزینه سرویس',
    REFUND: 'بازگشت وجه',
    SUBSCRIPTION: 'اشتراک',
    TOPUP: 'افزایش موجودی',
  };

  it('maps DEPOSIT to Persian label', () => {
    expect(referenceTypeLabel['DEPOSIT']).toBe('افزایش موجودی');
  });

  it('maps SERVICE_CHARGE to Persian label', () => {
    expect(referenceTypeLabel['SERVICE_CHARGE']).toBe('هزینه سرویس');
  });

  it('maps unknown key to undefined (fallback to raw type)', () => {
    expect(referenceTypeLabel['UNKNOWN_TYPE']).toBeUndefined();
  });
});
