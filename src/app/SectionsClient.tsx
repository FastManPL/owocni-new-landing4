'use client';

import dynamic from 'next/dynamic';

const Blok45Section = dynamic(
  () =>
    import('@/sections/block-45/Blok45Section').then((m) => ({
      default: m.Blok45Section,
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

export function SectionsClient() {
  return <Blok45Section />;
}
