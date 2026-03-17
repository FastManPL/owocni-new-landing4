<execution_status>PROCEED</execution_status>

────────────────────────────────────────
KROK 1: Stack-Harness
────────────────────────────────────────

WYGENEROWANY — warunek P2B-01: refreshSignals niepuste ['section-in-view', 'layout-settle']

CSS sanity-check: PASS — wszystkie selektory mają prefix #blok-4-5-section
(poza @keyframes blok-4-5-*, @property --blok-4-5-*, które są exempt).

Plik: blok-4-5.stack.html (4083 linii)
Spacery: 150vh above-spacer + fake-above 80vh + fake-pinned 200vh + sekcja + fake-accordion + 100vh below
scrollRuntime: stub (window.scrollY) — INT-* testują ST drift, NIE scrollRuntime policy

UWAGA MARKERS: init() zawiera ScrollTrigger.defaults({markers:false}) (ENT-ST-GLOBAL-01 owner:ZOSTAWIAMY)
który nadpisuje harness markers:true. Markery ScrollTriggerów SEKCJI nie będą widoczne z ?debug=1.
Markery fake-pinned ST (ustawione jawnie) BĘDĄ widoczne.
Ocena INT-01/02/03/04: po ZACHOWANIU animacji, nie po markerach sekcji.

────────────────────────────────────────
KROK 2: Section Manifest
────────────────────────────────────────

```
SECTION_MANIFEST:

  slug:     'blok-4-5'
  type:     'B'
  requires: ['scrollRuntime', 'gsap', 'ScrollTrigger', 'three']

  webgl:
    enabled:           true
    role:              'important'
    canvasOwnership:   'runtime'
    shaderComplexity:  'medium'
    textureMemoryMB:   2
    warmup:            'near-viewport'
    gpuWarmup:         []
    fallback:          'hidden'
    offscreenPolicy:
      disposeAfterMs:  30000

  assets:
    - kind:     'img'
      src:      'Ludzie.webp (picture: Ludzie.avif/webp 1800×627, Ludzie-Small.avif/webp 720×627)'
      priority: 'HOT'
      critical: true
      lcp:      false

  warmup: ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']

  scrollTriggersCount: 5

  geometryMutable: false
  geometryRefresh: 'none'

  geometryContract:        'normal'
  syntheticContextAllowed: true
  entryExitInvariant:      false
  preserveExistingGuards:  true

  refreshSignals: ['section-in-view', 'layout-settle']

  export:
    mode: 'named'
    name: 'Blok45Section'

  slots: []

  dciProps: []

  timelineContract: undefined

  specialNotes:
    breakpoints:           ['370px', '599px', '600px', '601px', '639px', '640px', '768px', '900px', '1200px']
    platformGuards:        ['reduced-motion (brak — eyes fallback CSS)', 'iOS (eyes mobile CSS)', 'Safari (rIC fallback setTimeout)']
    cpuGatingMechanism:    'IO-pause/resume'
    cpuGatingPath:         1
    threeJsLoadStrategy:   'lazy dynamic import — full-URL (Safari compatible), loaded on glow tick trigger'
    envMapStrategy:        'requestIdleCallback → PMREMGenerator (fallback setTimeout 500ms)'
    eyesSubsystem:         'desktop: rAF cursor tracking 30fps, mobile: CSS keyframes only'
    internalIOSubsystems:  'mainLoopIO (200px), glowIO (0.1thr), manaIO (0.1thr) — koegzystencja z Factory IO bezpieczna (B-CPU-03)'
    mediaAttributeDiscrepancy: 'ACCEPTED: reference.html ma loading="lazy" fetchpriority="high" na <img>. Owner zostawia bez zmian.'

  integrationNotes:
    hasPin:                false
    hasSnap:               false
    affectsGeometryBelow:  false
    sensitiveTo:           []
    testWith:              []

  deliveryRisk: N/A

  perf:
    dynamicImport:       true
    isHero:              false
    gracefulDegradation: false
    preloadCandidates:   ['Ludzie.avif', 'Ludzie.webp', 'Ludzie-Small.avif', 'Ludzie-Small.webp']
    prefetchCandidates:  []
    coldCandidates:      []
    preconnectDomains:   ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']
    containApplied:      false
    warnings:            ['PERF-W6', 'PERF-W7', 'PERF-W9', 'PERF-W13']

  scrollRuntimeRecommendations:
    - 'is-scrolling pointer-events guard (body.is-scrolling section * { pointer-events: none })'

  runtimeChecks:
    CLN-01: 'PENDING'
    SM-01:  'PENDING'
    SM-02:  'PENDING'
    INT-01: 'PENDING'
    INT-02: 'PENDING'
    INT-03: 'PENDING'
    INT-04: 'PENDING'
    WGL-01: 'PENDING'
    WGL-02: 'PENDING'
    WGL-03: 'PENDING'
```

