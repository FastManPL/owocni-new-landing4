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
  scrollTo: (
    target: number | string | HTMLElement,
    options?: ScrollToOptions
  ) => void;
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
let orientationHandler: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let resizeHandler: (() => void) | null = null;

// === CONSTANTS ===
const REFRESH_DEBOUNCE_MS = 120;
const RESIZE_DEBOUNCE_MS = 250;

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
    touchMultiplier: 2,
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

  // === ORIENTATION CHANGE (Konstytucja C5) ===
  orientationHandler = () => {
    requestRefresh('orientationchange');
  };
  window.addEventListener('orientationchange', orientationHandler, {
    passive: true,
  });

  // === RESIZE HANDLER (Desktop) ===
  // ignoreMobileResize chroni przed toolbar hide/show na mobile
  // ale desktop resize wymaga refresh (zmiana layoutu)
  resizeHandler = () => {
    clearTimeout(resizeTimeout ?? undefined);
    resizeTimeout = setTimeout(() => {
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

  // Remove event listeners
  if (orientationHandler) {
    window.removeEventListener('orientationchange', orientationHandler);
    orientationHandler = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }

  // Destroy Lenis
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
  scrollTo,
  getLenis,
  isReady,
};

export default scrollRuntime;
