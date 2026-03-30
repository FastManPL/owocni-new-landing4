'use client';

import { memo, type ReactNode } from 'react';
import { SmoothScrollProvider } from '@/components/SmoothScrollProvider';

/**
 * memo(..., () => true) — po pierwszym mountcie drzewo nie re-renderuje się.
 * Treść renderuje się od razu (bez DelayedContent / 2× rAF), żeby nie opóźniać LCP.
 * Jeśli w dev (Strict Mode) pojawią się błędy insertBefore przy sekcjach z mutacjami DOM,
 * wtedy rozważyć wąski workaround tylko dla problematycznego segmentu.
 */
function StableTreeInner({ children }: { children: ReactNode }) {
  return <SmoothScrollProvider>{children}</SmoothScrollProvider>;
}

export const StableTree = memo(StableTreeInner, () => true);
