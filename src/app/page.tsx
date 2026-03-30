import dynamic from 'next/dynamic';
import { DeferredMount } from '@/components/DeferredMount';
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
      {/* Od Fakty w dół: montaż dopiero blisko viewportu — mniejszy początkowy koszt JS (TBT). BookStats zostaje od razu (LCP / obraz). */}
      <DeferredMount minHeight="min(120vh, 1100px)">
        <FaktySection />
      </DeferredMount>
      <DeferredMount minHeight="min(100vh, 900px)">
        <BridgeSection />
      </DeferredMount>
      <DeferredMount minHeight="min(100vh, 900px)">
        <SectionsClient />
      </DeferredMount>
      <DeferredMount minHeight="min(110vh, 1000px)">
        <KalkulatorSection />
      </DeferredMount>
      <DeferredMount minHeight="min(140vh, 1200px)">
        <GwarancjaSectionWrapper />
      </DeferredMount>
      <DeferredMount minHeight="min(100vh, 900px)">
        <LoveWallSection />
      </DeferredMount>
      <DeferredMount minHeight="min(90vh, 800px)">
        <CaseStudiesSection />
      </DeferredMount>
      <DeferredMount minHeight="min(100vh, 900px)">
        <OnasSectionWrapper />
      </DeferredMount>
      <DeferredMount minHeight="min(110vh, 950px)">
        <CyfroweWzrostySectionWrapper />
      </DeferredMount>
      <DeferredMount minHeight="min(80vh, 700px)">
        <FAQSection />
      </DeferredMount>
    </main>
  );
}