**dynamicImport: true** — owner potwierdził (sekcja poniżej foldu + Three.js lazy + ciężki JS).

**GL-OFF-01 [MANIFEST-CHECK]:** OK — disposeAfterMs: 30000 ustawione
(shaderComplexity: 'medium', textureMemoryMB: 2 — warunek spełniony: shaderComplexity !== 'low').

**GL-FALLBACK-01 [MANIFEST-CHECK]:** OK — webgl.role: 'important' + webgl.fallback: 'hidden'
Macierz: important → 'hidden' dozwolone.

**DI-HERO-01:** OK — isHero: false, dynamicImport: false → brak konfliktu.

────────────────────────────────────────
KROK 3: Evidence Pack
────────────────────────────────────────

```
═══════════════════════════════════════
EVIDENCE PACK — blok-4-5
═══════════════════════════════════════

AUDYT WEJŚCIA (P1): PASS
  namespace:     OK (wszystkie selektory #blok-4-5-section prefixed)
  lifecycle:     OK (init(container), cleanups[], return { pause, resume, kill })
  triaż:         Typ B potwierdzony (gsap.ticker mainLoop + Three.js rAF + eyes rAF + glow ticker)
  scroll split:  OK (5 ST, viewport-relative triggers)

CPU GATING (P2A): Ścieżka 1
  mechanizm:        IO→pause/resume
  gatingTarget:     root (container — brak pin)
  rootMargin:       clamp(200, round(1.0 * getVH()), 1200)px
  viewport source:  visualViewport.height (fallback: innerHeight)
  recreate on:      resize / orientationchange / visualViewport.resize TAK

AUTO-FIXy ZASTOSOWANE (P2A):
  - B-ISO-01: isolation: isolate na #blok-4-5-section (+ WARNING: z-index:2, position:fixed stars-canvas, mix-blend-mode:multiply — blend ograniczony do wnętrza, safe)
  - B-CPU-01: Factory IO gating (Ścieżka 1, rootMargin 1.0×VH)
  - ST-REFRESH-01: section-in-view IO + layout-settle setTimeout(1000ms)
  - NULL-GUARD-01: 7 lokalizacji guardowane (walkContainer, sparksCanvas, btn/btnWrap/glowEl, chosen popup)
  - IO-SAFE-01: mainLoopIO + glowIO + Factory IO — entries[0] guard
  - INP-LEAK-01: initPopup _onRevealClick extracted + cleanup, popup close handlers cleanup
  - contain: layout style — SKIP (position: fixed wewnątrz #blok-4-5-stars-canvas)

BRAMKI BEZPIECZEŃSTWA:
  B-CPU-03  [REVIEW]  idempotencja pause/resume:          OK (ticking guard w pause/resume)
  B-CPU-04  [REVIEW]  listener options:                    OK (passive: true wszędzie)
  B-CPU-05  [REVIEW]  cleanup order:                       OK (pause() → cleanups → timers → observers → gsap → stars → canvases)
  B-VEL-01  [—]       velocity reset resume:               N/A (brak velocity w mainLoop — walking velocity jest scroll-derived, nie ticker)
  B-VEL-02  [—]       velocity init:                       N/A
  B-REF-01  [STATIC]  requestRefresh:                      OK (scrollRuntime.requestRefresh w ST-REFRESH-01)
  B-REF-02  [STATIC]  refresh kaskada:                     OK (debounced 120ms resize + ST-REFRESH-01)
  B-GEO-01  [STATIC]  geometry:                            N/A (geometryMutable: false)
  B-PIN-01  [REVIEW]  pin refresh:                         N/A (brak pin)
  B-CSS-01  [STATIC]  CSS vs GSAP:                         OK (CSS transition na button ≠ GSAP targets; CSS animation gradient/eyes ≠ GSAP targets)
  B-ISO-01  [—]       isolation:                           AUTO-FIXED+WARNING(blend — ograniczony do wnętrza, safe)
  CLN-01    [RUNTIME]  cleanup:                            PENDING (owner: kliknij KILL w overlay)
  ST-01     [REVIEW]  ST idempotent:                       OK (stWalking/stUnderline once:true; stWaveTrigger.onEnter ma state guard; stWaveVis callbacks odwracalne)
  INP-01    [STATIC]  passive listeners:                   OK (touchmove passive, touchstart passive, scroll passive)
  INP-02    [STATIC]  pointermove:                         OK (eyes mousemove gated eyesPaused; Three.js mousemove dynamic OPT#8)
  MED-01    [STATIC]  media attributes:                    N/A (brak <video>)
  VAN-SPLIT [REVIEW]  SplitText:                           N/A
  J-GPU-01  [REVIEW]  GPU cleanup:                         OK (mainLoop ticker stopped isDead=true; transformToZostaja one-shot final)
  SM-01     [RUNTIME]  INIT AGAIN 3×:                      PENDING (owner: kliknij INIT AGAIN w overlay)
  SM-02     [REVIEW]  double callbacks:                    OK (stWalking/stUnderline once:true; stWaveTrigger onEnter ma state guard; stWaveVis idempotent)
  INIT-CPU-01 [REVIEW] long task init:                     WARNING: ~400 iteracji (particle pool POOL_SIZE=400) + DOM manipulation (10 walking chars). Koszt ~5-15ms.
  GL-CPU-01 [REVIEW]  GL loop:                             OK (rAF animate self-terminating gdy !state.hasActiveParticles)
  GL-CPU-02 [REVIEW]  GL pause:                            OK (threeRunning=false → rAF nie kontynuuje; OPT#8 listeners removed)
  GL-MEM-01 [REVIEW]  GL dispose:                          OK (dispose() — traverse scene, geometry.dispose(), material.dispose(), renderer.dispose(); starsState.dispose w kill())
  GL-WARM-01 [REVIEW] WARM state + compileAsync:           OK — Three.js engine de facto lazy-loaded (loadThreeDeps → dynamic import), EnvMap via rIC (OPT#4). Nie jest standard WARM (brak compileAsync) ale pełni tę samą funkcję: renderer gotowy przed pierwszym spawnem.
  GL-LC-01  [REVIEW]  lifecycle COLD/WARM/HOT/OFF:         OK — COLD: init() (Three.js nie załadowane), WARM: rIC→loadThreeDeps→envMap, HOT: wakeThreeLoop→animate, OFF: self-terminating rAF + dispose na kill()
  GL-IDLE-01 [REVIEW] rIC fallback:                        OK — requestIdleCallback z fallback setTimeout(500) (envMap generation)
  GL-MEM-02 [REVIEW]  GL resume:                           OK — animate/wakeThreeLoop nie tworzy nowych materiałów/tekstur. Material.clone() reużywa shader program.
  GL-TIER-01[REVIEW]  GL tier0:                            WARNING — brak jawnego fallbacku dla Tier 0 (no WebGL). webglRole=IMPORTANT → WARNING (nie STOP). Sekcja działa bez Three.js (fale, walking, glow — wszystko działa). Stars po prostu nie pojawiają się.
  GL-OFF-01 [MANIFEST-CHECK] timed dispose:                OK (disposeAfterMs: 30000 w manifeście)
  B-LC-RET-01 [STATIC] return handle:                      OK (return { pause, resume, kill })
  ST-CLEAN-01 [REVIEW] ST cleanup scope:                   OK (kill() iteruje gsapInstances[] z revert()+kill(); wszystkie 5 ST w gsapInstances[])
  INP-LEAK-01 [STATIC] named handlers:                     OK (patche zaaplikowane: initPopup _onRevealClick, popup close, eyes, button, resize, scroll — wszystkie named + cleanup)
  INIT-DOM-01 [STATIC] DOMContentLoaded w init:            OK (brak DOMContentLoaded/window.load w init; document.fonts.ready.then dozwolony)
  DEV-DEL-01  [REVIEW] overlay side-effects:               OK (FACTORY:DEV-OVERLAY:START/END zawiera wyłącznie overlay DOM, handlers, badge interval, frame meter rAF. Zero ST.defaults(), zero modyfikacji stanu sekcji. Cały kod w if (!DEBUG_MODE) return.)

PERFORMANCE (P2A):
  PERF-01   [—]       media attributes:    ACCEPTED — reference.html: loading="lazy" fetchpriority="high" na <img>. Owner zostawia bez zmian.
  PERF-02   [—]       contain layout:      SKIP (position: fixed wewnątrz sekcji — #blok-4-5-stars-canvas)
  PERF-03   [DEV]     telemetria:          INIT [?]ms | REFRESH [?]ms | ST 5 | DOM [?] | FRAME avg [?]ms
                                           (otwórz reference.html?debug=1 i sprawdź overlay)
  PERF-W6   [REVIEW]  >2 ticker/rAF:      WARNING — 4 źródła per-frame (mainLoop ticker, glowTickFn ticker, eyes rAF, Three.js animate rAF). Konsolidacja niewskazana (różne lifecycle). INFORMACYJNIE.
  PERF-W7   [REVIEW]  polskie znaki:       WARNING — ąćęłńóśźż w HTML. Lexend CDN auto-detects latin-ext. Sprawdź next/font config w produkcji.
  PERF-W9   [REVIEW]  will-change:         WARNING — #blok-4-5-stars-canvas (fixed, full-screen, WebGL) bez will-change w CSS. Three.js renderer zarządza canvas — redundantne. INFORMACYJNIE.
  PERF-W13  [REVIEW]  CSS+JS transform:    WARNING — .blok45-pupil-arm CSS animation + JS style.transform. NIE faktyczny konflikt (pair-a CSS, pair-b JS). INFORMACYJNIE.

ANTI-FOUC (P3 wypełni):
  PERF-04   [—]       inline styles JSX:  PENDING (P3)

DYNAMIC IMPORT (P3 wypełni):
  PERF-05   [—]       dynamic import:     PENDING (P3) — owner potwierdził TAK

STACK-HARNESS: WYGENEROWANY (warunek P2B-01: refreshSignals niepuste)
  scrollRuntime:       stub (window.scrollY) — INT-* testują ST drift, NIE scrollRuntime policy
  INT-01    [RUNTIME]  accordion expand:  PENDING (owner)
  INT-02    [RUNTIME]  pin above:         PENDING (owner)
  INT-03    [RUNTIME]  height change:     PENDING (owner)
  INT-04    [RUNTIME]  positioning invariance (stack.html ze spacerami 150vh/100vh):
                       PENDING (owner)
            Instrukcja: otwórz reference.html → zapamiętaj moment wejścia animacji.
            Otwórz stack.html (spacery 150vh nad sekcją) → przewiń do sekcji → odśwież → przewiń.
            PASS: animacje identyczne niezależnie od pozycji w dokumencie.
            FAIL: start/end przesunięty lub sekcja "odpływa" po spacerze.
            Najczęstsze przyczyny FAIL: trigger na inner element, document-relative start/end,
            brak ST-REFRESH-01 scaffold.

TESTY WEBGL (webgl.enabled: true):
  WGL-T1    [RUNTIME]  Wejście po COLD — pierwsza klatka płynna:     PENDING (owner)
  WGL-T2    [RUNTIME]  Wejście po WARM — brak szarpnięcia:           PENDING (owner)
  WGL-T3    [RUNTIME]  Wyjście < 10s i szybki powrót:                PENDING (owner)
  WGL-T4    [RUNTIME]  Alt+Tab / minimize — GPU idle:                 PENDING (owner)
  WGL-T5    [RUNTIME]  Czekaj 35s po wyjściu → powrót (timed dispose): PENDING (owner)

GL-OFF-01  [MANIFEST-CHECK]  timed dispose:  OK (disposeAfterMs: 30000)

EXTERNAL CDN LIBRARIES:
  https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.7/gsap.min.js → gsap
  https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.7/ScrollTrigger.min.js → ScrollTrigger
  https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js → THREE (import map)
  https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/ → three/addons/ (import map)

GSAP VERSION NOTE:
  reference.html: 3.12.7 CDN
  Produkcja: 3.12.7 (npm — spójne środowisko)
  P1 original: 3.12.5 → upgraded to 3.12.7 w reference
  Smoke test w repo wymagany po konwersji React (P3, DEVELOPER_HANDOFF.md)

SECTION POSITION INVARIANCE:
  sensitiveTo geometry-above:  NIE
  trigger_root:                PASS (stWaveVis: trigger=#blok-4-5-section=container)
  offset_model:                viewport-relative ("top bottom", "bottom top", "top 35%")
  refresh_mechanism:           ST-REFRESH-01 AUTO-FIXED (section-in-view IO + layout-settle 1000ms)
  ST-REFRESH scaffold:         AUTO-FIXED
  INT-04 positioning test:     PENDING (owner — stack.html wygenerowany)

WERDYKT: PASS — wszystkie STATIC/REVIEW bramki OK, RUNTIME do weryfikacji przez właściciela
  Owner decisions resolved: media attr ACCEPTED, dynamicImport=TAK, GL-TIER-01 ACCEPTED.
  Aktywne WARNING: INIT-CPU-01 (400-iter pool), GL-TIER-01 (brak jawnego Tier 0 fallback — ACCEPTED),
  PERF-W6/W7/W9/W13 (informacyjne).
  BLOCKER: BRAK.
  RUNTIME PENDING: CLN-01, SM-01, INT-01, INT-02, INT-03, INT-04, WGL-T1, WGL-T2, WGL-T3, WGL-T4, WGL-T5.

═══ RAW P2A EVIDENCE (verbatim) ═══
[Pełny P2A evidence pack — patrz plik blok-4-5-P2A-EVIDENCE.md]
Slug: blok-4-5 | Typ: B | Gating: Ścieżka 1
Bramki (summary):
  B-CPU-03 OK | B-CPU-04 OK | B-CPU-05 OK | B-REF-01 OK | B-REF-02 OK |
  B-CSS-01 OK | B-ISO-01 AUTO-FIXED+WARNING | ST-01 OK | ST-02 OK |
  ST-CLEAN-01 OK | DEV-DEL-01 OK | INP-01 OK | INP-02 OK |
  INP-LEAK-01 OK | INIT-DOM-01 OK | MED-01 N/A | VAN-SPLIT-01 N/A |
  J-GPU-01 OK | SM-02 OK | INIT-CPU-01 WARNING |
  GL-CPU-01 OK | GL-CPU-02 OK | GL-MEM-01 OK | GL-WARM-01 OK |
  GL-LC-01 OK | GL-IDLE-01 OK | GL-MEM-02 OK | GL-TIER-01 WARNING |
  GL-CTX-01 OK | B-LC-RET-01 OK | NULL-GUARD-01 OK | IO-SAFE-01 OK |
  TS-LINT-UNUSED-01 OK (adnotacja) | HTML-FONTSIZE-01 OK |
  CLN-01 PENDING | SM-01 PENDING
Guardy zachowane: TAK (null checks DOM ×7, visibilitychange ×2, IO ×3, resize ×debounced, eyesDead, isDead, _disposed)
Guardy dodane: _s._killed, Factory IO disconnect
═══ KONIEC RAW P2A EVIDENCE ═══
═══════════════════════════════════════
```

