# fakty — PREVIEW NOTES

## Różnice względem FaktyEngine.tsx (delta — nie błędy)
| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | stub: `window.lenis?.scroll ?? window.scrollY` + debounce 120ms |
| Lenis | aktywny | brak — stub wraca do scrollY |
| StrictMode | aktywny (podwójny mount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | zoptymalizowane | zwykły `<img>` (N/A — sekcja nie ma `<img>`) |
| GSAP pluginy | importowane przez npm | ładowane przez CDN |
| Dynamic import | `next/dynamic` + double rAF refresh | brak — synchroniczne DOMContentLoaded |
| TypeScript | strict mode, adnotacje typów | vanilla JS (brak typów) |

Akceptacja PREVIEW = akceptacja artefaktu TSX. PREVIEW nie testuje reference.html.

## Co preview gwarantuje
- Identyczna logika GSAP (timing, easing, scrub) — ten sam init(container)
- Identyczny CSS (literalna kopia fakty-section.css)
- Identyczna struktura DOM
- Patch I: scrollRuntime.requestRefresh('fonts-ready-settle') po buildTunnel()
- ScrollTrigger.refresh(true) → scrollRuntime.requestRefresh('st-refresh') w resize

## Jak zbudowany jest scroll animacji (ScrollTrigger)

Animacje sekcji **nie** są włączane „gdy sekcja wchodzi na ekran” w sensie dyskretnym. Działają w **ciągłym trybie scrub**: progress 0→1 jest mapowany liniowo na **pozycję scrolla** w ustalonym zakresie [start, end].

- **Scroller:** domyślnie `window` (document scroll). W produkcji Lenis nadal raportuje `scrollTop` — ScrollTrigger używa go tak samo.
- **Start/end:** w notacji GSAP `"pozycja triggera pozycja viewportu"`:
  - **st3 (główna timeline), tunnelST:** `trigger: faktyBlock`, `start: 'top bottom'`, `end: 'bottom top'` → zakres = od „górna krawędź sekcji przy dolnej krawędzi viewportu” do „dolna krawędź sekcji przy górnej krawędzi viewportu”. Długość tego zakresu w pikselach = **wysokość viewportu + wysokość sekcji** — nie zależy od tego, ile jest treści powyżej (spacer).
  - **frameST:** `trigger: row1`, `start: 'top top+=61%'`, `end: 'top top-=…%'` → progress klatek od „row1 w 61% viewportu” do „row1 wyjechał w górę”.
  - **orgST:** `trigger: faktyBlock`, `start: 'top bottom-=30%'`, `end: 'bottom center'` → linia organiczna w tym zakresie.

Efekt: animacja **ciągle** ma przypisany przedział scrolla; gdy `scrollTop` jest w tym przedziale, progress jest między 0 a 1. Nie ma osobnego „wykrywania wejścia sekcji” — wszystko jest od scroll position.

### Dlaczego przy spacerze 200vh animacja „startuje za wcześnie”?

W preview **oba** `.preview-spacer` (nad i pod sekcją) mają tę samą klasę. Gdy ustawisz `height: 200vh`, sekcja jest **200vh od góry** strony, więc teoretycznie `start: 'top bottom'` powinien dać start przy scrollu ~100vh (gdy góra sekcji dotrze do dołu viewportu).

Możliwe przyczyny wczesnego startu:

1. **Refresh w złym momencie** — ScrollTrigger liczy `start`/`end` przy `refresh()`. Jeśli refresh dzieje się zanim layout się ustabilizuje (fonty, obrazy, spacer w layoutcie), pozycja triggera może być źle policzona (np. jak gdyby sekcja była wyżej) i zapisany „start” będzie za mały → animacja rusza od początku scrolla.
2. **Długi dokument** — przy 200vh spacerze strona jest bardzo długa; ten sam zakres scrolla (viewport + sekcja) to mały ułamek całego scrolla. Subiektywnie może się wydawać, że „animacja działa od razu”, bo większość scrolla to pusty spacer, a sam przedział animacji jest względnie krótki.
3. **Brak drugiego spacera nad sekcją** — jeśli w swoim teście zmieniasz tylko dolny spacer (pod sekcją), sekcja dalej zaczyna się zaraz pod pierwszym spacerem (40vh). Wtedy „start” może być przy ~0 (góra sekcji od razu przy dole viewportu), więc animacja idzie od pierwszego piksela scrolla.

**Rekomendacja w preview:** żeby symulować „najpierw scroll, potem sekcja”, spacer **nad** sekcją musi być wysoki (np. 200vh). Oba spacery mają tę samą klasę — przy `40vh` sekcja jest 40vh od góry, przy `200vh` — 200vh od góry. Po zmianie wysokości spacerów warto wywołać `ScrollTrigger.refresh(true)` po załadowaniu fontów/layoutu (np. po 300–500 ms), żeby start/end były policzone na ustalonym layoucie.

## Czy preview jest 1:1?
OGRANICZONY:
- geometryContract: geometry-sensitive — standalone scroll context (preview-spacer 40vh) nie odzwierciedla produkcyjnego stacku. ST triggers mogą odpalać inaczej niż w pełnym layoucie strony.
- Frames: FRAMES_BASE_PATH = 'frames/fakty-' (placeholder) — bez prawdziwych klatek sekwencji text będzie solid fill #0a0a0c (graceful degradation).
- Tunnel: wymaga fontu Lexend załadowanego — jeśli CDN wolny, tunnel atlas będzie pusty do momentu załadowania.
- Pełna weryfikacja wymaga `npm run dev` z prawdziwym stackiem sekcji.

## Minimalny standard akceptacji
- [ ] Layout bez FOUC / braków CSS — title-block `visibility: hidden` do `.ready`
- [ ] Animacje scroll: row1 chars rotateX + opacity, row2 scaleY — weryfikacja "na oko"
- [ ] Organic engine: canvas overlay pojawia się z animacją opacity (CSS transition)
- [ ] Tunnel: cyfry na przezroczystym tle (VIS-PATCH-01: alpha:true)
- [ ] Resize: po zmianie szerokości okna — layout przelicza się, brak skoków

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
