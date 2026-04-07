# DEVELOPER HANDOFF — wyniki-cs-tiles

## Pliki do repo

```
src/sections/wyniki-cs-tiles/
├── WynikiCsTilesSection.tsx    (wrapper — dynamic import)
├── WynikiCsTilesEngine.tsx     (komponent z useGSAP + init)
└── wyniki-cs-tiles-section.css (CSS — literalna kopia z P2A)
```

## Komendy weryfikacyjne — uruchom LOKALNIE

```bash
npx tsc --noEmit         # → PIERWSZY. Zero errors.
npm run build            # → drugi. Bundle + static gen.
npm run lint             # → trzeci. ESLint.
```

## Framework prerequisites
- [ ] `@/lib/scrollRuntime` eksportuje: `getScroll()`, `getRawScroll()`, `requestRefresh(reason)`
- [ ] `globals.css` zawiera `html { font-size: 16px; }`
- [ ] `@gsap/react` zainstalowany (`npm i @gsap/react`)

## P3 zweryfikowało (STOP gates)
- gsap.registerPlugin() WEWNĄTRZ useGSAP (GSAP-SSR-01)
- init() sygnatura typowana (container: HTMLElement)
- kill() ma guard idempotencji (_killed flag)
- DEV overlay usunięty
- Dynamic import z double rAF refresh

## Wymaga weryfikacji przez dewelopera
- [ ] PREVIEW.html → wizualnie identyczne z reference.html → AKCEPTUJĘ
- [ ] `npm run dev` → StrictMode: konsola bez błędów po 2× mount/unmount
- [ ] Scroll przez 3 sekcje — animacje identyczne

## Ograniczenie PREVIEW
PREVIEW używa window.scrollY zamiast Lenis — physics feel (canvas flywheel momentum)
może się różnić. Pełna weryfikacja Typ B z velocity: `npm run dev` + Lenis.

## Status
Claude: DONE
Deweloper: potwierdza 0 errors przed wdrożeniem do repo
