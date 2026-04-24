'use client';

import dynamic from 'next/dynamic';

/**
 * Next.js 16: `ssr: false` tylko w Client Component — patrz `BookStatsSectionWrapper`.
 * Warmup: `homeRouteChunkWarmup.ts` → `@/sections/case-study2/CaseStudy2Section`.
 */
const CaseStudy2Section = dynamic(
  () =>
    import('@/sections/case-study2/CaseStudy2Section').then((m) => ({
      default: m.CaseStudy2Section,
    })),
  {
    ssr: false,
    loading: () => (
      <section
        id="case-study-section"
        style={{ minHeight: '100vh' }}
        aria-hidden="true"
        aria-busy="true"
      />
    ),
  }
);

export function CaseStudy2SectionWrapper() {
  return <CaseStudy2Section />;
}
