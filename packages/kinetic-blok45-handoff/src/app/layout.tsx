import type { Metadata } from 'next';
import { Lexend } from 'next/font/google';
import 'lenis/dist/lenis.css';
import './globals.css';
import { SmoothScrollProvider } from '@/components/SmoothScrollProvider';

const lexend = Lexend({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  adjustFontFallback: true,
  preload: true,
});

export const metadata: Metadata = {
  title: 'Handoff: Kinetic + Blok 4–5',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className={`${lexend.className} antialiased`} style={{ background: '#f7f6f4' }}>
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
