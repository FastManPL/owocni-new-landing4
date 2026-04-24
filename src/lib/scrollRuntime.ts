import Lenis from 'lenis';
import type gsap from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';

import {
  getAnimationCostProfile,
  type AnimationCostProfile,
} from '@/lib/autoTier';

// === TYPES ===
interface ScrollToOptions {
  offset?: number;
  immediate?: boolean;
  duration?: number;
  easing?: (t: number) => number;
  onComplete?: () => void;
  lock?: boolean;
  force?: boolean;
}

interface ScrollRuntime {
  init: () => void;
  destroy: () => void;
  getScroll: () => number;
  getRawScroll: () => number;
  requestRefresh: (reason?: string) => void;
  requestRefreshImmediate: () => void;
  scrollTo: (
    target: number | string | HTMLElement,
    options?: ScrollToOptions
  ) => void;
  start: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
  getLenis: () => Lenis | null;
  isReady: () => boolean;
}

// === STATE ===
let lenis: Lenis | null = null;
let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
let rafId: number | null = null;
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

let pendingRefresh: string | null = null;

let tickerCallback: ((time: number) => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let resizeHandler: (() => void) | null = null;
let pageShowHandler: ((e: PageTransitionEvent) => void) | null = null;
let pageHideHandler: (() => void) | null = null;
let loadHandler: (() => void) | null = null;
let heightObserver: ResizeObserver | null = null;
let lastDocHeight = 0;
let heightObserverFirstFire = true;

/** Po dynamic import('gsap') — tylko gdy lenis aktywny. */
let gsapRuntime: typeof gsap | null = null;
let ScrollTriggerRuntime: typeof ScrollTriggerType | null = null;

/** Unieważnia async init po destroy / kolejny cykl. */
let initGeneration = 0;
let initInFlight = false;

let lastResizeW = 0;
let lastResizeH = 0;

const REFRESH_DEBOUNCE_MS = 120;
const RESIZE_DEBOUNCE_MS = 250;
const MOBILE_TOOLBAR_RESIZE_THRESHOLD_PX = 150;
/** Ignorujemy mikro-zmiany wysokości (<30 px) — próg chroni przed pętlą: pin-spacer tworzony
 *  przez ScrollTrigger.refresh() zmienia scrollHeight o kilkanaście px, co bez progu wywołałoby
 *  kolejny requestRefresh po 120 ms → redundant refresh loop. 30 px pokrywa typowe pin-spacer
 *  resolution bez gubienia prawdziwych expansionów z ssr:false chunków (placeholder 100vh → 300vh).  */
const DOC_HEIGHT_CHANGE_THRESHOLD_PX = 30;

/** Lenis + GSAP ticker — dopasowanie do profilu kosztu (słabsze urządzenia). */
let animationCostProfile: AnimationCostProfile = 'full';

function lenisOptionsFor(profile: AnimationCostProfile): ConstructorParameters<typeof Lenis>[0] {
  switch (profile) {
    case 'minimal':
      return {
        autoRaf: false,
        lerp: 0.22,
        duration: 1.0,
        smoothWheel: false,
        wheelMultiplier: 1,
        touchMultiplier: 0.92,
        syncTouch: true,
        syncTouchLerp: 0.14,
      };
    case 'reduced':
      return {
        autoRaf: false,
        lerp: 0.16,
        duration: 1.05,
        smoothWheel: false,
        wheelMultiplier: 1,
        touchMultiplier: 1,
        syncTouch: true,
        syncTouchLerp: 0.12,
      };
    default:
      return {
        autoRaf: false,
        lerp: 0.1,
        duration: 1.2,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1,
        /** Mobile: Lenis przejmuje touch synchronicznie — bez tego + overflow na html/body scroll bywa „martwy”. */
        syncTouch: true,
        syncTouchLerp: 0.1,
      };
  }
}

function applyGsapTickerCost(G: typeof gsap, profile: AnimationCostProfile): void {
  if (profile === 'minimal') {
    G.ticker.fps(30);
  } else if (profile === 'reduced') {
    G.ticker.fps(45);
  }
}

function runBoot(gen: number, G: typeof gsap, ST: typeof ScrollTriggerType): void {
  if (gen !== initGeneration) return;

  gsapRuntime = G;
  ScrollTriggerRuntime = ST;

  animationCostProfile = getAnimationCostProfile();
  applyGsapTickerCost(G, animationCostProfile);

  ST.config({
    ignoreMobileResize: true,
  });

  lenis = new Lenis(lenisOptionsFor(animationCostProfile));

  ST.scrollerProxy(document.body, {
    scrollTop(value?: number): number {
      if (value !== undefined && lenis) {
        lenis.scrollTo(value, { immediate: true });
      }
      return lenis ? lenis.scroll : 0;
    },
    getBoundingClientRect() {
      return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    },
    fixedMarkers: true,
  });

  tickerCallback = (time: number) => {
    lenis?.raf(time * 1000);
  };
  G.ticker.add(tickerCallback, false, true);

  lenis.on('scroll', ST.update);

  lastResizeW = window.innerWidth;
  lastResizeH = window.innerHeight;

  resizeHandler = () => {
    clearTimeout(resizeTimeout ?? undefined);
    resizeTimeout = setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isFirst = lastResizeW === 0 && lastResizeH === 0;
      if (!isFirst) {
        const heightOnly = w === lastResizeW;
        const smallHeightChange = Math.abs(h - lastResizeH) <= MOBILE_TOOLBAR_RESIZE_THRESHOLD_PX;
        if (heightOnly && smallHeightChange) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[scrollRuntime] resize: skip (mobile toolbar?)');
          }
          return;
        }
      }
      lastResizeW = w;
      lastResizeH = h;
      requestRefresh('resize');
    }, RESIZE_DEBOUNCE_MS);
  };
  window.addEventListener('resize', resizeHandler, { passive: true });

  visibilityHandler = () => {
    if (document.hidden) {
      lenis?.stop();
    } else {
      lenis?.start();
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  // Powrót z historii / bfcache (mobile Safari): bez refresh pinów i proxy scroll bywa rozjechany → OOM/reload.
  pageHideHandler = () => {
    lenis?.stop();
  };
  window.addEventListener('pagehide', pageHideHandler, { passive: true });

  pageShowHandler = () => {
    lenis?.start();
    requestRefreshImmediate();
  };
  window.addEventListener('pageshow', pageShowHandler, { passive: true });

  // DOC-HEIGHT-OBSERVER-01: catch-all dla rozrostu document height po hydracji chunków ssr:false.
  // Problem (2026-04-23): sections ssr:false z placeholder 100vh (Kinetic, Blok45) rozrastały się
  // do ~300vh po mount'cie, a CaseStudies/Fakty ST były tworzone z pozycjami sprzed rozrostu
  // (i broker requestRefresh z 120 ms debounce czasem nie dogonił przed scrollem usera).
  // ResizeObserver łapie KAŻDĄ zmianę scrollHeight > 30 px i wymusza refresh przez brokera
  // (debounce 120 ms + 2 rAF → safe refresh(true)). Próg 30 px chroni przed pętlą od pin-spacerów.
  if (typeof ResizeObserver !== 'undefined') {
    lastDocHeight = document.documentElement.scrollHeight;
    heightObserverFirstFire = true;
    heightObserver = new ResizeObserver(() => {
      if (heightObserverFirstFire) {
        heightObserverFirstFire = false;
        return;
      }
      const h = document.documentElement.scrollHeight;
      const delta = Math.abs(h - lastDocHeight);
      if (delta < DOC_HEIGHT_CHANGE_THRESHOLD_PX) return;
      lastDocHeight = h;
      // `ScrollTrigger.isRefreshing` true oznacza że sami właśnie wywołaliśmy refresh (pin-spacer
      // tworzony w trakcie) — nie kolejkujemy kolejnego, broker poradzi sobie po zakończeniu
      // obecnego cyklu przez `st-refresh` flow.
      if (ScrollTriggerRuntime && (ScrollTriggerRuntime as unknown as { isRefreshing?: boolean }).isRefreshing) return;
      requestRefresh('doc-height-changed');
    });
    heightObserver.observe(document.documentElement);
  }

  // LOAD-SETTLE-01: `pageshow` fires early (przed load images). `load` fires gdy wszystko —
  // chunki JS, obrazy, fonty — w pełni pobrane. Dodatkowy safe refresh po load eliminuje race
  // gdy użytkownik ma scroll-restoration w trakcie fazy image-loading (height rośnie po load).
  if (document.readyState === 'complete') {
    requestRefreshImmediate();
  } else {
    loadHandler = () => { requestRefreshImmediate(); };
    window.addEventListener('load', loadHandler, { once: true, passive: true });
  }

  if (process.env.NODE_ENV === 'development') {
    (window as Window & { __scroll?: ScrollRuntime }).__scroll = scrollRuntime;
  }

  if (pendingRefresh) {
    const reason = pendingRefresh;
    pendingRefresh = null;
    requestRefresh(reason);
  }
}

function init(): void {
  if (typeof window === 'undefined' || lenis || initInFlight) {
    return;
  }
  initInFlight = true;
  const gen = initGeneration;
  void Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
    .then(([{ default: G }, { ScrollTrigger: ST }]) => {
      G.registerPlugin(ST);
      runBoot(gen, G, ST);
    })
    .catch(() => {})
    .finally(() => {
      initInFlight = false;
    });
}

function destroy(): void {
  initGeneration++;

  if (!lenis) {
    pendingRefresh = null;
    if (process.env.NODE_ENV === 'development') {
      delete (window as Window & { __scroll?: ScrollRuntime }).__scroll;
    }
    return;
  }

  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
    resizeTimeout = null;
  }

  if (tickerCallback && gsapRuntime) {
    gsapRuntime.ticker.remove(tickerCallback);
  }
  tickerCallback = null;

  if (gsapRuntime) {
    gsapRuntime.ticker.fps(60);
  }
  animationCostProfile = 'full';

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }

  if (pageHideHandler) {
    window.removeEventListener('pagehide', pageHideHandler);
    pageHideHandler = null;
  }
  if (pageShowHandler) {
    window.removeEventListener('pageshow', pageShowHandler);
    pageShowHandler = null;
  }

  if (loadHandler) {
    window.removeEventListener('load', loadHandler);
    loadHandler = null;
  }

  if (heightObserver) {
    heightObserver.disconnect();
    heightObserver = null;
  }
  lastDocHeight = 0;
  heightObserverFirstFire = true;

  const ST = ScrollTriggerRuntime;
  if (lenis && ST) {
    lenis.off('scroll', ST.update);
  }
  lenis?.destroy();
  lenis = null;

  gsapRuntime = null;
  ScrollTriggerRuntime = null;
  pendingRefresh = null;

  if (process.env.NODE_ENV === 'development') {
    delete (window as Window & { __scroll?: ScrollRuntime }).__scroll;
  }
}

