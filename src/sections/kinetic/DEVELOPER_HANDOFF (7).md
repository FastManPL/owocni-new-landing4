# DEVELOPER HANDOFF — kinetic

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

## Framework prerequisites (przed wdrożeniem pierwszej sekcji)
- [ ] `@/lib/scrollRuntime` istnieje i eksportuje kontrakt v6.x:
    ```typescript
    getScroll(): number
    getRawScroll(): number
    requestRefresh(reason: string): void
    scrollTo(target: number, opts?: {
      duration?: number;
      easing?: (t: number) => number;
      immediate?: boolean;
      force?: boolean;
      lock?: boolean;
      onComplete?: () => void;
    }): void
    start(): void
    on(event: 'scroll', handler: (data: { scroll: number; velocity: number }) => void): void
    off(event: 'scroll', handler: (data: { scroll: number; velocity: number }) => void): void
    ```
    Bez tego sekcja kinetic padnie na build lub snap system nie będzie działać.
- [ ] `globals.css` zawiera `html { font-size: 16px; }` — zamrożona baza typografii.
    PREVIEW generowany przez P3 używa tej samej wartości.

## P3 zweryfikowało przed wydaniem (nie sprawdzaj ponownie — zaufaj STOP gates)
Poniższe zostały zweryfikowane przez P3 jako STOP gates. Jeśli tsc --noEmit = 0 errors, są gwarantowane:
- gsap.registerPlugin() WEWNĄTRZ useGSAP (GSAP-SSR-01)
- init() sygnatura: `function init(container: HTMLElement): { kill: () => void; pause: () => void; resume: () => void; _s: Record<string, unknown> }`
- Helpery typowane: `const $ = (sel: string) => ...`
- Zero dead code (usunięte w P2A: hfListeners, globalInsertionSort, sortedIndices, PALETTE chain)
- Null guardy: querySelector/array z optional chain lub guard przed użyciem (NULL-GUARD-01)
- Null guard TYLKO w call-site — nie wewnątrz init() (kontrakt: container jest zawsze non-null)
- isolation: isolate NIE jest inline w JSX (B-ISO-01: OWNER-DECISION = NIE)
- kill() ma guard idempotencji (_s._killed flag)
- Zero window.lenis/window.scrollRuntime/window.__scroll w TSX
- scrollRuntime v6.x: scrollTo/on/off/start zastąpiły window.lenis COMMAND/SUBSCRIBE API

## Wymaga weryfikacji przez dewelopera (runtime lub wzrokowej)
- [ ] `npx tsc --noEmit` = 0 errors — uruchom sam, potwierdź
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] PREVIEW.html otworzony w przeglądarce → wizualnie identyczne z reference.html → AKCEPTUJĘ
- [ ] `npm run dev` → React StrictMode: konsola bez błędów po 2× mount/unmount (podwójne init/cleanup)
- [ ] GSAP 3.12.7 smoke test — sekcja ma pin i snap:
    - Przewiń przez pin — brak skoku, brak orphan ST
    - Snap system: SNAP1 → SNAP2 → SNAP3 działają forward i backward
- [ ] Conditional unmount (hasPin && hasSnap):
    Po usunięciu sekcji z DOM → ScrollTrigger sąsiednich sekcji nie ma rozjechanej geometrii.
    Jeśli problem → dodaj w komponencie:
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

## scrollRuntime v6.x — nowy kontrakt
Ta sekcja jest PIERWSZĄ wymagającą scrollRuntime v6.x (COMMAND/SUBSCRIBE API).
Przed wdrożeniem upewnij się że:
- scrollRuntime.scrollTo() deleguje do Lenis instance (lub innej smooth scroll lib)
- scrollRuntime.start() wznawia Lenis po lock
- scrollRuntime.on('scroll', handler) rejestruje handler na Lenis scroll events
- scrollRuntime.off('scroll', handler) wyrejestruje handler
- Handler snap1 magnet (`_lenisSnap1Handler`) otrzymuje obiekt z `.scroll` i `.velocity`

## Ograniczenie PREVIEW
PREVIEW ma Lenis bezpośrednio (window.lenis). React ma scrollRuntime v6.x abstraction.
Interfejs identyczny — snap system działa tak samo. Jedyna różnica to warstwa abstrakcji.

## Performance Warnings (z P2A evidence)
- PERF-W2: 3× canvas bez HTML width/height (JS resize handlers, opacity:0 na starcie)
- PERF-W6: 5× gsap.ticker.add (celowa architektura — IIFE isolation per subsystem)
- PERF-W7: Google Fonts URL bez explicit &subset=latin-ext (auto-served, low risk)

## Status
Claude: DONE (czeka na AKCEPTUJĘ na PREVIEW + weryfikację techniczną)
Deweloper: potwierdza 0 errors przed wdrożeniem do repo
