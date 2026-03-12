# P2B OUTPUT — fakty (v2)
## Zaktualizowany o decyzję: AVIF+WebP przez CSS image-set

<execution_status>PROCEED</execution_status>

────────────────────────────────────────
## KROK 1: Stack-Harness
────────────────────────────────────────

**N/A** — sekcja nie ma pin/snap/geometryMutable.

────────────────────────────────────────
## KROK 2: Section Manifest
────────────────────────────────────────

```yaml
SECTION_MANIFEST:

  slug:     'fakty'
  type:     'A'
  requires: ['scrollRuntime', 'gsap', 'ScrollTrigger']

  # ═══════════════════════════════════════════════════════════════
  # ASSET ARCHITECTURE — SEKCYJNA DECYZJA
  # ═══════════════════════════════════════════════════════════════
  assetArchitecture:
    strategy:           'static-public-image-set'
    imageOptimization:  'none'  # NIE używamy next/image ani Next Image Optimization
    formatNegotiation:  'css'   # browser wybiera przez CSS image-set, nie JS
    sourcePath:         'public/frames/'
    
    formats:
      primary:   'avif'
      fallback:  'webp'
      
    filePattern:
      avif: 'fakty-{NN}.avif'   # NN = 01-34
      webp: 'fakty-{NN}.webp'
      
    totalFiles: 68              # 34 klatek × 2 formaty
    
    cssDelivery:
      supported: |
        image-set(
          url('/frames/fakty-{NN}.avif') type('image/avif'),
          url('/frames/fakty-{NN}.webp') type('image/webp')
        )
      fallback: "url('/frames/fakty-{NN}.webp')"
      featureDetect: "CSS.supports('background-image', 'image-set(url(x) type(\"image/webp\"))')"
      
    prohibited:
      - 'next/image'
      - 'getImageProps()'
      - '_next/image'
      - 'JS AVIF feature detection'
      - 'JS format negotiation'
      - 'placeholder frames generation'
      - 'Next Image Optimization pipeline'

  # ═══════════════════════════════════════════════════════════════
  # ASSETS — zgodne z nową architekturą
  # ═══════════════════════════════════════════════════════════════
  assets:
    - kind:        'img-sequence'
      src:         'public/frames/fakty-[01-34].{avif,webp}'
      count:       34
      formats:     ['avif', 'webp']
      totalFiles:  68
      priority:    'WARM'
      critical:    false
      lcp:         false
      delivery:    'css-image-set'
      preload:     false  # świadoma decyzja: bez ręcznego preloadu formatowego

  warmup: []  # brak preconnect — assety lokalne w public/

  scrollTriggersCount: 4

  geometryMutable: false
  geometryRefresh: 'none'

  dciProps: []

  timelineContract: undefined

  # ═══════════════════════════════════════════════════════════════
  # SPECIAL NOTES
  # ═══════════════════════════════════════════════════════════════
  specialNotes:
    breakpoints:        ['991px', '479px']
    platformGuards:     []
    cpuGatingMechanism: 'N/A'
    cpuGatingPath:      null
    
    # ASSET DELIVERY NOTES
    assetDeliveryNotes: |
      Ta sekcja używa ręcznie przygotowanej sekwencji klatek jako background-image.
      
      NIE UŻYWAMY:
      - next/image
      - Next Image Optimization
      - JS feature detection dla AVIF
      - _next/image pipeline
      
      UŻYWAMY:
      - Statyczne pliki w public/frames/
      - CSS image-set() dla wyboru formatu
      - CSS.supports() jako jedyny feature detect
      - Fallback do WebP dla starszych przeglądarek
      
      Browser sam wybiera AVIF vs WebP przez CSS — zero JS negotiation.

  # ═══════════════════════════════════════════════════════════════
  # INTEGRATION NOTES
  # ═══════════════════════════════════════════════════════════════
  integrationNotes:
    hasPin:               false
    hasSnap:              false
    affectsGeometryBelow: false
    sensitiveTo:          ['geometry-above']
    testWith:             []
    
    # INTEGRATOR CONSTRAINTS
    integratorConstraints:
      immutablePaths:
        - 'src/sections/**'
        - 'src/lib/scrollRuntime.ts'
        - 'src/components/SmoothScrollProvider.tsx'
      
      assetVerification:
        expectedRequestPattern: '/frames/fakty-*.{avif,webp}'
        forbiddenRequestPattern: '/_next/image*'
        checkContentType: true
        
      stopConditions:
        - 'Propozycja zmiany w src/sections/**'
        - 'Propozycja użycia next/image dla tej sekcji'
        - 'Propozycja JS AVIF detection'
        - 'Manifest niekompletny lub sprzeczny'
        - 'Hinty spoza manifestu'

  # ═══════════════════════════════════════════════════════════════
  # PERFORMANCE
  # ═══════════════════════════════════════════════════════════════
  perf:
    dynamicImport:        false
      # MISSING OWNER DECISION — fail-safe false
    isHero:               false
    gracefulDegradation:  true
      # czarne litery gdy klatki nie załadowane
      
    # RESOURCE HINTS — świadoma decyzja: minimalne
    preloadCandidates:    []
      # Brak preloadu — świadoma decyzja właściciela
      # Nie preloadujemy tylko WebP (byłoby nieoptymalne dla AVIF browsers)
      # Nie preloadujemy AVIF (brak wsparcia <link rel=preload type=image/avif>)
      
    prefetchCandidates:   []
      # Brak prefetch — klatki ładowane przez CSS background-image
      # Browser cache załatwia sprawę po pierwszym renderze
      
    coldCandidates:       []
    
    preconnectDomains:    []
      # Assety lokalne w public/ — brak external domains
      
    containApplied:       false
      # OWNER-DECISION(skip) — kerning margins risk
      
    warnings:             []

  scrollRuntimeRecommendations: []

  # ═══════════════════════════════════════════════════════════════
  # RUNTIME CHECKS
  # ═══════════════════════════════════════════════════════════════
  runtimeChecks:
    CLN-01: 'PENDING'
    SM-01:  'PENDING'
    SM-02:  'PENDING'
    INT-01: 'N/A'
    INT-02: 'N/A'
    INT-03: 'N/A'
```

