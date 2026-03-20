# love-wall — PREVIEW NOTES

## Różnice względem LoveWallSection.tsx (delta — nie błędy)

| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | stub: `window.lenis?.targetScroll ?? window.scrollY` + debounce 120ms |
| Lenis | aktywny | brak — velocity ticker używa scrollDelta fallback; physics feel może się różnić |
| StrictMode | aktywny (podwójny mount/unmount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | zoptymalizowane | zwykły `<img>` |
| GSAP pluginy | importowane przez npm | ładowane przez CDN (gsap@3.12.7, ScrollTrigger@3.12.7) |
| window.__smoothedVelocity | pochodzi z Lenis pipeline (globalny ticker) | brak — fallback do scrollDelta |

Akceptacja PREVIEW = akceptacja artefaktu TSX. PREVIEW nie testuje reference.html.

## Co PREVIEW gwarantuje

- Identyczna logika GSAP (timing, easing, debris particles, efekty kinetic typography)
- Identyczny CSS (literalna kopia love-wall-section.css)
- Identyczna struktura DOM
- Identyczne FOUC guardy (translateY(-50%) na track-a i track-b)
- Identyczna logika velocity cards (physics rows, hover tilt, mobile expand, gyro, swipe-to-scroll)

## Czy PREVIEW jest 1:1?

**OGRANICZONY** — `window.__smoothedVelocity` pochodzi z Lenis velocity pipeline (smoothed 6-frame buffer × 60fps). W PREVIEW brak Lenis → velocity ticker używa `|scrollDelta| × 1.2` jako fallback. Karty toczą się poprawnie i kinetic typography animuje przy przejściu — subtelna różnica w intensywności velocity boost przy bardzo szybkim scrollu (physics feel). Pełna weryfikacja physics: `npm run dev`.

## Minimalny standard akceptacji

- [ ] Layout bez FOUC — karty widoczne od razu, typography track wyrenderowany
- [ ] Karty toczą się automatycznie po scrollu (dwa rzędy)
- [ ] Kinetic typography animuje przy przejściu przez viewport (WZÓR, 10na10, WOW, itp.)
- [ ] Hover (desktop): karta unosi się w 3D, tilt pointer-śledzący, spotlight radial gradient
- [ ] Hover off: rząd płynnie wznawia ruch (softResume)
- [ ] Mobile (≤500px): tap na kartę → expand z efektem spotlight + star-flip animacja
- [ ] Mobile swipe: poziomy drag przewija rząd z momentum
- [ ] Scroll szybki: karty przechylają się (skewX) i rozciągają (scaleX)

## Akcja

**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
