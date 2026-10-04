/**
 * Unit tests for server/identity/password-policy.ts
 * assertStrongPassword — length, uppercase, lowercase, digit, symbol checks
 * Also verifies registration route calls the policy.
 */
import { describe, it, expect } from 'vitest';
import { assertStrongPassword } from '../../server/identity/password-policy';

// ─── assertStrongPassword ─────────────────────────────────────────────────────

describe('assertStrongPassword', () => {
  const VALID = 'MyStr0ng!Password';

  it('accepts a password that satisfies all requirements', () => {
    expect(() => assertStrongPassword(VALID)).not.toThrow();
  });

  it('throws VALIDATION_ERROR when password is shorter than 14 characters', () => {
    try {
      assertStrongPassword('Short1!');
      expect.fail('should have thrown');
    } catch (e: unknown) {
      expect((e as { code?: string }).code).toBe('VALIDATION_ERROR');
      expect((e as Error).message).toContain('14');
    }
  });

  it('throws VALIDATION_ERROR when no uppercase letter', () => {
    try {
      assertStrongPassword('alllowercas3!zz');
      expect.fail('should have thrown');
    } catch (e: unknown) {
      expect((e as { code?: string }).code).toBe('VALIDATION_ERROR');
      expect((e as Error).message.toLowerCase()).toContain('uppercase');
    }
  });

  it('throws VALIDATION_ERROR when no lowercase letter', () => {
    try {
      assertStrongPassword('ALLUPPERCASE3!ZZ');
      expect.fail('should have thrown');
    } catch (e: unknown) {
      expect((e as { code?: string }).code).toBe('VALIDATION_ERROR');
      expect((e as Error).message.toLowerCase()).toContain('lowercase');
    }
  });

  it('throws VALIDATION_ERROR when no digit', () => {
    try {
      assertStrongPassword('NoDigitsHere!Zz');
      expect.fail('should have thrown');
    } catch (e: unknown) {
      expect((e as { code?: string }).code).toBe('VALIDATION_ERROR');
      expect((e as Error).message.toLowerCase()).toContain('number');
    }
  });

  it('throws VALIDATION_ERROR when no symbol', () => {
    try {
      assertStrongPassword('NoSymbolsHere123');
      expect.fail('should have thrown');
    } catch (e: unknown) {
      expect((e as { code?: string }).code).toBe('VALIDATION_ERROR');
      expect((e as Error).message.toLowerCase()).toContain('symbol');
    }
  });

  it('accepts minimum-length password of exactly 14 chars with all rules met', () => {
    // exactly 14 chars: Aa1!0000000000 is 14 chars
    expect(() => assertStrongPassword('Aa1!0000000000')).not.toThrow();
  });

  it('throws for password of exactly 13 chars even if it meets other rules', () => {
    try {
      assertStrongPassword('Aa1!000000000'); // 13 chars
      expect.fail('should have thrown');
    } catch (e: unknown) {
      expect((e as { code?: string }).code).toBe('VALIDATION_ERROR');
    }
  });
});

// ─── Registration route imports assertStrongPassword ─────────────────────────

describe('registration route password-policy wiring', () => {
  it('the register route imports assertStrongPassword from password-policy', async () => {
    // Read the route source and verify it uses the policy
    const { readFileSync } = await import('node:fs');
    const routeSrc = readFileSync(
      new URL('../../app/api/v1/auth/register/route.ts', import.meta.url).pathname,
      'utf8',
    );
    expect(routeSrc).toContain('assertStrongPassword');
    expect(routeSrc).toContain('password-policy');
  });
});
