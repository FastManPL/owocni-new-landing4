# P2B MANIFEST — final-section (WebGL Footer)
## Sekcja: `final`
## Data: 2026-03-30
## Stack: `final.stack.html` (Integration Harness)

---

## SECTION MANIFEST

```yaml
slug:             final
type:             B
role:             footer-cta
dynamicImport:    true    # WebGL + transmission shader = heavy init, SSR incompatible
clientOnly:       true    # window.WebGLRenderingContext, requestIdleCallback

hasPin:           false
hasSnap:          false
geometryMutable:  true    # handleResize rebuilds PlaneGeometry + makeTexture

webgl:
  enabled:        true
  renderer:       THREE.WebGLRenderer
  transmission:   true    # MeshPhysicalMaterial transmission:1.0
  onBeforeCompile: true   # rim gradient — Three.js version sensitive
  canvasOwnership: runtime
  warmup:         idle    # requestIdleCallback + rAF fallback
  fallback:       css     # jeśli WebGL unavailable — sekcja ukryta lub uproszczona

export:
  mode:           named
  name:           FinalSection

refreshSignals:   []      # brak ScrollTrigger — brak potrzeby refresh

sensitiveTo:      []      # brak pin/snap sensitivity

slotsCoverage:    complete

deliveryRisk:     none

perf:
  flags:          [O1, O2, O3, O5, O6, O7, O8, O9, O10, O11, O12]
  dprCap:         1.0
  renderWidthCap: 2340
  fpsMobile:      30
  fpsDesktop:     native (60Hz+)
```

---

## RUNTIME CHECKS

| ID | Test | Metoda | Status |
|----|------|--------|--------|
| CLN-01 | KILL → brak memory leaks | DevTools Memory — sprawdź heap po kill() | ⏳ PENDING |
| SM-01 | REINIT 3× — brak duplikatów, brak błędów | Kliknij INIT AGAIN 3× z rzędu | ⏳ PENDING |
| WGL-01 | Cold start bez Lenis | Otwórz stack.html w nowej karcie, przewiń | ⏳ PENDING |
| WGL-02 | Background tab pause | Przełącz kartę na 5s, wróć — brak błędów | ⏳ PENDING |

**Instrukcje:**

**CLN-01:**
1. Otwórz `final.stack.html`, przewiń do sekcji
2. Poczekaj `ticking: true` w dev overlay
3. Kliknij KILL
4. DevTools → Memory → Take snapshot
5. ✅ PASS jeśli: brak aktywnych `requestAnimationFrame`, canvas usunięty z DOM, heap nie rośnie

**SM-01:**
1. Kliknij INIT AGAIN trzy razy z rzędu (z ~500ms przerwą)
3. Po każdym: zegar działa, cyfry animują się, WebGL renderuje
4. ✅ PASS jeśli: brak duplikatów canvas w DOM, brak błędów w konsoli

**WGL-01:**
1. Otwórz `final.stack.html` (Lenis nie jest aktywny w harness)
2. Przewiń powoli od góry do sekcji
3. ✅ PASS jeśli: WebGL załadował się przed pełnym odsłonięciem (warmup zdążył), brak freeze

**WGL-02:**
1. Przewiń do sekcji WebGL, poczekaj `ticking: true`
2. Przełącz na inną kartę na 5 sekund
3. Wróć
4. ✅ PASS jeśli: zegar wznawia, cyfry animują się, brak błędów

---

## OBSERVATIONS

### ARCH-01 — Sticky reveal pattern (nie fixed)
Canvas w `position:sticky` wewnątrz `#final-sticky`. Sekcje powyżej mają `z-index:1` i naturalnie zakrywają canvas. `margin-top:-100vh` na `#final-section` pozwala na reveal bez JS.

**Konsekwencja P3:** Cała logika lifecycle (IO observer, pause/resume) pozostaje w `init()`. Żaden cleanup nie jest potrzebny w React `useEffect` — `kill()` obsługuje wszystko.

### ARCH-02 — IO observer na stickyEl, nie container
`#final-section` ma `margin-top:-100vh` — IO na containerze z `rootMargin:0` nigdy by nie wykrył wejścia. Observer obserwuje `#final-sticky` zamiast.

