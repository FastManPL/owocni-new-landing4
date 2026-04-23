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
        /*
          Silnik wyłączony: brak GSAP pin-spacera. Wysokość musi przybliżyć end: z KineticEngine
          (2.1*svh + SCROLL_KINETIC + delta + overshoot), inaczej #blok-4-5-section (CSS, bez zmian)
          nachodzi zbyt wysoko na Fakty zamiast na tę „poduszkę”.
        */
        minHeight:
          'calc(100lvh + 2.1 * 100svh + (3526 * 28 / 23) * 1px + 12.5vh)',
        position: 'relative',
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
