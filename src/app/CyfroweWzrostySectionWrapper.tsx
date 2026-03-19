'use client';

import dynamic from 'next/dynamic';

/**
 * Client boundary dla sekcji cyfrowe-wzrosty (perf.dynamicImport: true).
 * Typ B, geometryMutable: false — brak useGeometryRefresh.
 * Skeleton: 'none' → minHeight 100vh placeholder.
 */
const CyfroweWzrostySection = dynamic(
  () =>
    import('@/sections/cyfrowe-wzrosty/cyfrowewzrostysection').then((m) => ({
      default: m.default,
    })),
  {
    loading: () => (
      <section
        style={{ minHeight: '100vh' }}
        aria-hidden="true"
      />
    ),
  }
);

export function CyfroweWzrostySectionWrapper() {
  return <CyfroweWzrostySection />;
}
