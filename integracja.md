# INTEGRACJA: Fakty → Kinetic → Block 4

# Makro-Sekcja (BridgeSequence)

**Status:** W TRAKCIE — wszystkie 3 sekcje przeanalizowane
**Wersja dokumentu:** 0.4
**Konstytucja:** v2.8
**Zgodność z Pipeline:** E1 (Makro-Sekcja), E2 (zakaz slotowego wrappera), E5 (helpery TS)

---

## 1. CEL

Dwa przejścia, dwa różne mechanizmy:

### Przejście 1: Fakty → Kinetic = MAKRO-SEKCJA (wrapper z pinem)

- **Warstwa FAKTY** (jedzie w górę jak normalny scroll)
- **Warstwa KINETIC** (rodzi się od centrum, scrub timeline, snap)
- Jeden komponent React, jeden `useGSAP`, jeden scope, jeden timeline z fazami

### Przejście 2: Kinetic → Block 4 = CURTAIN REVEAL (bez wrappera)

- **KINETIC** zamraża się na ostatniej klatce (Gravity Drop kupka / snap3)
- **BLOCK 4** scrolluje NAD zamrożoną Kinetic (z-index wyższy, bg: transparent)
- Wave Reveal (Kipiel/ORG SVG) zasłania resztki Kinetic
- Block 4 **NIE MOŻE** być w wrapperze — ma 8 elementów `position: fixed`

---

## 2. DLACZEGO MAKRO-SEKCJA — UZASADNIENIE

### Problem: Fake Bottom

