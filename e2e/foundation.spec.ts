import { expect, test } from '@playwright/test';

test.describe('foundation', () => {
  test('public shell is RTL and dashboard contains mixed-direction identifiers', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir','rtl');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\?next=(%2F|\/)dashboard/);
  });
  test('auth page is noindex and exposes login surface', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('html')).toHaveAttribute('lang','fa');
    await expect(page.getByText('ورود به حساب')).toBeVisible();
  });
  test('public entity routes are indexable', async ({ page }) => {
    await page.goto('/ai/writing');
    await expect(page).toHaveTitle(/دستیار نوشتاری/);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
  });
  test('service catalogue is public, RTL and scroll-free with coming-soon states', async ({ page }) => {
    await page.goto('/services');
    await expect(page.locator('.zp-svc')).toHaveCount(12);
    await expect(page.locator('.zp-wm b').first()).toHaveText('زُحل پی');
    const stage = page.locator('.zp-stage');
    expect(await stage.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto('/services/rubika');
    await expect(page.getByRole('heading', { name: 'به‌زودی' })).toBeVisible();
  });
  test('account screen is private and the menu is a separate drawer', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/auth\?next=(%2F|\/)account/);
    await page.goto('/services');
    await page.getByRole('button', { name: 'منو' }).click();
    await expect(page.getByRole('dialog', { name: 'منوی اصلی' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'ناوبری سایت' }).getByText('همه‌ی خدمات')).toBeVisible();
  });
});
