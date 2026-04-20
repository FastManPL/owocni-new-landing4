/**
 * Punkt wejścia podglądu statycznego: ten sam układ co /handoff/kinetic-blok45,
 * silniki ładowane bez next/dynamic (bez Next runtime).
 */
import { createRoot } from 'react-dom/client';
import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import scrollRuntime from '@/lib/scrollRuntime';
import { BridgeProvider } from '@/app/BridgeContext';
import '@/sections/kinetic/kinetic-section.css';
import KineticEngine from '@/sections/kinetic/KineticEngine';
import Blok45Engine from '@/sections/block-45/Blok45Engine';

const BRIDGE_FAKTY_U = 0;

function HandoffBridge(): ReactNode {
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
      <div
        ref={pinSpacerRef}
        style={{
          minHeight: '100vh',
          marginTop: 'clamp(-150vh, -138vh, -126vh)',
        }}
      >
        <div
          id="bridge-wrapper"
          ref={wrapperRef}
          style={{
            position: 'relative',
            overflow: 'visible',
            minHeight: '100vh',
            isolation: 'isolate',
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
            <KineticEngine />
          </div>
        </div>
        <div
          id="bridge-pin-end-sentinel"
          aria-hidden="true"
          style={{ position: 'relative', height: 0, pointerEvents: 'none' }}
        />
      </div>
    </BridgeProvider>
  );
}

function PreviewApp(): ReactNode {
  return (
    <main style={{ minHeight: 0, background: '#f7f6f4' }}>
      <section
        id="fakty-section"
        aria-label="Handoff — placeholder zamiast sekcji Fakty"
        style={{
          position: 'relative',
          background: '#f7f6f4',
          minHeight: 'min(120vh, 1100px)',
        }}
      />
      <div style={{ minHeight: 'min(200vh, 1800px)' }}>
        <HandoffBridge />
        <Blok45Engine />
      </div>
    </main>
  );
}

function mountWhenReady(): void {
  // Jak SmoothScrollProvider: 2× rAF przed init — ta sama kolejność względem pierwszego layoutu.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollRuntime.init();
      const tick = (): void => {
        if (!scrollRuntime.isReady()) {
          requestAnimationFrame(tick);
          return;
        }
        gsap.ticker.lagSmoothing(0);
        const el = document.getElementById('preview-app-root');
        if (!el) return;
        const root = createRoot(el);
        root.render(<PreviewApp />);
        // Jedna para rAF po mountcie — ST/Lenis widzą już drzewo (Kinetic pin + Blok45 wave).
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollRuntime.requestRefresh('preview-handoff-mounted');
          });
        });
      };
      requestAnimationFrame(tick);
    });
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountWhenReady);
  } else {
    mountWhenReady();
  }
}
