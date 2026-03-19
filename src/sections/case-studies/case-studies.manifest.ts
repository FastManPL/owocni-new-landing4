// ═══════════════════════════════════════════════════════════════
// SECTION MANIFEST — case-studies (Case studies, 3 tiles)
// Source: owocni-new-landing2 case-studies-section
// ═══════════════════════════════════════════════════════════════

export const SECTION_MANIFEST = {
  slug: 'case-studies',
  type: 'A',
  requires: ['scrollRuntime', 'gsap', 'ScrollTrigger'],

  assets: [
    'ptr.png',
    'mar.png',
    'vit.png',
    'banach-1wszyi-planFIN-1.png',
    'tworzenie-strony-konsulting.jpg',
    'tworzenie-strony-finanse.jpg',
    'projektowanie-stron-it.jpg',
    'projektowanie-strony-oko.jpg',
    'kratki.png',
    'pragma-marcin.png',
    'tekst-strony1.png',
    'tekst-strony2.png',
    'dlon-mobilna.png',
    'dlon-artefakt.png',
    'dlon-mobile-design.png',
    'kwadrat-tyl.png',
    'kwadrat-srodek.png',
    'kwadrat-przod.png',
    'tlo-strony.png',
    'tlum.png',
    'hipnotyzuj.gif',
    'przyklady-strony.png',
    'portfolios/strona-pattern1.mp4',
    'portfolios/strona-pattern2.mp4',
    'portfolios/strona-pattern3.mp4',
    'portfolios/mobile-design.mp4',
    'portfolios/phoneMaskdesign.svg',
    'portfolios/maska.svg',
    'portfolios/canvas/*.jpg',
  ],

  warmup: [],
  scrollTriggersCount: 18,
  geometryMutable: false,
  geometryRefresh: 'none' as const,
  dciProps: [],
  timelineContract: undefined,

  integrationNotes: {
    hasPin: false,
    hasSnap: false,
    affectsGeometryBelow: false,
    sensitiveTo: [],
  },

  export: {
    mode: 'default',
    name: 'CaseStudiesSection',
  },

  perf: {
    dynamicImport: false,
    clientOnly: false,
    isHero: false,
    gracefulDegradation: false,
    preloadCandidates: [],
    prefetchCandidates: [],
    coldCandidates: [],
    preconnectDomains: [],
    containApplied: false,
    warnings: [] as string[],
  },
};
