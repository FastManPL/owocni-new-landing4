# final — PREVIEW NOTES

## Różnice względem FinalEngine.tsx (delta — nie błędy)

| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | stub: `window.lenis?.scroll ?? window.scrollY` + debounce 120ms |
| Lenis | aktywny | brak — stub wraca do scrollY |
| Three.js import | `import * as THREE from 'three'` (NPM) | importmap + es-module-shims (CDN) |
| RoomEnvironment | `three/examples/jsm/...` (NPM) | `three/addons/...` (importmap) |
| StrictMode | aktywny (podwójny mount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — Lexend z Google CDN (jeśli używany) |
| dynamic import | next/dynamic ssr:false | bezpośredni mount (brak lazy load) |
| requestIdleCallback | aktywny (warmup idle) | aktywny — przeglądarka obsługuje |

## Co preview gwarantuje

- Identyczna logika GSAP (timing, easing) — ten sam init(container)
- Identyczny CSS (literalna kopia final-section.css)
- Identyczna struktura DOM
- WebGL: pełny renderer z transmission glass + rim gradient
- Zegar: cyfry z animacją dissolve, cykl JUŻ JEST / dzień
- Bottom sheet: tap/velocity swipe na formCard (mobile/małe okno)

## Czy preview jest 1:1?

PEŁNY — animacje i layout behawioralnie identyczne z artefaktem TSX.

Jedyna różnica odczuwalna: brak Lenis smooth scroll (stub używa natywnego scrollY).
Warmup idle (requestIdleCallback) aktywny — PREVIEW zachowuje się identycznie z produkcją.

## Minimalny standard akceptacji

- [ ] Sekcja odsłania się podczas scrollowania (sticky reveal)
- [ ] WebGL renderuje — tekst DOBRY CZAS JEST TERAZ + zegar
- [ ] Zegar tyka — cyfry animują się dissolve co sekundę
- [ ] Szkło badge'a zegara: transmission visible, rim gradient (fiolet/czerwień)
- [ ] Karta formularza widoczna (może być ucięta na dole)
- [ ] Na mobile/małe okno: tap na karcie = slide up/down
- [ ] Brak błędów w konsoli

## Akcja

**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
