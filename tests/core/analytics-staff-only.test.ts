import { describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`); });
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('../../server/identity/request-user', () => ({ requireCurrentUser: vi.fn(async () => 'user-1') }));
vi.mock('../../server/identity/platform-admin', () => ({ isPlatformAdmin: vi.fn(async () => false) }));
const query = vi.fn();
vi.mock('../../server/core/db', () => ({ query, withWorkspaceTransaction: vi.fn() }));
vi.mock('../../components/AppShell', () => ({ AppShell: () => null }));

describe('/analytics', () => {
  it('sends customers to the dashboard: provider cost and margin are staff-only', async () => {
    const { default: Analytics } = await import('../../app/analytics/page');
    await expect(Analytics()).rejects.toThrow('REDIRECT /dashboard');
    expect(query).not.toHaveBeenCalled();
  });
});
