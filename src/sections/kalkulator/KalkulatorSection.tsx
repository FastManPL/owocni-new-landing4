import { KalkulatorSectionClientBoundary } from './KalkulatorSectionClientBoundary';

/**
 * Shell SSR: `#kalkulator-section` w RSC; silnik lazy w `KalkulatorSectionClientBoundary` (client).
 */
export function KalkulatorSection() {
  return (
    <section
      id="kalkulator-section"
      style={{
        isolation: 'isolate',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <KalkulatorSectionClientBoundary />
    </section>
  );
}
