import type { Metadata, Viewport } from 'next';
import { Lexend, Fraunces, Poppins } from 'next/font/google';

// === CSS IMPORT ORDER (Konstytucja C7) ===
// 1. Vendor CSS first
import 'lenis/dist/lenis.css';
// 2. Own globals last (może nadpisać vendor)
import './globals.css';

import { GtmLazy } from '@/components/GtmLazy';
import { MarkerOnDemand } from '@/components/MarkerOnDemand';
import { StableTree } from '@/components/StableTree';
import {
  getGtmDnsPrefetchHref,
  getGtmHeadBootstrapScriptContent,
  getGtmNoscriptIframeSrc,
} from '@/lib/marketingPublicConfig';
import { ResourceHints } from '@/providers/ResourceHints';

// === FONTS (Konstytucja A4) ===
const lexend = Lexend({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-brand',
  adjustFontFallback: true,
  /**
   * A4 + critical path: `preload: true` — wcześniejszy start pobrania Lexend (H1 / LCP tekst).
   * Przy `latin` + `latin-ext` Next może wyemitować 2× preload; ewentualne ostrzeżenie
   * w DevTools < „nieużyty preload” jest akceptowalne vs opóźnione discovery przy preload:false.
   */
  preload: true,
});

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'optional', // Świadoma decyzja: zero CLS, fallback OK na 3G
  variable: '--font-serif',
  style: ['italic'],
  weight: ['400'],
  adjustFontFallback: true,
  /** Bez preload: nie przedłuża łańcucha krytycznego CSS→font (LCP / PSI). */
  preload: false,
});

/** Formularz cennika (@owocni/cennik-form) — preload: false, sekcja pod foldem. */
const owocniForm = Poppins({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-owocni-form',
  weight: ['400', '500', '600', '700'],
  adjustFontFallback: true,
  preload: false,
});

// === METADATA ===
export const metadata: Metadata = {
  title: {
    default: 'Tworzenie Stron Internetowych - Owocni',
    template: '%s | Owocni',
  },
  description:
    'Profesjonalne tworzenie stron internetowych dla firm. Strony WWW, które konwertują.',
  icons: {
    icon: [{ url: '/favicon/favicon.svg', type: 'image/svg+xml' }],
    apple: '/favicon/favicon.svg',
  },
  manifest: '/favicon/site.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f6f4',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gtmPrefetchOrigin = getGtmDnsPrefetchHref();
  const gtmBootstrap = getGtmHeadBootstrapScriptContent();
  const gtmNoscriptSrc = getGtmNoscriptIframeSrc();

  return (
    <html lang="pl" className={`${lexend.variable} ${fraunces.variable} ${owocniForm.variable}`}>
      <head>
        {/*
          GTM / analytics (PROMPT 8 krok 3): G7 = tylko dns-prefetch origin loadera (brak preconnect).
          Włączenie: ustaw NEXT_PUBLIC_GTM_CONTAINER_ID lub NEXT_PUBLIC_GTM_SCRIPT_URL w .env
        */}
        {gtmPrefetchOrigin ? <link rel="dns-prefetch" href={gtmPrefetchOrigin} /> : null}

        {/*
          I1: default consent + kolejka GTM muszą być przed zewnętrznym gtm.js (ładowanym przez GtmLazy, I7 lazyOnload).
        */}
        {gtmBootstrap ? (
          <script
            id="gtm-consent-bootstrap"
            dangerouslySetInnerHTML={{
              __html: gtmBootstrap,
            }}
          />
        ) : null}
      </head>
      <body className="font-brand antialiased bg-canvas">
        {gtmNoscriptSrc ? (
          <noscript>
            <iframe
              title="Google Tag Manager"
              src={gtmNoscriptSrc}
              height={0}
              width={0}
              hidden
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        ) : null}
        <ResourceHints />
        <GtmLazy />
        <MarkerOnDemand />
        <StableTree>{children}</StableTree>
      </body>
    </html>
  );
}
