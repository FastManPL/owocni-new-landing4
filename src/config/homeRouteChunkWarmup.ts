/**
 * Te same `import()` co `next/dynamic` na `page.tsx` — `runWarmupPolicy` (idle) z jednego
 * client boundary (`SmoothScrollProvider`), notatka arch. punkt 5.C (transfer ≠ mount).
 * Tylko dla ścieżki `/` (layout owija całą aplikację).
 */
import type { WarmupEntry } from '@/lib/moduleLoader';

export const homeRouteChunkWarmupEntries: WarmupEntry[] = [
  { policy: 'idle', import: () => import('@/sections/books/BookStatsSection') },
  { policy: 'idle', import: () => import('@/sections/fakty/FaktyEngine') },
  { policy: 'idle', import: () => import('@/sections/kalkulator/KalkulatorSectionClient') },
  { policy: 'idle', import: () => import('@/app/GwarancjaSectionWrapper') },
  { policy: 'idle', import: () => import('@/sections/Opinie/LoveWallSection') },
  { policy: 'idle', import: () => import('@/sections/case-study2/CaseStudy2Section') },
  { policy: 'idle', import: () => import('@/sections/case-studies/CaseStudiesSection') },
  { policy: 'idle', import: () => import('@/app/OnasSectionWrapper') },
  { policy: 'idle', import: () => import('@/app/CyfroweWzrostySectionWrapper') },
  { policy: 'idle', import: () => import('@/sections/FAQ/FAQSection') },
  { policy: 'idle', import: () => import('@/sections/footer/FinalSection') },
];
