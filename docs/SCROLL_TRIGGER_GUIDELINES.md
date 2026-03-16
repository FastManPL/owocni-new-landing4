# Wytyczne ScrollTrigger — Fabryka sekcji

Dokument dla zespołu tworzącego nowe sekcje z animacjami scroll (GSAP ScrollTrigger). Zgodność z **C6.3** w `CONSTITUTION_v2_5_patched.md`.

---

## 1. Dlaczego „animacja startuje za wcześnie”?

ScrollTrigger mapuje **progress 0→1** na przedział scrolla `[start, end]`. Wartości `start` i `end` są liczone w momencie **`ScrollTrigger.refresh()`** (wywoływanego przez `scrollRuntime.requestRefresh()`).

- Jeśli refresh odpala się **zanim** layout strony się ustabilizuje (fonty, obrazy nad sekcją, długi spacer), pozycja triggera w dokumencie może być błędna.
- Efekt: zapisany „start” jest za mały → animacja ma progress > 0 już na początku scrolla → użytkownik widzi, że „animacja działa w tle, zanim sekcja wejdzie na ekran”.

---

## 2. Wymaganie: layout-settle refresh (C6.3)

**Każda sekcja, która tworzy ScrollTriggery** (z `trigger` / `start` / `end`), musi **po zbudowaniu wszystkich ST** zaplanować **jeden opóźniony** `requestRefresh` z reason `'layout-settle'`.

- **Opóźnienie:** 300–500 ms (rekomendacja: **400 ms**) od momentu utworzenia ostatniego ScrollTriggera / zakończenia `fonts.ready` (jeśli sekcja czeka na fonty).
- **Sposób:** `setTimeout(() => { scrollRuntime.requestRefresh('layout-settle'); }, 400)`.
- **Cleanup:** Identyfikator timera zapisany w `timerIds` i czyszczony w `kill()` (tak jak inne timeouty w sekcji).

Przykład (wzorzec z sekcji fakty):

```ts
// Po fonts.ready / po utworzeniu ostatniego ST (buildTunnel, buildFrameScroll, itd.):
layoutSettleTimerId = setTimeout(() => {
  if (isKilled || !container.isConnected) return;
  scrollRuntime.requestRefresh('layout-settle');
}, 400);
timerIds.push({ type: 'timeout', id: () => layoutSettleTimerId });
```

W `kill()`: istniejący mechanizm czyszczenia `timerIds` (clearTimeout) wystarczy — nie trzeba osobno zerować `layoutSettleTimerId`.

---

## 3. Kiedy NIE dodawać layout-settle?

- Sekcja **bez** ScrollTrigger (np. statyczny FAQ, CTA) — nie dotyczy.
- Sekcja, która **tylko** nasłuchuje scrollu przez Lenis/scrollRuntime, ale **nie** tworzy `ScrollTrigger.create()` ani `scrollTrigger: { ... }` w gsap — nie dotyczy.

---

## 4. Preview HTML (standalone)

W pliku PREVIEW sekcji (np. `fakty.PREVIEW.html`):

- **Spacer nad sekcją** („scroll przed sekcją”) i **spacer pod sekcją** powinny być **rozróżnialne** (np. klasy `.preview-spacer-above` i `.preview-spacer-below`), żeby przy testach z długim spacerem nad sekcją (np. 200vh) było jasne, że to **górny** spacer decyduje o tym, kiedy sekcja „wchodzi” na ekran.
- W init preview (odpowiednik `init(container)`) **ten sam** opóźniony refresh: po zbudowaniu ST, `setTimeout(..., 400)` wywołujący `scrollRuntime.requestRefresh('layout-settle')` (w preview stub to i tak robi `ScrollTrigger.refresh(true)`).
- Komentarz w CSS/HTML: po zmianie wysokości spacerów (szczególnie nad sekcją) refresh po załadowaniu i tak odpali się z opóźnieniem; przy dynamicznej zmianie spacerów w dev trzeba ręcznie wywołać `ScrollTrigger.refresh(true)` po ustabilizowaniu layoutu.

---

## 5. Checklist dla nowej sekcji z ScrollTrigger

- [ ] Po utworzeniu wszystkich ScrollTriggerów jest wywołanie `scrollRuntime.requestRefresh('layout-settle')` w `setTimeout(..., 300–500 ms)`.
- [ ] Identyfikator timera jest w `timerIds` i jest czyszczony w `kill()`.
- [ ] W PREVIEW: ten sam opóźniony refresh; spacery nad/pod sekcją rozróżnione (np. above/below).
- [ ] W manifeście: w `refreshSignals` lub w opisie jest wzmianka o `layout-settle` (dla audytu).

---

## 6. Referencja

- Konstytucja: **C6**, **C6.1**, **C6.3** (`CONSTITUTION_v2_5_patched.md`).
- Przykład implementacji: `src/sections/fakty/FaktyEngine.tsx` (layout-settle timer po `fonts-ready-settle`).
- Opis mechaniki scroll animacji: `src/sections/fakty/fakty.PREVIEW_NOTES.md` (sekcja „Jak zbudowany jest scroll animacji”).