────────────────────────────────────────
## KROK 3: Evidence Pack
────────────────────────────────────────

```
═══════════════════════════════════════
EVIDENCE PACK — fakty (v2)
═══════════════════════════════════════

AUDYT WEJŚCIA (P1): PASS
  namespace:     OK (wszystkie selektory #fakty-section prefixed)
  lifecycle:     OK
  triaż:         Typ A potwierdzony
  scroll split:  N/A

CPU GATING (P2A): Ścieżka 3a
  mechanizm:        N/A (ST-native, brak IO gating)
  gatingTarget:     N/A
  rootMargin:       N/A

AUTO-FIXy ZASTOSOWANE (P2A):
  - NULL-GUARD-01: Guardy na faktyBlock, faktyDom, rows[0], rows[1], row2Word, row1
  - TS-LINT-UNUSED-01: Usunięto dead code ($, $$, getScroll)

═══════════════════════════════════════
ASSET ARCHITECTURE DECISION (v2)
═══════════════════════════════════════

DECYZJA WŁAŚCICIELA:
  Format delivery:      CSS image-set() + WebP fallback
  Image optimization:   NONE (nie używamy Next Image Optimization)
  Format negotiation:   CSS (browser wybiera przez image-set)
  JS detection:         TYLKO CSS.supports() dla image-set
  
STRUKTURA PLIKÓW:
  Location:             public/frames/
  Pattern:              fakty-{01-34}.{avif,webp}
  Total files:          68 (34 klatek × 2 formaty)
  
CSS DELIVERY:
  Supported browsers:
    image-set(
      url('/frames/fakty-NN.avif') type('image/avif'),
      url('/frames/fakty-NN.webp') type('image/webp')
    )
  
  Fallback browsers:
    url('/frames/fakty-NN.webp')
  
  Feature detect:
    CSS.supports('background-image', 'image-set(url(x) type("image/webp"))')

USUNIĘTE Z LOGIKI:
  ✗ Sprawdzanie czy istnieje plik AVIF
  ✗ JS feature detection "czy browser wspiera AVIF"
  ✗ Logika "AVIF > WebP" sterowana przez JS
  ✗ next/image, getImageProps(), _next/image
  ✗ Placeholder frames generation zależna od formatu

PRELOAD DECISION:
  Status:               BRAK
  Uzasadnienie:         Świadoma decyzja — nie preloadujemy tylko WebP
                        (byłoby nieoptymalne dla AVIF browsers)

═══════════════════════════════════════
BRAMKI BEZPIECZEŃSTWA
═══════════════════════════════════════

B-CPU-03  [REVIEW]  idempotencja pause/resume:          N/A
B-CPU-04  [REVIEW]  listener options:                   N/A
B-CPU-05  [REVIEW]  cleanup order:                      OK
B-VEL-01  [—]       velocity reset resume:              N/A
B-VEL-02  [—]       velocity init:                      N/A
B-REF-01  [STATIC]  requestRefresh:                     OK
B-REF-02  [STATIC]  refresh kaskada:                    OK
B-GEO-01  [STATIC]  geometry:                           N/A
B-PIN-01  [REVIEW]  pin refresh:                        N/A
B-CSS-01  [STATIC]  CSS vs GSAP:                        OK
B-ISO-01  [—]       isolation:                          OWNER-DECISION(skip)
CLN-01    [RUNTIME] cleanup:                            PENDING
ST-01     [REVIEW]  ST idempotent:                      OK
INP-01    [STATIC]  passive listeners:                  OK
INP-02    [STATIC]  pointermove:                        N/A
MED-01    [STATIC]  media attributes:                   N/A
VAN-SPLIT [REVIEW]  SplitText:                          N/A
J-GPU-01  [REVIEW]  GPU cleanup:                        OK
SM-01     [RUNTIME] INIT AGAIN 3×:                      PENDING
SM-02     [REVIEW]  double callbacks:                   OK
INIT-CPU-01 [REVIEW] long task init:                    OK
GL-*      [REVIEW]  WebGL:                              N/A (brak WebGL)
B-LC-RET-01 [STATIC] return handle:                     OK
ST-CLEAN-01 [REVIEW] ST cleanup scope:                  OK
INP-LEAK-01 [STATIC] named handlers:                    OK
INIT-DOM-01 [STATIC] DOMContentLoaded w init:           OK
DEV-DEL-01  [REVIEW] overlay side-effects:              OK

═══════════════════════════════════════
PERFORMANCE
═══════════════════════════════════════

PERF-01   [—]       media attributes:    N/A
PERF-02   [—]       contain layout:      SKIP (OWNER-DECISION)
PERF-03   [DEV]     telemetria:          PENDING
PERF-W*   [REVIEW]  aktywne warnings:    clean

ANTI-FOUC (P3):     PENDING
DYNAMIC IMPORT:     false (MISSING OWNER DECISION — fail-safe)

═══════════════════════════════════════
STACK-HARNESS
═══════════════════════════════════════

Status: N/A (brak pin/snap/geometryMutable)

═══════════════════════════════════════
EXTERNAL CDN LIBRARIES
═══════════════════════════════════════

https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.7/gsap.min.js → gsap
https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.7/ScrollTrigger.min.js → ScrollTrigger

═══════════════════════════════════════
OWNER DECISIONS RECORDED
═══════════════════════════════════════

1. isolation: isolate = SKIP
   Reason: background-clip:text + 3D transforms nie kompatybilne

2. contain: layout style = SKIP
   Reason: kerning margins ryzyko, brak testów cross-browser

3. dynamicImport = MISSING → false (fail-safe)

4. Asset Architecture = static-public-image-set (v2)
   - NIE next/image
   - NIE Next Image Optimization
   - TAK CSS image-set() + WebP fallback
   - TAK static files in public/frames/
   - Browser wybiera format przez CSS

5. Preload = NONE (świadoma decyzja)
   Reason: nie preloadujemy tylko WebP — byłoby nieoptymalne dla AVIF browsers

═══════════════════════════════════════
INTEGRATOR VERIFICATION CHECKLIST
═══════════════════════════════════════

Po integracji sprawdź w DevTools → Network:

[ ] Requesty klatek idą do /frames/fakty-*.avif lub /frames/fakty-*.webp
[ ] BRAK requestów do /_next/image*
[ ] Content-Type zgadza się z rozszerzeniem pliku
[ ] W AVIF-capable browser: requesty do .avif
[ ] W WebP-only browser: requesty do .webp
[ ] Brak zmian w src/sections/**

═══════════════════════════════════════
ASSET FILE CHECKER
═══════════════════════════════════════

Przed deploy sprawdź kompletność plików:

Expected: 34 × 2 = 68 plików
Pattern:
  public/frames/fakty-01.avif  public/frames/fakty-01.webp
  public/frames/fakty-02.avif  public/frames/fakty-02.webp
  ...
  public/frames/fakty-34.avif  public/frames/fakty-34.webp

Każdy numer MUSI mieć oba formaty.

═══════════════════════════════════════
WERDYKT
═══════════════════════════════════════

PASS — wszystkie STATIC/REVIEW bramki OK
PENDING — RUNTIME checks (CLN-01, SM-01, SM-02)
PENDING — Asset file completeness check (34×2=68 plików)

═══════════════════════════════════════
```

