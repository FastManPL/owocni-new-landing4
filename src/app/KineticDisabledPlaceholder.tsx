/**
 * Gdy `SHOW_KINETIC_SECTION` jest false: zwykła sekcja w flow (bez Bridge / pinSpacer / #kinetic-section).
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
        minHeight: '200vh',
        margin: 0,
        paddingTop: '30vh',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        paddingBottom: '1rem',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        fontFamily: 'var(--font-brand, system-ui, sans-serif)',
        fontSize: '4rem',
        letterSpacing: '0.02em',
        color: 'rgba(0,0,0,0.35)',
        background: 'linear-gradient(180deg, rgba(247,246,244,0.98) 0%, rgba(235,232,226,0.55) 100%)',
      }}
    >
      --placeholder sekcja kinetic--
    </section>
  );
}
