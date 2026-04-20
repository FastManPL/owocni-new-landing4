/**
 * Lista `import()` zgodna z `next/dynamic` w `page.tsx` (below the fold).
 * Używana wyłącznie przez `BelowFoldChunkWarmup` + `runWarmupPolicy` (H5/H6, notatka arch. punkt 5.C).
 *
 * Gdy dodajesz nową sekcję z `dynamic(...)` na home — dopisz tu ten sam moduł (`idle`),
 * żeby chunk mógł się pobrać w tle zanim `DeferredMount` zamontuje drzewo.
 * Sekcje montowane od razu na home (bez DeferredMount) nie są na liście — bez podwójnego prefetchu.
 */
import type { WarmupEntry } from '@/lib/moduleLoader';

export const homeBelowFoldWarmupEntries: WarmupEntry[] = [
  { policy: 'idle', import: () => import('@/app/GwarancjaSectionWrapper') },
  { policy: 'idle', import: () => import('@/sections/footer/FinalSection') },
];
