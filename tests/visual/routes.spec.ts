import { test, expect } from '@playwright/test';

const routes = ['/', '/services', '/ai', '/social', '/automation', '/pricing'];
for (const route of routes) {
  test(`visual fixture: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('body')).toHaveScreenshot(`${route === '/' ? 'home' : route.slice(1)}.png`);
  });
}
