'use client';

import dynamic from 'next/dynamic';

const KineticBridgeLayer = dynamic(() => import('./KineticBridgeLayer'), {
  ssr: false,
  loading: () => (
    <div id="kinetic-section" style={{ minHeight: '100vh' }} aria-busy={true} />
  ),
});

/** Używane wyłącznie wewnątrz `<BridgeSection />` gdy `SHOW_KINETIC_SECTION` (patrz `page.tsx`). */
export function KineticHomeSlot() {
  return <KineticBridgeLayer />;
}
