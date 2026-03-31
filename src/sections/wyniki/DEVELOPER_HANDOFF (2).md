# DEVELOPER HANDOFF — wyniki

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ TS-BUILD-GATE-01: Vercel nie jest kompilatorem TypeScript.

⛔ P3 nie wydaje DEVELOPER_HANDOFF dopóki te komendy nie przejdą z 0 errors:

```bash
npx tsc --noEmit    # PIERWSZY — łapie 90% błędów
npm run build       # drugi — bundle + static gen
npm run lint        # trzeci — ESLint
```

## Framework prerequisites
- [ ] `@/lib/scrollRuntime` istnieje i eksportuje: `getScroll()`, `getRawScroll()`, `requestRefresh(reason)`
- [ ] `globals.css` zawiera `html { font-size: 16px; }`
- [ ] `@gsap/react` zainstalowany (`useGSAP` hook)

## Pliki do repo
```
src/sections/wyniki/WynikiSection.tsx
src/sections/wyniki/wyniki-section.css
```

## Import w page/layout
```typescript
import { WynikiSection } from '@/sections/wyniki/WynikiSection';
```

## P3 zweryfikowało (nie sprawdzaj ponownie)
- gsap.registerPlugin() WEWNĄTRZ useGSAP (GSAP-SSR-01)
- init() sygnatura TS strict compliant
- Helpery typowane ($, $$, $id)
- Zero dead code
- Null guardy na querySelector
- kill() ma _killed guard (idempotent)
- isolation: isolate w CSS (nie inline JSX)

## Wymaga weryfikacji przez dewelopera
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] PREVIEW.html wizualnie identyczne z reference.html → AKCEPTUJĘ
- [ ] `npm run dev` → StrictMode: konsola bez błędów po 2× mount/unmount

## Status
Claude: DONE (czeka na AKCEPTUJĘ na PREVIEW)
Deweloper: potwierdza 0 errors przed wdrożeniem do repo
