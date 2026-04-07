'use client';

import dynamic from 'next/dynamic';

const WynikiCsTilesEngine = dynamic(
  () => import('./WynikiCsTilesEngine').then(mod => ({ default: mod.WynikiCsTilesEngine })),
  {
    ssr: false,
    loading: () => <section aria-hidden="true" style={{ minHeight: '100vh' }} />,
  }
);

export function WynikiCsTilesSection() {
  return <WynikiCsTilesEngine />;
}
