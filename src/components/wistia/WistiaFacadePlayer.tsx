'use client';

import Script from 'next/script';
import { createElement, useCallback, useEffect, useRef, useState } from 'react';

export type WistiaFacadePlayerProps = {
  active: boolean;
  mediaId: string;
  seo?: string;
  aspect?: string;
  autoplay?: string;
};

/**
 * PROMPT 8 / krok 5 — fasada: `player.js` + moduł embed (`lazyOnload`), dopiero po obu `onLoad`
 * montujemy `<wistia-player>`, żeby nie nakładać upgrade custom elementu na ten sam tick co init skryptów.
 */
export function WistiaFacadePlayer({
  active,
  mediaId,
  seo = 'false',
  aspect = '1.7777777777777777',
  autoplay = 'true',
}: WistiaFacadePlayerProps) {
  const loadedRef = useRef({ player: false, embed: false });
  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => {
    if (!active) {
      loadedRef.current = { player: false, embed: false };
      setShowPlayer(false);
      return;
    }
    loadedRef.current = { player: false, embed: false };
    setShowPlayer(false);
  }, [active]);

  const bump = useCallback(() => {
    const L = loadedRef.current;
    if (L.player && L.embed) setShowPlayer(true);
  }, []);

  const onPlayerJsLoad = useCallback(() => {
    loadedRef.current.player = true;
    bump();
  }, [bump]);

  const onEmbedLoad = useCallback(() => {
    loadedRef.current.embed = true;
    bump();
  }, [bump]);

  if (!active) return null;

  return (
    <>
      <Script
        src="https://fast.wistia.com/player.js"
        strategy="lazyOnload"
        onLoad={onPlayerJsLoad}
      />
      <Script
        src={`https://fast.wistia.com/embed/${mediaId}.js`}
        strategy="lazyOnload"
        type="module"
        onLoad={onEmbedLoad}
      />
      {showPlayer
        ? createElement('wistia-player', {
            'media-id': mediaId,
            seo,
            aspect,
            autoplay,
          })
        : null}
    </>
  );
}
