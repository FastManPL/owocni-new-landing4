import Lenis from 'lenis';
import type gsap from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';

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

function runBoot(gen: number, G: typeof gsap, ST: typeof ScrollTriggerType): void {
  if (gen !== initGeneration) return;

  gsapRuntime = G;
  ScrollTriggerRuntime = ST;

  ST.config({
    ignoreMobileResize: true,
  });

  lenis = new Lenis({
    autoRaf: false,
    lerp: 0.1,
    duration: 1.2,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1,
    syncTouch: true,
    syncTouchLerp: 0.1,
  });

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

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }

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