────────────────────────────────────────
KROK 4: Runtime Verification
────────────────────────────────────────

```
═══════════════════════════════════════
RUNTIME VERIFICATION — blok-4-5
Wykonaj przed przejściem do P3.
═══════════════════════════════════════

1. Otwórz reference.html?debug=1 w przeglądarce

TEST CLN-01 — Cleanup czystość:
   → PRZED KILL: zanotuj liczniki z DEV overlay (np. "ST: 5, DOM: N")
   → Kliknij KILL w DEV overlay
   → Sprawdź liczniki: pin-spacers powinny = 0
   → Sprawdź console (secondary): brak komunikatów o orphaned pin-spacers/styles
   → Kryterium PASS: pin-spacers = 0 po KILL, brak orphans w console
   → Wpisz w manifeście: runtimeChecks.CLN-01 = 'PASS' lub 'FAIL'

TEST SM-01 — StrictMode liczniki:
   → Kliknij INIT AGAIN 3× w DEV overlay
   → Po każdym kliknięciu sprawdź telemetrię (ST count): nie rośnie ponad 5
   → Sprawdź że eyes rAF, mainLoop ticker, glow ticker — nie duplikują się
   → Kryterium PASS: stabilne liczniki po 3 cyklach (ST=5 stale)
   → Wpisz: runtimeChecks.SM-01 = 'PASS' lub 'FAIL'

TEST SM-02 — Double callbacks:
   → Po INIT AGAIN: sprawdź console na duplikaty analytics / onEnter logów
   → Kryterium PASS: zero duplikatów (stWalking/stUnderline mają once:true)
   → Wpisz: runtimeChecks.SM-02 = 'PASS' lub 'FAIL'

2. Otwórz blok-4-5.stack.html?debug=1 w przeglądarce

TEST INT-01 — Pin stability (accordion geometry change):
   → Scrolluj przez FakePinnedAbove → do testowanej sekcji
   → Kliknij "Accordion: expand/collapse" 2-3× — czekaj na refresh po każdym
   → Sprawdź: wave reveal, walking animation, glow/button — zachowują się poprawnie
   → Kryterium PASS: animacje stabilne po każdym expand/collapse
   → Wpisz: runtimeChecks.INT-01 = 'PASS' lub 'FAIL'

TEST INT-02 — Geometry above (pin-spacer chain):
   → Przewiń przez FakePinnedAbove (pin 100vh) → wróć do sekcji
   → Sprawdź: wave reveal trigger, walking trigger, underline trigger — na właściwych pozycjach
   → Kryterium PASS: brak driftu triggerów po przejściu przez pin-spacer
   → Wpisz: runtimeChecks.INT-02 = 'PASS' lub 'FAIL'

TEST INT-03 — Dynamic height above:
   → Kliknij "FakeAbove: zmień wysokość" (80vh → 120vh → 40vh) — czekaj na refresh
   → Sprawdź: sekcja nadal działa poprawnie, wave/walking/glow bez przesunięcia
   → Kryterium PASS: brak efektów po zmianie wysokości above
   → Wpisz: runtimeChecks.INT-03 = 'PASS' lub 'FAIL'

TEST INT-04 — Positioning invariance (spacery 150vh/100vh):
   → KROK A: Otwórz reference.html → przewiń do sekcji → zapamiętaj:
     - Moment wejścia wave reveal (kiedy fale zaczynają się pojawiać)
     - Moment triggera walking animation ("i wychodzą")
     - Moment triggera underline ("zmienić")
   → KROK B: Otwórz stack.html → przewiń do sekcji (jest dalej — 150vh spacer + fake-above + fake-pinned)
     → Odśwież stronę na pozycji sekcji → przewiń ponownie
   → Porównaj momenty wejścia z KROK A:
     - Wave reveal: ten sam viewport % triggera?
     - Walking: ten sam viewport % triggera?
     - Underline: ten sam viewport % triggera?
   → Kryterium PASS: animacje identyczne niezależnie od pozycji w dokumencie.
     Dopuszczalne: ±1-2% odchyłka (layout-settle timing).
     FAIL: start/end przesunięty o >5% lub sekcja "odpływa" po spacerze.
   → Najczęstsze przyczyny FAIL:
     - trigger na inner element z document-relative offset
     - brak ST-REFRESH-01 scaffold (tu: jest — section-in-view + layout-settle)
     - stale geometry cache (tu: eyes buildEyeCache w resume — OK)
   → Wpisz: runtimeChecks.INT-04 = 'PASS' lub 'FAIL'

   UWAGA MARKERS: ScrollTrigger.defaults({markers:false}) w init() nadpisuje
   harness markers:true. Markery ScrollTriggerów SEKCJI nie będą widoczne.
   Oceniaj po ZACHOWANIU animacji, nie po markerach.

TESTY WEBGL (Three.js stars engine):

TEST WGL-T1 — First frame po COLD:
   → Odśwież stronę → przewiń do sekcji glow/button
   → Kliknij button kilka razy → stars powinny się pojawić
   → PASS: brak freeze > 100ms przy pierwszym pojawieniu stars
   → Wpisz: runtimeChecks.WGL-01 = 'PASS' lub 'FAIL'

TEST WGL-T2 — Wejście po WARM (envMap rIC):
   → Czekaj ~2s na stronie (rIC generuje envMap)
   → Przewiń do button → triggeruj stars
   → PASS: brak jakiegokolwiek szarpnięcia
   → Wpisz: runtimeChecks.WGL-01 update jeśli WGL-T1 OK

TEST WGL-T3 — Szybki powrót:
   → Triggeruj stars → przewiń poza sekcję
   → Wróć w < 10s → triggeruj ponownie
   → PASS: brak reinicjalizacji (particles kontynuują)
   → Notatka: self-terminating rAF — po wygaśnięciu particles, wakeThreeLoop restartuje

TEST WGL-T4 — Tab hidden:
   → Triggeruj stars → Alt+Tab (lub minimize)
   → Sprawdź DevTools Performance: zero draw calls gdy tab niewidoczny
   → PASS: GPU idle (visibilitychange → mainLoop stops, Three.js animate self-terminates)
   → Wpisz: runtimeChecks.WGL-02 = 'PASS' lub 'FAIL'

TEST WGL-T5 — Timed dispose (35s):
   → Triggeruj stars → przewiń poza sekcję → czekaj 35s
   → Wróć → triggeruj ponownie
   → PASS: poprawna reinicjalizacja z COLD (loadThreeDeps ponownie)
   → UWAGA: w bieżącym kodzie timed dispose NIE jest zaimplementowane
     (dispose tylko na kill). P3 doda timed dispose 30s per manifest.
     TEST WGL-T5 w obecnym kodzie → SKIP (brak mechanizmu).
   → Wpisz: runtimeChecks.WGL-03 = 'N/A (timed dispose — P3 doda)'

═══════════════════════════════════════
Po wykonaniu testów odpowiedz w tej sesji:

"RUNTIME RESULTS:
  CLN-01: PASS / FAIL [opis jeśli FAIL]
  SM-01:  PASS / FAIL [opis jeśli FAIL]
  SM-02:  PASS / FAIL [opis jeśli FAIL]
  INT-01: PASS / FAIL [opis jeśli FAIL]
  INT-02: PASS / FAIL [opis jeśli FAIL]
  INT-03: PASS / FAIL [opis jeśli FAIL]
  INT-04: PASS / FAIL [opis jeśli FAIL]
  WGL-T1: PASS / FAIL [opis jeśli FAIL]
  WGL-T2: PASS / FAIL [opis jeśli FAIL]
  WGL-T3: PASS / FAIL [opis jeśli FAIL]
  WGL-T4: PASS / FAIL [opis jeśli FAIL]
  WGL-T5: N/A (timed dispose — P3 doda)"

Fabryka po otrzymaniu wyników:
  → Wszystkie PASS/N/A → wpisuje wyniki do SECTION_MANIFEST (runtimeChecks)
    i generuje FINALNY MANIFEST gotowy do P3. Odpowiada: AKCEPTUJĘ.
  → Jakikolwiek FAIL → opisuje co jest nie tak i wskazuje
    co poprawić w vanilla przed powrotem do P2A.
    Nie generuje finalnego manifestu.

TWARDA BLOKADA P3 — wymagana przed przejściem:
[ ] CLN-01: właściciel kliknął KILL w ?debug=1 i potwierdził brak orphans
[ ] SM-01: właściciel kliknął INIT AGAIN 3× i potwierdził stabilne liczniki
[ ] INT-01: accordion expand/collapse — animacje stabilne
[ ] INT-02: pin-spacer chain — triggery bez driftu
[ ] INT-03: dynamic height above — brak przesunięcia
[ ] INT-04: positioning invariance — animacje identyczne ze spacerami
[ ] WGL-T1/T2: właściciel potwierdził płynne wejście Three.js stars
[ ] WGL-T4: właściciel potwierdził GPU idle na tab hidden

P3 NIE startuje jeśli jakikolwiek runtimeCheck = PENDING lub FAIL.
Brak wyjątków. Brak "wygląda OK". Brak "na pewno działa".
Niekompletny manifest = brak P3.
═══════════════════════════════════════
```

