# KONSTYTUCJA PROJEKTU LP

**Wersja:** 2.5  
**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS  
**Bundler:** Turbopack (domyślny). Fallback: `next build --webpack`  
**Cel:** Landing page o wyśrubowanej wydajności, modularnej architekturze i pełnej wymienialności sekcji.  
**Twarde wymagania:** INP ≤ 200 ms (P75) · CLS < 0.1 · LCP < 2.5 s  
**Kompatybilność:** Oficjalny baseline Next.js (Chrome 111+, Safari 16.4+, Firefox 111+, Edge 111+) · Testowane na hardware od 2020+  
**Orientacja:** Portrait-only (landscape out-of-scope)  
**Zasada zmian:** Zmiany w Konstytucji tylko jako Poprawki (numer + changelog + uzasadnienie)

---

## SŁOWNIK POJĘĆ

| Termin | Definicja |
|--------|-----------|
| **Sekcja** | Moduł UI jako komponent React (z opcjonalnym silnikiem animacji wewnątrz `useGSAP`). |
| **Silnik (engine)** | Imperatywny kod animacji/3D (GSAP/Three/Canvas), uruchamiany na DOM refach wewnątrz `useGSAP`. |
| **Typ A** | Sekcja bez per-frame pętli własnej (brak rAF/ticker/physics/canvas loop); wystarczy `kill()`. |
| **Typ B** | Sekcja z per-frame pętlą (rAF/ticker/physics/canvas/WebGL); wymagane `pause()`/`resume()`/`kill()` + gating. |
| **Shared Core Layer** | Zatwierdzone globalne usługi: scrollRuntime, consent/analytics, moduleLoader, vitals, design tokens, next/font. |
| **Makro-Sekcja (Composite Module)** | Jedna sekcja kontrolująca wiele faz/widoków jednym timeline'em/pinem. Nie wrapper z dziećmi. |
| **DCI** | Dynamic Content Injection — warianty H1/sub/meta/media z allowlisty, rozwiązywane na serwerze. |
| **HOT** | Asset krytyczny dla pierwszego widoku i planu LCP — ładowany natychmiast. Plan LCP musi jawnie określać co jest LCP elementem. Np. hero poster. |
| **WARM** | Asset ważny — ładowany w tle po hero (prefetch/idle/near-viewport). Np. video z sekcji 3. |
| **COLD** | Asset luksusowy — ładowany na żądanie, może nie dojść przy słabym łączu / Save-Data. Np. hover-only dekoracja. |
| **Timeline Contract** | Plik `*.config.ts` z parametrami osi czasu (snap/end/gałki tuningu) + właściciel. Status: LOCKED. |
| **Module Loader** | Globalny system ładowania ciężkich bibliotek (Three.js/Lottie) z cache i warmup policy. Część Shared Core Layer. |
| **Warmup Policy** | Deklaracja w manifeście kiedy zacząć pobieranie ciężkiego modułu: `immediate` / `idle` / `near-viewport`. |
| **Evidence Pack** | Dowód przejścia sekcji przez pipeline + audyt + transformację React. Warunek odbioru przez integratora. |
| **geometryMutable** | Sekcja zmienia wysokość dokumentu po renderze (accordion, expand, lazy content). Deklarowane w manifeście z `geometryRefresh: "self"` lub `"none"`. |
| **data-geometry** | Atrybut HTML na elemencie sekcji który zmienia geometrię dokumentu po interakcji (accordion body, expand panel). Integrator filtruje `transitionend` po tym markerze — nie musi znać CSS properties użytych w animacji. Pipeline weryfikuje: `geometryMutable: true` → sekcja MUSI mieć ≥1 element z `data-geometry`. Brak = BLOCKER. |
| **Device Tier** | Klasyfikacja urządzenia klienta: Tier 0 (low-end: <4 cores, <4GB RAM, Save-Data, 2G), Tier 1 (normal), Tier 2 (high-end). Obliczany raz przy init. Sekcje i Module Loader odczytują tier i dostosowują zachowanie (G11). |
| **Ghost States** | CSS-only `:active` stany na interaktywnych elementach (G13). Dają natychmiastowy feedback PRZED hydracją React — perceived INP ≈ 0 w oknie FCP→Interactive. |
| **Cover Image Pattern** | Wzorzec hero video: poster jako oddzielny `<Image>` overlay na `<video>`. Przejście na `playing` event. Eliminuje "black flash" natywnego `<video poster>` (G8). |

---

## CZĘŚĆ I — RDZEŃ (Zasady twarde)

### A. Architektura projektu

| # | Zasada | Dlaczego |
|---|--------|----------|
| A1 | Osobny, czysty projekt Next.js 16. Nie wrzucamy kodu LP do istniejącego repozytorium. | Izolacja od legacy, pełna kontrola nad bundlem i konfiguracją. |
| A2 | Zero zewnętrznych UI libs, Routera (poza App Router), Reduxa, Auth. Czysty React + Tailwind + Formularz. | Minimalizacja bundle size i surface area dla bugów. |
| A3 | **Cache Components** włączone: `cacheComponents: true` w `next.config.ts`. Daje efekt PPR (statyczny shell + dynamiczny hole) z nowym modelem cachowania (`use cache` directive). Cachowanie jest **opt-in** — `cacheComponents: true` włącza model, ale **nie cache'uje niczego automatycznie**. Komponenty shell (Navbar, Footer, layout wrapper) MUSZĄ mieć dyrektywę `"use cache"` jawnie — bez tego renderują się per request i sens PPR = zero. Sekcje z DCI — ZAKAZ `"use cache"` (dynamiczne per request). | Statyczny shell cached on edge TYLKO jeśli oznaczony `"use cache"`. Dynamic hole (hero z wariantem) streamed. Zero niespodzianek — explicit, nie implicit. |
| A4 | **Strategia fontów.** Pobierane przez `next/font/google` z `adjustFontFallback: true`: **Lexend** (variable font, główny) `display: 'swap'` + **Fraunces** (tylko italic 400 — badge "100%") `display: 'optional'`. Nigdy CDN Google Fonts w produkcji. Fonty systemowe (nie pobieramy): Arial, Georgia (dostępne wszędzie). Stacki fallbackowe: `--font-serif`, `--font-sans`, `--font-mono` zdefiniowane w globals.css. **Weryfikacja:** DevTools → Network → plik fontu < 50KB (next/font robi subsetting automatycznie, ale sprawdź). | Self-hosting eliminuje round-trip do Google. Lexend `swap` = widoczny od razu (główny font, above fold). Fraunces `optional` = przeglądarka PRÓBUJE pobrać, ale jeśli nie zdąży w ~100ms — używa fallbacku i NIGDY nie swapuje. Zero CLS, zero mrugnięcia. Na 3G: 15KB mniej do pobrania. Returning visitor zobaczy Fraunces z cache. |
| A4.1 | **Sieroty (polskie jednoliterowe spójniki).** Komponent `NoOrphans` wstawia `\u00A0` (non-breaking space) po jednoliterowych spójnikach (w, z, i, a, o, u) żeby nie zostawały same na końcu linii. Stosowany na tekstach UI, NIE na headline DCI (H1 jest plain string, łamanie linii kontroluje CSS/layout). | Typografia polska wymaga obsługi sierot. `\u00A0` = przeglądarka nie złamie linii w tym miejscu. Lekki komponent, zero wpływu na performance. |
| A5 | Kompilacja pod ES2020+. Zakaz ciężkich polyfilli dla starszych przeglądarek. **Turbopack** jako domyślny bundler. Fallback: `next build --webpack` jeśli Turbopack generuje niespodziewane wyniki (weryfikacja Bundle Analyzer). | Baseline Next.js gwarantuje zero-config. Turbopack: 2-5x szybsze buildy, 5-10x szybszy Fast Refresh, File System Caching. Dla 8+ sekcji z GSAP — realny zysk w pracy. |
| A6 | **`reactCompiler: { compilationMode: 'annotation' }`** (top-level config, nie pod experimental). Domyślnie: żaden komponent nie jest kompilowany. Czyste UI (navbar, footer, statyczne komponenty) oznaczone `"use memo"` — zysk INP. Sekcje z GSAP/engine — **bez oznaczenia** (= nie kompilowane). Escape hatch: `"use no memo"` na pliku jeśli potrzebne. | Annotation mode = opt-in per komponent. Sekcje z GSAP są nietknięte (compiler ich nie widzi). Czyste UI zyskują automatyczną memoizację → mniej re-renderów → lepszy INP na słabych urządzeniach. |
| A7 | **Formularze (React 19 Actions) — reguła latent.** Jeśli LP zawiera formularz kontaktowy/lead gen: ZAKAZ tradycyjnego `onSubmit` z `e.preventDefault()` + useState loader. Formularz MUSI korzystać z `action` attribute (React 19) + `useActionState` / `useFormStatus`. React 19 automatycznie wrzuca action w Transition = main thread wolny = INP po kliknięciu "Wyślij" ≈ 0. Server Action jako handler = zero client JS dla logiki walidacji/wysyłki. | Tradycyjne onSubmit z async/await blokuje main thread przy walidacji + fetch = spike INP na słabych urządzeniach. React 19 Transitions przenoszą to w tło. Reguła latent — aktywna gdy LP ma formularz. |

### B. Architektura sekcji — izolacja

