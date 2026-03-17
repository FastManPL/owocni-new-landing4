import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// === TYPES ===
interface ScrollToOptions {
  offset?: number;
  immediate?: boolean;
  duration?: number;
  easing?: (t: number) => number;
  onComplete?: () => void;
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

// Pending refresh queue — dla requestRefresh() przed init()
let pendingRefresh: string | null = null;

// Event handlers (dla cleanup)
let tickerCallback: ((time: number) => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let resizeHandler: (() => void) | null = null;

// Ostatnie wymiary do wykrycia „tylko toolbar” resize (height-only, mała delta)
let lastResizeW = 0;
let lastResizeH = 0;

// === CONSTANTS ===
const REFRESH_DEBOUNCE_MS = 120;
const RESIZE_DEBOUNCE_MS = 250;
// Wysokość zmiany viewportu (px) — poniżej uznajemy za „mobile toolbar” (chowanie paska adresu).
// Refresh przy takim resize psuł pozycje ST w sekcji fakty przy scrolle do góry (book-stats).
const MOBILE_TOOLBAR_RESIZE_THRESHOLD_PX = 150;

// === INIT ===
function init(): void {
  if (typeof window === 'undefined' || lenis) {
    return;
  }

  // ScrollTrigger config (Konstytucja C5)
  ScrollTrigger.config({
    ignoreMobileResize: true,
  });

  // Lenis init (Konstytucja C3)
  lenis = new Lenis({
    autoRaf: false,
    lerp: 0.1,
    duration: 1.2,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1,
  });

  // === SCROLLER PROXY (Lenis + ScrollTrigger) ===
  // ScrollTrigger domyślnie czyta window.scrollY; Lenis używa własnej wartości .scroll.
  // Bez proxy ST widzi złą pozycję → animacje scrub (np. sekcja fakty) są przesunięte/na końcu.
  // Źródło: GSAP + Lenis integration (scrollerProxy).
  ScrollTrigger.scrollerProxy(document.body, {
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

  // === GSAP TICKER (Konstytucja C3) ===
  // Sygnatura: add(callback, once?, prioritize?)
  // false = nie jednorazowo, true = priorytet Lenisa przed ST/sekcjami
  tickerCallback = (time: number) => {
    lenis?.raf(time * 1000);
  };
  gsap.ticker.add(tickerCallback, false, true);

  // ScrollTrigger update on scroll
  lenis.on('scroll', ScrollTrigger.update);

  lastResizeW = window.innerWidth;
  lastResizeH = window.innerHeight;

  // === RESIZE HANDLER (Desktop) ===
  // ignoreMobileResize w ST nie blokuje naszego listenera — resize i tak się odpala.
  // Przy „mobile toolbar” (tylko height, mała delta) pomijamy refresh — inaczej
  // przy scrolle do góry (np. do book-stats) pozycje ST w sekcji fakty się rozjeżdżają.
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

  // === VISIBILITY CHANGE (Konstytucja C12) ===
  // stop/start bez automatycznego refresh
  visibilityHandler = () => {
    if (document.hidden) {
      lenis?.stop();
    } else {
      lenis?.start();
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  // === DEV DEBUG ===
  if (process.env.NODE_ENV === 'development') {
    (window as Window & { __scroll?: ScrollRuntime }).__scroll = scrollRuntime;
  }

  // === FLUSH PENDING REFRESH ===
  // Jeśli ktoś wołał requestRefresh() przed init()
  if (pendingRefresh) {
    const reason = pendingRefresh;
    pendingRefresh = null;
    requestRefresh(reason);
  }
}

// === DESTROY ===
function destroy(): void {
  if (!lenis) {
    return;
  }

  // Clear timeouts
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

  // Remove ticker
  if (tickerCallback) {
    gsap.ticker.remove(tickerCallback);
    tickerCallback = null;
  }

  // Remove event listeners (orientation in SmoothScrollProvider)
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }

  // Destroy Lenis (scrollerProxy pozostaje — przy następnym init() zostanie nadpisany)
  lenis.off('scroll', ScrollTrigger.update);
  lenis.destroy();
  lenis = null;

  // Clear pending
  pendingRefresh = null;

  // Clear DEV debug
  if (process.env.NODE_ENV === 'development') {
    delete (window as Window & { __scroll?: ScrollRuntime }).__scroll;
  }
}

// === GET SCROLL (interpolowana pozycja) ===
function getScroll(): number {
  if (!lenis) {
    return typeof window !== 'undefined' ? window.scrollY : 0;
  }
  return lenis.scroll;
}

// === GET RAW SCROLL (surowy target — dla velocity) ===
function getRawScroll(): number {
  if (!lenis) {
    return typeof window !== 'undefined' ? window.scrollY : 0;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lenisAny = lenis as any;
  return lenisAny.targetScroll ?? lenisAny.scroll ?? window.scrollY;
}

// === REQUEST REFRESH (Konstytucja C6) ===
// Debounced, double-rAF, safe refresh
function requestRefresh(reason?: string): void {
  // Pending queue: jeśli runtime nie gotowy, zapisz i wykonaj po init
  if (!lenis) {
    if (reason) {
      pendingRefresh = reason;
    }
    return;
  }

  if (process.env.NODE_ENV === 'development' && reason) {
    console.debug(`[scrollRuntime] requestRefresh: ${reason}`);
  }

  // Debounce
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }

  refreshTimeout = setTimeout(() => {
    // Double rAF dla stabilności layoutu
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        // Safe refresh (Konstytucja C6)
        ScrollTrigger.refresh(true);

        if (process.env.NODE_ENV === 'development' && reason) {
          console.debug(`[scrollRuntime] refresh executed: ${reason}`);
        }
      });
    });
  }, REFRESH_DEBOUNCE_MS);
}

// === REQUEST REFRESH IMMEDIATE (orientationchange — bez debounce) ===
function requestRefreshImmediate(): void {
  if (!lenis) return;
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
  rafId = requestAnimationFrame(() => {
    rafId = requestAnimationFrame(() => {
      ScrollTrigger.refresh(true);
      if (process.env.NODE_ENV === 'development') {
        console.debug('[scrollRuntime] refresh executed: immediate');
      }
    });
  });
}

// === SCROLL TO ===
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
  });
}

// === START (wznawia Lenis — np. po snap lock w Kinetic) ===
function start(): void {
  lenis?.start();
}

// === EVENT SUBSCRIPTION (Lenis scroll — dla sekcji np. Kinetic snap) ===
function on(event: string, handler: (...args: unknown[]) => void): void {
  lenis?.on(event as 'scroll', handler as (e: unknown) => void);
}

function off(event: string, handler: (...args: unknown[]) => void): void {
  lenis?.off(event as 'scroll', handler as (e: unknown) => void);
}

// === GETTERS ===
function getLenis(): Lenis | null {
  return lenis;
}

function isReady(): boolean {
  return lenis !== null;
}

// === EXPORT ===
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
