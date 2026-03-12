# DEVELOPER HANDOFF — fakty

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ **TS-BUILD-GATE-01**: Vercel nie jest kompilatorem TypeScript — błędy TS wykrywa dopiero na buildzie
produkcyjnym. Każdy failed deploy = stracony czas i kolejny commit tylko po to żeby
naprawić jeden błąd który tsc złapałby w 10 sekund.

⛔ P3 nie wydaje DEVELOPER_HANDOFF dopóki te komendy nie przejdą lokalnie z wynikiem 0 errors:

```bash
npx tsc --noEmit  # → PIERWSZY. Zero errors = możesz iść dalej.
npm run build     # → drugi. Weryfikuje bundle, optymalizacje, static gen.
npm run lint      # → trzeci. Styl i reguły ESLint.
```

Kolejność nieprzypadkowa: tsc jest najszybszy i łapie 90% błędów które rozbiją build na Vercel.

---

## Framework prerequisites (przed wdrożeniem pierwszej sekcji)

- [ ] `@/lib/scrollRuntime` istnieje i eksportuje kontrakt:
  - `getScroll(): number`
  - `getRawScroll(): number`
  - `requestRefresh(reason: string): void`
  
  Bez tego każda sekcja z P3 padnie na build lub będzie działać inaczej niż PREVIEW/harness.

- [ ] `globals.css` zawiera `html { font-size: 16px; }` — zamrożona baza typografii.
  PREVIEW generowany przez P3 używa tej samej wartości.

---

## P3 zweryfikowało przed wydaniem (nie sprawdzaj ponownie — zaufaj STOP gates)

Poniższe zostały zweryfikowane przez P3 jako STOP gates. Jeśli `tsc --noEmit` = 0 errors, są gwarantowane:

- ✅ `gsap.registerPlugin()` WEWNĄTRZ useGSAP (GSAP-SSR-01)
- ✅ init() sygnatura: `function init(container: HTMLElement): { kill: () => void }`
- ✅ Helpery typowane: `const $id = (id: string) => ...`
- ✅ Zero dead code (write-only vars, nieużyte funkcje, nieużyte importy)
- ✅ Null guardy: querySelector/array z optional chain lub guard przed użyciem
- ✅ Null guard TYLKO w call-site — nie wewnątrz init()
- ✅ `isolation: isolate` NIE jest inline w JSX
- ✅ `kill()` ma guard idempotencji (`isKilled` flag)

---

## Wymaga weryfikacji przez dewelopera (runtime lub wzrokowej)

- [ ] `npx tsc --noEmit` = 0 errors — uruchom sam, potwierdź
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] PREVIEW.html otworzony w przeglądarce → wizualnie identyczne z reference.html → **AKCEPTUJĘ**
- [ ] `npm run dev` → React StrictMode: konsola bez błędów po 2× mount/unmount (podwójne init/cleanup)
- [ ] GSAP 3.12.7 smoke test: przewiń przez sekcję — animacje działają bez skoku

---

## Pliki frame sekwencji

Sekcja wymaga **34 par plików** w folderze `public/frames/`:

```
public/frames/
├── fakty-01.avif    ← pregenerowany AVIF
├── fakty-01.webp    ← pregenerowany WebP (fallback)
├── fakty-02.avif
├── fakty-02.webp
├── ...
├── fakty-34.avif
└── fakty-34.webp
```

**Łącznie 68 plików** (34 × 2 formaty)

Skrypt `check-frames.bat` sprawdza kompletność.

---

## Architektura obrazów

### Źródło
- Statyczne pliki w `public/frames/`
- Ręcznie przygotowane — **zero konwersji przez Next.js**
- **Nie używamy** `next/image`, `getImageProps()`, `_next/image`

### Format negotiation — CSS `image-set()`

```css
background-image: image-set(
  url('/frames/fakty-01.avif') type('image/avif'),
  url('/frames/fakty-01.webp') type('image/webp')
);
```

**Przeglądarka sama wybiera format** — AVIF jeśli obsługuje, WebP jako fallback.

### Feature detection

```javascript
const supportsImageSet = CSS.supports('background-image', 'image-set(url("x.webp") type("image/webp"))');
```

Dla starych przeglądarek (< Chrome/Firefox 89): fallback na `url('/frames/...webp')`.

### Bez ręcznego preloadu

Sekcja **nie preloaduje** obrazów przez JS. Przeglądarka ładuje przez CSS.
`visibilitychange` listener wymusza re-apply frame po powrocie do karty.

### Graceful degradation

CSS używa dwóch warstw `background-image`: obraz wideo + czarny gradient fallback. Gdy obraz pending/failed → czarny tekst widoczny.

---

## Parametry animacji

| Parametr | Wartość |
|----------|---------|
| `FRAME_COUNT` | 34 |
| `START_PCT` | 66 |

---

## Bug fixy (tab switch problem)

**FIX 1: CSS fallback — dwie warstwy background-image**
```css
/* Warstwa 1: obraz wideo, Warstwa 2: czarny fallback (zawsze widoczny gdy obraz pending/failed) */
background-image: var(--current-frame-url), linear-gradient(#0a0a0c, #0a0a0c);
background-repeat: no-repeat, no-repeat;
```
```javascript
// setupVideoFill() — wartości dla obu warstw:
el.style.backgroundSize = blockW + 'px ' + frameH + 'px, cover';
el.style.backgroundPosition = (-co.x) + 'px ' + (-co.y) + 'px, center';
```

**FIX 2: Visibility change listener**
```typescript
document.addEventListener('visibilitychange', onVisibilityChange);
```
Wymusza re-apply frame po powrocie do karty przeglądarki.

---

## Conditional unmount

N/A — sekcja nie ma `hasPin` ani `hasSnap`, więc warunkowe usuwanie z DOM nie wymaga dodatkowego refresh.

---

## Ograniczenie PREVIEW

**Brak** — sekcja jest Typ A (ST-native), nie używa velocity/physics.
PREVIEW = pełna weryfikacja layout + animacje.

---

## Integracja z Lenis (opcjonalna)

PREVIEW zawiera integrację Lenis dla testowania smooth scroll.
W produkcji Lenis jest zarządzany przez `scrollRuntime.ts`.

Wersja `fakty.PREVIEW-noLenis.html` dostępna dla debug bez smooth scroll.

---

## Status

**Claude**: DONE (AKCEPTUJĘ na PREVIEW uzyskano)
**Deweloper**: potwierdza 0 errors przed wdrożeniem do repo
