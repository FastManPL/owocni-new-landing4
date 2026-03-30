# Finalna instrukcja dla developera — HERO DCI + montaż w React / Next

## 1. Cel
Hero ma działać w modelu:

- **treść = server-side**
- **animacje = client-side**

DCI obejmuje wyłącznie:
- `H1`
- `H2`
- `title`
- `meta description`
- `ogTitle`
- `ogDescription`

Nie obejmuje:
- badge text
- marquee text / marquee logos
- laurów
- Rainbow Letters
- logo / Lottie
- trail
- tła dekoracyjnego
- teasera sekcji 2

## 2. Pliki i ich role

### Edycja przez człowieka
`hero_variants_final_editable.csv`

To jest źródło robocze. Edytujemy tylko ten plik.

### Plik dla aplikacji
`heroVariants.generated.tsx`

To jest plik wynikowy dla React / Next.
Runtime używa tylko tego pliku.

## 3. Format danych

### CSV
W `h1_source` i `h2_source` dozwolone są tylko:
- `<strong>...</strong>`
- `<em>...</em>`
- `<br class="br-desktop">`

### TSX generated
W runtime Hero dostaje już gotowe JSX / ReactNode:
- `variant.h1`
- `variant.h2`

Nie renderujemy raw HTML stringów w runtime.

## 4. Resolver wariantu

Resolver działa synchronicznie i ma 3 poziomy fallbacku:

1. `keyword`
2. `group default` (przez `agid -> group_slug`)
3. `GLOBAL_DEFAULT`

Kolejność:
- `kw` → jeśli istnieje dokładny wariant keyworda, bierzemy go
- jeśli nie, próbujemy `agid` → mapujemy na `group_slug` → bierzemy `GROUP_DEFAULTS[group_slug]`
- jeśli nie, bierzemy `GLOBAL_DEFAULT`

### Uwaga
W pliku generated jest placeholder:
`AGID_TO_GROUP`

To trzeba uzupełnić realnymi ID z Google Ads.

## 5. Montaż w Next.js

### `page.tsx`
- `searchParams` traktujemy jako `Promise`
- robimy `await searchParams`
- wyciągamy `kw` i `agid`
- wywołujemy `resolveHeroVariant({ kw, agid })`
- przekazujemy `variant` do sekcji Hero

Przykład:

```tsx
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { kw, agid } = await searchParams
  const variant = resolveHeroVariant({ kw, agid })

  return <HeroSection variant={variant} />
}
```

### `generateMetadata()`
MUSI używać tego samego resolvera co `page.tsx`.

Przykład:
```tsx
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { kw, agid } = await searchParams
  const variant = resolveHeroVariant({ kw, agid })

  return {
    title: variant.metaTitle,
    description: variant.metaDescription,
    openGraph: {
      title: variant.ogTitle,
      description: variant.ogDescription,
    },
  }
}
```

## 6. Sekcja Hero — co ma przyjmować

Sekcja Hero ma przyjmować gotowy `variant`:

```tsx
type HeroSectionProps = {
  variant: HeroVariant
}
```

I renderować:
- `<h1 className="hero-title">{variant.h1}</h1>`
- `<p className="hero-description">{variant.h2}</p>`

Nie wolno:
- czytać URL w sekcji
- robić lookupu wariantu w sekcji
- swapować tekstu po hydracji
- renderować H1/H2 przez `dangerouslySetInnerHTML`

## 7. `br-desktop`

W H1/H2 mogą występować:
```html
<br class="br-desktop">
```

W runtime to już jest JSX:
```tsx
<br className="br-desktop" />
```

CSS sekcji Hero musi mieć:

```css
@media (max-width: 600px) {
  .br-desktop {
    display: none;
  }
}
```

Czyli:
- desktop / tablet > 600 px: break działa
- mobile ≤ 600 px: break znika

To jest część sekcji Hero, nie globalnego mechanizmu całej strony.

## 8. Badge'e i marquee

### Badge text
- ma być widoczny od pierwszego HTML response
- może mieć później polish animacyjny
- treść badge'a nie może być revealowana dopiero po JS

### Marquee
- track musi istnieć w HTML od startu
- logotypy muszą być w HTML od startu
- JS może uruchamiać tylko ruch
- zakaz pustego tracka zapełnianego dopiero przez JS

## 9. Hero engine

Silnik sekcji (`init(container)`, `kill()`) pozostaje odpowiedzialny wyłącznie za:
- laury
- marquee motion
- Rainbow Letters
- trail
- inne dekoracyjne animacje

Silnik NIE:
- robi DCI
- czyta URL
- swapuje H1/H2
- dopisuje breaków
- renderuje treści kampanii

## 10. Fonty

Dla Hero:
- Lexend Variable
- `next/font/google`
- `display: 'swap'`
- `adjustFontFallback: true`

Nie używamy `optional` dla głównego fontu Hero.

## 11. Czego NIE robić

- nie używać `useSearchParams()` w Hero
- nie używać `cache()` dla resolvera
- nie robić `resolveHeroVariant` jako `async`
- nie importować `Fragment`, jeśli używamy tylko `<>...</>`
- nie budować runtime parsera HTML
- nie używać `dangerouslySetInnerHTML`
- nie generować marquee logos przez JS, jeśli są above the fold
- nie robić `opacity: 0` na H1/H2/badge text/marquee content jako warunku istnienia treści

## 12. QA minimum przed wdrożeniem

Sprawdź ręcznie:
- 3–5 najdłuższych wariantów H1/H2
- desktop 1920
- desktop 1200
- tablet 768
- mobile 375
- mobile 320

Dodatkowo:
- czy `br-desktop` znika poniżej 600 px
- czy Hero nie ma client-side text swap
- czy marquee track nie jest pusty na starcie
- czy badge text jest od razu widoczny
- czy fallback działa:
  - exact keyword
  - brak keyword / group fallback
  - brak wszystkiego / global default
