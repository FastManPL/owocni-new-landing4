# P2A EVIDENCE PACK — final-section (WebGL Footer)
## Sekcja: `final`
## Data: 2026-03-30
## Plik źródłowy: `final.reference.html`

---

## SECTION IDENTITY

```
slug:     final
type:     B  (Intersection Observer CPU gating — pause/resume lifecycle)
role:     footer / CTA
webgl:    true (Three.js 0.160.0 — MeshPhysicalMaterial + custom ShaderMaterial)
```

---

## EXTERNAL CDN LIBRARIES

| URL | Global var | NPM package |
|-----|-----------|-------------|
| `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.7/gsap.min.js` | `gsap` | `gsap@3.12.7` |
| `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js` | `THREE` (ESM) | `three@0.160.0` |
| `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js` | `RoomEnvironment` (ESM named) | `import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'` |

**GSAP plugins użyte:** BRAK (bez ScrollTrigger, bez żadnych pluginów)
`GSAP_PLUGINS_USED = []`

---

## KEY STATE (zmienne modułu, dostępne przez closure)

```
renderer        — THREE.WebGLRenderer | null
scene           — THREE.Scene
camera          — THREE.PerspectiveCamera
mesh            — THREE.Mesh (główna płaszczyzna z ShaderMaterial)
mat             — THREE.ShaderMaterial
geo             — THREE.PlaneGeometry
glassMat        — THREE.MeshPhysicalMaterial (transmission:1.0)
glassGeo        — THREE.ExtrudeGeometry
clockParent     — THREE.Group
dispMap         — THREE.Texture (displacement map dla animacji cyfr)
digitTex[]      — THREE.CanvasTexture[10] (cyfry 0-9)
slots[]         — { mesh, mat, curVal, tgtVal, isAnim }[]
tickFn          — function | null
ticking         — boolean
isWarmed        — boolean
_paused         — boolean (start: true)
isKilled        — boolean
isPageVisible   — boolean
_ioState        — boolean
_ioWarm         — IntersectionObserver | null
cleanups[]      — cleanup functions
observers[]     — IntersectionObserver[]
timerIds[]      — { type, id }[]
gsapInstances[] — GSAP instances (auto-pruned >50)
_cardMaxUp      — number (px overflow karty poza viewport)
_cardExpanded   — boolean
w, h, dpr       — number (viewport dimensions)
```

---

## BRAMKI P2A — STATUS

### B-LC-RET-01 — init() zwraca `{ kill }` na wszystkich ścieżkach

**PASS**

Ścieżka 1 — early return gdy brak `#final-scene`:
```javascript
if (!el) return {pause:function(){},resume:function(){},kill:function(){}};
```

Ścieżka 2 — normalny return:
```javascript
return { pause:pause, resume:resume, kill:kill };
```

Zwracany kontrakt: `{ pause: () => void, resume: () => void, kill: () => void }`

---

### P3-CLEAN-01 — kill() ma guard idempotencji

**PASS**

```javascript
function kill(){
  isKilled=true; _s._killed=true;  // ← podwójny guard
  ...
}
```

`isKilled` sprawdzany w `warmup()`: `if(renderer || isKilled) return;`
`_s._killed` sprawdzany w `_recreateIO()`: `if(_s._killed) return;`

---

### DEV-DEL-01 — DEV overlay oznaczony do usunięcia

**PASS**

Oba markery obecne w pliku:
```
<!-- FACTORY:DEV-OVERLAY:START -->   ← linia 115
<!-- FACTORY:DEV-OVERLAY:END -->     ← linia 161
```

Blok zawiera: KILL button, INIT AGAIN button, metrics display, `setInterval` dla metrics.
Całość warunkowana przez `?debug=1` lub `localStorage.debug === '1'`.
Wszystkie `window._finalRef`, `window._finalInit` są WEWNĄTRZ tego bloku lub w bootstrap po nim.

**Akcja P3:** usuń cały blok między markerami włącznie.

---

### ST-CLEAN-01 — ScrollTrigger instances cleanowane w kill()

**N/A**

Sekcja NIE używa ScrollTrigger. Brak żadnego `ScrollTrigger.create()`, `gsap.timeline({ scrollTrigger: ... })` ani podobnych. CPU gating przez IntersectionObserver, nie ST.

---

### INP-LEAK-01 — brak wyciekających event listenerów po kill()

**PASS**

Wszystkie listenery są rejestrowane w `cleanups[]` lub `observers[]`:

```javascript
// resize
var _onResize=function(){...};
window.addEventListener('resize',_onResize);
cleanups.push(function(){ window.removeEventListener('resize',_onResize); });

// visibilitychange
var _onVisChange=function(){...};
document.addEventListener('visibilitychange',_onVisChange);
cleanups.push(function(){ document.removeEventListener('visibilitychange',_onVisChange); });

// pointermove — dodawany/usuwany przez pause/resume (nie przez cleanups)
// → obsługiwany przez hfListeners[] pattern w resume()/pause()

// visualViewport resize
var _onVVResize = function(){...};
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', _onVVResize, {passive:true});
  cleanups.push(function(){
    clearTimeout(_ioDebounce);
    window.visualViewport.removeEventListener('resize', _onVVResize);
  });
}

// webglcontextlost/restored — na renderer.domElement
// → renderer.dispose() + domElement.remove() w kill() czyści te listenery

// card bottom sheet touchstart/touchend/click
// → zarejestrowane w cleanups.push() w _setupCardBottomSheet()
```

`kill()` wywołuje `cleanups.forEach(fn => fn())` — wszystkie listenery usuwane.

---

### INIT-DOM-01 — init() nie modyfikuje DOM poza containerem

**PASS (z wyjątkiem DEV overlay)**

