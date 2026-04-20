import { test } from '@playwright/test';
import { argosScreenshot } from '@argos-ci/playwright';

test.describe('visual — strona główna', () => {
  test('above the fold', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('main').first().waitFor({ state: 'visible' });
    await argosScreenshot(page, 'home-hero', { fullPage: false });
  });

  test('full page (scroll)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('main').first().waitFor({ state: 'visible' });
    await argosScreenshot(page, 'home-full', { fullPage: true });
  });
});
