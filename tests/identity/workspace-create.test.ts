import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

import { query } from '../../server/core/db';
import { createWorkspace } from '../../server/identity/workspace-settings';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

const validWorkspace = {
  id: 'ws-uuid-1234-5678-90ab-cdef01234567',
  name: 'Acme Corp',
  slug: 'acme-corp',
  status: 'ACTIVE',
  createdAt: '2026-10-03T00:00:00.000Z',
};

describe('createWorkspace', () => {
  it('creates a workspace and returns the new record', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [validWorkspace], rowCount: 1 } as never);
    const result = await createWorkspace({ ownerUserId: 'user-1', name: 'Acme Corp' });
    expect(result.name).toBe('Acme Corp');
    expect(result.slug).toBe('acme-corp');
    expect(result.status).toBe('ACTIVE');
  });

  it('auto-derives slug from name when not provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...validWorkspace, slug: 'hello-world' }], rowCount: 1 } as never);
    await createWorkspace({ ownerUserId: 'user-1', name: 'Hello World' });
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    // Third param is the derived slug
    expect(params[2]).toBe('hello-world');
  });

  it('uses provided slug when given', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...validWorkspace, slug: 'custom-slug' }], rowCount: 1 } as never);
    await createWorkspace({ ownerUserId: 'user-1', name: 'Acme Corp', slug: 'custom-slug' });
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[2]).toBe('custom-slug');
  });

  it('strips leading/trailing hyphens from auto-derived slug', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...validWorkspace, slug: 'my-company' }], rowCount: 1 } as never);
    await createWorkspace({ ownerUserId: 'user-1', name: '-- My Company --' });
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[2]).toBe('my-company');
  });

  it('throws VALIDATION_ERROR when name is empty', async () => {
    await expect(createWorkspace({ ownerUserId: 'user-1', name: '' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws VALIDATION_ERROR when name exceeds 255 chars', async () => {
    await expect(createWorkspace({ ownerUserId: 'user-1', name: 'a'.repeat(256) })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws INTERNAL_ERROR when DB returns no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(createWorkspace({ ownerUserId: 'user-1', name: 'Test' })).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('passes ownerUserId as first param to DB query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [validWorkspace], rowCount: 1 } as never);
    await createWorkspace({ ownerUserId: 'owner-uuid', name: 'Test' });
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe('owner-uuid');
  });

  it('inserts workspace AND member in single CTE query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [validWorkspace], rowCount: 1 } as never);
    await createWorkspace({ ownerUserId: 'user-1', name: 'Test' });
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO workspaces');
    expect(sql).toContain('INSERT INTO workspace_members');
    expect(sql).toContain('INSERT INTO member_roles');
  });
});