| # | Zasada | Dlaczego |
|---|--------|----------|
| B1 | Każda sekcja to zamknięty, samowystarczalny React component. Zero importów krzyżowych między sekcjami. **Wyjątek:** zatwierdzony Shared Core Layer (scrollRuntime, consent/analytics, moduleLoader, vitals, design tokens, next/font). | Wymienialność sekcji. Shared Core to infrastruktura, nie zależność między sekcjami. |
| B1.1 | **"Brak sekcji statycznych" ≠ wszystko client.** Sekcja może mieć SSR treść (H1/paragrafy w HTML) + mały `"use client"` subtree (engine animacji). Nie każda sekcja musi być w 100% client component. **Sekcje statyczne** (bez DCI, bez searchParams: FAQ, CTA, Footer) MOGĄ mieć dyrektywę `"use cache"` — cached na edge, zero re-render per request. Sekcje z DCI (hero) — ZAKAZ `"use cache"`. **Wzorzec "SSR markup + client engine sidecar"** (rekomendacja dla ciężkich sekcji poniżej folda): markup (H2, opisy, layout) = RSC, engine (Three.js canvas, GSAP timeline) = osobny `"use client"` subtree. Mniej JS w hydracji = lepszy INP. Nie wymagane dla lekkich sekcji. | Utrzymuje treść w HTML (SEO, FCP), engine startuje po hydracji. Mniej JS na kliencie = lepszy INP/LCP. `"use cache"` na statycznych sekcjach = darmowy zysk TTFB. |
| B2 | Strona główna (`page.tsx`) to lista importów sekcji ułożonych pionowo. Zero logiki biznesowej na tym poziomie (poza DCI — patrz sekcja F). | High cohesion wewnątrz sekcji, low coupling między nimi. |
| B3 | Każda sekcja ma prefixowany namespace: `#[nazwa]-section` jako root, ID wewnętrzne: `[nazwa]-xxx`, keyframes: `[nazwa]-fadeIn`, CSS properties: `--[nazwa]-progress`. | Eliminacja kolizji CSS/JS. Gwarantowane przez Pipeline v5.x. |
| B4 | Zakaz w CSS sekcji: `html {}`, `body {}`, `:root {}`, globalne `* {}`. Sekcja styluje tylko siebie. | Sekcja nie może wpływać na globalne style ani na inne sekcje. |
| B5 | Sekcja musi gwarantować **stabilną geometrię** przed załadowaniem assetów. Mechanizm dobierany per sekcja: `min-height`, `aspect-ratio`, explicit `width`/`height` na mediach, skeleton placeholder. `min-height` na root NIE jest wymagane gdy sekcja ma pin (GSAP zarządza geometrią) lub gdy treść jest w pełni statyczna (SSR bez lazy mediów). | Ochrona przed CLS. Ale `min-height` jako dogmat psuje kompozycję na małych ekranach i walczy z dynamicznym `end` w ScrollTrigger. |
| B6 | Świadoma duplikacja (WET > DRY) dla małych helperów (< ~50 linii). Jeśli dwie sekcje potrzebują tego samego helpera — kopiujesz go do obu. **Próg eskalacji:** helper który trafia do ≥3 sekcji LUB przekracza ~50 linii może wejść do Shared Core Layer jako stabilna infrastruktura (wymaga code review). Monitorujemy Bundle Analyzer. | Izolacja: modyfikacja helpera w jednej sekcji nie ryzykuje regresji w drugiej. **Uwaga:** kompresja (Brotli/Gzip) działa per chunk, nie cross-chunk — helper skopiowany do 3 chunków = 3× transfer. Dla małych helperów koszt jest marginalny, dla dużych rośnie. |
| B7 | **Sekcje z mutowalną geometrią** (accordion, expand, "pokaż więcej", lazy content zmieniający wysokość) deklarują w manifeście: `geometryMutable: true` + `geometryRefresh: "self"` (sekcja sama woła `requestRefresh` po zmianie) lub `"none"` (nie woła — integrator MUSI dodać hook `useGeometryRefresh`). Sekcja oznacza elementy zmieniające geometrię markerem `data-geometry` w HTML. Pipeline weryfikuje: `geometryMutable: true` → ≥1 element z `data-geometry`. Brak = BLOCKER. Jeśli `geometryRefresh: "self"`: integrator weryfikuje w teście integracyjnym że refresh faktycznie odpala. Manifest ≠ gwarancja. Test = gwarancja. | Sekcja w sandbox nie wie co jest pod nią. Zmiana geometrii w normalnym flow przesuwa content poniżej → ST start/end stare → broken pins/snaps. Globalny `ScrollTrigger.refresh(true)` (przez brokera `requestRefresh`) aktualizuje WSZYSTKIE triggery. Lokalny `.refresh()` niewystarczający gdy zmiana wpływa na layout poza sekcją. |
| B7.1 | **Hook `useGeometryRefresh(sectionId)`** — wydzielony `"use client"` hook w `src/hooks/`. Event delegation na kontenerze sekcji (`getElementById`). Słucha DWÓCH eventów: `transitionend` + `animationend` (bo B7 dopuszcza obie metody animacji — jeśli ktoś zrobi accordion na `@keyframes`, sam `transitionend` nie odpali). Filtr: `(e.target as HTMLElement).hasAttribute('data-geometry')` — event przechodzi TYLKO jeśli element na którym transition/animation się zakończyła MA marker. Ignoruje hover/focus/dekoracyjne transitions na elementach bez markera. `scrollRuntime` importowany z modułu (`@/lib/scrollRuntime`), NIE z `window` (C2). DEV gate: jeśli element nie znaleziony → `console.warn` (tylko dev). **Sekcje dynamiczne/warunkowe** (next/dynamic, conditional render): jeśli sekcja może mountować się PÓŹNIEJ niż hook odpali → `geometryRefresh` MUSI być `"self"` (sekcja sama woła requestRefresh). Hook z `getElementById` w globalnym providerze nie trafie w timing mount. | `propertyName` filter był coupled do CSS property (zmiana animacji grid-template-rows → max-height łamała sygnał). `hasAttribute` na `event.target` jest bezpieczniejsze niż `closest()` — `closest()` na przodku łapie KAŻDY transitionend z każdego dziecka (hover na linkach = fałszywe pozytywy). `hasAttribute` wymaga marker na WŁAŚCIWYM elemencie. |
| B7.2 | **Marker `data-geometry`:** MUSI być na elemencie który sam posiada transition/animation zmieniającą geometrię (height, max-height, grid-template-rows, padding, margin). ZAKAZ na przodkach "na wszelki wypadek" (= fałszywe pozytywy z każdego transitionend dziecka). ZAKAZ na dzieciach (transitionend.target = element z transition, nie jego dziecko — marker na dziecku = sygnał zgubiony). | `hasAttribute` sprawdza `event.target` — jeśli marker jest na złym elemencie, sygnał albo nie dochodzi (dziecko) albo dochodzi za często (przodek). |
| B7.3 | **ResizeObserver:** ZAKAZANY jako sygnał dla geometrii opartej o CSS transition/animation (tam: `transitionend`/`animationend`). DOZWOLONY wyłącznie dla zmian geometrii BEZ CSS transition (lazy content load, JS imperative resize, obrazki bez explicit dimensions) — sekcja ma `geometryRefresh: "self"`. RO callback robi WYŁĄCZNIE `requestRefresh()` — zero logiki, zero setState, zero obliczeń. Broker (C6) obsługuje debounce. Zakaz globalnego RO na `<body>` / `<html>`. **Rekomendacja dla lazy content (seria zmian rozstrzelonych w czasie):** globalny debounce 120ms (C6) nie sklei zdarzeń rozdzielonych o 500ms (np. 10 obrazków ładujących się co 300-800ms). Sekcja z RO/self MOŻE użyć własnego settle debounce 300-500ms przed wołaniem `requestRefresh()` — gwarantuje jeden refresh po całej serii, nie 10 osobnych. | RO odpala 50+ razy podczas 0.88s CSS transition = łamanie C6.1. Odpala też na mobile toolbar show/hide. `transitionend` odpala RAZ po zakończeniu = precyzja. Ale gdy zmiana geometrii nie ma transition — transitionend nie odpali → scoped RO jest jedynym poprawnym mechanizmem. Settle debounce chroni przed serią refreshów przy lazy content. |
| B8 | **Shallow LCP (rekomendacja).** Tag HTML odpowiadający za LCP (hero poster/image) POWINIEN być tak płytko w drzewie DOM jak to możliwe — max 3-4 poziomy od `<section id="hero">`. Jeśli to grafika tła — absolutnie pozycjonowane rodzeństwo głównego diva, nie zagnieżdżone w kontenerach z tekstem. | Parser HTML jest jednowątkowy. Głębokie zagnieżdżenie opóźnia moment gdy przeglądarka wyśle request po zasób. Na Tier 0 urządzeniach mierzalny wpływ. Ważniejsze: płytsze drzewo = szybszy layout/style recalc. |
| B9 | **`isolation: isolate`** na rootowym elemencie KAŻDEJ sekcji. Tworzy nowy stacking context — przeglądarka wie że z-index wewnątrz sekcji nie wpływa na elementy poza nią. GSAP animacja (opacity, transform) w sekcji 3 NIE wymusza repaint w sekcjach 1, 2, 4-8. Koszt: 1 linia CSS. Ryzyko: zero (B4 zabrania sekcji wypuszczać elementy poza swój kontekst). | Na stronie z 8 sekcjami i ciężkimi animacjami — redukuje paint area o 60-80%. Na słabych urządzeniach to różnica między 60fps a 30fps. Bezpieczniejsze niż `contain: layout` (G12) — nie tworzy nowego containing block, nie zmienia layoutu. |

### C. Scroll Runtime — jeden właściciel scrolla

| # | Zasada | Dlaczego |
|---|--------|----------|
| C1 | Scroll kontroluje singleton `scrollRuntime` (`src/lib/scrollRuntime.ts`). Sekcje importują go bezpośrednio — nigdy `window.__scroll`, nigdy `new Lenis()`, nigdy `ScrollTrigger.refresh()`. | Eliminacja race conditions i podwójnych instancji. |
| C2 | `window.__scroll` istnieje WYŁĄCZNIE jako alias do debug. Produkcyjny kod NIGDY nie czyta `window.__scroll`. | Import modułu jest deterministyczny; window property — nie. |
| C3 | Lenis działa z `autoRaf: false`. GSAP ticker jest master clockiem, Lenis slave'em. Ticker Lenisa dodany z `prioritize: true`. | Jedna pętla animacji, zero jittera, Lenis zawsze zaktualizowany przed tickami sekcji. |
| C4 | Zakaz: `ScrollTrigger.normalizeScroll()` i `ScrollSmoother` przy aktywnym Lenisie. | Dwóch "właścicieli scrolla" = konflikt i nieprzewidywalne zachowanie. |
| C5 | `ScrollTrigger.config({ ignoreMobileResize: true })` + ręczny `requestRefresh("orientationchange")` na zdarzenie `orientationchange`. | ignoreMobileResize redukuje jumpy na mobile, ale orientationchange wymaga ręcznego refresh. |
| C6 | Sekcje NIE robią `ScrollTrigger.refresh()` samodzielnie. Zgłaszają potrzebę przez `scrollRuntime.requestRefresh(reason)`. Runtime debounce'uje (120ms) i robi 1 refresh po podwójnym rAF. Używa `ScrollTrigger.refresh(true)` (safe refresh — nie przerywa momentum scrolla, odłącza piny, mierzy, przywraca). `requestRefresh()` MUSI być bezpieczne przed inicjalizacją runtime (no-op jeśli runtime nie gotowy). Sekcje i integrator importują `scrollRuntime` z modułu — NIE z `window` (C2). | Zapobiega "refresh storm" gdy wiele sekcji ładuje assety jednocześnie. Safe refresh jest bezpieczny nawet w trakcie aktywnego pinu. No-op przed init eliminuje race condition przy hydracji. |
| C6.1 | **Reguła anty-perf:** `requestRefresh()` ZAKAZ wywoływania w: `requestAnimationFrame` loopach, `gsap.ticker` callbackach, `onUpdate` ScrollTriggera, trakcie trwającej animacji otwierania/zamykania (np. co klatkę accordion expand). Sekcja zgłasza refresh **PO zakończeniu** zmiany geometrii (np. `transitionend`), nigdy W TRAKCIE. | requestRefresh w loopie = refresh co klatkę = layout thrash = INP katastrofa. Broker (scrollRuntime) chroni przed spamem przez debounce, ale sekcja nie powinna w ogóle spamować. |
| C6.2 | **Zakaz `transition-duration: 0s`** na elementach objętych sygnałem `transitionend`. Minimum: `0.01s`. Dotyczy też `prefers-reduced-motion` override — `0.01s`, nie `0s`. | CSS spec: `transitionend` NIE odpala przy `duration: 0s`. Sygnał refresh by nie doszedł → ScrollTrigger start/end nie zaktualizowane → broken pins/snaps poniżej. `0.01s` = transitionend odpala = bezpieczne. |
| C7 | CSS Lenisa: `import "lenis/lenis.css"` w globalnym imporcie. (Uwaga: w starszych wersjach Lenis ścieżka była `lenis/dist/lenis.css` — od Lenis 1.1+ poprawna to `lenis/lenis.css`.) | Bez tego: dziwne zachowania na mobile (nested scroll, modale, overscroll). |
| C8 | **Scroll Source Split** — `getScroll()` (interpolowana pozycja → layout, ScrollTrigger, IO) oraz `getRawScroll()` (surowy target → velocity, physics). Sekcje Typ B MUSZĄ je rozdzielać. Reguła spójności: jeśli velocity czyta z `getRawScroll()`, to WSZYSTKIE zapisy do `lastY`/`lastScrollY` też używają `getRawScroll()`. | Mieszanie źródeł = podwójne wygładzanie, stłumiona velocity, percepcyjne "cofanie". |
| C10 | **ScrollTrigger Budget.** Każda sekcja deklaruje w manifeście orientacyjnie: `scrollTriggersCount: N`. Soft limit globalny: ~40 instancji ScrollTrigger na stronie. Przekroczenie = wymaga jawnego uzasadnienia. Sekcje animujące listy elementów (np. 10 kart) MUSZĄ preferować batching (jedna oś czasu z scrub zamiast 10 osobnych ScrollTriggerów per element). | Za dużo aktywnych triggerów = za dużo `update()` per scroll frame. Każdy ST to getBoundingClientRect() + porównanie. 60 ST × 60fps = 3600 operacji/s. Na Tier 0 to jank. Batching redukuje do 1 ST × 60fps = 60 operacji/s. |
| C11 | **Passive Event Listeners.** Sekcje ZAKAZANE od `addEventListener('wheel'/'touchmove'/'touchstart', handler)` bez `{ passive: true }`. Bez passive = przeglądarka CZEKA aż handler się wykona zanim scrollnie (bo handler MOŻE zrobić `preventDefault()`). Na Tier 0 = 50-200ms opóźnienia KAŻDEGO scroll frame. Jedyny wyjątek: handler który MUSI robić `preventDefault()` (custom gesture, np. horizontal swipe override) — jawnie oznaczony w manifeście `specialNotes`. Lenis domyślnie ustawia passive: true — sekcje NIE mogą tego łamać. Chrome DevTools loguje violation: "Added non-passive event listener." | `touchmove` bez passive na mobile = scroll lag = INP katastrofa. To jest jeden z najczęstszych ukrytych zabójców INP. |

### D. Typologia sekcji — Typ A i Typ B

| # | Zasada | Dlaczego |
|---|--------|----------|
| D1 | **Typ A** (standard): sekcja używa ScrollTrigger, ale nie ma własnego tickera/physics/canvas/rAF. Wymaga tylko `kill()`. | Prosty lifecycle, minimalny cleanup. |
| D2 | **Typ B** (fizyka/velocity): sekcja ma ticker, physics, canvas lub rAF. Wymaga `pause()`, `resume()`, `kill()`. | Pełny lifecycle potrzebny do zarządzania zasobami CPU. |
| D3 | Typ B: obowiązkowy "skip first frame" (`isFirst = true`). Na `visibilitychange` / `resume()` — reset `isFirst = true`. | Zapobiega velocity spike przy scroll restoration i powrocie do karty. |
| D4 | Triaż A/B robimy NA STARCIE tworzenia sekcji. Gwarantowane przez Pipeline v5.x (Krok 0 — Triaż). | Dopinanie lifecycle "na siłę" generuje bugi. |

### E. Makro-Sekcje (Composite Modules)

| # | Zasada | Dlaczego |
|---|--------|----------|
| E1 | Przejścia między sekcjami o różnych mechanikach scrolla (np. normalny scroll → pinowany timeline → normalny scroll) realizowane jako **jedna Makro-Sekcja**: jeden komponent React, jeden `useGSAP`, jeden scope. | Jeden timeline dyrygujący wieloma fazami musi widzieć wszystkie targety bezpośrednio — bez przekazywania refów między komponentami. |
| E2 | **Zakaz wzorca "slotowy wrapper"** — integrator NIE składa Makro-Sekcji z dzieci. Makro-Sekcja przychodzi z Fabryki jako gotowy, zamknięty klocek. | Zewnętrzne składanie wprowadza ryzyko: Suspense boundary, warunkowy render, zmiana key — React może zresetować węzeł DOM w połowie sekwencji GSAP. |
| E3 | GSAP targetuje elementy lokalnie: jeden root ref + scope selector (`container.querySelector`). Zakaz kaskady `forwardRef` między komponentami dla celów timeline. | Scope selector jest odporny na re-render children. forwardRef chain jest kruchy. |
| E4 | Wewnątrz Makro-Sekcji można rozbić JSX na podkomponenty dla czytelności, ale muszą być **statyczne/presentational** — bez własnych ScrollTriggerów, bez pętli, bez warunkowego usuwania targetów DOM. | Podkomponent to czytelność kodu, nie osobna jednostka lifecycle. |
| E5 | Logika animacji Makro-Sekcji może być rozbita na **czyste funkcje TS** (helpery) w tym samym folderze. Nie React komponenty — czyste funkcje przyjmujące timeline i elementy DOM. | Czytelność bez rozbijania monolityczności React component. Helpery nie wiedzą o React. |
| E6 | Dla integratora Makro-Sekcja to jeden import, jedna linia w `page.tsx`. Nie wie i nie musi wiedzieć co jest w środku. | Integrator nie ingeruje w reżyserię przejść. |

