'use client';

import dynamic from 'next/dynamic';

// Faza 3.3: `id="case-studies-section"` na skeleton — dzięki temu
// `near-viewport` warmup w `homeRouteChunkWarmup.ts` (z `observeTarget:
// '#case-studies-section'`) znajduje element w DOM zaraz po mount wrappera
// i może gatekeeper chunk engine-u na faktyczną bliskość viewport.
// Bez ID observer fallbackuje na `document.body` → degeneruje do `immediate`.
const CaseStudiesTilesEngine = dynamic(
  () =>
    import('./CaseStudiesTilesEngine').then((mod) => ({
      default: mod.CaseStudiesTilesEngine,
    })),
  {
    ssr: false,
    loading: () => (
      <section id="case-studies-section" aria-hidden="true" style={{ minHeight: '100vh' }} />
    ),
  }
);

export function CaseStudiesSection() {
  return <CaseStudiesTilesEngine />;
}
