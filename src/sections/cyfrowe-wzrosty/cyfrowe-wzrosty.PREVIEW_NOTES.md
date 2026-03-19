# cyfrowe-wzrosty — PREVIEW NOTES

## Różnice względem CyfroweWzrostyEngine.tsx (delta — nie błędy)
| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | pełny Lenis via CDN + stub z debounce 120ms |
| Lenis | aktywny (import modułowy) | aktywny (CDN) — identyczny physics feel |
| StrictMode | aktywny (podwójny mount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | zoptymalizowane | zwykły `<img>` (N/A — sekcja nie ma mediów) |
| GSAP pluginy | importowane przez npm | ładowane przez CDN, zarejestrowane przez `typeof` guard |
| Dynamic import | CyfroweWzrostySection wrapper lazy-loads Engine | brak — init() odpala od razu na DOMContentLoaded |
| TypeScript | adnotacje TS (strict) | vanilla JS (brak typów) |

Akceptacja PREVIEW = akceptacja artefaktu TSX. PREVIEW nie testuje reference.html.

## Co preview gwarantuje
- Identyczna logika GSAP (timing, easing, spring physics, punch, hover TLs) — ten sam init(container)
- Identyczny CSS (literalna kopia cyfrowe-wzrosty-section.css)
- Identyczna struktura DOM
- Identyczny scrollRuntime (Lenis CDN = analogiczny do modułowego)
- _killed guard dodany (P3-CLEAN-01) — identycznie w TSX i PREVIEW

## Czy preview jest 1:1?
PEŁNY — animacje i layout behawioralnie identyczne z artefaktem TSX.
Lenis obecny w PREVIEW (CDN) = scroll physics identyczne z produkcją.

## Minimalny standard akceptacji
- [ ] Layout bez FOUC / braków CSS
- [ ] 3D text "WZROSTU" renderuje się z efektem głębi (scroll + mouse proximity)
- [ ] Punch na literach działa (click/tap)
- [ ] Tiles reveal animacja odpala przy scrollu do sekcji tiles
- [ ] Hover na tile'ach: ribbon wjeżdża, stage-label skaluje, heading/body przesuwają
- [ ] Nawigacja strzałkami i kropkami działa
- [ ] Drag-to-scroll na track (desktop)
- [ ] Sekcja pauzuje ticker gdy offscreen (sprawdź konsolę)

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
