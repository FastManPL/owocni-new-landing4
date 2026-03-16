/**
 * Resource hints z SECTION_MANIFEST (P4 — tylko z manifestów).
 * book-stats: perf.preloadCandidates, perf.prefetchCandidates, perf.preconnectDomains.
 * fakty: perf.preconnectDomains (fonts).
 */

export function ResourceHints() {
  return (
    <>
      {/* fakty — preconnect (perf.preconnectDomains) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

      {/* book-stats — preload HOT (perf.preloadCandidates) */}
      <link
        rel="preload"
        href="/books/Ksiazka-Klatki/frame-001.webp"
        as="image"
        type="image/webp"
      />
      <link rel="preload" href="/books/Statystyki-stron.png" as="image" />

      {/* book-stats — prefetch WARM (użyty w sekcji: video w piętrze obrazów) */}
      <link rel="prefetch" href="/books/banner-konwersja-strony.mp4" as="video" type="video/mp4" />
    </>
  );
}
