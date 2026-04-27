'use client';

import Script from 'next/script';
import { getGtmLazyScriptSrc } from '@/lib/marketingPublicConfig';

/**
 * Google Tag Manager — I7: wyłącznie `next/script`, `lazyOnload` (nie `afterInteractive`).
 * Bootstrap `dataLayer` + consent default jest w `layout.tsx` (I1), przed tym loaderem.
 */
export function GtmLazy() {
  const src = getGtmLazyScriptSrc();
  if (!src) return null;

  return <Script id="gtm-loader" src={src} strategy="lazyOnload" />;
}
