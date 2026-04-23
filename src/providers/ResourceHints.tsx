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
 */

export function ResourceHints() {
  return (
    <>
      {/* blok-4-5 — Three.js z CDN (sekcja far-below-fold, WARM) */}
      <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />

      {/* Wistia — book-stats + O nas (below-fold, lazy Script) */}
      <link rel="dns-prefetch" href="https://fast.wistia.com" />

      {/* Love-wall: avatary lazy */}
      <link rel="dns-prefetch" href="https://i.pravatar.cc" />
    </>
  );
}
