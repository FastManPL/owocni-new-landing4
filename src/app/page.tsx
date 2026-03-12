import { HeroSection } from "@/sections/hero/HeroSection";
import { BookStatsSection } from "@/sections/books/BookStatsSection";
import { FaktySection } from "@/sections/fakty/FaktySection";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <BookStatsSection />
      <FaktySection />
      {/* Tymczasowy placeholder — usunąć przy dodawaniu kolejnej sekcji */}
      <section
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        aria-hidden="true"
      >
        <span style={{ color: 'rgba(0,0,0,0.2)', fontSize: '1rem' }}>tymczasowy placeholder</span>
      </section>
    </main>
  );
}
