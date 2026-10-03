import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
import { requirePlatformAdmin, isPlatformAdmin } from '../../server/identity/platform-admin';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('requirePlatformAdmin', () => {
  it('does not throw when user has platform_admin role', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ is_admin: true }], rowCount: 1 } as never);
    await expect(requirePlatformAdmin('user-admin')).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('platform_admin'), ['user-admin']);
  });

  it('throws FORBIDDEN when user does not have platform_admin role', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ is_admin: false }], rowCount: 1 } as never);
    await expect(requirePlatformAdmin('user-regular')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('throws FORBIDDEN when query returns no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(requirePlatformAdmin('user-none')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('isPlatformAdmin', () => {
  it('returns true when user has platform_admin role', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ is_admin: true }], rowCount: 1 } as never);
    expect(await isPlatformAdmin('user-admin')).toBe(true);
  });

  it('returns false when user does not have platform_admin role', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ is_admin: false }], rowCount: 1 } as never);
    expect(await isPlatformAdmin('user-regular')).toBe(false);
  });

  it('returns false when query returns no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    expect(await isPlatformAdmin('user-none')).toBe(false);
  });
});
