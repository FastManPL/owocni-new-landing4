/**
 * hero.manifest.ts
 * Wygenerowane przez Factory P2B/P3
 * Źródło prawdy: hero.reference.html (P2A golden master)
 *
 * ⚠️ Nie edytuj ręcznie — zmiany przez Factory workflow
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetPriority = 'HOT' | 'WARM' | 'COLD';

export interface SectionAsset {
  kind:     'img' | 'video' | 'canvas' | 'other';
  src:      string;
  priority: AssetPriority;
  critical: boolean;
  lcp:      boolean;
  note?:    string;
}

export interface SectionSlot {
  id:           string;
  allowedTypes: string[];
  currentType:  string;
  aspectRatio?: string;
  note?:        string;
}

export type GeometryContract =
  | 'normal'
  | 'sealed-fullscreen'
  | 'pinned-narrative'
  | 'geometry-sensitive';

export type CpuGatingMechanism = 'IO-pause/resume' | 'IO-media' | 'N/A';

export interface HeroSectionManifest {
  slug:    string;
  type:    'A' | 'B';
  requires: string[];
  webgl:   null;
  assets:  SectionAsset[];
  warmup:  string[];
  scrollTriggersCount: number;
  geometryMutable:      boolean;
  geometryRefresh:      'self' | 'none';
  geometryContract:     GeometryContract;
  syntheticContextAllowed: boolean;
  entryExitInvariant:      boolean;
  preserveExistingGuards:  boolean;
  refreshSignals: string[];
  export: {
    mode: 'named' | 'default';
    name: string;
  };
  slots:         SectionSlot[];
  slotsCoverage: 'complete';
  dciProps:      string[];
  timelineContract: string | undefined;
  specialNotes: {
    breakpoints:          string[];
    platformGuards:       string[];
    cpuGatingMechanism:   CpuGatingMechanism;
    cpuGatingPath:        number;
    lottieFormat:         string;
    coexistingIO:         string;
  };
  integrationNotes: {
    hasPin:               boolean;
    hasSnap:              boolean;
    affectsGeometryBelow: boolean;
    sensitiveTo:          string[];
    testWith:             string[];
  };
  deliveryRisk: {
    note: string;
  };
  perf: {
    dynamicImport:       boolean;
    isHero:              boolean;
    gracefulDegradation: boolean;
    preloadCandidates:   string[];
    prefetchCandidates:  string[];
    coldCandidates:      string[];
    preconnectDomains:   string[];
    containApplied:      boolean;
    warnings:            string[];
  };
  scrollRuntimeRecommendations: string[];
  runtimeChecks: {
    'CLN-01': string;
    'SM-01':  string;
    'SM-02':  string;
    'INT-01': string;
    'INT-02': string;
    'INT-03': string;
    'INT-04': string;
    'WGL-01': string;
    'WGL-02': string;
    'WGL-03': string;
  };
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

export const SECTION_MANIFEST: HeroSectionManifest = {
  slug:  'hero',
  type:  'B',
  requires: ['scrollRuntime', 'gsap', 'lottie-web'],

  webgl: null,

  assets: [
    {
      kind:     'img',
      src:      '/avatars/Klient1–7.avif (7× placeholder — production: własny CDN)',
      priority: 'HOT',
      critical: true,
      lcp:      false,
      note:     'Klient1–Klient7. Format: avif primary. 78×78px (2× DPR). ' +
                'Pliki: /public/avatars/Klient{1-7}.avif',
    },
    {
      kind:     'other',
      src:      '/animations/LOGO_OWOCNI.json',
      priority: 'HOT',
      critical: true,
      lcp:      false,
      note:     'lottie-web@5.12.2 obsługuje tylko JSON. ' +
                'LOGO_OWOCNI.lottie (DotLottie) wymaga konwersji przed deploy. ' +
                'Konwersja: npx @lottiefiles/dotlottie-js unpack LOGO_OWOCNI.lottie',
    },
    {
      kind:     'img',
      src:      'trail-images (16× placeholder: picsum.photos — production: IMAGE_GROUPS resolver)',
      priority: 'HOT',
      critical: false,
      lcp:      false,
      note:     'JS-managed. Aktywacja po 4500ms + tylko desktop. ' +
                'fetchpriority="low" w kodzie. Podmień IMAGE_GROUPS resolver.',
    },
  ],

  warmup: [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ],

  scrollTriggersCount: 0,

  geometryMutable:         false,
  geometryRefresh:         'none',
  geometryContract:        'normal',
  syntheticContextAllowed: true,
  entryExitInvariant:      false,
  preserveExistingGuards:  true,

  refreshSignals: [],

  export: {
    mode: 'named',
    name: 'HeroSection',
  },

  slots: [
    {
      id:           'pill-avatars',
      allowedTypes: ['img'],
      currentType:  'placeholder',
      aspectRatio:  '1/1',
      note:         'Klient1–Klient7. avif primary, webp fallback opcjonalny. ' +
                    '39×39px display, 78×78px source (2× DPR). ' +
                    'P3: <img src="/avatars/KlientN.avif" />, next/image w Integratorze.',
    },
    {
      id:           'logo-lottie',
      allowedTypes: ['other'],
      currentType:  'placeholder',
      aspectRatio:  '504/196',
      note:         'Lottie JSON (/public/animations/LOGO_OWOCNI.json). ' +
                    'Wymiary kompozycji: sprawdź "w"/"h" w JSON po konwersji. ' +
                    'canvas renderer, autoplay: false, startuje w Fazie 2 (2000ms).',
    },
    {
      id:           'trail-images',
      allowedTypes: ['img'],
      currentType:  'placeholder',
      aspectRatio:  '308/241',
      note:         '16× zdjęcia (A1–D4), hover trail, desktop only (>1200px). ' +
                    'Podmień IMAGE_GROUPS resolver w init(). ' +
                    'AVIF primary, WebP fallback przez _avifSupported probe.',
    },
  ],

  slotsCoverage: 'complete',

  dciProps: ['headline'],

  timelineContract: undefined,

  specialNotes: {
    breakpoints: ['600px', '750px', '1200px', '1300px', '1450px', '1600px'],
    platformGuards: [
      'hover:hover+pointer:fine (trail, rainbow, halo — desktop only)',
      'prefers-reduced-motion (via CSS @media)',
      'matchMedia hover:hover (Logo Lottie hover, badge touch guard)',
      'CSS.supports oklch/conic (fx-premium-active gate)',
      'CSS.supports color-mix (DOWNFALL fallback)',
    ],
    cpuGatingMechanism: 'IO-pause/resume',
    cpuGatingPath:      1,
    lottieFormat:
      'Laurel: animationData inline JSON (372×556px, fr:90, op:84). ' +
      'Logo: zewnętrzny /animations/LOGO_OWOCNI.json (504×196px, lottie-web canvas). ' +
      'lottie-web@5.12.2 obsługuje tylko JSON — nie .lottie (DotLottie).',
    coexistingIO:
      '5 internal IO subsystemów (rootMargin 50–200px) < Factory IO (~450px). ' +
      'Asymetria korzystna. Koegzystencja bezpieczna: B-CPU-03 PASS + ENT-LC-06 PASS.',
  },

  integrationNotes: {
    hasPin:               false,
    hasSnap:              false,
    affectsGeometryBelow: false,
    sensitiveTo:          [],
    testWith:             ['header'],
  },

  deliveryRisk: {
    note:
      'Trail używa slot.img.src swap, ale preloadAllImages() preloaduje ' +
      'wszystkie 16 obrazów do imageTemplates Map PRZED aktywacją trail. ' +
      'Swap używa już załadowanych templatek — brak widocznego blinka. ' +
      'deliveryRisk: none.',
  },

  perf: {
    dynamicImport:       false,
    isHero:              true,
    gracefulDegradation: true,
    preloadCandidates:   ['/animations/LOGO_OWOCNI.json'],
    prefetchCandidates:  [],
    coldCandidates:      [],
    preconnectDomains:   ['fonts.googleapis.com', 'fonts.gstatic.com'],
    containApplied:      false,
    warnings: [
      'PERF-W6: ticker×3 (Trail tick, Marquee ticker, Trail ensureTicking)',
      'PERF-W7: latin-ext brak w Google Fonts CDN URL (produkcja: next/font auto-dodaje)',
      'PERF-W13: .cta-group CSS transform:scale (media queries) + brak GSAP konfliktu',
    ],
  },

  scrollRuntimeRecommendations: [
    'is-scrolling pointer-events guard: ' +
    'body.is-scrolling #hero-section .trail-container { pointer-events: none } ' +
    '(trail mousemove firing podczas momentum scroll = zbędne spawny)',
  ],

  runtimeChecks: {
    'CLN-01': 'PASS',
    'SM-01':  'PASS',
    'SM-02':  'PASS',
    'INT-01': 'N/A',
    'INT-02': 'N/A',
    'INT-03': 'N/A',
    'INT-04': 'N/A',
    'WGL-01': 'N/A',
    'WGL-02': 'N/A',
    'WGL-03': 'N/A',
  },
} as const;
