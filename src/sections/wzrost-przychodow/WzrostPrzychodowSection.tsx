'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { WistiaFacadePlayer } from '@/components/wistia/WistiaFacadePlayer';
import laptopPhoto from '../hero2/1.jpg';
import './wzrost-przychodow-section.css';

const WISTIA_MEDIA_ID = 'kmqidz4bso';

export function WzrostPrzychodowSection() {
  const playerSlotRef = useRef<HTMLDivElement>(null);
  const [isWistiaActivated, setIsWistiaActivated] = useState(false);

  const scrollToDemo = useCallback(() => {
    playerSlotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const activateWistia = useCallback(() => {
    setIsWistiaActivated(true);
  }, []);

  useEffect(() => {
    if (!isWistiaActivated) return;

    let cancelled = false;
    const playWhenReady = () => {
      if (cancelled) return;
      const host = playerSlotRef.current?.querySelector('wistia-player') as
        | (HTMLElement & { play?: () => Promise<unknown> })
        | null;
      if (!host || typeof host.play !== 'function') return;
      host.play().catch(() => {});
    };

    customElements
      .whenDefined('wistia-player')
      .then(() => {
        window.requestAnimationFrame(playWhenReady);
        window.setTimeout(playWhenReady, 220);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isWistiaActivated]);

  return (
    <>
      <section id="wzrost-przychodow-section" aria-labelledby="wzrost-przychodow-heading">
        <div className="wzrost-wrap">
          <div className="wzrost-card">
            <div className="wzrost-inner">
              <div className="wzrost-copy">
                <h2 id="wzrost-przychodow-heading" className="wzrost-headline">
                  W zasięgu ręki masz
                  <br />
                  już <strong>35–45% więcej</strong>
                  <br />
                  przychodów.
                </h2>
                <p className="wzrost-sub">Czas je odzyskać</p>
                <div className="wzrost-cta-wrap">
                  <button type="button" className="wzrost-cta" onClick={scrollToDemo}>
                    Zobacz demo
                  </button>
                </div>
                <p className="wzrost-footnote">
                  Dane: Testy reklamowe klientów za 2025 r. łączny budżet{' '}
                  <strong>3,5 mln zł</strong>.
                </p>
              </div>

              <div className="wzrost-visual">
                <div className="wzrost-visual__bg" aria-hidden>
                  <Image
                    src={laptopPhoto}
                    alt=""
                    fill
                    sizes="(max-width: 899px) 100vw, 55vw"
                    className="wzrost-visual__photo"
                    priority={false}
                  />
                </div>
                <div
                  id="wzrost-wistia-anchor"
                  ref={playerSlotRef}
                  className="wzrost-player-shell"
                >
                  {isWistiaActivated ? (
                    <WistiaFacadePlayer active={isWistiaActivated} mediaId={WISTIA_MEDIA_ID} autoplay="true" />
                  ) : (
                    <button
                      type="button"
                      className="play-btn wzrost-play-btn"
                      onClick={activateWistia}
                      aria-label="Odtwórz wideo"
                    >
                      <Image
                        src="/wzrost-kmqidz4bso.webp"
                        alt=""
                        fill
                        sizes="(max-width: 899px) 78vw, 36rem"
                        className="wzrost-player-poster"
                        priority={false}
                      />
                      <span className="wzrost-play-btn__icon" aria-hidden="true">
                        <svg viewBox="0 0 100 100" focusable="false">
                          <g className="wzrost-play-btn__ring">
                            {Array.from({ length: 18 }).map((_, index) => {
                              const angle = (index / 18) * Math.PI * 2 - Math.PI / 2;
                              const cx = 50 + Math.cos(angle) * 39;
                              const cy = 50 + Math.sin(angle) * 39;
                              return <circle key={index} cx={cx} cy={cy} r="2" />;
                            })}
                          </g>
                          <polygon points="40,34 67,50 40,66" />
                        </svg>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
