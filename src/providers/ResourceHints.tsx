/**
 * Resource hints z SECTION_MANIFEST (P4 — tylko z manifestów).
 * Preconnect / preload / prefetch wg perf.resourceHints.
 */

export function ResourceHints() {
  return (
    <>
      {/* book-stats — preconnect (HOT/WARM z manifestu) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />

      {/* book-stats — preload HOT: pierwszy frame */}
      <link
        rel="preload"
        href="/books/Ksiazka-Klatki/frame-001.webp"
        as="image"
        type="image/webp"
        crossOrigin="anonymous"
      />

      {/* book-stats — prefetch WARM: binary subdivision frames */}
      <link rel="prefetch" href="/books/Ksiazka-Klatki/frame-002.webp" as="image" />
      <link rel="prefetch" href="/books/Ksiazka-Klatki/frame-012.webp" as="image" />
      <link rel="prefetch" href="/books/Ksiazka-Klatki/frame-023.webp" as="image" />
    </>
  );
}
