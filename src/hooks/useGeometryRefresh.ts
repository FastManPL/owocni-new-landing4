'use client';

import { useEffect } from 'react';
import { scrollRuntime } from '@/lib/scrollRuntime';

/**
 * B7.1: Hook dla sekcji z geometryMutable: true + geometryRefresh: "none".
 * Słucha transitionend + animationend na elementach z data-geometry.
 * Import modułowy — NIE window (C2).
 */
export function useGeometryRefresh(sectionId: string) {
  useEffect(() => {
    const sectionEl = document.getElementById(sectionId);

    if (process.env.NODE_ENV === 'development' && !sectionEl) {
      console.warn(`[useGeometryRefresh] Element #${sectionId} not found. Check id.`);
    }
    if (!sectionEl) return;

    const onGeometryEnd = (e: TransitionEvent | AnimationEvent) => {
      const target = e.target as HTMLElement;
      if (!target?.hasAttribute?.('data-geometry')) return;
      scrollRuntime?.requestRefresh?.(`geometry-${sectionId}`);
    };

    sectionEl.addEventListener('transitionend', onGeometryEnd);
    sectionEl.addEventListener('animationend', onGeometryEnd);
    return () => {
      sectionEl.removeEventListener('transitionend', onGeometryEnd);
      sectionEl.removeEventListener('animationend', onGeometryEnd);
    };
  }, [sectionId]);
}
