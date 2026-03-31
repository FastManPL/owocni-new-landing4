# DEVELOPER HANDOFF — final

## Komendy weryfikacyjne — uruchom LOKALNIE przed każdym git push

⚠️ TS-BUILD-GATE-01: Vercel nie jest kompilatorem TypeScript.

```bash
npx tsc --noEmit   # PIERWSZY — zero errors = możesz iść dalej
npm run build      # drugi — bundle, optymalizacje, static gen
npm run lint       # trzeci — ESLint
```

## Framework prerequisites

- [ ] `@/lib/scrollRuntime` eksportuje:
  ```typescript
  getScroll(): number
  getRawScroll(): number
  requestRefresh(reason: string): void
  ```
- [ ] `@gsap/react` zainstalowany (`npm install @gsap/react`)
- [ ] `three@0.160.0` zainstalowany (`npm install three@0.160.0`)
- [ ] `globals.css` zawiera `html { font-size: 16px; }`

## Pliki do repo

```
src/sections/final/FinalSection.tsx    ← wrapper z next/dynamic
src/sections/final/FinalEngine.tsx     ← komponent z init() + useGSAP
src/sections/final/final-section.css  ← CSS sekcji
```

## Pliki NIE do repo

```
final.PREVIEW.html
final.PREVIEW_NOTES.md
DEVELOPER_HANDOFF.md
P2A_EVIDENCE_PACK.md
P2B_MANIFEST.md
```

## Import w SectionsClient / layout

```typescript
import { FinalSection } from '@/sections/final/FinalSection';
// named export — mode: 'named'
```

## P3 zweryfikowało (STOP gates)

- `dynamicImport: true` — FinalEngine w next/dynamic z `ssr: false`
- Brak `gsap.registerPlugin()` — sekcja nie używa pluginów GSAP
- `init()` sygnatura: `function init(container: HTMLElement): { pause, resume, kill }`
- Helpery typowane: `$ = (sel: string)`, `$$ = (sel: string)`, `$id = (id: string)`
- Dead code usunięty: `var getScroll` (nigdy niewywoływany)
- `kill()` idempotentny: `isKilled` + `_s._killed` guard
- `window._finalInit` / `window._finalRef` — auto-init pattern w harness. **Nie wchodzą do repo** — są poza markerami DEV overlay, w bootstrap sekcji `<script>` który P3 usuwa.
- `window._finalMeta` — debug metadata za `if(DEBUG_MODE)` guardem — zostaje w init()
- Null guardy: `if(!cardEl) return` w positionCard, `entries[0]?.isIntersecting` w IO
- isolation: isolate NIE jest inline w JSX (brak w P2A CSS — OWNER-DECISION-PENDING)

## Wymaga weryfikacji przez dewelopera

- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 0 errors
- [ ] `npm run lint` = 0 errors
- [ ] `final.PREVIEW.html` otwarty w przeglądarce → wizualnie OK → **AKCEPTUJĘ**
- [ ] `npm run dev` → React StrictMode: konsola bez błędów po 2× mount/unmount
- [ ] Przewiń przez sekcję — sticky reveal działa, WebGL renderuje
- [ ] Zegar tyka, szkło badge'a widoczne (transmission)
- [ ] Mobile: tap na karcie = slide up/down

## Uwagi specjalne WebGL

**transmission:1.0 na wszystkich urządzeniach.**
Nie zamieniaj na `transparent:true` — demoluje shader compilation cache (onBeforeCompile + Ctrl+F5 = ghost glass).

**Three.js version lock.**
`onBeforeCompile` robi `.replace('#include <tonemapping_fragment>', ...)`.
Po aktualizacji Three.js: zawsze sprawdź szkło wizualnie.

**dispMap base64 = 4418 znaków.**
Nie skracaj — krótka mapa = brak efektu dissolve cyfr zegara.

**requestIdleCallback warmup.**
Faza 2 (timeout 1000ms) + Faza 3 (timeout 2000ms). Na słabych GPU może potrzebować pełnych 3s przed odsłonięciem sekcji. To normalne — warmup jest celowo opóźniony żeby nie blokować strony.

## Runtime checks P2B — status z sesji

| Test | Status | Metoda |
|------|--------|--------|
| CLN-01 (KILL leak) | ASSUMED PASS | Testowane wielokrotnie w sesji |
| SM-01 (REINIT 3×) | ASSUMED PASS | Testowane przez debug overlay |
| WGL-01 (cold start) | ASSUMED PASS | Testowane przy otwieraniu strony |
| WGL-02 (bg tab pause) | ASSUMED PASS | Testowane przez visibilitychange |

Zalecane: wykonaj formalne testy w `final.stack.html` przed deploy do produkcji.

## Status

```
=== FACTORY HANDOFF ===
Step completed:  P3 (React Conversion)
Decision:        PROCEED — czeka na AKCEPTUJĘ PREVIEW + weryfikację techniczną

slug:            final
type:            B
dynamic_import:  TAK
fouc_inline:     brak gsap.from literałów
splittext:       NIE
gsap_plugins:    BRAK
three_version:   0.160.0
```
