# INSTALACJA KINETIC — Kompletny przewodnik
## Wszystkie decyzje, fixy, zagrożenia

---

## A. ARCHITEKTURA — co instalator MUSI wiedzieć

### Makro-Sekcja = FAKTY + KINETIC w jednym wrapperze

KINETIC **nie jest** samodzielną sekcją na stronie.
KINETIC jest **fazą wewnątrz wrappera** (bridge-wrapper).

```
bridge-wrapper (pin: true, scrub: true, id: 'KINETIC_PIN')
  ├── fakty-layer  → FAKTY (faza 1)
  └── kinetic-layer → KINETIC (faza 2+)
```

Wrapper posiada: pin, start, end, scroll range.
KINETIC posiada: wewnętrzną choreografię, snap machine, freeze.
KINETIC NIE posiada: własnego pinu, własnego start/end.

### Block 4 — POZA wrapperem

Block 4 scrolluje NAD zamrożoną ostatnią klatką KINETIC (curtain reveal).
Block 4 NIE jest częścią Makro-Sekcji.

---

## B. FIXY W KODZIE KINETIC — 5 zmian (pakiet, wdrażaj razem)

### Fix 1: _getSnapGeometry — fallback na zewnętrzny ScrollTrigger

**Linia ~3069.** Bez tego snapy są MARTWE (potwierdzony runtime).

```javascript
// BYŁO:
var st = pinnedTl.scrollTrigger;

// JEST:
var st = pinnedTl.scrollTrigger || _s._externalScrollTrigger;
```

**Dlaczego:** Po przeniesieniu pinu na wrapper, `pinnedTl.scrollTrigger`
jest undefined. Funkcja zwraca null → KAŻDY snap robi cichy return.

### Fix 2: _geoCache.stEnd — cache końca sekcji

**W tej samej funkcji, po linii `_geoCache.total = total;`:**

```javascript
_geoCache.stEnd = st.end;
```

**Dlaczego:** Potrzebne dla górnych granic (fix 4 i 5).

### Fix 3: Export _geoCache_invalidate

**Po definicji _getSnapGeometry, dodaj:**

```javascript
_s._geoCache_invalidate = function() { _geoCache._valid = false; };
```

**Dlaczego:** Wrapper musi invalidować cache przy resize/refresh.

### Fix 4: _handleIntent — górna granica

**Po linii `if (scroll < g.grabStart + _ARM_BUF) return;` dodaj:**

```javascript
if (scroll > g.stEnd + _ARM_BUF) return;
```

**Dlaczego:** Bez tego Observer (nasłuchuje na window!) łapie gesty
W DOWOLNYM MIEJSCU strony poniżej sekcji. User w Block 4 scrolluje
w górę → _handleIntent odpala → scrollTo(SNAP2) → user SZARPNIĘTY
Z POWROTEM do sekcji KINETIC. Potwierdzone analizą kodu.

### Fix 5: _reconcileFromScroll — górna granica + reset _sm

**Po linii `_sm.zone = 'kinetic';` dodaj:**

```javascript
if (scroll > g.stEnd + _DISARM_BUF) {
    _sm.zone = 'bridge';
    _sm.committedIndex = -1;
    _sm.pendingIndex = null;
    if (_sm.state !== 'snapping') _sm.state = 'idle';
    return;
}
```

**Dlaczego:** Bez tego _sm po opuszczeniu sekcji zostaje z
`committedIndex=2, zone='kinetic'` — zombie state który pozwala
na snap z dowolnego miejsca na stronie.

---

## C. FIX W KODZIE KINETIC — scrub protection (już wdrożony w v35+)

### Fix 0: Filtr scrubowanych timeline w pause/resume

**JUŻ W PLIKU v35+.** Nie usuwaj. Weryfikuj że jest:

```javascript
// W pause():
gsapInstances.forEach(tl => {
    if (!tl) return;
    if (tl.scrollTrigger && tl.scrollTrigger.vars
        && tl.scrollTrigger.vars.scrub !== undefined) return;
    if (tl.pause) tl.pause();
});

// W resume(): identyczny filtr.
```

