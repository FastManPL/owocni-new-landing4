# DEVELOPER HANDOFF — kinetic

## Pliki do repo

```
src/sections/kinetic/KineticSection.tsx
src/sections/kinetic/kinetic-section.css
```

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ TS-BUILD-GATE-01: Vercel nie jest kompilatorem TypeScript — błędy TS wykrywa dopiero
na buildzie produkcyjnym. Każdy failed deploy = stracony czas.

⛔ Uruchom w tej kolejności (tsc jest najszybszy):

```bash
npx tsc --noEmit      # PIERWSZY — zero errors = możesz iść dalej
npm run build         # drugi — bundle, optymalizacje, static gen
npm run lint          # trzeci — ESLint
```

## Framework prerequisites (przed wdrożeniem)

- [ ] `@/lib/scrollRuntime` eksportuje kontrakt:
  ```typescript
  getScroll(): number
  getRawScroll(): number
  requestRefresh(reason: string): void
  ```
- [ ] `@gsap/react` zainstalowane (`npm install @gsap/react`)
- [ ] `globals.css` zawiera `html { font-size: 16px; }`
- [ ] Lexend font w `layout.tsx` przez `next/font/google`

## P3 zweryfikowało (gwarantowane przez STOP gates)

Jeśli `npx tsc --noEmit` = 0 errors, poniższe są gwarantowane:

- `gsap.registerPlugin()` WEWNĄTRZ `useGSAP` (GSAP-SSR-01)
- `init()` sygnatura: `function init(container: HTMLElement): { kill: () => void; pause: () => void; resume: () => void }`
- Helpery typowane: `const $ = (sel: string) => ...`
- Zero dead code: palette3 usunięta, DEBUG_MODE usunięty
- `getScroll()` → `scrollRuntime.getScroll()`
- Null guardy obecne (querySelector, entries[0]?.isIntersecting)
- `_killed` flag w `kill()` — idempotencja gwarantowana
- DEV overlay usunięty
- `isolation: isolate` w CSS, nie w JSX inline
- `export default function KineticSection` (manifest.export.mode: 'default')

## Wymaga weryfikacji przez dewelopera

- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] `kinetic.PREVIEW.html` otworzony w przeglądarce → wizualnie identyczny z reference.html → **AKCEPTUJĘ**
- [ ] `npm run dev` → React StrictMode: konsola bez błędów po 2× mount/unmount
- [ ] GSAP 3.12.7 smoke test: przewiń przez pin — brak skoku, brak orphan ST w DOM
- [ ] Conditional unmount (jeśli sekcja może być warunkowo usuwana z DOM):
  ```tsx
  useEffect(() => {
    return () => {
      scrollRuntime.requestRefresh('section-unmounted');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollRuntime.requestRefresh('section-unmounted-settle');
        });
      });
    };
  }, []);
  ```

## Ograniczenia PREVIEW (Typ B)

PREVIEW używa Lenis przez CDN — snap machine powinien działać.
Pełna weryfikacja velocity/physics: `npm run dev` z Lenis z NPM.

## Import do użycia w pages/layouts

```typescript
// manifest.export.mode: 'default'
import KineticSection from '@/sections/kinetic/KineticSection';
```

## Notatki sekcji

- **Pin spacer**: sekcja tworzy pin-spacer (~6000px). Triggery sekcji poniżej mogą wymagać
  `scrollRuntime.requestRefresh()` po mount tej sekcji.
- **Snap machine**: używa `window.lenis?.scrollTo()` bezpośrednio — zależność od Lenis
  jako `window.lenis`. Upewnij się że scrollRuntime inicjalizuje Lenis przed mountem sekcji.
- **6 canvas tickerów**: intencjonalne (każdy ma dirty check + 30fps gate przez `_sectionTickOk`).
- **CPU gating**: IO pause/resume aktywny — canvasy zatrzymują się gdy sekcja poza viewport.
- **PERF-W7**: Polskie znaki + Lexend — weryfikacja latin-ext: testy PASS w stack.html.

## Status

```
P3: DONE
Deweloper: potwierdza 0 errors przed wdrożeniem do repo
```
