'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { scrollRuntime } from '@/lib/scrollRuntime';

type DeferredMountProps = {
  children: ReactNode;
  /**
   * Rezerwa miejsca zanim sekcja się zamontuje — ogranicza CLS.
   * Dobierz w przybliżeniu do realnej wysokości sekcji.
   */
  minHeight?: string;
  /** Margines IO (np. wcześniejsze ładowanie przed wejściem w kadr). */
  rootMargin?: string;
};

/** Szybki skok scrolla: IO nie zdąży zgłosić przecięcia; slot może być już nad viewportem — wtedy też montujemy (isSlotScrolledPast). */
const NEAR_VIEWPORT_PX = 1200;
const LENIS_BIND_MAX_FRAMES = 180;
const ACTIVATE_POLL_MS = 120;
const ACTIVATE_POLL_MAX_TICKS = 70;

/**
 * Montuje dzieci dopiero gdy slot jest blisko viewportu (IntersectionObserver)
 * lub od razu, jeśli jest już w strefie preload — opóźnia pobranie i wykonanie
 * ciężkiego JS sekcji poniżej foldu (niższy TBT / mniejszy blokada głównego wątku przy starcie).
 */
export function DeferredMount({
  children,
  minHeight = 'min(100vh, 900px)',
  rootMargin = '800px 0px 800px 0px',
}: DeferredMountProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let activated = false;
    let io: IntersectionObserver | null = null;
    let rafId = 0;
    let srFrames = 0;
    let pollTicks = 0;
    let pollId: ReturnType<typeof setInterval> | null = null;
    const scrollCleanups: (() => void)[] = [];

    const teardownScroll = () => {
      while (scrollCleanups.length) {
        scrollCleanups.pop()?.();
      }
    };

    const stopPoll = () => {
      if (pollId != null) {
        clearInterval(pollId);
        pollId = null;
      }
    };

    const activate = () => {
      if (activated) return;
      activated = true;
      setShow(true);
      io?.disconnect();
      io = null;
      teardownScroll();
      stopPoll();
      cancelAnimationFrame(rafId);
    };

    const isNearViewport = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      return r.top < vh + NEAR_VIEWPORT_PX && r.bottom > -NEAR_VIEWPORT_PX;
    };

    /** Skok scrolla (np. pasek): slot mija viewport bez „przecięcia” IO — montujemy, żeby treść była w DOM przy powrocie w górę. */
    const isSlotScrolledPast = () => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.bottom < 0;
    };

    const shouldActivate = () => isNearViewport() || isSlotScrolledPast();

    const onScroll = () => {
      if (!activated && shouldActivate()) activate();
    };

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const preloadPx = 480;
    if (rect.top < vh + preloadPx || isSlotScrolledPast()) {
      activate();
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      activate();
      return;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    scrollCleanups.push(() => window.removeEventListener('scroll', onScroll));

    const tryBindLenisScroll = () => {
      if (activated) return;
      if (scrollRuntime.isReady()) {
        scrollRuntime.on('scroll', onScroll);
        scrollCleanups.push(() => scrollRuntime.off('scroll', onScroll));
        return;
      }
      if (srFrames++ < LENIS_BIND_MAX_FRAMES) {
        rafId = requestAnimationFrame(tryBindLenisScroll);
      }
    };
    tryBindLenisScroll();

    io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e?.isIntersecting) activate();
      },
      { root: null, rootMargin, threshold: 0 }
    );
    io.observe(el);

    const tickActivate = () => {
      if (!activated && shouldActivate()) activate();
    };

    requestAnimationFrame(() => {
      tickActivate();
      requestAnimationFrame(tickActivate);
    });

    /* Lenis często nie odpala window.scroll; skok paska — jedna klatka IO może pominąć zakres. */
    pollId = setInterval(() => {
      pollTicks++;
      tickActivate();
      if (activated || pollTicks >= ACTIVATE_POLL_MAX_TICKS) stopPoll();
    }, ACTIVATE_POLL_MS);

    if (typeof window !== 'undefined') {
      window.addEventListener('scrollend', tickActivate, { passive: true });
      scrollCleanups.push(() => window.removeEventListener('scrollend', tickActivate));
    }

    return () => {
      cancelAnimationFrame(rafId);
      stopPoll();
      io?.disconnect();
      teardownScroll();
    };
  }, [rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: show ? undefined : minHeight }} data-deferred-root>
      {show ? children : null}
    </div>
  );
}
