# DEVELOPER HANDOFF — kinetic

## Pliki do repo

```
src/sections/kinetic/KineticSection.tsx    (wrapper — dynamic import)
src/sections/kinetic/KineticEngine.tsx     (engine — init() + component)
src/sections/kinetic/kinetic-section.css
```

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ TS-BUILD-GATE-01: Vercel nie jest kompilatorem TypeScript.

⛔ Uruchom w tej kolejności:

```bash
npx tsc --noEmit      # PIERWSZY — zero errors
npm run build         # drugi
npm run lint          # trzeci
```

## Framework prerequisites (przed wdrożeniem)

- [ ] `@/lib/scrollRuntime` eksportuje: `getScroll()`, `getRawScroll()`, `requestRefresh(reason)`
- [ ] `@gsap/react` zainstalowane (`npm install @gsap/react`)
- [ ] `globals.css` zawiera `html { font-size: 16px; }`
- [ ] Lexend font w `layout.tsx` przez `next/font/google`

## P3 zweryfikowało (gwarantowane przez STOP gates)

- `gsap.registerPlugin()` WEWNĄTRZ `useGSAP` (GSAP-SSR-01)
- `init()` sygnatura z return type
- Helpery typowane: `$ = (sel: string) => ...`
- scrollRuntime.getScroll() zamiast window.lenis?.scroll
- `_killed` flag w kill() — idempotencja
- Dynamic import: `next/dynamic` + double rAF refresh po mount
- `isolation: isolate` w CSS, nie w JSX inline
- `export default function KineticEngine` (w Engine)
- `export default function KineticSection` (w wrapper)

## Wymaga weryfikacji przez dewelopera

- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] `kinetic_PREVIEW.html` otworzony w przeglądarce → wizualnie identyczny → **AKCEPTUJĘ**
- [ ] `npm run dev` → React StrictMode: konsola bez błędów
- [ ] GSAP 3.12.7 smoke test: przewiń przez pin — brak skoku

## Notatki sekcji

- **Dynamic import**: KineticSection → lazy-loads KineticEngine (next/dynamic, ssr: false)
- **Pin spacer**: sekcja tworzy pin-spacer (~6000px)
- **Snap machine**: używa `window.lenis?.scrollTo()` — zależność od Lenis jako window.lenis
- **6 canvas tickerów**: intencjonalne (dirty check + 30fps gate)
- **CPU gating**: IO pause/resume — canvasy zatrzymują się gdy sekcja poza viewport
- **Anty-autodrift**: scrub filter w pause/resume chroni pinnedTl
- **Cień Liter**: ghost clone B1 z gravity drop (Strategy A)
- **Container-relative drop**: distToExit obliczane względem kontenera (stack-proof)

## Import do użycia w pages/layouts

```typescript
import KineticSection from '@/sections/kinetic/KineticSection';
```

## Status

```
P3: DONE
Deweloper: potwierdza 0 errors przed wdrożeniem do repo
```
