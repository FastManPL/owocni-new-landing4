'use client';

import dynamic from 'next/dynamic';

const FaktyEngine = dynamic(() => import('./FaktyEngine'), {
  ssr: false,
  loading: () => <section aria-hidden="true" style={{ minHeight: '100vh' }} />,
});

export function FaktySectionClientBoundary() {
  return <FaktyEngine />;
}