### ARCH-03 — 3-fazy warmup z requestIdleCallback
```
Faza 1 (sync):  renderer + canvas + DOM           ~30ms
Faza 2 (idle):  pmrem + shadery + geo + szkło     ~500ms  timeout:1000ms
Faza 3 (idle):  digit textures + compileAsync     ~150ms  timeout:2000ms
```
Bez tego podziału: freeze przeglądarki przy otwarciu strony.

### ARCH-04 — transmission glass wrażliwy na Three.js version
`onBeforeCompile` robi `.replace('#include <tonemapping_fragment>', ...)`.
Ten chunk może zmienić miejsce w przyszłych wersjach Three.js.
**Po aktualizacji Three.js:** zawsze sprawdź shader szkła wizualnie.

### ARCH-05 — dispMap base64 — pełna wersja wymagana
Skrócona dispMap (424 znaki) = brak efektu dissolve cyfr zegara.
Pełna (4418 znaków) = organiczne plamy wielowarstwowe.
Nigdy nie skracaj/optymalizuj tego stringa base64.

### ARCH-06 — Bottom sheet karta
`_cardMaxUp` obliczany w `positionCard()` = dokładny overflow karty na danym urządzeniu.
Tap/click = toggle. Velocity >350px/s = snap.
`pointer-events` zarządzane przez JS w `positionCard()`.

### PERF-01 — Dlaczego nie throttlujemy FPS na desktopie
30fps na desktopie + lerpy bez dt-compensation = efekt slow motion (nie dropped frames).
Wszystkie lerpy są dt-compensated (`1 - Math.pow(1-factor, dt60)`).
30fps zostaje TYLKO na mobile jako oszczędność termalna.

### PERF-02 — transmission:1.0 na wszystkich urządzeniach
O4 (transmission:0 na mobile) demolowała shader compilation cache.
`onBeforeCompile` z `replace()` nie trafia w transparent shader → ghost na Ctrl+F5.
Kompromis: jeden materiał, jeden shader, zawsze identyczny — cache GPU nigdy nie jest problematyczny.

---

## PLIK ŹRÓDŁOWY CSS — DO P3

```css
/* Sekcja: #final-section, #final-sticky, #final-scene, #final-formCard */
/* DEV overlay CSS (między markerami) = USUNIĘTE przez P3 */
/* preview-spacer CSS = USUNIĘTE przez P3 (harness-only) */
/* fake-* CSS = USUNIĘTE przez P3 (harness-only) */
```

CSS produkcyjny (pozostaje po P3):
- `#final-section` — relative, z-index:0, margin-top:-100vh, background:#f7f6f4
- `#final-sticky` — sticky, top:0, height:100vh, pointer-events:none
- `#final-section #final-scene` — absolute, inset:0
- `#final-section #final-scene canvas` — width/height 100%
- `#final-section #final-formCard` — absolute, top:50%, transform:translate(-50%,-50%), pointer-events zarządzane przez JS
- `.preview-spacer::after` — shadow gradient (animation-timeline: view(), opacity only)

---

## DEVELOPER HANDOFF NOTES dla P3

**Import Three.js add-onu:**
```typescript
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
```
Ścieżka potwierdzona z importmap w reference.html.

**Nie ma ScrollTrigger** — nie importuj, nie rejestruj.

**dynamic import wrapping wymagany** — `dynamicImport: true`, `clientOnly: true`.
Three.js importuje przez ESM, `window.WebGLRenderingContext` nie istnieje na SSR.

**getScroll dead code** — usuń `var getScroll = function(){...}` z init() — nigdy niewywoływany.

**window._finalInit / window._finalRef** — auto-init pattern poza DEV overlay markerami. Usuń w P3 (są harness-only).

**window._finalMeta** — debug metadata, jest wewnątrz init() za `if(DEBUG_MODE)`. Zostaje — jest za guardem.

**scrollRuntime w init()** — NIE istnieje wewnątrz `function init(container)`. Stub jest poza init() w harness. Brak podmiany potrzebnej.
