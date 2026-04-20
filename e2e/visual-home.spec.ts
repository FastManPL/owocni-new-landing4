import { test } from '@playwright/test';
import { argosScreenshot } from '@argos-ci/playwright';
import { argosPauseMotionCss, prepHomeForFullPageVisual } from './helpers/prepHomeForVisual';

test.describe('visual — strona główna', () => {
  test('hero + pełna strona po aktywacji DeferredMount', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await prepHomeForFullPageVisual(page);

    await argosScreenshot(page, 'home-hero', {
      fullPage: false,
      argosCSS: argosPauseMotionCss,
    });

    await argosScreenshot(page, 'home-full', {
      fullPage: true,
      argosCSS: argosPauseMotionCss,
    });
  });
});
