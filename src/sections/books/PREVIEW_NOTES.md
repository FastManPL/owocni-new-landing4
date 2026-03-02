# PREVIEW_NOTES — book-stats

## Gwarancje PREVIEW.html

| Aspekt | Status |
|--------|--------|
| init(container) kod | ✅ IDENTYCZNY z BookStatsSection.tsx |
| CSS | ✅ IDENTYCZNY z book-stats.css |
| HTML struktura | ✅ IDENTYCZNY z JSX (bez React wrapper) |
| GSAP plugins registered | ✅ ScrollTrigger |
| scrollRuntime stub | ✅ 120ms debounce na ST.refresh() |

---

## Różnice vs reference.html

| Element | reference.html | PREVIEW.html |
|---------|----------------|--------------|
| scrollRuntime | undefined (no-op) | stub z window.scrollY |
| getScroll() | `window.lenis ? ... : window.scrollY` | `scrollRuntime.scroll()` |
| requestRefresh() | no-op (undefined) | console.log + ST.refresh() |

---

## Ograniczenia PREVIEW

1. **Brak Lenis** — scrollRuntime stub używa `window.scrollY`, nie smooth scroll
2. **Brak SSR** — React hydration nie jest testowana
3. **Placeholder frames** — generowane canvas, nie prawdziwe obrazy
4. **Brak production frame loader** — sekcja PRODUCTION PATTERN zakomentowana

---

## Kryteria akceptacji

### Wizualne (pixel-perfect vs reference.html)

- [ ] Canvas frame sequence animuje przez 23 klatek
- [ ] Pin na `.cs-floor--images` działa poprawnie
- [ ] Counter reels spin do właściwych wartości (53%, 39%, 10h)
- [ ] Heading sweep animacja (bounce.out) odpala po spin
- [ ] Opacity fade-in na counter rows (staggered 180ms)

### Lifecycle

- [ ] `window.bookStatsSection.kill()` czyści wszystko (brak błędów w console)
- [ ] `window.bookStatsSection.pause()` zatrzymuje ScrollTrigger
- [ ] `window.bookStatsSection.resume()` wznawia ScrollTrigger
- [ ] Reinit działa (kill → init → sekcja działa)

### Responsywność

- [ ] Desktop (>991px): layout dwukolumnowy
- [ ] Tablet (768-991px): mniejsze fonty
- [ ] Mobile (<767px): layout pionowy, zmiana kolejności
- [ ] Small mobile (<480px): divider ukryty

---

## DEVELOPER_HANDOFF — Testy przed deploy

### 1. Smoke test w repo (Next.js)

```bash
npm run dev
# Otwórz stronę z BookStatsSection
# Sprawdź: sekcja renderuje, scroll działa
```

### 2. StrictMode verification

React 18+ StrictMode wywołuje init/cleanup dwukrotnie. Sprawdź:
- Brak podwójnych animacji
- Brak memory leak (DevTools → Performance → Memory)
- Console czyste (brak błędów)

### 3. Production frame loader

Odkomentuj sekcję `PRODUCTION PATTERN` w init() i przetestuj z prawdziwymi frame'ami:
- Binary subdivision load order
- Progressive quality improvement
- Graceful degradation (missing frames)

### 4. Integration tests

W stack.html (P2B):
- Accordion expand/collapse — pin stability
- FakePinnedAbove — pin poniżej innego pinu
- Height change above — geometry drift

---

## Checksums

| Plik | Linie kodu | Rozmiar |
|------|------------|---------|
| BookStatsSection.tsx | ~520 | mechaniczna konwersja |
| book-stats.css | ~440 | kopia 1:1 |
| PREVIEW.html | ~700 | test shell |

---

## Version

- **P3 Factory:** 2025-03-02
- **Source:** book-stats_reference__4_.html
- **Manifest:** book-stats.MANIFEST.FINAL.txt
