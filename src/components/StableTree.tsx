'use client';

import { memo, type ReactNode } from 'react';
import { SmoothScrollProvider } from '@/components/SmoothScrollProvider';

/**
 * Opakowuje drzewo w memo z porównaniem () => true.
 * Po pierwszym mountcie drzewo NIE re-renderuje się — sekcje (Fakty, Kinetic, Hero, Block-45)
 * mutują DOM (innerHTML, appendChild); ponowny reconcil Reacta powodował błąd insertBefore.
 * Dla statycznego landingu brak re-renderu jest akceptowalny.
 */
function StableTreeInner({ children }: { children: ReactNode }) {
  return <SmoothScrollProvider>{children}</SmoothScrollProvider>;
}

export const StableTree = memo(StableTreeInner, () => true);
