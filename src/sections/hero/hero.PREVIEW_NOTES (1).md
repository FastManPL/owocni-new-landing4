# hero — PREVIEW NOTES

## Co preview gwarantuje
- Identyczna logika GSAP (timing, easing, animations) — ten sam init(container)
- Identyczny CSS (literalna kopia hero-section.css)
- Identyczna struktura DOM
- Brak ScrollTrigger w sekcji — scroll API jest stub

## Co preview NIE gwarantuje (różnice infrastrukturalne — akceptowalne)
- Brak Lenis — scroll używa window.scrollY (stub)
- Brak SSR / next/font (fonty z Google CDN)
- Brak next/image (zwykły `<img>`)
- Brak React StrictMode
- Lottie assets (`/animations/*.json`) wymagają serwera lokalnego lub CORS

## Czy preview jest 1:1?
**PEŁNY** — animacje i layout behawioralnie identyczne z reference.html

### Uwagi dotyczące Lottie:
- Logo Lottie (`/animations/LOGO_OWOCNI.json`) wymaga konwersji z .lottie → .json
- Laury (`/animations/laury-*.json`) wymagają lokalnego serwera dla fetch
- W PREVIEW otwartym bezpośrednio z file:// Lottie może nie załadować (CORS)
- Zalecenie: `npx serve .` lub `python -m http.server` w katalogu z plikami

## Minimalny standard akceptacji
- [x] Layout bez FOUC / braków CSS
- [x] Interakcje działają (klik / hover / zmiana stanu)
- [x] Animacje i timingi zgodne "na oko" z reference.html
- [ ] Lottie logo animuje (wymaga serwera lokalnego)
- [ ] Laury Lottie animują (wymaga serwera lokalnego)

## Znane różnice vs produkcja
1. **Trail photos**: W PREVIEW ścieżki `/trail/*.avif` wymagają serwera
2. **Marquee brands**: TidalDriftMarquee dynamicznie tworzy elementy — wymaga assets
3. **Fonty**: Google CDN w PREVIEW vs next/font w produkcji (minimalna różnica renderingu)

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
