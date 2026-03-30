# Patch do Konstytucji — HERO DCI / generated TSX / CSV workflow

## Cel patcha
Ten patch aktualizuje Konstytucję po zmianie architektury danych Hero:
- źródło robocze dla ludzi = CSV / arkusz
- źródło dla aplikacji = generated `.tsx`
- runtime Hero renderuje JSX / ReactNode, nie raw HTML stringi

---

## 1. F6 — doprecyzować
### Było
`generateMetadata()` generuje dynamiczne `<title>`, `<description>`, OG tags na podstawie wariantu.

### Nowa wersja
`generateMetadata()` MUSI używać tego samego resolvera wariantu co `page.tsx`.
DCI obejmuje:
- `H1`
- `H2`
- `title`
- `meta description`
- `ogTitle`
- `ogDescription`

Zakaz rozjazdu między treścią Hero i metadata.

---

## 2. F7 — zastąpić
### Było
`autoTier(headline): 'S' | 'M' | 'L'`

### Nowa wersja
Ta LP NIE używa auto-tieringu H1.
Zakaz:
- klientowego auto-tieringu
- MutationObserver do tekstu
- runtime text fittingu

Dozwolony jest wyłącznie ręczny art direction przez kontrolowane breaki w wariantach (`<br class="br-desktop">`).

---

## 3. F8 / F8.1 — doprecyzować
### Było
Dozwolony safe renderer dla kontrolowanych wariantów z inline markup.

### Nowa wersja
Dla tej implementacji preferowany model jest inny:

- **source format dla ludzi** może być prostym formatem tekstowym w CSV
- **plik wynikowy dla aplikacji** ma być generated `.tsx`
- runtime Hero renderuje **ReactNode / JSX**, nie raw HTML stringi

Dopuszczalny format w źródle roboczym:
- `<strong>`
- `<em>`
- `<br class="br-desktop">`

Safe renderer dla stringów pozostaje dozwoloną ścieżką awaryjną / przyszłym adapterem dla CMS, ale NIE jest preferowanym modelem tej implementacji.

---

## 4. F3 — doprecyzować fallback
### Było
`getVariant(searchParams)` z fallback do `defaultVariant`.

### Nowa wersja
Finalny fallback dla Hero DCI:
1. exact keyword
2. fallback grupy reklam
3. global default

Czyli:
`keyword -> group default -> global default`

Brak dopasowania nigdy nie może powodować pustego Hero ani błędu renderu.

---

## 5. F10 — zmienić
### Było
`getVariant()` owinięta w `React.cache()`.

### Nowa wersja
Dla tej implementacji resolver Hero jest synchroniczny i czyta dane ze statycznego generated `.tsx`.
`React.cache()` NIE jest wymagane i nie powinno być dodawane bez realnej potrzeby.
Resolver ma być prosty, synchroniczny i bez sugerowania nieistniejącego I/O.

---

## 6. A4 — doprecyzować
Zostaje:
- Lexend Variable
- `next/font/google`
- `display: 'swap'`
- `adjustFontFallback: true`

`optional` jest zakazane dla głównego fontu Hero.

---

## 7. A4.1 — doprecyzować
NoOrphans może działać na standardowych tekstach UI, ale nie zastępuje art direction Hero.
Breaki H1/H2 w DCI są kontrolowane przez warianty i CSS Hero (`.br-desktop`).

---

## 8. Nowa zasada — Above-the-fold informational content visible in first HTML response
W Hero:
- H1
- H2
- badge text
- marquee text
- marquee logos

muszą być obecne i widoczne w pierwszym HTML response.
Dozwolone są późniejsze animacje polish.
Zakaz delayed DOM generation tych elementów.

---

## 9. Nowa zasada — Hero local formatting contract
Hero obsługuje lokalnie tylko:
- `<strong>`
- `<em>`
- `<br class="br-desktop">`

To jest kontrakt lokalny sekcji Hero, nie globalny parser całej strony.

---

## 10. Nowa zasada — CSV -> generated TSX workflow
Źródło robocze dla ludzi:
- CSV / arkusz

Źródło dla aplikacji:
- generated `.tsx`

Generated plik jest artefaktem technicznym i nie powinien być głównym plikiem roboczym do ręcznej edycji copy.

---

## 11. Nowa zasada — No client-side DCI
Zakaz:
- client-side text swap
- client-side DCI w Hero
- czytania URL przez Hero engine
- mutowania treści H1/H2 przez engine

Treść jest rozwiązywana na serwerze, a engine sekcji odpowiada wyłącznie za animacje.

---

## 12. Nowa zasada — Marquee SSR-first
Track marquee i logotypy muszą istnieć w HTML od startu.
JS może uruchamiać tylko ruch.
Zakaz pustego tracka above the fold.

---

## 13. Nowa zasada — Hero / Section 2 boundary
Sekcja 2 może być częściowo widoczna jako teaser scrolla, ale pozostaje osobną sekcją.
Nie przejmuje priorytetu assetów Hero bez jawnej decyzji planu LCP.
