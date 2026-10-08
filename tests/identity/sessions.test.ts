/**
 * Unit tests for server/identity/sessions.ts
 * createSession, revokeSession, resolveSession, rotateSession
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
import { createSession, revokeSession, resolveSession, rotateSession } from '../../server/identity/sessions';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

// ─── createSession ────────────────────────────────────────────────────────────

describe('createSession', () => {
  // Regression: mobile sign-in passed the 'unknown' client fingerprint into the inet column,
  // so every app login failed with 500 when TRUST_PROXY is off.
  it('stores a non-IP client fingerprint as NULL and keeps real IPs', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);
    await createSession('user-1', 60, { clientType: 'ANDROID', lastIp: 'unknown' });
    await createSession('user-1', 60, { clientType: 'ANDROID', lastIp: '203.0.113.7' });
    await createSession('user-1', 60, { clientType: 'IOS', lastIp: '2001:db8::1' });
    expect((mockQuery.mock.calls[0][1] as unknown[])[7]).toBeNull();
    expect((mockQuery.mock.calls[1][1] as unknown[])[7]).toBe('203.0.113.7');
    expect((mockQuery.mock.calls[2][1] as unknown[])[7]).toBe('2001:db8::1');
  });

  it('inserts a session row and returns a raw token string', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const token = await createSession('user-1');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    // Verify the INSERT was called with hashed token (not raw)
    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('INSERT INTO sessions');
    // Raw token should NOT appear in the query params (we store the hash)
    const params = call[1] as string[];
    expect(params[0]).toBe('user-1');
    expect(params[1]).not.toBe(token); // param[1] is the hash
  });

  it('passes client metadata (client_type, device fields) to query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await createSession('user-2', 86400, {
      clientType: 'IOS',
      deviceIdHash: 'dev-hash-abc',
      deviceName: 'iPhone 15',
      lastIp: '1.2.3.4',
    });
    const params = mockQuery.mock.calls[0][1] as string[];
    expect(params[3]).toBe('IOS');
    expect(params[4]).toBe('dev-hash-abc');
    expect(params[5]).toBe('iPhone 15');
    expect(params[7]).toBe('1.2.3.4');
  });

  it('defaults client_type to WEB when metadata is empty', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await createSession('user-3');
    const params = mockQuery.mock.calls[0][1] as string[];
    expect(params[3]).toBe('WEB');
  });
});

// ─── revokeSession ────────────────────────────────────────────────────────────

describe('revokeSession', () => {
  it('updates revoked_at for the given token hash', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await revokeSession('some-raw-token');
    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('revoked_at=now()');
    // param should be the SHA-256 hash (hex string, not the raw token)
    const hashParam = (call[1] as string[])[0];
    expect(hashParam).toHaveLength(64);
    expect(hashParam).not.toBe('some-raw-token');
  });
});

// ─── resolveSession ───────────────────────────────────────────────────────────

describe('resolveSession', () => {
  it('returns userId when session is valid', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-99' }], rowCount: 1 } as never);
    const userId = await resolveSession('valid-raw-token');
    expect(userId).toBe('user-99');
  });

  it('returns null when session does not exist or is expired/revoked', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const userId = await resolveSession('expired-token');
    expect(userId).toBeNull();
  });
});

// ─── rotateSession ────────────────────────────────────────────────────────────

describe('rotateSession', () => {
  it('revokes old token and creates a new one, returning the new raw token', async () => {
    // resolveSession call (SELECT)
    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-42' }], rowCount: 1 } as never);
    // revokeSession call (UPDATE revoked_at)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    // createSession call (INSERT)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    const newToken = await rotateSession('old-raw-token');
    expect(typeof newToken).toBe('string');
    expect(newToken).not.toBe('old-raw-token');
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it('returns null when original session is invalid', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // resolveSession → null
    const result = await rotateSession('invalid-token');
    expect(result).toBeNull();
    // Should have called only resolveSession, not revokeSession or createSession
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
