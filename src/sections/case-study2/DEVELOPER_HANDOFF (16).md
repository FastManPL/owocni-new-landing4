# DEVELOPER HANDOFF — wyniki

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ TS-BUILD-GATE-01: Vercel nie jest kompilatorem TypeScript.

⛔ Uruchom w tej kolejności:

```
npx tsc --noEmit    → PIERWSZY. Zero errors = idziesz dalej.
npm run build       → drugi. Weryfikuje bundle + static gen.
npm run lint        → trzeci. Styl i reguły ESLint.
```

## Framework prerequisites (przed wdrożeniem pierwszej sekcji)
- [ ] `@/lib/scrollRuntime` istnieje i eksportuje:
      `getScroll(): number`, `getRawScroll(): number`, `requestRefresh(reason: string): void`
- [ ] `globals.css` zawiera `html { font-size: 16px; }`
- [ ] `globals.css` zawiera CSS reset (`* { margin: 0; padding: 0 }` lub equivalent)
      Sekcja ma własny scoped reset jako fallback, ale globals.css reset jest wymagany
      dla spójności z innymi sekcjami.
- [ ] `@gsap/react` zainstalowany (`npm i @gsap/react`)

## Pliki do repo
```
src/sections/wyniki/WynikiSection.tsx
src/sections/wyniki/wyniki-section.css
```

## Import w SectionsClient
```typescript
import { WynikiSection } from '@/sections/wyniki/WynikiSection';  // named export
```

## P3 zweryfikowało (nie sprawdzaj ponownie)
- gsap.registerPlugin() WEWNĄTRZ useGSAP (GSAP-SSR-01)
- init() sygnatura z return type
- Helpery typowane ($ $$ $id)
- Zero dead code
- Null guardy na querySelector
- kill() z _killed guard (idempotencja)
- isolation: isolate TYLKO w CSS (nie inline JSX)

## Wymaga weryfikacji przez dewelopera
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] PREVIEW.html → wizualnie identyczne z reference.html → AKCEPTUJĘ
- [ ] `npm run dev` → StrictMode: konsola bez błędów po 2× mount/unmount
- [ ] Responsive: 375px, 1366px, 1920px, 3440px

## Ograniczenie PREVIEW (Typ B)
PREVIEW używa window.scrollY zamiast Lenis — physics feel (cursor particles momentum) inny.
PREVIEW = weryfikacja layout / scroll animacje / interakcje. Nie = weryfikacja physics.

## Status
Claude: DONE
Deweloper: potwierdza 0 errors przed wdrożeniem do repo
