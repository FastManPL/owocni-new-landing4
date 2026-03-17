# Plan integracji: Kinetic + Block-45

**Status:** Czeka na akceptację  
**Tryb:** Integracja (src/sections/** immutable)  
**Źródła:** kinetic.MANIFEST.txt, blok-4-5 P2B-OUTPUT / DEVELOPER_HANDOFF, CONVERSION_PLAN (kinetic), integracja.md, BRIEF_DEVELOPER_BRIDGE_FAKTY_KINETIC.md

---

## Żelazne zasady (nie do łamania)

| Zasada | Implikacja |
|--------|------------|
| `src/sections/**` immutable | Zero zmian w plikach sekcji. W razie potrzeby zmiany → STOP, wyjaśnienie, Fabryka. |
| `ScrollTrigger.refresh()` zakazany | Jedyna ścieżka: `scrollRuntime.requestRefresh(reason)`. |
| `window.__scroll` tylko w bloku DEV | Grep gate: puste w `src`. |
| Żadnych nowych zależności npm | Bez jawnej akceptacji operatora. |
| Resource hints tylko z SECTION_MANIFEST | Tylko to, co w manifestach (preconnectDomains, preloadCandidates itd.). |

**Visual & behavioral invariance:** output ma być nieodróżnialny dla użytkownika (zero różnic wizualnych, ten sam timing/UX, ta sama kolejność zdarzeń). Dozwolona równoważność wewnętrzna (cache, memo), niedozwolone: artefakty, zmiana timingu, degradacja jakości.

---

## 1. Przegląd sekcji

### 1.1 Kinetic (`src/sections/kinetic/`)

- **Pliki:** `KineticSection.tsx`, `kinetic-section.css`, manifest, handoff, evidence, PREVIEW.
- **Manifest (kinetic.MANIFEST.txt):**
  - slug: `kinetic`, type: **B**, requires: scrollRuntime, gsap, ScrollTrigger
  - webgl: **null** (3× canvas 2D: particle-qmark, tunnel, cylinder)
  - **perf.loading:** dynamicImport: **false** (owner decision), warmup: []
  - geometryMutable: **false**, geometryRefresh: **'self'**
  - hasPin: **true**, hasSnap: **true**
  - refreshSignals: section-in-view, layout-settle (scrollRuntime.requestRefresh)
  - preconnectDomains: `fonts.googleapis.com`, `fonts.gstatic.com`
  - dciProps: brak
- **Eksport:** named `KineticSection`, bez propsów.
- **Import w stronie:** `import { KineticSection } from '@/sections/kinetic/KineticSection';`

### 1.2 Block-45 (`src/sections/block-45/`)

- **Pliki:** `Blok45Section.tsx` (wrapper + `dynamic(Blok45Engine)`), `Blok45Engine.tsx`, `blok-4-5-section.css`.
- **Manifest (z P2B-OUTPUT / DEVELOPER_HANDOFF):**
  - slug: **blok-4-5** (ID sekcji w DOM: `#blok-4-5-section`)
  - type: **B**, requires: scrollRuntime, gsap, ScrollTrigger, **three**
  - webgl: enabled (Three.js — lazy CDN, pełne URL-e, bez import maps)
  - **perf.loading:** dynamicImport: **true**, clientOnly de facto (Three.js + ciężki JS)
  - geometryMutable: **false**, geometryRefresh: 'none' (P2B)
  - hasPin: **false**, hasSnap: **false**
  - preconnectDomains: `fonts.googleapis.com`, `fonts.gstatic.com`, **cdn.jsdelivr.net**
  - preloadCandidates: Ludzie.avif, Ludzie.webp, Ludzie-Small.avif, Ludzie-Small.webp
  - dciProps: brak
- **Eksport:** named `Blok45Section`.
- **Uwaga Three.js (Konstytucja J15, G11.1):** Sekcja używa `new THREE.WebGLRenderer()` i dynamicznego importu Three.js z CDN. Konstytucja wymaga wspólnego profilu przez `getWebGLProfile()` / webglBroker. **Obszar immutable** — integrator nie zmienia kodu sekcji. Ewentualna zgodność z J15/G11.1 = zakres Fabryki. Integracja składa sekcję „as-is”.

---

## 2. Weryfikacja wejścia (Krok 0)

- [x] Manifest kinetic — kompletny (slug, type, geometryMutable, hasPin, hasSnap, perf.loading, preconnectDomains).
- [x] Źródło dynamicImport: **perf** (kinetic: false; blok-4-5: true z P2B).
- [x] Brak duplikatu slug na stronie (kinetic raz, blok-4-5 raz).
- [x] Pliki sekcji w repo: `KineticSection.tsx`, `Blok45Section.tsx` + Blok45Engine, CSS.
- [x] integrationNotes: kinetic — hasPin/hasSnap (bez makro-sekcji); blok-4-5 — brak isMacroSection, requiresBodyPortal.

**STOP-y sprawdzone:**
- dynamicImport + pin/snap + skeleton: **kinetic** — static import, nie dotyczy; **blok-4-5** — dynamicImport true, ale hasPin/hasSnap false → skeleton: 'none' dozwolone.
- geometryRefresh: 'none' + dynamicImport: blok-4-5 ma geometryRefresh (P2B), geometryMutable false → hook nie jest wymagany.

---

## 3. Plan kroków (do wykonania po akceptacji)

### Krok 1 — Page.tsx (kolejność sekcji)

- **Działania:**
  1. Dodać import: `import { KineticSection } from '@/sections/kinetic/KineticSection';`
  2. Dodać import SectionsClient: `import { SectionsClient } from './SectionsClient';`
  3. W JSX: po `<FaktySection />` wstawić `<KineticSection />`, potem `<SectionsClient />`.
  4. Usunąć tymczasowy placeholder (section z „tymczasowy placeholder”).
- **Kolejność końcowa:** HeroSection → BookStatsSection → FaktySection → KineticSection → SectionsClient (w środku: Blok45Section).
- **Nie dodawać:** Bridge wrapper (Fakty+Kinetic) — poza zakresem tej sesji (integracja.md / BRIEF); Block 4 jest poza wrapperem (8 fixed elements).

### Krok 2 — SectionsClient.tsx (tworzenie)

- **Lokalizacja:** `src/app/SectionsClient.tsx`.
- **Zawartość:**
  - `'use client';`
  - `dynamic(import('@/sections/block-45/Blok45Section').then(m => ({ default: m.Blok45Section })), { ssr: false, loading: () => <section style={{ minHeight: '100vh' }} aria-hidden="true" /> })`
  - Export: `export function SectionsClient() { return <Blok45Section />; }`
- **Uzasadnienie:** perf.loading.dynamicImport === true dla blok-4-5; next/dynamic z ssr: false musi być w Client Component (P4). SectionsClient = jedyny legalny miejsc na takie sekcje.
- **Skeleton:** minHeight 100vh, aria-hidden (blok-4-5 bez pin/snap → skeleton 'none' OK).

### Krok 3 — Resource hints (tylko z manifestów)

- **Plik:** `src/providers/ResourceHints.tsx` (istniejący).
- **Kinetic (kinetic.MANIFEST.txt):**
  - preconnectDomains: fonts.googleapis.com, fonts.gstatic.com — **już są** w ResourceHints (np. dla fakty/book-stats). **Nic nowego** dla kinetic (deduplikacja).
- **Blok-4-5 (P2B):**
  - preconnectDomains: fonts.googleapis.com, fonts.gstatic.com, **cdn.jsdelivr.net** — dodać jeden nowy: `<link rel="preconnect" href="https://cdn.jsdelivr.net" />` (lub z crossOrigin jeśli wymagane dla skryptów).
  - preloadCandidates: Ludzie.avif, Ludzie.webp, Ludzie-Small.avif, Ludzie-Small.webp — dodać preload tylko jeśli ścieżki są znane (np. w `/public` lub pod stałym URL). Jeśli assety są w sekcji pod względnym path — **nie** dodawać preload bez potwierdzenia ścieżki w manifeście (unikać błędnych 404). W razie wątpliwości: tylko preconnect dla cdn.jsdelivr.net.
- **Zakaz:** hinty spoza manifestu, nowe domeny bez wpisu w SECTION_MANIFEST.

### Krok 4 — Hook geometrii

- **Kinetic:** geometryMutable: false, geometryRefresh: 'self' → sekcja sama obsługuje refresh. **Nic do dodania.**
- **Blok-45:** geometryMutable: false → **Nic do dodania.**

### Krok 5 — Weryfikacja infrastruktury (po zmianach)

- [ ] scrollRuntime: getScroll, getRawScroll, requestRefresh — bez zmian (nie dotykamy).
- [ ] SmoothScrollProvider w layout — bez zmian.
- [ ] ResourceHints w layout — bez zmian (tylko rozszerzenie hintów w ResourceHints.tsx).
- [ ] Grep gates (po sesji):
  - `rg "ScrollTrigger\.refresh\(" src -S` → puste
  - `rg "window\.__scroll" src -S` → puste (poza dozwolonym DEV)
  - `git diff --name-only | rg "^src/sections/"` → puste
  - `rg "content-visibility:\s*auto" src -S` → puste (żadna sekcja z ST nie może mieć)
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors (błędy z src/sections/** → STOP, Fabryka).
- [ ] Konsola: `npm run dev`, scroll przez Kinetic i Block-45 → 0 Errors.

---

## 4. Podsumowanie zmian (scope integracji)

| Plik | Akcja |
|------|--------|
| `src/app/page.tsx` | Import KineticSection + SectionsClient; kolejność: Fakty → Kinetic → SectionsClient; usunięcie placeholder. |
| `src/app/SectionsClient.tsx` | **Nowy:** 'use client', dynamic Blok45Section (ssr: false, loading skeleton). |
| `src/providers/ResourceHints.tsx` | Dodać preconnect dla cdn.jsdelivr.net (blok-4-5). Opcjonalnie preload dla Ludzie.* jeśli ścieżki ustalone. |
| `src/sections/**` | **Bez zmian.** |
| `src/lib/scrollRuntime.ts` | **Bez zmian.** |
| `src/app/layout.tsx` | **Bez zmian** (ResourceHints już podłączone). |

---

## 5. Ostrzeżenia i uwagi

- **Bridge Fakty → Kinetic:** Nie w tej sesji. Integracja.md i BRIEF opisują makro-sekcję (wrapper z pinem); tu tylko „dwie sekcje” Kinetic + Block-45 w kolejności. Ewentualny Bridge = osobna sesja / komponent z Fabryki.
- **Block 4 fixed elements:** Block 4 ma 8 elementów position:fixed; musi być **poza** ewentualnym pinowanym wrapperem. W tej sesji Block 4 jest po prostu po Kinetic w DOM — bez wrappera — zgodnie z integracja.md (Curtain Reveal).
- **Three.js / webglBroker:** Block-45 nie używa getWebGLProfile()/webglBroker. Konstytucja J15/G11.1 to wymaga dla nowego kodu WebGL. Ponieważ nie zmieniamy sekcji, wpisujemy to jako uwagę do Fabryki na później; integracja nie blokuje.
- **Visual invariance:** Brak modyfikacji wewnątrz sekcji → brak zamierzonej zmiany wizualnej lub behawioralnej. Kolejność i montowanie zgodne z manifestami.

---

## 6. Kolejność wykonania (po „AKCEPTUJĘ PLAN”)

1. Utworzyć `SectionsClient.tsx` z dynamic Blok45Section.
2. Zaktualizować `page.tsx`: importy, kolejność, usunięcie placeholder.
3. Zaktualizować `ResourceHints.tsx`: preconnect cdn.jsdelivr.net (+ ewent. preload po ustaleniu ścieżek).
4. Uruchomić `npx tsc --noEmit`, potem `npm run dev`, scroll, sprawdzenie konsoli i Grep gates.

---

**Koniec planu. Czekam na: „AKCEPTUJĘ PLAN” lub wskazanie korekt.**
