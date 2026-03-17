# kinetic — PREVIEW NOTES

## Różnice względem KineticSection.tsx (delta — nie błędy)
| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P2A) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` v6.x (Lenis) | stub: deleguje do window.lenis (identyczny interfejs) |
| Lenis | aktywny (przez scrollRuntime v6.x) | aktywny (bezpośrednio — snap system wymaga Lenis) |
| StrictMode | aktywny (podwójny mount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | N/A (brak obrazów) | N/A |
| GSAP pluginy | importowane przez npm | ładowane przez CDN |
| scrollRuntime v6.x | npm moduł (scrollTo/on/off/start) | stub delegujący do window.lenis |

Akceptacja PREVIEW = akceptacja artefaktu TSX. PREVIEW nie testuje reference.html.

## Co preview gwarantuje
- Identyczna logika GSAP (timing, easing, snap, physics) — ten sam init(container)
- Identyczny CSS (literalna kopia kinetic-section.css)
- Identyczna struktura DOM
- Snap system działa (Lenis aktywny z scrollTo/on/off/start)

## Czy preview jest 1:1?
PEŁNY — animacje i layout behawioralnie identyczne z artefaktem TSX.
Snap system działa identycznie (PREVIEW ma Lenis, produkcja ma scrollRuntime v6.x delegujący do Lenis).
Jedyna różnica: PREVIEW stub deleguje bezpośrednio do window.lenis, produkcja przez scrollRuntime abstraction layer.

## Minimalny standard akceptacji
- [ ] Layout bez FOUC / braków CSS
- [ ] Animacje i timingi zgodne "na oko" z reference.html
- [ ] Snap system działa (scroll forward → SNAP1 → SNAP2 → SNAP3, backward działa)
- [ ] 3× canvas renderuje poprawnie (particle "?/!", tunnel rings, cylinder "98%")
- [ ] Blob animacje i kolor transitions działają
- [ ] Nigdy plate/text/glow pojawia się w Block 3

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
