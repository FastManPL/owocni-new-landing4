# DEVELOPER HANDOFF — hero

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ TS-BUILD-GATE-01: Vercel nie jest kompilatorem TypeScript.

```bash
npx tsc --noEmit   # PIERWSZY — zero errors = możesz iść dalej
npm run build       # drugi
npm run lint        # trzeci
```

## Framework prerequisites

- [ ] `@gsap/react` zainstalowany (`npm install @gsap/react`)
- [ ] `@/lib/scrollRuntime` istnieje i eksportuje:
  ```ts
  getScroll(): number
  getRawScroll(): number
  requestRefresh(reason: string): void
  ```
- [ ] `@/config/heroVariants.generated` istnieje i eksportuje `HeroVariant` type
- [ ] `globals.css` zawiera `html { font-size: 16px; }`
- [ ] `lottie-web` zainstalowany (`npm install lottie-web`)
- [ ] `/public/animations/LOGO_OWOCNI.json` obecny (konwersja z .lottie — patrz komentarz w kodzie)
- [ ] `/public/avatars/Klient1.avif` … `Klient7.avif` obecne

## Uwaga: Marquee FOUC (do wdrożenia po akceptacji)

W vanilla PREVIEW track jest pusty — `buildBrandsDOM()` wstawia loga przez JS.
W produkcji to powoduje FOUC (puste miejsce → loga pojawiają się z opóźnieniem).

**Akcja integratora (nie P3 — poza scope mechanicznej konwersji):**
1. W `HeroSection.tsx` JSX dodaj loga do `#hero-brandsMarqueeTrack` jako SSR markup
2. `buildBrandsDOM()` w init() wykryje istniejące elementy i sklonuje je dla seamless loop
3. Rezultat: loga widoczne od 0ms, animacja startuje po JS init

## Uwaga: H1/H2 jako ReactNode

```tsx
// page.tsx
import { resolveHeroVariant } from '@/config/heroVariants.generated';

export default async function Page({ searchParams }) {
  const { kw, agid } = await searchParams;
  const variant = resolveHeroVariant({ kw, agid });
  return <HeroSection variant={variant} />;
}
```

H1 wrapper w HeroSection renderuje `{variant.h1}` — ReactNode z `.br-desktop` i `<strong>`.
CSS `.br-desktop` jest w hero-section.css — działa automatycznie.

## Patch E — export contract
```
export.mode: named
export.name: HeroSection
```
Import: `import { HeroSection } from '@/sections/hero/HeroSection'`

## Patch F — window.* check
```bash
rg "window\.gsap|window\.ScrollTrigger|window\.THREE|window\.Lenis" src/sections/hero
# Oczekiwany wynik: 0 trafień
```

## Weryfikacja runtime
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] `hero.PREVIEW.html` → AKCEPTUJĘ wizualnie
- [ ] `npm run dev` → React StrictMode, konsola bez błędów
- [ ] Conditional unmount: N/A (hasPin: false, hasSnap: false)

## Status
P3: DONE (czeka na akceptację PREVIEW przez właściciela)
Deweloper: potwierdza 0 errors przed wdrożeniem do repo
