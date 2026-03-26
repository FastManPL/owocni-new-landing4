'use client';

import { createElement, useCallback, useRef } from 'react';
import Image from 'next/image';
import Script from 'next/script';
import laptopPhoto from '../hero2/1.jpg';
import './wzrost-przychodow-section.css';

const WISTIA_MEDIA_ID = 'kmqidz4bso';

export function WzrostPrzychodowSection() {
  const playerSlotRef = useRef<HTMLDivElement>(null);

  const scrollToDemo = useCallback(() => {
    playerSlotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <>
      <Script
        src="https://fast.wistia.com/player.js"
        strategy="lazyOnload"
      />
      <Script
        src={`https://fast.wistia.com/embed/${WISTIA_MEDIA_ID}.js`}
        strategy="lazyOnload"
        type="module"
      />

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
                  {createElement('wistia-player', {
                    'media-id': WISTIA_MEDIA_ID,
                    seo: 'false',
                    aspect: '1.7777777777777777',
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