### F. Dynamic Content Injection (DCI)

| # | Zasada | Dlaczego |
|---|--------|----------|
| F1 | Wariant treści (H1, sub, meta, video) rozwiązywany NA SERWERZE w `page.tsx` (Server Component). H1 przychodzi w pierwszym bajcie HTML. | Zero mrugnięcia, zero CLS, pełne SEO — Google widzi finalną treść. |
| F2 | Konfiguracja wariantów: `src/config/variants.ts` z importem `server-only`. | `server-only` blokuje przypadkowy import do client bundle — redukcja rozmiaru. |
| F3 | `getVariant(searchParams)` musi być deterministyczna z fallback do `defaultVariant`. Nigdy `null`, nigdy error. DCI jest **allowlistą** — parametry URL wybierają wariant z konfiguracji, nie są wstrzykiwane jako tekst. | Strona ZAWSZE się renderuje. Bezpieczeństwo: zero XSS, zero cache-bomb. |
| F4 | Normalizacja searchParams: `toLowerCase()`, `trim()`, decode. `k=tanie+strony` i `k=tanie%20strony` → ten sam klucz. | Eliminacja duplikatów cache i błędów lookupu. |
| F5 | `searchParams` jest `Promise` w Server Components (`page.tsx`, `generateMetadata`) — zawsze `await searchParams` w obu. W Client Components: synchroniczny dostęp przez hook `useSearchParams()` (ale sekcje nie czytają searchParams — patrz B3/F3). | Bez await w Server Component: runtime error. Dotyczy Next.js 15+ (kontynuowane w 16). Przy `cacheComponents` synchroniczny dostęp = błąd. |
| F6 | `generateMetadata()` generuje dynamiczne `<title>`, `<description>`, OG tags na podstawie wariantu. | SEO + Quality Score Google Ads: meta zgadza się z treścią strony. |
| F7 | `autoTier(headline): 'S' \| 'M' \| 'L'` — czysta funkcja, serverowa. Integrator przekazuje `tier` jako prop do sekcji. Sekcja decyduje co z tierem zrobić wizualnie. | Separacja: integrator oblicza tier, sekcja mapuje tier na CSS. |
| F8 | **ZAKAZ `dangerouslySetInnerHTML` z niezaufanych źródeł (URL params, API, user input) w nagłówkach.** Headline z searchParams to ZAWSZE plain string. | XSS protection + separacja odpowiedzialności. |
| F8.1 | **Dozwolony safe renderer dla kontrolowanych wariantów z inline markup.** Plik `variants.ts` MOŻE zawierać proste tagi formatujące w headline (`<b>`, `<em>`, `<span class="...">`) — np. `"<b>Tanie</b> Strony WWW"`. Renderowanie przez dedykowany safe renderer z whitelistą tagów (nie surowe `dangerouslySetInnerHTML`). Whitelist: `b`, `em`, `strong`, `span` (tylko z `class`/`className`). Wszystkie inne tagi = strip. Atrybuty poza whitelistą (np. `onclick`, `onerror`, `style`) = strip. Warianty żyją w repo (kontrolowane przez developera) — ryzyko XSS = zero. Safe renderer to ~15 linii kodu (regex strip + DOMParser albo biblioteka typu `sanitize-html`). | Biznes wymaga pogrubionych słów w headline'ach kampanii Google Ads. Zakaz surowego HTML z URL (F8) chroni przed XSS. Safe renderer z whitelistą chroni przed injection przy zerowym ryzyku z kontrolowanego pliku. |
| F9 | Preload hero assets wstrzykiwany w Server Component, nie przez client-side JS. **Dla `next/image` z `priority`:** preload generowany automatycznie. **Dla `<video poster="...">:`** `next/image` NIE preloaduje video posteru — potrzebny jawny `<link rel="preload" href="/hero-poster.webp" as="image" fetchpriority="high" />` w Server Component `<head>`. Jeśli LCP element to video poster — brak preloadu = 200-500ms gorszy LCP na wolnym łączu. | LCP: asset zaczyna się ładować zanim JS się zhydruje. Video poster to częsty LCP element na LP z video hero — musi mieć jawny preload. |
| F10 | `getVariant()` owinięta w `React.cache()`. **ZAKAZ:** `"use cache"` na `getVariant()` — wariant zależy od searchParams i MUSI być dynamiczny per request. `React.cache()` = request-scoped deduplication (poprawne). `"use cache"` = cross-request caching (złamałoby DCI — cache'owałoby wariant z pierwszego requesta dla wszystkich kolejnych). | generateMetadata i page.tsx mogą wołać getVariant niezależnie — `React.cache()` deduplikuje do jednego lookupu per request. |
| F11 | Canonical URL domyślnie bez parametrów query, chyba że świadomie indeksujemy warianty (osobna decyzja projektowa). | Ogranicza duplikaty SEO. |

### G. Wydajność — strategie ładowania i polityka zasobów

| # | Zasada | Dlaczego |
|---|--------|----------|
| G1 | `loading.tsx`: globalny fallback UI (skeleton). HTML szkielet ładuje się natychmiast, bez blokowania. | Cache Components streamuje statyczny shell, loading.tsx chroni dynamic hole. |
| G2 | **Każdy asset ma klasę priorytetu: HOT / WARM / COLD.** Klasa jest jawnie zapisana w manifeście sekcji. **HOT:** asset krytyczny dla pierwszego widoku i planu LCP — ładowany natychmiast (`fetchPriority="high"`). Plan LCP musi jawnie określać co jest LCP elementem (np. poster, nie video). Tylko hero. **WARM:** asset ważny — ładowany w tle po hero (`<link rel="prefetch">` lub IO z `rootMargin: "1500px"`). User scrolluje przez sekcję 2, video z sekcji 4 już się pobiera. **COLD:** asset luksusowy — ładowany na żądanie (IO z normalnym rootMargin). `fetchPriority="low"` jawnie na COLD obrazkach (chroni bandwidth HOT na wolnym łączu). Może nie dojść przy słabym łączu / `Save-Data` / Tier 0 (G11). Hover-only dekoracje, luksusowe efekty. COLD nie blokuje UI. **Iframes below fold:** `loading="lazy"` obowiązkowe. | Eliminacja "ładuj jak leci". Integrator nie zgaduje kolejności — manifest mówi wprost. HOT chroni plan LCP, WARM aktywnie prefetchuje w tle, COLD jest expendable. `fetchPriority="low"` na COLD zapobiega kradzieży bandwidth hero posterowi na 3G. |
| G3 | Hero video/obraz: `priority={true}` + `fetchPriority="high"` (**HOT**). Jedyny eager asset. | LCP musi być deterministyczny. Reszta czeka. |
| G4 | **CPU gating (osobny problem od transferu).** Video/canvas/Lottie poza viewport = `.pause()` przez IntersectionObserver. Pobrane video które jest poza ekranem nie zużywa CPU jeśli jest spauzowane. Sekcja jest właścicielem swojego IO. | Pobieranie (transfer) i odtwarzanie (CPU) to dwa osobne problemy. Prefetch w tle jest dobry. Dekodowanie klatek poza ekranem jest złe. |
| G5 | CSS: `content-visibility: auto` + `contain-intrinsic-size` **WYŁĄCZNIE na sekcjach BEZ ScrollTrigger wewnątrz** (statyczne: FAQ, CTA, Footer, bloki tekstowe). Sekcje Typ A i Typ B **NIE używają** `content-visibility: auto` — ScrollTrigger potrzebuje pełnego layoutu wewnętrznych elementów do kalkulacji start/end. Nawet z `contain-intrinsic-size` na rootie, children mogą mieć zerowe wymiary w momencie kalkulacji ST. | Przeglądarka pomija layout children niewidocznych sekcji. Dla statycznych sekcji = zysk. Dla sekcji z ScrollTrigger = sabotaż matematyki start/end → broken pins, CLS. |
| G6 | Vercel obsługuje HTTP/3 (QUIC) domyślnie na swoich edge nodes. Jeśli host nie wspiera — nie jest to blocker projektu. | Informacja, nie wymóg. HTTP/3 poprawia multiplexowanie na słabych łączach, ale nie jest w naszej kontroli. |
| G7 | **`<link rel="preconnect">` TYLKO dla originu serwującego obrazy** (jeśli inny niż app, np. custom CDN). Dla sGTM i skryptów marketingowych: `<link rel="dns-prefetch" href="https://sgtm.twojadomena.pl" />` (NIE preconnect). `preconnect` = DNS + TCP + TLS = kradnie CPU i TCP sloty w pierwszej sekundzie. `dns-prefetch` = tylko DNS lookup (najtańsza operacja), zestawienie połączenia odłożone na moment gdy skrypt faktycznie potrzebuje połączenia. | Na 3G: preconnect do sGTM kradnie zasoby które powinny iść na LCP. sGTM ładowany z `lazyOnload` nie potrzebuje gotowego połączenia w `<head>`. `dns-prefetch` wystarczy. |
| G8 | **Hero Video: Cover Image Pattern.** Poster HOT (`<Image priority>` lub jawny `<link rel="preload">`), wideo WARM. **ZAKAZ polegania na natywnym `<video poster="...">` dla płynnych przejść** — Safari/iOS ma "black flash" przy przejściu poster → video (gubienie klatek, mikro-CLS). Obraz LCP MUSI być oddzielnym `<Image>` z `position: absolute` nałożonym na wideo (`z-index` wyższy). Wideo odtwarza się pod spodem. Na event `playing` (NIE `canplay`/`loadeddata` — te mrugają!) obraz LCP dostaje `opacity: 0` przez CSS transition. **Warunki startu video:** LCP zmierzony (PerformanceObserver na `largest-contentful-paint`) + `requestIdleCallback` + `effectiveType !== '2g'`. Na Tier 0 (G11): poster only, zero video. | Deterministyczny LCP (obraz, nie video). Zero "black flash." Main thread wolny przy starcie. Video nie konkuruje o bandwidth z CSS/JS/fontami. `playing` event = video NAPRAWDĘ gra (nie tylko zbuforował metadane). |
| G9 | **Stabilna geometria.** Rezerwujemy miejsce dla obrazów/wideo (width/height, aspect-ratio, min-height) i nie pozwalamy na skaczący layout. | CLS < 0.1 — layout stabilny zanim załadują się assety. |
| G10 | **Obrazy przez `next/image`** z jawnym `sizes` attribute (odpowiedni do layoutu). `priority={true}` tylko na hero obrazie (HOT) — automatycznie dodaje `<link rel="preload">` w head. Zakaz surowych `<img>` tagów w sekcjach (wyjątek: małe inline SVG ikony nie będące content images). Next/image automatycznie optymalizuje format (WebP/AVIF na podstawie `Accept` headera) i rozmiar. LCP element (hero poster) ma mieć zawsze jawne wymiary (`width`/`height` lub `fill` + `sizes`). | Next/image = automatyczna optymalizacja formatu, responsive srcset, lazy loading domyślne. Bez `sizes` przeglądarka nie wie który rozmiar pobrać → pobiera za duży. |
| G11 | **Hardware/Network Gating (Tier 0/1/2).** Shared Core Layer zawiera util `getDeviceTier()` sprawdzający: `navigator.connection?.saveData` (Save-Data), `navigator.hardwareConcurrency` (<4 = low-end), `navigator.deviceMemory` (<4GB = słabe), `navigator.connection?.effectiveType` ('2g'/'slow-2g' = ultra-słabe), `prefers-reduced-motion`. **Tier 0 (low-end):** COLD assets nie ładowane, sekcje Typ B mogą wyświetlić statyczny fallback/poster zamiast canvas/Three.js, Lenis OFF (L2), hero video = poster only (zero autoplay), animacje uproszczone (reduced-motion timelines). **Tier 1 (normal):** pełna funkcjonalność, COLD assets lazy. **Tier 2 (high-end):** pełne "wow" efekty. Tier obliczany RAZ przy init (client-side). Server-side: header `Save-Data: on` i `Sec-CH-UA-Platform` mogą informować Server Component o degradacji (COLD assets nie preloadowane). | Na tanich Androidach (2-4GB RAM, 4 cores) Three.js + ciężkie animacje = jank + battery drain. Save-Data jest wysyłany przez Samsung Internet, Opera Mini. `effectiveType` dostępne tylko w Chromium (35-40% ruchu bez tej informacji — fallback na inne sygnały). Tier system nie wymaga nowej architektury — Module Loader i sekcje odczytują tier i dostosowują zachowanie. |
| G12 | **`contain: layout style`** (BEZ `size`) OPCJONALNE na sekcjach bez ScrollTrigger (FAQ, CTA, Footer). Mniej przydatne niż `isolation: isolate` (B9) które jest bezpieczniejsze i obowiązkowe. **ZAKAZ** na sekcjach z ScrollTrigger/pinem. | `contain: layout` tworzy nowy containing block — ryzykowne z GSAP. `isolation: isolate` (B9) daje lepszy paint containment bez ryzyka. |
| G13 | **CSS-Only Ghost States (Perceived INP).** KAŻDY interaktywny element (przyciski, karty FAQ, linki, CTA) MUSI posiadać sprzętowo akcelerowany stan `:active` w czystym CSS. Tailwind: `active:scale-[0.97] transition-transform duration-75`. Działa BEZ JS, BEZ hydracji, od pierwszego bajtu. Kliknięcie przez użytkownika w przycisk natychmiast go "wciska" — nawet jeśli React jeszcze nie zhydrował. Mózg rejestruje reakcję = perceived INP ≈ 0. | Od FCP do pełnej hydracji mija 300-800ms na tanich telefonach. W tym czasie przyciski "nie reagują" — brak event listenerów. CSS `:active` odpala na poziomie przeglądarki, nie JS. Koszt: 0. Zysk: perceived zero-latency UX. |
| G14 | **Video Delivery Contract (faststart).** Wszystkie pliki MP4 MUSZĄ mieć moov atom na początku pliku (`ffmpeg -movflags +faststart`). Bez faststart: przeglądarka musi pobrać CAŁY plik zanim zacznie odtwarzać. Na 3G z 5MB video = 30s czekania. Z faststart: pierwsza klatka po ~500ms. **Checklist:** `ffprobe` lub `AtomicParsley` — sprawdź pozycję moov atom. Above-the-fold video: bitrate/resolution dopasowane do Tier (G11). | Bez faststart "efekt premium" zamienia się w "efekt loading spinner." Banalny do naprawienia w pipeline encoding (jedno polecenie ffmpeg), katastrofalny gdy pominięty. |
| G15 | **Image Variant Budget.** W `next.config.ts` jawna konfiguracja `images.deviceSizes` i `images.imageSizes` dopasowana do realnych breakpointów LP (usunąć 3840 jeśli brak 4K use-case). `images.qualities` jako allowlista 2-3 wartości (np. `[60, 75, 85]`). Zakaz "przemycenia" quality: 100 (rozwalenie transferu + cache). **Uwaga AVIF cold-start:** AVIF kodowanie jest 5-10x wolniejsze niż WebP. Pierwszy request po deploy (cache miss) = LCP gorszy o 500ms+. Weryfikacja RUM po deploy: sprawdź cold-start LCP. | Domyślne `deviceSizes` zawiera 3840 (4K) — generuje warianty których nikt nie użyje. Mniej wariantów = szybszy cache warmup = lepszy cold-start LCP. Quality 100 = 2-3x większy plik bez percepcyjnej różnicy. |

### H. Strategia ładowania bibliotek i Module Loader

| # | Zasada | Dlaczego |
|---|--------|----------|
| H1 | GSAP + ScrollTrigger: **initial bundle**, importowane normalnie. Bundler tworzy **jeden wspólny chunk** — 8 sekcji importujących GSAP = 30KB raz, nie 8×30KB. | Lekkie (~30KB gzip łącznie dla całej strony). Deduplikacja automatyczna. Lazy loading skomplikowałby architekturę bez realnego zysku. |
| H2 | Three.js i inne ciężkie biblioteki (>100KB): **`next/dynamic` z `ssr: false`** dla komponentu sekcji + **warmup hint** (prefetch) żeby biblioteka zaczęła się pobierać wcześniej. | Three.js (~600KB) w initial bundle zabija LCP. `next/dynamic` opóźnia załadowanie całego chunka (sekcja + jej zależności). `ssr: false` bo potrzebują window/document. Warmup hint pozwala zacząć pobieranie w tle zanim sekcja się zamountuje. |
| H2.1 | **`next/dynamic` jest dla sekcji (React components), nie dla surowych bibliotek.** Gdy sekcja z Three.js jest ładowana dynamicznie, `next/dynamic` leniwie mountuje komponent React, a Three.js jest importowane normalnie wewnątrz tego komponentu. Three.js NIE przechodzi przez virtual DOM — jest używane imperatywnie na canvasie/refach. | `next/dynamic` = React.lazy + Suspense na poziomie komponentu. Biblioteka imperatywna jest zależnością chunka, nie wstrzyknięciem do cyklu renderowania. |
| H2.2 | **Rozdzielenie ról: `moduleLoader` = transfer, `next/dynamic` = mount.** `moduleLoader` odpowiada za pobieranie chunka/biblioteki w tle (cache, warmup). `next/dynamic` odpowiada za mount komponentu React (kiedy wchodzi do drzewa, fallback/skeleton, SSR exclusion). Typowy flow: moduleLoader zaczyna pobierać Three.js na `idle` → user scrolluje do sekcji → `next/dynamic` mountuje komponent → chunk jest już w cache przeglądarki → natychmiastowy mount, zero black-frame. Dwa narzędzia, dwa problemy: transfer timing vs mount timing. | Bez jasnego rozdzielenia integrator nie wie czy "warmup" ma prefetchować moduł, mountować komponent, czy oba. |
| H3 | Deduplikacja: automatyczna przez Turbopack (lub webpack w fallbacku). Trzy sekcje importujące Three.js → jeden wspólny chunk. Zero manualnej konfiguracji. | Turbopack/webpack deduplikuje na poziomie modułu. Weryfikacja: Bundle Analyzer na bramce PR. |
| H4 | Sekcje ładowane dynamicznie z pinem: obowiązkowy skeleton placeholder przez `loading` prop w `next/dynamic`: `const WalkSection = dynamic(() => import('./WalkSection'), { ssr: false, loading: () => <WalkSkeleton /> })`. Skeleton rezerwuje miejsce w DOM (height, CLS). | Bez skeletona: sekcja "wskakuje" do DOM, zmienia wysokość dokumentu → CLS + ScrollTrigger jump. `loading` prop = wbudowany mechanizm, nie custom Suspense. |
| H5 | **Module Loader w Shared Core Layer.** Ciężkie moduły (Three.js/Lottie/inne >100KB) ładowane przez globalny `moduleLoader` — single-load + cache + warmup. Sekcje nie ładują tych bibliotek samodzielnie — deklarują zależność i politykę warmup w manifeście. | Kontrolujemy "kiedy" i "ile razy". Unikamy: black-frame przy opóźnionym Three.js, podwójnego ładowania gdy dwie sekcje chcą Three.js. moduleLoader koordynuje. |
| H6 | **Warmup Policy** — sekcje deklarują w manifeście zarówno biblioteki JAK I sam komponent: `warmup: [{ import: () => import('three'), policy: 'idle' }, { import: () => import('./WalkSection'), policy: 'near-viewport', rootMargin: '2000px' }]`. **immediate:** initial bundle. **idle:** `requestIdleCallback`. **near-viewport:** IO z rootMargin. Warmup = `import()` (komponentu I/LUB biblioteki), nie magiczne preload `next/dynamic`. Black-frame może wynikać z brakującego chunka sekcji, nie tylko biblioteki. | Decyzje jawne i testowalne. Integrator wie dokładnie kiedy każdy moduł I komponent zacznie się pobierać. |
| H7 | **Konkretna Asset Loading Map** (co jest HOT/WARM/COLD, warmup policy per moduł, co może się nie wgrać, co musi) — zostanie określona osobno przed integracją i przekazana integratorowi jako uzupełnienie manifestu. | Priorytety zależą od finalnego contentu i layoutu, nie od architektury. |
| H8 | **Bundle Analyzer na bramce PR (B3) i przed wdrożeniem produkcyjnym.** `next build --turbopack && npx next-bundle-analyzer` — weryfikacja deduplikacji GSAP/Three.js, rozmiarów chunków, braku niespodziewanych duplikatów. Nie po każdym buildzie w dev — na bramkach jakości. **Nowa zależność w repo:** sprawdź czy wymaga `optimizePackageImports` w `next.config.ts` (Next.js tree-shaking dla pakietów z wieloma eksportami — ikony, utils, date libs). Jedna ścieżka importu dla danej biblioteki w całym repo (mieszanie aliasów/entrypointów = duplikacja chunków). | Turbopack Bundle Analyzer daje precyzyjny wgląd w graf modułów. `optimizePackageImports` chroni przed "niewinnym" importem który wciąga 200KB. |

### I. Consent & Tracking (Cookiebot + sGTM)

| # | Zasada | Dlaczego |
|---|--------|----------|
| I1 | Inline Default Consent (wszystkie zgody `denied`) jako **pierwszy** element `<head>`. Parametr `wait_for_update: 500`. | Eliminacja race condition: consent state jest znany natychmiast. 500ms na odczytanie cookie powracającego usera. |
| I2 | Cookiebot Auto-Blocking: **OFF**. Tryb Manual, skanowanie DOM wyłączone. | Drastyczna redukcja TBT — Cookiebot nie parsuje całego DOM. |
| I3 | Skrypt Cookiebot (`uc.js`): `async` + w Next.js `next/script` ze strategią `afterInteractive`. | Nie blokuje LCP. |
| I4 | GTM Client-Side: zero Blocking Triggers na tagach GA4/Ads. | Advanced Mode: anonimowe pingi lecą bez zgody. |
| I5 | GA4 transport URL → sGTM (nie bezpośrednio do Google). | Dane przechodzą przez nasz serwer — anonimizacja i redakcja server-side. |
| I6 | Baner Cookiebot: CSS `position: fixed` (overlay), nigdy element blokowy. Na mobile: nie zasłania przycisków interakcji. | CLS = 0 od banera. |
| I7 | Skrypty 3rd-party tylko przez `next/script` z jawną strategią. Domyślnie `afterInteractive`. **Ciężkie skrypty marketingowe** (GTM z wieloma pod-skryptami, Meta Pixel, HotJar, Intercom) — `lazyOnload` (nie `afterInteractive`). Na tanim smartfonie `afterInteractive` GTM blokuje main thread na kilkaset ms — jeśli user dotknie ekranu w tym czasie, INP katastrofa. `lazyOnload` odkłada do idle time. **Zakaz `strategy="worker"` (Partytown)** — eksperymentalne, GTM dataLayer i event tracking nie propagują się poprawnie w Web Worker. | Kontrola main thread i ochrona LCP/INP. `lazyOnload` > `afterInteractive` dla skryptów marketingowych. Partytown wygląda obiecująco ale w 2026 nadal niestabilne z GTM. |

### J. Transformacja vanilla → React

| # | Zasada | Dlaczego |
|---|--------|----------|
| J1 | Sekcje tworzone w vanilla JS (Test Shell). Transformacja do React to **osobny krok w pipeline**, wykonywany w Fabryce PRZED oddaniem integratorowi. | Integrator nie transformuje — dostaje gotowy React component. |
| J2 | Transformacja jest mechaniczna: HTML → JSX, CSS → osobny plik, `init(container)` → `useEffect`/`useGSAP`, selektory → scope container, scroll helpery → `scrollRuntime`, cleanup → return function. | Powtarzalny proces, minimalne ryzyko regresji. |
| J3 | **Logika GSAP jest NIENARUSZALNA przy transformacji.** Zakaz: zmiany timing/easing/snap functions, przenoszenia stanu animacji do `useState`, zamiany imperatywnych kalkulacji na React-owe, zmiany kolejności instrukcji w timeline, "optymalizacji" snap functions. | Kod animacji po transformacji musi być identyczny behawioralnie z sandbox. |
| J4 | Kod wewnątrz `useGSAP`/`useEffect` wygląda jak vanilla JS — i tak ma być. React zarządza lifecycle (start/stop/cleanup), GSAP jest silnikiem animacji. Silnika nie ruszamy. | GSAP omija virtual DOM i pisze prosto do real DOM. React nie uczestniczy w per-frame. |
| J5 | Wszystkie **top-level** GSAP instancje (ScrollTrigger, standalone tweeny, root timelines) tworzone **wewnątrz** callbacka `useGSAP`. **Helpery TS (E5) są dozwolone** o ile: (a) są wywoływane wewnątrz callbacka `useGSAP`, (b) dokładają animacje do istniejącego timeline/scope przekazanego jako argument, (c) nie tworzą własnych standalone ScrollTriggerów ani niezależnych tweenów bez powiązania ze scope. | `useGSAP` scope widzi i automatycznie revertuje instancje wewnątrz callbacka + ich children. Helper który dokłada do `tl` (child timeline'a w scope) jest bezpieczny. Helper który tworzy odłączony ScrollTrigger — nie. |
| J6 | Przy >10 animowanych elementów w sekcji: scope + class selectors wewnątrz `useGSAP`, NIE pulę `useRef`. | 50 useRef to nieczytelny, kruchy kod. Scope selector jest prostszy i bliższy vanilla oryginałowi. |
| J7 | **Strukturalne mutacje DOM (SplitText, innerHTML, dynamiczne tworzenie elementów) wykonywane WYŁĄCZNIE po hydracji, wewnątrz `useGSAP`/`useEffect`.** Zakaz `suppressHydrationWarning` jako rozwiązania — maskuje problem, nie rozwiązuje go. Jeśli animacja wejścia musi startować od razu: element startuje z `visibility: hidden` w CSS (nie `display: none` — CLS wymaga rezerwacji miejsca), SplitText rozbija go po hydracji, animacja odsłania. | React sprawdza zgodność DOM-u przy hydracji. Jeśli SplitText rozbije tekst na `<span>` PRZED hydracją — hydration mismatch crash. Po hydracji React nie weryfikuje — SplitText działa bezpiecznie. `suppressHydrationWarning` maskuje warning ale React nadal trzyma referencje do starego drzewa — przy re-renderze = trudne do debugowania błędy. |
| J8 | **Treść DCI (headline) przekazywana jako prop (string) i renderowana w HTML przez SSR.** Dopuszczalna duplikacja w `data-*` jako backup do revert/reinicjalizacji (np. `data-headline="..."` obok tekstu w H1). **Zakazane:** generowanie treści H1 wyłącznie z `data-*` (bez SSR tekstu w DOM). | SSR H1 = SEO + zero CLS. `data-*` jako kopia jest "liną asekuracyjną" dla SplitText.revert(). Ale `data-*` jako jedyne źródło = client-side rendering = mrugnięcie = CLS. |
| J9 | **Węzły DOM mutowane strukturalnie przez GSAP (SplitText, dynamiczne tworzenie elementów) muszą żyć w stabilnym client subtree bez re-renderów.** Element mutowany przez SplitText nie może mieć rodzica z `useState`/`useReducer` który zmienia się w trakcie życia sekcji. Jeśli re-render jest nieunikniony: `SplitText.revert()` przed re-renderem, ponowna inicjalizacja po. | Po SplitText React trzyma referencje do oryginalnego `<h1>`, ale DOM zawiera dziesiątki `<span>`. Re-render rodzica = React próbuje odtworzyć `<h1>` nadpisując spany → timeline GSAP trzyma stale referencje → crash/jank. Stabilny subtree = zero re-renderów = zero konfliktu. |
| J10 | **Callbacki ScrollTrigger (`onEnter`/`onLeave`/`onToggle`) MUSZĄ być idempotentne.** Zakaz jednorazowych side-effectów bez guardu: analytics event bez flagi "already-sent", start animacji intro bez once-check, inkrementacja licznika bez idempotency key, fetch/mutation bez deduplikacji. **Wzorzec:** `let entered = false; onEnter: () => { if (entered) return; entered = true; trackEvent("visible"); }`. **Wyjątki bezpieczne (guard niepotrzebny):** scrubowane timelines (`scrub: N`) — pozycja wynika z scrolla, nie z callbacku; `once: true` — trigger disconnects po pierwszym fire; `onRefresh` — jest designed do wielokrotnego wywoływania. | `ScrollTrigger.refresh(true)` (wywoływany przez B7 po zmianie geometrii) kończy się `update()` który może zmienić `isActive` i ponownie odpalić callbacki. Bez guardu = podwójny analytics event, podwójne `playIntro()`, podwójny fetch. To jest udokumentowane zachowanie GSAP, nie edge case. |
| J11 | **GPU layer cleanup po one-shot animacjach.** GSAP dodaje `will-change: transform` automatycznie podczas animacji transform. Po zakończeniu animacji wejścia (one-shot, nie scrubowana), sekcja POWINNA usunąć `will-change` z elementów które nie będą więcej animowane. Wzorzec: `gsap.set(targets, { willChange: "auto" })` na `onComplete` timeline. **NIE `clearProps: "all"`** (destrukcyjne — usuwa WSZYSTKIE inline styles w tym celowe `opacity: 1`). **Nie dotyczy:** scrubowane timelines (ciągła animacja, warstwa GPU potrzebna), elementy z hover-state animacjami. Na Tier 0 (G11) cleanup OBOWIĄZKOWY — słabe urządzenia z 2-4GB RAM mają limit warstw GPU. | 8 sekcji × 5-10 animowanych elementów = 40-80 GPU warstw. Na słabych urządzeniach z 2-4GB RAM = memory pressure = jank. `will-change: auto` mówi przeglądarce: "zwolnij warstwę GPU." Cleanup zmniejsza memory footprint na słabych urządzeniach bez wpływu na animacje które się już skończyły. |
| J11.1 | **Pre-rasteryzacja hero (uzupełnienie J11).** Elementy w sekcji Hero (above fold) które będą animowane przez GSAP natychmiast po load MUSZĄ mieć `will-change: transform, opacity` w STATYCZNYM CSS/Tailwindzie (nie dodawane przez JS). Przeglądarka promuje je do GPU warstwy podczas parsowania CSS = warstwa gotowa zanim GSAP ruszy. Bez tego: pierwsza klatka animacji stutteruje (GPU Upload 5-20ms). **TYLKO hero.** Sekcje poniżej folda — NIE (zwiększa memory od startu). Cleanup na `onComplete` (J11) obowiązkowy. | Przeglądarka musi skopiować piksele z CPU do GPU przy pierwszej animacji transform. Statyczne `will-change` w CSS = kopia dzieje się w idle. Dynamiczne `will-change` (GSAP) = kopia w momencie startu animacji = stutter. 60fps od klatki nr 1 na Tier 0. |
| J12 | **`scheduler.yield()` w ciężkim GSAP init (rekomendacja).** Jeśli `useGSAP` callback robi >50ms pracy (wiele ScrollTriggerów, duży timeline, texture upload) — rozbij na kroki z yieldem. `await scheduler.yield()` (Chromium 129+) oddaje main thread na jedną klatkę. Fallback: `await new Promise(r => setTimeout(r, 0))` (obowiązkowy — Safari/Firefox nie mają scheduler.yield). Kolejność instrukcji niezmieniona (J3) — timeline kompletny po ostatnim yield. INP spada z ~150ms na ~30ms bo user input obsługuje się między krokami. **Nie dotyczy** prostych initów (<50ms). | `useGSAP` callback to synchroniczny blok — React go nie widzi. Budowanie 5 ScrollTriggerów + dużego timeline = 80-150ms Long Task. Na P75 urządzeniu = spike INP. Yield łamie Long Task na mniejsze części. |

### K. Timeline Contract (ochrona parametrów)

| # | Zasada | Dlaczego |
|---|--------|----------|
| K1 | Parametry timeline (end, snap points, stagger delays, physics constants, easing, SCROLL_MULTIPLIER) wydzielone do osobnego pliku `*.config.ts` w folderze sekcji. | Integrator widzi czego NIE ruszać bez czytania 300+ linii timeline kodu. |
| K2 | Parametry timeline modyfikowane WYŁĄCZNIE przez autora sekcji lub za jego jawną zgodą. Integrator NIE zmienia tych wartości. | Zmiana jednego parametru (np. `end`) kaskadowo wpływa na snap points, crossover timing, i feel całej narracji. |
| K3 | Timeline Contract jest częścią manifestu sekcji i ma status "LOCKED". | Ochrona formalna — przypadkowa zmiana przez integratora = automatyczny zwrot do Fabryki. |

### L. Znane ograniczenia i fallbacki

| # | Zasada | Dlaczego |
|---|--------|----------|
| L1 | Safari/iOS + `position: fixed` + Lenis = potencjalny lag/stutter. Testuj fixed elementy jako pierwszego podejrzanego. | Znany bug Lenisa na starszym Safari (pre-M1). |
| L2 | Feature-flag: `LENIS_OFF` na problematycznych device'ach. Strona MUSI działać z natywnym scrollem. **Procedura:** włączenie przy potwierdzonym bug iOS/Safari na real device (nie symulatorze). Decyduje: integrator po konsultacji z autorem sekcji. Testowanie: smoke scroll przez całą stronę z natywnym scrollem — ScrollTrigger nadal działa (jest niezależny od Lenisa), ale snap/physics mogą się zachowywać inaczej. Sekcja Typ B z velocity MUSI mieć fallback path dla natywnego scrolla. | Lenis to enhancement, nie requirement. Bez jasnej procedury "kiedy wyłączamy" feature-flag jest bezużyteczny. |
| L3 | Anti-jump `scrollTo(immediate, force)` przy init: jeśli iOS "hop to top" — testuj init bez `force:true` lub init po rAF + refresh. | Znany edge-case iOS przy inicjalizacji scrolla. |
| L4 | `text-wrap: balance` — progressive enhancement (Chrome 114+, Safari 17.5+). Sekcja NIE MOŻE polegać na tym jako jedynym mechanizmie łamania linii. | Na starszych urządzeniach tekst się nie wybalansuje, ale się nie zepsuje. |
| L5 | `content-visibility: auto` — Safari: brak pełnego wsparcia. Na Safari sekcje renderują się normalnie. | Graceful degradation, nie bug. |
| L6 | Auto-Blocking OFF (Cookiebot) = gating tagów musi być bezbłędny i audytowalny. | Performance rośnie, ale odpowiedzialność implementacyjna też. |

---

## CZĘŚĆ II — GWARANCJE PIPELINE (co integrator może zakładać)

Każda sekcja, zanim trafi do integratora, przechodzi przez cztery procesy:

### 1. Pipeline Standaryzacji v5.x

Gwarantuje: namespace (ID/CSS/keyframes), sanityzacja CSS (scope pod `#[nazwa]-section`), struktura JS (`init → kill/pause/resume`), cleanup (cleanups/timerIds/observers/gsapInstances), scroll helpery, debug za DEV GATE, triaż A/B.

### 2. Audyt Kompatybilności v3.2

Gwarantuje: **Lean Audit Policy** — Typ A (proste sekcje): 1 model AI + checklist sweep. Typ B / pin / canvas / Makro-Sekcja: pełne 3 modele AI (FAZA 1) + checklist sweep (FAZA 2) + synteza (FAZA 3). Macierz mobile: iOS Safari + Chrome Android (real device). Cross-browser na target: Chrome 111+, Safari 16.4+, Firefox 111+. Hierarchia fixów: CSS-only → feature detection → platform detection (max 5/sekcję). Wszystkie CRITICAL i BLOCKER rozwiązane.

### 3. Transformacja do React

Gwarantuje: gotowy `.tsx` component, CSS w osobnym pliku, scroll helpery zamienione na `scrollRuntime`, cleanup w return function, GSAP logika 1:1 z sandbox, behawioralna identyczność z vanilla oryginałem potwierdzona testem.

### 4. Evidence Pack (w manifeście)

Gwarantuje: `pipelineComplete: true`, `auditComplete: true`, `reactTransformComplete: true`, `criticalBlockers: 0`, `platformGuards: N/5`.

### Co integrator może zakładać

1. Sekcja nie zaśmieci globalnego CSS i nie stworzy kolizji ID.
2. Sekcja poprawnie się czyści (kill/pause/resume).
3. Sekcja działa cross-browser na target urządzeniach.
4. Sekcja jest gotowym React component — nie wymaga transformacji.
5. Manifest zawiera typ A/B, assety z klasą HOT/WARM/COLD, warmup policy, Timeline Contract (jeśli dotyczy), Special Notes.

### Co integrator odpowiada za

1. Przekazanie props DCI (headline, sub, tier) jeśli sekcja wymaga.
2. Preload hero assets w Server Component (**HOT** assets).
3. Kolejność sekcji na stronie i dynamic import strategia (wg warmup policy z manifestu).
4. `scrollRuntime` → globalna inicjalizacja w layout.tsx.
5. `moduleLoader` → globalna inicjalizacja warmup policy (Three.js idle, Lottie near-viewport, etc.).
6. Consent/tracking infrastruktura.
7. Testy integracyjne (sekcje razem, scroll przez całą stronę).
8. Implementacja Asset Loading Map (gdy zostanie określona).
9. **Refresh hook** dla sekcji z `geometryMutable: true` + `geometryRefresh: "none"` — `useGeometryRefresh(sectionId)` w client boundary (B7.1).

---

## CZĘŚĆ III — STRUKTURA PLIKÓW

```
src/
├── app/
│   ├── layout.tsx              ← SmoothScrollProvider owija {children}
│   ├── page.tsx                ← Server Component: DCI + lista sekcji
│   ├── loading.tsx             ← Globalny skeleton (Cache Components fallback)
│   └── globals.css             ← Tailwind directives + lenis.css + globalne utility
│
├── sections/
│   ├── hero/
│   │   ├── HeroSection.tsx     ← "use client"
│   │   ├── hero.config.ts      ← Timeline Contract (jeśli dotyczy)
│   │   ├── hero-section.css
│   │   └── hero.manifest.ts
│   │
│   ├── bridge-sequence/        ← MAKRO-SEKCJA (przykład)
│   │   ├── BridgeSequence.tsx  ← Jeden komponent: Stats + Kinetic + przejście
│   │   ├── bridge.config.ts    ← Timeline Contract (snap points, timing)
│   │   ├── snap-gate.ts        ← Helper: czysta funkcja TS (nie React)
│   │   ├── gravity-drop.ts     ← Helper: czysta funkcja TS (nie React)
│   │   ├── bridge-section.css
│   │   └── bridge.manifest.ts
│   │
│   ├── walk/
│   │   ├── WalkSection.tsx
│   │   ├── walk.manifest.ts
│   │   └── walk-section.css
│   │
│   └── .../
│
├── components/
│   └── SmoothScrollProvider.tsx ← "use client", init scrollRuntime
│
├── hooks/
│   └── useGeometryRefresh.ts   ← "use client", hook B7.1 (geometry-mutable sekcje)
│
├── config/
│   └── variants.ts             ← server-only, warianty DCI
│
├── lib/
│   ├── scrollRuntime.ts        ← Singleton Lenis + GSAP + refresh pipeline
│   ├── moduleLoader.ts         ← Globalny loader ciężkich modułów (Three/Lottie) z cache + warmup
│   └── autoTier.ts             ← Czysta funkcja tier S/M/L
│
└── types/
    └── global.d.ts             ← Window.__scroll typing (debug only)
```

---

## CZĘŚĆ IV — PIPELINE RENDEROWANIA

```
Request → Next.js App Router
    │
    ├─ [Static Shell — cached by Cache Components]
    │   ├── <html lang="pl">
    │   ├── <head> (inline default consent, preconnects, fonts)
    │   ├── Navbar
    │   └── Footer
    │
    └─ [Dynamic Hole — streamed]
        ├── page.tsx (Server Component)
        │   ├── const params = await searchParams
        │   ├── const variant = getVariant(params)  // React.cache() deduplikuje
        │   ├── const tier = autoTier(variant.h1)
        │   ├── generateMetadata() → <title>, <meta>, OG
        │   │
        │   ├── <HeroSection ... />                 // HOT: initial bundle
        │   ├── <Suspense fallback={<BridgeSkeleton />}>
        │   │     <BridgeSequence ... />             // WARM: initial or dynamic
        │   │   </Suspense>
        │   ├── <WalkSection />                      // WARM: dynamic, ssr: false
        │   └── <FooterSection />                    // COLD: lazy
```

**Rekomendacja:** Hero poza `<Suspense>` (streamuje się natychmiast jako część dynamic hole). Sekcje poniżej hero owinięte w `<Suspense>` z dedykowanym skeleton — mogą streamować się niezależnie. `loading.tsx` jako globalny route-level fallback (safety net), nie jako główny mechanizm skeleton.

---

## CZĘŚĆ V — KONTRAKTY

### Sekcja standardowa — props i wzorzec

```typescript
// ✅ Sekcja przyjmuje props, nie fetchuje danych
interface HeroSectionProps {
  headline: string;       // plain text, NIGDY HTML
  sub: string;
  tier: 'S' | 'M' | 'L';
  videoSrc?: string;
}
```

### Sekcja z animacjami (Typ A)

```typescript
"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollRuntime } from "@/lib/scrollRuntime";

gsap.registerPlugin(ScrollTrigger);

export function ExampleSection() {
  const container = useRef<HTMLElement>(null);

  useGSAP(() => {
    // GSAP logika — identyczna z sandbox vanilla
    // scrollRuntime.requestRefresh("assets-loaded") po załadowaniu assetów
  }, { scope: container });

  return <section id="example-section" ref={container}>{/* ... */}</section>;
}
```

### Sekcja z fizyką (Typ B)

```typescript
"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { scrollRuntime } from "@/lib/scrollRuntime";

export function PhysicsSection() {
  const container = useRef<HTMLElement>(null);

  useGSAP(() => {
    let isFirst = true;
    let lastRaw = 0;

    const tick = () => {
      const raw = scrollRuntime.getRawScroll();
      if (isFirst) { lastRaw = raw; isFirst = false; return; }
      const dy = raw - lastRaw;
      lastRaw = raw;
      // ...fizyka/velocity na dy — IDENTYCZNA z sandbox...
    };

    gsap.ticker.add(tick);
    const onVis = () => { if (document.hidden) isFirst = true; };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      gsap.ticker.remove(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, { scope: container });

  return <section id="physics-section" ref={container}>{/* ... */}</section>;
}
```

### Makro-Sekcja (Bridge/Handoff)

```typescript
"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollRuntime } from "@/lib/scrollRuntime";
import { BRIDGE_CONFIG } from "./bridge.config";
import { createSnapFunction } from "./snap-gate";
import { setupGravityDrop } from "./gravity-drop";

gsap.registerPlugin(ScrollTrigger);

export function BridgeSequence({ headline, sub, tier }: BridgeProps) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const ctx = container.current!;

    // Timeline z jednym scope — widzi WSZYSTKIE elementy
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ctx,
        pin: true,
        scrub: 1,
        start: "top top",
        end: () => "+=" + window.innerHeight * BRIDGE_CONFIG.SCROLL_MULTIPLIER,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        snap: {
          snapTo: createSnapFunction(BRIDGE_CONFIG),
          inertia: false,
          directional: true,
          delay: BRIDGE_CONFIG.SNAP_DELAY,
          duration: BRIDGE_CONFIG.SNAP_DURATION,
          ease: "power2.out"
        }
      },
      defaults: { ease: "none" }
    });

    // Faza BRIDGE: Stats jadą w górę, Kinetic rodzi się od centrum
    // ... timeline logika 1:1 z sandbox ...

    // Faza KINETIC: snap points, bloki tekstu
    // ... timeline logika 1:1 z sandbox ...

    // GRAVITY DROP
    setupGravityDrop(tl, ctx, BRIDGE_CONFIG);

  }, { scope: container });

  return (
    <div id="bridge-section" ref={container} style={{ position: "relative", overflow: "hidden" }}>
      {/* WARSTWA A: Stats */}
      <div className="bridge-stats-layer">
        <h1 className={`bridge-title tier-${tier}`}>{headline}</h1>
        <p className="bridge-subtitle">{sub}</p>
        {/* Animowane liczby */}
      </div>

      {/* WARSTWA B: Kinetic */}
      <div className="bridge-kinetic-layer">
        {/* Bloby, bloki tekstu, cylinder canvas */}
      </div>
    </div>
  );
}
```

### Section Manifest (szablon)

```typescript
// src/sections/bridge-sequence/bridge.manifest.ts
export const BRIDGE_MANIFEST = {
  slug: "bridge",
  type: "B" as const,
  requires: ["scrollRuntime", "gsap"],
  warmup: [],                                // np. [{ import: () => import('three'), policy: 'idle' },
                                             //      { import: () => import('./BridgeSequence'), policy: 'near-viewport', rootMargin: '2000px' }]
  assets: [
    { kind: "video", src: "/bridge-bg.mp4", priority: "WARM" as const, critical: false },
    { kind: "img", src: "/bridge-poster.webp", priority: "HOT" as const, critical: true }
  ],
  refreshSignals: ["assets-loaded", "fonts-ready"],
  geometryMutable: false,                    // sekcja NIE zmienia wysokości po renderze
  scrollTriggersCount: 3,                    // orientacyjna liczba ST instancji (C10)
  dciProps: ["headline", "sub", "tier"],
  timelineContract: "./bridge.config.ts",    // LOCKED
  specialNotes: undefined,
  evidence: {
    pipelineComplete: true,
    auditComplete: true,
    reactTransformComplete: true,
    criticalBlockers: 0,
    platformGuards: 1
  }
} as const;

// src/sections/faq/faq.manifest.ts — PRZYKŁAD sekcji z mutowalną geometrią
export const FAQ_MANIFEST = {
  slug: "faq",
  type: "A" as const,
  requires: ["scrollRuntime", "gsap"],
  warmup: [],
  assets: [],
  refreshSignals: [],
  geometryMutable: true,                     // accordion zmienia wysokość dokumentu
  scrollTriggersCount: 0,                    // FAQ nie ma ScrollTrigger (C10)
  geometryRefresh: "none" as const,            // sekcja NIE woła requestRefresh sama
                                             // → integrator MUSI dodać hook useGeometryRefresh (B7.1)
                                             // Alternatywa: "self" = sekcja woła requestRefresh
                                             //   po każdej zmianie geometrii (weryfikacja w teście!)
  dciProps: [],
  specialNotes: "CSS transition na grid-template-rows (.pro-item = grid CONTAINER, transition jest na NIM). Marker data-geometry na każdym .pro-item (bo transitionend.target = element z transition = .pro-item). NIE na .pro-answer (child grida — marker na dziecku = sygnał zgubiony). Zakaz duration: 0s (C6.2).",
  evidence: {
    pipelineComplete: true,
    auditComplete: true,
    reactTransformComplete: true,
    criticalBlockers: 0,
    platformGuards: 0
  }
} as const;
```

### Referencyjny fix integratora — useGeometryRefresh hook (B7.1)

```typescript
// src/hooks/useGeometryRefresh.ts
// B7.1: Hook dla sekcji z geometryMutable: true + geometryRefresh: "none"
// Client boundary — NIE page.tsx (Server Component, useEffect tam nie działa)
// Import modułowy — NIE window.scrollRuntime (łamałoby C2)

"use client";
import { useEffect } from "react";
import { scrollRuntime } from "@/lib/scrollRuntime";

export function useGeometryRefresh(sectionId: string) {
  useEffect(() => {
    const sectionEl = document.getElementById(sectionId);

    // DEV gate: cicha porażka getElementById to najgorszy failure mode
    if (process.env.NODE_ENV === 'development' && !sectionEl) {
      console.warn(`[useGeometryRefresh] Element #${sectionId} not found. Check id.`);
    }
    if (!sectionEl) return;

    const onGeometryEnd = (e: TransitionEvent | AnimationEvent) => {
      // Filtr: hasAttribute na event.target (B7.2)
      // event.target = element na którym transition/animation się zakończyła
      // Przechodzi TYLKO jeśli ten element MA marker data-geometry
      // Ignoruje hover/focus/dekoracyjne transitions na elementach bez markera
      // NIE closest() — closest na przodku łapałby KAŻDY transitionend dziecka
      const target = e.target as HTMLElement;
      if (!target?.hasAttribute?.('data-geometry')) return;

      // scrollRuntime.requestRefresh() jest no-op jeśli runtime nie gotowy (C6)
      // Broker debounce'uje: wiele eventów z jednego toggle = 1 refresh
      scrollRuntime?.requestRefresh?.(`geometry-${sectionId}`);
    };

    // Oba eventy: transitionend (CSS transitions) + animationend (CSS @keyframes)
    // B7 dopuszcza obie metody — hook musi łapać obie
    sectionEl.addEventListener('transitionend', onGeometryEnd);
    sectionEl.addEventListener('animationend', onGeometryEnd);
    return () => {
      sectionEl.removeEventListener('transitionend', onGeometryEnd);
      sectionEl.removeEventListener('animationend', onGeometryEnd);
    };
  }, [sectionId]);
}

