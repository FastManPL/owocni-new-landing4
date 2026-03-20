'use client';

import dynamic from 'next/dynamic';

// Dynamic import: OnasEngine ładuje się asynchronicznie (manifest.dynamicImport: true)
// ssr: false — Three.js i WebGL wymagają środowiska przeglądarki
// Hero sekcje NIGDY nie dostają dynamic import — onas nie jest hero
const OnasEngine = dynamic(() => import('./OnasEngine'), { ssr: false });

export function OnasSection() {
  return <OnasEngine />;
}
