# DEVELOPER HANDOFF — book-stats

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
- [ ] `@/lib/scrollRuntime` istnieje i eksportuje kontrakt:
    `getScroll(): number`
    `getRawScroll(): number`
    `requestRefresh(reason: string): void`
    Bez tego każda sekcja z P3 padnie na build lub będzie działać inaczej niż PREVIEW/harness.
- [ ] `globals.css` zawiera `html { font-size: 16px; }` — zamrożona baza typografii.
    PREVIEW generowany przez P3 używa tej samej wartości.
    Sekcje z rem (np. onas-section) działają poprawnie bez konwersji Plan C.

## P3 zweryfikowało przed wydaniem (nie sprawdzaj ponownie — zaufaj STOP gates)
Poniższe zostały zweryfikowane przez P3 jako STOP gates. Jeśli tsc --noEmit = 0 errors, są gwarantowane:
- gsap.registerPlugin() WEWNĄTRZ useGSAP (GSAP-SSR-01)
- init() sygnatura: `function init(container: HTMLElement): { kill: () => void; pause: () => void; resume: () => void }`
- Helpery typowane: `const $ = (sel: string) => ...`
- Zero dead code (DEBUG_MODE i getScroll usunięte — write-only/unused w init())
- Null guardy: querySelector/array z optional chain lub guard przed użyciem
- Null guard TYLKO w call-site — nie wewnątrz init() (kontrakt: container jest zawsze non-null gdy P3 używa wzorca `if (!el) return; const inst = init(el)`)
- isolation: isolate NIE jest inline w JSX (pochodzi z CSS: B-ISO-01)
- kill() ma guard idempotencji (_killed flag) — P3-CLEAN-01
- pause()/resume() mają _killed guard — no-op po kill()

## Wymaga weryfikacji przez dewelopera (runtime lub wzrokowej)
- [ ] `npx tsc --noEmit` = 0 errors — uruchom sam, potwierdź
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] PREVIEW.html otworzony w przeglądarce → wizualnie identyczne z reference.html → AKCEPTUJĘ
- [ ] `npm run dev` → React StrictMode: konsola bez błędów po 2× mount/unmount (podwójne init/cleanup)
- [ ] GSAP 3.12.7 smoke test: pin sekcja — przewiń przez pin — brak skoku, brak orphan ST
- [ ] Conditional unmount (tylko jeśli sekcja może być warunkowo usuwana z DOM):
    Po usunięciu sekcji z DOM → ScrollTrigger sąsiednich sekcji nie ma rozjechanej geometrii.

## Ograniczenie PREVIEW
PREVIEW używa window.scrollY zamiast Lenis — ale sekcja nie zależy od velocity/physics
(canvas TYLKO w ST.onUpdate z scrub = ST-native gating, Ścieżka 3a).
PREVIEW jest pełną weryfikacją layout + animacji + interakcji.

## Sentry element — zmiana pozycji
W vanilla reference.html sentry (`#book-stats-sentry`) był POZA `<section>`.
W React — WEWNĄTRZ `<section>` (container-scoped `$id()` wymaga tego).
rootMargin 1000px nadal zapewnia early trigger. Jeśli preload za późno → zwiększ rootMargin.

## Status
Claude: DONE (czeka na AKCEPTUJĘ na PREVIEW + 0 errors od dewelopera)
Deweloper: potwierdza 0 errors przed wdrożeniem do repo
