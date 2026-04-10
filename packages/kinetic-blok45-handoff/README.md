# Kinetic + Blok 4–5 — paczka handoff

Samodzielna mini-aplikacja **Next.js 16** z **tymi samymi plikami silników** co główny landing (`KineticEngine`, `Blok45Engine`, `scrollRuntime`, `SmoothScrollProvider`, `BridgeSection`).

## Przekazanie komuś bez całego repo

1. Spakuj **wyłącznie ten katalog** `kinetic-blok45-handoff` (ZIP).
2. Odbiorca rozpakowuje, w środku:
   ```bash
   nvm use 20   # lub Node 20
   npm install
   npm run dev
   ```
3. Otwiera **http://localhost:3001**

## Aktualizacja kodu z głównego LP

Gdy paczka leży w monorepo jako `packages/kinetic-blok45-handoff`:

```bash
npm run sync
```

Nadpisuje `src/sections/*`, `src/lib/scrollRuntime.ts`, `src/components/SmoothScrollProvider.tsx`, `Bridge*`, assety `public/Ludzie*`.

## Co jest celowo „minimalne”

- Brak Tailwinda — tylko `globals.css` niezbędny do scrollu/tła.
- Placeholder `#fakty-section` — jak slot z głównego `page.tsx` (logika fali Blok45).
- Port **3001** — żeby nie kolidować z głównym `next dev` na3000.

## Struktura

- `src/app/page.tsx` — layout integracji (Fakty placeholder + Bridge + Blok45).
- `src/app/BridgeSection.tsx` — jak w głównym `src/app`.
- `src/sections/kinetic/` — silnik Kinetic.
- `src/sections/block-45/` — silnik Blok 4–5.
- `src/lib/scrollRuntime.ts` — Lenis + ScrollTrigger jak na LP.
- `public/Ludzie*` — obrazy używane w `<picture>` w Blok45.
