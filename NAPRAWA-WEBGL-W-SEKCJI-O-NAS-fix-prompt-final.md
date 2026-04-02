# PROMPT: Chirurgiczna naprawa 3 wad w OnasEngine.tsx — badge 3D (złoty medal)

## DIAGNOZA (potwierdzona przez 3 niezależne audyty kodu)

Plik `OnasEngine.tsx` zawiera funkcję `onasCapitanInit(container)` — silnik badge 3D (złoty medal Three.js). Problem: skokowa, nieciągła rotacja modelu przy scrollu i przy ruchu myszy. Model gwałtownie przelicza pozycję zamiast płynnie interpolować.

Trzy przyczyny zostały jednoznacznie potwierdzone w kodzie:

1. **ROOT CAUSE (scroll):** ScrollTrigger używa jako trigger element `badge` (#onas-capitan-badgeWrapper), który sam jest ciągle przesuwany/skalowany przez `updateBadgeDrift()` na scroll. Trigger poruszający się podczas scrollu → brudny `self.progress` → niestabilne `J.p`.

2. **AMPLIFIER (scroll):** `vk = (J.p - J.prev) * 2.5` jest dodawane SUROWO do `logoGroup.rotation.y`. Wszystkie inne składowe rotacji przechodzą przez lerpy, ale `vk` nie — wzmacnia każdą niestabilność J.p do widocznego skoku ±17°.

3. **ROOT CAUSE (mysz):** `rectCache` (bounding rect badge wrappera) jest odświeżany tylko przy `pointerenter` i `ResizeObserver`, ale NIE przy scrollu ani drift transform. Badge przesuwa się podczas scrollu, normalizacja myszy liczy się ze starego recta → błędny kąt rotacji.

---

## ZASADA: MUSI DZIAŁAĆ STABILNIE

Modyfikujesz WYŁĄCZNIE trzy precyzyjne miejsca opisane poniżej. Nie zmieniasz niczego innego. Nie refaktoryzujesz. Nie optymalizujesz. Nie dodajesz nowych feature'ów. Trzy chirurgiczne cięcia.

---

## FIX A — Zmiana triggera ScrollTrigger na stabilny element

### Co i dlaczego

`ScrollTrigger.create()` oblicza `self.progress` na podstawie `getBoundingClientRect()` triggera. Trigger `badge` zmienia swój rect co klatkę przez `updateBadgeDrift()` (translate, rotate, scale) — więc progress oscyluje. Zamiana na `container` (#onas-capitan) eliminuje problem, bo ten element ma stabilny rect (position: relative, żaden JS nie zmienia jego transform).

### Gdzie w kodzie

Wewnątrz `onasCapitanInit(container)`. Parametr `container` to element `#onas-capitan` — przekazywany z `factoryInit()` jako `container.querySelector('#onas-capitan')`.

### Zmiana

Znajdź ten blok (okolice linii 1783):

```js
  const badgeST = ScrollTrigger.create({
    trigger: badge,               // #onas-capitan-badgeWrapper (position:absolute — OK)
    start: 'bottom 65%',           // badge bottom at 65% from top → progress 0
    end: 'top 1%',                 // badge top reaches 1% from viewport top → progress 1
```

Zmień na:

```js
  const badgeST = ScrollTrigger.create({
    trigger: container,           // FIX A: #onas-capitan — stabilny rect, bez JS-driven transform
    start: 'bottom 65%',           // TODO: po wdrożeniu skalibrować wizualnie timing animacji
    end: 'top 1%',                 // TODO: po wdrożeniu skalibrować wizualnie timing animacji
```

**JEDYNA zmiana w tym bloku: słowo `badge` → `container`.** Komentarz zmieniony. Reszta (scrub, invalidateOnRefresh, onUpdate, onToggle) — BEZ ZMIAN.

### Uwaga kalibracyjna

`container` (#onas-capitan) jest większy niż `badge` i zaczyna się wyżej w DOM. Wartości `start: 'bottom 65%'` i `end: 'top 1%'` mogą wymagać dostrojenia po wdrożeniu, żeby animacja ringu (inner ring 360° spin) startowała i kończyła się w tym samym wizualnym momencie co przed fixem. Nie zmieniaj ich spekulatywnie — wdróż z obecnymi wartościami i oceń wizualnie.

---

## FIX B — Wygładzenie vk przez lerp

### Co i dlaczego

`vk` jest jedynym komponentem w 5-warstwowym systemie rotacji, który nie przechodzi przez żaden filtr. Przy szybkim scrollu `(J.p - J.prev)` daje deltę do 0.16, co po `* 2.5` = 0.4 rad ≈ 23°. Dodanie lerpa 0.18 tłumi spiki do ±3° per frame, zachowując responsywność scroll-driven wiggle.

### Gdzie w kodzie

Dwa miejsca wewnątrz `onasCapitanInit(container)`:

**Miejsce 1 — deklaracja zmiennej.** Znajdź ten blok (okolice linii 2087):

```js
  const SP = 0.12;

  tickFn = function capitanTick(time) {
```

Dodaj jedną linię MIĘDZY nimi:

```js
  const SP = 0.12;
  let _smoothVk = 0;

  tickFn = function capitanTick(time) {
```

**Miejsce 2 — zerowanie przy wake.** Znajdź (okolice linii 2096):

```js
    if (_wakeSkip) {
      _wakeSkip = false;
      J.prev = J.p;
    }
```

Zmień na:

```js
    if (_wakeSkip) {
      _wakeSkip = false;
      J.prev = J.p;
      _smoothVk = 0;
    }
```

**Miejsce 3 — obliczenie vk.** Znajdź (okolice linii 2144-2145):

```js
        // Scroll velocity kick (SCROLL delta only — NOT hover-influenced p)
        const vk = (J.p - J.prev) * 2.5;
```

Zmień na:

```js
        // Scroll velocity kick — smoothed (FIX B: lerp tłumi spiki ±17° → ±3°)
        _smoothVk += ((J.p - J.prev) * 2.5 - _smoothVk) * 0.18;
        const vk = _smoothVk;
```

**NIE ZMIENIAJ linii gdzie vk jest używany** (`logoGroup.rotation.y = orgRy + sRy * (1 - inf) + shY + vk;`). Ta linia zostaje dokładnie jak jest.

---

## FIX C — Odświeżanie rectCache w onPointerMove

### Co i dlaczego

`rectCache` trzyma snapshot `getBoundingClientRect()` badge wrappera z momentu `pointerenter`. Ale badge drift zmienia transform badge co klatkę scrolla (translate, scale, rotate). Normalizacja `mouse.x`/`mouse.y` liczy się ze starego recta → błąd pozycji → błędny kąt rotacji modelu.

Fix: odśwież rect w rAF callbacku `onPointerMove`, tuż przed normalizacją. `getBoundingClientRect()` w rAF jest tanie — przeglądarka już przeliczyła layout.

### Gdzie w kodzie

Wewnątrz `onasCapitanInit(container)`. Znajdź (okolice linii 1438-1448):

```js
  function onPointerMove(e) {
    lastClientX = e.clientX; lastClientY = e.clientY;
    if (!mouse.near) mouse.near = true;
    if (pmRaf) return;
    pmRaf = requestAnimationFrame(() => {
      pmRaf = 0;
      if (rectCache.width <= 0 || rectCache.height <= 0) return;
      mouse.x = ((lastClientX - rectCache.left) / rectCache.width) * 2 - 1;
      mouse.y = ((lastClientY - rectCache.top) / rectCache.height) * 2 - 1;
    });
  }
```

Zmień na:

```js
  function onPointerMove(e) {
    lastClientX = e.clientX; lastClientY = e.clientY;
    if (!mouse.near) mouse.near = true;
    if (pmRaf) return;
    pmRaf = requestAnimationFrame(() => {
      pmRaf = 0;
      rectCache = threeContainer.getBoundingClientRect(); // FIX C: fresh rect before normalization
      if (rectCache.width <= 0 || rectCache.height <= 0) return;
      mouse.x = ((lastClientX - rectCache.left) / rectCache.width) * 2 - 1;
      mouse.y = ((lastClientY - rectCache.top) / rectCache.height) * 2 - 1;
    });
  }
```

**JEDYNA zmiana: dodana jedna linia** `rectCache = threeContainer.getBoundingClientRect();` jako pierwsza instrukcja w rAF callbacku (po `pmRaf = 0;`, przed guardem `if (rectCache.width...)`).

---

## CZEGO NIE ZMIENIAĆ

| Element | Powód |
|---------|-------|
| Karuzela (`onasCarouselInit`) | Inny silnik. "Double autoplay" (L576+L589) to celowy wzorzec, nie bug. |
| `_wakeSkip` mechanizm | Działa poprawnie. Jedyna zmiana to dodanie `_smoothVk = 0` (FIX B). |
| Lerpy `SP = 0.12` (L2130-2138) | Brak kompensacji dt to quality issue, nie root cause. Fix na później. |
| `logoGroup.rotation.y = orgRy + sRy * (1 - inf) + shY + vk` | Linia aplikacji — zostaje jak jest. |
| Linia `J.prev = J.p` w `onUpdate` | Mechanizm śledzenia delty — poprawny. |
| JSX (return w komponencie) | Zero zmian w strukturze DOM. |
| CSS (`onas-section.css`) | Zero zmian. |
| `OnasSection.tsx` | Zero zmian. |
| Reveal badge (badgeRevealIO) | Nie ruszać. |
| `updateBadgeDrift()` / `smoothLoop()` | Drift badge jest poprawny wizualnie — problem był w tym, że ST czytał z tego samego elementu. |
| Kamera Three.js | Immutable. Aspect = 1, brak updateProjectionMatrix — poprawne. |

---

## WERYFIKACJA

### Po wdrożeniu FIX A + B — test scroll:
1. Otwórz stronę z pełnym layoutem (nie izolowany komponent)
2. Scroll szybko w dół przez sekcję #onas-capitan (flick gesture)
3. ✅ Medal 3D reaguje płynnym, tłumionym ruchem — brak "ciachania"
4. Scroll szybko w górę-dół naprzemiennie
5. ✅ Medal oscyluje łagodnie bez nagłych skoków >5°
6. ✅ Animacja ringu (inner ring 360° spin) nadal jest widoczna i powiązana ze scrollem

### Po wdrożeniu FIX C — test mysz:
1. Najedź myszą na badge (złoty medal)
2. Trzymając mysz nad badge, scroll wolno w dół
3. ✅ Medal płynnie podąża za myszą bez nagłego zwrotu kąta
4. Przesuń mysz z lewej na prawą nad badge podczas scrollu
5. ✅ Rotacja Y reaguje proporcjonalnie do pozycji myszy, bez skoków

### Kalibracja FIX A (jeśli potrzebna):
1. Scroll od góry strony do sekcji capitan
2. Obserwuj moment startu animacji ringu (wewnętrzny ring zaczyna spin)
3. Jeśli animacja startuje za wcześnie: zmień `start` na niższy % (np. `'bottom 50%'`)
4. Jeśli animacja startuje za późno: zmień `start` na wyższy % (np. `'bottom 80%'`)
5. Analogicznie dla `end` — kontroluje moment zakończenia animacji

---

## PODSUMOWANIE ZMIAN

| Fix | Linie | Operacja | Ryzyko |
|-----|-------|----------|--------|
| A | ~1784 | `trigger: badge` → `trigger: container` | Niskie + kalibracja start/end |
| B | ~2088, ~2098, ~2144-2145 | Nowa zmienna `_smoothVk`, zerowanie przy wake, lerp 0.18 | Niskie |
| C | ~1443 | Dodanie `rectCache = threeContainer.getBoundingClientRect()` | Niskie |

Łącznie: zmiana 1 słowa + dodanie 4 linii kodu + zmiana 1 linii na 2 linie. Zero zmian strukturalnych.
