# wyniki — PREVIEW NOTES

## Różnice względem WynikiSection.tsx (delta — nie błędy)
| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | stub: `window.scrollY` + debounce 120ms |
| Lenis | aktywny | brak — stub wraca do scrollY |
| StrictMode | aktywny (podwójny mount) | brak |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | zoptymalizowane | zwykły `<img>` |

Akceptacja PREVIEW = akceptacja artefaktu TSX. PREVIEW nie testuje reference.html.

## Co preview gwarantuje
- Identyczna logika GSAP (timing, easing, snap, physics) — ten sam init(container)
- Identyczny CSS (literalna kopia wyniki-section.css)
- Identyczna struktura DOM

## Czy preview jest 1:1?
PEŁNY — animacje i layout behawioralnie identyczne z artefaktem TSX.

## Minimalny standard akceptacji
- [ ] Layout bez FOUC / braków CSS
- [ ] Popup otwiera się i zamyka poprawnie
- [ ] Scroll zoom + parallax + overlay identyczne z reference.html
- [ ] Play button SVG widoczny, progress arc działa

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