────────────────────────────────────────
## KROK 4: Runtime Verification
────────────────────────────────────────

```
═══════════════════════════════════════
RUNTIME VERIFICATION — fakty
Wykonaj przed przejściem do P3.
═══════════════════════════════════════

CZĘŚĆ A: TESTY W PRZEGLĄDARCE (reference.html)
──────────────────────────────────────────────

1. Otwórz reference.html?debug=1 w przeglądarce

TEST CLN-01 — Cleanup czystość:
   → PRZED KILL: zanotuj liczniki z DEV overlay
   → Kliknij KILL w DEV overlay
   → Sprawdź: "✅ No orphans", ST count = 0
   → Wpisz: runtimeChecks.CLN-01 = 'PASS' lub 'FAIL'

TEST SM-01 — StrictMode liczniki:
   → Kliknij INIT AGAIN 3× w DEV overlay
   → Sprawdź: ST count stabilny (4) po każdym kliknięciu
   → Wpisz: runtimeChecks.SM-01 = 'PASS' lub 'FAIL'

TEST SM-02 — Double callbacks:
   → Po INIT AGAIN: sprawdź console na duplikaty
   → Wpisz: runtimeChecks.SM-02 = 'PASS' lub 'FAIL'

CZĘŚĆ B: WERYFIKACJA ASSET FILES
──────────────────────────────────────────────

2. Sprawdź kompletność plików w public/frames/

   Wymagane: 68 plików (34 × 2 formaty)
   
   Skrypt sprawdzający (bash):
   
   ```bash
   cd public/frames
   for i in $(seq -w 1 34); do
     [ -f "fakty-$i.avif" ] || echo "MISSING: fakty-$i.avif"
     [ -f "fakty-$i.webp" ] || echo "MISSING: fakty-$i.webp"
   done
   echo "Total files: $(ls fakty-*.{avif,webp} 2>/dev/null | wc -l) (expected: 68)"
   ```

   → Wpisz: ASSET-CHECK = 'PASS (68/68)' lub 'FAIL (X/68)'

═══════════════════════════════════════

Po wykonaniu testów odpowiedz:

"RUNTIME RESULTS:
  CLN-01:      PASS / FAIL
  SM-01:       PASS / FAIL
  SM-02:       PASS / FAIL
  ASSET-CHECK: PASS (68/68) / FAIL (X/68)
  INT-01:      N/A
  INT-02:      N/A
  INT-03:      N/A"

═══════════════════════════════════════
```

