'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import './kinetic-section.css';

const KineticEngine = dynamic(() => import('./KineticEngine'), {
  ssr: false,
  loading: () => null,
});

/**
 * Musi być **bezpośrednim** dzieckiem {@link KineticSectionShell} w drzewie strony głównej.
 * Po hydracji ustawia ref na rodzica `#kinetic-section` i montuje silnik.
 */
export function KineticSectionClient() {
  const shellRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = document.getElementById('kinetic-section');
    if (el instanceof HTMLElement) shellRef.current = el;
    setReady(true);
  }, []);

  return (
    <div className="kinetic-hydrate-root" style={{ minHeight: 0 }}>
      {ready && shellRef.current ? <KineticEngine containerRef={shellRef} /> : null}
    </div>
  );
}
