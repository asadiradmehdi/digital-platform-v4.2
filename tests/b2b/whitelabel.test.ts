import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

import { query } from '../../server/core/db';
import { upsertBranding, getBranding, resolveWorkspaceByDomain } from '../../server/b2b/whitelabel';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('upsertBranding', () => {
  it('calls INSERT ... ON CONFLICT DO UPDATE with workspace_id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await upsertBranding('ws-1', { displayName: 'Acme', primaryColor: '#ff0000' });
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO workspace_branding');
    expect(sql).toContain('ON CONFLICT(workspace_id) DO UPDATE');
    expect(params[0]).toBe('ws-1');
    expect(params[1]).toBe('Acme');
  });

  it('passes null for unset fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await upsertBranding('ws-2', {});
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    // displayName, logoUrl, faviconUrl, primaryColor, customDomain, supportEmail are all null
    expect(params[1]).toBeNull();
    expect(params[2]).toBeNull();
    expect(params[3]).toBeNull();
    expect(params[4]).toBeNull();
    expect(params[5]).toBeNull();
    expect(params[6]).toBeNull();
  });

  it('uses COALESCE to preserve existing values on conflict', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await upsertBranding('ws-1', { logoUrl: 'https://example.com/logo.png' });
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('COALESCE');
  });

  it('merges metadata with || operator', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await upsertBranding('ws-1', { metadata: { theme: 'dark' } });
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('workspace_branding.metadata ||');
    expect(params[7]).toEqual({ theme: 'dark' });
  });

  it('defaults metadata to empty object when not provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await upsertBranding('ws-1', {});
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[7]).toEqual({});
  });
});

describe('getBranding', () => {
  it('returns branding row when found', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ displayName: 'Acme', logoUrl: null, faviconUrl: null, primaryColor: '#fff', customDomain: null, supportEmail: null, metadata: {} }],
      rowCount: 1,
    } as never);
    const branding = await getBranding('ws-1');
    expect(branding).toMatchObject({ displayName: 'Acme', primaryColor: '#fff' });
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM workspace_branding WHERE workspace_id=$1');
    expect(params).toEqual(['ws-1']);
  });

  it('returns null when workspace has no branding', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const branding = await getBranding('ws-none');
    expect(branding).toBeNull();
  });

  it('selects camelCase column aliases', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await getBranding('ws-1');
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('"displayName"');
    expect(sql).toContain('"logoUrl"');
    expect(sql).toContain('"primaryColor"');
    expect(sql).toContain('"customDomain"');
    expect(sql).toContain('"supportEmail"');
  });
});

describe('resolveWorkspaceByDomain', () => {
  it('returns workspaceId for a matching domain', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-custom' }], rowCount: 1 } as never);
    const wsId = await resolveWorkspaceByDomain('acme.example.com');
    expect(wsId).toBe('ws-custom');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('custom_domain=$1');
    expect(params).toEqual(['acme.example.com']);
  });

  it('returns null when domain is not registered', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const wsId = await resolveWorkspaceByDomain('unknown.example.com');
    expect(wsId).toBeNull();
  });
});
