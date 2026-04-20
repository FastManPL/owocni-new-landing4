import { argosScreenshot } from '@argos-ci/playwright';
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

async function readMaxScrollHeight(page: Page): Promise<number> {
  return page.evaluate(() =>
    Math.max(
      document.documentElement?.scrollHeight ?? 0,
      document.body?.scrollHeight ?? 0,
      document.scrollingElement?.scrollHeight ?? 0
    )
  );
}

/**
 * Po `prep` wysokość dokumentu może być jeszcze niepełna (kolejne `DeferredMount`, obrazy, ST).
 * Bez tego `captureHomeViewportStripes` liczy za krótki `maxY` — ostatni pas kończy się w środku „O nas”.
 */
async function expandScrollHeightBeforeStripes(
  page: Page,
  scrollTo: (top: number) => Promise<void>
): Promise<void> {
  const vp = page.viewportSize() ?? { width: 1280, height: 720 };
  const vh = vp.height;
  let prevH = 0;
  let stable = 0;
  for (let round = 0; round < 14; round++) {
    const h = await readMaxScrollHeight(page);
    const target = Math.min(2_000_000, Math.max(0, h - vh + 900));
    await scrollTo(target);
    await delay(round < 4 ? 950 : 750);
    if (h === prevH && round > 0) {
      stable++;
      if (stable >= 2) break;
    } else {
      stable = 0;
    }
    prevH = h;
  }
  await scrollTo(0);
  await delay(400);
}

/**
 * Chromium ~16k px: jeden `fullPage: true` skleja obraz wyższy, ale **poniżej ~16384 px treść bywa nierenderowana**
 * (biały pas). Zamiast tego: wiele zrzutów viewportu przy różnym scrollu (`home-vp-001` …).
 * `home-hero` zostaje osobno (scroll 0).
 */
export async function captureHomeViewportStripes(page: Page): Promise<void> {
  const hasBridge = await page.evaluate(
    () => typeof (window as unknown as { __argosScrollTo?: unknown }).__argosScrollTo === 'function'
  );

  const scrollTo = async (top: number) => {
    if (hasBridge) {
      await page.evaluate((t) => {
        (window as unknown as { __argosScrollTo: (n: number) => void }).__argosScrollTo(t);
      }, top);
    } else {
      await page.evaluate((t) => {
        window.scrollTo(0, t);
      }, top);
    }
  };

  await expandScrollHeightBeforeStripes(page, scrollTo);

  const vp = page.viewportSize() ?? { width: 1280, height: 720 };
  const vh = vp.height;
  const step = Math.max(400, Math.floor(vh * 0.88));

  const totalScroll = await readMaxScrollHeight(page);
  const maxY = Math.max(0, totalScroll - vh);

  const positions: number[] = [];
  if (maxY > 0) {
    for (let y = step; y < maxY; y += step) {
      positions.push(y);
    }
    if (positions.length === 0 || positions[positions.length - 1] !== maxY) {
      positions.push(maxY);
    }
  }

  let idx = 1;
  const maxStripes = 220;
  for (const top of positions) {
    if (idx > maxStripes) break;
    await scrollTo(top);
    await delay(450);
    await argosScreenshot(page, `home-vp-${String(idx).padStart(3, '0')}`, {
      fullPage: false,
      argosCSS: argosPauseMotionCss,
    });
    idx++;
  }
}
