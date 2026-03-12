# DEVELOPER GUIDE — INTEGRACJA SEKCJI W CURSORZE

> Dla dewelopera który steruje LLM podczas integracji gotowych sekcji do Next.js.
> Czytasz to PRZED pierwszą sesją. Nie w trakcie gdy coś się sypie.

---

## Twoja rola

Jesteś **operatorem manifestu** — nie autorem animacji, nie debuggerem GSAP, nie architektem sekcji.

Wykonujesz SECTION_MANIFEST każdej sekcji 1:1. LLM w Cursorze jest Twoim narzędziem — ale to Ty jesteś ostatnią linią obrony przed złamaniem reguł.

---

## Zanim zaczniesz — przeczytaj to raz

### Co jest immutable (NIGDY nie edytujesz)

```
src/sections/**          ← cały katalog. Zero wyjątków.
src/lib/scrollRuntime.ts ← rdzeń scroll infrastruktury
src/components/SmoothScrollProvider.tsx
```

LLM nie wie że te pliki są immutable. **Ty wiesz.** Każdy diff który dotyka tych plików = odrzucasz natychmiast.

### Co jest Twoim obszarem roboczym

```
src/app/page.tsx                       ← tu wstawiasz sekcje
src/providers/ResourceHintsClient.tsx  ← tu idą resource hints ('use client', react-dom API)
src/providers/                         ← tu hook geometrii jeśli potrzebny
```

### Jedyne źródło prawdy

`SECTION_MANIFEST` każdej sekcji. Jeśli manifest czegoś nie mówi — nie robisz. Jeśli manifest jest niejasny — pytasz Fabrykę, nie zgadujesz.

---

## Środowisko — zanim napiszesz linię kodu

### Node 20 — wymóg, nie prośba

Vercel builduje na Node 20. Lokalnie Node 22/24 może zachowywać się inaczej w toolingu i typach.

```bash
# Sprawdź wersję:
node --version  # musi pokazać v20.x.x

# Jeśli masz nvm:
nvm use   # czyta .nvmrc z repo (musi być plik: echo "20" > .nvmrc)

# Jeśli używasz Volta:
volta pin node@20   # pin w package.json — automatyczne przy wejściu do katalogu
```

**`.nvmrc` w repo** (jednorazowe, raz na projekt):
```bash
echo "20" > .nvmrc
git add .nvmrc && git commit -m "pin: Node 20"
```

Nie uznawaj lokalnego builda jako PASS jeśli jesteś na Node 22/24.

### globals.css — prerequisite przed integracją pierwszej sekcji

Zanim dodasz jakąkolwiek sekcję — sprawdź `globals.css`:

```css
/* musi zawierać dokładnie to, jawnie: */
html { font-size: 16px; }
```

Jeśli nie ma → dodaj. Raz. Nie wracasz do tego.

**Dlaczego ważne:** Wszystkie sekcje są zaprojektowane i zaakceptowane w PREVIEW.html pod bazę 16px. Bez jawnej deklaracji wizualny drift jest możliwy (accessibility settings użytkownika). Z deklaracją — PREVIEW = produkcja = zero zaskoczenia.

### lenis.css — sprawdź ścieżkę przed startem

W `src/app/layout.tsx` MUSI być:
```typescript
import "lenis/dist/lenis.css";  // lub "lenis/lenis.css" dla Lenis 1.1+
```

**STOP:** jeśli projekt ma `html { height: 100% }` lub `body { height: 100% }` — Lenis CSS nadpisuje to przez `html { height: auto }`. Zgłoś do Fabryki przed kontynuacją.

---

## Struktura sesji

### Zasada: krótkie sesje, jeden obszar na raz

Długa sesja = LLM "zapomina" wcześniejsze ustalenia = zaczyna improwizować.

```
Sesja A  →  Sekcje statyczne (hero, cta, footer) — bez pin/snap
Sesja B  →  Sekcje z pinem lub snapem (stats, kinetic, accordion)
Sesja C  →  Resource hints i <head>
Sesja D  →  Weryfikacja finalna (build, scroll test, Network tab)
```

Każda sesja kończy się `npm run build` bez błędów zanim zaczniesz następną.

---

## Jak otworzyć każdą sesję

**Wklej to na początku każdej sesji Cursora — dosłownie:**

