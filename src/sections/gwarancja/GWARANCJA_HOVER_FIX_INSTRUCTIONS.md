# GWARANCJA HOVER-LAG FIX — Instrukcja wdrożenia do produkcji

## Kontekst

Sekcja `gwarancja` po konwersji do React/Next.js wykazuje opóźnienie hover:
prześwit (lens mask) pojawia się z 200–300ms lagiem, kursor (tarcza) freezuje
przy ruchach w dolnej części kontenera. Poniżej 5 fixów — przetestowanych
i potwierdzonych w reference.html, do mechanicznego wdrożenia w produkcji.

**WAŻNE:** Fixy dotyczą wyłącznie funkcji `init(container)` wewnątrz
`GwarancjaSection.tsx`. Nie zmieniaj: CSS, JSX, komponentu React, importów,
useGSAP wrappera. Zmienia się TYLKO logika wewnątrz init().

---

## FIX A — Factory IO race condition

### Problem
Factory IO przy starcie strony widzi sekcję poza viewport → wywołuje `pause()`
→ wewnętrzny IO odpala z `paused=true` → `bindDoc()` nigdy nie wywołane →
mousemove nie nasłuchiwany → nic nie działa.

### Rozwiązanie
Dodaj flagę `_factoryHasBeenActive`. Factory IO wywołuje `pause()` TYLKO jeśli
sekcja wcześniej była aktywna (user ją widział i wyscrollował).

### Lokalizacja
W bloku `// FACTORY CPU GATING — Ścieżka 1`, tuż po `let _factoryKilled = false;`

### Zmiany
```diff
  let _factoryKilled = false;
+ let _factoryHasBeenActive = false;
  let _factoryIO = null;
  // ...
- function _factoryIOCallback(entries){
-   if(!entries[0])return;
-   if(entries[0].isIntersecting){resume();}
-   else{pause();}
- }
+ function _factoryIOCallback(entries){
+   if(!entries[0])return;
+   if(entries[0].isIntersecting){_factoryHasBeenActive=true;resume();}
+   else{if(!_factoryHasBeenActive)return;pause();}
+ }
```

---

## FIX 1 — Direct mouseenter bypass IO delay

### Problem
W React/Next.js: `isContainerVisible` ustawiane asynchronicznie przez IO.
User może najechać myszką zanim IO callback odpali → `processMousePos`
ignoruje mousemove bo `isContainerVisible=false`.

### Rozwiązanie
Dodaj bezpośredni `mouseenter` listener na `containerEl` który synchronicznie
ustawia `isContainerVisible=true`, binduje doc, i wywołuje `handleMouseEnter`.

### Lokalizacja
Tuż PO linii `io.observe(containerEl);observers.push(io);cleanups.push(()=>unbindDoc());`

### Kod do dodania
```javascript
// FIX 1: Direct mouseenter — bypass IO delay (React-specyficzne)
const _onDirectEnter = (e) => {
  if (paused || isMobileDisabled) return;
  updateCachedRect();
  if (!isContainerVisible) isContainerVisible = true;
  if (!documentListenerBound) bindDoc();
  const x = e.clientX - cachedRect.left;
  const y = e.clientY - cachedRect.top;
  if (!isVirtuallyInside) {
    isVirtuallyInside = true;
    handleMouseEnter(x, y);
  }
};
containerEl.addEventListener('mouseenter', _onDirectEnter, { passive: true });
cleanups.push(() => containerEl.removeEventListener('mouseenter', _onDirectEnter));
```

**TypeScript wersja:** Parametr `(e: MouseEvent)`, addEventListener na
`(containerEl as HTMLElement)`.

---

## FIX 3 — Fresh cachedRect w processMousePos

### Problem
Scroll przesuwa kontener, `cachedRect` ma 100ms debounce update. Relatywna
pozycja Y liczona ze złego `top` → phantom leave triggerowany.