────────────────────────────────────────
KROK 5: Factory Handoff
────────────────────────────────────────

```
=== FACTORY HANDOFF ===
Step completed:  P2B (Harness + Manifest + Evidence)
Decision:        PROCEED — czeka na AKCEPTUJĘ właściciela

Pliki do repo:
  (brak — P2B nie generuje plików produkcyjnych)

Pliki NIE do repo:
  blok-4-5.stack.html         (integration harness — 4083 linii)
  blok-4-5.MANIFEST.txt       (tekst — P3 skonwertuje do .ts)
  blok-4-5.EVIDENCE.txt

Key state:
  slug               = blok-4-5
  type               = B
  hasPin             = NIE
  hasSnap            = NIE
  geometryMutable    = NIE
  dynamicImport      = TAK (owner potwierdził)
  isHero             = NIE
  webgl              = TAK (IMPORTANT, lazy-loaded, runtime canvas, medium shader)
  stack_harness      = WYGENEROWANY (P2B-01: refreshSignals niepuste)
  runtime_checks     = CLN-01 PENDING, SM-01 PENDING, SM-02 PENDING,
                       INT-01 PENDING, INT-02 PENDING, INT-03 PENDING, INT-04 PENDING,
                       WGL-01 PENDING, WGL-02 PENDING, WGL-03 PENDING (→N/A)

⚠️ OWNER DECISIONS (RESOLVED):
  1. MEDIA ATTR: ACCEPTED — owner zostawia loading="lazy" fetchpriority="high" bez zmian.
  2. dynamicImport: TAK — owner potwierdził.
  3. GL-TIER-01: ACCEPTED — fallback='hidden' przy webglRole='important' OK.

Następny krok:
  1. Otwórz reference.html?debug=1 → wykonaj testy CLN-01, SM-01, SM-02
  2. Otwórz blok-4-5.stack.html?debug=1 → wykonaj testy INT-01, INT-02, INT-03, INT-04
  3. Przetestuj WebGL: WGL-T1, WGL-T2, WGL-T3, WGL-T4
  4. Wpisz PASS/FAIL w manifeście (runtimeChecks)
  5. Odpowiedz AKCEPTUJĘ → przejdź do P3

P3 NIE startuje z jakimkolwiek runtimeCheck = PENDING.
```
