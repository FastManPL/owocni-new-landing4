/**
 * G11: getDeviceTier() — Shared Core Layer.
 * Tier obliczany RAZ przy init (client-side).
 * Tier 0 = low-end (Save-Data, <4 cores, <4GB, 2g), Tier 1 = normal, Tier 2 = high-end.
 *
 * To **nie** jest ciągły pomiar obciążenia CPU — tylko heurystyki API przeglądarki
 * (`hardwareConcurrency`, `deviceMemory`, Network Information, `prefers-reduced-motion`).
 */
import { FORCE_ANIMATION_COST_PROFILE } from '@/config/featureFlags';

export type DeviceTier = 0 | 1 | 2;

/** Profil kosztu animacji / scrollu — mapowany na Lenis + limit GSAP tickera. */
export type AnimationCostProfile = 'full' | 'reduced' | 'minimal';

function isCoarseTouchPrimary(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(hover: none)').matches
  );
}

export function getDeviceTier(): DeviceTier {
  if (typeof window === 'undefined') return 1;

  const nav = window.navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    hardwareConcurrency?: number;
    deviceMemory?: number;
  };
  const conn = nav.connection;
  const saveData = conn?.saveData === true;
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const effectiveType = conn?.effectiveType ?? '';
  const slowNetwork = effectiveType === '2g' || effectiveType === 'slow-2g';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarseTouch = isCoarseTouchPrimary();

  if (saveData || reducedMotion || cores < 4 || memory < 4 || slowNetwork) {
    return 0;
  }
  /** Typowy budżetowy telefon: mało rdzeni + głównie palec — traktuj jak tier 0 dla G11. */
  if (coarseTouch && cores <= 4) {
    return 0;
  }
  if (cores >= 8 && memory >= 8) {
    return 2;
  }
  return 1;
}

/**
 * Polityka „mniej CPU” dla Lenis + GSAP (tick / scrub).
 * Wywołuj po stronie klienta (np. przy bootcie scrollRuntime).
 *
 * `FORCE_ANIMATION_COST_PROFILE` w `featureFlags.ts` pozwala wymusić profil (QA).
 * Poza tym: **heurystyka**, nie runtimeowy sampler FPS (żeby nie dokładać kosztu).
 */
export function getAnimationCostProfile(): AnimationCostProfile {
  if (typeof window === 'undefined') return 'full';
  if (FORCE_ANIMATION_COST_PROFILE != null) {
    return FORCE_ANIMATION_COST_PROFILE;
  }

  const tier = getDeviceTier();
  if (tier === 0) return 'minimal';

  const nav = window.navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    hardwareConcurrency?: number;
  };
  const effectiveType = nav.connection?.effectiveType ?? '';
  const slowish =
    effectiveType === '3g' ||
    effectiveType === '2g' ||
    effectiveType === 'slow-2g';
  const cores = nav.hardwareConcurrency ?? 4;
  const coarseTouch = isCoarseTouchPrimary();

  if (tier === 1 && (slowish || (coarseTouch && cores <= 6))) {
    return 'reduced';
  }
  return 'full';
}
