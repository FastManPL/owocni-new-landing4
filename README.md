# LP Project — Faza 0 (v2)

**Stack:** Next.js 16.1.6 · React 19 · Tailwind 3.4 · GSAP 3.12 · Lenis 1.1  
**Node:** 20.x (determinizm via `.nvmrc`)

---

## STRUKTURA PLIKÓW

```
project-root/
├── package.json
├── .nvmrc                    ← Node version pinning
├── .gitignore
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs         ← ESLint 9 Flat Config
├── tailwind.config.ts
├── postcss.config.mjs
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx        ← Fonty, SmoothScrollProvider
    │   ├── page.tsx
    │   └── loading.tsx
    ├── components/
    │   └── SmoothScrollProvider.tsx
    ├── lib/
    │   └── scrollRuntime.ts  ← Singleton Lenis + GSAP ticker
    ├── types/
    │   └── global.d.ts
    ├── hooks/                ← Puste, gotowe na useGeometryRefresh etc.
    ├── config/               ← Puste, gotowe na *.config.ts sekcji
    └── sections/
        ├── hero/
        ├── bridge-sequence/
        └── walk/
```

---

## CHECKLIST PO WKLEJENIU

```bash
# 1. Ustaw Node version
nvm use  # lub: nvm install 20.11.1

# 2. Zainstaluj zależności
npm install

# 3. Uruchom dev server
npm run dev

# 4. Sprawdź w przeglądarce:
#    - Scroll jest płynny (Lenis)
#    - DevTools Console: window.__scroll.isReady() === true
#    - Font Lexend działa (font-brand)
#    - Tło #f7f6f4 (bg-canvas)

# 5. Typecheck (opcjonalnie)
npm run typecheck

# 6. Lint
npm run lint
```

---

## RÓŻNICE vs FAZA 0 v1

| Element | v1 | v2 |
|---------|----|----|
| Node engines | `>=20.9.0` | `20.x` + `.nvmrc` |
| Skrypty | brak webpack fallback | `dev:webpack`, `build:webpack` |
| Skrypty | brak typecheck | `typecheck` |
| ESLint | direct import | FlatCompat (poprawna składnia) |
| Tailwind | brak future flags | `hoverOnlyWhenSupported: true` |
| CSS | brak overscroll | `overscroll-behavior: none` |
| scrollRuntime | brak resize handler | resize handler z debounce |
| scrollRuntime | requestRefresh no-op przed init | pending queue |
| next.config | brak poweredByHeader | `poweredByHeader: false` |
| layout.tsx | GTM wyłączony bez env | `NEXT_PUBLIC_GTM_*` → dns-prefetch, bootstrap I1, `GtmLazy` (I7) |

---

## TODO PRZED PRODUKCJĄ

1. **GTM / sGTM:** ustaw `NEXT_PUBLIC_GTM_CONTAINER_ID` lub `NEXT_PUBLIC_GTM_SCRIPT_URL` (`.env.example`) — bez zmian w kodzie.
2. **Cookiebot (I3):** osobny `<Script src="…/uc.js" strategy="afterInteractive">` po ustaleniu CMP — nie w bundle GTM lazy.
3. **Dodaj sekcje** w `src/sections/`
4. **Stwórz manifesty** `*.manifest.ts` dla każdej sekcji

---

## ODNIESIENIA

- Konstytucja v2.6 / FINALNA
- GSAP 3.12 Docs
- Lenis 1.1 Docs
- Next.js 16 Docs
