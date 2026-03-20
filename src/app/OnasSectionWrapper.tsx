'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { runWarmupPolicy } from '@/lib/moduleLoader';

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
  useEffect(() => {
    runWarmupPolicy([
      {
        import: () => import('three'),
        policy: 'idle',
      },
    ]);
  }, []);

  return <OnasSection />;
}
