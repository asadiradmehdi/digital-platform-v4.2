import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
import { createClientWorkspace, listClientWorkspaces, promoteToAgency } from '../../server/b2b/agency';
import { upsertBranding, getBranding, resolveWorkspaceByDomain } from '../../server/b2b/whitelabel';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

// ─── Agency ──────────────────────────────────────────────────────────────────

describe('createClientWorkspace', () => {
  it('creates a client workspace when parent is an agency', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ workspace_type: 'agency' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'ws-client-1' }], rowCount: 1 } as never);

    const id = await createClientWorkspace({
      agencyWorkspaceId: 'ws-agency-1',
      ownerUserId: 'user-1',
      name: 'Client Corp',
      slug: 'client-corp',
    });

    expect(id).toBe('ws-client-1');
    expect(mockQuery).toHaveBeenNthCalledWith(2, expect.stringContaining("'client'"), expect.arrayContaining(['ws-agency-1']));
  });

  it('throws FORBIDDEN when parent workspace is not an agency', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ workspace_type: 'standard' }], rowCount: 1 } as never);

    await expect(
      createClientWorkspace({ agencyWorkspaceId: 'ws-std', ownerUserId: 'user-1', name: 'X', slug: 'x' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws FORBIDDEN when parent workspace does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      createClientWorkspace({ agencyWorkspaceId: 'ws-none', ownerUserId: 'user-1', name: 'X', slug: 'x' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('listClientWorkspaces', () => {
  it('returns workspaces belonging to the agency', async () => {
    const rows = [
      { id: 'ws-c1', name: 'Client One', slug: 'client-one', workspace_type: 'client' },
      { id: 'ws-c2', name: 'Client Two', slug: 'client-two', workspace_type: 'client' },
    ];
    mockQuery.mockResolvedValueOnce({ rows, rowCount: 2 } as never);

    const result = await listClientWorkspaces('ws-agency-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('ws-c1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('parent_workspace_id=$1'),
      ['ws-agency-1']
    );
  });
});

describe('promoteToAgency', () => {
  it('calls UPDATE to set workspace_type to agency', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await promoteToAgency('ws-std');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("workspace_type='agency'"),
      ['ws-std']
    );
  });
});

// ─── White-label ─────────────────────────────────────────────────────────────

describe('upsertBranding', () => {
  it('calls INSERT ... ON CONFLICT DO UPDATE with workspace id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await upsertBranding('ws-1', {
      displayName: 'ACME Platform',
      primaryColor: '#FF5733',
      customDomain: 'acme.example.com',
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(workspace_id) DO UPDATE'),
      expect.arrayContaining(['ws-1', 'ACME Platform'])
    );
  });
});

describe('getBranding', () => {
  it('returns branding when found', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ displayName: 'ACME', logoUrl: null, primaryColor: '#000', customDomain: 'acme.io', supportEmail: null, metadata: {} }],
      rowCount: 1,
    } as never);

    const result = await getBranding('ws-1');
    expect(result).not.toBeNull();
    expect(result?.displayName).toBe('ACME');
  });

  it('returns null when no branding row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const result = await getBranding('ws-no-branding');
    expect(result).toBeNull();
  });
});

describe('resolveWorkspaceByDomain', () => {
  it('returns workspace id for a matching custom domain', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-1' }], rowCount: 1 } as never);

    const id = await resolveWorkspaceByDomain('acme.example.com');
    expect(id).toBe('ws-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('custom_domain=$1'),
      ['acme.example.com']
    );
  });

  it('returns null when no workspace matches the domain', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const id = await resolveWorkspaceByDomain('unknown.example.com');
    expect(id).toBeNull();
  });
});
