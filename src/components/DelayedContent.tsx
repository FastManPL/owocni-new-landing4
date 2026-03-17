'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Opóźnia pierwsze wyświetlenie children o 2 rAF.
 * React (np. Strict Mode) może zrobić dwa commity przy mount — drugi rozjeżdża się
 * z mutacjami DOM w sekcjach (innerHTML, appendChild) i daje błąd insertBefore.
 * Placeholder montuje się (i ewentualnie drugi commit na nim), potem dopiero treść.
 */
export function DelayedContent({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  if (!ready) {
    return <div style={{ minHeight: '100vh' }} aria-hidden="true" />;
  }
  return <>{children}</>;
}
