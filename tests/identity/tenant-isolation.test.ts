/**
 * Tenant isolation contract tests.
 * Verifies that every workspace-scoped API route enforces membership checks
 * (requireWorkspacePermission or RLS-backed withWorkspaceTransaction) before
 * returning or mutating workspace data.
 *
 * These are static contract checks that read the route source files so they
 * run without a live database.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8');
}

const WORKSPACE_SCOPED_ROUTES: Array<{ label: string; path: string }> = [
  { label: 'GET /api/v1/analytics', path: 'app/api/v1/analytics/route.ts' },
  { label: 'GET /api/v1/transactions', path: 'app/api/v1/transactions/route.ts' },
  { label: 'GET /api/v1/wallet', path: 'app/api/v1/wallet/route.ts' },
  { label: 'GET /api/v1/wallet/balance', path: 'app/api/v1/wallet/balance/route.ts' },
  { label: 'GET /api/v1/orders', path: 'app/api/v1/orders/route.ts' },
  { label: 'POST /api/v1/orders', path: 'app/api/v1/orders/route.ts' },
  { label: 'POST /api/v1/checkout', path: 'app/api/v1/checkout/route.ts' },
  { label: 'GET /api/v1/subscriptions', path: 'app/api/v1/subscriptions/route.ts' },
  { label: 'GET /api/v1/b2b/api-keys', path: 'app/api/v1/b2b/api-keys/route.ts' },
  { label: 'GET /api/v1/b2b/usage', path: 'app/api/v1/b2b/usage/route.ts' },
  { label: 'GET /api/v1/automation/workflows', path: 'app/api/v1/automation/workflows/route.ts' },
  { label: 'PATCH /api/v1/workspaces/[id]', path: 'app/api/v1/workspaces/[id]/route.ts' },
];

describe('Tenant isolation: workspace-scoped routes', () => {
  for (const { label, path } of WORKSPACE_SCOPED_ROUTES) {
    it(`${label} enforces workspace membership before returning data`, () => {
      const src = read(path);

      // Route must authenticate the user first
      expect(src, `${label} must call requireRequestUser`).toContain('requireRequestUser');

      // Route must enforce workspace membership via permission check or RLS transaction
      const hasPermissionCheck = src.includes('requireWorkspacePermission');
      const hasRlsTransaction = src.includes('withWorkspaceTransaction');

      expect(
        hasPermissionCheck || hasRlsTransaction,
        `${label} must use requireWorkspacePermission or withWorkspaceTransaction`,
      ).toBe(true);
    });
  }
});

describe('Tenant isolation: workspaces list uses user-scoped join', () => {
  it('GET /api/v1/workspaces only returns workspaces where the authenticated user is a member', () => {
    const src = read('app/api/v1/workspaces/route.ts');
    // The query must join workspace_members and filter by user_id
    expect(src).toContain('workspace_members');
    expect(src).toContain('user_id=$1');
  });
});

describe('Tenant isolation: notifications are user-scoped', () => {
  it('GET /api/v1/notifications filters by user_id (not workspaceId)', () => {
    const src = read('app/api/v1/notifications/route.ts');
    expect(src).toContain('requireRequestUser');
    // Notifications belong to users, not workspaces — must filter by user_id
    expect(src).toContain('user_id=$1');
  });
});

describe('Tenant isolation: checkout session access validates workspace membership', () => {
  it('GET /api/v1/checkout/[id] looks up workspace from session and validates membership', () => {
    const src = read('app/api/v1/checkout/[id]/route.ts');
    expect(src).toContain('requireRequestUser');
    expect(src).toContain('requireWorkspacePermission');
    // Permission is checked against the workspace_id from the session row — not a client param
    expect(src).toContain('workspace_id');
  });
});
