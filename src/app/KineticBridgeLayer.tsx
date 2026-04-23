'use client';

import { KineticSectionShell } from '@/sections/kinetic/KineticSectionShell';
import { KineticSectionClient } from '@/sections/kinetic/KineticSectionClient';

/** Ładowany wyłącznie gdy `SHOW_KINETIC_SECTION` w `page.tsx` — osobny chunk (dynamic, ssr: false). */
export default function KineticBridgeLayer() {
  return (
    <KineticSectionShell>
      <KineticSectionClient />
    </KineticSectionShell>
  );
}
