import type { Metadata, Viewport } from 'next';
import { Lexend, Fraunces, Poppins } from 'next/font/google';

// === CSS IMPORT ORDER (Konstytucja C7) ===
// 1. Vendor CSS first
import 'lenis/dist/lenis.css';
// 2. Own globals last (może nadpisać vendor)
import './globals.css';

import { StableTree } from '@/components/StableTree';
import { ResourceHints } from '@/providers/ResourceHints';

// === FONTS (Konstytucja A4) ===
const lexend = Lexend({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-brand',
  adjustFontFallback: true,
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
  return (
    <html lang="pl" className={`${lexend.variable} ${fraunces.variable} ${owocniForm.variable}`}>
      <head>
        {/* 
          === G7: dns-prefetch dla sGTM ===
          Użyj dns-prefetch (nie preconnect!) dla skryptów marketingowych.
          Preconnect tylko dla CDN obrazków jeśli inny origin.
          
          TODO: Odkomentuj i zmień URL gdy masz sGTM:
          <link rel="dns-prefetch" href="https://your-sgtm-domain.com" />
        */}

        {/*
          === I1: Inline Default Consent ===
          MUSI być PRZED innymi skryptami (Cookiebot, GA4).
          
          TODO: Odkomentuj gdy wdrażasz consent:
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('consent', 'default', {
                  'ad_storage': 'denied',
                  'ad_user_data': 'denied',
                  'ad_personalization': 'denied',
                  'analytics_storage': 'denied',
                  'wait_for_update': 500
                });
              `,
            }}
          />
        */}
      </head>
      <body className="font-brand antialiased bg-canvas">
        <ResourceHints />
        <StableTree>{children}</StableTree>
      </body>
    </html>
  );
}
