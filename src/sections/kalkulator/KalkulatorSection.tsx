'use client';

import ConversionCalculator from './ConversionCalculator.PRE-FACTORY';

/**
 * Wrapper sekcji Kalkulator (wyjątek integracyjny — wygenerowany z PRE-FACTORY).
 * Kontrakt: section#kalkulator-section, isolation: isolate (Konstytucja).
 */
export function KalkulatorSection() {
  return (
    <section
      id="kalkulator-section"
      style={{ isolation: 'isolate' }}
    >
      <ConversionCalculator />
    </section>
  );
}
