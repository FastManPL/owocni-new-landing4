import Lenis from 'lenis';
import type gsap from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';

import {
  getAnimationCostProfile,
  prefersNativeDocumentScroll,
  requestRuntimeTierDowngrade,
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

/** Po dynamic import('gsap') — zawsze gdy scroll bridge wstanie (Lenis lub native). */
let gsapRuntime: typeof gsap | null = null;
let ScrollTriggerRuntime: typeof ScrollTriggerType | null = null;

/** Unieważnia async init po destroy / kolejny cykl. */
let initGeneration = 0;
let initInFlight = false;

let lastResizeW = 0;
let lastResizeH = 0;

/** Lenis + GSAP zapięte — `requestRefresh` / `isReady` działają także w trybie native (bez Lenisa). */
let bridgeReady = false;

type NativeScrollWire = {
  handler: (...args: unknown[]) => void;
  bound: () => void;
};
const nativeScrollWires: NativeScrollWire[] = [];

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
let runtimePerfDowngraded = false;
let runtimeSlowFrames = 0;
let lastRuntimeTickMs = 0;

function observeRuntimePerfTick(
  G: typeof gsap,
  time: number,
  nativeDocumentScroll: boolean,
): void {
  const nowMs = time * 1000;
  if (lastRuntimeTickMs > 0 && !runtimePerfDowngraded) {
    const dtMs = nowMs - lastRuntimeTickMs;
    if (dtMs > 42) {
      runtimeSlowFrames++;
    } else if (runtimeSlowFrames > 0) {
      runtimeSlowFrames--;
    }
    if (runtimeSlowFrames >= 90) {
      runtimePerfDowngraded = true;
      requestRuntimeTierDowngrade(0);
      animationCostProfile = getAnimationCostProfile();
      applyGsapTickerCost(G, animationCostProfile, nativeDocumentScroll);
      requestRefresh('runtime-tier-downgrade');
    }
  }
  lastRuntimeTickMs = nowMs;
}

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

/**
 * Bez Lenisa można przywrócić pełniejszy tick GSAP — i tak nie płacimy za Lenis rAF.
 * Z Lenisem niższy FPS = mniejsze obciążenie przy tym samym smooth scroll.
 */
function applyGsapTickerCost(
  G: typeof gsap,
  profile: AnimationCostProfile,
  nativeDocumentScroll: boolean,
): void {
  if (profile === 'minimal') {
    // Global low-end fallback: keep responsiveness, but aggressively reduce CPU pressure.
    G.ticker.fps(nativeDocumentScroll ? 30 : 24);
  } else if (profile === 'reduced') {
    G.ticker.fps(nativeDocumentScroll ? 60 : 45);
  }
}

function wirePostStInfrastructure(gen: number, mode: 'lenis' | 'native'): void {
  if (gen !== initGeneration) return;

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
    if (mode !== 'lenis') return;
    if (document.hidden) {
      lenis?.stop();
    } else {
      lenis?.start();
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  pageHideHandler = () => {
    if (mode === 'lenis') lenis?.stop();
  };
  window.addEventListener('pagehide', pageHideHandler, { passive: true });

  pageShowHandler = () => {
    if (mode === 'lenis') lenis?.start();
    requestRefreshImmediate();
  };
  window.addEventListener('pageshow', pageShowHandler, { passive: true });

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
      if (ScrollTriggerRuntime && (ScrollTriggerRuntime as unknown as { isRefreshing?: boolean }).isRefreshing) return;
      requestRefresh('doc-height-changed');
    });
    heightObserver.observe(document.documentElement);
  }

  if (document.readyState === 'complete') {
    requestRefreshImmediate();
  } else {
    loadHandler = () => { requestRefreshImmediate(); };
    window.addEventListener('load', loadHandler, { once: true, passive: true });
  }

  bridgeReady = true;

  if (process.env.NODE_ENV === 'development') {
    (window as Window & { __scroll?: ScrollRuntime }).__scroll = scrollRuntime;
  }

  if (pendingRefresh) {
    const reason = pendingRefresh;
    pendingRefresh = null;
    requestRefresh(reason);
  }
}

