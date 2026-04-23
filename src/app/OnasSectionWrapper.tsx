'use client';

import dynamic from 'next/dynamic';

// Faza 3.2: lokalny `runWarmupPolicy` dla Three.js został usunięty — przeniesiony
// do `homeRouteChunkWarmup.ts` jako globalny idle entry. Wcześniejszy wariant
// odpalał się dopiero po mount tego wrappera (czyli po własnym idle prefetch
// wrappera), co było o ~200ms za późno. Teraz Three.js dociąga się zaraz po
// hydracji aplikacji, zanim user doscrolluje do Blok45 / OnasSection / Final.

const OnasSection = dynamic(
  () =>
    import('@/sections/ONas-Sekcja/OnasSection').then((m) => ({
      default: m.OnasSection,
    })),
  {
    ssr: false,
    loading: () => (
      <section
        style={{ minHeight: '100vh' }}
        aria-hidden="true"
      />
    ),
  }
);

export function OnasSectionWrapper() {
  return <OnasSection />;
}
