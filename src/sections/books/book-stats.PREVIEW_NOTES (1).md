# book-stats — PREVIEW NOTES

## Różnice względem BookStatsSection.tsx (delta — nie błędy)
| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | stub: `window.lenis?.scroll ?? window.scrollY` + debounce 120ms |
| Lenis | aktywny | brak — stub wraca do scrollY; velocity/physics feel może się różnić (Typ B) |
| StrictMode | aktywny (podwójny mount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | zoptymalizowane | zwykły `<img>` (N/A — sekcja nie ma `<img>`) |
| GSAP pluginy | importowane przez npm | ładowane przez CDN (ScrollTrigger jedyny) |
| Sentry element | wewnątrz `<section>` (container-scoped) | wewnątrz `<section>` (identycznie) |
| Dead code | usunięte (DEBUG_MODE, getScroll) | usunięte (identycznie) |

Akceptacja PREVIEW = akceptacja artefaktu TSX. PREVIEW nie testuje reference.html.

## Co preview gwarantuje
- Identyczna logika GSAP (timing, easing, snap, physics) — ten sam init(container)
- Identyczny CSS (literalna kopia book-stats-section.css)
- Identyczna struktura DOM

## Czy preview jest 1:1?
PEŁNY — animacje i layout behawioralnie identyczne z artefaktem TSX.
Nota: sekcja klasyfikowana jako Typ B, ale canvas TYLKO w ST.onUpdate (scrub) = funkcjonalnie Typ A. Brak velocity/physics zależnych od Lenis. Stub scrollRuntime jest wystarczający.

## Minimalny standard akceptacji
- [ ] Layout bez FOUC / braków CSS
- [ ] Canvas frame sequence: scrolluj — klatki zmieniają się płynnie
- [ ] Counter reels: scroll → widoczne → zakręcą się z bounce
- [ ] Pin: sekcja przypina się przy scrollu, odpina po przejściu
- [ ] Heading sweep: backgroundPosition animuje z bounce.out

## Sentry element — zmiana pozycji
W reference.html sentry (`#book-stats-sentry`) był POZA `<section>`.
W React/PREVIEW — WEWNĄTRZ `<section>` (container-scoped `$id()` wymaga tego).
Efekt: sentry nadal triggeruje wcześnie (rootMargin 1000px), ale punkt referencyjny jest nieco niżej.
Jeśli preload nie startuje wystarczająco wcześnie → zwiększ rootMargin w produkcji.

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