Fakty ma content wycentrowany (flexbox center) — kończy się ~60-65vh od topu sekcji.
Kinetic ma content od centrum/dołu — puste ~35-40vh u góry.
Gdyby sekcje stały sekwencyjnie w DOM → ~35vh martwego scrolla (identyczne tło #f7f6f4, zero contentu).
Użytkownik myśli że strona się skończyła = **fake bottom**.

### Rozwiązanie: Wrapper

Obie sekcje (+ Block 4) w jednym pinowanym kontenerze.
Fakty jedzie `yPercent: -100` w fazie BRIDGE.
Kinetic "otwiera się" jednocześnie — puste strefy pokrywają się.
Block 4 najeżdża na końcu jako kurtyna (Curtain Reveal).

### Dlaczego nie lekkie alternatywy

| Próba                                  | Dlaczego odrzucona                                                |
| -------------------------------------- | ----------------------------------------------------------------- |
| Sekwencyjna integracja (zero wrappera) | Fake bottom ~35vh                                                 |
| CSS `position: fixed` + spacer         | L1 (Safari/iOS), zmiana modelu sekcji, nie praca integratora      |
| Pre-pin tease ST                       | Particles napędzane przez pinnedTl — przy progress=0 canvas pusty |
| Naturalny handoff z tease blobów       | Bloby mają rosnąć dopiero po pinie (design intent)                |

---

## 3. DESIGN INTENT — CO WIDZI UŻYTKOWNIK

### Overlap window (Fakty + Kinetic jednocześnie)

```
┌─── VIEWPORT ───────────────┐
│   FAKTY — content (litery)  │  bg: transparent → widać #f7f6f4
│   FAKTY — pusto na dole     │  bg: transparent → widać #f7f6f4
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│  ← identyczne tło, zero granicy
│   KINETIC — particles/bloby │  bg: #f7f6f4, content rośnie
│                             │
└─────────────────────────────┘
```

Kluczowe:

- Fakty ma `background: transparent` **celowo** — nie przykrywa Kinetic
- Puste strefy (dół Fakty, góra Kinetic) **zaprojektowane do wzajemnego pokrywania**
- Bloby rosną gdy Fakty wyjechało z ekranu (= pin aktywny, bridge zone)
- Particles Kinetic napędzane przez pinnedTl — żyją dopiero w bridge

### Fakty wyjechało → Kinetic pełny ekran

```
┌─── VIEWPORT ───────────────┐
│                             │
│   KINETIC — pin aktywny     │  bloby rosną, particles formują "!"
│   bridge zone → snap gate   │  Block 1 tekst wchodzi
│                             │
└─────────────────────────────┘
```

### Kinetic → Block 4 (Curtain Reveal)

```
┌─── VIEWPORT ───────────────┐
│   KINETIC — snap3 zamrożona │  Block 3 + cylinder 98% + bloby warm
│   (statyczna, pin trwa)     │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│   BLOCK 4 — najeżdża       │  z-index wyższy, bg: transparent
│   (kurtyna od dołu)        │  Wave SVG zakrywa resztki Kinetic
└─────────────────────────────┘
```

---

## 4. SEKCJA FAKTY — ANALIZA KODU

### Plik źródłowy

`fakty_organic_v7__14___11___3_.html` (1008 linii)

### Typ sekcji

**Typ B** — ma rAF loop (organic engine ~30fps)

### Struktura DOM

```html
<section id="fakty-section">
  <div class="title-block" id="fakty-block">
    <canvas id="fakty-tunnel"></canvas>
    <!-- tunnel perspective -->
    <div class="title-dom" id="fakty-dom"></div>
    <!-- litery FAKTY / SĄ TAKIE -->
    <canvas id="organic-overlay"></canvas>
    <!-- organic lines + flares -->
  </div>
</section>
```

### 6 ScrollTriggerów (krytyczne — tracą kontekst w wrapperze!)

| #        | Nazwa             | Trigger    | Start             | End             | Co robi                     |
| -------- | ----------------- | ---------- | ----------------- | --------------- | --------------------------- |
| st1      | rotationX liter   | row1       | `center bottom`   | `top top+=20%`  | 3D flip liter FAKTY         |
| st2      | opacity liter     | row1       | `center bottom`   | `top top+=54%`  | Fade-in liter               |
| st3      | scaleY wiersza 2  | faktyBlock | `center bottom`   | `top top`       | "SĄ TAKIE" rośnie           |
| frameST  | video fill frames | row1       | `top top+=61%`    | dynamiczny      | Klatki video w literach     |
| tunnelST | tunnel canvas     | faktyBlock | `top bottom`      | `bottom top`    | Perspektywiczny tunel liczb |
| orgST    | organic overlay   | faktyBlock | `top bottom-=30%` | `bottom center` | Linie + flary               |

### Async boundaries (C6.3)

- `document.fonts.ready.then()` (linia 967) — **wszystkie** ST tworzone wewnątrz
- `createImageBitmap()` (linia 846) — tunnel atlas
- Brak `requestRefresh` po żadnym z nich (OK w PREVIEW, problem w produkcji)

### Organic Engine (rAF loop)

- 30fps throttle (`orgLoop`, timestamp-based)
- Gated przez `orgActive` (włączany/wyłączany przez frameST callbacks)
- Renderuje: primary/secondary bezier lines, flares, grid lines
- Offscreen canvas snapshot + live flare overlay
- **Cleanup:** `disableOrganic()` + canvas width/height = 0

### Resize handling

- `ScrollTrigger.refresh(true)` w resize handler (linia 930) — **łamie C6** w produkcji
- Trzeba zmienić na `scrollRuntime.requestRefresh('fakty-resize')` przy transformacji

### Co musi się stać z Fakty w Makro-Sekcji

1. **Wszystkie 6 ST muszą zniknąć** — ich zachowanie przeliczone na pozycje w timeline wrappera
2. Organic engine: `orgState.progress` napędzany z pozycji w pinnedTl (nie z własnego ST)
3. Tunnel: `tunnelDraw(step)` wywoływany z pozycji w pinnedTl
4. Frame scroll: `playhead.frame` napędzany z pozycji w pinnedTl
5. `visibility: hidden` → `visible` na `faktyBlock` — kontrolowane przez timeline
6. rAF loop organic: gating przeniesiony na `_sectionVisible` wrappera

---

## 5. SEKCJA KINETIC — ANALIZA KODU

### Plik źródłowy

`index_clean__139_.html` (4070 linii)

### Typ sekcji

**Typ B** — ma ticker functions (particle, tunnel, cylinder, adaptive DPR)

### Struktura DOM

```html
<div id="kinetic-section">
  <div class="nigdy-glow"></div>
  <div class="blob-carrier">
    <div class="blob-bg-preview"></div>
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>
  </div>
  <canvas id="kinetic-tunnel-canvas"></canvas>
  <canvas id="kinetic-particle-qmark-canvas"></canvas>
  <div class="content-wrapper">
    <div class="text-block" id="kinetic-block-1">...</div>
    <div class="text-block" id="kinetic-block-2">...</div>
    <div class="text-block" id="kinetic-block-3">...</div>
  </div>
  <div id="kinetic-cylinder-wrapper">
    <canvas id="kinetic-cylinder-canvas"></canvas>
  </div>
  <div class="kinetic-vignette"></div>
</div>
```

### Główny ScrollTrigger (pin)

```javascript
trigger: container,           // #kinetic-section
start: "top top",
end: () => '+=' + (svh * BRIDGE_MULTIPLIER + SCROLL_KINETIC),
pin: true,
scrub: true,
anticipatePin: 0,
invalidateOnRefresh: true,
```

### Timeline structure

- **TOTAL_U** = I + KINETIC_U (bridge + kinetic)
- **I** = I_BASE \* BRIDGE_MULTIPLIER (2.1) — bridge zone w timeline units
- **KINETIC_U** = 23.0
- **Bridge spacer:** `pinnedTl.to({}, { duration: I }, 0)` — rezerwacja
- **SNAP1_U** = B1_FULL_DRAW_U (Block 1 pełne wyrysowanie)
- **SNAP2_U** = I + 9.5
- **SNAP3_U** = I + 23.0

### Snap Gate (State Machine v3)

- Strefy: bridge | kinetic
- `_handleIntent(dir)` — jedyny właściciel nawigacji snap
- `_reconcileFromScroll()` — strażnik strefy
- `_lenisSnap1Handler` — magnet wejścia do SNAP1
- `_kineticObserver` — ScrollTrigger.observe() na container

### Canvas engines (4 IIFE)

1. **Particle Qmark** — formowanie "!" → obrót "?" → collapse
2. **Tunnel** — obręcze wokół "!" (velocity-based)
3. **Cylinder** — obracający się cylinder z liczbami
4. (Organic engine — **to jest w Fakty, nie w Kinetic**)

### Co musi się stać z Kinetic w Makro-Sekcji

1. **pinnedTl pozostaje** — ale trigger zmienia się na wrapper (nie container)
2. **Bridge zone powiększa się** — faza Fakty-out (yPercent: -100) dochodzi PRZED istniejącym bridge
3. **Snap points przeliczone** — bo TOTAL_U się zmienia
4. **State Machine** — GRAB_START/BRIDGE_END/HYS przeliczone
5. **Canvas engines** — `_s.pinnedTl` referencja musi wskazywać na wrapper timeline
6. `_sectionVisible` — sterowany przez wrapper, nie przez pinnedTl callbacks

---

## 6. SEKCJA BLOCK 4 — ANALIZA KODU

### Plik źródłowy

`blok-4-5-fixed-final__12_.html` (3574 linii)

### Typ sekcji

**Typ B** — ma ticker functions (mainLoop, glowTick), rAF gating, Three.js WebGL renderer

### Struktura DOM

```html
<div id="blok-4-5-section">
  <!-- WAVE REVEAL — SVG kurtyna zasłaniająca Kinetic -->
  <div id="blok-4-5-wave-wrap">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <path class="wave-path" />
      × 4
    </svg>
  </div>

  <!-- POPUP overlay (z-index: 9999) -->
  <div class="overlay">...</div>

  <section style="position: relative; z-index: 1;">
    <div id="blok-4-5-block-4">
      <!-- INTRO TEXT (wchodzi od dołu) -->
      <div class="text-above-illustration">
        <div class="blok45-intro-line1">Potencjalni klienci</div>
        <div class="blok45-intro-line2">wchodzą na stronę</div>
        <div class="blok45-intro-line3">rozglądają się…</div>
      </div>

      <!-- "i wychodzą" — walking animation -->
      <div class="void-section-wrapper">
        <p class="void-section">
          <span id="blok-4-5-anchorChar">i </span>
          <span class="walking-text-container"></span>
          <canvas id="blok-4-5-iHeatCanvas"></canvas>
        </p>
      </div>

      <!-- Ilustracja ludzie (desktop 1800×627, mobile 720×627) -->
      <div class="full-width-image"><picture>...</picture></div>

      <!-- "Możemy to zmienić" -->
      <div class="text-on-illustration-bottom">
        <h1>Możemy to <span class="gradient-text-reveal">zmienić</span></h1>
      </div>
    </div>

    <!-- BLOCK 5 content (konwersja, glow, button, stars) -->
    <div id="blok-4-5-block-5-content">...</div>
  </section>

  <!-- FIXED ELEMENTS (poza sekcją, w dokumencie) -->
  <div class="mana-container" id="blok-4-5-manaContainer">...</div>
  <div id="blok-4-5-stars-canvas"></div>
  <!-- Three.js WebGL renderer tu się mountuje -->

  <!-- Canvasy fixed dodawane dynamicznie przez JS: -->
  <!-- #blok-4-5-sparksCanvas (z:10) -->
  <!-- #blok-4-5-bubble-layer (z:100) -->
</div>
```

### CSS — kluczowe

```css
#blok-4-5-section {
  position: relative;
  z-index: 2; /* NAD Kinetic (z:1) */
  background: transparent; /* Kinetic prześwieca pod spodem */
}
```

### 8 elementów position: fixed (BLOCKER dla wrappera!)

| Element                  | z-index | Opis                                             |
| ------------------------ | ------- | ------------------------------------------------ |
| `#blok-4-5-stars-canvas` | 50      | Three.js WebGL renderer (gwiazdki przy buttonie) |
| `#blok-4-5-sparksCanvas` | 10      | Canvas iskier                                    |
| `#blok-4-5-bubble-layer` | 100     | Bąbelki                                          |
| `#blok-4-5-iHeatWrapper` | 150     | Heat distortion na "i"                           |
| `.mana-container`        | 100     | Pasek many (progress bar)                        |
| `.speech-bubble`         | fixed   | Dymki mowy                                       |
| `.thought-bubble`        | fixed   | Dymki myśli                                      |
| `.overlay` (popup)       | 9999    | Popup z kafelkami rabatowymi                     |

**Dlaczego BLOCKER:** Pin tworzy `will-change: transform` na przodku → `position: fixed` staje się fixed relative do kontenera, nie do viewportu. Wszystkie 8 elementów traci pozycjonowanie.

### ScrollTriggery w Block 4

| #             | Trigger                         | Start                       | Typ             | Co robi                     |
| ------------- | ------------------------------- | --------------------------- | --------------- | --------------------------- |
| stWaveVis     | `#blok-4-5-section`             | `top bottom` / `bottom top` | visibility gate | Wave wrap display on/off    |
| stWaveTrigger | waveAnchor (voidSectionWrapper) | `top bottom`                | once-like       | Startuje Kipiel (wave open) |
| stWaveScroll  | waveAnchor                      | `top bottom` / `bottom 75%` | scrub           | Scroll-driven wave close    |
| stUnderline   | `#blok-4-5-mozemy-to-zmienic`   | `top 35%`                   | once            | Animacja "zmienić" SVG      |
| stWalking     | `#blok-4-5-voidSection`         | `top 35%`                   | once            | Start walking animation     |
| mainLoopIO    | container                       | IntersectionObserver        | gate            | Pause/resume mainLoop       |

### Wave Reveal — Dual Engine

- **Kipiel (OPEN):** time-based, elastyczna animacja zasłaniania (SVG paths od dołu do góry)
- **ORG (CLOSE):** scroll-driven, miękka animacja odsłaniania
- State machine: IDLE_CLOSED → KIPIEL_OPENING → IDLE_OPEN → ORG_CLOSING → IDLE_CLOSED
- Wave jest **kurtainą** — zasłania Kinetic pod spodem gdy Block 4 wchodzi

### Three.js Stars Engine

- `THREE.WebGLRenderer` z `alpha: true`
- Mountuje się do `#blok-4-5-stars-canvas`
- PMREMGenerator + RoomEnvironment (deferred via requestIdleCallback)
- RoundedBoxGeometry × 14 particles
- **Import maps** w test shell — BLOCKER Safari < 16.4 (VI.19)

### Test shell — symulacja Kinetic

```html
<div
  class="kinetic-standin"
  style="position: fixed; top:0; left:0; width:100%; height:100vh; background:#2a2130; z-index:1;"
>
  <div class="blok3-sim">
    <div class="small-header-sim">Nagłówek sekcji</div>
    <div class="line-sim">Linia tekstu pierwsza</div>
    <div class="line-sim">Linia tekstu druga</div>
    <div class="bold-line-sim">nie stanie się jej klientami.</div>
  </div>
</div>
```

### DO USUNIĘCIA przy integracji

1. **`kinetic-standin`** — cały div (symulacja, prawdziwa Kinetic będzie pod spodem)
2. **`kinetic-pin-spacer`** — div 100vh (symulacja pin-spacera GSAP)
3. **Tło fioletowe `#2a2130`** — Block 4 ma `bg: transparent`, Kinetic jest widoczna
4. **`blok3-sim` tekst** — symulacja ostatniej klatki Kinetic (Block 3 "nie stanie się jej klientami")
5. **Import maps** — Three.js przez bundler w Next.js (VI.19 BLOCKER Safari < 16.4)

---

## 7. ARCHITEKTURA — DWA MECHANIZMY

### 7A. MAKRO-SEKCJA: Fakty + Kinetic (wrapper z pinem)

Block 4 jest **POZA** wrapperem (8 fixed elementów = BLOCKER).

#### Struktura DOM (plan)

```html
<!-- MAKRO-SEKCJA: Fakty + Kinetic -->
<div
  id="bridge-wrapper"
  style="position: relative; overflow: hidden; height: 100vh;"
>
  <!-- WARSTWA A: Fakty (jedzie w górę) -->
  <div id="fakty-layer" style="position: absolute; inset: 0; z-index: 2;">
    <!-- Cały DOM Fakty -->
    <!-- background: transparent (celowe — nie przykrywa Kinetic) -->
  </div>

  <!-- WARSTWA B: Kinetic (rodzi się od centrum) -->
  <div id="kinetic-layer" style="position: absolute; inset: 0; z-index: 1;">
    <!-- Cały DOM Kinetic -->
  </div>
</div>
<!-- Pin-spacer generowany przez GSAP ScrollTrigger automatycznie -->

<!-- POZA WRAPPEREM: Block 4 (Curtain Reveal) -->
<div
  id="blok-4-5-section"
  style="position: relative; z-index: 2; background: transparent;"
>
  <!-- Block 4 + Block 5 DOM -->
  <!-- Scrolluje NAD zamrożoną Kinetic (Curtain Reveal) -->
</div>
```

#### Wrapper constraints (ze strategii)

- `#bridge-wrapper` i rodzice: **ZERO** transform/filter/perspective (łamie pin!)
- `overflow: hidden` na wrapperze
- `height: 100svh` z fallbackiem `100vh`
- `isolation: isolate` (B9)

### 7B. CURTAIN REVEAL: Kinetic → Block 4

#### Mechanika — zero otwartych pytań

Standardowe zachowanie GSAP pinu. Podczas pinu wrapper ma `position: fixed` — Kinetic
stoi na ekranie, zamrożona na snap3. Block 4 leży w DOM za pin-spacerem i scrolluje
normalnie (Lenis) NAD zamrożoną Kinetic. Wave Reveal (SVG Kipiel) zakrywa resztki.

**Potwierdzone przez test shell Block 4** — `kinetic-standin` (`position: fixed; z-index: 1`)
jest dokładną symulacją pinu GSAP. Block 4 (`position: relative; z-index: 2; bg: transparent`)
scrolluje nad nim. Test shell = produkcja.

#### End pinu musi pokrywać wjazd Block 4

`end` wrappera = scroll Kinetic + dodatkowy scroll żeby Block 4 zdążył zakryć ekran:

```
end: () => '+=' + (scrollKinetic + window.innerHeight)
                   ↑                ↑
                   │                └── ~100vh: Block 4 wjeżdża od dołu na full
                   └── scroll konsumowany przez timeline (bridge + kinetic)
```

Ostatnie ~100vh scrolla: timeline na progress=1 (zamrożony), pin nadal trzyma wrapper
na ekranie, Block 4 najeżdża. Gdy Block 4 zakryje cały viewport → pin odpuszcza →
wrapper odjeżdża → użytkownik tego nie widzi (Block 4 już wszystko przykrywa).

#### Sekwencja — zweryfikowana z kodu obu sekcji

```
1. Kinetic snap3: Block 3 + cylinder 98% + bloby warm + vignette (zamrożone)
2. User scrolluje dalej → pin trwa, timeline na 100%
3. Block 4 wjeżdża od dołu (z:2, bg: transparent → Kinetic prześwieca)
4. "Potencjalni klienci wchodzą na stronę" — litery od dołu
5. voidSectionWrapper wchodzi w viewport → Kipiel (wave SVG) startuje
6. Wave SVG zakrywa Kinetic: #f5ede1 → #ebe3d1 → #edd9d0 → #f7f6f4 (= tło strony)
7. Po wave: czyste tło, Block 4 przejmuje cały ekran
8. Pin odpuszcza (niewidocznie — Block 4 już zasłania wrapper)
```

#### Zgadza się z test shell Block 4

| Test shell (kinetic-standin)         | Kinetic (snap3)                            |
| ------------------------------------ | ------------------------------------------ |
| `position: fixed; z:1`               | Pin GSAP = `position: fixed`               |
| `background: #2a2130`                | Bloby warm + vignette + bgPreview          |
| `blok3-sim: top:50%; left:21%`       | Block 3: `top:50%; yPercent:-50; left:21%` |
| "nie stanie się jej klientami." bold | Block 3 bold line                          |
| Mobile: `top: calc(145px + 21.1svh)` | Identyczne pozycje mobile                  |

### Timeline — fazy (plan)

```
FAZA BRIDGE (U:0 → U:INTRO_END)
├── Fakty: yPercent 0 → -100 (faux scroll, 1:1 z palcem)
├── Fakty animacje: rotationX, opacity, scaleY, frame scroll, organic, tunnel
│   (przeliczone z 6 ST na pozycje w timeline)
├── Kinetic bloby: scale birth, opacity fade
├── Kinetic particles: formowanie od pierścienia
└── Crossover: ~50-60% bridge — Fakty content u góry + Kinetic content u dołu

FAZA KINETIC (U:INTRO_END → U:SNAP3)
├── Snap Gate (trzy strefy: bridge → grab → kinetic)
├── Block 1, Block 2, Block 3 animacje
├── Cylinder, tunnel, blob keyframes, nigdy, vignette
└── Snap3 = ostatnia klatka (Block 3 + cylinder 98% + bloby warm + vignette)

FAZA PAUZA (U:SNAP3 → U:END) — timeline progress = 1, pin trwa
├── Kinetic zamrożona na snap3 (statyczna)
├── ~100vh dodatkowego scrolla (Block 4 wjeżdża nad pinowanym wrapperem)
└── Pin odpuszcza gdy Block 4 zakryje cały viewport (niewidocznie)

BLOCK 4: Curtain Reveal (poza wrapperem, normalny Lenis scroll)
├── Scrolluje NAD Kinetic (z-index: 2 > z-index: 1)
├── background: transparent → Kinetic widoczna pod spodem
├── Wave Reveal (Kipiel SVG) zasłania resztki Kinetic
├── "Potencjalni klienci wchodzą na stronę" wchodzi od dołu
└── Walking animation, illustration, "Możemy to zmienić"
```

---

## 8. KRYTYCZNY PROBLEM: 6 ScrollTriggerów FAKTY

Wewnątrz wrappera z `pin: true`, trigger elementy Fakty nie poruszają się scrollem
(wrapper jest fixed). Wszystkie 6 ST mierzy pozycję elementu w dokumencie →
pozycja nie zmienia się → progress nie rośnie → animacje zamrożone.

### Rozwiązanie: przeliczenie na pozycje w timeline wrappera

Każdy ST musi zostać zamieniony na animację w `pinnedTl` z odpowiednią pozycją startową.

| Oryginalny ST     | Co robi               | Strategia przeliczenia                                                           |
| ----------------- | --------------------- | -------------------------------------------------------------------------------- |
| st1 (rotationX)   | 3D flip liter         | `pinnedTl.to(row1Chars, { rotationX:0, z:0 }, pos)` — pozycja = proporcja bridge |
| st2 (opacity)     | Fade-in liter         | `pinnedTl.to(row1Chars, { opacity:1 }, pos)`                                     |
| st3 (scaleY)      | "SĄ TAKIE" rośnie     | `pinnedTl.to(row2Word, { scaleY:1 }, pos)`                                       |
| frameST (frames)  | Video fill klatki     | Playhead napędzany z timeline position, `onUpdate`                               |
| tunnelST (tunnel) | Perspektywiczny tunel | `onUpdate` z pinnedTl progress → `tunnelDraw(step)`                              |
| orgST (organic)   | Linie + flary         | `orgState.progress` tweenowany w pinnedTl                                        |

### Timing w bridge

Oryginalne ST mają `start: "center bottom"` / `"top bottom"` — czyli aktywują się
gdy element wchodzi w viewport od dołu. W wrapperze to odpowiada:

- **Wejście w viewport** = "użytkownik jeszcze nie scrolluje" = progress ~0
- **Element u góry viewportu** = "element wyjechał" = odpowiada jakiejś pozycji w bridge

Precyzyjne mapowanie wymaga analizy:

- Jaki jest stosunek `faktyBlock.offsetHeight` do `window.innerHeight`?
- W PREVIEW: ile px scrolla zajmuje przejście od `center bottom` do `top top+=20%`?
- Te proporcje → pozycje w bridge timeline

**TO JEST PRACA FABRYKI — deweloper musi to zmierzyć i przeliczyć.**

---

## 9. SNAP GATE — AKTUALIZACJA

Snap Gate z dokumentu strategii **zostaje** — ale progi się przeliczają:

```
STARA MAPA (tylko Kinetic):
TOTAL_U = I + 23.0
BRIDGE_END = SNAP1_U / TOTAL_U
GRAB_START = b1Start / TOTAL_U

NOWA MAPA (z fazą Fakty):
TOTAL_U = FAKTY_PHASE + I + 23.0    ← FAKTY_PHASE = nowe units na zjazd Fakty
BRIDGE_END = (FAKTY_PHASE + SNAP1_U) / TOTAL_U
GRAB_START = (FAKTY_PHASE + b1Start) / TOTAL_U
KINETIC_SNAPS = [...].map(u => u / TOTAL_U)  ← wszystkie przesunięte
```

State Machine v3: logika identyczna, zmienione wartości progów.

---

## 10. STRATEGIA PRZEJŚCIA 2: KINETIC → BLOCK 4

### Potwierdzone kodem obu sekcji — zero otwartych pytań

Kinetic zamraża się na snap3 (Block 3 + cylinder + bloby). Pin trwa. Block 4
scrolluje nad nią. Wave Reveal zakrywa resztki. Standardowy GSAP pin + z-index.

### Sekwencja (zweryfikowana)

```
1. Kinetic snap3: zamrożona (Block 3, cylinder 98%, bloby warm, vignette)
2. Pin trwa, timeline progress = 1
3. Block 4 scrolluje nad (z:2, bg: transparent)
4. "Potencjalni klienci wchodzą na stronę" — litery od dołu
5. Kipiel wave → SVG zakrywa Kinetic (#f5ede1 → #ebe3d1 → #edd9d0 → #f7f6f4)
6. Czyste tło, Block 4 przejmuje ekran
7. Pin odpuszcza (niewidocznie)
```

### End wrappera — musi pokryć wjazd Block 4

```
end: () => '+=' + (scrollKinetic + window.innerHeight)
```

Dodatkowe ~100vh: timeline zamrożony, pin trzyma, Block 4 wjeżdża.

### Artefakty do usunięcia z kodu Kinetic (jeśli istnieją)

```html
<div style="height: 2100px;"></div>
<!-- SPACER — USUNĄĆ -->
```

```css
.stage-scroll {
  margin-top: -220vh;
} /* USUNĄĆ */
```

### Artefakty do usunięcia z kodu Block 4

```html
<!-- CAŁY test shell — usunąć przy integracji: -->
<div class="kinetic-standin">...</div>
<div class="kinetic-pin-spacer"></div>
```

- Tekst `blok3-sim` ("Nagłówek sekcji / Linia tekstu...") = placeholder symulujący snap3
- Tło fioletowe `#2a2130` na standin = placeholder (Kinetic ma swoje kolory)
- Import maps → bundler imports (VI.19 BLOCKER Safari < 16.4)

### Block 4 — co NIE wymaga zmian

- Wave Reveal (Kipiel/ORG) — działa niezależnie od tego co jest pod spodem
- Walking animation — `once: true` trigger, niezależny od Kinetic
- Three.js stars — hover/click triggered, nie scroll
- Popup overlay — niezależny
- Wszystkie fixed elementy — działają poprawnie BO Block 4 jest poza pinem

---

## 11. OTWARTE PYTANIA

### Rozwiązane

- ~~Kod Block 4~~ → przeanalizowany, 3574 linii
- ~~Block 4 w wrapperze czy poza?~~ → **POZA** (8 fixed elementów = BLOCKER)
- ~~Curtain Reveal mechanika~~ → Wave Reveal (Kipiel/ORG SVG) potwierdzona przez test shell
- ~~Jak Kinetic "zostaje" na ekranie?~~ → Standardowy GSAP pin. End wrappera += 100vh. Block 4 zakrywa przed odpięciem.
- ~~Gravity Drop~~ → Usunięty. Kinetic kończy się statyczną pauzą na snap3.

### Do decyzji

1. **Ile units faza Fakty w bridge?** — do zmierzenia (4 = placeholder w strategii)
2. **SCROLL_MULTIPLIER wrappera** — do wyliczenia

### Do zweryfikowania w Fabryce

3. **Organic engine w wrapperze** — czy rAF loop gated przez wrapper `_sectionVisible` wystarczy?
4. **Tunnel atlas w wrapperze** — `createImageBitmap` async → timing cleanup (C6.3)
5. **Snap points po dodaniu fazy Fakty** — przeliczenie + weryfikacja
6. **Mobile Safari: wrapper + pin + Lenis** — test na real device (L1)
7. **Block 4 import maps → bundler** — Three.js (VI.19 BLOCKER Safari < 16.4)
8. **Block 4 Wave Reveal timing** — czy Kipiel trigger (`top bottom` na voidSectionWrapper) pasuje gdy prawdziwa Kinetic jest pod spodem zamiast standin?

---

## 12. ZGODNOŚĆ Z KONSTYTUCJĄ

| Reguła                  | Status | Uwagi                                                     |
| ----------------------- | ------ | --------------------------------------------------------- |
| E1 (Makro-Sekcja)       | ✅     | Jeden komponent, jeden useGSAP, jeden scope               |
| E2 (zakaz slotowy)      | ✅     | BridgeSequence gotowa z Fabryki, nie składana             |
| E3 (scope selector)     | ✅     | Jeden root ref + querySelectorAll                         |
| E5 (helpery TS)         | ✅     | Logika Fakty/Kinetic jako czyste funkcje                  |
| B1 (izolacja)           | ✅     | Makro-Sekcja to JEDNA sekcja                              |
| B9 (isolation:isolate)  | ✅     | Na wrapperze                                              |
| C6 (refresh broker)     | ✅     | requestRefresh zamiast ScrollTrigger.refresh              |
| C6.3 (async boundary)   | ⚠️     | fonts.ready, createImageBitmap — do obsłużenia            |
| J3 (GSAP nienaruszalna) | ⚠️     | Timing Kinetic zachowany, ale Fakty ST→timeline = rewrite |
| K2 (Timeline Contract)  | ⚠️     | Kinetic snap/timing LOCKED, ale bridge faza jest NOWA     |
| L1 (Safari fixed+Lenis) | ⚠️     | Test na real device obowiązkowy                           |

---

## 13. PLIKI DO PRZEKAZANIA DEWELOPEROWI

1. **Ten dokument** (integracja.md)
2. **Konstytucja v2.8** (CONSTITUTION_v2_7_patched.md)
3. **P4 Developer Guide** (P4_DEVELOPER_GUIDE.md)
4. **P4 Integrator** (P4*INTEGRATOR\_\_3*.md)
5. **Kod Fakty** (fakty_organic_v7.html) — 1008 linii
6. **Kod Kinetic** (index*clean\_\_139*.html) — 4070 linii
7. **Kod Block 4** (blok-4-5-fixed-final\__12_.html) — 3574 linii
8. **Strategia Bridge/Handoff** (dokument z 16 lutego — wklejony w rozmowie)
9. **Strategia Kinetic → Block 4** (brief techniczny — wklejony w rozmowie)
10. **Snap Gate** (finalne rozwiązanie — wklejony w rozmowie)

---

## CHANGELOG

| Wersja | Zmiany                                                                                                                                                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1    | Inicjalny dokument po analizie Fakty + Kinetic                                                                                                                                                                                                                                               |
| 0.2    | Odrzucenie lekkich alternatyw, decyzja: Makro-Sekcja                                                                                                                                                                                                                                         |
| 0.3    | Pełna analiza 6 ST Fakty, design intent overlap, plan architektury                                                                                                                                                                                                                           |
| 0.4    | Analiza Block 4 (3574 linii). Potwierdzenie: Block 4 POZA wrapperem (8 fixed = BLOCKER). Curtain Reveal potwierdzony przez test shell. Wave Reveal (Kipiel/ORG) = kurtaina SVG. Architektura rozbita na 7A (Makro-Sekcja: Fakty+Kinetic) + 7B (Curtain Reveal: Kinetic→Block4).              |
| 0.5    | Weryfikacja kodu: koniec Kinetic (snap3 = statyczna pauza, Gravity Drop usunięty) + początek Block 4 (test shell = dokładna symulacja pinu GSAP). Usunięte opcje A/B/C — jedno rozwiązanie: end wrappera += 100vh, Block 4 zakrywa przed odpięciem. Zero otwartych pytań architektonicznych. |
