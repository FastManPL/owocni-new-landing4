# DEVELOPER HANDOFF — gwarancja

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ TS-BUILD-GATE-01: Vercel nie jest kompilatorem TypeScript — błędy TS wykrywa dopiero na buildzie
produkcyjnym. Każdy failed deploy = stracony czas i kolejny commit tylko po to żeby
naprawić jeden błąd który tsc złapałby w 10 sekund.

⛔ P3 nie wydaje DEVELOPER_HANDOFF dopóki te komendy nie przejdą lokalnie z wynikiem 0 errors:

```
npx tsc --noEmit  → PIERWSZY. Zero errors = możesz iść dalej.
                    Jakikolwiek error = stop, napraw, dopiero push.
npm run build     → drugi. Weryfikuje bundle, optymalizacje, static gen.
npm run lint      → trzeci. Styl i reguły ESLint.
```

Kolejność nieprzypadkowa: tsc jest najszybszy i łapie 90% błędów które rozbiją build na Vercel.

## Linia importu (gotowa do użycia)

```typescript
import { GwarancjaSection } from '@/sections/gwarancja/GwarancjaSection'  // named export
```

## Framework prerequisites (przed wdrożeniem pierwszej sekcji)
- [ ] `@gsap/react` zainstalowane (`npm i @gsap/react`)
- [ ] `globals.css` zawiera `html { font-size: 16px; }` — zamrożona baza typografii.
      PREVIEW generowany przez P3 używa tej samej wartości.
      Sekcje z rem (np. onas-section) działają poprawnie bez konwersji Plan C.

## P3 zweryfikowało przed wydaniem (nie sprawdzaj ponownie — zaufaj STOP gates)
- gsap.registerPlugin() WEWNĄTRZ useGSAP (GSAP-SSR-01)
- init() sygnatura: `function init(container: HTMLElement): { kill: () => void; pause: () => void; resume: () => void }`
- Helpery typowane: `const $ = (sel: string) => ...`
- Zero dead code (write-only vars, nieużyte funkcje, nieużyte importy)
- Null guardy: querySelector z optional chain lub guard przed użyciem
- Null guard TYLKO w call-site — nie wewnątrz init() (kontrakt: container jest zawsze non-null)
- isolation: isolate NIE jest inline w JSX (pochodzi z CSS: B-ISO-01)
- kill() idempotencja przez .length=0 pattern na tablicach

## Wymaga weryfikacji przez dewelopera (runtime lub wzrokowej)
- [ ] `npx tsc --noEmit` = 0 errors — uruchom sam, potwierdź
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] PREVIEW.html otworzony w przeglądarce → wizualnie identyczne z reference.html → AKCEPTUJĘ
- [ ] `npm run dev` → React StrictMode: konsola bez błędów po 2× mount/unmount
- [ ] Audio Zegar.mp3 dostępny w ścieżce (sekcja go ładuje jako `new Audio('Zegar.mp3')`)

## Ograniczenie PREVIEW (Typ B — rAF-based, bez velocity/physics)
PREVIEW nie używa Lenis — physics feel jest identyczny (sekcja nie ma velocity loop).
Sekcja jest mousemove-driven, nie scroll-driven. PREVIEW jest w pełni reprezentatywny.

## Nota: scrollRuntime
Sekcja NIE używa scrollRuntime (scrollTriggersCount: 0, brak requestRefresh).
gsap.registerPlugin(ScrollTrigger) jest wywoływany wewnątrz init() — wymagany przez
production harness, ale sekcja sama nie tworzy żadnych ST instances.

## Nota: base64 img src
Aktualnie `<img>` używają base64 placeholderów. Docelowe src (video) do uzupełnienia.
Przy podmianie na `<video>`: uzupełnić `preloadCandidates` i `warmup` w manifeście.

## Status
Claude: DONE (AKCEPTUJĘ na PREVIEW oczekiwane)
Deweloper: potwierdza 0 errors przed wdrożeniem do repo
