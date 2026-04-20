import type { ReactNode } from 'react';

/**
 * Server shell: id + geometria w pierwszym HTML (crawl / CWV layout slot).
 * Silnik montuje się w {@link KineticSectionClient} jako child.
 */
export function KineticSectionShell({ children }: { children: ReactNode }) {
  return (
    <section
      id="kinetic-section"
      className="stage stage-pinned"
      style={{ minHeight: '100vh' }}
      aria-label="Sekcja Kinetic"
    >
      {children}
    </section>
  );
}
