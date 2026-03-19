# gwarancja — PREVIEW NOTES

## Różnice względem GwarancjaSection.tsx (delta — nie błędy)
| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | nie używany | nie używany (sekcja nie ma ST) |
| Lenis | N/A (sekcja mousemove-driven) | N/A |
| StrictMode | aktywny (podwójny mount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | N/A (img z base64) | zwykły `<img>` |
| GSAP pluginy | importowane przez npm | ładowane przez CDN |
| TypeScript | adnotacje w .tsx | brak (vanilla JS w PREVIEW) |

Akceptacja PREVIEW = akceptacja artefaktu TSX. PREVIEW nie testuje reference.html.

## Co preview gwarantuje
- Identyczna logika GSAP (timing, easing, tweens) — ten sam init(container)
- Identyczny CSS (literalna kopia gwarancja-section.css)
- Identyczna struktura DOM
- Identyczne interakcje (mousemove lens, cursor particles, aureola, wave click)

## Czy preview jest 1:1?
PEŁNY — animacje, layout i interakcje behawioralnie identyczne z artefaktem TSX.
Sekcja jest Typ B (mousemove-driven, rAF-based), nie zależy od Lenis/scroll velocity.

## Minimalny standard akceptacji
- [ ] Layout bez FOUC / braków CSS
- [ ] Lens effect działa (hover nad kontenerem → maska + tarcza)
- [ ] CTA button hover → silk pulse animation
- [ ] CTA cursor particles + aureola (desktop, pointer:fine)
- [ ] Badge conic-gradient animation obraca się
- [ ] Pill glow widoczny

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
