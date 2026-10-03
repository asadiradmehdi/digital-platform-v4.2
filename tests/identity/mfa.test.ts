import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB and crypto so tests run without PostgreSQL.
vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));
vi.mock('../../server/identity/recovery', () => ({
  issueRecoveryCodes: vi.fn(async () => ['A1B2C', 'D3E4F', 'G5H6I', 'J7K8L', 'M9N0O', 'P1Q2R', 'S3T4U', 'V5W6X', 'Y7Z8A', 'B9C0D']),
  consumeRecoveryCode: vi.fn(async () => true),
}));

import { query } from '../../server/core/db';
import { verifyTotp, generateTotpSecret } from '../../server/identity/mfa';
import {
  hasMfaEnabled,
  beginTotpEnrollment,
  confirmTotpEnrollment,
  disableTotpMfa,
  verifyTotpCode,
  issueMfaChallenge,
  verifyMfaChallenge,
  getRecoveryCodeStatus,
  regenerateRecoveryCodes,
} from '../../server/identity/mfa-service';

const mockQuery = vi.mocked(query);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hasMfaEnabled', () => {
  it('returns true when an active confirmed TOTP authenticator exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ exists: true }], rowCount: 1 } as never);
    expect(await hasMfaEnabled('user-1')).toBe(true);
  });

  it('returns false when no active authenticator exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ exists: false }], rowCount: 1 } as never);
    expect(await hasMfaEnabled('user-1')).toBe(false);
  });
});

describe('beginTotpEnrollment', () => {
  it('revokes pending enrollments then inserts a new one', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);
    const { secret } = await beginTotpEnrollment('user-1', 'My Phone');
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain("INSERT INTO authenticators");
    expect(insertCall[1]).toContain('user-1');
  });
});

describe('confirmTotpEnrollment', () => {
  it('returns null when no pending authenticator exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    expect(await confirmTotpEnrollment('user-1', '000000')).toBeNull();
  });

  it('returns null when TOTP code is invalid', async () => {
    const secret = generateTotpSecret();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'auth-1', public_key: secret }], rowCount: 1 } as never);
    expect(await confirmTotpEnrollment('user-1', '000000')).toBeNull();
  });

  it('returns recovery codes and updates authenticator when code is valid', async () => {
    const secret = generateTotpSecret();
    // Generate a real TOTP code for the current window.
    const { createHmac } = await import('node:crypto');
    function base32Decode(s: string) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let bits = 0, val = 0; const out: number[] = [];
      for (const c of s.replace(/=+$/, '').toUpperCase()) { const idx = alphabet.indexOf(c); if (idx < 0) continue; val = (val << 5) | idx; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
      return Buffer.from(out);
    }
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / 30);
    const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', key).update(buf).digest();
    const pos = digest[digest.length - 1] & 15;
    const num = ((digest[pos] & 127) << 24) | (digest[pos + 1] << 16) | (digest[pos + 2] << 8) | digest[pos + 3];
    const validCode = String(num % 1_000_000).padStart(6, '0');

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'auth-1', public_key: secret }], rowCount: 1 } as never) // pending auth
      .mockResolvedValue({ rows: [], rowCount: 0 } as never); // subsequent queries

    const codes = await confirmTotpEnrollment('user-1', validCode);
    expect(codes).toHaveLength(10);
  });
});

describe('verifyTotp utility', () => {
  it('rejects codes with wrong length', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, '1234567')).toBe(false);
  });

  it('rejects non-numeric codes', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
  });
});

describe('issueMfaChallenge', () => {
  it('inserts a challenge and returns a non-empty token', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const token = await issueMfaChallenge('user-1');
    expect(token.length).toBeGreaterThan(10);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO security_challenges'),
      expect.arrayContaining(['user-1'])
    );
  });
});

describe('verifyMfaChallenge', () => {
  it('returns null when challenge token is not found or expired', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    expect(await verifyMfaChallenge('bad-token', '123456', 'totp')).toBeNull();
  });
});

describe('getRecoveryCodeStatus', () => {
  it('returns total and used counts', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: '10', used: '3' }], rowCount: 1 } as never);
    const status = await getRecoveryCodeStatus('user-1');
    expect(status).toEqual({ total: 10, used: 3 });
  });
});

describe('regenerateRecoveryCodes', () => {
  it('invalidates old codes and returns 10 new codes', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // invalidate
    const codes = await regenerateRecoveryCodes('user-1');
    expect(codes).toHaveLength(10);
  });
});
