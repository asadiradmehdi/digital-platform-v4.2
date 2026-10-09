/**
 * Unit tests for server/identity/password-policy.ts
 * assertStrongPassword — minimum length, no composition rules, guessable-password checks
 * Also verifies registration route calls the policy.
 */
import { describe, it, expect } from 'vitest';
import { assertStrongPassword } from '../../server/identity/password-policy';

// ─── assertStrongPassword (ASVS 5.0 V6.2: length, no composition rules, no guessable passwords) ───

const fails = (pw: string, ctx?: { email?: string }) => {
  try { assertStrongPassword(pw, ctx); return null; } catch (e) { return e as { code?: string; message: string }; }
};

describe('assertStrongPassword', () => {
  it('accepts a long passphrase with no upper case, digits or symbols (no composition rules)', () => {
    expect(fails('shab-e yalda dar tehran')).toBeNull();
    expect(fails('mybrotherasadrocks')).toBeNull();
    expect(fails('رمز عبور من خیلی بلنده')).toBeNull();
  });

  it('rejects anything shorter than 14 characters with a Persian message', () => {
    const e = fails('Short-Pass-1!');
    expect(e?.code).toBe('VALIDATION_ERROR');
    expect(e?.message).toContain('۱۴');
    expect(fails('abcdefghijklmn')).not.toBeNull(); // 14 chars but sequential
  });

  it('rejects trivially guessable long passwords', () => {
    expect(fails('aaaaaaaaaaaaaaaa')?.message).toContain('قابل حدس');
    expect(fails('12345678901234')).not.toBeNull();
    expect(fails('password123456')).not.toBeNull();
    expect(fails('zohalpay2026!!')).not.toBeNull();
  });

  it('rejects a password built from the email address', () => {
    expect(fails('alireza.asadi-2026', { email: 'alireza.asadi@example.com' })).not.toBeNull();
    expect(fails('alireza.asadi-2026', { email: 'someone@example.com' })).toBeNull();
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
