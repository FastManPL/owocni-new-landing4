import { test } from '@playwright/test';
import { argosScreenshot } from '@argos-ci/playwright';
import {
  argosPauseMotionCss,
  captureHomeViewportStripes,
  prepHomeForFullPageVisual,
} from './helpers/prepHomeForVisual';

test.describe('visual — strona główna', () => {
  test('hero + pasy viewportu (bez fullPage — limit Chromium ~16k px)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await prepHomeForFullPageVisual(page);

    await argosScreenshot(page, 'home-hero', {
      fullPage: false,
      argosCSS: argosPauseMotionCss,
    });

    await captureHomeViewportStripes(page);
  });
});
