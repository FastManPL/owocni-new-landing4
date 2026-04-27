'use client';

import dynamic from 'next/dynamic';
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Script from 'next/script';
import imgTlo from './TLO-Monitor.jpg';
import imgMonitor from './Monitor1.webp';
import './wyniki-section.css';
import { CENNIK_STRONY_URL } from '@/config/ctaUrls';

/** Ten sam media-id co sekcja „wzrost przychodów" (hero2) — demo w Wistii zamiast MP4 w popupie. */
const WISTIA_MEDIA_ID = 'kmqidz4bso';

/**
 * Faza 2.B — Split B1.1 (SSR markup + client engine sidecar).
 *
 * Cel: zdjąć ~430 LoC ciężkiego init() (GSAP ScrollTrigger + cursor particles
 * + play button SVG + popup logic + video WARM gating + factory IO) z initial
 * hydracji. Markup (h2, p, CTA, image, video mockup, popup) pozostaje SSR'owany
 * przez ten wrapper → pełny SEO (`34–45% więcej przychodów`, `Otrzymaj 3
 * propozycje cenowe`, CTA → /cennik, disclaimer o budżecie klientów).
 *
 * Architektura:
 *  - Ten plik jest Client Component (`'use client'`) z SSR ON (bez ssr:false
 *    na wrapperze). Zarządza:
 *      • React state (popupOpen, wistiaActivated, allowInlineAutoplay)
 *      • useEffect dla reduced-motion + Wistia player.play()
 *      • Conditional render `<wistia-player>` (dopiero po `wistiaActivated`)
 *      • Pełen SEO-critical markup <section#wyniki-section>
 *  - `WynikiEngine` (ssr:false, dynamic) dociąga się jako osobny chunk, robi
 *    wyłącznie DOM-manipulation w `rootRef.current`. Engine renderuje null
 *    (nie emituje markupu), więc `ssr:false` nic nie traci SEO-wise.
 *  - Engine ↔ wrapper komunikują się przez callbacki onPopupOpen/onPopupClose
 *    (kliknięcie CTA/play button → engine → callback → React setState →
 *    popupOpen:true → render Wistia).
 *
 * Warmup: `homeRouteChunkWarmup.ts` prefetchuje `WynikiEngine` policy `immediate`
 * (sekcja jest tuż po Hero — user scrolluje w <100ms, idle byłoby za późne).
 */
const WynikiEngine = dynamic(
  () =>
    import('./WynikiEngine').then((m) => ({ default: m.WynikiEngine })),
  { ssr: false, loading: () => null },
);

