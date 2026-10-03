import { describe, expect, it, beforeEach, afterEach } from 'vitest';

// Set SECRETS_MASTER_KEY before importing the module so the key() helper works.
const TEST_KEY = 'test-secret-master-key-32bytes!!';
const ALT_KEY = 'another-different-key-32bytes!!!';

describe('secret-box (AES-256-GCM)', () => {
  const originalKey = process.env.SECRETS_MASTER_KEY;

  beforeEach(() => {
    process.env.SECRETS_MASTER_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.SECRETS_MASTER_KEY;
    } else {
      process.env.SECRETS_MASTER_KEY = originalKey;
    }
  });

  it('encrypt → decrypt roundtrip returns the original plaintext', async () => {
    const { encryptSecret, decryptSecret } = await import('../../server/core/secret-box');
    const plain = 'my-super-secret-provider-token';
    const ciphertext = encryptSecret(plain);
    expect(ciphertext).not.toBe(plain);
    expect(decryptSecret(ciphertext)).toBe(plain);
  });

  it('two encryptions of the same plaintext produce different ciphertexts (random IV)', async () => {
    const { encryptSecret } = await import('../../server/core/secret-box');
    const plain = 'same-input';
    const c1 = encryptSecret(plain);
    const c2 = encryptSecret(plain);
    expect(c1).not.toBe(c2);
  });

  it('ciphertext starts with v1. version prefix', async () => {
    const { encryptSecret } = await import('../../server/core/secret-box');
    const c = encryptSecret('hello');
    expect(c.startsWith('v1.')).toBe(true);
    expect(c.split('.').length).toBe(4); // v1.<iv>.<tag>.<data>
  });

  it('wrong master key fails to decrypt', async () => {
    const { encryptSecret } = await import('../../server/core/secret-box');
    const ciphertext = encryptSecret('secret-value');

    // Re-import under a different key (clear module cache via dynamic import with cache-bust)
    process.env.SECRETS_MASTER_KEY = ALT_KEY;
    // Re-require the module by directly calling crypto primitives is tricky with ESM cache.
    // Instead, verify by checking that decryption throws with wrong key.
    const { decryptSecret } = await import('../../server/core/secret-box');
    expect(() => decryptSecret(ciphertext)).toThrow();
  });

  it('tampered ciphertext (altered data segment) fails authentication', async () => {
    const { encryptSecret, decryptSecret } = await import('../../server/core/secret-box');
    process.env.SECRETS_MASTER_KEY = TEST_KEY;
    const ciphertext = encryptSecret('tamper-test');
    const parts = ciphertext.split('.');
    // Corrupt the data segment (last part) by appending extra chars
    parts[3] = parts[3] + 'TAMPERED';
    expect(() => decryptSecret(parts.join('.'))).toThrow();
  });

  it('tampered auth tag fails authentication', async () => {
    const { encryptSecret, decryptSecret } = await import('../../server/core/secret-box');
    process.env.SECRETS_MASTER_KEY = TEST_KEY;
    const ciphertext = encryptSecret('auth-tag-tamper');
    const parts = ciphertext.split('.');
    // Corrupt the tag segment (index 2)
    parts[2] = 'AAAAAAAAAAAAAAAAAAAAAA';
    expect(() => decryptSecret(parts.join('.'))).toThrow();
  });

  it('unsupported version prefix throws', async () => {
    const { decryptSecret } = await import('../../server/core/secret-box');
    process.env.SECRETS_MASTER_KEY = TEST_KEY;
    expect(() => decryptSecret('v2.abc.def.ghi')).toThrow('Unsupported secret version');
  });

  it('encrypts and decrypts empty string', async () => {
    const { encryptSecret, decryptSecret } = await import('../../server/core/secret-box');
    process.env.SECRETS_MASTER_KEY = TEST_KEY;
    const c = encryptSecret('');
    expect(decryptSecret(c)).toBe('');
  });

  it('throws when SECRETS_MASTER_KEY is missing', async () => {
    delete process.env.SECRETS_MASTER_KEY;
    // Re-import doesn't help due to ESM caching; call encrypt which internally calls key()
    // We test by temporarily unsetting the env and verifying key() throws.
    const { encryptSecret } = await import('../../server/core/secret-box');
    expect(() => encryptSecret('any')).toThrow('SECRETS_MASTER_KEY is required');
  });
});
