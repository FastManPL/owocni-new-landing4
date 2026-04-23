/**
 * Te same `import()` co `next/dynamic` na `page.tsx` — `runWarmupPolicy` (idle) z jednego
 * client boundary (`SmoothScrollProvider`), notatka arch. punkt 5.C (transfer ≠ mount).
 * Tylko dla ścieżki `/` (layout owija całą aplikację).
 *
 * KineticEngine + Blok45Section: te same moduły co `KineticSection` / `SectionsClient` —
 * idle prefetch transferu JS zanim użytkownik zdąży zescrollować (mount i tak później przez React).
 */
import type { WarmupEntry } from '@/lib/moduleLoader';

export const homeRouteChunkWarmupEntries: WarmupEntry[] = [
  // Faza 2.B split: WynikiSection jest 2. sekcją na stronie (zaraz po Hero),
  // user scrolluje do niej w <100ms → `idle` byłoby za późne. `immediate`
  // prefetchuje chunk engine-u (~430 LoC GSAP + cursor particles + play btn
  // SVG + popup + video WARM gating) ASAP po mount wrappera, dzięki czemu
  // kliknięcie CTA "Zobacz demo" / ST zoom animation działa od razu.
  { policy: 'immediate', import: () => import('@/sections/wyniki/WynikiEngine') },
  // Faza 3.2: Three.js (~600KB) — common chunk używany przez `Blok45Engine`,
  // `FinalEngine` oraz `OnasSection`. Globalny idle prefetch (zamiast lokalnego
  // `runWarmupPolicy` w `OnasSectionWrapper`, który odpalał się dopiero po mount
  // wrappera — czyli po jego własnym idle prefetch). Teraz Three.js dociąga się
  // w tle zaraz po hydracji, zanim user doscrolluje do pierwszej sekcji Three-heavy.
  { policy: 'idle', import: () => import('three') },
  { policy: 'idle', import: () => import('@/sections/kinetic/KineticEngine') },
  { policy: 'idle', import: () => import('@/sections/block-45/Blok45Section') },
  { policy: 'idle', import: () => import('@/sections/books/BookStatsSection') },
  { policy: 'idle', import: () => import('@/sections/fakty/FaktyEngine') },
  { policy: 'idle', import: () => import('@/sections/kalkulator/KalkulatorSection') },
  // Faza 1.1 split: wrapper jest lekki (SSR'd content-group). Warmup celuje
  // w chunk engine-u (`ssr: false`, ~2340 LoC + GSAP) — ten faktycznie obciąża pasmo.
  { policy: 'idle', import: () => import('@/sections/gwarancja/GwarancjaEngine') },
  { policy: 'idle', import: () => import('@/sections/Opinie/LoveWallSection') },
  { policy: 'idle', import: () => import('@/sections/case-study2/CaseStudy2Section') },
  // Faza 3.3: CaseStudies ma dwa chunki (wrapper `ssr:false` + Tiles engine).
  // Wrapper jest lekki (14 LoC) — `idle` prefetch ASAP po wszystkich bliższych.
  // Engine (heavy: tiles + GSAP + cursor interactions) — `near-viewport` gated
  // na `#case-studies-section` (skeleton wrappera MA to id — patrz `CaseStudiesSection.tsx`).
  // rootMargin 1500px = ~2 viewporty wcześniej = prefetch zanim user scrolluje do sekcji,
  // zero black-frame przy mount + oszczędność pasma dla userów, którzy nie doscrollują.
  { policy: 'idle', import: () => import('@/sections/case-studies/CaseStudiesSection') },
  {
    policy: 'near-viewport',
    observeTarget: '#case-studies-section',
    rootMargin: '1500px',
    import: () => import('@/sections/case-studies/CaseStudiesTilesEngine'),
  },
  { policy: 'idle', import: () => import('@/app/OnasSectionWrapper') },
  // Faza 1.2 split: wrapper jest lekki (SSR'd tiles + nav + stage). Warmup celuje
  // w chunk engine-u (`ssr: false`, ~1100 LoC + GSAP + ScrollToPlugin + spring
  // physics ticker) — ten faktycznie obciąża pasmo.
  { policy: 'idle', import: () => import('@/sections/cyfrowe-wzrosty/cyfrowewzrostyengine') },
  { policy: 'idle', import: () => import('@/sections/FAQ/FAQSection') },
  { policy: 'idle', import: () => import('@/sections/footer/FinalSection') },
];
