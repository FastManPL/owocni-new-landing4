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

  const getMetrics = () =>
    page.evaluate(() => {
      const scrollHeight = Math.max(
        document.documentElement?.scrollHeight ?? 0,
        document.body?.scrollHeight ?? 0
      );
      const innerHeight = window.innerHeight || 720;
      return { scrollHeight, innerHeight };
    });

  const hasLenisBridge = await page.evaluate(
    () => typeof (window as unknown as { __argosScrollTo?: unknown }).__argosScrollTo === 'function'
  );

  if (hasLenisBridge) {
    const scrollTo = (top: number) =>
      page.evaluate((t) => {
        (window as unknown as { __argosScrollTo: (n: number) => void }).__argosScrollTo(t);
      }, top);

    /**
     * 1) Kilka razy „na koniec dokumentu” — po `DeferredMount` `scrollHeight` rośnie; jeden przejazd
     *    obcinał stronę (np. przy case studies). 2) Krokami od góry — IO + sentinel przy długich pinach.
     */
    let lastH = 0;
    for (let round = 0; round < 6; round++) {
      const { scrollHeight, innerHeight } = await getMetrics();
      if (scrollHeight <= innerHeight) break;
      const target = Math.min(2_000_000, Math.max(0, scrollHeight - innerHeight + 600));
      await scrollTo(target);
      await delay(round < 2 ? 700 : 550);
      if (scrollHeight === lastH && round > 0) break;
      lastH = scrollHeight;
    }

    const { scrollHeight: h2, innerHeight: ih } = await getMetrics();
    const maxY = Math.min(2_000_000, Math.max(0, h2 - ih + 600));
    const step = Math.max(400, Math.floor(ih * 0.7));
    let y = 0;
    let n = 0;
    /** Po zejściach „na dół” wystarczy uzupełnić IO; twardy limit czasu testu (~120 s). */
    const maxSteps = Math.min(200, Math.ceil(maxY / step) + 25);
    while (y <= maxY && n < maxSteps) {
      await scrollTo(y);
      await delay(200);
      y += step;
      n++;
    }
    await scrollTo(maxY);
    await delay(600);
    await scrollTo(0);
    await delay(450);
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