// Użycie w client boundary (np. SmoothScrollProvider lub layout wrapper):
// useGeometryRefresh('faq-section');
```

---

## CZĘŚĆ VI — WYJAŚNIENIA ARCHITEKTONICZNE

### VI.1 — Dlaczego singleton scrollRuntime, a nie Context/Provider?

React Context wymaga Provider zamontowany przed konsumentami. W Next.js 16 z Cache Components i streamingiem, kolejność mountowania nie jest gwarantowana. Singleton modułowy jest dostępny od momentu importu — nie czeka na React tree. `window.__scroll` zostawiamy wyłącznie jako alias do debug.

### VI.2 — Dlaczego GSAP ticker jako master clock?

Lenis z `autoRaf: true` + GSAP tworzą dwie niezależne pętle rAF = jitter. Rozwiązanie: Lenis `autoRaf: false`, GSAP ticker wywołuje `lenis.raf(time * 1000)`. Ticker Lenisa z `prioritize: true` — Lenis aktualizuje pozycję przed tickami sekcji.

### VI.3 — Dlaczego debounced requestRefresh?

10 sekcji zgłaszających "assets-loaded" jednocześnie = 1 refresh zamiast 10. Debounce 120ms + podwójny rAF czeka aż layout się ustabilizuje.

### VI.4 — Dlaczego Cache Components (`cacheComponents: true`), a nie czysty SSR?

90% strony identyczne dla każdego użytkownika (statyczny shell, edge cache, TTFB ≈ 0). Tylko hero zmienia się w zależności od URL params (dynamic hole, streamed). Next.js 16 zastępuje `experimental.ppr` mechanizmem Cache Components: `cacheComponents: true` włącza nowy model cachowania na poziomie komponentu z dyrektywą `use cache`. **Kluczowa uwaga:** `cacheComponents: true` włącza MODEL, ale nie cache'uje niczego automatycznie. Cachowanie jest **opt-in** — komponenty shell (Navbar, Footer) MUSZĄ mieć jawną dyrektywę `"use cache"`, inaczej renderują się per request i TTFB rośnie. Sekcje z DCI — ZAKAZ `"use cache"` (wariant zależy od searchParams per request). `React.cache()` (request-scoped deduplication) i `"use cache"` (cross-request caching) to **dwa różne mechanizmy** — nie mylić.

### VI.4.1 — Dlaczego React Compiler w trybie annotation, a nie ON/OFF?

GSAP mutuje DOM imperatywnie wewnątrz `useGSAP`. React Compiler optymalizuje przez automatyczną memoizację — eliminuje "niepotrzebne" re-rendery i stabilizuje closures. W sekcjach z GSAP to ryzyko. Dlatego: `compilationMode: 'annotation'` — domyślnie żaden komponent nie jest kompilowany. Czyste UI (navbar, footer) oznaczone `"use memo"` zyskują automatyczną memoizację → mniej re-renderów → lepszy INP. Sekcje z GSAP nie mają oznaczenia = compiler ich nie dotyka. Imperatywne zmienne (`let isFirst`, `let lastRaw`) wewnątrz `useGSAP` callback żyją w czystym scope JS i teoretycznie nie powinny być dotknięte nawet z pełnym kompilerem — ale annotation mode eliminuje ryzyko i daje pełną kontrolę. Escape hatch: `"use no memo"` na pliku jeśli potrzebne.

### VI.4.2 — Dlaczego Turbopack, a nie webpack?

Next.js 16 ma Turbopack jako domyślny bundler. Dla projektu z 8+ sekcjami GSAP, ciężkimi animacjami i iteracyjnym pipeline'em (test shell → transformacja → integracja): 5-10x szybszy Fast Refresh i 2-5x szybsze buildy produkcyjne to realny zysk. File System Caching (16.1) oznacza że restart dev servera nie rekompiluje od zera. Bundle Analyzer (16.1) daje precyzyjne narzędzie audytu rozmiarów chunków — wzmacnia bramkę B3. Deduplikacja działa identycznie jak w webpack. Fallback: `next build --webpack` / `next dev --webpack` jeśli Turbopack wygeneruje niespodziewane wyniki.

### VI.5 — Dlaczego DCI na serwerze?

Client-side DCI = CLS (flash defaultowej treści) + SEO (Googlebot widzi default) + Quality Score spadek. Server-side: H1 w pierwszym bajcie HTML.

### VI.6 — Dlaczego autoTier w Konstytucji, rozmiary w sekcji?

`autoTier()` to kontrakt (server, deterministyczny, pure). Co sekcja robi z tierem wizualnie — jej domena. Integrator oblicza tier, przekazuje jako prop. Sekcja mapuje na CSS.

### VI.7 — Dlaczego Cookiebot Manual + inline consent?

Auto-Blocking skanuje DOM = TBT. Manual + inline denied = natychmiastowy consent state, anonimowe pingi (Advanced Mode), 500ms buffer na cookie powracającego usera.

### VI.8 — Dlaczego content-visibility TYLKO na sekcjach bez ScrollTrigger?

`content-visibility: auto` mówi przeglądarce: "pomiń layout children tej sekcji dopóki nie wejdzie w viewport." ScrollTrigger kalkuluje `start`/`end` na podstawie pozycji i wymiarów **wewnętrznych** elementów (trigger, pin spacer, endTrigger). Nawet z `contain-intrinsic-size` na rootie — `contain-intrinsic-size` definiuje szacunkowy rozmiar kontenera, nie layoutuje children. Inicjalizacja ST zanim przeglądarka zrobiła pełny layout children = błędne `start`/`end` = broken pins, CLS.

Bezpieczne: FAQ, CTA, Footer, bloki tekstowe (zero ScrollTrigger). Niebezpieczne: sekcja z pinem, snap, animacją na scroll (Typ A i B). Safari: `content-visibility` ma częściowe wsparcie → graceful degradation (renderuje normalnie).

### VI.9 — HOT/WARM/COLD — polityka zasobów i rozdzielenie transfer vs CPU

**Transfer** (pobieranie danych) i **CPU** (odtwarzanie/dekodowanie) to dwa osobne problemy wymagające osobnych rozwiązań.

**HOT (krytyczny, 0-3s):** Przeglądarka ma ograniczoną przepustowość. Jeśli jednocześnie pobiera hero poster + video z sekcji 5 + obrazki z sekcji 8, wszystko się spowalnia. Hero poster który powinien pojawić się w 1.5s pojawia się w 4s bo bandwidth był dzielony. Dlatego HOT assety ładujemy natychmiast (`fetchPriority="high"`). To zawsze hero — element krytyczny dla planu LCP. Plan LCP musi jawnie określać co jest LCP elementem (poster, nie video). Reszta czeka.

**WARM (ważny, w tle po hero):** Hero się załadował, user go widzi. Teraz przeglądarka w tle zaczyna pobierać assety WARM. Dwa mechanizmy: `<link rel="prefetch">` w `<head>` (przeglądarka pobiera gdy ma wolną przepustowość) lub IntersectionObserver z dużym `rootMargin: "1500px"` (pobieranie zaczyna się gdy sekcja jest 1500px od viewportu — dużo wcześniej niż user ją zobaczy). User scrolluje przez sekcję 2, a video WARM z sekcji 4 już się pobiera w tle.

**COLD (luksusowy, na żądanie):** Assety z samego dołu strony lub hover-only dekoracje — IO z normalnym rootMargin. Nie ma sensu prefetchować ich jeśli user może nigdy nie dotrzeć. Przy `Save-Data: on` lub bardzo słabym łączu, COLD assety mogą w ogóle się nie załadować — UI musi działać bez nich.

**CPU gating (niezależny od klasy priorytetu):** Pobrane video które jest poza ekranem nie zużywa CPU — **pod warunkiem że jest spauzowane**. IntersectionObserver pauzuje video/canvas/Lottie gdy znikają z viewportu. Grające video poza ekranem nadal dekoduje klatki i zużywa procesor — to jest marnowanie zasobów które potem brakuje dla interakcji użytkownika (spadek INP). Wyjątek: hero video = eager load, eager play.

### VI.10 — Safari/iOS i position: fixed przy Lenisie

Lenis transformuje `<html>`. Fixed wewnątrz transformowanego rodzica = lag/skok/utrata fixed. Strategia: testuj fixed jako pierwszego podejrzanego, unikaj fixed w obrębie pinów, miej feature-flag "Lenis OFF".

### VI.11 — Dlaczego Scroll Source Split?

`lenis.scroll` = interpolowana (rampa). `lenis.targetScroll` = surowy target (skok). Typ B z własnym smoothingiem + wygładzone delty = podwójne wygładzanie → stłumiona velocity, "cofanie". Reguła spójności: jedno źródło dla velocity, to samo źródło dla init/reset/visibilitychange.

### VI.12 — Dlaczego Makro-Sekcja zamiast wrappera z dziećmi?

Bridge/Handoff łączy fazy o sprzecznych mechanikach scrolla (normalny → pinowany → normalny). Jeden timeline musi kontrolować elementy z wielu warstw. Wrapper z dziećmi + forwardRef = kruchość (Suspense, re-render, key change mogą zresetować węzeł DOM). Makro-Sekcja: jeden komponent, jeden `useGSAP`, jeden scope. Elementy targetowane lokalnie przez scope selector. Zero przekazywania refów. Integrator dostaje jeden klocek.

### VI.13 — Dlaczego Three.js przez dynamic import + warmup?

Three.js ~600KB w initial bundle zabija LCP. `next/dynamic({ ssr: false })` leniwie mountuje **komponent React** który wewnątrz siebie importuje Three.js — Three.js NIE jest "wstrzykiwane w cykl renderowania virtual DOM". Jest importowane jako moduł JS i używane imperatywnie na canvasie. `next/dynamic` opóźnia załadowanie całego chunka.

**Warmup hint:** Przewaga `next/dynamic` = prostota (wbudowany loading fallback, error boundary, SSR exclusion). Wada: nie ma wbudowanego "zacznij pobierać wcześniej". Dlatego dodajemy `moduleLoader` z warmup policy — Three.js chunk zaczyna się pobierać w tle (idle / near-viewport) zanim sekcja się zamountuje. Gdy `next/dynamic` ją mountuje, chunk jest już w cache przeglądarki = natychmiastowy mount, zero black-frame.

Trzy sekcje importujące Three.js = jeden wspólny chunk (bundler deduplikuje). Makro-Sekcje z pinem ładowane dynamicznie muszą mieć skeleton rezerwujący wysokość (ochrona CLS + ScrollTrigger math).

### VI.14 — Dlaczego Module Loader w Shared Core Layer?

Dwie sekcje deklarują `requires: ['three']`. Bez moduleLoadera: każda robi `await import('three')` niezależnie. Z moduleLoaderem: jeden `import()`, cache, i dwa konsumenty dostają tę samą referencję. Dodatkowa wartość: warmup policy pozwala zacząć pobieranie w tle na `idle` lub `near-viewport`, zanim sekcja jest w ogóle widoczna. Eliminuje "black-frame" — moment gdy sekcja jest widoczna ale biblioteka jeszcze się ładuje.

### VI.15 — Dlaczego SplitText MUSI odpalać się po hydracji?

React przy hydracji porównuje server-rendered DOM z oczekiwanym wirtualnym drzewem. Jeśli SplitText rozbije `<h1>Zwiększ sprzedaż</h1>` na dziesiątki `<span>` PRZED hydracją — React zobaczy inny DOM niż wyrenderował na serwerze → hydration mismatch error → sekcja może się zepsuć.

Rozwiązanie: SplitText odpala się **wewnątrz** `useGSAP` (po hydracji). React już zakończył porównanie, GSAP bezpiecznie mutuje DOM. Jeśli animacja wejścia musi startować od razu: element ma `visibility: hidden` w CSS, SplitText rozbija go po hydracji, animacja odsłania. Zero mismatch, zero CLS (bo `visibility: hidden` rezerwuje miejsce).

`suppressHydrationWarning` **NIE jest rozwiązaniem** — maskuje warning ale React nadal trzyma referencje do starego drzewa DOM. Przy re-renderze (np. zmiana state w rodzicu) może wyrzucić trudne do debugowania błędy. Analogicznie: `data-headline` z którego JS generuje HTML = client-side rendering = mrugnięcie = CLS.

### VI.16 — Dlaczego React.cache() na getVariant()?

`generateMetadata()` i `page()` wywołują `getVariant()` niezależnie w jednym request cycle. Bez `React.cache()` — podwójny lookup. Dla prostego obiektu TS koszt marginalny, ale dla większych słowników lub asynchronicznych resolverów — realny zysk. Tani safeguard, zero ryzyka.

### VI.17 — Dlaczego GSAP w initial bundle i dlaczego ładuje się raz?

Gdy 8 sekcji robi `import gsap from "gsap"`, bundler (webpack/turbopack) **nie tworzy 8 kopii**. Tworzy jeden wspólny chunk z GSAP (~30KB gzip) i dołącza go do strony raz. Każda sekcja dostaje referencję do tego samego modułu w pamięci przeglądarki.

GSAP jest w initial bundle (nie dynamic import) z dwóch powodów: jest lekki (~30KB to mniej niż jeden średni obraz) i jest używany przez prawie każdą sekcję — lazy loading wymagałby koordynacji "czy GSAP jest już załadowany" w każdej sekcji, co komplikuje architekturę bez realnego zysku performance.

Three.js (~600KB) jest traktowane inaczej (dynamic import) właśnie dlatego, że jest ciężkie i używane tylko przez kilka sekcji. Ta sama zasada deduplikacji działa — trzy sekcje z Three.js = jeden chunk 600KB, nie 3×600KB.

### VI.18 — Dlaczego globalny refresh (przez brokera), nie lokalny?

FAQ accordion otwiera się → wysokość dokumentu rośnie o 200px → WSZYSTKIE ScrollTrigger instances poniżej FAQ mają stare `start`/`end` (bo były liczone od starej geometrii). Lokalny `scrollTriggerInstance.refresh()` aktualizuje JEDNĄ instancję. Ale instancja w sekcji Bridge (pin + snap) poniżej FAQ nadal ma stare wartości. Globalny `ScrollTrigger.refresh(true)` aktualizuje WSZYSTKIE — i to w poprawnej kolejności (wyższe triggery przed niższymi, bo piny wpływają na kalkulacje poniżej).

`scrollRuntime.requestRefresh(reason)` jest brokerem (C6): debounce 120ms + double rAF = coalescing (10 sygnałów → 1 refresh), safe timing (layout stabilny przed refresh), no spam. `ScrollTrigger.refresh(true)` = safe refresh (odłącza piny, mierzy, przywraca — bezpieczny nawet w trakcie aktywnego pinu).

Lokalny refresh jest akceptowalny WYŁĄCZNIE gdy zmiana geometrii jest w pełni izolowana (overlay absolutny, stała wysokość kontenera, zero wpływu na flow). W FAQ — zmiana wpływa na flow → globalny refresh obowiązkowy.

`transitionend` jest optymalnym sygnałem bo odpala PO zakończeniu CSS transition (layout już stabilny). Zakaz: sygnał W TRAKCIE animacji (C6.1) — to by wywołało refresh co klatkę = layout thrash. Edge case: `transitionend` nie odpala przy przerwanych tranzycjach (user klika szybciej niż trwa animacja). Mitygacja: debounce w requestRefresh czeka na stabilny layout — ostatni `transitionend` który odpali pokrywa FINALNY stan. Pośrednie stany nie są istotne bo ScrollTrigger mierzy w momencie refresh, nie w momencie sygnału.

---

## CZĘŚĆ VII — REJESTR RYZYK

| # | Ryzyko | Status | Plan awaryjny |
|---|--------|--------|---------------|
| R1 | Hero video vs LCP. Video może opóźnić LCP jeśli jest jedynym elementem above-fold. | Do rozstrzygnięcia PRZED integracją hero | Formalnie ustalić: co jest LCP (poster/obraz), kiedy startuje video, budżet transferu. BLOCKER dla hero — nie integrować bez decyzji. |
| R2 | Fixed overlay vs iOS/Safari + smooth scroll. | Znane | Testy real-device. Fallback: Lenis OFF / inny layout. |
| R3 | Auto-Blocking OFF (Cookiebot) vs compliance. | Akceptowane | Gating tagów musi być bezbłędny i audytowalny. |
| R4 | Indexowanie wariantów DCI. | Domyślnie: canonical bez parametrów | Jeśli chcemy indeksować warianty: formalna polityka + whitelist parametrów. |
| R5 | Duże Makro-Sekcje (500+ linii). | Akceptowane | Mitygacja: helpery jako czyste funkcje TS w tym samym folderze. Nie osobne React komponenty. |
| R6 | Pipeline refresh przy dynamic import sekcji z pinem. | Potencjalne | Skeleton placeholder + requestRefresh po załadowaniu. Testować ScrollTrigger math po lazy mount. |
| R7 | SplitText/DOM mutations vs hydration mismatch + re-render. | Rozwiązane | SplitText WYŁĄCZNIE wewnątrz useGSAP (po hydracji). Zakaz suppressHydrationWarning. Mutowane węzły w stabilnym subtree bez re-renderów (J9). Animacja wejścia: visibility: hidden → SplitText → animacja odsłania. |
| R8 | Turbopack edge cases z niestandardowymi wzorcami (GSAP ScrollTrigger pin + snap + dynamic imports). | Do monitorowania | Bundle Analyzer na bramce PR. Jeśli chunki mają niespodziewany rozmiar lub sekcja zachowuje się inaczej niż w test shell → natychmiast fallback na webpack (`--webpack`). |
| R9 | Activity Component (Next.js 16 + cacheComponents) zmienia semantykę mount/unmount przy nawigacji. Przy 2+ route'ach: poprzedni DOM może nie unmountować, a zostać ukryty → duplikaty ID, querySelector trafia w stary węzeł, ScrollTrigger łapie nie ten element. | Latent | Obecnie: single page, zero route transitions = bezpieczne. **Jeśli projekt dostaje 2. route:** albo wyłączamy Activity dla tych route, albo engine sekcji NIE używa `document.getElementById`/`querySelector` bez zawężenia do bieżącego route root (np. `container.querySelector` zamiast `document.querySelector`). |

---

## CZĘŚĆ VIII — BRAMKI I EGZEKWOWANIE

| # | Bramka | Kiedy | Kto |
|---|--------|-------|-----|
| B1 | Evidence Pack kompletny (pipeline + audyt + react transform) | Przed oddaniem sekcji integratorowi | Fabryka |
| B2 | Manifest sekcji istnieje i jest poprawny (slug/type/requires/assets HOT·WARM·COLD/warmup/geometryMutable) | Przy odbiorze sekcji | Integrator |
| B3 | Zero regresji CWV (INP/CLS/LCP) po dodaniu sekcji | Przed merge PR | CI/Lighthouse |
| B4 | Zero leaków (RAF/listeners/observers) po odmontowaniu sekcji | Przed merge PR | DevTools/test |
| B5 | RUM (Real User Monitoring) dla Web Vitals aktywny na produkcji | Po wdrożeniu | Integrator |
| B6 | Smoke UX: scroll przez całą stronę + podstawowe interakcje na target devices | Przed merge PR | Integrator |
| B7 | Timeline Contract LOCKED — brak zmian w `*.config.ts` bez zgody autora | Zawsze | Wszyscy |

---

## CZĘŚĆ IX — CHECKLIST INTEGRACJI

### Per sekcja

- [ ] Manifest przeczytany (typ A/B, HOT/WARM/COLD assets, warmup policy, Timeline Contract)
- [ ] Evidence Pack: pipeline ✓, audyt ✓, react transform ✓, criticalBlockers = 0
- [ ] Import w `page.tsx` z odpowiednim priorytetem (normal / dynamic / dynamic+lazy, wg warmup policy)
- [ ] Skeleton placeholder jeśli dynamic import + sekcja z pinem
- [ ] Props DCI podpięte (headline, sub, tier) jeśli sekcja wymaga
- [ ] Stabilna geometria (min-height / aspect-ratio / explicit dimensions — wg B5, nie zawsze min-height)
- [ ] Brak globalnego CSS, brak kolizji ID/keyframes
- [ ] Jeśli sekcja używa SplitText/mutacji DOM: sprawdzić że mutowane węzły są w stabilnym subtree (J9)
- [ ] `content-visibility: auto` TYLKO jeśli sekcja nie ma ScrollTrigger wewnątrz (G5)
- [ ] Manifest: `geometryMutable` true/false. Jeśli true: `geometryRefresh` "self" lub "none"
- [ ] Jeśli `geometryMutable: true` → sekcja ma ≥1 element z `data-geometry` w HTML (B7.2). Brak = BLOCKER
- [ ] Jeśli `geometryMutable: true` + `geometryRefresh: "none"` → `useGeometryRefresh(sectionId)` w client boundary (B7.1)
- [ ] Callbacki `onEnter`/`onLeave`/`onToggle` — idempotentne z guardem (J10). Wyjątki: `scrub`, `once: true`, `onRefresh`
- [ ] `isolation: isolate` na rootowym elemencie sekcji (B9)
- [ ] Manifest: `scrollTriggersCount: N` (C10). Suma globalna ≤ 40
- [ ] Event listenery wheel/touchmove/touchstart — `{ passive: true }` (C11). Wyjątek w specialNotes
- [ ] One-shot animacje: `willChange: "auto"` na onComplete (J11). Tier 0 = obowiązkowe
- [ ] Interaktywne elementy mają CSS `:active` state (G13 Ghost States)

### Hero / Above the fold

- [ ] Hero asset: `priority={true}` + `fetchPriority="high"`
- [ ] Preload hero asset w Server Component. Jeśli `<video>` — jawny `<link rel="preload">` na poster (F9)
- [ ] `generateMetadata()` generuje dynamiczny title/description/OG
- [ ] LCP element (poster/image) max 3-4 poziomy od `<section id="hero">` (B8)
- [ ] Elementy hero animowane natychmiast: `will-change: transform, opacity` w statycznym CSS (J11.1)
- [ ] Video: Cover Image Pattern (img overlay, nie natywny poster). Przejście na `playing` event (G8)
- [ ] Video MP4: `ffprobe` → moov atom na początku pliku (faststart) (G14)
- [ ] **View Source** → Ctrl+F URL hero postera → MUSI być w surowym HTML (preload scanner test)

### Globalnie (raz dla projektu)

- [ ] `SmoothScrollProvider` owija `{children}` w `layout.tsx`
- [ ] `lenis.css` zaimportowany w `globals.css`
- [ ] `scrollRuntime.ts` z `prioritize: true` na ticker Lenisa
- [ ] `moduleLoader.ts` z warmup policy skonfigurowaną wg manifestów sekcji
- [ ] `orientationchange` listener z `requestRefresh`
- [ ] Inline Default Consent jako pierwszy element `<head>`
- [ ] Cookiebot: Manual mode, Auto-Blocking OFF, `next/script` `afterInteractive`
- [ ] GA4 transport URL → sGTM
- [ ] `next/font/google`: Lexend (variable, `display: 'swap'`) + Fraunces (italic 400, `display: 'optional'`), `adjustFontFallback: true`
- [ ] Weryfikacja: DevTools → Network → plik fontu < 50KB (subsetting sprawdzian)
- [ ] `reactCompiler: { compilationMode: 'annotation' }` w `next.config.ts`
- [ ] `cacheComponents: true` w `next.config.ts`
- [ ] `images: { formats: ['image/avif', 'image/webp'], deviceSizes: [dopasowane do breakpointów] }` w `next.config.ts` (G15)
- [ ] `<link rel="dns-prefetch">` dla sGTM (NIE preconnect). `<link rel="preconnect">` TYLKO dla CDN obrazków jeśli inny origin (G7)
- [ ] `scrollbar-gutter: stable` na `html` w `globals.css`
- [ ] Weryfikacja w produkcyjnym HTML: CSS jest inlinowane w `<style>` (Next.js App Router robi to automatycznie — jeśli nie, debug Turbopack)
- [ ] Weryfikacja w DevTools Network: hero poster serwowany jako AVIF (nie WebP/JPEG) na Chrome/Safari
- [ ] Ciężkie skrypty marketingowe (GTM, Meta Pixel): `strategy="lazyOnload"` (nie `afterInteractive`)
- [ ] Navbar i Footer mają dyrektywę `"use cache"` (bez tego shell nie jest cached!)
- [ ] Statyczne sekcje (FAQ, CTA, Footer) mają `"use cache"` (opcjonalne, darmowy zysk)
- [ ] Sekcje z DCI (hero) NIE mają `"use cache"`
- [ ] RUM Web Vitals aktywny
- [ ] Bundle Analyzer (`npx next-bundle-analyzer`) — weryfikacja deduplikacji GSAP/Three.js przed wdrożeniem

### Testy integracyjne

- [ ] Scroll przez całą stronę — zero jumpów, zero CLS
- [ ] Szybki scroll góra-dół — zero velocity spike, zero "cofania"
- [ ] Wielokrotne przejście przez Bridge/Handoff (góra-dół-góra) — zero degradacji
- [ ] Tab switch → powrót → zero spike
- [ ] Orientation change → layout poprawny → ScrollTrigger start/end poprawne
- [ ] Mobile Safari iOS (real device): smooth scroll, fixed elements, hero load
- [ ] Chrome Android (real device): smooth scroll, video lazy load, consent banner
- [ ] Desktop Chrome/Firefox/Safari: sanity check
- [ ] Lighthouse: LCP < 2.5s, CLS < 0.1, INP ≤ 200ms
- [ ] **Real Device Zen-Test (P75 INP — raz na sprint):** Samsung Galaxy A13 / Redmi 9 / telefon za 500 PLN. Wyłącz WiFi, włącz dane mobilne (real 3G, NIE DevTools throttling). Wyczyść cache. Otwórz stronę. W ciągu 3s po zobaczeniu hero — kliknij accordion FAQ. Jeśli czujesz opóźnienie — masz problem INP. Lighthouse nie wyłapie tego co czuje palec na ekranie.
- [ ] ScrollTrigger count: `ScrollTrigger.getAll().length` w DevTools ≤ 40 (C10)
- [ ] DevTools → Network → `next/dynamic` chunk WARM sekcji ma `<link rel="modulepreload">` w `<head>`
- [ ] Google Ads landing page: H1 zgodny z wariantem URL, meta poprawne
- [ ] **Geometry-mutable test:** otwórz KAŻDY expand/accordion w każdej sekcji → sprawdź czy ScrollTrigger PONIŻEJ nadal trafia w snap/pin → sprawdź na DWÓCH breakpointach (desktop + mobile). Jeśli snap się rozjechał → brakuje requestRefresh
- [ ] **Szybkie klikanie accordion:** otwórz/zamknij 5× szybko → scroll do sekcji z pinem poniżej → pin startuje/kończy w poprawnym miejscu

---

## CHANGELOG

| Wersja | Zmiany |
|--------|--------|
| v1.0 | Inicjalna wersja. |
| v1.1 | Pipeline guarantees, refocus na integratora. |
| v1.2 | Makro-Sekcje, Timeline Contract, asset loading strategy, transformation rules, bramki, risk register. |
| v1.2.1 | Wyjaśnienie GSAP loads once, rozszerzenie asset loading o transfer vs CPU, VI.15. |
| v1.3 | Synteza po przeglądzie konkurencyjnym (Gemina v2.0). HOT/WARM/COLD, Module Loader, warmup policy, Słownik Pojęć, J7-J8 (SplitText), B1.1 (SSR+client subtree). |
| v2.0 | Migracja na Next.js 16 + konsolidacja poprawek. cacheComponents, Turbopack, React Compiler OFF, Bundle Analyzer, J5/E5/J8/J9/B5/L2/G2/G6 poprawki. |
| v2.1 | Hardening po przeglądzie 3 konsultantów. A3/G5/F10/H6 krytyczne, A6/B6/B1.1/G10 ważne, C7/F5/A4/R9 drobne. Fonty (Lexend+Fraunces), NoOrphans. |
| v2.2 | Kuloodporność geometrii — ScrollTrigger refresh po zmianie layoutu. B7 (geometryMutable + refreshSignal w manifeście), C6.1 (anty-perf), C6.2 (zakaz duration: 0s), VI.18 (globalny vs lokalny refresh). Manifest, checklist, testy integracyjne. |
| v2.3 | Hardening po 4 rundach audytu adwokata diabła. B7 rozbite na B7/B7.1/B7.2/B7.3: filtr data-geometry marker z hasAttribute. RO doprecyzowany. useGeometryRefresh hook. Rename refreshSignal → geometryRefresh. J10 idempotencja. |
| v2.3.1 | Mikrokorekty: B7.1 animationend + sekcje dynamiczne. B7.3 settle debounce. F8.1 safe renderer. hooks/ folder. FAQ specialNotes. R1 BLOCKER. |
| v2.4 | Optymalizacja performance — LCP/INP/CLS. G11 (Device Tier 0/1/2), G12 (contain), J11 (GPU cleanup), A7 (React 19 Actions). G2/G7/G10/F9/I7/H8 rozszerzenia. AVIF, scrollbar-gutter, lazyOnload. |
| v2.5 | **Zen Performance — wiedza z okopów top agencji.** NOWE REGUŁY: G13 (CSS Ghost States — `:active` feedback bez JS, perceived INP ≈ 0 w oknie pre-hydracji), G14 (Video faststart — moov atom, ffmpeg -movflags +faststart), G15 (Image Variant Budget — deviceSizes/qualities jawnie, uwaga AVIF cold-start), B8 (Shallow LCP — hero poster max 3-4 poziomy), B9 (`isolation: isolate` na sekcjach — paint containment -60-80%, bezpieczniejsze niż contain: layout), C10 (ScrollTrigger Budget — soft limit 40, batching > N triggerów per item), C11 (Passive event listeners — wheel/touchmove/touchstart MUSZĄ być passive), J11.1 (pre-rasteryzacja hero — will-change w statycznym CSS = 60fps od klatki 1), J12 (scheduler.yield() rekomendacja dla ciężkich initów >50ms). ROZSZERZENIA: G7 (dns-prefetch dla sGTM zamiast preconnect — chroni bandwidth), G8 (Video Cover Pattern — img overlay na video, przejście na `playing` event, zakaz natywnego poster), G12 (downgraded do opcjonalny — B9 isolation jest lepsze), A4 (Fraunces display: optional zamiast swap — 15KB zysk na 3G, zero CLS). CHECKLIST ZEN: Real Device Zen-Test (Samsung Galaxy A13, real 3G, kliknij accordion w 3s — palec na ekranie > Lighthouse), View Source preload scanner test, font subsetting weryfikacja, ScrollTrigger count, modulepreload weryfikacja. SŁOWNIK: Ghost States, Cover Image Pattern. ODRZUCONE: prefers-reduced-data CSS (dead spec), C9 First Input Shield (pokryte przez J12 + IO gate), G16 Runtime Watchdog (do risk register, nie domyślna reguła). |
