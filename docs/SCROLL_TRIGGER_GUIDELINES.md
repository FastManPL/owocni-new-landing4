# Wytyczne ScrollTrigger — Fabryka sekcji

Dokument dla zespołu tworzącego nowe sekcje z animacjami scroll (GSAP ScrollTrigger). Zgodność z **C6.3** w `CONSTITUTION_v2_5_patched.md`.

---

## Zasada nadrzędna: scroll w oparciu o pozycję sekcji, nie o całą stronę

Animacje scroll w sekcji muszą zależeć **wyłącznie od pozycji samej sekcji** względem viewportu. Nie od scrolla całej strony (np. „od 500px”), nie od innych sekcji ani od wysokości treści nad sekcją. Dzięki temu sekcja działa tak samo na górze strony, po 200vh spacerze lub w środku długiej LP.

### Jak to osiągnąć

1. **Trigger = root sekcji (`container`)**  
   W każdym `ScrollTrigger.create()` (i w `scrollTrigger` w gsap.to) ustaw **`trigger: container`** (element `<section>` przekazany do `init(container)`). Nie używaj wewnętrznego diva ani innego elementu jako triggera dla zakresu „kiedy sekcja wchodzi / jest na ekranie”.

2. **Start i end w notacji „element viewport”**  
   Używaj wyłącznie notacji GSAP typu `"pozycja triggera pozycja viewportu"`, np.:
   - `start: 'top bottom'` — start, gdy **góra sekcji** jest przy **dole viewportu** (sekcja dopiero wchodzi).
   - `start: 'top bottom-=25%'` — start, gdy góra sekcji jest 25% viewportu nad dołem ekranu (animacja startuje, gdy ~25% viewportu to już sekcja).
   - `end: 'bottom top'` — koniec, gdy **dół sekcji** jest przy **górze viewportu** (sekcja w całości przewinięta).
   - `end: 'bottom top+=20%'` — koniec wcześniej w scrollu (dół sekcji 20% poniżej góry viewportu).

   Nie używaj stałych w pikselach ani scroll position w dokumentach (np. „od 800px”) — tylko pozycja **triggera** (sekcji) względem **viewportu**.

3. **Refresh gdy sekcja wchodzi w viewport**  
   Dodaj **IntersectionObserver** na `container`: przy pierwszym wejściu sekcji w viewport wywołaj `scrollRuntime.requestRefresh('section-in-view')` i odłącz observer. Dzięki temu ScrollTrigger przelicza start/end w momencie, gdy pozycja sekcji w dokumencie jest już ustalona — niezależnie od tego, ile treści jest nad sekcją (spacer 0vh, 40vh, 200vh).

4. **Layout-settle jako zapas**  
   Po zbudowaniu wszystkich ScrollTriggerów zaplanuj opóźniony `requestRefresh('layout-settle')` (np. 1000 ms), timer w `timerIds`, cleanup w `kill()`. To pomaga, gdy sekcja od razu jest w viewporcie (krótki spacer).

5. **W PREVIEW**  
   Te same zasady: trigger = container, start/end w notacji „element viewport”, ten sam IO section-in-view i layout-settle. Spacery nad/pod sekcją rozróżnialne (np. `.preview-spacer-above` / `.preview-spacer-below`), żeby testować przy różnej wysokości spaceru — animacja ma zachowywać się tak samo względem sekcji.

### Czego unikać

- **Trigger na elemencie wewnętrznym** (np. `.title-block`, `.hero-content`) dla zakresu wejścia sekcji na ekran — wtedy pozycja zależy od layoutu wewnątrz sekcji (fonty, obrazy) i od treści nad sekcją.
- **Stałe pozycje scrolla** (np. start przy 500px) — pozycja sekcji w dokumencie zależy od treści nad nią; stała wartość działa tylko przy jednym układzie strony.
- **Poleganie tylko na jednym refreshu** (np. tylko layout-settle po 1 s) — przy długiej treści nad sekcją pozycja sekcji ustala się późno; konieczny jest refresh przy wejściu sekcji w viewport (IO).

