'use client';

import dynamic from 'next/dynamic';

// Faza 3.2: lokalny `runWarmupPolicy` dla Three.js został usunięty — przeniesiony
// do `homeRouteChunkWarmup.ts` jako globalny idle entry. Wcześniejszy wariant
// odpalał się dopiero po mount tego wrappera (czyli po własnym idle prefetch
// wrappera), co było o ~200ms za późno. Teraz Three.js dociąga się zaraz po
// hydracji aplikacji, zanim user doscrolluje do Blok45 / OnasSection / Final.

// Faza 3.4a: `id="onas-section"` na skeleton — dzięki temu `near-viewport`
// warmup w `homeRouteChunkWarmup.ts` (z `observeTarget: '#onas-section'`)
// znajduje element w DOM od razu po mount wrappera (SSR'd) i może gatingować
// chunk engine-u (+ `three`) na faktyczną bliskość viewport. Bez ID observer
// fallbackuje na `document.body` → degeneruje do `immediate`.
const OnasSection = dynamic(
  () =>
    import('@/sections/ONas-Sekcja/OnasSection').then((m) => ({
      default: m.OnasSection,
    })),
  {
    ssr: false,
    loading: () => (
      <section
        id="onas-section"
        style={{ minHeight: '100vh' }}
        aria-hidden="true"
      />
    ),
  }
);

export function OnasSectionWrapper() {
  return <OnasSection />;
}