function getScroll(): number {
  if (!lenis) {
    return typeof window !== 'undefined' ? window.scrollY : 0;
  }
  return lenis.scroll;
}

function getRawScroll(): number {
  if (!lenis) {
    return typeof window !== 'undefined' ? window.scrollY : 0;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lenisAny = lenis as any;
  return lenisAny.targetScroll ?? lenisAny.scroll ?? window.scrollY;
}

function requestRefresh(reason?: string): void {
  if (!lenis) {
    if (reason) {
      pendingRefresh = reason;
    }
    return;
  }

  if (process.env.NODE_ENV === 'development' && reason) {
    console.debug(`[scrollRuntime] requestRefresh: ${reason}`);
  }

  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }

  refreshTimeout = setTimeout(() => {
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        ScrollTriggerRuntime?.refresh(true);

        if (process.env.NODE_ENV === 'development' && reason) {
          console.debug(`[scrollRuntime] refresh executed: ${reason}`);
        }
      });
    });
  }, REFRESH_DEBOUNCE_MS);
}

function requestRefreshImmediate(): void {
  if (!lenis) return;
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
  rafId = requestAnimationFrame(() => {
    rafId = requestAnimationFrame(() => {
      ScrollTriggerRuntime?.refresh(true);
      if (process.env.NODE_ENV === 'development') {
        console.debug('[scrollRuntime] refresh executed: immediate');
      }
    });
  });
}

