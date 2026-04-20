'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import './kinetic-section.css';

const KineticEngine = dynamic(() => import('./KineticEngine'), {
  ssr: false,
  loading: () => null,
});

/**
 * Shell `<section id="kinetic-section">` w pierwszym bundle KineticSection — geometria i id w DOM
 * zanim dojedzie chunk KineticEngine (model shell + późniejszy engine z notatki architektury).
 */
export default function KineticSection() {
  const shellRef = useRef<HTMLElement | null>(null);
  return (
    <section
      id="kinetic-section"
      ref={shellRef}
      className="stage stage-pinned"
      style={{ minHeight: '100vh' }}
    >
      <KineticEngine containerRef={shellRef} />
    </section>
  );
}
