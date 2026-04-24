# PROMPT 6 — CPU gating (video / canvas / Lottie / WebGL)

**Konstytucja:** D1–D4 (Typ B lifecycle), G4 (gating mediów), G11 (Tier 0), J15 (WebGL COLD/WARM/HOT/OFF).  
**Legenda:** `[x]` wdrożone w kodzie (audyt stanu repo), `[~]` częściowo / ryzyko, `[ ]` brak / do decyzji.

---

## 1. OUTPUT — lista sekcji Typ B (per-frame / canvas / WebGL / ciężki ticker)

| Sekcja | Typ B | Uwagi |
|--------|-------|--------|
| Hero | tak | Lottie (lazy), trail/history, GSAP, canvas badge — głównie nad foldem |
| Wyniki | tak | Canvas mockup, WARM video, GSAP |
| BookStats | tak | Canvas frame-sequence + ScrollTrigger, WARM video |
| Fakty | tak | Organic mesh rAF + GSAP |
| Kinetic | tak | Canvas 2D + ScrollTrigger pin |
| Blok45 | tak | Three.js + cząsteczki + `gsap.ticker` |
| Kalkulator | nie | Brak rAF/WebGL w sekcji (logika formularza) |
| Gwarancja | tak | GSAP ticker (mask), 2× video, SVG |
| LoveWall | tak | Marquee / velocity GSAP, Lottie logo |
| CaseStudy2 | tak | Canvas particles, 2× WARM video, Wistia |
| CaseStudies (tiles) | tak | Flywheel canvas + 4× video |
| Onas | tak | Three.js + tickery / smooth rAF |
| Cyfrowe wzrosty | tak | `gsap.ticker` spring + 7× WARM video |
| FAQ | tak | Glow pointer rAF (tylko przy otwartym item + ruch), burst canvas (krótko) |
| Final | tak | Three.js + `gsap.ticker` (zegar) |
| Wyniki CS tiles (portfolio) | tak* | *Jeśli route mountuje `WynikiCsTilesEngine` — flywheel + video |

---

## 2. Lifecycle compliance (pause / resume / kill + viewport)

| Sekcja | `pause`/`resume`/`kill` | Gating poza viewportem | Status |
|--------|---------------------------|-------------------------|--------|
| Hero | [x] | [x] IO (pendulum, foil, badges, action-area, itd.) + `visibilitychange` na trail | OK |
| Wyniki | [x] | [x] Factory IO + `warmVideo` na mockup (G4) + pause hooks canvas | OK |
| BookStats | [x] | [~] `pause`/`resume` = tylko `ScrollTrigger.disable/enable` — **brak factory IO**; WARM video z `intersectionPauseResume` | Wideo OK; ewent. factory IO osobno |
| Fakty | [x] | [x] `pauseOrganic` / IO `onLeave` + visibility | OK |
| Kinetic | [x] | [x] `_sectionVisible` + pause/resume/kill | OK |
| Blok45 | [x] | [x] Factory IO + `mainLoopIO` na `gsap.ticker` | OK |
| Gwarancja | [x] | [x] `pauseHooks` / visibility + video | OK |
| LoveWall | [x] | [x] IO → pause/resume (logo + velocity) | OK |
| CaseStudy2 | [x] | [x] Factory IO + `warmVideo` | OK |
| CaseStudies tiles | [x] | [x] Factory IO + `startWarmVideosOnce(..., intersectionPauseResume)` | OK |
| Onas | [x] | [x] pause/resume/kill + video cards IO | OK |
| Cyfrowe wzrosty | [x] | [x] Internal IO + factory IO + warmVideo batch | OK |
| FAQ | [x]* | [x]* | *Brak factory IO na całą sekcję — glow rAF tylko przy pointermove na otwartym item; burst skończony (~60 kl.) |
| Final | [x] | [x] IO warm margin + `pause` usuwa ticker | OK |
| Wyniki CS tiles | [x] | [x] Factory IO + video pause w `pause()` | OK |

---

## 3. Video — pauza poza viewportem (G2/G4/G11)

