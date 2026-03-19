// ═══════════════════════════════════════════════════════════════
// SECTION MANIFEST — cyfrowe-wzrosty
// Generated: Factory P2B | Source: cyfrowe-wzrosty.reference.html
// Status: READY FOR P3 (all runtimeChecks PASS)
// ═══════════════════════════════════════════════════════════════

export const SECTION_MANIFEST = {
  slug: 'cyfrowe-wzrosty',
  type: 'B',
  requires: ['scrollRuntime', 'gsap', 'ScrollToPlugin'],
  // Nota: ScrollTrigger NIE jest required przez sekcję (0 ST instances).
  // scrollRuntime importuje ScrollTrigger globalnie — sekcja nie tworzy własnych ST.

  assets: [],
  // 0 mediów. Tile placeholders to div.tile-media-placeholder (CSS gradient, nie asset).

  warmup: [],
  // Typ B: ticker startuje natychmiast w resume(). Brak async warm-up.

  scrollTriggersCount: 0,

  geometryMutable: false,
  geometryRefresh: 'none',
  // Sekcja nie zmienia wysokości po renderze. Brak accordion/expand/collapse.

  dciProps: ['headline', 'sub', 'tier'],
  // Kandydaci do DCI (Dynamic Content Injection):
  //   headline: .tile-heading (4×)
  //   sub: .tile-body (4×)
  //   tier: .ribbon-name / .ribbon-number / .stage-label (4×)
  // Nota: #cyfrowe-wzrosty-cyfrowe-label ("4 ETAPY") też kandydat.

  timelineContract: undefined,
  // Brak timeline config. Animacje to:
  //   1. Spring physics (tick loop) — konfiguracja inline (STIFFNESS/DAMPING/etc.)
  //   2. tilesRevealTL — jednorazowa reveal timeline
  //   3. tilesHoverTLs[] — per-tile hover play/reverse
  //   4. tilesScrollTo tween — nawigacja

  specialNotes: {
    breakpoints: [400, 640, 1024, 1199, 1700],
    // 400: tile dimensions compact
    // 640: tile dimensions medium + ribbon font sizes
    // 1024: tile dimensions large
    // 1199: 3D text font-size + stage padding
    // 1700: fitted mode (tiles no longer scroll, grid layout)

    platformGuards: [
      'hasHover: matchMedia("(hover:hover)") — tiles reveal skip animation on touch',
      'prefers-reduced-motion: CSS kills all transitions/animations',
    ],

    cpuGatingMechanism: 'IO-pause/resume',
    cpuGatingPath: 1,
    cpuGatingCoexistence: 'Factory IO (0.5×VH) + internal IO (200px). B-CPU-03 PASS + ENT-LC-06 PASS.',

    springPhysics: 'curDepth/vel/stiffness/damping per letter. Ticker self-pauses after SETTLE_FRAMES.',
    domCreation: '94 layer elements created dynamically in init (7 letters × variable layers). Cleaned via innerHTML="" in kill().',

    scrollUsage: 'READ-ONLY from scrollRuntime.getScroll(). No scroll hijacking. No wheel/touch Y-axis handlers.',
    lenisSubscription: 'scrollRuntime.lenis.on("scroll", wakeUp) — event wake trigger, not scroll read.',
  },

  integrationNotes: {
    hasPin: false,
    hasSnap: false,
    affectsGeometryBelow: false,
    sensitiveTo: [],
    testWith: [],
    // Brak pin/snap/geometryMutable → zero sensitivity, zero stack testing needed.
  },

  export: {
    mode: 'default',
    name: 'CyfroweWzrostySection',
  },

  perf: {
    dynamicImport: true,
    // Typ B + 901 linii JS + spring physics ticker = ciężka sekcja.
    // SectionsClient: next/dynamic(..., { ssr: false })
    clientOnly: false,
    // GSAP + ScrollToPlugin nie mają window side-effects przy statycznym imporcie.
    // dynamicImport wystarczy (lazy load), nie potrzeba ssr:false na poziomie GSAP-SSR-02.

    isHero: false,
    gracefulDegradation: false,
    // 0 mediów → degradation nieaplikowalne.

    preloadCandidates: [],
    prefetchCandidates: [],
    coldCandidates: [],
    preconnectDomains: [],

    containApplied: true,
    // contain: layout style na #cyfrowe-wzrosty-section
    // Warunki: geometryMutable:false, no pin, no fixed, no bleed. Wszystkie spełnione.

    warnings: ['PERF-W7', 'PERF-W13', 'INIT-CPU-01'],
    // PERF-W7:  latin-ext font subset — verify in layout.tsx next/font config
    // PERF-W13: .stage-label CSS transform:scale(1.3) + GSAP fromTo scale — dual source
    // INIT-CPU-01: ~94 DOM creates in init loop (WARNING, nie STOP)
  },

  scrollRuntimeRecommendations: [
    'is-scrolling pointer-events guard (body.is-scrolling section * { pointer-events: none })',
    // Tiles track ma drag-to-scroll. Pointer events guard na body chroni przed
    // przypadkowym interakcjami podczas szybkiego vertical scroll.
  ],

  runtimeChecks: {
    'CLN-01': 'PASS',   // Cleanup: 0 orphan pin-spacers, 0 orphan styles. 7 cycles.
    'SM-01':  'PASS',   // StrictMode: DOM 194 stable across 7 INIT AGAIN cycles.
    'SM-02':  'PASS',   // Double callbacks: no side-effects, hover TLs idempotent.
    'INT-01': 'N/A',    // No pin → no stack-harness
    'INT-02': 'N/A',    // No pin → no stack-harness
    'INT-03': 'N/A',    // No pin → no stack-harness
  },

  evidence: {
    pipelineComplete: true,
    auditComplete: true,
    factoryHardeningComplete: true,
    cpuGatingImplemented: true,
    criticalBlockers: 0,

    telemetry: {
      initCost: '4.4ms',
      scrollTriggers: 0,
      domNodes: 194,
      frameAvg: '13.4ms',
      frameWorst: '17.4ms',
      // worst 17.4ms = single spike above 16.6ms budget.
      // Acceptable for below-the-fold, non-hero section.
    },
  },
};