**Dlaczego:** IntersectionObserver (_ioCallback) wywołuje resume()
na WSZYSTKICH gsapInstances w tym na pinnedTl (scrub:true).
tl.resume() na scrubowanej timeline zrywa scrub → timeline gra sama
→ sekcja powoli jedzie do końca niezależnie od scrolla.
ROOT CAUSE autodriftu. Potwierdzone runtime: `tl.paused(true)` 
natychmiast zatrzymuje drift.

---

## D. FIX W KODZIE KINETIC — lifecycle snap1 magnet

### Fix 6: Przenieś snap1 handler do pause/resume

**W pause(), po odłączeniu ticker functions:**

```javascript
scrollOff('scroll', _lenisSnap1Handler);
```

**W resume(), po podłączeniu ticker functions:**

```javascript
scrollOn('scroll', _lenisSnap1Handler);
```

**Usuń** `scrollOff('scroll', _lenisSnap1Handler)` z `cleanups[]`.

**Dlaczego:** Snap1 magnet nasłuchuje na Lenis scroll events.
Bez odłączenia w pause(), listener jest aktywny gdy sekcja offscreen
i może wywoływać scrollTo() z lock:true — blokując scroll.

---

## E. CO WRAPPER MUSI ZROBIĆ

### E1. Przekaż geometrię do KINETIC

```javascript
// PO utworzeniu master ScrollTrigger:
kineticRef._s._externalScrollTrigger = {
    get start() { return masterST.start + FAKTY_PHASE_PX; },
    get end()   { return masterST.end; }
};
```

Użyj getterów — start/end zmieniają się przy resize.
`FAKTY_PHASE_PX` = długość fazy FAKTY w pikselach scrolla.

Jeśli FAKTY nie ma fazy (cały range = KINETIC):
```javascript
kineticRef._s._externalScrollTrigger = masterST;
```

### E2. Invaliduj cache przy refresh

```javascript
// W onRefresh master ScrollTrigger:
kineticRef._s._geoCache_invalidate?.();
```

### E3. Lifecycle hooks

```javascript
// Gdy scroll wchodzi w fazę KINETIC:
kineticRef._s.activate();

// Gdy scroll opuszcza fazę KINETIC:
kineticRef._s.hibernate();

// FAKTY organic engine — pausuj osobno po przejściu.
```

### E4. Overshoot override

```javascript
// PRZED init KINETIC:
kineticRef._s._overshootOverride = 0;
```

Wrapper posiada własny bufor po fazie KINETIC.
KINETIC nie potrzebuje lokalnego overshoot.

---

## F. KOLEJNOŚĆ BOOT — KRYTYCZNA

### Lenis PIERWSZY, registerPlugin WEWNĄTRZ init()

```
1. CDN: gsap.min.js, ScrollTrigger.min.js, lenis.min.js
2. new Lenis({...})
3. lenis.on('scroll', ScrollTrigger.update)
4. gsap.ticker.add(lenis.raf)
5. window.lenis = lenis
   [... DOM ready ...]
6. init(container)  ← registerPlugin(ScrollTrigger) jest WEWNĄTRZ init()
```

**NIGDY** nie rób `gsap.registerPlugin(ScrollTrigger)` PRZED `new Lenis()`.
ST rejestruje własne wheel listenery jako master → Lenis przegrywa
walkę o wheel events → scroll kółkiem nie działa.

### Init na window.load, NIE DOMContentLoaded

```javascript
window.addEventListener('load', function() {
    init(container);
});
```

**Dlaczego:** Geometria ST liczona na podstawie layout.
Przed load fonty (Lexend) nie są załadowane → layout inny →
snap positions błędne → snap1 magnet odpala lock:true na złych
pozycjach → wheel scroll zablokowany.

---

## G. DECYZJE ARCHITEKTONICZNE

| Decyzja | Wartość | Powód |
|---|---|---|
| dynamicImport KINETIC | **NIE** | KINETIC jest wewnątrz wrappera, wrapper potrzebuje milestones synchronicznie |
| dynamicImport Makro-Sekcja | **TAK** | Cała Makro-Sekcja (FAKTY+KINETIC) jest poniżej foldu |
| isolation: isolate | **NIE** | mix-blend-mode na .nigdy-glow i canvas jest częścią choreografii, isolation zmieni wygląd, brak problemu do rozwiązania |
| _unlockTimer | **NIE ISTNIEJE** | Nigdy nie było w oryginale, nie dodawaj |
| getRawScroll w guardach | **NIE** | Oryginał używa getScroll() wszędzie, nie zmieniaj |

