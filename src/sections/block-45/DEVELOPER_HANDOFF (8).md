# DEVELOPER HANDOFF — blok-4-5

## Pliki do repo
```
src/sections/blok-4-5/Blok45Section.tsx    ← wrapper (dynamic import)
src/sections/blok-4-5/Blok45Engine.tsx     ← engine (1340 linii)
src/sections/blok-4-5/blok-4-5-section.css
```

## Import
```typescript
import { Blok45Section } from '@/sections/blok-4-5/Blok45Section'
```

## Komendy — uruchom LOKALNIE przed każdym git push

```bash
npx tsc --noEmit   # PIERWSZY — zero errors = możesz iść dalej
npm run build      # drugi
npm run lint       # trzeci
```

## Framework prerequisites
- `@/lib/scrollRuntime` eksportuje: `getScroll(): number`, `getRawScroll(): number`, `requestRefresh(reason: string): void`
- `globals.css` zawiera `html { font-size: 16px; }`
- `@gsap/react` zainstalowane

## Key state
- slug: blok-4-5 | type: B | dynamic_import: TAK
- GSAP_PLUGINS_USED: [] (tylko ScrollTrigger)
- Three.js: lazy CDN (webpackIgnore), canvasOwnership: runtime
- fouc_inline: brak (zero gsap.from literałów w init)
- perf_warnings: PERF-W6, PERF-W7, PERF-W9, PERF-W13

## Weryfikacja po wdrożeniu
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 0 errors
- [ ] `npm run dev` → StrictMode: brak błędów po 2× mount/unmount
- [ ] Wave reveal przy scrollowaniu
- [ ] Walking "i wychodzą" startuje przy trigger
- [ ] Konwersja! button → gwiazdy Three.js
- [ ] Tab hidden → GPU idle

## Specyfika Three.js
- Ładowany przez dynamic `import()` z CDN jsdelivr (webpackIgnore)
- Wymagane połączenie sieciowe lub preload na produkcji
- Safari compat: brak import maps — pełne URL-e w loadThreeDeps()
- CSP: musi zezwalać na cdn.jsdelivr.net

## BLOCKER Safari < 16.4
Import maps NIE używane (loadThreeDeps używa pełnych URL-i) → PASS.
