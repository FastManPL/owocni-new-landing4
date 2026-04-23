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
      style={{
        minHeight: '150vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: '1rem',
        fontFamily: 'var(--font-brand, system-ui, sans-serif)',
        fontSize: 'clamp(0.875rem, 2.5vw, 1.125rem)',
        letterSpacing: '0.02em',
        color: 'rgba(0,0,0,0.35)',
        background: 'linear-gradient(180deg, rgba(247,246,244,0.98) 0%, rgba(235,232,226,0.55) 100%)',
      }}
    >
      --placeholder sekcja kinetic--
    </div>
  );
}

/** Client boundary: `ssr: false` dla Kinetic jest dozwolony tylko poza Server Component (`page.tsx`). */
export function KineticHomeSlot() {
  if (!SHOW_KINETIC_SECTION) {
    return <KineticSectionOffPlaceholder />;
  }
  return <KineticBridgeLayer />;
}
