import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { BelowFoldChunkWarmup } from '@/components/BelowFoldChunkWarmup';
import { DeferredMount } from '@/components/DeferredMount';
import { resolveHeroVariant } from '@/config/heroVariants.generated';
import { HeroSection } from '@/sections/hero/HeroSection';
import { WynikiSection } from '@/sections/wyniki/WynikiSection';
import { SectionsClient } from './SectionsClient';
import { BridgeSection } from './BridgeSection';

const BookStatsSection = dynamic(() =>
  import('@/sections/books/BookStatsSection').then((m) => ({ default: m.BookStatsSection }))
);
const FaktySection = dynamic(() =>
  import('@/sections/fakty/FaktySection').then((m) => ({ default: m.FaktySection }))
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
const CaseStudy2Section = dynamic(() =>
  import('@/sections/case-study2/CaseStudy2Section').then((m) => ({ default: m.CaseStudy2Section }))
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
  // Dokumentacja CSV / Ads: słowo kluczowe często przychodzi jako utm_term, nie jako kw.
  if (sp.kw !== undefined) out.kw = sp.kw;
  else if (sp.utm_term !== undefined) out.kw = sp.utm_term;
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
      <BelowFoldChunkWarmup />
      {/* Fakty + Kalkulator + blok średni (LoveWall→FAQ): bez DeferredMount; silniki nadal `dynamic()`. Gwarancja + Final nadal IO-defer (TBT / WebGL). */}
      <FaktySection />
      {/*
        Bridge + Blok45 w jednym slocie, bez DeferredMount: sentinel Kinetic musi być w DOM przed init Blok45
        (dwa osobne DeferredMount łamały kolejność). Wcześniejszy mount stabilizuje wejście w Kinetic (diagnoza).
      */}
      <BridgeSection />
      <SectionsClient />
      <KalkulatorSection />
      <DeferredMount minHeight="min(140vh, 1200px)">
        <GwarancjaSectionWrapper />
      </DeferredMount>
      <LoveWallSection />
      <CaseStudy2Section />
      <CaseStudiesSection />
      <OnasSectionWrapper />
      <CyfroweWzrostySectionWrapper />
      <FAQSection />
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