────────────────────────────────────────
## KROK 5: Instrukcja dla Integratora
────────────────────────────────────────

```
═══════════════════════════════════════
INTEGRATOR BRIEFING — fakty
═══════════════════════════════════════

Ta sekcja używa ręcznie przygotowanej sekwencji klatek jako background-image.

ZASADY NIENARUSZALNE:

1. src/sections/** jest IMMUTABLE
   Nie proponuj zmian w tych plikach.

2. NIE używamy dla tej sekcji:
   ✗ next/image
   ✗ getImageProps()
   ✗ _next/image
   ✗ Next Image Optimization
   ✗ JS AVIF feature detection

3. UŻYWAMY:
   ✓ Statyczne pliki z public/frames/
   ✓ CSS image-set() dla wyboru formatu
   ✓ CSS.supports() jako jedyny feature detect
   ✓ Fallback do WebP

4. Resource hints TYLKO z manifestu
   Manifest mówi: preloadCandidates = []
   Manifest mówi: prefetchCandidates = []
   Nie dodajesz nic ekstra.

5. Dynamic import wg manifestu
   perf.dynamicImport = false
   → sekcja idzie bezpośrednio do page.tsx

6. Geometry refresh
   geometryMutable = false
   → brak useGeometryRefresh()

CHECKLIST PO INTEGRACJI:

[ ] Requesty klatek idą do /frames/fakty-*.{avif,webp}
[ ] BRAK requestów do /_next/image
[ ] Brak zmian w src/sections/**
[ ] Sekcja w page.tsx (nie dynamic import)
[ ] Brak dodanych resource hints

STOP CONDITIONS:

Zatrzymaj integrację i wróć do Fabryki jeśli:
- LLM proponuje zmianę w src/sections/**
- Ktoś chce "naprawić" sekcję przez next/image
- Manifest niekompletny
- Asset pipeline nie zgadza się z kontraktem

═══════════════════════════════════════
```

