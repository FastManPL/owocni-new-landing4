# DEVELOPER HANDOFF — onas

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ TS-BUILD-GATE-01: Vercel nie jest kompilatorem TypeScript — błędy TS wykrywa dopiero na
buildzie produkcyjnym. Każdy failed deploy = stracony czas.

⛔ Uruchom PRZED push:

```bash
npx tsc --noEmit     # PIERWSZY. Zero errors = możesz iść dalej.
npm run build        # drugi. Weryfikuje bundle, optymalizacje.
npm run lint         # trzeci. Styl i reguły ESLint.
```

## Framework prerequisites (przed wdrożeniem)

- [ ] `@/lib/scrollRuntime` eksportuje kontrakt:
  ```typescript
  getScroll(): number
  getRawScroll(): number
  requestRefresh(reason: string): void
  ```
- [ ] `globals.css` zawiera `html { font-size: 16px; }` — zamrożona baza typografii
- [ ] `three` + `three/examples/jsm/*` dostępne w `node_modules`
  ```bash
  npm install three @types/three
  ```
- [ ] `imagesloaded` dostępne (lub usunięto typeof guard i sekcja działa bez niego):
  ```bash
  npm install imagesloaded @types/imagesloaded
  ```

## Architektura plików

```
src/sections/onas/
  OnasSection.tsx       ← named export, wrapper z next/dynamic
  OnasEngine.tsx        ← default export, właściwy komponent
  onas-section.css      ← identyczna kopia z P2A
```

Import w SectionsClient.tsx:
```typescript
import { OnasSection } from '@/sections/onas/OnasSection';  // named export
```

## Kluczowe decyzje P3

1. **Opcja A zaimplementowana**: `onasCapitanInit()` jest wywoływany bezpośrednio w `factoryInit()`
   po `_recreateIO()`, przez `Promise.then()` — Three.js ładuje się asynchronicznie wewnątrz funkcji.

2. **BLOCKER Safari < 16.4** (z P2B): badge 3D może być pusty na Safari < 16.4.
   Decyzja odłożona. Three.js teraz przez `await import('three')` (dynamic import) zamiast
   importmap — **omija Safari bug**. Weryfikacja na Safari 15 zalecana.

3. **`_bootCapitan` dead code**: usunięty (TS-LINT-UNUSED-01). Był wywoływany tylko z
   DEV overlay (który P3 usunął). Zastąpiony bezpośrednim wywołaniem w factoryInit.

## P3 zweryfikowało (STOP gates — nie sprawdzaj ponownie)

- gsap.registerPlugin() WEWNĄTRZ useGSAP (GSAP-SSR-01) ✅
- window.lenis → scrollRuntime ✅
- window.THREE → await import('three') ✅
- DEV overlay usunięty (FACTORY:DEV-OVERLAY blok) ✅
- _killed guard w _kill() → idempotencja ✅
- Async capitan boot z _killed check ✅
- class= → className= w JSX ✅
- playsinline → playsInline w JSX ✅
- fetchpriority → fetchPriority w JSX ✅

## Wymaga weryfikacji przez dewelopera (runtime / wzrokowa)

- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] PREVIEW.html otworzony w przeglądarce → wizualnie identyczne z reference.html → AKCEPTUJĘ
- [ ] `npm run dev` → React StrictMode: konsola bez błędów po 2× mount/unmount
- [ ] Badge 3D widoczny (Three.js lazy load może potrwać ~500ms przy pierwszym załadowaniu)
- [ ] Safari 15: badge 3D weryfikacja (dynamic import zamiast importmap)

## Ograniczenie PREVIEW (Typ B z velocity)

PREVIEW używa `window.scrollY` zamiast Lenis — physics feel (momentum, velocity) będzie inny.
Dla pełnej weryfikacji Typ B z velocity: wymagane `npm run dev` z Lenis.

## Status

P3: DONE — czeka na AKCEPTUJĘ na PREVIEW + 0 errors od dewelopera
