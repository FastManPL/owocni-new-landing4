# wyniki-cs-tiles — PREVIEW NOTES

## Różnice względem WynikiCsTilesEngine.tsx
| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty) | brak |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | stub: window.scrollY + debounce 120ms |
| Lenis | aktywny | brak — velocity/physics feel może się różnić |
| StrictMode | aktywny (podwójny mount) | brak |
| SSR / next/font | aktywny | brak — fonty z Google CDN |

## Co preview gwarantuje
- Identyczna logika GSAP (timing, easing, scrub, physics)
- Identyczny CSS
- Identyczna struktura DOM

## Czy preview jest 1:1?
OGRANICZONY: Canvas flywheel physics feel może się różnić bez Lenis.
Pełna weryfikacja Typ B: `npm run dev` z Lenis.

## Minimalny standard akceptacji
- [ ] Layout bez FOUC / braków CSS
- [ ] Scroll przez 3 sekcje — animacje poprawne
- [ ] Canvas flywheel kręci się przy scrollu

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
