'use client';

import dynamic from 'next/dynamic';

/**
 * Next.js 16: `dynamic({ ssr: false })` nie może być w Server Component (`page.tsx`).
 * Ten cienki wrapper jest Client Boundary — Faza 1.3 bez SSR hydracji ciężkiego silnika.
 * Warmup: `homeRouteChunkWarmup.ts` → `@/sections/books/BookStatsSection`.
 */
const BookStatsSection = dynamic(
  () =>
    import('@/sections/books/BookStatsSection').then((m) => ({ default: m.BookStatsSection })),
  {
    ssr: false,
    loading: () => (
      <section
        id="book-stats-section"
        className="section"
        style={{ minHeight: '100vh' }}
        aria-hidden="true"
        aria-busy="true"
      />
    ),
  }
);

export function BookStatsSectionWrapper() {
  return <BookStatsSection />;
}
