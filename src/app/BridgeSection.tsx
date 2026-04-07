'use client';

import { useRef } from 'react';
import KineticSection from '@/sections/kinetic/KineticSection';
import { BridgeProvider } from './BridgeContext';

/**
 * Wrapper z pinem tylko dla Kinetic (integracja §7A, §7B).
 * Fakty jest poza wrapperem, żeby jego ScrollTriggery (w tym #organic-overlay) działały normalnie.
 */
const BRIDGE_FAKTY_U = 0;

export function BridgeSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinSpacerRef = useRef<HTMLDivElement>(null);
  const faktyLayerRef = useRef<HTMLDivElement | null>(null);

  const bridgeValue = {
    wrapperRef,
    pinSpacerRef,
    faktyLayerRef,
    bridgeFaktyU: BRIDGE_FAKTY_U,
  };

  return (
    <BridgeProvider value={bridgeValue}>
      {/* Własny pinSpacer — GSAP nie wstawia węzła w drzewo, unikamy "insertBefore" (React). */}
      <div
        ref={pinSpacerRef}
        style={{
          minHeight: '100vh',
          // Wcześniejsze wejście pinu (~60vh): nachodzi na Fakty; bridge z-index > Fakty (niskie z-index w sekcji).
          marginTop: 'clamp(-68vh, -60vh, -52vh)',
        }}
      >
        <div
          id="bridge-wrapper"
          ref={wrapperRef}
          style={{
            position: 'relative',
            overflow: 'hidden',
            height: '100vh',
            isolation: 'isolate',
            /* Nad #blok-4-5-section (z-index 11 w CSS sekcji), żeby Kinetic był widoczny przed Blok45 mimo ujemnego margin-top Blok45. Wave nadal wygrywa: .wave-reveal-active → z-index 20. */
            zIndex: 15,
          }}
        >
          <div
            id="kinetic-layer"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
            }}
          >
            <KineticSection />
          </div>
        </div>
        {/* Sentinel: gdy jego top = viewport top, scroll = koniec pinu — Block45 uruchamia wave w tym momencie. */}
        <div id="bridge-pin-end-sentinel" aria-hidden="true" style={{ position: 'relative', height: 0, pointerEvents: 'none' }} />
      </div>
    </BridgeProvider>
  );
}
