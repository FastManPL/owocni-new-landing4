/**
 * Feature flags — jedna stała w repo (bez .env).
 *
 * **SHOW_KINETIC_SECTION** — `false`: zamiast Bridge + Kinetic renderuje się
 * `KineticDisabledPlaceholder` (bez pinSpacer / `#kinetic-section`).
 * `true`: pełny Kinetic (`BridgeSection` + `KineticHomeSlot`).
 *
 * **FORCE_ANIMATION_COST_PROFILE** — `null`: wybór profilu z heurystyki
 * (`getAnimationCostProfile` w `autoTier.ts`). Inna wartość: wymuszenie dla QA
 * (limit FPS GSAP tickera przy starcie scrollRuntime).
 * Na telefonach (`pointer: coarse` + brak hover) Lenis jest **wyłączony** niezależnie
 * od tej flagi — scroll = natywny dokument (mniej CPU).
 */
export const SHOW_KINETIC_SECTION = false;

export const FORCE_ANIMATION_COST_PROFILE:
  | 'full'
  | 'reduced'
  | 'minimal'
  | null = null;
