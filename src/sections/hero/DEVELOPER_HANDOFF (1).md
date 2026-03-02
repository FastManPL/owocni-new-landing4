# DEVELOPER HANDOFF — hero

## Komendy weryfikacyjne (uruchom przed wdrożeniem)

```bash
npm run build    # oczekiwane: 0 errors
npm run lint     # oczekiwane: 0 errors
npx tsc --noEmit # oczekiwane: 0 errors
```

## Framework prerequisites (przed wdrożeniem)

- [ ] `@/lib/scrollRuntime` istnieje i eksportuje kontrakt:
  ```typescript
  getScroll(): number
  getRawScroll(): number
  requestRefresh(reason: string): void
  ```
- [ ] `@gsap/react` zainstalowany (`npm install @gsap/react`)
- [ ] `lottie-web` zainstalowany (`npm install lottie-web`)
- [ ] GSAP 3.12.7 (`npm install gsap@3.12.7`)

## Checklisty manualne

### Import / Structure
- [ ] Import paths poprawne (`@/` aliasy)
- [ ] CSS importowany w komponencie
- [ ] scrollRuntime importowany z modułu (nie window.*)
- [ ] lottie importowany z `lottie-web`

### useGSAP Pattern
- [ ] useGSAP z `{ scope: rootRef }` — wzorzec:
  ```tsx
  useGSAP(() => {
    const el = rootRef.current;
    if (!el) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error('[P3] rootRef.current is null');
      }
      return;
    }
    const inst = heroSectionInit(el);
    return () => inst?.kill?.();
  }, { scope: rootRef })
  ```
- [ ] Cleanup return w useGSAP

### P3 Bramki
- [ ] P3-CLEAN-01: kill() ma guard idempotencji (`_killed` flag) — ✅ DODANE
- [ ] B-LC-RET-01: init() zwraca `{ pause, resume, kill }` we WSZYSTKICH ścieżkach wyjścia
- [ ] LIB-GLOBAL-01: brak `window.gsap` / `window.lenis` w kodzie komponentu
  ```bash
  grep -c "window\.gsap\|window\.lenis\|window\.scrollRuntime" HeroSection.tsx
  # oczekiwane: 0
  ```
- [ ] Isolation nie jest inline:
  ```bash
  grep "isolation" HeroSection.tsx
  # wynik: pusty lub tylko w komentarzach
  ```

### CSS Scoping
- [ ] Selektory w hero-section.css zakorzenione w `#hero-section`
- [ ] Brak globalnych selektorów bez zakorzenienia (wyjątki: `@keyframes`, `@property`)

### Assets wymagane przed deployem
- [ ] `/public/animations/LOGO_OWOCNI.json` — konwersja z .lottie
- [ ] `/public/animations/laury-left.json` i `laury-right.json`
- [ ] `/public/trail/` — zdjęcia trail (AVIF + WebP fallback)
- [ ] Assets marquee brands

### React StrictMode Test
- [ ] `npm run dev` → StrictMode montuje komponenty dwukrotnie
- [ ] Konsola bez błędów po 2× mount/unmount
- [ ] Brak duplikatów tickerów ani memory leaks

### GSAP Smoke Test
```bash
# Sprawdź że GSAP 3.12.7 jest zainstalowany
npm ls gsap
# oczekiwane: gsap@3.12.7
```

## Pliki do repo

```
src/sections/hero/
├── HeroSection.tsx      # komponent React
├── hero-section.css     # style (literalna kopia)
└── hero.manifest.ts     # (istniejący z P2B)
```

## Pliki NIE do repo

```
hero.PREVIEW.html        # tylko do weryfikacji
hero.PREVIEW_NOTES.md    # dokumentacja preview
DEVELOPER_HANDOFF.md     # ten plik
```

## Specjalne uwagi

### PERF-W6 (3 per-frame callbacks)
Sekcja ma 3 tickery (trail.tick, pendulum.update, halo.rAF) + lottie-web internal rAF.
Każdy gated osobno przez IO — akceptowalne per P2A.

### PERF-W14 (@keyframes hero-badgeGoogleAspectWarp)
Animuje `width: 48px → 175px` — jednorazowe, forwards fill.
Rozważyć `transform: scaleX()` w V2 (poza scope P3).

### HAAT (Hybrydowa Architektura Auto-Skalowania Typografii)
- Faza 1 (server-side): wymaga RSC logic w layout/page
- Faza 2 (client-side): wymaga `useLayoutEffect` w komponencie content
- W obecnej wersji: tiery kopiowane z `<html>` data attributes
- TODO: Zintegrować z Next.js RSC w przyszłej iteracji

### Lottie Format
- `lottie-web@5.12.2` obsługuje TYLKO JSON
- `LOGO_OWOCNI.lottie` = DotLottie (ZIP) → wymaga konwersji do `.json`
- Narzędzie: https://lottiefiles.com/tools lub CLI dotlottie-js

## Status

**Claude**: DONE (AKCEPTUJĘ na PREVIEW oczekiwane)  
**Deweloper**: potwierdza 0 errors przed wdrożeniem do repo

---

## Key State (dla Factory tracking)

```
slug            = hero
type            = B
dynamic_import  = NIE
fouc_inline     = 0 (selektory klasowe — pominięte)
splittext       = NIE
hasPin          = NIE
hasSnap         = NIE
hasScrollTrigger= NIE
perf_warnings   = PERF-W6, PERF-W14
p3_clean_01     = ✅ DODANE (_killed guard)
```
