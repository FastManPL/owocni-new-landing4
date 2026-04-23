'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import { PictureAsset } from '@/components/PictureAsset';
import '@/sections/cyfrowe-wzrosty/cyfrowe-wzrosty-section.css';

/**
 * B1.1 split (Faza 1.2, Prompt 3): wrapper renderuje statyczny markup sekcji
 * — 4× `<h3 class="tile-heading">` + `.tile-body` + ribbons + labels + videos
 * z `preload="none"` + `#cyfrowe-wzrosty-cyfrowe-label` ("4 ETAPY") — czyli
 * całe SEO dostępne w initial HTML (SSR). Ciężki engine (~1100L z GSAP,
 * ScrollToPlugin, spring physics ticker, 94× DOM create w init loop) dociąga
 * się dopiero po idle (warmup w `homeRouteChunkWarmup.ts`) albo na mount
 * komponentu — `ssr: false` gwarantuje, że parse/compile/hydrate tego chunka
 * nie wchodzi w initial hydration critical path.
 *
 * CLS: zero. Manifest deklaruje `geometryMutable: false, hasPin: false,
 * scrollTriggersCount: 0` — SSR markup jest finalnym markupem, engine tylko
 * wypełnia puste layery 3D-textu (w `#cyfrowe-wzrosty-letters-row`) i
 * hookuje handlery.
 *
 * Kontrakt z engine: `sectionRef` podawany jako prop — engine używa go
 * w `useGSAP({ scope })` i `init(rootRef.current)`.
 */

/** Assety z karuzeli benefits (landing2) — mapowanie wg briefu klienta. */
const CW_TILE_ASSETS = '/assets/cyfrowe-wzrosty-tiles';

const CyfroweWzrostyEngine = dynamic(
  () =>
    import('@/sections/cyfrowe-wzrosty/cyfrowewzrostyengine').then((m) => ({
      default: m.CyfroweWzrostyEngine,
    })),
  {
    ssr: false,
    loading: () => null,
  }
);

