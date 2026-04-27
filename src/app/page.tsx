import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { resolveHeroVariant } from '@/config/heroVariants.generated';
import { FAQJsonLd } from '@/sections/FAQ/FAQJsonLd';
import { LoveWallSeoQuotes } from '@/sections/Opinie/LoveWallSeoQuotes';
import { FaktySection } from '@/sections/fakty/FaktySection';
import { HeroSection } from '@/sections/hero/HeroSection';
import { KalkulatorSection } from '@/sections/kalkulator/KalkulatorSection';
import { WynikiSection } from '@/sections/wyniki/WynikiSection';
import { SHOW_KINETIC_SECTION } from '@/config/featureFlags';
import { DeferredMount } from '@/components/DeferredMount';
import { BookStatsSectionWrapper } from './BookStatsSectionWrapper';
import { BridgeSection } from './BridgeSection';
import { CaseStudy2SectionWrapper } from './CaseStudy2SectionWrapper';
import { KineticDisabledPlaceholder } from './KineticDisabledPlaceholder';
import { KineticHomeSlot } from './KineticHomeSlot';
import { SectionsClient } from './SectionsClient';

const GwarancjaSectionWrapper = dynamic(() =>
  import('./GwarancjaSectionWrapper').then((m) => ({ default: m.GwarancjaSectionWrapper }))
);
const LoveWallSectionWrapper = dynamic(() =>
  import('./LoveWallSectionWrapper').then((m) => ({ default: m.LoveWallSectionWrapper }))
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
import FAQSection from '@/sections/FAQ/FAQSection';
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

function isKineticQueryEnabled(sp: Record<string, string | string[] | undefined>): boolean {
  const raw = sp.kinetic;
  if (Array.isArray(raw)) return raw.includes('1');
  return raw === '1';
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
  const resolvedSearchParams = await searchParams;
  const variant = resolveHeroVariant(pickHeroParams(resolvedSearchParams));
  const showKinetic = SHOW_KINETIC_SECTION || isKineticQueryEnabled(resolvedSearchParams);

  return (
    <main>
      <HeroSection variant={variant} />
      <WynikiSection />
      <BookStatsSectionWrapper />
      {/* Cała treść home: bez DeferredMount; ciężkie silniki nadal `dynamic()` + placeholder. */}
      <FaktySection />
      {/*
        Kinetic włączony: Bridge + pinSpacer + warstwa silnika (`KineticHomeSlot`).
        Wyłączony: `KineticDisabledPlaceholder` — patrz `src/config/featureFlags.ts` → SHOW_KINETIC_SECTION.
      */}
      {showKinetic ? (
        <BridgeSection kineticLayer={<KineticHomeSlot />} />
      ) : (
        <KineticDisabledPlaceholder />
      )}
      <div className="perf-cv-auto">
        <DeferredMount minHeight="110vh" rootMargin="900px 0px 900px 0px">
          <SectionsClient />
        </DeferredMount>
      </div>
      <div className="perf-cv-auto">
        <DeferredMount minHeight="95vh">
          <KalkulatorSection />
        </DeferredMount>
      </div>
      <div className="perf-cv-auto">
        <DeferredMount minHeight="100vh">
          <GwarancjaSectionWrapper />
        </DeferredMount>
      </div>
      <div className="perf-cv-auto">
        <DeferredMount minHeight="110vh">
          <LoveWallSeoQuotes />
          <LoveWallSectionWrapper />
        </DeferredMount>
      </div>
      <div className="perf-cv-auto">
        <DeferredMount minHeight="120vh">
          <CaseStudy2SectionWrapper />
          <CaseStudiesSection />
        </DeferredMount>
      </div>
      <div className="perf-cv-auto">
        <DeferredMount minHeight="120vh">
          <OnasSectionWrapper />
          <CyfroweWzrostySectionWrapper />
        </DeferredMount>
      </div>
      <div className="perf-cv-auto">
        <DeferredMount minHeight="110vh">
          <FAQJsonLd />
          <FAQSection />
          <FinalSection />
        </DeferredMount>
      </div>
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
