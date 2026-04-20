import type { Page } from '@playwright/test';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function scrollViaWheel(page: Page, direction: 1 | -1): Promise<void> {
  const vp = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.mouse.move(vp.width / 2, vp.height / 2);
  const steps = 140;
  const delta = 700 * direction;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, delta);
    await delay(40);
  }
}

/**
 * `DeferredMount` włącza się przy zbliżeniu do viewportu. Lenis nie przesuwa się przez
 * `window.scrollTo` — trzeba wołać `lenis.scrollTo` (mostek `__argosScrollTo` w buildzie z
 * `NEXT_PUBLIC_ARGOS_VISUAL=1`, ustawionym w workflow Argos). Bez mostka: fallback `wheel`.
 */
export async function prepHomeForFullPageVisual(page: Page): Promise<void> {
  await page.locator('main').first().waitFor({ state: 'visible' });
  await page.locator('html.lenis').first().waitFor({ state: 'attached', timeout: 25_000 });

  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: Math.max(
      document.documentElement?.scrollHeight ?? 0,
      document.body?.scrollHeight ?? 0
    ),
    innerHeight: window.innerHeight || 720,
  }));

  /** Piny ST potrafią rozdmuchać `scrollHeight` — ograniczamy krok podglądu wizualnego. */
  const maxY = Math.min(48_000, Math.max(0, scrollHeight - innerHeight + 400));
  const step = Math.max(350, Math.floor(innerHeight * 0.65));

  const hasLenisBridge = await page.evaluate(
    () => typeof (window as unknown as { __argosScrollTo?: unknown }).__argosScrollTo === 'function'
  );

  if (hasLenisBridge) {
    let y = 0;
    let n = 0;
    const maxSteps = 90;
    while (y <= maxY && n < maxSteps) {
      await page.evaluate((top) => {
        (window as unknown as { __argosScrollTo: (n: number) => void }).__argosScrollTo(top);
      }, y);
      await delay(260);
      y += step;
      n++;
    }
    await page.evaluate((top) => {
      (window as unknown as { __argosScrollTo: (n: number) => void }).__argosScrollTo(top);
    }, maxY);
    await delay(500);
    await page.evaluate(() => {
      (window as unknown as { __argosScrollTo: (n: number) => void }).__argosScrollTo(0);
    });
    await delay(400);
    return;
  }

  await scrollViaWheel(page, 1);
  await delay(500);
  await scrollViaWheel(page, -1);
  await delay(400);
}

/** CSS na czas zrzutu Argos — mniej flaki z CSS transition w połowie. */
export const argosPauseMotionCss = `
*, *::before, *::after {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
}
`.trim();
