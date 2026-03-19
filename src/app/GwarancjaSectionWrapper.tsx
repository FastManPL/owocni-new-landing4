'use client';

import { useGeometryRefresh } from '@/hooks/useGeometryRefresh';
import { GwarancjaSection } from '@/sections/gwarancja/GwarancjaSection';

/**
 * Client boundary dla sekcji gwarancja: geometryMutable + geometryRefresh: 'none'
 * (P4 — useGeometryRefresh tylko w client boundary, nigdy w page.tsx).
 */
export function GwarancjaSectionWrapper() {
  useGeometryRefresh('gwarancja-section');
  return <GwarancjaSection />;
}
