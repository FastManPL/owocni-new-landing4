/**
 * Feature flags (build-time / runtime booleans).
 *
 * **SHOW_KINETIC_SECTION** — `false`: zamiast Bridge + Kinetic renderuje się zwykła sekcja
 * `KineticDisabledPlaceholder` (bez pinSpacer / wrapperów). `true`: `<BridgeSection kineticLayer={<KineticHomeSlot />} />`.
 */
export const SHOW_KINETIC_SECTION = false;