```
Pracujemy w trybie integracji sekcji LP Owocni.

Zasady nadrzędne (nienaruszalne):
1. src/sections/** jest immutable. Nigdy nie proponuj zmian w tych plikach.
   Jeśli coś wymaga zmiany wewnątrz sekcji → powiedz STOP i wyjaśnij co.
2. ScrollTrigger.refresh() jest zakazany. Jedyna legalna ścieżka:
   scrollRuntime.requestRefresh(reason).
3. window.__scroll tylko w bloku DEV.
4. Żadnych nowych zależności npm bez mojej jawnej akceptacji.
5. Resource hints tylko z SECTION_MANIFEST — nic ekstra.

Dokument z regułami integracji:
[wklej pełną treść P4_INTEGRATOR.md]

Manifest sekcji na tę sesję:
[wklej SECTION_MANIFEST dla sekcji które integrujesz dziś]

Aktualny stan page.tsx:
[wklej zawartość]

Aktualny stan package.json:
[wklej zawartość]
```

---

## Kolejność poleceń — nie skracaj tej drogi

### 1. Najpierw tylko plan

```
"Na podstawie wklejonych manifestów wygeneruj Integration Plan.
Nie generuj jeszcze żadnego kodu."
```

**Czytasz plan zanim powiesz cokolwiek więcej.** Sprawdzasz:

- [ ] Kolejność sekcji zgadza się z projektem strony
- [ ] dynamic import tylko tam gdzie manifest mówi `dynamicImport: true`
- [ ] Skeleton zdefiniowany dla każdej sekcji z `hasPin` lub `hasSnap`
- [ ] Resource hints zgadzają się pozycja po pozycji z manifestem
- [ ] Nie ma żadnych "ulepszeń" których nie ma w manifeście

Jeśli plan jest błędny — poprawiasz TERAZ. Zanim LLM napisze linię kodu.

### 2. Sekcja po sekcji

```
"Wygeneruj import i użycie sekcji [slug] w page.tsx.
Tylko tę sekcję, nic więcej."
```

**Czytasz diff przed Accept.** Sprawdzasz:

- [ ] Import z `src/sections/[slug]/[Slug]Section`
- [ ] Żaden plik w `src/sections/**` nie jest modyfikowany
- [ ] Jeśli dynamic import: `ssr: false` gdy `clientOnly: true` (obowiązkowe)
- [ ] Jeśli `clientOnly: false` — NIE zmieniaj ssr samodzielnie. Wykonaj 1:1 wg manifestu. Wątpliwość → STOP.
- [ ] Jeśli dynamic import + pin/snap: skeleton obecny (nie `aria-hidden` bez `minHeight`)
- [ ] Props tylko te z `dciProps` w manifeście — zero ekstra

### 3. Resource hints osobno

```
"Dodaj resource hints dla sekcji [slug] do ResourceHintsClient.tsx
wg perf.resourceHints z manifestu [slug] — tylko to co jest w manifeście."
```

**Sprawdzasz:**

- [ ] Plik to `src/providers/ResourceHintsClient.tsx` z `'use client'`
- [ ] Import: `import { preconnect, preload, prefetchDNS } from 'react-dom'`
- [ ] preconnect tylko dla domen z `preconnectDomains[]` w manifeście
- [ ] preload tylko dla assetów z `preloadCandidates[]` (HOT)
- [ ] prefetchDNS tylko dla `prefetchDnsDomains[]` (DNS-only)
- [ ] prefetchCandidates[] → useEffect z dedupe — nie prefetchDNS
- [ ] cold = nic nie dodajesz
- [ ] Marketing/analityka (sGTM, GA): DNS-only (`prefetchDNS`), nie `preconnect` — chyba że manifest jawnie mówi inaczej

### 4. Hook geometrii (jeśli potrzebny)

Tylko gdy manifest mówi `geometryMutable: true` AND `geometryRefresh: 'none'`:

```
"Dodaj useGeometryRefresh('[slug]-section') w client boundary.
Nie w page.tsx — page.tsx jest Server Component."
```

**Sprawdzasz:**

- [ ] Hook żyje w pliku z `'use client'`
- [ ] `page.tsx` nie został zmodyfikowany

---

## Czerwone flagi — odrzucasz bez dyskusji

| Co LLM proponuje | Dlaczego błąd | Co robisz |
|---|---|---|
| Edycja pliku w `src/sections/**` | Sekcje są immutable | Odrzuć diff, STOP → Fabryka |
| `ScrollTrigger.refresh()` | Pomija debounce, może odpalić przed init | Odrzuć, przypomnij regułę |
| `gsap.registerPlugin()` w layout/page/providerach | Rozmywa zależności sekcji | Odrzuć |
| `gsap.registerPlugin()` na module top-level pliku TSX | SSR crash — window nie istnieje przy pre-render | Odrzuć, STOP → Fabryka (J13) |
| `useGeometryRefresh` w `page.tsx` | Server Component, błąd runtime | Odrzuć, wskaż client boundary |
| `content-visibility: auto` na sekcji z ST | Psuje obliczenia ScrollTrigger | Odrzuć |
| Nowa paczka w `package.json` | Wymaga jawnej akceptacji | Zatrzymaj, pytasz Fabrykę |
| `html { font-size }` w CSS sekcji lub globals | Łamie HTML-FONTSIZE-01 (B4.1) — PREVIEW ≠ prod | Odrzuć, STOP → Fabryka |
| `next/head` | Nie używamy — resource hints tylko przez `ResourceHintsClient` | Odrzuć |
| preconnect dla sGTM/GA bez manifestu | Kradnie LCP connection slots | Odrzuć |
| `window.__scroll` w kodzie produkcyjnym | Tylko DEV | Odrzuć |
| `import dynamic` dla hero | Hero nigdy nie dostaje dynamic import | Odrzuć |
| Skeleton `'none'` dla sekcji z pinem | CLS + pin jump przy pierwszym scrollu | STOP → Fabryka |

