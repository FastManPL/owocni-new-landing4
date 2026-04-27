# PROMPT 9 — twarde pomiary (bez zgadywania)

Data pomiaru: 2026-04-27  
Środowisko: local dev `next dev --webpack`, Chromium headless przez Playwright + CDP trace.  
Skrypt pomiarowy: `scripts/prompt9-measure.mjs`  
Artefakty: `artifacts/prompt9/lazy-wistia.json`, `artifacts/prompt9/eager-wistia.json`, `artifacts/prompt9/summary*.json`

> Uwaga metodyczna: pomiar jest laboratoryjny (headless dev build), więc wartości absolutne nie są równoważne produkcyjnemu RUM. Wszystkie wnioski poniżej oparte wyłącznie o zebrane liczby.

---

## 1) Hydration cost per client component

### Co udało się zmierzyć twardo
CDP trace zwrócił czas `EvaluateScript` per URL chunk (proxy kosztu JS przypisanego do komponentów klienckich/chunków).

Top (scenariusz lazy Wistia):
- `_app-pages-browser_node_modules_three_examples_jsm_utils_BufferGeometryUtils_js.js` — **3192.456 ms**
- `main-app.js` — **267.913 ms** i **256.119 ms** (dwa żądania z cache-bust)
- `_app-pages-browser_src_sections_footer_FinalEngine_tsx.js` — **60.844 ms**
- `lottie-web.js` — **36.491 ms**
- `_app-pages-browser_src_sections_ONas-Sekcja_OnasEngine_tsx.js` — **7.765 ms**
- `_app-pages-browser_src_sections_block-45_Blok45Engine_tsx.js` — **4.978 ms**

### Ograniczenie (też twarde)
W trace **brak markerów React per komponent hydracji** (są tylko `Next.* [Prerender]`).
Nie da się z tych danych wyliczyć „hydration ms dla `WynikiSection` vs `CaseStudy2Section`” 1:1, tylko koszt wykonania chunków JS.

### Czy nadal blokuje main thread?
Tak, największy wkład daje ciężki chunk Three/BufferGeometryUtils (pojedynczy task rzędu sekund w dev trace).

---

## 2) Script parse vs compile vs execution

Scenariusz lazy Wistia (ostatni pełny przebieg):
- parse: **7437.431 ms**
- compile: **497.201 ms**
- execution: **7858.449 ms**

Scenariusz eager Wistia (ostatni pełny przebieg):
- parse: **5220.890 ms**
- compile: **473.645 ms**
- execution: **6930.393 ms**

Porównanie eager-lazy (3 dodatkowe przebiegi, mediana delty):
- parse: **-1056.953 ms**
- compile: **+66.173 ms**
- execution: **+1201.516 ms**

Wariancja między runami jest wysoka (dev/hot chunks), więc kierunek delty parse/exec nie jest stabilny we wszystkich przebiegach.

### Czy nadal blokuje main thread?
Tak. Najdłuższe pojedyncze `EvaluateScript` w top tasks to nadal tysiące ms (dev trace).

---

## 3) INP per interaction

W headless nie ma wiarygodnych `PerformanceEventTiming`/INP dla syntetycznych klików.  
Zmierzone twardo: `EventDispatch` (kliknięcia) jako segment main-thread interakcji.

Lazy Wistia:
- click max: **11.024 ms** (2 kliknięcia: 11.024 ms, 4.985 ms)

Eager Wistia:
- click max: **11.985 ms** (2 kliknięcia: 11.985 ms, 10.038 ms)

Mediana delty eager-lazy (3 runy): **-0.121 ms** (praktycznie brak stabilnej różnicy).

### Czy nadal blokuje main thread?
Nie wygląda na blocker w samym dispatch click (wartości ~5-12 ms).  
Uwaga: to nie jest pełny INP (brakuje „presentation delay” do następnego paintu).

---

## 4) Image decode time

Lazy Wistia:
- łączny decode: **442.609 ms**
- top pojedyncze decode: **8.254 ms**, **7.928 ms**, **7.575 ms**

Eager Wistia:
- łączny decode: **414.697 ms**
- top pojedyncze decode: **15.716 ms**, **15.174 ms**, **12.152 ms**

Mediana delty eager-lazy (3 runy): **+121.082 ms** (eager zwykle wyżej), ale ostatni run dał wartość niższą — wysoka wariancja.

### Czy nadal blokuje main thread?
Częściowo, ale pojedyncze decode są krótkie (najczęściej <16 ms). Nie wygląda na główny blocker względem ciężkich tasków JS.

---

## 5) Detached DOM nodes / heap growth

Heap (CDP `Runtime.getHeapUsage`):
- lazy: start **531,440 B** → mid **62,955,036 B** → end **85,518,640 B**
- eager: start **531,440 B** → mid **73,728,112 B** → end **89,861,908 B**

Różnica wzrostu mid (eager-lazy):
- ostatni run: **+10,773,076 B**
- mediana 3 runów: **+10,467,364 B**

