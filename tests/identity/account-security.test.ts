/**
 * Unit tests for server/identity/account-security.ts
 * isLoginLocked, recordLoginFailure, recordLoginSuccess
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
import { isLoginLocked, recordLoginFailure, recordLoginSuccess } from '../../server/identity/account-security';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

// ─── isLoginLocked ────────────────────────────────────────────────────────────

describe('isLoginLocked', () => {
  it('returns false when no account_security_state row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const locked = await isLoginLocked('user-1');
    expect(locked).toBe(false);
  });

  it('returns false when locked is false', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ locked: false }], rowCount: 1 } as never);
    const locked = await isLoginLocked('user-2');
    expect(locked).toBe(false);
  });

  it('returns true when locked_until is in the future', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ locked: true }], rowCount: 1 } as never);
    const locked = await isLoginLocked('user-3');
    expect(locked).toBe(true);
  });

  it('passes the user_id to the query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await isLoginLocked('user-abc');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('account_security_state'),
      ['user-abc'],
    );
  });
});

// ─── recordLoginFailure ───────────────────────────────────────────────────────

describe('recordLoginFailure', () => {
  it('calls INSERT ... ON CONFLICT DO UPDATE with user_id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recordLoginFailure('user-1');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO account_security_state');
    expect(sql).toContain('ON CONFLICT');
    expect(params[0]).toBe('user-1');
  });

  it('includes failed_login_count and locked_until CASE logic', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recordLoginFailure('user-2');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('failed_login_count');
    expect(sql).toContain('locked_until');
    expect(sql).toContain('CASE');
  });

  it('passes MAX_FAILURES and LOCK_SECONDS as query params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recordLoginFailure('user-3');
    const params = mockQuery.mock.calls[0][1] as unknown[];
    // params[1] = MAX_FAILURES, params[2] = LOCK_SECONDS
    expect(typeof params[1]).toBe('number');
    expect(typeof params[2]).toBe('number');
    expect(params[1]).toBeGreaterThan(0);
    expect(params[2]).toBeGreaterThan(0);
  });
});

// ─── recordLoginSuccess ───────────────────────────────────────────────────────

describe('recordLoginSuccess', () => {
  it('resets failed_login_count and clears locked_until on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recordLoginSuccess('user-1');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('failed_login_count=0');
    expect(sql).toContain('locked_until=NULL');
    expect(params[0]).toBe('user-1');
  });

  it('sets last_success_at via ON CONFLICT update', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recordLoginSuccess('user-2');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('last_success_at');
    expect(sql).toContain('ON CONFLICT');
  });
});
