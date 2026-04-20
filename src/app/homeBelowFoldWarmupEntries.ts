/**
 * Lista `import()` zgodna z `next/dynamic` w `page.tsx` (below the fold).
 * Używana wyłącznie przez `BelowFoldChunkWarmup` + `runWarmupPolicy` (H5/H6, notatka arch. punkt 5.C).
 *
 * Gdy dodajesz nową sekcję z `dynamic(...)` na home — dopisz tu ten sam moduł (`idle`),
 * żeby chunk mógł się pobrać w tle zanim `DeferredMount` zamontuje drzewo.
 * Fakty nie są na liście — montują się od razu obok Bridge, bez podwójnego prefetchu.
 */
import type { WarmupEntry } from '@/lib/moduleLoader';

export const homeBelowFoldWarmupEntries: WarmupEntry[] = [
  { policy: 'idle', import: () => import('@/sections/kalkulator/KalkulatorSection') },
  { policy: 'idle', import: () => import('@/app/GwarancjaSectionWrapper') },
  { policy: 'idle', import: () => import('@/sections/Opinie/LoveWallSection') },
  { policy: 'idle', import: () => import('@/sections/case-study2/CaseStudy2Section') },
  { policy: 'idle', import: () => import('@/sections/case-studies/CaseStudiesSection') },
  { policy: 'idle', import: () => import('@/app/OnasSectionWrapper') },
  { policy: 'idle', import: () => import('@/app/CyfroweWzrostySectionWrapper') },
  { policy: 'idle', import: () => import('@/sections/FAQ/FAQSection') },
  { policy: 'idle', import: () => import('@/sections/footer/FinalSection') },
];
