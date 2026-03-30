import dynamic from 'next/dynamic';
import { HeroSection } from '@/sections/hero/HeroSection';
import { SectionsClient } from './SectionsClient';

const WzrostPrzychodowSection = dynamic(() =>
  import('@/sections/wzrost-przychodow/WzrostPrzychodowSection').then((m) => ({
    default: m.WzrostPrzychodowSection,
  }))
);
const BookStatsSection = dynamic(() =>
  import('@/sections/books/BookStatsSection').then((m) => ({ default: m.BookStatsSection }))
);
const FaktySection = dynamic(() =>
  import('@/sections/fakty/FaktySection').then((m) => ({ default: m.FaktySection }))
);
const BridgeSection = dynamic(() =>
  import('@/app/BridgeSection').then((m) => ({ default: m.BridgeSection }))
);

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