---

## Podział w sekcji „fakty” (na przyszłość)

- **Animacja liter (3D transform)** — napis „FAKTY” / „SĄ TAKIE”: **tylko** ScrollTriggery **st1, st2, st3** (rotationX, opacity, scaleY na `.char` / `.word`). To one decydują, kiedy użytkownik widzi animację liter.
- **Tło** — tunel z procentami, organic overlay, scrub klatek wideo na literach: **tunnelST, orgST, frameST**. Zmiany w start/end tych triggerów nie naprawiają problemu „animacja liter jest zła” — do tego służą wyłącznie st1, st2, st3.
- **Klatki wideo w tle napisu:** sekwencja klatek (np. fakty-01.webp … fakty-34.webp) musi być w **`public/frames/`**. W silniku sekcji ustaw **`FRAMES_BASE_PATH`** tak, żeby wskazywał na tę ścieżkę od roota strony, np. `'/frames/fakty-'` (w Next.js pliki z `public/frames/` są serwowane pod `/frames/`). Bez tego napis ma tylko solid fill; z poprawną ścieżką — wypełnienie wideo w literach.

---

## 0. Trigger = root sekcji (pozycja w dokumencie)

**Start/end animacji muszą zależeć od pozycji sekcji w dokumencie**, nie od wewnętrznego bloku (np. tytułu czy wrappera). Używaj jako `trigger` **roota sekcji** (elementu `<section>` przekazanego do `init(container)`), czyli `container`:

- `trigger: container` — ScrollTrigger liczy start/end od pozycji całej sekcji w stronie, a nie od layoutu wewnątrz sekcji (fonty, canvas).
- Unikaj `trigger: elementWewnętrzny` (np. `#fakty-block`, `.title-row`) dla zakresu „kiedy sekcja wchodzi na ekran”.
- **Start animacji = względem sekcji:** `start: 'top bottom'` = gdy góra sekcji przy dolnym brzegu viewportu (sekcja dopiero wchodzi). Żeby animacja startowała **później**, gdy większa część sekcji jest już widoczna, użyj offsetu: `start: 'top bottom-=35%'` (35% wysokości viewportu „w górę” od dołu = animacja startuje, gdy ~35% viewportu pokazuje już sekcję). Wartość procentowa zależy od projektu (np. 25–40%). Moment startu pozostaje zdefiniowany względem sekcji (trigger = container), więc nie zależy od treści nad sekcją.

Wyjątek: jeśli celowo animujesz tylko wtedy, gdy konkretny wewnętrzny element jest w danym miejscu viewportu, możesz zostawić trigger na tym elemencie.

---

## 1. Dlaczego przy długim spacerze „wszystko się psuje”?

ScrollTrigger liczy `start` i `end` w momencie **`ScrollTrigger.refresh()`**. Jeśli refresh odpala się **zanim** pozycja sekcji w dokumencie jest ostateczna (np. przy 300vh spacerze layout ustala się późno), trigger jest mierzony w złym miejscu → animacja „startuje za wcześnie” lub wygląda na zepsutą.

**Rozwiązanie: refresh gdy sekcja wchodzi w viewport.** Zamiast polegać tylko na stałym opóźnieniu (layout-settle), dodaj **IntersectionObserver** na root sekcji: przy **pierwszym** wejściu sekcji w viewport (lub tuż przed, np. `rootMargin: '100px 0px'`) wywołaj `scrollRuntime.requestRefresh('section-in-view')` i odłącz observer. W tym momencie pozycja sekcji w dokumencie jest już ustalona (użytkownik przewinął do sekcji), więc start/end będą poprawne **niezależnie od wysokości spacerów**.

---

## 2. Wymagania: section-in-view refresh + layout-settle (C6.3)