| Miejsce | Mechanizm | Status |
|---------|-----------|--------|
| `src/lib/warmVideo.ts` | Tier 0 blokada, IO, visibility, opcja `intersectionPauseResume` | [x] |
| Wyniki mockup | `startWarmVideoOnce` + factory | [x] |
| BookStats `.cs-video` | `startWarmVideoOnce` + `intersectionPauseResume: true` (G4) | [x] |
| CaseStudy2 | `warmVideo` + factory | [x] |
| CaseStudies kafelki | `intersectionPauseResume` | [x] |
| Cyfrowe wzrosty (7×) | `startWarmVideosOnce` + visibility helper | [x] |
| Gwarancja | Własna logika load + `pauseHooks` | [x] |
| Onas karty video | IO reveal — play/pause | [x] |
| Hero | Brak hero-video (gradient) | N/D |

---

## 4. Lottie / canvas / rAF (bez mielenia off-screen)

| Obszar | Zachowanie | Status |
|--------|------------|--------|
| Hero Lottie | Lazy import + IO na badge / pause przy leave | [x] |
| LoveWall Lottie | W bundle logo init — IO pause sekcji | [x] |
| BookStats canvas | Scrub przez ST — brak osobnego pętli; **gdy poza viewport ST nadal aktualizuje przy scrollu strony** | [~] koszt mały, ewent. factory jak Wyniki |
| Wyniki canvas | `cancelAnimationFrame` w pause hooks | [x] |
| FAQ glow | rAF tylko gdy jest otwarty item i ruch pointera | [x] |
| FAQ burst | Skończona pętla | [x] |

---

## 5. WebGL — J15 (COLD / WARM / HOT / OFF) + G11.1

| Sekcja | Broker `getWebGLProfile()` | Fallback Tier/profile `none` | OFF = stop loop | OFF → COLD dispose ~30s (J15) |
|--------|----------------------------|------------------------------|-----------------|------------------------------|
| Blok45 | [x] użycie w init | [x] degradacja | [x] ticker remove | [ ] brak jawnego timera 30s — dispose przy `kill()` |
| Onas | [x] | [x] | [x] / częściowe ścieżki | [ ] jak wyżej |
| Kinetic | WebGL warstwa | profil | [x] auto-pause off-screen | [ ] |
| Final | [x] `webglSkippedForProfile` + static fallback CSS | [x] | [x] | [ ] pełny dispose tylko w `kill()`, nie po 30s OFF |

**Wniosek:** [~] Pełny **J15 „OFF → COLD po ~30s”** (zwrot GPU bez unmount) — **nie zweryfikowany** w kodzie; dispose jest przy `kill`/unmount sekcji.

---

## 6. Tier 0 fallback (G11)

| Obszar | Status |
|--------|--------|
| `warmVideo` / `getDeviceTier()` | [x] |
| `scrollRuntime` / Lenis OFF na Tier 0 | [x] w `autoTier` + runtime |
| Final static fallback przy `webgl` none | [x] `.final-scene--webgl-none` |
| Blok45 / Onas redukcja jakości | [x] przez profil |
| Hero bez wideo bitmap | N/D |

---

## 7. Zadania z PROMPT 6 (checklist robocza)

- [x] Inwentaryzacja sekcji Typ B (powyżej)
- [x] Mapowanie lifecycle (`pause`/`resume`/`kill`) vs factory IO / IO wewnętrzne
- [x] Wideo: **BookStats** — `intersectionPauseResume: true` (2026-04-24)
- [~] BookStats: rozważyć **factory IO** jak Wyniki (gdy ST scrub ma sens tylko w oknie sekcji — weryfikacja CLS/pin)
- [ ] J15: opcjonalna implementacja **deferred dispose** WebGL po ~30s poza viewportem (Final, Blok45, Onas) — uzgodnić z pamięcią GPU na mobile
- [ ] Powtarzalny audyt: nowe sekcje / nowe `<video>` bez `warmVideo`
- [ ] Lighthouse / RUM: CPU przy długim scrollu (profilowanie po wdrożeniu poprawek)

---

## 8. Historia pliku

| Data | Zmiana |
|------|--------|
| 2026-04-24 | Utworzono z audytu kodu; BookStats + J15 oznaczone jako główne luki |
