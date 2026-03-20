# onas — PREVIEW NOTES

## Różnice względem OnasEngine.tsx (delta — nie błędy)

| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | stub: `window.lenis?.scroll ?? window.scrollY` + debounce 120ms |
| Lenis | aktywny | brak — stub wraca do scrollY; physics/velocity feel będzie inny |
| Three.js import | `await import('three')` (dynamic) | `window.THREE` z module script CDN |
| onasCapitanInit | async funkcja | synchronous wrapper z window.THREE |
| StrictMode | aktywny (podwójny mount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/dynamic | aktywny (ssr:false) | brak — kod bootuję bezpośrednio |
| gsap.registerPlugin | wewnątrz useGSAP | top-level (vanilla OK) |
| Flex gap detector | wewnątrz useGSAP | inline `<script>` przed boot |

Akceptacja PREVIEW = akceptacja artefaktu TSX. PREVIEW nie testuje reference.html.

## Co PREVIEW gwarantuje
- Identyczna logika GSAP (timing, easing, snap, scroll-drive)
- Identyczny CSS (literalna kopia onas-section.css)
- Identyczna struktura DOM
- Carousel: drag, snap, autoplay, cascade reveal, video popup
- Capitan: badge 3D (Three.js WebGL), scroll-driven ring animation, badge reveal
- IO gating: section pause/resume przy scroll poza widok

## Czy preview jest 1:1?

OGRANICZONY:
- Three.js: CDN via window.* vs dynamic import — funkcjonalnie identyczne, inicjalizacja sync vs async
- Lenis velocity/physics: stub wraca do scrollY — scroll feel będzie inny niż z Lenis
- onasCapitanInit sync vs async: w PREVIEW capitan startuje synchronicznie; w React asynchronicznie (po Three.js lazy load). Wizualnie identyczne po załadowaniu.
- Dla pełnej weryfikacji physics + capitan timing: `npm run dev` z Lenis

## Minimalny standard akceptacji
- [ ] Layout bez FOUC / braków CSS
- [ ] Carousel obraca się (autoplay)
- [ ] Carousel: drag działa
- [ ] Badge 3D widoczny po scroll (Three.js)
- [ ] Scroll przez badge → animacja ringu (ScrollTrigger)
- [ ] Klick na kartę video → popup otwiera się
- [ ] Scroll poza sekcję → carousel zatrzymuje się

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
