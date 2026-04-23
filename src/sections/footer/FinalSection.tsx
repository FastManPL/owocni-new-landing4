'use client';

import dynamic from 'next/dynamic';

// dynamicImport: true — Three.js + transmission shader + requestIdleCallback
// nie są kompatybilne z SSR. FinalEngine ładowany client-only.
//
// Faza 3.4c: `id="final-section"` na skeleton — dzięki temu `near-viewport`
// warmup w `homeRouteChunkWarmup.ts` (z `observeTarget: '#final-section'`)
// znajduje element w DOM od razu po mount wrappera (SSR'd) i może gatingować
// FinalEngine chunk na faktyczną bliskość viewport. `dynamic` podmienia skeleton
// na realny `<section id="final-section">` z engine'u atomicznie (React unmount/
// mount), więc brak kolizji DOM — max jeden element z tym id w danym momencie.
const FinalEngine = dynamic(() => import('./FinalEngine').then(m => ({ default: m.FinalEngine })), {
  ssr: false,
  loading: () => (
    <section id="final-section" aria-hidden="true" style={{ minHeight: '100vh' }} />
  ),
});

export function FinalSection() {
  return <FinalEngine />;
}
