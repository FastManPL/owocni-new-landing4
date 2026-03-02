# Sekcje LP

Każda sekcja w osobnym podfolderze zgodnie z Konstytucją (CONSTITUTION_v2.5.md):

- `[nazwa]/[Nazwa]Section.tsx` — komponent React ("use client" jeśli z GSAP)
- `[nazwa]/[nazwa].manifest.ts` — manifest (typ A/B, assets HOT/WARM/COLD, warmup, geometryMutable)
- `[nazwa]/[nazwa]-section.css` — style scoped pod `#[nazwa]-section`
- opcjonalnie `[nazwa].config.ts` — Timeline Contract (LOCKED)

Root sekcji: `id="[nazwa]-section"`, `isolation: isolate`. Zero importów między sekcjami; tylko Shared Core (scrollRuntime, moduleLoader, design tokens, next/font).
