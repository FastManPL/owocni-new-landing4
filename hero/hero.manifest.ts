// ═══════════════════════════════════════════════════════════════════════
// SECTION_MANIFEST — hero
// Generated: 2026-03-02 | Factory P2B (final — post INP-LEAK-01 + INIT-DOM-01 fixes)
// Source: hero.reference.html
// ═══════════════════════════════════════════════════════════════════════

export const SECTION_MANIFEST = {
  // ── METADATA ──────────────────────────────────────────────────────────
  slug: "hero",
  rootId: "hero-section",
  component: "HeroSection",
  files: {
    tsx: "HeroSection.tsx",
    css: "hero-section.css",
    manifest: "hero.manifest.ts",
    reference: "hero.reference.html",
    stack: null, // N/A — hasPin=false, hasSnap=false, geometryMutable=false
  },

  // ── TRIAGE ────────────────────────────────────────────────────────────
  type: "B", // per-frame ticker: trail tick + pendulum.update + halo rAF
  lifecycle: ["pause", "resume", "kill"],

  // ── CPU GATING ────────────────────────────────────────────────────────
  cpuGating: {
    strategy: "Ścieżka 1 — Typ B", // IO → pause() / resume()
    target: "container", // brak pin, brak data-gating-target
    rootMargin: "0.5×VH (clamp 200–1200px)",
    dynamic: true, // recreate IO na resize/orientationchange/visualViewport
  },

  // ── GEOMETRY ──────────────────────────────────────────────────────────
  hasPin: false,
  hasSnap: false,
  geometryMutable: false,
  hasScrollTrigger: false,
  perf: {
    loading: {
      dynamicImport: false,
      clientOnly: false,
      skeleton: "none",
      warmup: [],
    },
    resourceHints: {
      preconnect: [], // same-origin; dodać jeśli CDN dla assetów
      preloadCandidates: [
        // LCP element — wybrać jeden:
        // { href: '/animations/LOGO_OWOCNI.json', as: 'fetch', type: 'application/json', crossOrigin: 'anonymous' },
        // albo np. poster: { href: '/images/hero-poster.webp', as: 'image', type: 'image/webp', crossOrigin: 'anonymous' },
      ],
      prefetchCandidates: [
        // opcjonalnie np. jeden plik laury: { href: '/animations/laury-1.json' },
      ],
    },
  },

  // ── ASSETS ────────────────────────────────────────────────────────────
  assets: {
    lottie_logo: {
      path: "/animations/LOGO_OWOCNI.json",
      priority: "HOT",
      note: "lottie-web@5.12.2 obsługuje TYLKO JSON. DotLottie (.lottie) wymaga konwersji przed deployem.",
    },
    lottie_laury: {
      path: "/animations/laury-*.json",
      priority: "WARM",
    },
    trail_photos: {
      path: "/trail/[A-D][1-4]_strrona_internetowa[_RETINA].[avif|webp]",
      count: 64,
      priority: "COLD",
      formats: ["avif", "webp"],
      retina: "_RETINA suffix gdy DPR≥2 + !slowConn",
    },
  },

  // ── EXTERNAL CDN LIBRARIES ────────────────────────────────────────────
  cdnLibraries: [
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.7/gsap.min.js",
      globalVar: "gsap",
      npmPkg: "gsap@3.12.7",
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js",
      globalVar: "lottie",
      npmPkg: "lottie-web@5.12.2",
    },
  ],

  // ── SCROLL HELPERS ────────────────────────────────────────────────────
  scrollHelpers: {
    getScroll: "window.lenis?.scroll ?? window.scrollY",
    getRawScroll: "window.lenis?.targetScroll ?? window.scrollY",
    // P3: oba → scrollRuntime.getScroll() / scrollRuntime.getRawScroll()
  },

  // ── TICKER INVENTORY ──────────────────────────────────────────────────
  // PERF-W6: 3 per-frame callbacks (powyżej limitu 2 — odnotowane, akceptowalne)
  tickers: [
    { name: "trail.tick", via: "addTickFn → gsap.ticker", gated: true },
    { name: "pendulum.update", via: "gsap.ticker.add", gated: true },
    { name: "halo.hAnimate", via: "requestAnimationFrame", gated: true },
    { name: "lottie-web.rAF", via: "internal (lottie-web)", gated: false },
  ],

  // ── TRAIL PHOTO SYSTEM ────────────────────────────────────────────────
  trail: {
    imageGroups: { A: 4, B: 4, C: 4, D: 4 },
    strategy: "QuotaSequence (flat 16-cycle + EarlyFlush on group change)",
    aspect: "713/910",
    exportSizes: { "1x": "308×241px", "2x": "616×482px" },
    avifProbe: true,
    retinaDpr: "≥2",
    slowConnLogic: 'saveData OR eff!=="4g" OR downlink<5',
    exitSpeeds: {
      natural: "0.8s (OUT_S)",
      overflow: "0.3s (OUT_S_FAST)",
      flush: "0.5s (OUT_S_FLUSH)",
    },
  },

  // ── LISTENER MANAGEMENT ───────────────────────────────────────────────
  // Wszystkie addEventListener przez listen() helper → cleanups[] → kill()
  // Wyjątki (bezpieczne bez remove):
  //   - lottie anim.addEventListener → czyszczone przez anim.destroy()
  //   - wave.animationend → { dynamiczny element, self-removes przez wave.remove() }
  listenerPattern: "listen() helper → cleanups[]",

  // ── P3 CONVERSION NOTES ───────────────────────────────────────────────
  p3Notes: [
    "DEV overlay (FACTORY:DEV-OVERLAY:START/END) → usunąć w całości",
    "getScroll() → scrollRuntime.getScroll()",
    "getRawScroll() → scrollRuntime.getRawScroll()",
    "Auto-init wrapper (window.__heroSection) → useGSAP zarządza lifecycle",
    "HAAT faza 2: symulacja useLayoutEffect → prawdziwy useLayoutEffect w React",
    "Lottie logo: /animations/LOGO_OWOCNI.json wymaga konwersji .lottie→.json",
    "Trail photos: /trail/*.avif/webp → /public/trail/ w Next.js",
    "Trail deferred start (3.5s): TRAIL_MIN_DELAY od heroInitT0 → kompatybilne z useEffect mount time",
  ],
} as const;
