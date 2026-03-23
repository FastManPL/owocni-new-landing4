# kinetic — PREVIEW NOTES

## Różnice względem KineticSection.tsx (delta — nie błędy)

| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | `getScroll()` + `scrollTo` / `on` / `off` (Lenis w runtime, **nie** `window.lenis`) | stub: `window.lenis?.scroll ?? window.scrollY` + debounce 120ms |
| Lenis | aktywny (przez scrollRuntime) | aktywny przez CDN shell — snap machine działa |
| StrictMode | aktywny (podwójny mount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | zoptymalizowane | zwykły `<img>` (sekcja nie ma img) |
| GSAP pluginy | importowane przez npm | ładowane przez CDN |
| TS adnotacje | present (: string, : HTMLElement, itp.) | usunięte (vanilla JS w script) |
| palette3 | usunięta (dead code) | usunięta (identycznie) |
| DEBUG_MODE | usunięty (dead code po overlay removal) | usunięty (identycznie) |

## Ograniczenia PREVIEW (Typ B)

PREVIEW używa Lenis przez CDN shell — snap machine (`scrollTo`, `scrollOn`, `scrollOff`)
powinien działać poprawnie. Jeśli snap nie działa → sprawdź console na błędy Lenis.

Pełna weryfikacja physics (velocity, momentum) wymaga `npm run dev` z Lenis z NPM.

## Co PREVIEW gwarantuje

- Identyczna logika GSAP (timing, easing, scrub, snap, physics) — ten sam init(container)
- Identyczny CSS (literalna kopia kinetic-section.css)
- Identyczna struktura DOM (HTML 1:1 z JSX, class= zamiast className=)
- scrollRuntime stub z debounce 120ms — spójność z produkcją

## Czy PREVIEW jest 1:1?

OGRANICZONY:
- Snap machine wymaga Lenis — Lenis załadowany przez CDN shell, snap powinien działać
- `scrollRuntime.getScroll()` w PREVIEW = `window.lenis?.scroll ?? window.scrollY`
- StrictMode (podwójny mount) nieaktywny — weryfikacja przez `npm run dev`
- Pełna weryfikacja Typ B: `npm run dev` po wdrożeniu do repo

## Minimalny standard akceptacji

- [ ] Cząsteczki (`!` i `?`) renderują się poprawnie
- [ ] Cylinder (liczby) renderuje się poprawnie
- [ ] Tunnel rings widoczne w fazie bridge
- [ ] Bloby animują się płynnie
- [ ] Snap do SNAP1 / SNAP2 / SNAP3 działa
- [ ] Tekst Block 1, 2, 3 pojawia się we właściwych momentach
- [ ] "nigdy" — blaszka + glow animuje się poprawnie
- [ ] Brak FOUC (elementy ukryte przez CSS .text-block { opacity:0; visibility:hidden })

## Akcja

**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