`DetachedScriptStates` (Performance metrics):
- lazy: **4**
- eager: **4**
- delta: **0**

### Czy nadal blokuje main thread?
Heap growth sam w sobie nie blokuje natychmiast, ale zwiększa presję GC. Na tym etapie brak sygnału, że detached script states rosną przez eager/lazy.

---

## 6) Wistia eager vs lazy init

Scenariusze pomiarowe:
- lazy: obecny kod (Wistia tylko po interakcji)
- eager: sztuczny preload `player.js` + `embed/*.js` natychmiast po wejściu

Twarde liczby (mediany z 3 runów):
- click dispatch: różnica praktycznie zerowa (**-0.121 ms**)
- heap growth mid: eager wyżej o ok. **10.47 MB**
- image decode: eager zwykle wyżej o ok. **121.08 ms**
- parse/exec delty: niestabilne między runami (duża wariancja dev)

### Czy nadal blokuje main thread?
Nie ma stabilnego dowodu, że eager poprawia interakcję; jest twardy sygnał wyższego użycia pamięci w eager.

---

## 7) bfcache eligibility

`Page.backForwardCacheNotUsed`:
- lazy: `BrowsingInstanceNotSwapped`
- eager: `BrowsingInstanceNotSwapped`

Status: **nieprzywracane z bfcache** w obu scenariuszach (w tym harnessie).

### Czy nadal blokuje main thread?
To nie jest bezpośredni blocker main thread podczas aktywnej sesji, ale wpływa na szybkość powrotu (back/forward UX).

---

## Wnioski operacyjne (wyłącznie z pomiaru)

1. Największy twardy koszt CPU JS w trace pochodzi z chunków Three/BufferGeometryUtils, nie z samego dispatch click.
2. Eager Wistia nie daje stabilnej poprawy interakcji w tym pomiarze, a podnosi użycie heap w połowie scenariusza.
3. Nie ma twardego sygnału regresji detached script states między lazy/eager.
4. bfcache pozostaje niekwalifikowane (powód: `BrowsingInstanceNotSwapped`) niezależnie od Wistii.
5. „Hydration per client component” w rozumieniu React component-level nie jest dostępne z obecnych markerów; mamy twarde dane per chunk URL.


---

## PROMPT 9.1 — prod-grade (next build + next start, port 3001)

Źródło: `BASE_URL=http://localhost:3001 node scripts/prompt9-measure.mjs`.

### Twarde liczby (prod run)

- Script parse (lazy vs eager): **481.884 ms** vs **383.156 ms** (delta eager-lazy **-98.728 ms**)
- Script compile: **301.970 ms** vs **294.471 ms** (delta **-7.499 ms**)
- Script execution: **3222.004 ms** vs **2931.212 ms** (delta **-290.792 ms**)
- Max `click` EventDispatch: **6.234 ms** vs **8.408 ms** (delta **+2.174 ms** na niekorzyść eager)
- Image decode total: **582.917 ms** vs **497.476 ms** (delta **-85.441 ms**)
- Heap growth mid-start: **32,351,668 B** vs **29,234,644 B** (delta **-3,117,024 B**, eager niżej w tym runie)
- DetachedScriptStates: **4** vs **4** (delta **0**)
- bfcache: w obu przypadkach `BrowsingInstanceNotSwapped` (nieprzywrócone)

### Wniosek (tylko z tego runu prod)

- Eager Wistia zmniejszył sumaryczny czas parse/compile/exec w tym konkretnym przebiegu prod, ale pogorszył koszt najcięższego kliknięcia (+2.174 ms).
- Brak stabilnego sygnału „zawsze lepiej” dla eager: część metryk lepsza, część gorsza.
- Main thread nadal obciążają długie taski JS (`FunctionCall` top: 2.0s lazy / 1.6s eager), więc blocker nie został usunięty.


---

## PROMPT 9.2 — prod-grade x3 (mediana)

Źródła:
- `artifacts/prompt9/prod-summary-run1.json`
- `artifacts/prompt9/prod-summary-run2.json`
- `artifacts/prompt9/prod-summary-run3.json`
- agregacja: `artifacts/prompt9/prod-summary-aggregate.json`

Mediana delt `eager - lazy`:
- script parse: **+1.021 ms**
- script compile: **+11.420 ms**
- script execution: **-832.202 ms**
- max click dispatch: **-0.653 ms**
- heap growth (mid-start): **+6,382,564 B**
- image decode total: **+21.920 ms**
- detached script states: **0**

Interpretacja (tylko z powyższych liczb):
- Eager zwykle obniża execution time, ale podnosi compile i zwykle podnosi heap growth.
- Wpływ na click dispatch jest mały (sub-ms do ~1-2 ms między runami).
- Brak sygnału różnicy w detached script states.
- Nadal brak jednoznacznego „eager wygrywa globalnie” — trade-off CPU execution vs pamięć/decode.

