'use client';

import dynamic from 'next/dynamic';

const OwocniForm = dynamic(
  () => import('@owocni/cennik-form').then((m) => ({ default: m.OwocniForm })),
  { ssr: false, loading: () => null }
);

/** Zawartość #final-formCard — osobny chunk, bez SSR (formularz + CSS). */
export function FinalFormCard() {
  return <OwocniForm embed />;
}
