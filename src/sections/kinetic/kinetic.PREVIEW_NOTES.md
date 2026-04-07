# kinetic — PREVIEW NOTES

## Różnice względem KineticSection.tsx (delta — nie błędy)

| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | stub: `window.lenis?.scroll ?? window.scrollY` + debounce 120ms |
| Lenis | aktywny przez scrollRuntime.ts | aktywny przez shell boot (window.lenis) |
| StrictMode | aktywny (podwójny mount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | zoptymalizowane | zwykły `<img>` |
| GSAP pluginy | importowane przez npm | ładowane przez CDN |
| `scrollTo/scrollOn/scrollOff` | `window.lenis?.* (P3-WILL-REPLACE)` | `window.lenis?.*` (identycznie) |

Akceptacja PREVIEW = akceptacja artefaktu TSX. PREVIEW weryfikuje **KineticSection.tsx**, nie reference.html.

## Co PREVIEW gwarantuje
- Identyczna logika GSAP (timing, easing, snap, bridge/kinetic state machine)
- Identyczny CSS (literalna kopia kinetic-section.css)
- Identyczna struktura DOM
- Identyczny mechanizm gating (IO → pause/resume)
- ST-REFRESH-01 scaffold (section-in-view + layout-settle) — obecny

## Ograniczenia PREVIEW (Typ B z velocity — nie powodują błędów)
PREVIEW używa `window.lenis?.scroll` (przez stub) — w produkcji Lenis jest aktywny przez scrollRuntime.ts.
Różnica: stub nie ma Lenis smooth-scrolling → fizyczny feel scrollu może się różnić.
Animacje GSAP (timing, easing) są identyczne — Lenis zmienia tylko gładkość scrollu, nie prędkość GSAP.
**Dla pełnej weryfikacji Typ B:** `npm run dev` + weryfikacja z Lenis aktywnym.

## Freeze na SNAP3
PREVIEW kończy się na SNAP3 — freeze jest celowy (DEV_SOLUTION v3, sekcja 12).
W produkcji Block 4 scrolluje NAD zamrożoną klatką KINETIC. Dolny spacer nie jest potrzebny.

## Czy PREVIEW jest 1:1?
PEŁNY — animacje i layout behawioralnie identyczne z artefaktem TSX.
Różnica feel scrollu: Lenis smooth w produkcji, natywny w PREVIEW — nie jest błędem.

## Minimalny standard akceptacji
- [ ] Layout bez FOUC / braków CSS
- [ ] Animacja wejścia (bridge → SNAP1) poprawna
- [ ] SNAP1 → SNAP2 → SNAP3 działają
- [ ] Freeze na SNAP3 aktywny
- [ ] Particle QMark ("?") pojawia się i transformuje w "!"
- [ ] Cylinder 98% widoczny na SNAP3
- [ ] NIGDY glow i blaszka widoczne na SNAP3

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
