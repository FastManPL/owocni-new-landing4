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
  { policy: 'idle', import: () => import('@/sections/case-studies/CaseStudiesSection') },
  { policy: 'idle', import: () => import('@/app/OnasSectionWrapper') },
  // Faza 1.2 split: wrapper jest lekki (SSR'd tiles + nav + stage). Warmup celuje
  // w chunk engine-u (`ssr: false`, ~1100 LoC + GSAP + ScrollToPlugin + spring
  // physics ticker) — ten faktycznie obciąża pasmo.
  { policy: 'idle', import: () => import('@/sections/cyfrowe-wzrosty/cyfrowewzrostyengine') },
  { policy: 'idle', import: () => import('@/sections/FAQ/FAQSection') },
  { policy: 'idle', import: () => import('@/sections/footer/FinalSection') },
];
