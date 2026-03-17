'use client';

import { useRef } from 'react';
import { FaktySection } from '@/sections/fakty/FaktySection';
import { KineticSection } from '@/sections/kinetic/KineticSection';
import { BridgeProvider } from './BridgeContext';

/**
 * Makro-Sekcja: Fakty + Kinetic w jednym wrapperze z pinem (integracja §1, §7A).
 * Block 4 pozostaje POZA wrapperem (Curtain Reveal, §7B).
 * Wrapper: brak transform/filter na rodzicach (wymóg pina), isolation: isolate.
 */
const BRIDGE_FAKTY_U = 0; // placeholder: 4 = faza Fakty yPercent -100 w jednostkach timeline

export function BridgeSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const faktyLayerRef = useRef<HTMLDivElement>(null);

  const bridgeValue = {
    wrapperRef,
    faktyLayerRef,
    bridgeFaktyU: BRIDGE_FAKTY_U,
  };

  return (
    <BridgeProvider value={bridgeValue}>
      <div
        id="bridge-wrapper"
        ref={wrapperRef}
        style={{
          position: 'relative',
          overflow: 'hidden',
          height: '100vh',
          isolation: 'isolate',
        }}
      >
        <div
          id="fakty-layer"
          ref={faktyLayerRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            background: 'transparent',
          }}
        >
          <FaktySection />
        </div>
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
    </BridgeProvider>
  );
}
