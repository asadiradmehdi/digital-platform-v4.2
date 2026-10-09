import { describe, expect, it, vi } from 'vitest';

const redirect = vi.fn(() => { throw new Error('NEXT_REDIRECT'); });
vi.mock('next/navigation', () => ({ redirect }));

describe('/security', () => {
  it('no longer renders internal security architecture; sends users to their own settings', async () => {
    const { default: Page } = await import('../../app/security/page');
    expect(() => Page()).toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/settings/security');
  });
});