export function WynikiSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [wistiaActivated, setWistiaActivated] = useState(false);
  const [allowInlineAutoplay, setAllowInlineAutoplay] = useState(true);

  const handlePopupOpen = useCallback(() => {
    setPopupOpen(true);
    setWistiaActivated(true);
  }, []);

  const handlePopupClose = useCallback(() => {
    setPopupOpen(false);
    const host = rootRef.current?.querySelector('wistia-player') as
      | (HTMLElement & { pause?: () => Promise<unknown> | void })
      | null;
    if (host && typeof host.pause === 'function') {
      try {
        void host.pause();
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const apply = () => {
      // Tylko reduced-motion wyłącza autoplay. Mobile: muted + playsInline — zgodne z polityką autoplay iOS/Android.
      setAllowInlineAutoplay(!mqReduced.matches);
    };
    apply();

    const onChange = () => apply();
    mqReduced.addEventListener?.('change', onChange);
    return () => {
      mqReduced.removeEventListener?.('change', onChange);
    };
  }, []);

  useEffect(() => {
    if (!wistiaActivated || !popupOpen) return;
    let cancelled = false;
    const playWhenReady = () => {
      if (cancelled) return;
      const root = rootRef.current;
      const host = root?.querySelector('wistia-player') as
        | (HTMLElement & { play?: () => Promise<unknown> })
        | null;
      if (host && typeof host.play === 'function') {
        host.play().catch(() => {});
      }
    };
    customElements
      .whenDefined('wistia-player')
      .then(() => {
        requestAnimationFrame(playWhenReady);
        window.setTimeout(playWhenReady, 220);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wistiaActivated, popupOpen]);

  return (
    <section
      id="wyniki-section"
      ref={rootRef}
      className={popupOpen ? 'is-popup-open' : undefined}
    >
      <WynikiEngine
        rootRef={rootRef}
        onPopupOpen={handlePopupOpen}
        onPopupClose={handlePopupClose}
      />
      <div className="wyniki-card">
        <div className="wyniki-content">
          <div className="wyniki-left">
            <h2 className="wyniki-heading" id="wyniki-heading">
              W zasięgu ręki masz
              <br />
              już <strong>34–45% więcej</strong>
              <br />
              przychodów
            </h2>

            <div className="wyniki-spacer wyniki-spacer--top" aria-hidden="true" />

            <p className="wyniki-sub" id="wyniki-sub">
              Czas je odzyskać
            </p>

            <div className="wyniki-spacer wyniki-spacer--mid" aria-hidden="true" />

            <div className="wyniki-btn-wrapper-wave">
              <a href="#" className="wyniki-cta" id="wyniki-cta">
                <span className="wyniki-btn-hole" />
                <span className="wyniki-btn-cap" />
                <span className="wyniki-btn-text" data-text="Zobacz demo">
                  Zobacz demo
                </span>
              </a>
              <div className="wyniki-btn-static-floor" />
            </div>

            <div className="wyniki-spacer" aria-hidden="true" />

            <p className="wyniki-footnote" id="wyniki-footnote">
              Źródło danych:
              <br />
              Testy reklamowe klientów za 2025r.
              <br />
              Łączny budżet <strong>3,5 mln&nbsp;zł</strong>.
            </p>
          </div>

          <div className="wyniki-right" id="wyniki-media">
            <div className="wyniki-placeholder" id="wyniki-placeholder">
              <div className="mockup-zoom-wrapper">
                <div className="mockup-zoom-layer" id="wyniki-zoom-layer">
                  <Image
                    id="wyniki-tlo"
                    src={imgTlo}
                    alt=""
                    fill
                    className="mockup-tlo"
                    sizes="(max-width: 720px) 100vw, min(88vw, 110rem)"
                    onError={(e) => e.currentTarget.classList.add('load-failed')}
                  />
                  <Image
                    src={imgMonitor}
                    alt=""
                    fill
                    className="mockup-frame"
                    sizes="(max-width: 720px) 100vw, min(88vw, 110rem)"
                    onError={(e) => e.currentTarget.classList.add('load-failed')}
                  />
                  {/* G2/G3: WARM — preload=none, autoplay i load gated przez IO (rootMargin ~400px) w engine.
                       Browser nie zaczyna fetchu video metadata na HTML parse; start dopiero near-viewport. */}
                  <video
                    className="mockup-video"
                    src="/wyniki/Video.mp4"
                    preload="none"
                    muted
                    playsInline
                    disablePictureInPicture
                    data-autoplay={allowInlineAutoplay ? '1' : '0'}
                  />
                  <div className="mockup-video-overlay" id="wyniki-video-overlay" />
                </div>
              </div>
            </div>
            <div className="wyniki-placeholder-label" style={{ display: 'none' }}>
              ← Laptop mockup · placeholder →
            </div>
          </div>
        </div>
      </div>

      <div className="wyniki-debug" id="wyniki-debug">
        <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>wyniki-section</div>
        <div className="wyniki-debug-row">
          <span className="wyniki-debug-key">scroll</span>
          <span id="wyniki-debug-scroll">—</span>
        </div>
        <div className="wyniki-debug-row">
          <span className="wyniki-debug-key">viewport</span>
          <span id="wyniki-debug-vp">—</span>
        </div>
        <div className="wyniki-debug-row">
          <span className="wyniki-debug-key">bp</span>
          <span id="wyniki-debug-bp">—</span>
        </div>
        <div className="wyniki-debug-row">
          <span className="wyniki-debug-key">st</span>
          <span id="wyniki-debug-st">idle</span>
        </div>
      </div>

      <div id="wyniki-video-popup" className={popupOpen ? 'is-open' : undefined}>
        <div className="wp-wrapper">
          <div className="wp-close">✕</div>
          <div className="wp-panel">
            <div className="wp-video-wrap">
              {wistiaActivated && popupOpen ? (
                <>
                  <Script src="https://fast.wistia.com/player.js" strategy="lazyOnload" />
                  <Script
                    src={`https://fast.wistia.com/embed/${WISTIA_MEDIA_ID}.js`}
                    strategy="lazyOnload"
                    type="module"
                  />
                  {createElement('wistia-player', {
                    'media-id': WISTIA_MEDIA_ID,
                    seo: 'false',
                    aspect: '1.7777777777777777',
                    autoplay: 'true',
                  })}
                </>
              ) : null}
            </div>
            <div className="wp-content">
              <span className="wp-tag">Zobacz jak to działa</span>
              <h3 className="wp-title">
                <b>Otrzymaj 3 propozycje cenowe</b> na projekt dla swojej firmy.
              </h3>
              <div className="wp-buttons">
                <div className="wyniki-btn-wrapper-wave">
                  <a href={CENNIK_STRONY_URL} className="wyniki-cta" id="wyniki-popup-cta">
                    <span className="wyniki-btn-hole" />
                    <span className="wyniki-btn-cap" />
                    <span className="wyniki-btn-text" data-text="Otrzymaj wycenę teraz →">
                      Otrzymaj wycenę teraz →
                    </span>
                  </a>
                  <div className="wyniki-btn-static-floor" />
                </div>
                <button className="wp-close-text" type="button">
                  Zamknij wideo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
