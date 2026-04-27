/**
 * Resource hints — Konstytucja G2/G3/G7/F9.
 *
 * Zasada: tylko hero jest HOT. Preload (HIGH priority) rezerwujemy wyłącznie
 * dla assetów krytycznych dla planu LCP (tu: brak — LCP to tekst H1 + font Lexend
 * ładowany przez next/font). Dla far-below-fold third-party tylko dns-prefetch (G7).
 *
 * Historia: wcześniej preloadowaliśmy /books/Statystyki-stron.webp (WARM below-fold)
 * i /animations/LOGO_OWOCNI.json (używane ~t+6s, nie LCP). Oba kradły bandwidth LCP —
 * usunięte zgodnie z G2/F9.
 *
 * PROMPT 8 / krok 4: usunięto dns-prefetch cdn.jsdelivr.net — w prod `src` Three.js
 * jest z bundla (`three` npm), brak requestów runtime do jsdelivr.
 */

export function ResourceHints() {
  return (
    <>
      {/* Wistia — embedy lazy (`next/script` lazyOnload, I7) */}
      <link rel="dns-prefetch" href="https://fast.wistia.com" />

      {/* Love-wall: avatary lazy */}
      <link rel="dns-prefetch" href="https://i.pravatar.cc" />
    </>
  );
}
