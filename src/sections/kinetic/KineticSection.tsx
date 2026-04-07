'use client';

import dynamic from 'next/dynamic';

const KineticEngine = dynamic(() => import('./KineticEngine'), {
  ssr: false,
  loading: () => <section aria-hidden="true" style={{ minHeight: '100vh' }} />,
});

export default function KineticSection() {
  return <KineticEngine />;
}
