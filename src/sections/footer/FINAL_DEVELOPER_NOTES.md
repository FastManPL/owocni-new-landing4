# NOTATKI DEWELOPERSKIE — Sekcja `final` (WebGL Footer)
## Owocni.pl — LP Production
## Autor: Claude + właściciel Owocni, marzec 2026

---

> **Dla dewelopera który to montuje:**
> Ten dokument to skrót z kilkudziesięciu godzin pracy, błędów i napraw.
> Przeczytaj go zanim dotkniesz kodu. Zaoszczędzi Ci co najmniej tydzień.

---

## 1. ARCHITEKTURA — DLACZEGO TAK, A NIE INACZEJ

### Sticky reveal (NIE `position:fixed` na canvasie)

```css
#final-section  { position: relative; margin-top: -100vh; z-index: 0; }
#final-sticky   { position: sticky; top: 0; height: 100vh; }
#final-scene    { position: absolute; inset: 0; } /* canvas WebGL */
```

**`position:fixed` na WebGL canvas = gwarantowany jitter.** Byliśmy tam. Fixed synchronizuje się z layout thread, WebGL renderuje na rAF — te dwa cykle nie są zsynchronizowane. Na 60Hz monitor dostaje canvas który "skacze" o 1-2px przy każdym scrollu. Niewidoczne na szybkim GPU, katastrofa na mobile.

Sticky pattern: sekcje powyżej mają `z-index:1` i naturalne tło — po prostu zakrywają canvas. Gdy user scrolluje i poprzednia sekcja odjeżdża, canvas "się odsłania". `margin-top:-100vh` sprawia że sekcja zaczyna się dokładnie pod poprzednią.

**Zasada:** nigdy nie zmieniaj `position` na `#final-sticky` ani `#final-scene`. Cały reveal timing oparty jest na tej geometrii.

---

### IO observer na `#final-sticky`, nie na `#final-section`

`#final-section` ma `margin-top:-100vh` — jest geometrycznie cofnięty o 100vh. IO observer z `rootMargin:0` nigdy by nie wykrył wejścia w viewport bo element "zaczyna się" 100vh powyżej gdzie jest na ekranie.

`#final-sticky` nie ma tego offsetu — obserwowanie go działa poprawnie.

`rootMargin: 5×VH` — sekcja startuje warmup gdy user jest jeszcze daleko. To daje czas na 3-fazowy idle warmup zanim sekcja wejdzie w viewport.

---

### 3-fazowy warmup z `requestIdleCallback`

```
Faza 1 (sync,  ~30ms):  renderer + canvas + DOM event handlers
Faza 2 (idle, ~500ms):  pmrem env + shadery + geometria + glass   timeout:1000ms
Faza 3 (idle, ~150ms):  digit textures + buildClock + compileAsync timeout:2000ms
```

Bez podziału na fazy: otwierasz stronę, przeglądarka freezuje na 300-800ms. Na słabym GPU nawet 2-3 sekundy. Użytkownik myśli że strona się zawiesila.

`requestIdleCallback` = przeglądarka sama wybiera moment gdy main thread jest wolny. Warmup dzieje się "między" scrollowaniem, animacjami, layoutem. `timeout` gwarantuje że jeśli CPU nigdy nie jest idle — odpali się po max X ms.

Fallback na `requestAnimationFrame` dla Safari który nie ma `requestIdleCallback`.

**Zasada:** nie łącz faz. Nie "upraszczaj" warmup do jednej funkcji. Każdy `requestIdleCallback` to okno dla przeglądarki żeby oddychać.

---

## 2. TRANSMISSION GLASS — NAJDELIKATNIEJSZA CZĘŚĆ

### Nie zmieniaj `transmission:1.0` na mobile

Próbowaliśmy. `transmission:0, transparent:true, opacity:0.12` na mobile demolowało shader compilation cache.

Dlaczego: `onBeforeCompile` robi:
```javascript
sh.fragmentShader = sh.fragmentShader
  .replace('void main() {', 'varying ... void main() {')
  .replace('#include <tonemapping_fragment>', '{vec3 vn=... rimInt;}...');
```

Chunk `#include <tonemapping_fragment>` istnieje w shaderze `transmission:1.0` ale ma inną strukturę gdy `transparent:true`. Na Ctrl+F5 (zimna kompilacja bez cache GPU) — replace nie trafia, rim gradient znika, badge wygląda jak duch.

