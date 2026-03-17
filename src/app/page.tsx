import { HeroSection } from "@/sections/hero/HeroSection";
import { BookStatsSection } from "@/sections/books/BookStatsSection";
import { FaktySection } from "@/sections/fakty/FaktySection";
import { KineticSection } from "@/sections/kinetic/KineticSection";
import { SectionsClient } from "./SectionsClient";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <BookStatsSection />
      <FaktySection />
      <KineticSection />
      <SectionsClient />
    </main>
  );
}