function scrollTo(
  target: number | string | HTMLElement,
  options?: ScrollToOptions
): void {
  if (!lenis) {
    if (typeof target === 'number') {
      window.scrollTo({
        top: target,
        behavior: options?.immediate ? 'auto' : 'smooth',
      });
    }
    return;
  }

  lenis.scrollTo(target, {
    offset: options?.offset ?? 0,
    immediate: options?.immediate ?? false,
    ...(options?.duration != null && { duration: options.duration }),
    ...(options?.easing != null && { easing: options.easing }),
    ...(options?.onComplete != null && { onComplete: options.onComplete }),
    ...(options?.lock != null && { lock: options.lock }),
    ...(options?.force != null && { force: options.force }),
  });
}

function start(): void {
  lenis?.start();
}

function on(event: string, handler: (...args: unknown[]) => void): void {
  lenis?.on(event as 'scroll', handler as (e: unknown) => void);
}

function off(event: string, handler: (...args: unknown[]) => void): void {
  lenis?.off(event as 'scroll', handler as (e: unknown) => void);
}

function getLenis(): Lenis | null {
  return lenis;
}

function isReady(): boolean {
  return lenis !== null;
}

export const scrollRuntime: ScrollRuntime = {
  init,
  destroy,
  getScroll,
  getRawScroll,
  requestRefresh,
  requestRefreshImmediate,
  scrollTo,
  start,
  on,
  off,
  getLenis,
  isReady,
};

export default scrollRuntime;
