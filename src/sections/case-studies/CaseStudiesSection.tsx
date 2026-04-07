'use client';

import dynamic from 'next/dynamic';

const CaseStudiesTilesEngine = dynamic(
  () =>
    import('./CaseStudiesTilesEngine').then((mod) => ({
      default: mod.CaseStudiesTilesEngine,
    })),
  {
    ssr: false,
    loading: () => <section aria-hidden="true" style={{ minHeight: '100vh' }} />,
  }
);

export function CaseStudiesSection() {
  return <CaseStudiesTilesEngine />;
}
