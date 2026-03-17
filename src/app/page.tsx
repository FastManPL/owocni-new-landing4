import { HeroSection } from "@/sections/hero/HeroSection";
import { BookStatsSection } from "@/sections/books/BookStatsSection";
import { BridgeSection } from "@/app/BridgeSection";
import { SectionsClient } from "./SectionsClient";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <BookStatsSection />
      <BridgeSection />
      <SectionsClient />
    </main>
  );
}
