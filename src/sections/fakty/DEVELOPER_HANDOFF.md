# DEVELOPER HANDOFF — fakty

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ **TS-BUILD-GATE-01**: Vercel nie jest kompilatorem TypeScript — błędy TS wykrywa dopiero na buildzie produkcyjnym. Każdy failed deploy = stracony czas.

⛔ P3 nie wydaje DEVELOPER_HANDOFF dopóki te komendy nie przejdą lokalnie z wynikiem 0 errors:

```bash
npx tsc --noEmit         # → PIERWSZY. Zero errors = możesz iść dalej.
npm run build            # → drugi. Weryfikuje bundle, optymalizacje, static gen.
npm run lint             # → trzeci. Styl i reguły ESLint.
```

Kolejność nieprzypadkowa: `tsc` jest najszybszy i łapie 90% błędów które rozbiją build na Vercel.

---

## Framework prerequisites (przed wdrożeniem pierwszej sekcji)

- [ ] `@/lib/scrollRuntime` istnieje i eksportuje kontrakt:
  - `getScroll(): number`
  - `getRawScroll(): number`
  - `requestRefresh(reason: string): void`
  
  Bez tego każda sekcja z P3 padnie na build lub będzie działać inaczej niż PREVIEW/harness.

- [ ] `globals.css` zawiera `html { font-size: 16px; }` — zamrożona baza typografii.
  PREVIEW generowany przez P3 używa tej samej wartości.

- [ ] `next/font/google` config: Lexend z subsetem `latin-ext` (PERF-W7: 'SĄ TAKIE' zawiera Ą)

---

## P3 zweryfikowało przed wydaniem (nie sprawdzaj ponownie — zaufaj STOP gates)

Poniższe zostały zweryfikowane przez P3 jako STOP gates. Jeśli `tsc --noEmit` = 0 errors, są gwarantowane:

- ✅ `gsap.registerPlugin()` WEWNĄTRZ useGSAP (GSAP-SSR-01)
- ✅ `init()` sygnatura: `function init(container: HTMLElement): { kill: () => void }`
- ✅ Helpery typowane: `const $id = (id: string) => ...`
- ✅ Zero dead code (write-only vars, nieużyte funkcje, nieużyte importy)
- ✅ Null guardy: querySelector z generics (`querySelector<HTMLElement>`) i explicit guards
- ✅ Null guard TYLKO w call-site — nie wewnątrz init() (kontrakt: container jest zawsze non-null)
- ✅ `isolation: isolate` NIE jest inline w JSX (B-ISO-01: OWNER-DECISION = NIE)
- ✅ `isKilled` flag w kill() + try/catch — idempotentność de facto
- ✅ ScrollTrigger.refresh(true) → scrollRuntime.requestRefresh('st-refresh')
- ✅ Patch I: scrollRuntime.requestRefresh('fonts-ready-settle') po fonts.ready + ST build
- ✅ C6.3: layout-settle — opóźniony requestRefresh('layout-settle') 1000 ms po ST build (timer w timerIds, cleanup w kill())
- ✅ Dynamic import: FaktySection (wrapper) + FaktyEngine (engine, default export)
- ✅ Dynamic import: useEffect double rAF refresh w FaktyEngine
- ✅ PREVIEW-PLUGIN-01: GSAP_PLUGINS_USED = [] → brak dodatkowych pluginów do rejestracji

---

## Wymaga weryfikacji przez dewelopera (runtime lub wzrokowej)

- [ ] `npx tsc --noEmit` = 0 errors — uruchom sam, potwierdź
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] PREVIEW.html otworzony w przeglądarce → wizualnie identyczne z reference.html → **AKCEPTUJĘ**
- [ ] `npm run dev` → React StrictMode: konsola bez błędów po 2× mount/unmount (podwójne init/cleanup)
- [ ] GSAP 3.12.7 smoke test: przewiń przez sekcję — animacje smooth, brak skoków
- [ ] Conditional unmount nie dotyczy (hasPin: false, hasSnap: false)

---

## Wytyczne dla fabryki (kolejne sekcje z ScrollTrigger)

Sekcje z ScrollTrigger **muszą** po zbudowaniu ST wywołać opóźniony `requestRefresh('layout-settle')` (C6.3), żeby animacja nie startowała „za wcześnie” przy długiej treści nad sekcją. Szczegóły i checklist: **`docs/SCROLL_TRIGGER_GUIDELINES.md`**.

---

## Ograniczenia PREVIEW

PREVIEW jest OGRANICZONY:
- `geometryContract: geometry-sensitive` → standalone preview-spacer nie odzwierciedla produkcyjnego stacku
- `FRAMES_BASE_PATH = 'frames/fakty-'` → placeholder, bez prawdziwych klatek (graceful degradation: solid fill #0a0a0c)
- Brak Lenis — scroll physics natywne (sekcja jest Typ A, nie Typ B — brak velocity/physics impact)
- Pełna weryfikacja wymaga `npm run dev` z prawdziwym stackiem sekcji

---

## Pliki do repo

```
src/sections/fakty/FaktySection.tsx        # wrapper — named export FaktySection
src/sections/fakty/FaktyEngine.tsx         # engine — default export (dynamic import target)
src/sections/fakty/fakty-section.css       # identyczna kopia P2A hardened CSS
```

Import w SectionsClient (lub odpowiedniku):
```typescript
import { FaktySection } from '@/sections/fakty/FaktySection';
```

---

## Pliki NIE do repo

```
fakty.PREVIEW.html
fakty.PREVIEW_NOTES.md
DEVELOPER_HANDOFF.md
```

---

## Integrator notes

1. **FRAMES_BASE_PATH**: zmień `'frames/fakty-'` w `FaktyEngine.tsx` na właściwą ścieżkę produkcyjną (np. `'/sections/fakty/frames/fakty-'`). Ten sam placeholder jest w PREVIEW.

2. **Preconnect**: po ustaleniu domeny frames, dodaj `<link rel="preconnect" href="..." />` w `<Head>` lub layout.

3. **sensitiveTo: ['geometry-above']**: jeśli sekcje powyżej fakty zmieniają wysokość po hydration (lazy images, accordiony), upewnij się że `scrollRuntime.requestRefresh()` odpala PO ustabilizowaniu document height. Sama `fonts-ready` requestRefresh (Patch I) pokrywa ten przypadek pod warunkiem że lazy assets załadowały się wcześniej.

4. **B-ISO-01**: isolation:isolate = NIE (owner decision). mix-blend-mode: screen na #organic-overlay celowo blenduje z tłem strony. Jeśli zmieni się tło — reewaluuj decyzję.

---

## Status

**Claude**: DONE (czeka na AKCEPTUJĘ na PREVIEW + weryfikację techniczną)
**Deweloper**: potwierdza 0 errors przed wdrożeniem do repo