### Rozwiązanie
Dodaj `updateCachedRect()` na początku `processMousePos` (jest już za rAF
throttle, więc koszt jednego getBoundingClientRect per frame akceptowalny).

### Lokalizacja
Pierwsza linia `processMousePos`, po guardzie `if(paused||...)`

### Zmiana
```diff
  function processMousePos(){
    rafPending=false;
    if(paused||!isContainerVisible||isMobileDisabled)return;
+   updateCachedRect(); // FIX 3: zawsze świeży rect
    const x=lastMouseX-cachedRect.left, ...
```

---

## FIX 4 — Natychmiastowy prześwit (seed alpha + initial radius + alpha 0.3s)

### Problem
Alpha startuje od 0, tween 0.5s → prześwit widoczny dopiero po ~200ms.
Radius startuje od 0 → koło zerowe = prześwit niewidoczny niezależnie od alpha.
Efekt: user najeżdża → nic nie widzi przez 200ms → niereagujące wrażenie.

### Rozwiązanie trzyetapowe

#### 4a. Seed alpha + initial radius w handleMouseEnter
Na początku `handleMouseEnter`, tuż po `hasEnteredOnce = true;`:
```diff
  function handleMouseEnter(rx, ry){
    if(paused)return;
    hasEnteredOnce = true;
+   // FIX 4a: seed alpha + initial radius — prześwit od pierwszej ramki
+   maskState.alpha = 0.02;           // odblokuje renderMask (próg: 0.01)
+   maskState.radius = 0.25 * scaledRadius; // 25% docelowego — widoczny start
+   targetAlpha = 0.5;
+   lmNone = false;
    maskPos.x = rx; maskPos.y = ry;
```

#### 4b. Alpha duration 0.5→0.3 w processMousePos
```diff
- gsap.to(maskState,{alpha:0.5, duration:0.5, ease:'power2.out', overwrite:'auto'})
+ gsap.to(maskState,{alpha:0.5, duration:0.3, ease:'power2.out', overwrite:'auto'})
```
Lokalizacja: blok `if(targetAlpha!==0.5)` wewnątrz `if(isVirtuallyInside)`.

#### 4c. Alpha duration 0.5→0.3 w stopTxtIdle
```diff
  function stopTxtIdle(){
    // ...
-   gsap.to(maskState,{alpha:0.5, duration:0.5, ease:'power2.out', overwrite:'auto'})
+   gsap.to(maskState,{alpha:0.5, duration:0.3, ease:'power2.out', overwrite:'auto'})
```

**NIE zmieniaj:**
- `alpha:0.0, duration:1` w `startTxtIdle` (idle fade-out, inny flow)
- `alpha:0, duration:0.5` w `handleMouseLeave` (leave fade-out)
- `radius:scaledRadius, duration:0.8, ease:'elastic.out(1, 0.75)'` (radius elastic)

---

## FIX B — Oddzielone granice lens/tarcza + tarczaOutro nie zatrzymuje loop

### Problem
1. `BOUNDARY_Y_LEAVE = 0.75` = strefa martwa 25% od dołu kontenera. Ruch
   kursora ku badge/CTA triggerował `handleMouseLeave` → cały prześwit znikał.
2. `tarczaOutro` ustawia `tFollowing=false` → `tarczaLoop` przestaje śledzić
   kursor → gauge freeze.

### Rozwiązanie
Oddziel granicę lens (prześwit — pełna wysokość + 50px) od granicy tarcza
(gauge — strefa 0.20–0.75). tarczaOutro nie zatrzymuje loop.

#### B1. tarczaOutro — usuń `tFollowing=false`
```diff
- function tarczaOutro(){tActive=false;tFollowing=false;stopSec();
+ function tarczaOutro(){tActive=false;stopSec();
```

