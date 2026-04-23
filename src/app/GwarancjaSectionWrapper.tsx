'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { useGeometryRefresh } from '@/hooks/useGeometryRefresh';
import { CENNIK_STRONY_URL } from '@/config/ctaUrls';
import '@/sections/gwarancja/gwarancja-section.css';

/**
 * Faza 1.1 — Split B1.1 (SSR markup + client engine sidecar).
 *
 * Cel: zdjąć ~2400 LoC hydracji (GSAP + lens mask + SVG tarcze + 2x video)
 * z initial hydration. SEO-critical markup (h1 "Wyższa konwersja...", CTA
 * "Otrzymaj wycenę teraz" → /cennik, disclaimer A/B) zostaje SSR'owany przez
 * ten wrapper i jest widoczny dla wszystkich crawlerów (nie tylko Googlebot).
 *
 * Architektura:
 *  - Wrapper (SSR + 'use client' dla useGeometryRefresh + sectionRef) renderuje:
 *      <section#gwarancja-section>
 *        <div.lens-scene>
 *          <div#gwarancja-container>
 *            <GwarancjaEngine rootRef={sectionRef} />   ← ssr:false, chunk dociąga się na idle
 *          </div>
 *          <div.lens-content-group>                      ← SSR, widoczne dla crawlera
 *            pill + h1 + p + p + CTA                     ← treść SEO
 *          </div>
 *        </div>
 *      </section>
 *  - Engine używa `rootRef` (section) jako scope useGSAP i jako argument init();
 *    wszystkie `container.querySelector` w init() dalej działają — scope=section
 *    obejmuje i engine-DOM (#gwarancja-container) i SSR-markup (.lens-content-group).
 *
 * CLS: `#gwarancja-container` ma w CSS `aspect-ratio: 16/9` — rezerwuje wysokość
 * nawet gdy engine jeszcze nie zamountował. Zero CLS przy hydracji.
 *
 * Warmup: `homeRouteChunkWarmup.ts` prefetchuje bezpośrednio chunk `GwarancjaEngine`
 * na `idle` (po splicie wrapper trafia do initial bundle jako część route-level JS,
 * a ciężki engine dociąga się w tle przed scrollem do sekcji → zero black-frame).
 */
const GwarancjaEngine = dynamic(
  () =>
    import('@/sections/gwarancja/GwarancjaEngine').then((m) => ({
      default: m.GwarancjaEngine,
    })),
  {
    ssr: false,
    loading: () => null,
  }
);

/* eslint-disable @next/next/no-img-element */
export function GwarancjaSectionWrapper() {
  useGeometryRefresh('gwarancja-section');
  const sectionRef = useRef<HTMLElement | null>(null);

  return (
    <section id="gwarancja-section" className="lens-section" ref={sectionRef}>
      <div className="lens-scene">
        <div id="gwarancja-container">
          <GwarancjaEngine rootRef={sectionRef} />
        </div>

        {/*
          SEO markup (SSR'd, static). NIE przenosić do engine — engine jest ssr:false.
          CTA `.cta-button`, `.btn-wrapper-wave` są querySelector'owane przez
          `init()` engine-u przez rootRef (section jest wspólnym scope).
        */}
        <div className="lens-content-group">
          <div className="lens-pill-wrapper">
            <div className="lens-pill-glow" aria-hidden="true"></div>
            <div className="lens-pill-conic" aria-hidden="true"></div>
            <span className="lens-pill">
              <span className="lens-pill-badge">100%</span>
              <span className="lens-pill-txt">
                Jedyna taka gwarancja w Polsce
              </span>
            </span>
          </div>
          <h1 className="lens-hero-title">
            Wyższa konwersja strony
            <br />w 90 dni* albo pełny
            <br />
            <b>zwrot pieniędzy!</b>
          </h1>
          <p className="lens-hero-desc">
            Zwrot na konto w ciągu
            <br className="lens-br-sm" /> 5 dni roboczych.
          </p>
          <p className="lens-hero-disclaimer">
            *Gwarancja opiera się na teście A/B i wymaga właściwej liczby
            zdarzeń na stronie klienta, niezbędnej do uzyskania wiarygodności
            statystycznej.
          </p>
          <div className="cta-group">
            <div className="cta-logos cta-logos--partner-side">
              <img
                src="/assets/Partner-Logo-left.svg"
                alt=""
                decoding="async"
              />
            </div>
            <div className="cta-center">
              <div className="btn-wrapper-wave">
                <a href={CENNIK_STRONY_URL} className="cta-button">
                  <span className="btn-hole"></span>
                  <span className="btn-cap"></span>
                  <span className="btn-text" data-text="Otrzymaj wycenę teraz">
                    Otrzymaj wycenę teraz
                  </span>
                </a>
                <div className="btn-static-floor"></div>
              </div>
              <div className="cta-logos-below cta-logos-below--partner">
                <img
                  src="/assets/Partner-Logo-left.svg"
                  alt=""
                  decoding="async"
                />
                <img
                  src="/assets/Partner-Logo-right.svg"
                  alt=""
                  decoding="async"
                />
              </div>
            </div>
            <div className="cta-logos cta-logos--partner-side">
              <img
                src="/assets/Partner-Logo-right.svg"
                alt=""
                decoding="async"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
