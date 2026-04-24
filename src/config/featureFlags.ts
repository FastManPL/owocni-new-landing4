/**
 * Feature flags — jedna stała w repo (bez .env).
 *
 * **SHOW_KINETIC_SECTION** — `false`: zamiast Bridge + Kinetic renderuje się
 * `KineticDisabledPlaceholder` (bez pinSpacer / `#kinetic-section`).
 * `true`: pełny Kinetic (`BridgeSection` + `KineticHomeSlot`).
 *
 * **FORCE_ANIMATION_COST_PROFILE** — `null`: wybór profilu z heurystyki
 * (`getAnimationCostProfile` w `autoTier.ts`). Inna wartość: wymuszenie dla QA
 * (wpływa na Lenis + limit FPS GSAP tickera przy starcie scrollRuntime).
 */
export const SHOW_KINETIC_SECTION = false;

export const FORCE_ANIMATION_COST_PROFILE:
  | 'full'
  | 'reduced'
  | 'minimal'
  | null = null;
