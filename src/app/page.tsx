import { HeroSection } from "@/sections/hero/HeroSection";
import { BookStatsSection } from "@/sections/books/BookStatsSection";
import { FaktySection } from "@/sections/fakty/FaktySection";
import { BridgeSection } from "@/app/BridgeSection";
import { SectionsClient } from "./SectionsClient";
import { KalkulatorSection } from "@/sections/kalkulator/KalkulatorSection";
import { GwarancjaSectionWrapper } from "./GwarancjaSectionWrapper";
import { CyfroweWzrostySectionWrapper } from "./CyfroweWzrostySectionWrapper";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <BookStatsSection />
      <FaktySection />
      <BridgeSection />
      <SectionsClient />
      <KalkulatorSection />
      <GwarancjaSectionWrapper />
      <CyfroweWzrostySectionWrapper />
    </main>
  );
}
