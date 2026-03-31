import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { DeferredMount } from '@/components/DeferredMount';
import { resolveHeroVariant } from '@/config/heroVariants.generated';
import { HeroSection } from '@/sections/hero/HeroSection';
import { WynikiSection } from '@/sections/wyniki/WynikiSection';
import { SectionsClient } from './SectionsClient';
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
const FinalSection = dynamic(() =>
  import('@/sections/footer/FinalSection').then((m) => ({ default: m.FinalSection }))
);

function pickHeroParams(sp: Record<string, string | string[] | undefined>) {
  const out: { kw?: string | string[]; agid?: string | string[] } = {};
  if (sp.kw !== undefined) out.kw = sp.kw;
  if (sp.agid !== undefined) out.agid = sp.agid;
  return out;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const variant = resolveHeroVariant(pickHeroParams(await searchParams));

  return {
    title: variant.metaTitle,
    description: variant.metaDescription,
    openGraph: {
      title: variant.ogTitle,
      description: variant.ogDescription,
    },
  };
}

function HomePageFallback() {
  return <main className="min-h-screen bg-canvas" aria-busy="true" />;
}

async function HomePageContent({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const variant = resolveHeroVariant(pickHeroParams(await searchParams));

  return (
    <main>
      <HeroSection variant={variant} />
      <WynikiSection />
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
      <DeferredMount minHeight="min(120vh, 1100px)">
        <FinalSection />
      </DeferredMount>
    </main>
  );
}

/** Suspense: `searchParams` + cacheComponents (Next 16) — bez tego blokowany jest cały layout. */
export default function HomePage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageContent searchParams={props.searchParams} />
    </Suspense>
  );
}