---

## TypeScript Gate — PRZED każdym commitem i pushem

**Vercel nie jest kompilatorem TypeScript. Ty jesteś.**

`npm run dev` jest tolerancyjny — TypeScript transpiluje, nie kompiluje ściśle. Błędy typów nie blokują lokalnego devserwera. `npm run build` (i Vercel) uruchamia pełny compiler w trybie strict — i pada na pierwszym błędzie.

Klasyczny pattern: działa lokalnie → wybucha na Vercelu trzy razy z rzędu bo każdy deploy naprawia jeden błąd.

**Przed każdym `git push` uruchamiasz:**

```bash
npx tsc --noEmit
```

Oczekiwany wynik: `0 errors`. Jeśli są błędy — naprawiasz wszystkie naraz lokalnie, jeden commit, jeden deploy.

**Najczęstsze TypeScript błędy z sekcji Fabryki:**

| Błąd | Przyczyna | Fix |
|---|---|---|
| `Parameter 'container' implicitly has an 'any' type` | Brak typu parametru init() | `container: HTMLElement` w sygnaturze |
| `'X' is possibly 'null'` | querySelector może zwrócić null (wynik, nie container) | `const el = $(...); if (!el) return;` albo `$(...)?. ...` |
| `Parameter 'sel' implicitly has an 'any' type` | Helper bez typu | `sel: string` |
| `Parameter 'id' implicitly has an 'any' type` | Helper bez typu | `id: string` |

> **Uwaga:** `container` w init() jest `HTMLElement` (non-null kontrakt) — nie dodajesz `if (!container)` wewnątrz init(). Guard na null dotyczy wyników querySelector wewnątrz init(), nie samego parametru `container`.

Jeśli te błędy wychodzą z `src/sections/**` — **nie naprawiasz ich sam**. To jest błąd Fabryki (P3 nie dodało typów). STOP → zgłoś do Fabryki z dokładnym błędem z `npx tsc --noEmit`.

---

## Weryfikacja po każdej sekcji

Nie akumulujesz błędów. Po każdej dodanej sekcji:

```bash
npm run dev
```

Otwierasz stronę, scrollujesz przez nową sekcję. Przechodzisz Console Gate poniżej. Zero błędów przed kolejną sekcją.

**Reguła: jedna sekcja na commit.** 1 slug → weryfikacja → commit → następna. Nie integruj 3 sekcji w jednym diffie.

---

## Console Gate (po każdej sekcji — ZANIM przejdziesz dalej)

Otwierasz DevTools → Console. Ustaw raz na początku całej integracji:

- [ ] Preserve log = ON
- [ ] Disable cache (Network tab) = ON
- [ ] Filtr: Errors + Warnings

**PASS:** 0 błędów (Errors). Warnings tylko jeśli znane i zaakceptowane.

**FAIL:** jakikolwiek `Uncaught`, `Hydration`, `TypeError`, `ReferenceError`, `Cannot read properties…`

**Gdy FAIL — co robisz:**

| Błąd w konsoli | Reakcja |
|---|---|
| `Hydration failed` / mismatch | STOP → sprawdź client boundary, dynamic import, duplikat id |
| `ScrollTrigger is not defined` / `Please gsap.registerPlugin` | STOP → Fabryka (kontrakt sekcji/pluginu) |
| `Cannot read properties of null (querySelector)` | STOP → Fabryka (sekcja zakłada inny DOM) |
| `Module not found` | Naprawiasz import path — NIE dotykasz `src/sections/**` |
| Cokolwiek z GSAP / timeline / SplitText / cleanup | STOP → Fabryka |
| `Type error` / `implicitly has an 'any' type` / `is possibly 'null'` | STOP → Fabryka (brakujące typy w init()) — nie naprawiasz w src/sections |

---

## Grep Gates (po każdej sesji — 30 sekund, uruchamiasz w terminalu)

