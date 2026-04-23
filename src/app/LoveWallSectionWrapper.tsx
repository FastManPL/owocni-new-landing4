'use client';

import dynamic from 'next/dynamic';
import '@/sections/Opinie/love-wall-section.css';

/**
 * Faza 2.A — wariant A (`ssr: false` + skeleton).
 *
 * Cel: zdjąć ~1767 LoC hydracji (GSAP + ScrollTrigger + kinetic typography
 * marquee + blur strategy + hardware gating + reviews runtime injection)
 * z initial load. SEO-safe: JSX `LoveWallSection` nie niesie żadnego
 * SEO-critical contentu — testimoniale są generowane runtime przez
 * `loveWallInit()` (row-mover jest pusty w SSR), a kinetic typography to
 * dekoracja animowana (słowa bez kontekstu → SEO-neutralne).
 *
 * Architektura:
 *  - RSC (`page.tsx`) renderuje <LoveWallSectionWrapper />
 *  - Wrapper jest klientem tylko po to, by obejść restrykcję Next App Router
 *    (RSC nie może używać `dynamic({ ssr: false })` bezpośrednio)
 *  - `dynamic({ ssr: false })` pomija SSR oraz hydrację → engine montuje się
 *    dopiero gdy chunk jest załadowany (warmup idle zajmuje się prefetchem)
 *  - Loading skeleton rezerwuje wysokość sekcji (`min-height` + `contain`
 *    w CSS `#love-wall-section[data-skeleton]`) → zero CLS
 *
 * CSS import w wrapperze: love-wall-section.css musi być w initial bundle,
 * żeby skeleton miał swoje `min-height` reguły (engine chunk dostarcza ten
 * sam CSS, ale skeleton jest renderowany ZANIM chunk dociąga).
 *
 * Warmup: `homeRouteChunkWarmup.ts` prefetchuje `@/sections/Opinie/LoveWallSection`
 * na idle — w momencie scrollu do sekcji chunk jest już w module cache,
 * więc mount jest natychmiastowy (brak „black frame" po skrolu do sekcji).
 */
const LoveWallSection = dynamic(
  () =>
    import('@/sections/Opinie/LoveWallSection').then((m) => ({
      default: m.LoveWallSection,
    })),
  {
    ssr: false,
    loading: () => (
      <section id="love-wall-section" data-skeleton aria-busy="true" />
    ),
  },
);

export function LoveWallSectionWrapper() {
  return <LoveWallSection />;
}