#### B2. processMousePos — rozdzielone granice
Zamień blok obliczania granic:
```diff
  const yMin=h*BOUNDARY_Y_ENTER, yMax=h*BOUNDARY_Y_LEAVE;
- const inX=x>=0&&x<=w, inY=y>=yMin&&y<=yMax, should=inX&&inY;
- if(should&&!isVirtuallyInside){isVirtuallyInside=true;handleMouseEnter(x,y);}
- else if(!should&&isVirtuallyInside){isVirtuallyInside=false;handleMouseLeave();}
- if(inX&&y>=-50&&y<=h+50){
+ // FIX B: Lens = full height+50px. Tarcza = 0.20–0.75.
+ const inX=x>=0&&x<=w;
+ const should=inX&&y>=-50&&y<=h+50;
+ const inTarcza=inX&&y>=yMin&&y<=yMax;
+ if(should&&!isVirtuallyInside){isVirtuallyInside=true;handleMouseEnter(x,y);}
+ else if(!should&&isVirtuallyInside){isVirtuallyInside=false;handleMouseLeave();}
+ if(inTarcza&&!tActive&&tFollowing){tarczaIntro(x,y);clockPlay();}
+ else if(!inTarcza&&tActive){tarczaOutro();clockPause();}
+ if(inX&&y>=-50&&y<=h+50){
```

---

## Checklist weryfikacji po wdrożeniu

```
[ ] FIX A:  grep "_factoryHasBeenActive" → 2 trafienia (deklaracja + callback)
[ ] FIX 1:  grep "_onDirectEnter" → 3 trafienia (deklaracja + addEventListener + cleanup)
[ ] FIX 3:  grep "updateCachedRect.*FIX 3" → 1 trafienie (w processMousePos)
[ ] FIX 4a: grep "maskState.alpha = 0.02" → 1 trafienie (w handleMouseEnter)
[ ] FIX 4a: grep "maskState.radius = 0.25" → 1 trafienie (w handleMouseEnter)
[ ] FIX 4b: grep "alpha.*0.3" w processMousePos → tak
[ ] FIX 4c: grep "alpha.*0.3" w stopTxtIdle → tak
[ ] FIX B1: tarczaOutro NIE zawiera "tFollowing=false"
[ ] FIX B2: grep "inTarcza" → 3 trafienia (deklaracja + 2 warunki)
[ ] Żadne wartości GSAP (duration/ease/scale/rotation) NIE zmienione poza alpha 0.5→0.3
[ ] CSS sekcji NIE zmieniony
[ ] JSX komponentu NIE zmieniony
[ ] handleMouseLeave zachowany bez zmian
```

## Wartości które się ZMIENIŁY (kompletna lista)

| Wartość | Przed | Po | Gdzie |
|---------|-------|----|-------|
| alpha duration (enter) | 0.5s | 0.3s | processMousePos, stopTxtIdle |
| initial maskState.alpha | 0 | 0.02 (seed) | handleMouseEnter |
| initial maskState.radius | 0 | 0.25 × scaledRadius | handleMouseEnter |
| lens boundary Y | yMin–yMax (0.20–0.75) | -50px – h+50px | processMousePos |
| tFollowing in tarczaOutro | set to false | NOT set | tarczaOutro |
| Factory IO first-fire | calls pause() | skips (no-op) | _factoryIOCallback |

## Wartości które się NIE ZMIENIŁY (potwierdzenie)

- radius tween: `duration:0.8, ease:'elastic.out(1, 0.75)'` ← BEZ ZMIAN
- alpha idle fade: `duration:1` ← BEZ ZMIAN
- alpha leave: `duration:0.5` ← BEZ ZMIAN
- tarcza intro/outro easing, duration ← BEZ ZMIAN
- BOUNDARY_Y_ENTER, BOUNDARY_Y_LEAVE constants ← BEZ ZMIAN (użyte do inTarcza)
- renderMask logic ← BEZ ZMIAN
- pause/resume hooks ← BEZ ZMIAN
- kill() ← BEZ ZMIAN