export function CyfroweWzrostySectionWrapper() {
  const sectionRef = useRef<HTMLElement | null>(null);

  return (
    <section
      id="cyfrowe-wzrosty-section"
      className="cyfrowe-wzrosty-section"
      ref={sectionRef}
    >
      <div id="cyfrowe-wzrosty-content">
        {/* 3D TEXT — kontener statyczny; `#cyfrowe-wzrosty-letters-row` wypełnia engine
            dynamicznie w init() (94 layer elements per WZROSTU). */}
        <div id="cyfrowe-wzrosty-stage">
          <div id="cyfrowe-wzrosty-word-container">
            <div id="cyfrowe-wzrosty-cyfrowe-label">4 ETAPY</div>
            <div id="cyfrowe-wzrosty-letters-row"></div>
          </div>
        </div>

        {/* TILES — SEO markup: 4× H3 + tile-body + ribbons + stage-labels. */}
        <div id="cyfrowe-wzrosty-tiles-wrapper">
          <div className="tiles-track" id="cyfrowe-wzrosty-track">

            <article className="tile" data-index="0">
              <span className="stage-label">Etap 01</span>
              <div className="tile-hover-ribbon">
                <span className="ribbon-number">01</span>
                <div className="ribbon-divider"></div>
                <span className="ribbon-text">Etap</span>
                <span className="ribbon-name">Prototyp</span>
              </div>
              <div className="tile-content">
                <h3 className="tile-heading"><strong>Klikalny prototyp strony</strong> gotowy w 15 dni roboczych.</h3>
                <p className="tile-body">Akceptujesz układ UX i komplet treści przed etapem designu. <strong>= zero niespodzianek.</strong></p>
              </div>
              <div className="tile-media tile-media--masked-stack" aria-hidden="true">
                <div className="tile-media-secondary tile-media-secondary--etap01">
                  <video
                    src={`${CW_TILE_ASSETS}/konwersja-strony2.mp4`}
                    muted
                    playsInline
                    preload="none"
                    data-warm-video="1"
                  />
                </div>
                <div className="tile-media-main">
                  <video
                    src={`${CW_TILE_ASSETS}/Copywriting.mp4`}
                    muted
                    playsInline
                    preload="none"
                    data-warm-video="1"
                    style={{
                      WebkitMaskImage: `url(${CW_TILE_ASSETS}/maska_carreySV.svg)`,
                      maskImage: `url(${CW_TILE_ASSETS}/maska_carreySV.svg)`,
                    }}
                  />
                </div>
              </div>
            </article>

            <article className="tile" data-index="1">
              <span className="stage-label">Etap 02</span>
              <div className="tile-hover-ribbon">
                <span className="ribbon-number">02</span>
                <div className="ribbon-divider"></div>
                <span className="ribbon-text">Etap</span>
                <span className="ribbon-name">Design</span>
              </div>
              <div className="tile-content">
                <h3 className="tile-heading"><strong>Bezkonkurencyjny design.</strong><br />— Przed upływem 21 dni.</h3>
                <p className="tile-body"><strong>Profesjonalizm Twojej firmy widoczny od pierwszego spojrzenia.</strong> — Będziesz z tego dumny na każdym spotkaniu.</p>
              </div>
              <div className="tile-media tile-media--masked-stack" aria-hidden="true">
                <div className="tile-media-secondary tile-media-secondary--etap02">
                  <video
                    src={`${CW_TILE_ASSETS}/nr1-strony2.mp4`}
                    muted
                    playsInline
                    preload="none"
                    data-warm-video="1"
                  />
                </div>
                <div className="tile-media-main">
                  <video
                    src={`${CW_TILE_ASSETS}/LogoIdentyfikacja.mp4`}
                    muted
                    playsInline
                    preload="none"
                    data-warm-video="1"
                    style={{
                      WebkitMaskImage: `url(${CW_TILE_ASSETS}/maska_dicaprioSV.svg)`,
                      maskImage: `url(${CW_TILE_ASSETS}/maska_dicaprioSV.svg)`,
                    }}
                  />
                </div>
              </div>
            </article>

            <article className="tile" data-index="2">
              <span className="stage-label">Etap 03</span>
              <div className="tile-hover-ribbon">
                <span className="ribbon-number">03</span>
                <div className="ribbon-divider"></div>
                <span className="ribbon-text">Etap</span>
                <span className="ribbon-name">Wdrożenie</span>
              </div>
              <div className="tile-content">
                <h3 className="tile-heading"><strong>Wsparcie przy starcie</strong><br />— Konsultacje i szkolenia.</h3>
                <p className="tile-body"><strong>Uruchamiamy, monitorujemy, reagujemy.</strong> Upewniamy się, że w pełni wykorzystujesz możliwości nowej strony.</p>
              </div>
              <div className="tile-media tile-media--iphone" aria-hidden="true">
                <div className="tile-media-float tile-media-float--etap03">
                  <video
                    src={`${CW_TILE_ASSETS}/optymalne-strony3.mp4`}
                    muted
                    playsInline
                    preload="none"
                    data-warm-video="1"
                  />
                </div>
                <div className="tile-media-bg">
                  <PictureAsset
                    stem={`${CW_TILE_ASSETS}/iphone`}
                    alt=""
                    width={800}
                    height={1200}
                    sizes="(max-width: 768px) 90vw, 400px"
                  />
                </div>
              </div>
            </article>

            <article className="tile" data-index="3">
              <span className="stage-label">Etap 04</span>
              <div className="tile-hover-ribbon">
                <span className="ribbon-number">04</span>
                <div className="ribbon-divider"></div>
                <span className="ribbon-text">Etap</span>
                <span className="ribbon-name">Opieka</span>
              </div>
              <div className="tile-content">
                <h3 className="tile-heading"><strong>Stała opieka</strong><br />— W opcjach nawet 24/7.</h3>
                <p className="tile-body"><strong>Pełna dostępność zespołu i szybkie zmiany, gdy ich potrzebujesz.</strong> W opcjach 24/7 dla tych, którzy nie mogą sobie pozwolić na przestój.</p>
              </div>
              <div className="tile-media tile-media--masked-stack" aria-hidden="true">
                <div className="tile-media-secondary tile-media-secondary--etap04">
                  <video
                    src={`${CW_TILE_ASSETS}/klient-strony2.mp4`}
                    muted
                    playsInline
                    preload="none"
                    data-warm-video="1"
                  />
                </div>
                <div className="tile-media-main">
                  <video
                    src={`${CW_TILE_ASSETS}/Konwersja.mp4`}
                    muted
                    playsInline
                    preload="none"
                    data-warm-video="1"
                    style={{
                      WebkitMaskImage: `url(${CW_TILE_ASSETS}/maska_ziomkiSV.svg)`,
                      maskImage: `url(${CW_TILE_ASSETS}/maska_ziomkiSV.svg)`,
                    }}
                  />
                </div>
              </div>
            </article>

          </div>
        </div>

        {/* NAVIGATION — engine podpina `click` handlery do prev/next/pagination w init(). */}
        <div className="navigation-row">
          <button className="nav-arrow nav-arrow--prev" id="cyfrowe-wzrosty-prevBtn" aria-label="Poprzedni">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div className="pagination" id="cyfrowe-wzrosty-pagination">
            <button className="pagination-dot active" data-index="0"></button>
            <button className="pagination-dot" data-index="1"></button>
            <button className="pagination-dot" data-index="2"></button>
            <button className="pagination-dot" data-index="3"></button>
          </div>
          <button className="nav-arrow nav-arrow--next" id="cyfrowe-wzrosty-nextBtn" aria-label="Następny">
            <svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"></polyline></svg>
          </button>
        </div>
      </div>

      <CyfroweWzrostyEngine rootRef={sectionRef} />
    </section>
  );
}
