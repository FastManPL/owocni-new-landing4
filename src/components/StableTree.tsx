'use client';

import { memo, type ReactNode } from 'react';
import { SmoothScrollProvider } from '@/components/SmoothScrollProvider';
import { DelayedContent } from '@/components/DelayedContent';

/**
 * 1) DelayedContent — treść pojawia się po 2 rAF; drugi commit (np. Strict Mode)
 *    dzieje się na placeholderze, nie na sekcjach, więc brak konfliktu z mutacjami DOM.
 * 2) memo(..., () => true) — po pierwszym mountcie drzewo nie re-renderuje się.
 */
function StableTreeInner({ children }: { children: ReactNode }) {
  return (
    <SmoothScrollProvider>
      <DelayedContent>{children}</DelayedContent>
    </SmoothScrollProvider>
  );
}

export const StableTree = memo(StableTreeInner, () => true);
