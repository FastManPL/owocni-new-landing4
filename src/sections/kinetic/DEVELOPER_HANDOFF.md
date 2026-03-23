# DEVELOPER HANDOFF — kinetic

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ TS-BUILD-GATE-01: Vercel nie jest kompilatorem TypeScript — błędy TS wykrywa dopiero na buildzie
produkcyjnym. Każdy failed deploy = stracony czas.

⛔ Uruchom w tej kolejności (zatrzymaj się przy pierwszym błędzie):

```bash
npx tsc --noEmit     # PIERWSZY — zero errors = możesz iść dalej
npm run build        # DRUGI — weryfikuje bundle, static gen
npm run lint         # TRZECI — ESLint
```

## Pliki do repo

```
src/sections/kinetic/KineticSection.tsx
src/sections/kinetic/kinetic-section.css
```

## Framework prerequisites (przed wdrożeniem)

- [ ] `@/lib/scrollRuntime` istnieje i eksportuje kontrakt (m.in.):
  ```typescript
  getScroll(): number
  getRawScroll(): number
  requestRefresh(reason: string): void
  scrollTo(target: number, options?: Record<string, unknown>): void
  on(event: string, callback: (...args: unknown[]) => void): void
  off(event: string, callback: (...args: unknown[]) => void): void
  ```
- [ ] `globals.css` zawiera `html { font-size: 16px; }`
- [ ] `@gsap/react` zainstalowany: `npm install @gsap/react`
- [ ] `gsap` v3.12.7: `npm install gsap@3.12.7`

## Scroll — tylko `scrollRuntime` (wdrożone w LP)

W `init()` używane są **`scrollRuntime.scrollTo` / `on` / `off`** (nie `window.lenis`).
Lenis żyje wyłącznie wewnątrz `scrollRuntime`; snapy muszą iść przez ten kontrakt.

Sekcja steruje scrollem m.in. przez `scrollTo(snap, { immediate: true } as never)` (opcje zależą od Lenisa w runtime).

## Architektura — Makro-Sekcja

KineticSection jest komponentem wewnątrz Makro-Sekcji (FAKTY + KINETIC).
Wrapper wymaga dostępu do `inst._s.milestones` synchronicznie (przed pierwszym scrollem).

Wzorzec integracji z wrapperem (Bridge + pin spacer):
```typescript
const inst = init(el, { pinTriggerRef, pinSpacerRef });
// Wrapper czyta:
const milestones = inst._s.milestones;     // snap positions
// Wrapper ustawia:
inst._s._externalScrollTrigger = wrapperST; // zewnętrzny ST dla _getSnapGeometry()
// Wrapper steruje:
inst._s.activate();   // gdy sekcja w fazie KINETIC
inst._s.hibernate();  // gdy sekcja poza fazą
```
`ScrollTrigger` pin: **`trigger` = element bridge** (`#bridge-wrapper` / ref), nie sam `container` sekcji.

`dynamicImport: false` — KINETIC NIE jest lazy-loaded jako osobny komponent.
Dynamic import (jeśli stosowany) musi obejmować całą Makro-Sekcję.

## P3 zweryfikowało przed wydaniem

- ✅ `gsap.registerPlugin(ScrollTrigger)` wewnątrz `init()` wywoływanego z `useGSAP` (GSAP-SSR-01)
- ✅ `init()` sygnatura: `function init(container: HTMLElement): { kill: () => void; pause: () => void; resume: () => void }`
- ✅ Helpery typowane: `$ = (sel: string) =>`, `$$ = (sel: string) =>`, `$id = (id: string) =>`
- ✅ `getScroll()` → `scrollRuntime.getScroll()` (podmienione)
- ✅ DEV overlay usunięty (FACTORY:DEV-OVERLAY:START/END markers stripped)
- ✅ `kill()` ma `_s._killed = true` guard idempotencji
- ✅ `return { kill, pause, resume, _s }` jako ostatnia instrukcja
- ✅ `isolation: isolate` na końcu `kinetic-section.css` (B-ISO-01 / konstytucja LP)
- ✅ `dynamicImport: false` (architektura Makro-Sekcji)
- ✅ **Brak** mount-time `requestRefresh` z IO / `layout-settle` (pin/scrub — unikanie driftu na mobile toolbar)
- ✅ Null guardy: b3?.querySelector, canvas if(!canvas) return, entries[0]?.isIntersecting
- ✅ INP-LEAK-01: wszystkie addEventListener z named handlers

## Wymaga weryfikacji przez dewelopera

- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] `kinetic.PREVIEW.html` otworzony w przeglądarce → wizualnie identyczne z `kinetic.reference.html` → AKCEPTUJĘ
- [ ] `npm run dev` → React StrictMode: konsola bez błędów po 2× mount/unmount
- [ ] GSAP 3.12.7 smoke test: przewiń przez pin — brak skoku, brak orphan ST po unmount
- [ ] Po zejściu w dół z pinu snapy nie „budzą się” na samej górze strony (histereza / re-arm tylko w okolicy pinu)
- [ ] Można dokończyć pin i przejść do kolejnej sekcji (bez zamrożonego clampa do SNAP3)

## Grep gates ScrollTrigger (przed git push)

```bash
# G-ST-01: pinTrigger (bridge), nie „goły” container
grep -n "pinTrigger\|trigger:" src/sections/kinetic/KineticSection.tsx

# G-ST-02: brak document-relative start/end (wartości liczbowe)
grep -n "start\s*:\s*[0-9]\|end\s*:\s*[0-9]" src/sections/kinetic/KineticSection.tsx

# Scroll: tylko scrollRuntime (brak window.lenis w kodzie)
grep -n "window\\.lenis" src/sections/kinetic/KineticSection.tsx
# Oczekiwane: brak wyników
```

## Export contract

```typescript
// Default export — używane w BridgeSection:
import KineticSection from '@/sections/kinetic/KineticSection';
// Opcjonalnie named:
// import KineticSection, { ... } from '@/sections/kinetic/KineticSection';
```

Plik ma `// @ts-nocheck` (Typ B — typowanie stopniowe w Fabryce).  
Manifest (`Kinetic-Manifest.txt`): `export.mode: 'default'`.

## Performance notes

- PERF-W6: 5× gsap.ticker.add (celowe — zarządzane przez tickerFns[] + pause/resume)
- B-ISO-01: `isolation: isolate` na `#kinetic-section` (koniec `kinetic-section.css`) — blend wewnątrz sekcji
- INIT-CPU-01: createParticles() ~1000–2000 iter Float32Array — jednorazowy ~20–50ms long task

## Status

P3: DONE (artefakty wygenerowane, czeka na AKCEPTUJĘ PREVIEW)
Deweloper: potwierdza 0 errors + AKCEPTUJĘ przed wdrożeniem do repo
