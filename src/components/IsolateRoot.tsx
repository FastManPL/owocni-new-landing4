'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Renderuje children w osobnym korzeniu React (createRoot).
 * Główny korzeń layoutu nie reconciluje tego drzewa — sekcje mogą
 * mutować DOM (innerHTML, appendChild) bez konfliktu z Reactem.
 */
export function IsolateRoot({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const childrenRef = useRef(children);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!rootRef.current) {
      rootRef.current = createRoot(container);
      rootRef.current.render(childrenRef.current);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} style={{ minHeight: '100%' }} />;
}
