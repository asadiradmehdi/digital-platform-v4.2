import { describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() => vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`); }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('../../server/identity/request-user', () => ({ requireCurrentUser: vi.fn().mockRejectedValue(new Error('no session')) }));
vi.mock('../../server/identity/platform-admin', () => ({ isPlatformAdmin: vi.fn() }));
vi.mock('../../app/admin/(console)/AdminNav', () => ({ AdminNav: () => null }));
vi.mock('../../app/admin/(console)/admin.css', () => ({}));

import { safeNextPath } from '../../server/identity/sign-in';

describe('admin sign-in returns to the console', () => {
  it('sends a signed-out visitor to /auth with the console as the return path', async () => {
    const { default: Layout } = await import('../../app/admin/(console)/layout');
    await expect(Layout({ children: null })).rejects.toThrow('REDIRECT:/auth?next=%2Fadmin%2Fdashboard');
  });

  it('accepts that return path (regression: the admin app landed on the customer dashboard after login)', () => {
    expect(safeNextPath('/admin/dashboard')).toBe('/admin/dashboard');
  });
});
