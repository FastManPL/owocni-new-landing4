# PROMPT 8 — Third-party i embedy (odroczenie vs I7 / G7)

**Konstytucja LP v2.9:** **I7** (`next/script` + jawna strategia; ciężkie/marketingowe → `lazyOnload`; bez Partytown z GTM), **G7** (`dns-prefetch` dla marketing/embedów — nie `preconnect`).  
**Legenda:** `[x]` wdrożone · `[ ]` do zrobienia · ~~strikethrough~~ jeśli odrzucone świadomie.

**Źródło audytu:** PROMPT 8 (stan repo — sekcje własne zakładamy po promptach 1–7).

---

## Postęp — minimalny plan odroczenia

| # | Zadanie | Status | Pliki / miejsce |
|---|---------|--------|-----------------|
| **1** | Wistia: `strategy="lazyOnload"` zamiast `afterInteractive` dla `player.js` i `embed/*.js` | [x] | `src/sections/wyniki/WynikiSection.tsx`, `src/sections/case-study2/CaseStudy2Section.tsx`, `src/sections/wzrost-przychodow/WzrostPrzychodowSection.tsx` |
| **2** | Onas: ujednolicenie z I7 (opcjonalnie) — `next/script` + `lazyOnload` zamiast `loadScriptOnce`, **albo** świadome odstępstwo udokumentowane poniżej | [x] | `src/sections/ONas-Sekcja/OnasEngine.tsx` — mostek `__OWOCNI_ONAS_ARM_WISTIA` + fallback `loadScriptOnce` |
| **3** | Przyszły sGTM / Pixel / Hotjar: tylko `next/script` `lazyOnload` + w head **`dns-prefetch`** (G7), bez `preconnect` | [~] | Szablon I7/G7 w komentarzu `src/app/layout.tsx` → `[x]` po wdrożeniu realnych tagów + QA z checklisty |
| **4** | `dns-prefetch` `cdn.jsdelivr.net`: usunąć jeśli w prod **brak** requestów do jsdelivr | [x] | `src/providers/ResourceHints.tsx` — usunięty (Three z npm w `src`) |
| **5** | Facade lite-embed → pełny player Wistia: **tylko jeśli** po **1** nadal widać koszt INP przy kliku | [ ] | wg potrzeb UX/metryk |

---

## Co sprawdzać po każdym kroku

### Po kroku **1** (Wistia → `lazyOnload`)

- [ ] **DevTools → Network:** przy pierwszym wejściu na stronę **brak** requestów do `fast.wistia.com` **dopóki** nie otworzysz popupu / nie klikniesz play (Wzrost).
- [ ] Po kliknięciu demo/popup: pojawiają się `player.js` i `embed/…js`; start wideo działa (autoplay tam gdzie było).
- [ ] **Chrome Performance / Lighthouse (Field niezbędny):** przy pierwszym otwarciu wideo — INP nie jest wyraźnie gorszy niż przed zmianą (spodziewane: czasem ~kilka–kilkadziesiąt ms opóźnienia startu — akceptacja biznesowa).
- [ ] **Mobil:** iOS/Android — odtwarzanie po interakcji bez regresji.

### Po kroku **2** (Onas — jeśli robisz)

- [ ] Popup Wistii w sekcji O nas ładuje się i odtwarza jak wcześniej.
- [ ] Brak podwójnego ładowania `player.js` (jedna ścieżka init).

### Po kroku **3** (gdy włączycie analytics)

- [ ] W `<head>` **nie** ma `preconnect` do originów tagów — tylko `dns-prefetch` zgodnie z G7.
- [ ] Skrypty tag managera przez `next/script` z **`lazyOnload`**.
- [ ] Strona nadal spełnia oczekiwania legal/consent (CMP) — osobna checklista prawna.

### Po kroku **4** (jsdelivr prefetch)

- [ ] Build prod + DevTools Network na **całej** ścieżce LP: filtrowanie `jsdelivr` — zero hitów wtedy prefetch można śmiało usunąć.
- [ ] Po usunięciu: brak regresji (Three nadal z bundla).

### Po kroku **5** (facade — tylko jeśli)

- [ ] Lighthouse / CrUX lub RUM: INP na interakcjach „wideo” faktycznie niżej.
- [ ] UX: pierwszy frame / spinner — akceptowalny dla stakeholderów.

---

## Notatnik (krótki dziennik wdrożeń)

| Data | Co zrobiono | Kto sprawdził / uwagi |
|------|-------------|----------------------|
| 2026-04-24 | Krok **1**: Wistia `lazyOnload` w Wyniki / CaseStudy2 / Wzrost przychodów | QA: sekcja „Co sprawdzać” po kroku 1 |
| 2026-04-24 | Krok **2**: Onas — Wistia przez `next/script` `lazyOnload` + mostek z karuzeli | QA: sekcja „Po kroku 2” |
| 2026-04-24 | Krok **4**: usunięty `dns-prefetch` jsdelivr; rozszerzony komentarz I7/G7 w `layout` (pod krok 3) | QA: Network — brak regresji; krok 3 przy wdrożeniu tagów |

---

## Odstępstwo I7 — Onas (`loadScriptOnce`)

**2026-04-24:** Ścieżka domyślna używa **`next/script` + `lazyOnload`** (mostek `window.__OWOCNI_ONAS_ARM_WISTIA`). **`loadScriptOnce`** zostaje wyłącznie jako **fallback**, gdy pierwsze otwarcie popupu nastąpiłoby przed rejestracją mostka w `useEffect` (marginalny race).

Jeśli kiedyś usuniesz mostek i wrócisz tylko do `loadScriptOnce`, wpisz uzasadnienie:

- *„Onas ładuje Wistię dopiero po akcji użytkownika (popup); loadScriptOnce celowo omija next/script — ryzyko audytu I7 zaakceptowane do daty ___.”*

---

## Powiązane pliki (mapa)

| Obszar | Plik |
|--------|------|
| Hinty DNS | `src/providers/ResourceHints.tsx` |
| Layout / przyszłe tagi | `src/app/layout.tsx` |
| Marker (tylko `?marker=1`) | `src/components/MarkerOnDemand.tsx` |
| Wistia + `next/script` | `WynikiSection.tsx`, `CaseStudy2Section.tsx`, `WzrostPrzychodowSection.tsx` |
| Wistia vanilla | `OnasEngine.tsx` |
