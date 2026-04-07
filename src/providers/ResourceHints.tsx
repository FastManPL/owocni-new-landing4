/**
 * Resource hints — tylko to, co realnie idzie z zewnętrznych originów.
 * Fonty: next/font w layout.tsx (brak requestów do fonts.googleapis w runtime) → bez preconnect do Google Fonts.
 * Preconnect ≤ 4 (Lighthouse): zostawiamy tylko najcięższe third-party używane wcześnie.
 */

export function ResourceHints() {
  return (
    <>
      {/* blok-4-5 — Three.js z CDN */}
      <link rel="preconnect" href="https://cdn.jsdelivr.net" />

      {/* Wistia — book-stats + O nas */}
      <link rel="preconnect" href="https://fast.wistia.com" />

      {/* Love-wall: avatary lazy — wystarczy dns-prefetch (bez zajmowania slotu preconnect) */}
      <link rel="dns-prefetch" href="https://i.pravatar.cc" />

      {/* book-stats — LCP/obraz powyżej foldu */}
      <link rel="preload" href="/books/Statystyki-stron.webp" as="image" type="image/webp" />

      {/* hero — perf.preloadCandidates (SECTION_MANIFEST): logo Lottie JSON, same-origin fetch */}
      <link rel="preload" href="/animations/LOGO_OWOCNI.json" as="fetch" />
    </>
  );
}
