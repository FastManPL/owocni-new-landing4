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

let runtimeForcedTier: DeviceTier | null = null;

/**
 * Global runtime downgrade (one-way) for current page session.
 * Used when we detect sustained long frames despite optimistic static heuristics.
 */
export function requestRuntimeTierDowngrade(nextTier: DeviceTier): void {
  if (runtimeForcedTier === null) {
    runtimeForcedTier = nextTier;
    return;
  }
  if (nextTier < runtimeForcedTier) {
    runtimeForcedTier = nextTier;
  }
}

export function getRuntimeForcedTier(): DeviceTier | null {
  return runtimeForcedTier;
}

function isCoarseTouchPrimary(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(hover: none)').matches
  );
}

/**
 * Telefon / tablet jako główny wejście — **bez Lenisa**, natywny scroll dokumentu
 * (Compositor przeglądarki). Dotyczy m.in. Realme 8 (8 rdzeni = wcześniej „full” + Lenis).
 */
export function prefersNativeDocumentScroll(): boolean {
  return isCoarseTouchPrimary();
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

  let resolved: DeviceTier;
  if (saveData || reducedMotion || cores < 4 || memory < 4 || slowNetwork) {
    resolved = 0;
  } else if (cores >= 8 && memory >= 8) {
    resolved = 2;
  } else {
    resolved = 1;
  }
  /**
   * UWAGA (2026-04 / mobile Safari): `hardwareConcurrency` bywa 4 na nowych iPhoneach —
   * poprzedni warunek `coarseTouch && cores <= 4` degradował każdy iPhone do Tier 0
   * (blokada warm video, WebGL `none`, zepsuty mobile form Final bez `layoutInfo`).
   * Tier 0 zostaje dla rdzeni < 4 (pierwszy if) + Save-Data / reduced-motion / słabe łącze.
   */
  if (runtimeForcedTier !== null) {
    return Math.min(resolved, runtimeForcedTier) as DeviceTier;
  }
  return resolved;
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

  /** Wszystkie telefony / tablety z głównym palcem — nigdy „full” (Lenis + 60 Hz tick). */
  if (isCoarseTouchPrimary()) {
    return 'reduced';
  }

  const nav = window.navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    hardwareConcurrency?: number;
  };
  const effectiveType = nav.connection?.effectiveType ?? '';
  const slowish =
    effectiveType === '3g' ||
    effectiveType === '2g' ||
    effectiveType === 'slow-2g';

  if (tier === 1 && slowish) {
    return 'reduced';
  }
  return 'full';
}
