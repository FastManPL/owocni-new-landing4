/**
 * Gdy `SHOW_KINETIC_SECTION` jest false: zwykła sekcja w flow (bez Bridge / pinSpacer / #kinetic-section).
 * Wysokość ~nachodzenie #blok-4-5-section (ujemny margin-top w CSS sekcji — nie edytujemy go tutaj).
 */
export function KineticDisabledPlaceholder() {
  return (
    <section
      id="home-kinetic-placeholder"
      aria-label="Sekcja Kinetic tymczasowo wyłączona"
      data-home-kinetic-placeholder
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        width: '100%',
        minHeight: 'clamp(120vh, 135vh, 170vh)',
        margin: 0,
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-brand, system-ui, sans-serif)',
        fontSize: 'clamp(0.875rem, 2.5vw, 1.125rem)',
        letterSpacing: '0.02em',
        color: 'rgba(0,0,0,0.35)',
        background: 'linear-gradient(180deg, rgba(247,246,244,0.98) 0%, rgba(235,232,226,0.55) 100%)',
      }}
    >
      --placeholder sekcja kinetic--
    </section>
  );
}