```bash
# 0) TypeScript strict — PIERWSZA BRAMKA, przed wszystkim innym
npx tsc --noEmit
# Oczekiwane: 0 errors. Jakikolwiek błąd → napraw ZANIM pushujesz.

# 1) Zakaz ScrollTrigger.refresh() w integracji
rg "ScrollTrigger\.refresh\(" src -S

# 2) Zakaz window.__scroll w prod
rg "window\.__scroll" src -S

# 3) Czy cokolwiek dotknęło src/sections (NIE MOŻE)
git diff --name-only | rg "^src/sections/"

# 4) Zakaz content-visibility: auto na sekcjach z ScrollTrigger
rg "content-visibility:\s*auto" src -S
```

**Oczekiwany wynik każdego grep: brak wyników (puste wyjście).**
Jeśli którykolwiek zwraca wynik → STOP, cofnij zmianę, wróć do Fabryki.

---

## Asset Pipeline — diagnoza obrazków (60 sekund)

Gdy widzisz PNG zamiast AVIF/WebP, lub obrazek z innego URL niż oczekujesz:

```
1. DevTools → Network → kliknij obraz
   Sprawdź: Request URL + Content-Type w Response headers

2. Jeśli Content-Type: image/png
   → rg "\.png" src -S
   → rg "background-image:.*png" src -S
   → sprawdź public/ — stary PNG pod tym samym basename?

3. Jeśli Content-Type: image/webp, oczekujesz avif
   → sprawdź next.config.js:
     images: { formats: ['image/avif', 'image/webp'] }
     avif MUSI być pierwszy — Next.js negocjuje przez Accept header
```

**next.config.js — wymagana konfiguracja obrazków:**
```javascript
images: {
  formats: ['image/avif', 'image/webp'],  // kolejność = priorytet
  // avif pierwszy = Chrome/Safari dostają avif, starsze WebP, najstarsze oryginał
}
```

**Uwaga:** "Zapisz obraz jako..." w przeglądarce zawsze zapisuje jako PNG — to nie jest błąd projektu.

---

## Weryfikacja finalna (Sesja D)

```bash
# Na Node 20 — sprawdź przed startem:
node --version  # musi pokazać v20.x.x

npx tsc --noEmit  # PIERWSZA — TypeScript strict, 0 errors
npm run lint      # musi przejść: 0 errors
npm run build     # musi przejść: 0 errors — bramka finalna przed Vercel
npm run start     # sprawdź lokalnie na :3000
```

Następnie manualnie w przeglądarce (`npm run start`):

```
[ ] window.__scroll?.isReady?.() === true  (DEV console)
[ ] Scroll przez całą stronę: brak jittera na pinach
[ ] Brak "odpływania" snapów po sekcjach z accordionami
[ ] Rotacja mobile → layout poprawny → ScrollTrigger start/end poprawne (nie "frozen")
[ ] Network tab → obrazki: Content-Type = avif lub webp (NIE png/jpeg)
[ ] Network tab → brak requestów do fonts.googleapis.com w produkcji
[ ] Network tab → resource hints z <head> odpowiadają manifestom
[ ] Nowe pakiety w package.json: brak (lub każdy jawnie zaakceptowany)
[ ] Console → 0 Errors, 0 unexpected Warnings
```

Dla każdej sekcji z `hasPin: true` lub `hasSnap: true`:

```
[ ] stack.html harnessu przeszedł testy:
    - pin above + accordion below + refresh
    - scroll przez pinned region bez skoku sekcji
```

---

## Eskalacja — kiedy idziesz do Fabryki

```
LLM sugeruje zmianę wewnątrz src/sections/**
→ STOP → Fabryka

Coś w sekcji nie działa (timing / snap / GSAP / cleanup)
→ STOP → Fabryka (nie naprawiasz sam)

Manifest niekompletny lub dwa pola się kłócą
→ STOP → Fabryka

Problem w scrollRuntime / SmoothScrollProvider
→ Formalna poprawka do Konstytucji (Amendment) + review

Pojawia się pattern którego P4_INTEGRATOR.md nie opisuje
→ STOP: nie improwizujesz, pytasz
```

---

## Jeden akapit dla nowego dewelopera

Sekcje które integrujesz są gotowymi artefaktami — jak elementy prefabrykowane. Twoja praca to złożenie ich w stronie zgodnie z instrukcją (manifestem). Nie oceniasz czy animacja mogłaby być szybsza, nie "naprawiasz" CSS który wygląda dziwnie, nie dodajesz pluginów bo "i tak są używane gdzie indziej". LLM w Cursorze będzie Ci stale proponował skróty i "ulepszenia" — bo tak jest zaprojektowany. Twoja jedyna rola to trzymać granicę: manifest jest prawdą, `src/sections/**` jest nietykalny, każdy diff czytasz zanim klikniesz Accept.
