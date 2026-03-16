# Wytyczne ScrollTrigger — Fabryka sekcji

Dokument dla zespołu tworzącego nowe sekcje z animacjami scroll (GSAP ScrollTrigger). Zgodność z **C6.3** w `CONSTITUTION_v2_5_patched.md`.

---

## Podział w sekcji „fakty” (na przyszłość)

- **Animacja liter (3D transform)** — napis „FAKTY” / „SĄ TAKIE”: **tylko** ScrollTriggery **st1, st2, st3** (rotationX, opacity, scaleY na `.char` / `.word`). To one decydują, kiedy użytkownik widzi animację liter.
- **Tło** — tunel z procentami, organic overlay, scrub klatek wideo na literach: **tunnelST, orgST, frameST**. Zmiany w start/end tych triggerów nie naprawiają problemu „animacja liter jest zła” — do tego służą wyłącznie st1, st2, st3.

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

- [ ] Jako `trigger` używany jest **root sekcji** (`container`), nie wewnętrzny blok.
- [ ] **IntersectionObserver** na `container`: przy pierwszym wejściu w viewport → `requestRefresh('section-in-view')` + `disconnect()`; observer w `observers`.
- [ ] **Layout-settle:** `setTimeout(..., 1000)` z `requestRefresh('layout-settle')`, timer w `timerIds`, cleanup w `kill()`.
- [ ] W PREVIEW: ten sam IO section-in-view + layout-settle; spacery nad/pod sekcją rozróżnione (above/below).

---

## 6. Referencja

- Konstytucja: **C6**, **C6.1**, **C6.3** (`CONSTITUTION_v2_5_patched.md`).
- Przykład implementacji: `src/sections/fakty/FaktyEngine.tsx` (IO section-in-view + layout-settle timer).
- Opis mechaniki scroll animacji: `src/sections/fakty/fakty.PREVIEW_NOTES.md` (sekcja „Jak zbudowany jest scroll animacji”).
