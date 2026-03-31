'use client';

import dynamic from 'next/dynamic';

// dynamicImport: true — Three.js + transmission shader + requestIdleCallback
// nie są kompatybilne z SSR. FinalEngine ładowany client-only.
const FinalEngine = dynamic(() => import('./FinalEngine').then(m => ({ default: m.FinalEngine })), {
  ssr: false,
  loading: () => (
    // Placeholder bez id — kolizja DOM gdy Engine ładuje się asynchronicznie
    // id="final-section" tylko w FinalEngine <section>
    <section aria-hidden="true" style={{ minHeight: '100vh' }} />
  ),
});

export function FinalSection() {
  return <FinalEngine />;
}
