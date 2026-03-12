import { HeroSection } from "@/sections/hero/HeroSection";
import { BookStatsSection } from "@/sections/books/BookStatsSection";
import { FaktySection } from "@/sections/fakty/FaktySection";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <BookStatsSection />
      <FaktySection />
      {/* Spacer pod sekcją Fakty — ScrollTrigger scrub potrzebuje dystansu scrollu (jak w preview: .preview-spacer 100vh). Bez tego animacja ściska się w kilka pikseli. */}
      <div style={{ minHeight: '100vh' }} aria-hidden="true" />
    </main>
  );
}