**Jedyne rozwiązanie:** jeden materiał, jeden shader, `transmission:1.0` zawsze. Trójfazowy warmup chroni przed freeze.

### onBeforeCompile jest wrażliwy na wersję Three.js

Rim gradient (fioletowo-czerwone krawędzie badge'a) jest wstrzykiwany przez `onBeforeCompile`. Po każdej aktualizacji Three.js sprawdź badge szkła wizualnie. Jeśli jest matowy/szary — chunk się przesunął, replace nie trafia.

### Geometria szkła: `ExtrudeGeometry` z `bevelEnabled`

```javascript
{depth:GD, bevelEnabled:true, bevelSegments:8, bevelSize:0.09, bevelThickness:GB, curveSegments:32}
```

`curveSegments:32` — zaokrąglone rogi. Zmniejszenie = pikselowane rogi.
`bevelSegments:8` — gładkość krawędzi 3D. Zmniejszenie = ostre przejścia.

---

## 3. ZEGAR — ANIMACJA CYFR (DISPLACEMENT DISSOLVE)

### dispMap base64 MUSI być pełna (4418 znaków)

Mapa displacement cyfr to inline SVG z organicznymi plamami. Są dwie wersje:
- Skrócona (424 znaki): jedna ścieżka, prawie brak efektu
- **Pełna (4418 znaków): wielowarstwowe plamy — właśnie ta jest w kodzie**

Nigdy nie "optymalizuj" tego stringa. Minifikatory mogą go uszkodzić. Trzymaj 1:1.

### dispMap musi być zaktualizowana w slotach po załadowaniu

```javascript
_di.onload = function() {
  dispMap.image = _di;
  dispMap.needsUpdate = true;
  // KRYTYCZNE: sloty tworzone PRZED załadowaniem mapy
  slots.forEach(s => { s.mat.uniforms.uDisp.value = dispMap; });
  if (dayMat) dayMat.uniforms.uDisp.value = dispMap;
};
```

Bez tego: materiały slotów mają `uDisp: undefined` → `str = 0` → brak displacement → cyfry skaczą bez animacji.

### isAnim must reset w killAll()

```javascript
function killAll() {
  slots.forEach(s => {
    gsap.killTweensOf(s.mat.uniforms.uT);
    s.isAnim = false; // KRYTYCZNE — bez tego animacje cyfr blokują się na zawsze
  });
}
```

`gsap.killTweensOf()` zabija tweena ale `onComplete` nigdy nie odpala → `isAnim` zostaje `true` → każde kolejne `animateSlot()` zwraca natychmiast przez `if(slot.isAnim) return`. Po pierwszym cyklu dzień/zegar — wszystkie cyfry przestają się animować.

### compileAsync przed startem tickera

```javascript
compilePromise.then(() => {
  isWarmed = true;
  // resume() mogło się już odbyć — ticker startuje tutaj, nie w resume()
  if (!_paused && !ticking && tickFn) {
    gsap.ticker.add(tickFn);
    ticking = true;
  }
});
```

Bez tego: `resume()` wywołuje się gdy `isWarmed` jest jeszcze `false` → warunek nie przechodzi → ticker nigdy nie startuje → cyfry skaczą (setInterval działa, ale WebGL nie renderuje).

---

## 4. PERFORMANCE — KOMPROMISY KTÓRE PODJĘLIŚMY

### PlaneGeometry 32×32 (nie 128×128)

```javascript
new THREE.PlaneGeometry(planeW, planeH, 32, 32) // -93% vertex processing
```

Przy 32×32 pojawiają się subtelne kwadratowe artefakty na krawędziach wypukłości gaussowskiej. To był świadomy wybór — efekt wygląda interesująco (pixel art), oszczędność GPU realna.

Jeśli klient chce gładszą wypukłość: `64×64`. Nigdy z powrotem do `128×128`.

### Normal shader: `vNrm` varying zamiast `dFdx/dFdy`

Zastąpiliśmy 6 derivative calculations per pixel interpolowaną normalną z vertex shadera:
```glsl
// vertex:
float bz = gauss(vContentUv, mc, uBulgeSize) * uBulgeH * (eL*eR*eB*eT);
vec2 grad = gaussGrad(vContentUv, mc, uBulgeSize) * uBulgeH * (eL*eR*eB*eT);
vNrm = normalize(vec3(-grad.x * 0.08, -grad.y * 0.08, 1.0));

// fragment:
vec3 N = normalize(vNrm); // zamiast cross(dFdx(vWorldPos), dFdy(vWorldPos))
```

Współczynnik `0.08` tłumi gradient — bez niego gaussowska pochodna jest za ostra i normalna wskazuje prawie pionowo = "szpic" zamiast gładkiej kuli.

### DPR cap 1.0

Na Retina/4K renderujemy jak zwykły monitor. Na DPR=2 fragment shader liczy 4× więcej pikseli — na fullscreen scenie z transmission pass to potrafi zamulić mocny desktop.

Jeśli klient ma dedykowane GPU i prosi o ostrzejszy obraz: `Math.min(devicePixelRatio, 1.5)`. Nigdy powyżej 2.0.

### Render width cap 2340px

```javascript
var rw = Math.min(w, 2340);
renderer.setSize(rw, h, false); // false = nie nadpisuj CSS
```

`false` w `setSize` = Three.js nie ustawia `canvas.style.width`. CSS `width:100%` rozciąga canvas do pełnej szerokości przez GPU scaling. Zero dodatkowego kosztu obliczeniowego.

### 30fps tylko na mobile

30fps na desktopie + lerpy bez dt-compensation = efekt slow motion.

Wszystkie lerpy w tickFn są dt-compensated:
```javascript
var _lerpDt = 1.0 - Math.pow(1.0 - P.lerp, dt60);
smooth.x += (mouse.x - smooth.x) * _lerpDt;
```

Formuła `1 - Math.pow(1-factor, dt60)` gdzie `dt60 = dt * 60` sprawia że animacja wygląda identycznie niezależnie od FPS. Bez tego każde obniżenie FPS = proporcjonalne spowolnienie ruchów.

---

## 5. IO OBSERVER — SUBTELNA PUŁAPKA

### Dwa observery w jednym

Mamy jeden observer z `rootMargin: 5×VH` który:
1. Triggeruje `warmup()` gdy sekcja jest daleko (5×VH przed viewport)
2. Triggeruje `resume()` przy tym samym wejściu

To uproszczone rozwiązanie. Oryginalnie próbowaliśmy dwóch observerów (prewarm + hot) — to spowodowało że ticker nigdy nie startował przez race condition z `compileAsync`. Jeden observer z dużym rootMargin + logika w `compileAsync.then()` jest prostsze i niezawodne.

### Observer disconnect przy recreate

```javascript
if (_ioWarm) {
  _ioWarm.disconnect();
  var idx = observers.indexOf(_ioWarm);
  if (idx >= 0) observers.splice(idx, 1); // KRYTYCZNE — bez tego tablica rośnie
}
```

Bez `splice`: tablica `observers[]` rośnie przy każdym resize okna (visualViewport.resize triggeruje `_recreateIO()`). Po dłuższej sesji: dziesiątki martwych observerów w pamięci.

---

## 6. BOTTOM SHEET KARTA

### Karta ucięta = zamierzone

Karta formularza na mobile jest celowo ucięta u dołu. Użytkownik najpierw widzi tekst "DOBRY CZAS JEST TERAZ" i zegar. Formularz wymaga aktywnego gestu.

### Mechanika

```javascript
_cardMaxUp = Math.max(0, cardTopPx + 640 - (vh - 40));
// = dokładnie ile px karta wystaje poza viewport (z 40px marginesem)
```

Tap lub click = toggle expand/collapse. Velocity swipe >350px/s = snap.

Dlaczego velocity a nie dystans: powolny ruch w dół i szybki swipe w dół wyglądają tak samo bez mierzenia czasu. `velocity = dy / dt * 1000` (px/s) rozróżnia je.

### pointer-events zarządzane przez JS

```javascript
// mobile (<1200px):
cardEl.style.pointerEvents = 'auto';
// desktop (>=1200px):
cardEl.style.pointerEvents = 'none';
```

Nie ustawiaj `pointer-events:none` na `#final-formCard` w CSS globalnie — zepsuje bottom sheet. Zarządzanie jest w `positionCard()`.

---

## 7. CZEGO NIE WOLNO OPTYMALIZOWAĆ

| Co | Dlaczego nie |
|----|-------------|
| dispMap base64 | Skrócona = brak animacji dissolve cyfr |
| `transmission:1.0` → `transparent` | Demoluje shader cache — ghost na Ctrl+F5 |
| Fazy warmup → jedna sync funkcja | Freeze przeglądarki na 300-800ms |
| Lerpy bez dt-compensation | 30fps = slow motion efekt |
| `32×32` → więcej subdivisions | -93% vertex processing to celowy kompromis |
| `onBeforeCompile` replace strings | Wrażliwe na wersję Three.js — sprawdź po aktualizacji |
| `killAll()` bez `s.isAnim=false` | Blokuje animacje cyfr na zawsze |

---

## 8. BŁĘDY KTÓRE POPEŁNILIŚMY — ŻEBYŚ NIE MUSIAŁ

### Komentarz JS zakomentował klamrę zamykającą

```javascript
// PRZED (błąd):
if(!clockIntervalId){ clockIntervalId=setInterval(_clockTick,1000); // O11: 1s interval timerIds.push({...}); }
//                                                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                                                    to jest zakomentowane — brakuje klamry!

// PO (poprawnie):
if(!clockIntervalId){ clockIntervalId=setInterval(_clockTick,1000); timerIds.push({...}); } // O11: 1s interval
```

Efekt: `SyntaxError: Unexpected end of input` dopiero na EOF — godziny debugowania bo błąd był daleko od przyczyny.

**Zasada:** komentarze inline `// comment` ZAWSZE na końcu linii, NIGDY w środku bloku `{ code // comment more code }`.

### Unicode w komentarzu JS

```javascript
// ZAKAZ:
'  float nh20 = nh8*nh8*nh4;', // O3: pow→MUL   ← znak → (U+2192) w kodzie JS
// DOZWOLONE:
'  float nh20 = nh8*nh8*nh4;', // O3: pow->MUL
```

Niektóre środowiska (starsze node, niektóre bundlery) nie akceptują niestandardowych znaków unicode w JS poza stringami i komentarzami. `SyntaxError: Invalid or unexpected token`.

### 12 optymalizacji naraz

Wdrożyliśmy 12 optymalizacji jednocześnie. Kilka wchodziło w interakcje:
- O4 (mobile transmission) zepsuła shader cache
- O11 (komentarz inline) ukrył klamrę
- 30fps bez dt-compensated lerp = slow motion

**Zasada:** jedna optymalizacja = jeden commit. Testuj przed następną.

### position:fixed na canvasie

Pierwszy pomysł: `position:fixed` na `#final-scene`. Gwarantowany jitter. Wycofane po dniu walki.

### IO observer z zbyt małym rootMargin na hocie

Próbowaliśmy split na prewarm (3×VH) + hot (0.5×VH). Hot z `rootMargin:0.5×VH` nie kompensował `margin-top:-100vh` sekcji. Ticker nigdy nie startował. Wycofane.

### animation-timeline z transform:scaleY na cieniu

Używaliśmy `animation-timeline: view()` z `transform:scaleY` na cieniu między sekcjami. `scaleY` tworzy nowy compositor layer → walka z GPU command buffer WebGL. Na szybkim komputerze (który próbuje 60fps) bolało bardziej niż na wolnym.

Rozwiązanie: `animation-timeline: view()` tylko z `opacity` (bez transform). Compositor-only, brak nowego layera.

---

## 9. PARAMETRY KTÓRE MOŻESZ TUNINGOWAĆ

```javascript
var CC = { posX:-1.10, posY:0.58, posZ:2.20, scale:0.20, ... };
// posY: niżej = mniejsza wartość. posX: bardziej w lewo = bardziej ujemne.
// scale: wielkość zegara

var GW=4.7, GH=0.9, GR=2.0;
// GW: szerokość badge'a szklanego
// GH: wysokość badge'a
// GR: promień zaokrąglenia rogów

var P = {
  lightInt:6.5,    // intensywność światła punktowego
  lerp:0.065,      // szybkość podążania efektu za kursorem (wyżej = szybciej)
  bulgeH:0.65,     // maksymalna wysokość wypukłości
  ...
};
```

Zmieniaj tylko te wartości. Nic innego.

---

## 10. DEPENDENCY MATRIX

```
Three.js:  0.160.0  ← version lock, onBeforeCompile sensitive
GSAP:      3.12.7   ← brak pluginów, tylko core
```

Przed aktualizacją Three.js: sprawdź `glassMat.onBeforeCompile` — rim gradient musi być widoczny po aktualizacji.

Przed aktualizacją GSAP: sprawdź `_gsapTrack` → `t.isActive()` API (może się zmienić).