**2a) Section-in-view (obowiązkowe przy sekcjach z ST)**  
- **IntersectionObserver** na `container`: gdy sekcja **po raz pierwszy** wchodzi w viewport (np. `rootMargin: '100px 0px'`, `threshold: 0`), wywołaj `requestRefresh('section-in-view')` i `observer.disconnect()`.
- Observer dodany do `observers`, żeby `kill()` mógł go odłączyć.
- Dzięki temu przy dowolnej wysokości spaceru (40vh, 300vh) ST dostaje refresh w momencie, gdy pozycja sekcji jest już poprawna.

**2b) Layout-settle (fallback)**  
- **Opóźniony** `requestRefresh('layout-settle')` w `setTimeout(..., 1000)` po zbudowaniu ST (timer w `timerIds`, cleanup w `kill()`).
- Pomaga, gdy sekcja jest od razu w viewporcie (np. krótki spacer) i IO nie zdąży odpalić przed pierwszym scrollem.

---

## 3. Kiedy NIE dodawać layout-settle?

- Sekcja **bez** ScrollTrigger (np. statyczny FAQ, CTA) — nie dotyczy.
- Sekcja, która **tylko** nasłuchuje scrollu przez Lenis/scrollRuntime, ale **nie** tworzy `ScrollTrigger.create()` ani `scrollTrigger: { ... }` w gsap — nie dotyczy.

---

## 4. Preview HTML (standalone)

W pliku PREVIEW sekcji (np. `fakty.PREVIEW.html`):

- **Spacer nad sekcją** („scroll przed sekcją”) i **spacer pod sekcją** powinny być **rozróżnialne** (np. klasy `.preview-spacer-above` i `.preview-spacer-below`), żeby przy testach z długim spacerem nad sekcją (np. 200vh) było jasne, że to **górny** spacer decyduje o tym, kiedy sekcja „wchodzi” na ekran.
- W init preview: **ten sam** IntersectionObserver section-in-view oraz opóźniony `requestRefresh('layout-settle')` (stub wywołuje `ScrollTrigger.refresh(true)`).
- Komentarz w CSS/HTML: po zmianie wysokości spacerów (szczególnie nad sekcją) refresh po załadowaniu i tak odpali się z opóźnieniem; przy dynamicznej zmianie spacerów w dev trzeba ręcznie wywołać `ScrollTrigger.refresh(true)` po ustabilizowaniu layoutu.

---

## 5. Checklist dla nowej sekcji z ScrollTrigger

(Zgodnie z zasadą: scroll w oparciu o **pozycję sekcji**, nie o całą stronę.)

- [ ] **Trigger = root sekcji:** `trigger: container` we wszystkich ST (nie wewnętrzny blok).
- [ ] **Start/end w notacji „element viewport”:** tylko np. `'top bottom'`, `'top bottom-=25%'`, `'bottom top'`, `'bottom top+=20%'` — bez stałych px ani pozycji scrolla w dokumencie.
- [ ] **Section-in-view:** IntersectionObserver na `container` → przy pierwszym wejściu w viewport: `requestRefresh('section-in-view')` + `disconnect()`; observer w `observers`.
- [ ] **Layout-settle:** `setTimeout(..., 1000)` z `requestRefresh('layout-settle')`, timer w `timerIds`, cleanup w `kill()`.
- [ ] **PREVIEW:** ten sam trigger (container), te same start/end, IO section-in-view + layout-settle; spacery above/below rozróżnione.

---

## 6. Referencja

- Konstytucja: **C6**, **C6.1**, **C6.3** (`CONSTITUTION_v2_5_patched.md`).
- Przykład implementacji: `src/sections/fakty/FaktyEngine.tsx` (IO section-in-view + layout-settle timer).
- Opis mechaniki scroll animacji: `src/sections/fakty/fakty.PREVIEW_NOTES.md` (sekcja „Jak zbudowany jest scroll animacji”).
