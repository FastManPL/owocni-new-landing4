'use client';

import dynamic from 'next/dynamic';

const KalkulatorSectionClient = dynamic(
  () =>
    import('./KalkulatorSectionClient').then((m) => ({ default: m.KalkulatorSectionClient })),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="bg-canvas"
        style={{ minHeight: 'min(110vh, 1000px)' }}
      />
    ),
  }
);

export function KalkulatorSectionClientBoundary() {
  return <KalkulatorSectionClient />;
}
