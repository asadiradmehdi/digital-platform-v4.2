/**
 * Unit tests for server/identity/rbac.ts
 * requireWorkspacePermission
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
import { requireWorkspacePermission } from '../../server/identity/rbac';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('requireWorkspacePermission', () => {
  it('resolves without error when user has the required permission', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ allowed: true }], rowCount: 1 } as never);
    await expect(
      requireWorkspacePermission('user-1', 'ws-1', 'orders.create'),
    ).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('workspace_members'),
      ['user-1', 'ws-1', 'orders.create'],
    );
  });

  it('throws FORBIDDEN when user lacks the permission', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ allowed: false }], rowCount: 1 } as never);
    await expect(
      requireWorkspacePermission('user-2', 'ws-1', 'orders.create'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws FORBIDDEN when query returns no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(
      requireWorkspacePermission('user-ghost', 'ws-1', 'wallet.deposit'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('joins roles, permissions and checks workspace membership status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ allowed: true }], rowCount: 1 } as never);
    await requireWorkspacePermission('user-1', 'ws-1', 'workspace.members.read');
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('workspace_members');
    expect(sql).toContain('role_permissions');
    expect(sql).toContain('ACTIVE');
  });
});
