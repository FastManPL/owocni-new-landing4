/**
 * G11: getDeviceTier() — Shared Core Layer.
 * Tier obliczany RAZ przy init (client-side).
 * Tier 0 = low-end (Save-Data, <4 cores, <4GB, 2g), Tier 1 = normal, Tier 2 = high-end.
 */
export type DeviceTier = 0 | 1 | 2;

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

  if (saveData || reducedMotion || cores < 4 || memory < 4 || slowNetwork) {
    return 0;
  }
  if (cores >= 8 && memory >= 8) {
    return 2;
  }
  return 1;
}
