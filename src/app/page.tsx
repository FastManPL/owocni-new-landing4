import { HeroSection } from "@/sections/hero/HeroSection";
import { BookStatsSection } from "@/sections/books/BookStatsSection";
import { FaktySection } from "@/sections/fakty/FaktySection";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <BookStatsSection />
      <FaktySection />
    </main>
  );
}
