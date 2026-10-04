import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

import { query } from '../../server/core/db';
import {
  createClientWorkspace,
  listClientWorkspaces,
  promoteToAgency,
} from '../../server/b2b/agency';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('createClientWorkspace', () => {
  const input = { agencyWorkspaceId: 'agency-1', ownerUserId: 'user-1', name: 'Client Co', slug: 'client-co' };

  it('throws FORBIDDEN when workspace is not agency type', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ workspace_type: 'standard' }], rowCount: 1 } as never);
    await expect(createClientWorkspace(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws FORBIDDEN when workspace does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(createClientWorkspace(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('inserts client workspace and returns id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ workspace_type: 'agency' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ws-client-1' }], rowCount: 1 } as never);

    const id = await createClientWorkspace(input);
    expect(id).toBe('ws-client-1');
  });

  it('INSERT sets workspace_type=client and parent_workspace_id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ workspace_type: 'agency' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ws-client-1' }], rowCount: 1 } as never);

    await createClientWorkspace(input);
    const [sql, params] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("'client'");
    expect(params).toContain('agency-1');
    expect(params).toContain('user-1');
    expect(params).toContain('Client Co');
    expect(params).toContain('client-co');
  });

  it('returns empty string when INSERT returns no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ workspace_type: 'agency' }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const id = await createClientWorkspace(input);
    expect(id).toBe('');
  });
});

describe('listClientWorkspaces', () => {
  it('returns array of client workspaces for agency', async () => {
    const rows = [
      { id: 'ws-1', name: 'Client A', slug: 'client-a', status: 'active', workspace_type: 'client', created_at: new Date() },
      { id: 'ws-2', name: 'Client B', slug: 'client-b', status: 'active', workspace_type: 'client', created_at: new Date() },
    ];
    mockQuery.mockResolvedValueOnce({ rows, rowCount: 2 } as never);

    const result = await listClientWorkspaces('agency-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('ws-1');
  });

  it('returns empty array when agency has no clients', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await listClientWorkspaces('agency-1');
    expect(result).toEqual([]);
  });

  it('queries with parent_workspace_id and workspace_type=client filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await listClientWorkspaces('agency-99');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('parent_workspace_id=$1');
    expect(sql).toContain("workspace_type='client'");
    expect(params).toContain('agency-99');
  });
});

describe('promoteToAgency', () => {
  it('issues UPDATE to set workspace_type=agency', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await promoteToAgency('ws-standard-1');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("workspace_type='agency'");
    expect(sql).toContain("workspace_type='standard'");
    expect(params).toContain('ws-standard-1');
  });

  it('resolves without error even if workspace is already agency', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(promoteToAgency('ws-already-agency')).resolves.not.toThrow();
  });
});
