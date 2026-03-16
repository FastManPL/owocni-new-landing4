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
