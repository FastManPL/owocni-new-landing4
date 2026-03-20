# DEVELOPER HANDOFF — love-wall

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ TS-BUILD-GATE-01: Vercel nie jest kompilatorem TypeScript — błędy TS wykrywa dopiero na buildzie
produkcyjnym. Każdy failed deploy = stracony czas i kolejny commit tylko po to żeby
naprawić jeden błąd który tsc złapałby w 10 sekund.

⛔ Uruchom w tej kolejności — zero errors przed push:

```
npx tsc --noEmit    → PIERWSZY. Zero errors = możesz iść dalej.
npm run build       → drugi. Weryfikuje bundle, optymalizacje, static gen.
npm run lint        → trzeci. Styl i reguły ESLint.
```

## Framework prerequisites (przed wdrożeniem)

- [ ] `@/lib/scrollRuntime` istnieje i eksportuje kontrakt:
  ```ts
  getScroll(): number
  getRawScroll(): number
  requestRefresh(reason: string): void
  ```
- [ ] `globals.css` zawiera `html { font-size: 16px; }` — zamrożona baza typografii
- [ ] `@gsap/react` zainstalowany (`npm install @gsap/react`)
- [ ] Fonty Lexend + Fraunces załadowane w `layout.tsx` przez `next/font/google`
- [ ] `preconnect` do `https://i.pravatar.cc` dodany w `<head>` (avatary opinii)

## P3 zweryfikowało przed wydaniem (nie sprawdzaj ponownie)

Poniższe są gwarantowane przez STOP gates jeśli `tsc --noEmit = 0 errors`:

- `gsap.registerPlugin()` WEWNĄTRZ `useGSAP` (GSAP-SSR-01)
- `init()` sygnatura: `function loveWallInit(container: HTMLElement): { pause, resume, kill }`
- Helpery typowane: `const $ = (sel: string) => ...`
- Zero dead code (write-only vars, nieużyte importy)
- Null guardy: wszystkie `querySelector` mają `if (!el) return` lub `?.`
- `_killed` guard w `loveWallInit.kill()` — idempotencja gwarantowana
- DEV overlay usunięty (blok HTML + IIFE JS)
- FOUC guardy: `style={{ transform: 'translateY(-50%)' }}` na `#love-wall-logo-track-a` i `-b`
- `isolation: isolate` NIE jest inline w JSX — pochodzi z CSS (B-ISO-01)
- scrollRuntime podmiany: wszystkie `window.lenis.*` → `scrollRuntime.get*/requestRefresh`
- ST-REFRESH-01: `section-in-view` (one-shot IO) + `layout-settle` (1000ms setTimeout)

## Wymaga weryfikacji przez dewelopera (runtime lub wzrokowej)

- [ ] `npx tsc --noEmit` = 0 errors — uruchom sam, potwierdź
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] `love-wall.PREVIEW.html` otworzony w przeglądarce → wizualnie OK → **AKCEPTUJĘ**
- [ ] `npm run dev` → React StrictMode: konsola bez błędów po 2× mount/unmount
- [ ] Weryfikacja velocity physics z Lenis: karty toczą się z velocity boost przy szybkim scrollu
- [ ] Mobile (≤500px): expand karty, gyro tilt (iOS), swipe-to-scroll
- [ ] Scroll przez sekcję z FAQ/accordion powyżej → karty nie mają geometry drift

## Ograniczenie PREVIEW (Typ B z velocity/physics)

PREVIEW używa `scrollDelta` zamiast Lenis `__smoothedVelocity` — physics feel (momentum boost) będzie słabszy.
Pełna weryfikacja velocity: wymagane `npm run dev` + weryfikacja z Lenis aktywnym.
PREVIEW = weryfikacja layoutu / animacje wejścia / interakcje. Nie = weryfikacja physics intensity.

## Pliki do repo

```
src/sections/love-wall/LoveWallSection.tsx    ← komponent
src/sections/love-wall/love-wall-section.css  ← style
```

Import w SectionsClient (named export):
```typescript
import { LoveWallSection } from '@/sections/love-wall/LoveWallSection'
```

## Pliki NIE do repo

```
love-wall.PREVIEW.html       ← narzędzie weryfikacji wizualnej
love-wall.PREVIEW_NOTES.md   ← te notatki
DEVELOPER_HANDOFF.md         ← ten plik
```

## Status

```
P3:        DONE
PREVIEW:   czeka na AKCEPTUJĘ od właściciela
Deweloper: potwierdza 0 errors przed wdrożeniem do repo
```
