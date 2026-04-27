/**
 * G11.1 / J15 — Shared Core: jeden profil WebGL dla całej strony + cienki broker.
 * Nie renderuje — tylko polityka (profil DPR / AA / powerPreference).
 * Sekcje nadal tworzą własny WebGLRenderer i canvas.
 */
import { FORCE_WEBGL_PROFILE } from '@/config/featureFlags';
import { getDeviceTier } from '@/lib/autoTier';

/** J15: czas w stanie OFF (poza viewportem) zanim pełny dispose → COLD (ms). */
export const WEBGL_OFF_TO_COLD_MS = 30_000;

export type WebGLProfile = 'none' | 'low' | 'normal' | 'high';

/** Opcje przekazywane do `new THREE.WebGLRenderer({ ... })` (subset WebGLRendererParameters). */
export type WebGLRendererCreationOptions = {
  antialias: boolean;
  powerPreference?: 'default' | 'low-power' | 'high-performance';
  alpha?: boolean;
  premultipliedAlpha?: boolean;
};

let cachedProfile: WebGLProfile | null = null;
let cachedGpuHint: string | null | undefined = undefined;
let cachedTier: number | null = null;

/** GL_RENDERER — WebGL2 / GLES; bez `WEBGL_debug_renderer_info` (Firefox deprecuje ext). */
const GL_RENDERER = 0x1f01;

function readGpuRendererHintOnce(): string | null {
  if (typeof document === 'undefined') return null;
  if (cachedGpuHint !== undefined) return cachedGpuHint;
  try {
    const canvas = document.createElement('canvas');
    const isFirefox =
      typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

    const gl2 = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: false,
    }) as WebGL2RenderingContext | null;
    if (gl2) {
      const r2 = gl2.getParameter(GL_RENDERER);
      if (typeof r2 === 'string' && r2.length > 0) {
        const t = r2.trim();
        if (t && !/^(mozilla|webkit webgl)$/i.test(t)) {
          cachedGpuHint = t;
          return cachedGpuHint;
        }
      }
    }

    if (isFirefox) {
      cachedGpuHint = null;
      return null;
    }

    const gl = canvas.getContext('webgl', {
      failIfMajorPerformanceCaveat: false,
    }) as WebGLRenderingContext | null;
    if (!gl) {
      cachedGpuHint = null;
      return null;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) {
      cachedGpuHint = null;
      return null;
    }
    const raw = gl.getParameter((ext as unknown as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL);
    cachedGpuHint = typeof raw === 'string' && raw.length > 0 ? raw : null;
    return cachedGpuHint;
  } catch {
    cachedGpuHint = null;
    return null;
  }
}

/** Uzupełnienie tieru (G11) — wyłącznie string z GL, bez UA/OS. */
function isWeakIntegratedGpuHint(renderer: string): boolean {
  const s = renderer.toLowerCase();
  if (/apple m\d|apple gpu|nvidia|geforce|rtx|radeon rx|amd radeon pro/.test(s)) {
    return false;
  }
  return (
    /intel iris|intel hd|intel uhd|angle \(intel|mali-|adreno \(tm\)|adreno \(l|powervr|llvmpipe|swiftshader|microsoft basic render/.test(
      s,
    ) || /adreno [2-5]\d{2}/.test(s)
  );
}

/**
 * Jeden profil na sesję (client). Tier 0 → `none`; reszta: tier + opcjonalny hint GPU.
 */
export function getWebGLProfile(): WebGLProfile {
  if (typeof window === 'undefined') return 'normal';
  if (FORCE_WEBGL_PROFILE != null) return FORCE_WEBGL_PROFILE;

  const tier = getDeviceTier();
  if (cachedProfile !== null && cachedTier === tier) return cachedProfile;
  cachedTier = tier;
  if (tier === 0) {
    cachedProfile = 'none';
    return cachedProfile;
  }

  const hint = readGpuRendererHintOnce();
  const weak = hint ? isWeakIntegratedGpuHint(hint) : false;

  if (tier === 2) {
    cachedProfile = weak ? 'normal' : 'high';
    return cachedProfile;
  }

  // tier === 1
  cachedProfile = weak ? 'low' : 'normal';
  return cachedProfile;
}

export function getWebGLPixelRatio(profile: WebGLProfile = getWebGLProfile()): number {
  const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  if (profile === 'none') return 1;
  if (profile === 'low') return 1;
  if (profile === 'normal') return Math.min(raw, 1.5);
  return Math.min(raw, 2);
}

export function getWebGLRendererCreationOptions(
  profile: WebGLProfile = getWebGLProfile(),
): WebGLRendererCreationOptions {
  if (profile === 'none') {
    return { antialias: false, powerPreference: 'low-power' };
  }
  if (profile === 'low') {
    return { antialias: false, powerPreference: 'low-power' };
  }
  if (profile === 'normal') {
    return { antialias: true, powerPreference: 'default' };
  }
  return { antialias: true, powerPreference: 'high-performance' };
}

type PauseFn = () => void;
type ResumeFn = () => void;

const pauseListeners = new Set<PauseFn>();
const resumeListeners = new Set<ResumeFn>();
let visibilityHooked = false;

function onVisibilityChange(): void {
  if (typeof document === 'undefined') return;
  if (document.hidden) {
    pauseListeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* broker guard */
      }
    });
  } else {
    resumeListeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* broker guard */
      }
    });
  }
}

/**
 * Global pause/resume przy ukryciu karty (J15). Sekcja podaje swoje pause/resume (np. zatrzymaj rAF / ticker).
 * Zwraca funkcję wyrejestrowania — wołaj w kill().
 */
export function registerWebGLDocumentVisibilityBridge(pause: PauseFn, resume: ResumeFn): () => void {
  if (typeof document === 'undefined') return () => {};
  if (!visibilityHooked) {
    visibilityHooked = true;
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  pauseListeners.add(pause);
  resumeListeners.add(resume);
  return () => {
    pauseListeners.delete(pause);
    resumeListeners.delete(resume);
  };
}
