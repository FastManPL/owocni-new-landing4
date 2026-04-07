export const SECTION_MANIFEST = {
  slug: 'wyniki-cs-tiles',
  type: 'B' as const,
  requires: ['scrollRuntime', 'gsap', 'ScrollTrigger'],

  webgl: null,

  assets: [
    { kind: 'img', src: 'ptr.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'banach-1wszyi-planFIN-1.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tworzenie-strony-konsulting.jpg', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tworzenie-strony-finanse.jpg', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'mar.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'kratki.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tekst-strony1.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tekst-strony2.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'projektowanie-stron-it.jpg', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'pragma-marcin.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'kwadrat-tyl.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'kwadrat-srodek.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'kwadrat-przod.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'dlon-mobilna.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'vit.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tlo-strony.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'projektowanie-strony-oko.jpg', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'dlon-artefakt.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'dlon-mobile-design.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'tlum.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'img', src: 'przyklady-strony.png', priority: 'HOT', critical: true, lcp: false },
    { kind: 'video', src: 'strona-pattern1.mp4', priority: 'HOT', critical: true, lcp: false },
    { kind: 'video', src: 'strona-pattern2.mp4', priority: 'HOT', critical: true, lcp: false },
    { kind: 'video', src: 'strona-pattern3.mp4', priority: 'HOT', critical: true, lcp: false },
    { kind: 'video', src: 'mobile-design.mp4', priority: 'HOT', critical: true, lcp: false },
    { kind: 'canvas', src: 'assets/portfolios/canvas/000-040.jpg (41 frames)', priority: 'HOT', critical: true, lcp: false },
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
    name: 'WynikiCsTilesSection',
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
