# wyniki — PREVIEW NOTES

## Różnice względem WynikiSection.tsx (delta — nie błędy)
| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | stub: `window.lenis?.scroll ?? window.scrollY` + debounce 120ms |
| Lenis | aktywny | brak — stub wraca do scrollY; velocity/physics feel może się różnić (Typ B) |
| StrictMode | aktywny (podwójny mount) | brak — nie wykryje nieidempotentnego kill() |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | zoptymalizowane | zwykły `<img>` |
| GSAP pluginy | importowane przez npm | ładowane przez CDN |

Akceptacja PREVIEW = akceptacja artefaktu TSX. PREVIEW nie testuje reference.html.

## Co preview gwarantuje
- Identyczna logika GSAP (timing, easing, scrub, brightness) — ten sam init(container)
- Identyczny CSS (literalna kopia wyniki-section.css)
- Identyczna struktura DOM

## Czy preview jest 1:1?
OGRANICZONY: Typ B — cursor particles rAF loop. Scroll feel różni się (brak Lenis).
Pełna weryfikacja physics: npm run dev z aktywnym Lenis.
Layout, animacje scroll-driven, brightness, video sizing — behawioralnie identyczne.

## Minimalny standard akceptacji
- [ ] Layout bez FOUC / braków CSS
- [ ] Scroll parallax + brightness + laptop zoom działa
- [ ] Cursor particles na desktop (hover nad CTA)
- [ ] Popup video (klik prawego panelu / "Zobacz realizację")
- [ ] Video thumb (PLAY-NEW.mp4) w lewym panelu widoczne
- [ ] Responsive: 375px, 1366px, 1920px, 3440px

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
