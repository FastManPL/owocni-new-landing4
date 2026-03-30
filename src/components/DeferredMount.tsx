'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

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

/**
 * Montuje dzieci dopiero gdy slot jest blisko viewportu (IntersectionObserver)
 * lub od razu, jeśli jest już w strefie preload — opóźnia pobranie i wykonanie
 * ciężkiego JS sekcji poniżej foldu (niższy TBT / mniejszy blokada głównego wątku przy starcie).
 */
export function DeferredMount({
  children,
  minHeight = 'min(100vh, 900px)',
  rootMargin = '0px 0px 450px 0px',
}: DeferredMountProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const activate = () => {
      setShow(true);
    };

    const rect = el.getBoundingClientRect();
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const preloadPx = 480;
    if (rect.top < vh + preloadPx) {
      activate();
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      activate();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e?.isIntersecting) {
          activate();
          io.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: show ? undefined : minHeight }} data-deferred-root>
      {show ? children : null}
    </div>
  );
}
