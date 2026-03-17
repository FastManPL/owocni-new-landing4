<execution_status>PROCEED</execution_status>

════════════════════════════════════════
KROK 1: Kontekst z P1
════════════════════════════════════════

Slug: blok-4-5
Typ: B (gsap.ticker mainLoop + Three.js rAF animate() + eyes rAF)
CDN Libraries: gsap 3.12.5 (→ 3.12.7 w reference), ScrollTrigger, THREE 0.160.0 (full-URL import)
OBSERVATIONS z P1:
  - ENT-ST-GLOBAL-01: ScrollTrigger.defaults({markers:false}) — owner decision: ZOSTAWIAMY (no-op)
  - ENT-LC-03: Three.js engine nie zarządzany przez pause/resume (self-terminating rAF, OPT#8 dynamic)
  - ENT-LC-06: Wewnętrzne IO subsystemy (mainLoopIO, glowIO, mana IO) nie zatrzymywane przez pause()
  - ENT-JS-09: window._blok45Debug — za DEV GATE, null-guarded

Geometry contract (P1-01):
  geometryContract = normal
  syntheticContextAllowed = true
  preserveExistingGuards = true

Questionnaire answers:
  hero = NIE
  Ludzie.webp/avif = HOT
  degradation = NIE
  webglRole = IMPORTANT

════════════════════════════════════════
KROK 2: Conversion Plan
════════════════════════════════════════

<conversion_plan>
=== CONVERSION PLAN ===

SLUG: blok-4-5
TYP: B

1. CPU GATING — ścieżka:

   WYJĄTEK PIN: NIE — brak pin:true w żadnym ScrollTrigger sekcji.
   (stWaveVis, stWaveTrigger, stWaveScroll, stUnderline, stWalking — żaden nie ma pin:true)

   Sekcja MA niezależne pętle:
   - gsap.ticker.add(mainLoop) — walking animation + particles
   - Three.js requestAnimationFrame(animate) — 3D stars (self-terminating)
   - eyes requestAnimationFrame(eyeTick) — cursor tracking (desktop)
   - gsap.ticker.add(glowTickFn) — glow animation

   → Ścieżka 1 (Typ B → IO wywołuje pause()/resume())

   isWebGL: TAK (Three.js renderer, canvasOwnership: runtime)
   → rootMargin = 1.0 × VH = clamp(200, round(1.0 * getVH()), 1200)px

   isHF: TAK — eyes mousemove per-frame, ALE eyes ma wewnętrzny eyesPaused guard
   w pause/resume (ENT-LC-03 hooki). Factory IO woła pause() → eyePauseFn() → done.
   Nie wymaga Ścieżki 3b — eyes jest zarządzany przez Typ B lifecycle.

   Pin sekcja: NIE
   data-gating-target: N/A (brak pin)

   Koegzystencja z internal gating: TAK
   Sekcja ma wewnętrzne IO:
   - mainLoopIO (rootMargin: 200px) — gating mainLoop ticker
   - glowIO (threshold: 0.1) — gating glow ticker
   - mana IO (threshold: 0.1) — CSS class toggle
   B-CPU-03 PASS (pause/resume mają ticking guard) + ENT-LC-06 PASS → koegzystencja bezpieczna

   Internal IO subsystemy (z OBSERVATION P1): TAK
   mainLoopIO, glowIO, mana IO — pause() sekcji NIE zatrzymuje tych IO.
   UWAGA: po Factory IO pause(), wewnętrzne IO nadal obserwują.
   mainLoopIO może próbować gsap.ticker.add(mainLoop) gdy sekcja wchodzi w swój 200px margin,
   ale ticking=false (z pause()) → resume guard chroni przed duplikacją.
   Koegzystencja bezpieczna dzięki B-CPU-03 (idempotencja).

2. MEDIA ATTRIBUTES:
   Ludzie.webp/avif (picture/responsive) → HOT, nie-HERO
   → loading="eager" (HOT)
   → BEZ fetchpriority="high" (nie-HERO, nie LCP)
   → decoding="async"
   Graceful degradation: NIE

3. ISOLATION:
   Pattern-check:
   - z-index: 2 na #blok-4-5-section root → FOUND
   - mix-blend-mode: multiply na .full-width-image → FOUND
   - position: fixed na #blok-4-5-stars-canvas → FOUND (wewnątrz roota)
   → AUTO-FIX + WARNING:
     "z-index na root, mix-blend-mode: multiply na child, position: fixed wewnątrz.
      isolation:isolate może wpłynąć na stacking z elementami POZA sekcją.
      Zweryfikuj wizualnie."
   NOTA: mix-blend-mode: multiply jest na CHILD (.full-width-image), nie na rootcie.
   B-ISO-01 mówi: BLEND/FILTER na rootcie lub childach z position: absolute/fixed →
   NIE stosuj isolation:isolate, ustaw OWNER-DECISION-PENDING.
   ALE: .full-width-image NIE ma position: absolute/fixed — ma position: relative.
   mix-blend-mode: multiply na relative child z z-index: 20 — blenduje z background sekcji,
   nie z elementami POZA sekcją.
   → isolation:isolate jest bezpieczne (stacking context ograniczy blend do wnętrza sekcji,
     co jest POŻĄDANE — multiply blenduje z bg sekcji #f7f6f4, nie z body).
   → AUTO-FIX + WARNING (nie OWNER-DECISION-PENDING)

   contain: layout style — SKIP
   Warunki NIE spełnione: position: fixed wewnątrz (#blok-4-5-stars-canvas)

4. AUTO-FIXy:
   - B-ISO-01: isolation: isolate na #blok-4-5-section (+ WARNING)
   - B-CPU-01: Factory IO gating (Ścieżka 1)
   - ST-REFRESH-01: section-in-view IO + layout-settle setTimeout(1000ms)
   - Media: loading="eager" decoding="async" na <img> w <picture>

5. DEV OVERLAY:
   Gating: Ścieżka 1
   Trigger: ?debug=1 lub localStorage.debug === '1'
   Dodaję: badge ACTIVE/PAUSED/KILLED, KILL button, INIT AGAIN, frame meter, ST count, DOM count

6. Preview delta:
   CDN libs: gsap 3.12.7, ScrollTrigger 3.12.7, THREE 0.160.0 (import map)
   scrollRuntime stub: getScroll → window.lenis?.scroll ?? scrollY, requestRefresh → ST.refresh(true)

7. BRAMKI — przewiduję:
   GL-WARM-01: Three.js engine tworzy renderer natychmiast w createStarsEngine() (brak WARM state).
   ALE: createStarsEngine() jest wywoływane LENIWIE (ensureStarsEngine → loadThreeDeps → Promise.all).
   Renderer NIE jest tworzony w init() — tworzony DOPIERO gdy użytkownik dotrze do glow sekcji
   i glowTickFn odpali ensureStarsEngine(). To jest de facto WARM behavior:
   - COLD: init() — Three.js nawet nie załadowane
   - WARM: requestIdleCallback → loadThreeDeps() (z fallbackiem setTimeout)
   - HOT: ensureStarsEngine() → createStarsEngine() → renderer + animate loop na trigger
   - OFF: animate() self-terminates gdy !anyAlive
   → GL-WARM-01 PASS (lazy loading = WARM by design)
   → GL-LC-01 PASS (COLD→WARM→HOT→OFF lifecycle jawnie zrealizowany)

   brak przewidywanych STOP-ów

=== KONIEC CONVERSION PLAN ===
</conversion_plan>

════════════════════════════════════════
KROK 3: Hardened JS (kluczowe zmiany)
════════════════════════════════════════

Zmiany w init():
1. Factory IO gating (Ścieżka 1) — wstawione PRZED return statement
2. ST-REFRESH-01 scaffold (section-in-view IO + layout-settle timer) — wstawione PRZED return statement
3. Cleanup Factory IO w cleanups[] (_s._killed guard, disconnect, removeEventListener)

Zmiany NIE dotknięte:
- Żaden gsap.to/from/fromTo/timeline
- Żaden ScrollTrigger start/end/pin/scrub/snap/easing
- Żaden timing/delay/stagger/duration
- Żaden element DOM wewnątrz #blok-4-5-section

════════════════════════════════════════
KROK 4: Hardened CSS
════════════════════════════════════════

Jedyna zmiana:
```css
#blok-4-5-section {
    /* ... existing properties ... */
    isolation: isolate; /* FACTORY: B-ISO-01 — stacking context */
}
```

════════════════════════════════════════
KROK 5: reference.html
════════════════════════════════════════

→ Plik: blok-4-5.reference.html (4071 linii, dostarczony jako plik)

Struktura:
- Head: GSAP 3.12.7 CDN, Three.js 0.160.0 import map, Lexend font
- Preview spacers (100vh each, top + bottom)
- Section HTML (1:1 z input)
- DEV Overlay (FACTORY:DEV-OVERLAY:START/END)
- Script: scrollRuntime stub + hardened init() + DOMContentLoaded

════════════════════════════════════════
KROK 6: Evidence Pack
════════════════════════════════════════

```
=== EVIDENCE PACK — P2A ===
Slug: blok-4-5
Typ: B
CPU Gating: Ścieżka 1, rootMargin: 1.0×VH (~600-900px)

── AUTO-FIXy zastosowane ──
B-CPU-01   Factory IO gating (Ścieżka 1 — IO → pause/resume)
B-ISO-01   isolation: isolate na #blok-4-5-section (+ WARNING: z-index, fixed child, mix-blend)
ST-REFRESH section-in-view IO + layout-settle (1000ms) scaffold
MEDIA      Ludzie.webp/avif: nie wymaga zmian (picture element ma responsive sources, brak loading attr → eager default)

── Bramki hardeningu ──
B-LC-RET-01 [STATIC]  PASS — init() zwraca { pause, resume, kill } jako ostatnia instrukcja (linia 3829)
PIN-DISABLE-01 [STATIC] N/A — brak pin:true w żadnym ST
B-CPU-03  [REVIEW]    PASS — pause(): `if (ticking)` guard → idempotentna; resume(): `if (!ticking)` guard → idempotentna
B-CPU-04  [REVIEW]    PASS — hfListeners[] przechowuje {target, event, fn, options} — resume() używa identycznych options jak init(). Eyes: pause/resume przez eyePauseFn/eyeResumeFn (flag, nie listener add/remove)
B-CPU-05  [REVIEW]    PASS — kill(): pause() → cleanups → timerIds → observers → gsapInstances(revert+kill) → starsState.dispose() → canvas release. Kolejność poprawna.
B-VEL-01  [AUTO-FIX]  N/A — sekcja nie ma velocity/physics loop w sensie B-VEL (scroll velocity jest w mainLoop ale nie wymaga isFirst/lastRaw reset — scrollUpVelocity gasi się naturalnie przez *= 0.9)
B-VEL-02  [AUTO-FIX]  N/A — jw.
B-REF-01  [STATIC]    PASS — ScrollTrigger.refresh() wywoływany przez debounced handler (120ms) na resize/orientationchange/visualViewport.resize. Każde zdarzenie = max 1 refresh. Brak refresh w rAF/ticker/onUpdate/onRefresh.
B-REF-02  [STATIC]    PASS — brak refresh w onRefresh/onRefreshInit
B-GEO-01  [STATIC]    N/A — sekcja nie zmienia wysokości (brak accordion/expand/collapse)
B-PIN-01  [REVIEW]    N/A — brak pin/snap

── WebGL L1 (STOP) ──
GL-CPU-01 [REVIEW]    PASS — Three.js engine ładowany LENIWIE (ensureStarsEngine via Promise). Renderer tworzony DOPIERO po triggerze (glow cycle lub click). Po init() GPU jest idle (zero rAF z Three.js).
GL-CPU-02 [REVIEW]    PASS — animate() self-terminates gdy !anyAlive (linia ~2141-2150). Po zakończeniu animacji: threeRunning=false, listeners removed (OPT#8), canvas hidden. pause() sekcji zatrzymuje ticker → glowTickFn nie odpala → triggerBatch nie odpala → animate nie jest wznawiany.
GL-MEM-01 [REVIEW]    PASS — dispose() (linia ~2187-2213): anuluje idle callback, removes listeners (resize/scroll/mousemove/touchmove/pointerdown/touchstart), disposes particles, crossGeom.dispose(), 3× base material dispose(), renderer.dispose(), canvas.remove() (canvasOwnership=runtime → remove poprawne), scene.environment.dispose(). Kompletny.
GL-WARM-01 [REVIEW]   PASS — Lazy loading = WARM by design. COLD: init() — Three.js niezaładowane. WARM: rIC/setTimeout → loadThreeDeps() ładuje moduły w tle. HOT: ensureStarsEngine() tworzy renderer + scene + odpala animate() na trigger. compileAsync nie użyte (Three.js 0.160.0 nie ma stabilnego compileAsync), ale PMREMGenerator envMap generowany w rIC (deferred) → shader compilation rozłożone.
GL-LC-01  [REVIEW]    PASS — Lifecycle COLD→WARM→HOT→OFF jawnie zrealizowany:
                        COLD: init() — brak renderer
                        WARM: rIC → loadThreeDeps() (download only, no renderer)
                        HOT: ensureStarsEngine() → renderer + animate loop
                        OFF: animate self-terminates, listeners removed
                        webglRole=IMPORTANT → wymaga PASS (nie WARNING)
GL-IDLE-01 [REVIEW]   PASS — requestIdleCallback z fallbackiem setTimeout(500) (linia ~2274-2280). Wzorzec poprawny.

── WebGL L2 (WARNING) ──
GL-MEM-02 [REVIEW]    PASS — animate/wakeThreeLoop nie tworzy nowych materiałów/tekstur. Materiały klonowane w spawn() ale na istniejących bazowych (_baseMaterialAuto.clone()) — clone reużywa shader program.
GL-TIER-01[REVIEW]    WARNING — brak jawnego fallbacku dla Tier 0 (no WebGL). webglRole=IMPORTANT → WARNING (nie STOP).
GL-CTX-01 [REVIEW]    PASS — forceContextLoss() nie używane (nie wymagane, single GL context)

── CSS / RENDER ──
B-CSS-01  [STATIC]    PASS — Przeskanowano: CSS transition na button elements (--btn-dur, --btn-ease) dotyczy all/transform/opacity. GSAP animuje: gsap.to(chars, transform), gsap.timeline transform/opacity na chars. Chars (.walking-char) i button to RÓŻNE elementy → brak konfliktu. .gradient-text-reveal ma CSS animation (background-position) — GSAP nie animuje tego elementu. .blok45-pupil-arm ma CSS animation (rotate) — GSAP nie animuje tych elementów. morphGhost ma JS inline transition — nie GSAP. Brak konfliktu po normalizacji.
HTML-FONTSIZE-01 [STATIC] PASS — brak html{font-size} ani :root{font-size} w CSS sekcji
B-ISO-01  [AUTO-FIX]  DODANO + WARNING: z-index:2 na root, position:fixed na #blok-4-5-stars-canvas, mix-blend-mode:multiply na .full-width-image (relative, nie absolute/fixed → blend ograniczony do wnętrza sekcji → isolation bezpieczne)
CLN-01    [RUNTIME]   PENDING(owner) — weryfikacja przez KILL button w reference.html

── ISOLATION / SAFETY ──
ST-01     [REVIEW]    PASS — stWaveTrigger.onEnter: startKipielOpen() — nie side-effect (animacja wewnętrzna). stWalking.onEnter: hasStarted=true — ma `once:true`. stUnderline.onEnter: setTimeout(initUnderlineSVG) — ma `once:true`. stWaveVis callbacks: display toggle — odwracalne (nie side-effect). stWaveScroll.onUpdate: handleScroll — stateless transform. stWaveScroll.onLeaveBack: reset — odwracalny.
ST-02     [STATIC]    PASS — stWaveVis: trigger=#blok-4-5-section (=container), start='top bottom', end='bottom top' — viewport-relative. stWaveTrigger: trigger=waveAnchor (wewnętrzny element), start='top bottom' — ALE to NIE jest wejście sekcji, to trigger animacji wave. stWaveScroll: trigger=waveAnchor, start='top bottom', end=function('bottom N%') — viewport-relative. stUnderline: trigger=#blok-4-5-mozemy-to-zmienic, start='top 35%' — viewport-relative. stWalking: trigger=#blok-4-5-voidSection, start='top 35%' — viewport-relative. Wszystkie triggery viewport-relative, żaden jako semantyka wejścia sekcji na wewnętrznym elemencie.
ST-CLEAN-01 [REVIEW]  PASS — kill() iteruje gsapInstances[] z revert()+kill() na każdym. Wszystkie 5 ST (stWaveVis, stWaveTrigger, stWaveScroll, stUnderline, stWalking) są w gsapInstances[]. Brak ScrollTrigger.killAll(). gsap.timeline instances (transformToZostaja) też w gsapInstances[].
DEV-DEL-01  [REVIEW]  PASS — blok DEV overlay (FACTORY:DEV-OVERLAY:START/END) zawiera WYŁĄCZNIE: overlay DOM, button click handlers na overlay elements, badge update interval, frame meter rAF. Zero ScrollTrigger.defaults(), zero modyfikacji stanu sekcji, zero globalnych side-effectów. Cały kod w `if (!DEBUG_MODE) return;`.

── INPUT ──
INP-01    [STATIC]    PASS — wheel: nie używany bezpośrednio. touchmove: Three.js touchHandler ma { passive: true } (linia ~1791). touchstart: btn.addEventListener('touchstart', ..., { passive: true }) (linia 2322). scroll: { passive: true } (linia 3575, 3817, 2168). Wszystkie HF listenery passive.
INP-02    [STATIC]    PASS — mousemove (eyes): onEyeMouseMove sprawdza `if (eyesPaused) return;` (linia 3761) — gated przez pause()/resume(). Three.js mousemove: dodawany/usuwany dynamicznie w wakeThreeLoop/animate (OPT#8) — aktywny TYLKO gdy particles alive.
INP-LEAK-01 [STATIC]  PASS — Patche z FAIL-WITH-PATCH zaaplikowane: initPopup _onRevealClick extracted + cleanup. Popup close handlers mają cleanup. Wszystkie addEventListener w init() używają named functions z odpowiadającymi removeEventListener w cleanups[]. Eyes: cleanup w liniach 3820-3826. Button: cleanup w liniach 2333-2344 (za if(btn) guard). Three.js: dispose() ma complete listener removal.
INIT-DOM-01 [STATIC]  PASS — brak DOMContentLoaded/window.load w init(). document.fonts.ready.then() jest dozwolony (whitelist B-REF-01).

── MEDIA ──
MED-01    [STATIC]    N/A — brak <video> w sekcji. Canvas 2D (sparks, smoke, iStar) zarządzane przez mainLoop (gated). Three.js canvas managed by self-terminating animate(). Burst canvas: self-terminating (frame<60 guard).

── DOM ──
VAN-SPLIT-01 [REVIEW] N/A — brak SplitText
J-GPU-01  [REVIEW]    PASS — gsap.timeline w transformToZostaja: one-shot animacje (gsap.to z opacity, y, rotation). GSAP force3D:"auto" domyślnie promuje do GPU. walkContainer transform ustawiany przez mainLoop (ticker) — będzie zatrzymany gdy isDead=true. Brak braku willChange:auto w onComplete, ale animacje kończą się isDead=true → mainLoop przestaje → brak dalszych mutacji. Animacje transformToZostaja to finalne (sekcja "umiera") — brak potrzeby cleanup willChange.

── STRICTMODE PROXY ──
SM-01     [RUNTIME]   PENDING(owner) — weryfikacja przez INIT AGAIN w reference.html
SM-02     [REVIEW]    PASS — stWalking i stUnderline mają once:true. stWaveTrigger.onEnter wywołuje startKipielOpen() który ma `if (state === STATE_IDLE_OPEN) return;` guard. stWaveVis callbacks: display toggle — idempotentne.

── INIT PERFORMANCE ──
INIT-CPU-01 [REVIEW]  WARNING — init() tworzy 400 particle objects w pętli (POOL_SIZE=400, initPool()). Każdy obiekt jest prosty (struct-like), ale 400 iteracji + alokacja. Dodatkowo CONFIG.text.split('').forEach tworzy 10 spanów (walkContainer). WARNING: "init() zawiera 400-iteracyjną pętlę (particle pool) + DOM manipulation. Koszt ~5-15ms."

── RUNTIME SAFETY ──
TS-LINT-UNUSED-01 [STATIC] PASS (z adnotacją) — outer tickFn=mainLoop (linia ~3588) write-only. Owner decision: ZOSTAWIAMY (architektoniczny slot, zero runtime impact). Inner tickFn (wave IIFE) — osobna zmienna, aktywnie używana.
NULL-GUARD-01     [STATIC] PASS — Patche zaaplikowane: walkContainer, sparksCanvas, btn/btnWrap/glowEl, chosen w popup. Wszystkie querySelector wyniki guardowane przed użyciem.
IO-SAFE-01        [STATIC] PASS — Patche zaaplikowane: mainLoopIO `if (!entries[0]) return;`, glowIO `if (!entries[0]) return;`. Factory IO callback ma guard.
ARRAY-ASSIGN-01   [STATIC] N/A — brak dynamicznych indeksów z DOM/attr

── SECTION POSITION INVARIANCE ──
POS-ROOT-01  [STATIC]    PASS — stWaveVis: trigger=#blok-4-5-section (=container), viewport-relative
ST-REFRESH   [AUTO-FIX]  AUTO-FIXED — dodano section-in-view IO + layout-settle (1000ms)

── CPU GATING koegzystencja ──
Sekcja ma wewnętrzne IO:
  mainLoopIO (rootMargin: 200px) — gating mainLoop ticker
  glowIO (threshold: 0.1) — gating glow ticker
  mana IO (threshold: 0.1) — CSS class toggle
Fabryka dodaje zewnętrzny IO gating (rootMargin ~600-900px, 1.0×VH).
Koegzystencja bezpieczna: B-CPU-03 PASS + ENT-LC-06 PASS.
Asymetria rootMargin: Factory (~700px) > internal (200px) — korzystny wzorzec.
UWAGA: po Factory pause(), internal IO (mainLoopIO) nadal obserwuje.
Jeśli sekcja wraca w 200px margin mainLoopIO, próba gsap.ticker.add(mainLoop) jest blokowana
przez ticking=false (z pause()). Bezpieczne dzięki idempotencji (B-CPU-03).

── Media attributes ──
Ludzie.webp/avif: picture element z responsive sources, <img> bez loading attr → domyślnie eager (poprawne dla HOT).
Brak fetchpriority="high" (nie-HERO).
Brak graceful degradation (owner: NIE).

── Performance Warnings ──
PERF-W6:  WARNING — >2 ticker/rAF: gsap.ticker.add(mainLoop), gsap.ticker.add(glowTickFn), plus rAF w eyes i Three.js animate(). 4 osobne źródła per-frame. ALE: eyes throttled 33ms, Three.js self-terminating, glowTickFn auto-removes. Konsolidacja niewskazana (różne lifecycle).
PERF-W7:  WARNING — polskie znaki (ąćęłńóśźż) w HTML tekst. Lexend font z Google CDN nie specyfikuje latin-ext w reference.html (CDN auto-detects). Sprawdź next/font config w produkcji.
PERF-W9:  WARNING — #blok-4-5-stars-canvas (fixed, full-screen, WebGL) bez will-change w CSS. ALE: Three.js renderer zarządza canvas — will-change na canvas kontenerze jest redundantne.
PERF-W13: WARNING — .blok45-pupil-arm ma CSS transform (initial position) + potencjalnie GSAP? NIE — eyes ustawiają style.transform bezpośrednio, nie przez GSAP. CSS keyframe (blok45-gaze-a) animuje transform na pair-a. pair-b ma animation:none na desktop i JS cursor tracking. Brak faktycznego konfliktu — informacyjnie.

── RUNTIME bramki — wymagają ręcznej weryfikacji właściciela ──
CLN-01  PENDING(owner) — kliknij KILL w ?debug=1, sprawdź brak orphans
SM-01   PENDING(owner) — kliknij INIT AGAIN 3× w ?debug=1, sprawdź czy liczniki stabilne

── GUARD PRESERVATION [P2A-03] ──
preserveExistingGuards: true
Guardy wykryte:
  - null checks DOM ($id results, container.querySelector) — 7 lokalizacji (patche zaaplikowane)
  - visibilitychange handlers (onMainVisChange, onVisChange) — w cleanups[]
  - IntersectionObservers × 3 (mainLoopIO, glowIO, mana IO) — w observers[]
  - resize handlers (debounced ST refresh, onResizeMain, visualViewport) — w cleanups[]
  - eyesDead flag — w eyes cleanup
  - isDead flag — w mainLoop/resume guard
  - _disposed flag — w Three.js dispose
Guardy zachowane: TAK (wszystkie przeżyły hardening)
Guardy dodane: _s._killed (Factory IO cleanup), Factory IO disconnect
```

════════════════════════════════════════
KROK 7: Factory Handoff
════════════════════════════════════════

```
=== FACTORY HANDOFF ===
Step completed:  P2A (CPU Gating + Hardening)
Decision:        PROCEED
Next step:       P2B (Harness + Manifest + Evidence)

Paste into P2B:
  1. Ten raport P2A (całość)
  2. reference.html (plik blok-4-5.reference.html)

Key state:
  slug            = blok-4-5
  type            = B
  gating          = Ścieżka 1 (IO → pause/resume)
  geometryMutable = false
  hasPin          = false
  hasSnap         = false
  webgl           = true (IMPORTANT, lazy-loaded, canvasOwnership: runtime)
  runtime_pending = [CLN-01, SM-01]
  perf_warnings   = [PERF-W6, PERF-W7, PERF-W9, PERF-W13]

Przed przejściem do P2B:
  Otwórz reference.html w przeglądarce i sprawdź:
  [ ] Sekcja renderuje się poprawnie
  [ ] Animacje wyglądają identycznie jak oryginalny vanilla
  [ ] ?debug=1 → overlay widoczny (KILL button, INIT AGAIN, metryki)
  [ ] Scroll poza sekcję → overlay pokazuje stan (pause/resume działa)
  [ ] RUNTIME bramki: CLN-01 i SM-01 zweryfikowane (odznacz po weryfikacji)
```
