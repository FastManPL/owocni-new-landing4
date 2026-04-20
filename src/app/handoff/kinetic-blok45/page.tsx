import type { Metadata } from 'next';
import { BridgeSection } from '@/app/BridgeSection';
import { SectionsClient } from '@/app/SectionsClient';

export const metadata: Metadata = {
  title: 'Handoff: Kinetic + Blok 4–5',
  robots: { index: false, follow: false },
};

/**
 * Podgląd z aktualnego kodu React (nie z plików *.stack.html).
 * Odzwierciedla `page.tsx`: placeholder nad Bridge + ten sam wrapper co `DeferredMount`
 * + `<BridgeSection />` + `<SectionsClient />` (Blok45).
 *
 * Uruchom: `npm run dev` → http://localhost:3000/handoff/kinetic-blok45
 * Statyczny ZIP: `npm run preview:kinetic-blok45-html` → preview-html/kinetic-blok45-lp-react/
 */
export default function HandoffKineticBlok45Page() {
  return (
    <main className="min-h-0 bg-canvas">
      <section
        id="fakty-section"
        aria-label="Handoff — placeholder zamiast sekcji Fakty"
        className="relative bg-canvas"
        style={{ minHeight: 'min(120vh, 1100px)' }}
      />
      <div style={{ minHeight: 'min(200vh, 1800px)' }}>
        <BridgeSection />
        <SectionsClient />
      </div>
    </main>
  );
}
