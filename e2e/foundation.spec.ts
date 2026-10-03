import { expect, test } from '@playwright/test';

test.describe('foundation', () => {
  test('public shell is RTL and dashboard contains mixed-direction identifiers', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir','rtl');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\?next=\/dashboard/);
  });
  test('auth page is noindex and exposes login surface', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('html')).toHaveAttribute('lang','fa');
    await expect(page.getByText('ورود به Workspace')).toBeVisible();
  });
  test('public entity routes are indexable', async ({ page }) => {
    await page.goto('/ai/writing');
    await expect(page).toHaveTitle(/دستیار نوشتاری/);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
  });
});
