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

describe('platform_admin role lookup', () => {
  // Regression: the check queried a non-existent user_roles table, so every platform-admin route
  // (pricing rules, catalog sync, content admin, /admin) failed with "relation user_roles does not exist".
  it('resolves the global system role through workspace membership, never user_roles', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ is_admin: true }], rowCount: 1 } as never);
    await isPlatformAdmin('user-1');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('user_roles');
    expect(sql).toContain('member_roles');
    expect(sql).toContain('workspace_members');
    expect(sql).toMatch(/wm\.status = 'ACTIVE'/);
  });

  it('ignores workspace-scoped roles named platform_admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ is_admin: false }], rowCount: 1 } as never);
    await requirePlatformAdmin('user-1').catch(() => undefined);
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('r.workspace_id IS NULL');
    expect(sql).toContain('r.is_system = true');
  });
});
