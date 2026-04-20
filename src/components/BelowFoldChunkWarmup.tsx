'use client';

import { useEffect, useRef } from 'react';
import { runWarmupPolicy } from '@/lib/moduleLoader';
import { homeBelowFoldWarmupEntries } from '@/app/homeBelowFoldWarmupEntries';

/**
 * Jedno miejsce startu warmupu chunków sekcji poniżej folda (idle — po Hero / LCP).
 * Nie montuje silników — tylko transfer do cache przeglądarki przed aktywacją `DeferredMount`.
 */
export function BelowFoldChunkWarmup() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    runWarmupPolicy(homeBelowFoldWarmupEntries);
  }, []);

  return null;
}