────────────────────────────────────────
## KROK 6: Factory Handoff
────────────────────────────────────────

```
=== FACTORY HANDOFF ===
Step completed:  P2B (Harness + Manifest + Evidence) — v2
Decision:        PROCEED — czeka na RUNTIME RESULTS

Pliki do repo:
  (brak — P2B nie generuje plików produkcyjnych)

Pliki NIE do repo:
  fakty.MANIFEST.txt
  fakty.EVIDENCE.txt

Key state:
  slug               = fakty
  type               = A
  hasPin             = NIE
  hasSnap            = NIE
  geometryMutable    = NIE
  dynamicImport      = NIE (fail-safe)
  isHero             = NIE
  stack_harness      = N/A
  
  # ASSET ARCHITECTURE v2
  assetStrategy      = static-public-image-set
  formats            = AVIF + WebP
  formatNegotiation  = CSS image-set()
  nextImageUsed      = NIE
  totalAssetFiles    = 68 (34 × 2)
  preload            = NONE (świadoma decyzja)

  runtime_checks:
    CLN-01:      PENDING
    SM-01:       PENDING
    SM-02:       PENDING
    ASSET-CHECK: PENDING (68 plików)
    INT-01:      N/A
    INT-02:      N/A
    INT-03:      N/A

Następny krok:
  1. Sprawdź kompletność plików (34×2=68) w public/frames/
  2. Otwórz reference.html?debug=1 → wykonaj testy CLN-01, SM-01, SM-02
  3. Odpowiedz RUNTIME RESULTS
  4. Po wszystkich PASS → AKCEPTUJĘ → P3

UWAGA: Kod sekcji wymaga UPDATE aby używać image-set()!
  - Obecny kod używa tylko WebP URLs
  - P3 (lub osobny patch) musi dodać:
    - CSS.supports() check
    - image-set() dla supported browsers
    - WebP fallback dla unsupported

P3 NIE startuje z jakimkolwiek runtimeCheck = PENDING.
```
