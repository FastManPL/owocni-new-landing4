import { BridgeSection } from './BridgeSection';
import { Blok45Section } from '@/sections/block-45/Blok45Section';
import { KineticSectionShell } from '@/sections/kinetic/KineticSectionShell';
import { KineticSectionClient } from '@/sections/kinetic/KineticSectionClient';

/**
 * Ta sama integracja co w głównym `page.tsx`: placeholder Fakty + slot Bridge + Blok45.
 * Silniki to1:1 kopie z `src/sections/kinetic` i `src/sections/block-45` głównego repo.
 */
export default function Page() {
  return (
    <main style={{ minHeight: 0, background: '#f7f6f4' }}>
      <section
        id="fakty-section"
        aria-label="Placeholder zamiast sekcji Fakty"
        style={{ minHeight: 'min(120vh, 1100px)' }}
      />
      <div style={{ minHeight: 'min(200vh, 1800px)' }}>
        <BridgeSection
          kineticLayer={
            <KineticSectionShell>
              <KineticSectionClient />
            </KineticSectionShell>
          }
        />
        <Blok45Section />
      </div>
    </main>
  );
}
