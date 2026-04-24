/**
 * Feature flags — jedna stała w repo (bez .env).
 *
 * **SHOW_KINETIC_SECTION** — `false`: zamiast Bridge + Kinetic renderuje się
 * `KineticDisabledPlaceholder` (bez pinSpacer / `#kinetic-section`).
 * `true`: pełny Kinetic (`BridgeSection` + `KineticHomeSlot`).
 */
export const SHOW_KINETIC_SECTION = false;
