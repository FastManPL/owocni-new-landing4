import dynamic from 'next/dynamic';
import { HeroSection } from '@/sections/hero/HeroSection';
import { WzrostPrzychodowSection } from '@/sections/wzrost-przychodow/WzrostPrzychodowSection';
import { BookStatsSection } from '@/sections/books/BookStatsSection';
import { FaktySection } from '@/sections/fakty/FaktySection';
import { BridgeSection } from '@/app/BridgeSection';
import { SectionsClient } from './SectionsClient';

/** Sekcje pod foldem — osobne chunki JS; SSR domyślny = ten sam HTML co wcześniej, mniejszy początkowy bundle (TBT). */
const KalkulatorSection = dynamic(() =>
  import('@/sections/kalkulator/KalkulatorSection').then((m) => ({ default: m.KalkulatorSection }))
);
const GwarancjaSectionWrapper = dynamic(() =>
  import('./GwarancjaSectionWrapper').then((m) => ({ default: m.GwarancjaSectionWrapper }))
);
const LoveWallSection = dynamic(() =>
  import('@/sections/Opinie/LoveWallSection').then((m) => ({ default: m.LoveWallSection }))
);
const CaseStudiesSection = dynamic(() =>
  import('@/sections/case-studies/CaseStudiesSection').then((m) => ({ default: m.CaseStudiesSection }))
);
const OnasSectionWrapper = dynamic(() =>
  import('./OnasSectionWrapper').then((m) => ({ default: m.OnasSectionWrapper }))
);
const CyfroweWzrostySectionWrapper = dynamic(() =>
  import('./CyfroweWzrostySectionWrapper').then((m) => ({ default: m.CyfroweWzrostySectionWrapper }))
);
const FAQSection = dynamic(() => import('@/sections/FAQ/FAQSection'));

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <WzrostPrzychodowSection />
      <BookStatsSection />
      <FaktySection />
      <BridgeSection />
      <SectionsClient />
      <KalkulatorSection />
      <GwarancjaSectionWrapper />
      <LoveWallSection />
      <CaseStudiesSection />
      <OnasSectionWrapper />
      <CyfroweWzrostySectionWrapper />
      <FAQSection />
    </main>
  );
}