`init(container)` modyfikuje wyłącznie:
- `container` (querySelector, style)
- `el` (`#final-scene`) — canvas append: `el.appendChild(renderer.domElement)`
- `cardEl` (`#final-formCard`) — style, handle inject

`document.body.appendChild()` na linii 147 jest WEWNĄTRZ bloku DEV-OVERLAY (między markerami). Po usunięciu bloku przez P3 — brak modyfikacji poza containerem.

⚠️ **Uwaga dla P3:** Po usunięciu DEV overlay, `window._finalInit = init` i `window._finalRef = init(el)` w bootstrap również do usunięcia (są poza markerami ale są auto-init pattern).

---

### PIN-DISABLE-01 — gating CPU nie używa ST.disable() jako mechanizmu pauzy

**N/A**

`hasPin: false` — sekcja nie używa ScrollTrigger pin. Brak ryzyka.

---

### B-ISO-01 — isolation:isolate w CSS

**OWNER-DECISION-PENDING**

CSS sekcji NIE zawiera `isolation: isolate`. Wzmianka tylko w komentarzu JS:
```javascript
//   B-ISO-01           — isolation:isolate w CSS
```

Brak implementacji. P3 NIE dodaje isolation inline — zgodnie z zasadą "isolation pochodzi wyłącznie z hardened CSS (P2A)".

---

### AUTO-FIX ST-REFRESH-01 — refreshSignals

**N/A**

Sekcja nie używa ScrollTrigger. Brak potrzeby refresh signals.

---

### GL-WARM-01 — compileAsync przed HOT

**PASS**

```javascript
var compilePromise = renderer.compileAsync ? renderer.compileAsync(scene,camera) : Promise.resolve();
compilePromise.then(function(){
  isWarmed = true;
  if(!_paused && !ticking && tickFn){ gsap.ticker.add(tickFn); ticking=true; }
}).catch(function(e){
  isWarmed = true;
  if(!_paused && !ticking && tickFn){ gsap.ticker.add(tickFn); ticking=true; }
});
```

---

### GL-MEM-01 — pełny dispose w kill()

**PASS**

```javascript
renderer.dispose();
renderer.domElement.parentNode.removeChild(renderer.domElement);
envRT.dispose();
mesh.geometry.dispose();
mat.dispose();
U.uTexture.value.dispose();
glassGeo.dispose();
glassMat.dispose();
dispMap.dispose();
digitTex[i].dispose() × 10;
dayTexCache.juzJest.dispose();
dayTexCache.days[j].dispose() × 7;
renderer=null; isWarmed=false;
```

---

### GL-CPU-01 — render loop z CPU gatingiem

**PASS**

```
start PAUSED (_paused=true)
IO ENTER → resume() → gsap.ticker.add(tickFn)
IO LEAVE → pause() → gsap.ticker.remove(tickFn)
visibilitychange hidden → gsap.ticker.remove(tickFn)
visibilitychange visible → gsap.ticker.add(tickFn)
```

---

### NULL-GUARD-01 — cardEl guard

**PASS**

```javascript
function positionCard(){
  if(!cardEl) return; // NULL-GUARD-01
  ...
}
```

---

### CPU-Gating-Sciezka1 — IO wywołuje pause()/resume()

**PASS** — IO observer na `stickyEl` (nie container) z `rootMargin: 5×VH`.

---

## SCROLL API — USAGE MAP

```javascript
// Wewnątrz init() — helper lokalny (write-only, nigdy wywołany):
var getScroll = function(){ return window.lenis ? window.lenis.scroll : window.scrollY; };

// scrollRuntime stub (poza init, w harness) — NIE wchodzi do P3
```

⚠️ **P3 uwaga:** `var getScroll` jest zadeklarowany wewnątrz `init()` ale **nigdy nie wywoływany**. To dead code (TS-LINT-UNUSED-01). P3 usuwa tę deklarację.

**Podmiana scroll API:** BRAK — `getScroll()` nie jest wywoływane. `scrollRuntime` import — BRAK w init(). Nie ma nic do podmiany.

---

## GSAP — FOUC ANALYSIS

**Brak `gsap.from()` ani `gsap.fromTo()` z literałami widocznymi przy mount.**

Wszystkie animacje GSAP są:
- Wewnątrz `tickFn` (co-klatkowe, nie przy mount)
- W `animateSlot()` (reaguje na zmianę czasu)
- W `showDay()` / `hideDay()` (cykliczne, z opóźnieniem)
- W `_setupCardBottomSheet()` (touch-driven)

`fouc_inline: "brak gsap.from literałów"`

---

## WEBGL CONFIG

```
canvasOwnership:  runtime (canvas tworzony przez Three.js, usuwany w kill())
warmup:           idle (requestIdleCallback + rAF fallback)
transmission:     true (MeshPhysicalMaterial, transmission:1.0 na wszystkich urządzeniach)
onBeforeCompile:  true (rim gradient — wrażliwy na wersję Three.js)
compileAsync:     true (w fazie 3 warmup)
dispose:          full (wszystkie geometry/material/texture w kill())
```

---

## PERF FLAGS

```
O1:  antialias off mobile (innerWidth < 768)
O2:  single gauss() call w vertex shaderze (dead code usunięty)
O3:  pow(x,20) → 4× MUL (nh20 = nh8*nh8*nh4)
O5:  makeTexture DPR = renderer DPR (1:1 sampling)
O6:  hasPointerInput flag (phantom cursor fix mobile)
O7:  handleResize 60px deadband (toolbar show/hide)
O8:  positionCard cached w/h, _lastMinH guard
O9:  30fps mobile (gsap.ticker.fps(30))
O10: IO debounce 300ms + active guard
O11: clock interval 1000ms (było 100ms)
O12: gsapInstances auto-prune >50
```
