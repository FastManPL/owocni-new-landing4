/**
 * Resource hints z SECTION_MANIFEST (P4 — tylko z manifestów).
 * book-stats: perf.preloadCandidates, perf.prefetchCandidates, perf.preconnectDomains.
 */

export function ResourceHints() {
  return (
    <>
      {/* book-stats — preload HOT (perf.preloadCandidates) */}
      <link
        rel="preload"
        href="/assets/book-frames/frame-001.webp"
        as="image"
        type="image/webp"
      />
      <link rel="preload" href="/assets/stats-poster.webp" as="image" />

      {/* book-stats — prefetch WARM (perf.prefetchCandidates) */}
      <link rel="prefetch" href="/assets/stats-video.webm" as="video" type="video/webm" />
    </>
  );
}
