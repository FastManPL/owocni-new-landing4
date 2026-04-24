/**
 * Feature flags (build-time via `NEXT_PUBLIC_*` — wartości wstrzyknięte przy `next build` / dev).
 *
 * **SHOW_KINETIC_SECTION** — `false`: zamiast Bridge + Kinetic renderuje się sekcja
 * `KineticDisabledPlaceholder` (bez pinSpacer / `#kinetic-section`). Domyślnie `true`.
 * Wyłącz: `NEXT_PUBLIC_SHOW_KINETIC_SECTION=false` w `.env.local`.
 *
 * **ENABLE_KINETIC_TUNNEL** — `false`: silnik Kinetic działa, ale bez canvasu tunelu (bez obręczy,
 * zero CLS przypisanego do `#kinetic-tunnel-canvas`). Reszta narracji / cząsteczki bez zmian.
 * Domyślnie `true`. Wyłącz: `NEXT_PUBLIC_ENABLE_KINETIC_TUNNEL=false` w `.env.local`.
 */

function parsePublicBool(
  raw: string | undefined,
  /** gdy zmienna nie ustawiona lub pusta */
  whenUnset: boolean,
): boolean {
  if (raw === undefined || raw === '') return whenUnset;
  const v = raw.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  return whenUnset;
}

export const SHOW_KINETIC_SECTION = parsePublicBool(
  process.env.NEXT_PUBLIC_SHOW_KINETIC_SECTION,
  true,
);

export const ENABLE_KINETIC_TUNNEL = parsePublicBool(
  process.env.NEXT_PUBLIC_ENABLE_KINETIC_TUNNEL,
  true,
);
