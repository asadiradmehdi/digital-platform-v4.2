/**
 * Unit tests for server/identity/workspace-settings.ts — updateWorkspaceSettings
 * and the PATCH /api/v1/workspaces/[id] route handler
 *
 * Service tests call the real implementation (only DB is mocked).
 * Route tests stub all dependencies including updateWorkspaceSettings.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ─── Mock declarations (hoisted to top of file by Vitest) ────────────────────

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

vi.mock('../../server/identity/request-user', () => ({
  requireRequestUser: vi.fn(),
}));

vi.mock('../../server/identity/rbac', () => ({
  requireWorkspacePermission: vi.fn(),
}));

vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));

// We do NOT mock workspace-settings here.
// The route tests stub updateWorkspaceSettings through a separate mock below.
vi.mock('../../server/identity/workspace-settings', () => ({
  updateWorkspaceSettings: vi.fn(),
  createWorkspace: vi.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { withWorkspaceTransaction } from '../../server/core/db';
import { updateWorkspaceSettings } from '../../server/identity/workspace-settings';
import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { AppError } from '../../server/core/errors';

const mockTx = vi.mocked(withWorkspaceTransaction);
const mockUpdateSettings = vi.mocked(updateWorkspaceSettings);
const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);

beforeEach(() => vi.clearAllMocks());

// ─── updateWorkspaceSettings — service contract (SQL shape) ──────────────────
//
// Since workspace-settings is fully mocked above, we cannot call the real
// service here. Instead we verify its SQL contracts by calling updateWorkspaceSettings
// via real module import using vi.importActual.

describe('updateWorkspaceSettings — SQL contracts', () => {
  it('throws VALIDATION_ERROR when name exceeds 120 chars (no DB hit)', async () => {
    // Even with the mock in place, the real module validation runs first
    // because Vitest's importActual bypasses the mock.
    const { updateWorkspaceSettings: realFn } =
      await vi.importActual<typeof import('../../server/identity/workspace-settings')>(
        '../../server/identity/workspace-settings',
      );

    await expect(
      realFn({ workspaceId: 'ws-1', name: 'x'.repeat(121) })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws VALIDATION_ERROR when settings is an array', async () => {
    const { updateWorkspaceSettings: realFn } =
      await vi.importActual<typeof import('../../server/identity/workspace-settings')>(
        '../../server/identity/workspace-settings',
      );

    await expect(
      realFn({
        workspaceId: 'ws-1',
        settings: [1, 2, 3] as unknown as Record<string, unknown>,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('NOT_FOUND when DB returns no rows for the workspace', async () => {
    const { updateWorkspaceSettings: realFn } =
      await vi.importActual<typeof import('../../server/identity/workspace-settings')>(
        '../../server/identity/workspace-settings',
      );

    const clientQuery = vi.fn().mockResolvedValueOnce({ rows: [] });
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await expect(
      realFn({ workspaceId: 'ws-missing', name: 'Test' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('UPDATE query includes name= clause when name is provided', async () => {
    const { updateWorkspaceSettings: realFn } =
      await vi.importActual<typeof import('../../server/identity/workspace-settings')>(
        '../../server/identity/workspace-settings',
      );

    const updatedRow = {
      id: 'ws-1', name: 'New Name', slug: 'old-slug',
      status: 'ACTIVE', settings: {}, updatedAt: '2026-01-01',
    };
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'ws-1' }] })
      .mockResolvedValueOnce({ rows: [updatedRow] });
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await realFn({ workspaceId: 'ws-1', name: 'New Name' });
    const updateSql = clientQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain('name=');
  });

  it('UPDATE query includes settings=settings || for settings merge', async () => {
    const { updateWorkspaceSettings: realFn } =
      await vi.importActual<typeof import('../../server/identity/workspace-settings')>(
        '../../server/identity/workspace-settings',
      );

    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'ws-1' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'ws-1', name: 'WS', slug: 'ws',
          status: 'ACTIVE', settings: { theme: 'dark' }, updatedAt: '2026-01-01',
        }],
      });
    mockTx.mockImplementationOnce(async (_wid, _uid, fn) => fn({ query: clientQuery } as never));

    await realFn({ workspaceId: 'ws-1', settings: { theme: 'dark' } });
    const updateSql = clientQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain('settings=settings ||');
  });
});

// ─── PATCH /api/v1/workspaces/[id] route ─────────────────────────────────────

describe('PATCH /api/v1/workspaces/[id] route', () => {
  type RouteModule = typeof import('../../app/api/v1/workspaces/[id]/route');
  let PATCH: RouteModule['PATCH'];

  beforeAll(async () => {
    ({ PATCH } = await import('../../app/api/v1/workspaces/[id]/route'));
  });

  function makeRequest(body: unknown) {
    return {
      json: async () => body,
      headers: { get: (_key: string) => null },
      url: 'http://localhost:3000/api/v1/workspaces/ws-1',
      method: 'PATCH',
    } as unknown as import('next/server').NextRequest;
  }

  it('returns 200 with updated workspace when auth and permission pass', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockUpdateSettings.mockResolvedValueOnce({
      id: 'ws-1', name: 'Updated', slug: 'ws-1', status: 'ACTIVE', settings: {}, updatedAt: '2026-01-01',
    } as never);

    // PATCH is pre-loaded in beforeAll
    const response = await PATCH(makeRequest({ name: 'Updated' }), { params: Promise.resolve({ id: 'ws-1' }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe('Updated');
  });

  it('returns 401 when user is not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    // PATCH is pre-loaded in beforeAll
    const response = await PATCH(makeRequest({ name: 'X' }), { params: Promise.resolve({ id: 'ws-1' }) });
    expect(response.status).toBe(401);
  });

  it('returns 403 when user lacks workspace.settings.manage permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    // PATCH is pre-loaded in beforeAll
    const response = await PATCH(makeRequest({ name: 'X' }), { params: Promise.resolve({ id: 'ws-1' }) });
    expect(response.status).toBe(403);
  });

  it('returns 400 when neither name nor settings provided', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    // PATCH is pre-loaded in beforeAll
    const response = await PATCH(makeRequest({}), { params: Promise.resolve({ id: 'ws-1' }) });
    expect(response.status).toBe(400);
  });

  it('returns 400 when name is not a string', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    // PATCH is pre-loaded in beforeAll
    const response = await PATCH(makeRequest({ name: 12345 }), { params: Promise.resolve({ id: 'ws-1' }) });
    expect(response.status).toBe(400);
  });

  it('returns 404 when workspace not found', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockUpdateSettings.mockRejectedValueOnce(new AppError('NOT_FOUND', 'Workspace not found.'));

    // PATCH is pre-loaded in beforeAll
    const response = await PATCH(makeRequest({ name: 'Test' }), { params: Promise.resolve({ id: 'ws-missing' }) });
    expect(response.status).toBe(404);
  });

  it('checks workspace.settings.manage permission for the correct workspaceId', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockUpdateSettings.mockResolvedValueOnce({
      id: 'ws-99', name: 'WS', slug: 'ws', status: 'ACTIVE', settings: {}, updatedAt: '2026-01-01',
    } as never);

    // PATCH is pre-loaded in beforeAll
    await PATCH(makeRequest({ name: 'Updated' }), { params: Promise.resolve({ id: 'ws-99' }) });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      'user-1', 'ws-99', 'workspace.settings.manage',
    );
  });
});
