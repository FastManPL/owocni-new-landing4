# kinetic — PREVIEW NOTES

## Różnice względem KineticSection.tsx (delta — nie błędy)

| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (nie wdrożony) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | stub: `window.lenis?.scroll ?? window.scrollY` + debounce 120ms |
| Lenis | aktywny (przez scrollRuntime) | aktywny przez CDN shell — snap machine działa |
| StrictMode | aktywny (podwójny mount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | zoptymalizowane | zwykły `<img>` (sekcja nie ma img) |
| GSAP pluginy | importowane przez npm | ładowane przez CDN |
| TS adnotacje | present | usunięte (vanilla JS) |
| Dynamic import | next/dynamic wrapper | brak — bezpośredni init() |

## Ograniczenia PREVIEW (Typ B)

PREVIEW używa Lenis przez CDN shell — snap machine (`scrollTo`, `scrollOn`, `scrollOff`)
powinien działać poprawnie. Pełna weryfikacja velocity/physics: `npm run dev` z Lenis z NPM.

## Co PREVIEW gwarantuje

- Identyczna logika GSAP (timing, easing, scrub, snap, physics) — ten sam init(container)
- Identyczny CSS (literalna kopia kinetic-section.css)
- Identyczna struktura DOM (HTML 1:1 z JSX, class= zamiast className=)
- scrollRuntime stub z debounce 120ms — spójność z produkcją

## Czy PREVIEW jest 1:1?

OGRANICZONY:
- Snap machine wymaga Lenis — Lenis załadowany przez CDN shell, snap powinien działać
- StrictMode nieaktywny — weryfikacja przez `npm run dev`
- Pełna weryfikacja Typ B: `npm run dev` po wdrożeniu do repo

## Minimalny standard akceptacji

- [ ] Cząsteczki (! i ?) renderują się poprawnie
- [ ] Cylinder (liczby) renderuje się poprawnie
- [ ] Tunnel rings widoczne w fazie bridge
- [ ] Bloby animują się płynnie
- [ ] Snap do SNAP1 / SNAP2 / SNAP3 działa
- [ ] Tekst Block 1, 2, 3 pojawia się we właściwych momentach
- [ ] Cień Liter (ghost clone B1) pojawia się przy gravity drop
- [ ] Brak FOUC

## Akcja

**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
