'use client';

import { useRef, type ReactNode } from 'react';
import { BridgeProvider } from './BridgeContext';

/**
 * Wrapper z pinem tylko dla Kinetic (integracja §7A, §7B).
 * Fakty jest poza wrapperem, żeby jego ScrollTriggery (w tym #organic-overlay) działały normalnie.
 */
const BRIDGE_FAKTY_U = 0;

type BridgeSectionProps = {
  /** Z RSC (np. `KineticSectionShell` + `KineticSectionClient` na `/`). Domyślnie pełny client `KineticSection`. */
  kineticLayer?: ReactNode;
};

export function BridgeSection({ kineticLayer }: BridgeSectionProps = {}) {
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
          // Nachodzenie na Fakty: ~50vh wyżej niż poprzedni clamp(-100…-76vh).
          marginTop: 'clamp(-150vh, -138vh, -126vh)',
        }}
      >
        <div
          id="bridge-wrapper"
          ref={wrapperRef}
          style={{
            position: 'relative',
            /*
              Kinetic + ScrollTrigger pin: GSAP dokłada wysoki .pin-spacer wokół #kinetic-section.
              Gdy #kinetic-layer był position:absolute (poza flow) i wrapper miał sztywne height:100vh
              + overflow:hidden, dokument NIE dostawał pełnej długości pinu — #blok-4-5-section
              (z ujemnym margin-top) wchodził wizualnie „nad” Kinetic. minHeight + warstwa w flow
              pozwala pin-spacerowi rozpychać stronę; Blok45 zostaje pod rzeczywistą osią scrolla Kinetic.
            */
            overflow: 'visible',
            minHeight: '100vh',
            isolation: 'isolate',
            /* Poniżej #blok-4-5-section (z≥12), żeby napisy Blok45 i fala były nad Kinetic. */
            zIndex: 10,
          }}
        >
          <div
            id="kinetic-layer"
            style={{
              position: 'relative',
              width: '100%',
              minHeight: '100vh',
              zIndex: 1,
            }}
          >
            {kineticLayer ?? (
              <div
                data-bridge-kinetic-fallback
                style={{ minHeight: '100vh' }}
                aria-hidden={true}
              />
            )}
          </div>
        </div>
        {/* Sentinel: gdy jego top = viewport top, scroll = koniec pinu — Block45 uruchamia wave w tym momencie. */}
        <div id="bridge-pin-end-sentinel" aria-hidden="true" style={{ position: 'relative', height: 0, pointerEvents: 'none' }} />
      </div>
    </BridgeProvider>
  );
}
