'use client';

import dynamic from 'next/dynamic';

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
