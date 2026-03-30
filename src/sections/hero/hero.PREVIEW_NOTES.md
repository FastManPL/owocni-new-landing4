# hero — PREVIEW NOTES

## Różnice względem HeroSection.tsx (delta — nie błędy)
| Co | W TSX | W PREVIEW |
|----|-------|-----------|
| DEV overlay | brak (usunięty w P3) | brak (identycznie) |
| scrollRuntime | `@/lib/scrollRuntime` (Lenis) | stub: `window.lenis?.scroll ?? window.scrollY` + debounce 120ms |
| Lenis | aktywny | brak — stub wraca do scrollY |
| StrictMode | aktywny (podwójny mount) | brak |
| SSR / next/font | aktywny | brak — fonty z Google CDN |
| next/image | zoptymalizowane | zwykły `<img>` |
| H1/H2 | `{variant.h1}` / `{variant.h2}` (ReactNode) | wpisany defaultVariant w HTML |
| Marquee loga | SSR w track (do zaimplementowania) | track pusty, buildBrandsDOM() wypełnia JS |
| Avatary | `/avatars/Klient1.avif` (production path) | `Klient1.avif` (lokalny folder) |

## FOUC inline styles
Brak — żadne `gsap.from()/fromTo()` z literałami nie odpala przy mount.
Wszystkie gsap.set() są wewnątrz warunkowych funkcji (playEntry, cullSlot, spawnIntoSlot).

## Co preview gwarantuje
- Identyczna logika GSAP (ten sam init(container) bez TS)
- Identyczny CSS (literalna kopia hero-section.css)
- Identyczna struktura DOM (z wyjątkiem H1/H2 — defaultVariant)

## Czy preview jest 1:1?
OGRANICZONY:
- H1/H2: PREVIEW pokazuje defaultVariant hardcoded; TSX renderuje `variant.h1`/`variant.h2` z SSR
- Marquee: PREVIEW ma pusty track (JS buildBrandsDOM); produkcja ma SSR loga od 0ms
- Logo Lottie: wymaga `Klient*.avif` plików w tym samym folderze co PREVIEW.html
- Logo OWOCNI Lottie: wymaga `/animations/LOGO_OWOCNI.json` lub serwera HTTP

## Minimalny standard akceptacji
- [ ] Layout bez FOUC / braków CSS
- [ ] Badge 20lat — animacja wejścia, hover, touch
- [ ] Badge Google — gwiazdki, hover
- [ ] Gradient OKLCH — startuje po ~2s (Faza 2)
- [ ] Laurel Lottie — otwiera się po ~300ms (desktop) / ~750ms (mobile)
- [ ] Trail — pojawia się po hover po ~4.5s od załadowania (desktop only)
- [ ] Marquee — motion (loga z JS buildBrandsDOM — placeholder picsum)
- [ ] Rainbow Letters H1 — hover na literach (desktop only)
- [ ] Pill plus — klik zmienia tekst jednorazowo
- [ ] CTA button — hover, press, pendulum canvas
- [ ] Season pill — tekst zgodny z porą roku

## Akcja
**AKCEPTUJĘ** lub **ODRZUCAM [powód]**
