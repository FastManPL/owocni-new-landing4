// ═══════════════════════════════════════════════════════════════
// SECTION MANIFEST — case-studies (3 tiles, silnik z SEKCJA-PORTFOLIO)
// ═══════════════════════════════════════════════════════════════

export const SECTION_MANIFEST = {
  slug: 'case-studies',
  type: 'B' as const,
  requires: ['scrollRuntime', 'gsap', 'ScrollTrigger'],

  webgl: null,

  assets: [
    { kind: 'img', src: 'ptr.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'banach-1wszyi-planFIN-1.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tworzenie-strony-konsulting.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tworzenie-strony-finanse.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'mar.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'kratki.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tekst-strony1.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tekst-strony2.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'projektowanie-stron-it.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'pragma-marcin.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'kwadrat-tyl.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'kwadrat-srodek.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'kwadrat-przod.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'dlon-mobilna.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'vit.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tlo-strony.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'projektowanie-strony-oko.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'dlon-artefakt.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'dlon-mobile-design.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tlum.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'hipnotyzuj.gif', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'przyklady-strony.webp', priority: 'HOT', critical: true, lcp: false },
    { kind: 'video', src: 'portfolios/strona-pattern1.mp4', priority: 'HOT', critical: true, lcp: false },
    { kind: 'video', src: 'portfolios/strona-pattern2.mp4', priority: 'HOT', critical: true, lcp: false },
    { kind: 'video', src: 'portfolios/strona-pattern3.mp4', priority: 'HOT', critical: true, lcp: false },
    { kind: 'video', src: 'portfolios/mobile-design.mp4', priority: 'HOT', critical: true, lcp: false },
    {
      kind: 'canvas',
      src: 'portfolios/canvas/000-040.webp (41 frames)',
      priority: 'HOT',
      critical: true,
      lcp: false,
    },
  ],

  warmup: [],
  scrollTriggersCount: 3,

  geometryMutable: false,
  geometryRefresh: 'none' as const,
  geometryContract: 'normal' as const,
  syntheticContextAllowed: true,
  entryExitInvariant: false,
  preserveExistingGuards: true,

  refreshSignals: [],

  export: {
    mode: 'named' as const,
    name: 'CaseStudiesSection',
  },

  slots: [],
  dciProps: [],
  timelineContract: undefined,

  specialNotes: {
    breakpoints: ['640px'],
    platformGuards: [],
    cpuGatingMechanism: 'IO-pause/resume' as const,
    cpuGatingPath: 1,
  },

  integrationNotes: {
    hasPin: false,
    hasSnap: false,
    affectsGeometryBelow: false,
    sensitiveTo: [],
    testWith: [],
  },

  deliveryRisk: 'url-swap-no-preload' as const,
  preloadNote: undefined,

  perf: {
    dynamicImport: true,
    isHero: false,
    gracefulDegradation: true,
    preloadCandidates: [],
    prefetchCandidates: [],
    coldCandidates: [],
    preconnectDomains: [],
    containApplied: false,
    warnings: ['PERF-W3', 'PERF-W9'],
  },

  scrollRuntimeRecommendations: [],

  runtimeChecks: {
    'CLN-01': 'PASS' as const,
    'SM-01': 'PASS' as const,
    'SM-02': 'PASS' as const,
    'INT-01': 'N/A' as const,
    'INT-02': 'N/A' as const,
    'INT-03': 'N/A' as const,
    'INT-04': 'N/A' as const,
    'WGL-01': 'N/A' as const,
    'WGL-02': 'N/A' as const,
    'WGL-03': 'N/A' as const,
  },
};
