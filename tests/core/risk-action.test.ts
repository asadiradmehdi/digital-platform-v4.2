import { describe, it, expect } from 'vitest';
import { assertActionAllowed } from '../../server/core/risk';

describe('assertActionAllowed', () => {
  it('does not throw for NORMAL state', () => {
    expect(() => assertActionAllowed('NORMAL')).not.toThrow();
  });

  it('throws RISK_REVIEW for REVIEW state', () => {
    try {
      assertActionAllowed('REVIEW');
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe('RISK_REVIEW');
    }
  });

  it('throws FORBIDDEN for RESTRICTED state', () => {
    try {
      assertActionAllowed('RESTRICTED');
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe('FORBIDDEN');
    }
  });
});