---

## H. FREEZE I BLOCK 4 — co wiedzieć

### Freeze na SNAP3 jest CELOWY

Po dojściu do SNAP3, `freezeFinal = true` → freeze clamp trzyma scroll
na pozycji SNAP3. Sekcja NIGDY nie "odpuszcza" sama.

W produkcji: wrapper trzyma pin → KINETIC zamrożony → Block 4
scrolluje NAD zamrożoną klatką (curtain reveal).

### Usuń z Block 4:

- `.kinetic-standin`
- `.kinetic-pin-spacer`
- fioletowe fake tło
- placeholder text shell

Tłem pod Block 4 musi być rzeczywista zamrożona klatka KINETIC.

---

## I. CZEGO NIE RUSZAĆ

- Choreografia wizualna (blob, particle, tunnel, cylinder, text blocks)
- Timeline structure (pinnedTl, child timelines)
- Snap machine logic (_handleIntent, _reconcileFromScroll, _lenisSnap1Handler)
- State machine v3 (_sm: zone, committedIndex, state)
- Freeze logic (FREEZE_ON, FREEZE_OFF, freezeFinal)
- Canvas engines (tickParticle, tickCylinder, tickTunnel, renderBlobCanvas)
- Observer (ScrollTrigger.observe na window)
- `gsapInstances.push(pinnedTl)` — pinnedTl MUSI być w gsapInstances (kill/cleanup potrzebuje), filtr w resume() chroni scrub
- Intro KINETIC (I, I_BASE, DELTA, b1Start) — wewnętrzny rytm, NIE usuwaj

---

## J. WERYFIKACJA PO INSTALACJI

### Test 1: Autodrift
Scrolluj do sekcji → puść ręce → sekcja STOI (zero auto-advance).
Jeśli jedzie sama → filtr scrub w resume() nie działa.

### Test 2: Snapy
Scrolluj do sekcji → gest → SNAP1 → gest → SNAP2 → gest → SNAP3.
Cofanie: SNAP3 → SNAP2 → SNAP1 → bridge.
Jeśli nie łapie → _externalScrollTrigger nie przekazany.

### Test 3: Brak snap z Block 4
Scrolluj do Block 4 → scrolluj w górę → NIC się nie dzieje z KINETIC.
Jeśli user jest szarpany z powrotem → górna granica w _handleIntent brakuje.

### Test 4: Freeze
Dojdź do SNAP3 → scroll dalej → Block 4 scrolluje NAD zamrożonym KINETIC.
Jeśli KINETIC "puszcza" → freeze clamp nie działa.

### Test 5: Wheel scroll
Scrolluj kółkiem myszy przez całą stronę → działa płynnie.
Jeśli nie → kolejność boot (registerPlugin przed Lenis).

### Test 6: Resize
Zmień rozmiar okna → snapy nadal trafiają → scroll nadal działa.
Jeśli nie → _geoCache_invalidate nie podłączony w onRefresh.

---

## K. PODSUMOWANIE ZMIAN W KINETIC

| # | Co | Gdzie | Typ |
|---|---|---|---|
| 0 | Filtr scrub w pause/resume | pause() + resume() | JUŻ WDROŻONE v35+ |
| 1 | Fallback _externalScrollTrigger | _getSnapGeometry linia 3069 | NOWE |
| 2 | Cache stEnd | _getSnapGeometry linia 3074 | NOWE |
| 3 | Export _geoCache_invalidate | po _getSnapGeometry | NOWE |
| 4 | Górna granica handleIntent | _handleIntent po dolnej granicy | NOWE |
| 5 | Górna granica reconcile | _reconcileFromScroll po zone='kinetic' | NOWE |
| 6 | Snap1 handler w lifecycle | pause() + resume() | NOWE |

6 punktowych zmian. Zero rewrite. Logika snap machine bez zmian.
