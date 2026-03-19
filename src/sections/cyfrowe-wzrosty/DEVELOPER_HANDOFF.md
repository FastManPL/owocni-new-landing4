# DEVELOPER HANDOFF — cyfrowe-wzrosty

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ TS-BUILD-GATE-01: Vercel nie jest kompilatorem TypeScript — błędy TS wykrywa dopiero na buildzie
produkcyjnym. Każdy failed deploy = stracony czas i kolejny commit tylko po to żeby
naprawić jeden błąd który tsc złapałby w 10 sekund.

⛔ P3 nie wydaje DEVELOPER_HANDOFF dopóki te komendy nie przejdą lokalnie z wynikiem 0 errors:

```
npx tsc --noEmit  → PIERWSZY. Zero errors = możesz iść dalej.
npm run build     → drugi. Weryfikuje bundle, optymalizacje, static gen.
npm run lint      → trzeci. Styl i reguły ESLint.
```

Kolejność nieprzypadkowa: tsc jest najszybszy i łapie 90% błędów które rozbiją build na Vercel.

## Struktura plików

```
src/sections/cyfrowe-wzrosty/
├── CyfroweWzrostySection.tsx    ← wrapper (dynamic import)
├── CyfroweWzrostyEngine.tsx     ← engine (init + React component)
└── cyfrowe-wzrosty-section.css  ← literalna kopia CSS z P2A
```

Import w SectionsClient:
```typescript
import CyfroweWzrostySection from '@/sections/cyfrowe-wzrosty/CyfroweWzrostySection'  // default export
```

## Framework prerequisites (przed wdrożeniem pierwszej sekcji)
- [ ] `@/lib/scrollRuntime` istnieje i eksportuje kontrakt:
    `getScroll(): number`
    `getRawScroll(): number`
    `requestRefresh(reason: string): void`
    `lenis: Lenis | null` (sekcja subskrybuje `lenis.on('scroll', wakeUp)`)
    Bez tego sekcja padnie na build lub będzie działać inaczej niż PREVIEW.
- [ ] `globals.css` zawiera `html { font-size: 16px; }` — zamrożona baza typografii.
- [ ] `@gsap/react` zainstalowany (`useGSAP` hook).
- [ ] `gsap` zainstalowany (npm, nie CDN).

## P3 zweryfikowało przed wydaniem (nie sprawdzaj ponownie — zaufaj STOP gates)
- gsap.registerPlugin(ScrollToPlugin) WEWNĄTRZ useGSAP (GSAP-SSR-01)
- init() sygnatura: `function init(container: HTMLElement): { pause, resume, kill }`
- Helpery typowane: `const $ = (sel: string) => ...`
- Zero dead code (DEBUG_MODE usunięty — był write-only)
- Null guardy: querySelector z optional chain lub guard, IO entries[0] z guard
- kill() ma guard idempotencji (`_killed` flag) — dodany w P3
- isolation: isolate NIE jest inline w JSX (pochodzi z CSS)
- Dynamic import: wrapper CyfroweWzrostySection → Engine z placeholder
- Double rAF refresh po mount Engine (scrollRuntime.requestRefresh)
- Eksport: `export default` — zgodne z manifest.export.mode

## Wymaga weryfikacji przez dewelopera (runtime lub wzrokowej)
- [ ] `npx tsc --noEmit` = 0 errors — uruchom sam, potwierdź
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] PREVIEW.html otworzony w przeglądarce → wizualnie identyczne z reference.html → AKCEPTUJĘ
- [ ] `npm run dev` → React StrictMode: konsola bez błędów po 2× mount/unmount
- [ ] Weryfikacja Lenis scroll subscription: ticker budzi się przy scrollu (nie tylko przy mousemove/resize)

## PERF WARNINGS (non-blocking, carry forward z P2A/P2B)
- PERF-W7:  latin-ext font subset → verify in layout.tsx next/font config (polskie znaki)
- PERF-W13: .stage-label CSS transform:scale(1.3) + GSAP fromTo scale — dual source (funkcjonalnie OK)
- INIT-CPU-01: ~94 DOM creates in init loop (WARNING, nie STOP — below-the-fold)

## Status
Claude: DONE (czeka na AKCEPTUJĘ na PREVIEW + weryfikację techniczną)
Deweloper: potwierdza 0 errors przed wdrożeniem do repo
