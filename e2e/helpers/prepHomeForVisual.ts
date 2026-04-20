import type { Page } from '@playwright/test';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * `DeferredMount` aktywuje się dopiero przy zbliżeniu do viewportu — pełny zrzut bez
 * scrolla zostawia puste sloty (min-height bez dzieci). Przewijamy całą stronę krokami,
 * żeby IO zdążył zamontować sekcje przed `argosScreenshot(..., { fullPage: true })`.
 */
export async function prepHomeForFullPageVisual(page: Page): Promise<void> {
  await page.locator('main').first().waitFor({ state: 'visible' });

  const { scrollHeight, step } = await page.evaluate(() => {
    const el = document.documentElement;
    const body = document.body;
    const h = Math.max(
      el?.scrollHeight ?? 0,
      body?.scrollHeight ?? 0,
      el?.getBoundingClientRect().height ?? 0
    );
    const vh = window.innerHeight || 800;
    return { scrollHeight: h, step: Math.max(400, Math.floor(vh * 0.75)) };
  });

  if (scrollHeight <= 0) return;

  for (let y = 0; y <= scrollHeight; y += step) {
    await page.evaluate((top) => {
      window.scrollTo(0, top);
    }, y);
    await delay(220);
  }

  await page.evaluate(() => {
    window.scrollTo(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  });
  await delay(450);

  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(350);
}

/** CSS na czas zrzutu Argos — mniej flaki z GSAP / transition w połowie. */
export const argosPauseMotionCss = `
*, *::before, *::after {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
}
`.trim();