function runBoot(gen: number, G: typeof gsap, ST: typeof ScrollTriggerType): void {
  if (gen !== initGeneration) return;

  gsapRuntime = G;
  ScrollTriggerRuntime = ST;

  animationCostProfile = getAnimationCostProfile();
  applyGsapTickerCost(G, animationCostProfile, false);

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
    observeRuntimePerfTick(G, time, false);
    lenis?.raf(time * 1000);
  };
  G.ticker.add(tickerCallback, false, true);

  lenis.on('scroll', ST.update);

  lastResizeW = window.innerWidth;
  lastResizeH = window.innerHeight;

  wirePostStInfrastructure(gen, 'lenis');
}

/** Natywny scroll okna — bez Lenisa i bez `scrollerProxy` (mniej pracy na głównym wątku na mobile). */
function runBootNative(gen: number, G: typeof gsap, ST: typeof ScrollTriggerType): void {
  if (gen !== initGeneration) return;

  gsapRuntime = G;
  ScrollTriggerRuntime = ST;

  animationCostProfile = getAnimationCostProfile();
  applyGsapTickerCost(G, animationCostProfile, true);

  ST.config({
    ignoreMobileResize: true,
  });

  lastResizeW = window.innerWidth;
  lastResizeH = window.innerHeight;

  wirePostStInfrastructure(gen, 'native');

  tickerCallback = (time: number) => {
    observeRuntimePerfTick(G, time, true);
  };
  G.ticker.add(tickerCallback, false, true);
}

function init(): void {
  if (typeof window === 'undefined' || bridgeReady || initInFlight) {
    return;
  }
  initInFlight = true;
  const gen = initGeneration;
  void Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
    .then(([{ default: G }, { ScrollTrigger: ST }]) => {
      G.registerPlugin(ST);
      if (prefersNativeDocumentScroll()) {
        runBootNative(gen, G, ST);
      } else {
        runBoot(gen, G, ST);
      }
    })
    .catch(() => {})
    .finally(() => {
      initInFlight = false;
    });
}

function destroy(): void {
  initGeneration++;

  if (!bridgeReady) {
    pendingRefresh = null;
    nativeScrollWires.splice(0, nativeScrollWires.length);
    if (process.env.NODE_ENV === 'development') {
      delete (window as Window & { __scroll?: ScrollRuntime }).__scroll;
    }
    return;
  }

  bridgeReady = false;

  for (const w of nativeScrollWires) {
    window.removeEventListener('scroll', w.bound);
  }
  nativeScrollWires.length = 0;

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
  runtimeSlowFrames = 0;
  lastRuntimeTickMs = 0;

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
  if (!ScrollTriggerRuntime || !bridgeReady) {
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
  if (!ScrollTriggerRuntime || !bridgeReady) return;
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
    const behavior: ScrollBehavior = options?.immediate ? 'auto' : 'smooth';
    if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior });
      return;
    }
    if (typeof target === 'string') {
      const el = document.querySelector(target);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior, block: 'start' });
      }
      return;
    }
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior, block: 'start' });
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
  if (event !== 'scroll') return;
  if (lenis) {
    lenis.on('scroll', handler as (e: unknown) => void);
    return;
  }
  if (!bridgeReady) return;
  const bound = () => {
    handler(null);
  };
  nativeScrollWires.push({ handler, bound });
  window.addEventListener('scroll', bound, { passive: true });
}

function off(event: string, handler: (...args: unknown[]) => void): void {
  if (event !== 'scroll') return;
  if (lenis) {
    lenis.off('scroll', handler as (e: unknown) => void);
    return;
  }
  const idx = nativeScrollWires.findIndex((w) => w.handler === handler);
  if (idx >= 0) {
    const wire = nativeScrollWires[idx];
    if (wire) {
      window.removeEventListener('scroll', wire.bound);
      nativeScrollWires.splice(idx, 1);
    }
  }
}

function getLenis(): Lenis | null {
  return lenis;
}

function isReady(): boolean {
  return bridgeReady;
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
