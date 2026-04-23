'use client';

import dynamic from 'next/dynamic';
import { SHOW_KINETIC_SECTION } from '@/config/featureFlags';

const KineticBridgeLayer = dynamic(() => import('./KineticBridgeLayer'), {
  ssr: false,
  loading: () => (
    <div id="kinetic-section" style={{ minHeight: '100vh' }} aria-busy={true} />
  ),
});

function KineticSectionOffPlaceholder() {
  return (
    <div
      id="kinetic-section"
      data-kinetic-section-disabled
      aria-hidden={true}
      style={{
        minHeight: '100vh',
        pointerEvents: 'none',
        contain: 'strict',
      }}
    />
  );
}

/** Client boundary: `ssr: false` dla Kinetic jest dozwolony tylko poza Server Component (`page.tsx`). */
export function KineticHomeSlot() {
  if (!SHOW_KINETIC_SECTION) {
    return <KineticSectionOffPlaceholder />;
  }
  return <KineticBridgeLayer />;
}
