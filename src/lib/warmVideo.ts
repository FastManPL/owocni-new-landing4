/**
 * warmVideo — shared WARM gating utility dla wszystkich `<video>` poniżej fold.
 *
 * Konstytucja:
 *   G2/G3  — WARM asset ładowany blisko viewportu, nie eager.
 *   G11    — Tier 0 (Save-Data / <4 cores / <4GB / 2g / reduced-motion) = zero autoplay.
 *   G8     — dla video w Cover Image Pattern overlay fade-out obsługiwany osobno
 *            (warmVideo tylko steruje load/play/pause).
 *
 * Kontrakt:
 *   - Video MUSI mieć w HTML `preload="none"` i BEZ `autoPlay`.
 *   - Pierwszy raz near-viewport (rootMargin) → `.preload = 'auto'` + `.load()` + `.play()`.
 *   - `document.hidden` = pause. `document.visible` = ponowne play (jeśli juz startowało).
 *   - Sprzątanie: zwracana funkcja `dispose()` odinstalowuje IO + visibilitychange i pauzuje video.
 *
 * Minimalna zmiana per sekcja: 1 import + 1 wywołanie + push do cleanups[].
 */
import { getDeviceTier } from './autoTier';

export interface WarmVideoOptions {
  /** rootMargin dla one-shot IO wykrywającego pierwszy wjazd near-viewport. Default: '600px'. */
  rootMargin?: string;
  /** Domyślnie wideo zapętlane — ustaw `false` dla one-shot playback. */
  loop?: boolean;
  /** Opcjonalny callback po pierwszym `playing` event (np. overlay fade-out w G8 Cover Image Pattern). */
  onPlaying?: (video: HTMLVideoElement) => void;
  /** Wymuszenie — pomiń Tier 0 check (używane dla hero-critical wideo zgodnie z G11). */
  skipTierGate?: boolean;
}

export interface WarmVideoHandle {
  /** Odinstaluj IO + visibilitychange + pauza video. Idempotent. */
  dispose: () => void;
  /** Wymuś start (np. z zewnętrznego triggera). No-op na Tier 0. */
  start: () => void;
  /** Wymuś pauzę. */
  pause: () => void;
}

/**
 * Gating WARM dla pojedynczego `<video>`. Bezpieczne do wielokrotnego wywołania
 * z różnymi elementami — każdy dostaje własny IO i listener.
 */
export function startWarmVideoOnce(
  video: HTMLVideoElement | null | undefined,
  options: WarmVideoOptions = {},
): WarmVideoHandle {
  if (!video || typeof window === 'undefined') {
    return { dispose: () => {}, start: () => {}, pause: () => {} };
  }

  const {
    rootMargin = '600px',
    loop = true,
    onPlaying,
    skipTierGate = false,
  } = options;

  // G11: Tier 0 = zero autoplay, video tagged as "poster only".
  const tierBlocks = !skipTierGate && getDeviceTier() === 0;

  let started = false;
  let disposed = false;
  let io: IntersectionObserver | null = null;
  let onPlayingHandler: (() => void) | null = null;

  const doStart = () => {
    if (disposed || tierBlocks) return;
    if (document.hidden) return;
    if (!started) {
      started = true;
      try { video.preload = 'auto'; } catch {}
      if (loop) {
        try { video.loop = true; } catch {}
      }
      try { video.load(); } catch {}
      if (onPlaying) {
        onPlayingHandler = () => onPlaying(video);
        video.addEventListener('playing', onPlayingHandler, { once: true });
      }
    }
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  };

  const doPause = () => {
    try { video.pause(); } catch {}
  };

  // One-shot IO: pierwszy start gdy video near-viewport.
  if (!tierBlocks && typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          doStart();
          io?.disconnect();
          io = null;
        }
      },
      { rootMargin },
    );
    io.observe(video);
  }

  // Visibility gating: pause na document.hidden, resume na powrót (jeśli już startowało).
  const onVis = () => {
    if (tierBlocks) return;
    if (document.hidden) {
      if (started) doPause();
    } else {
      if (started) doStart();
    }
  };
  document.addEventListener('visibilitychange', onVis);

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      io?.disconnect();
      io = null;
      document.removeEventListener('visibilitychange', onVis);
      if (onPlayingHandler) {
        try { video.removeEventListener('playing', onPlayingHandler); } catch {}
        onPlayingHandler = null;
      }
      doPause();
    },
    start: doStart,
    pause: doPause,
  };
}

/**
 * Batch variant — gating dla wielu video jednocześnie (np. carousel tiles).
 * Zwraca pojedynczy `dispose()` który odinstalowuje wszystkie.
 */
export function startWarmVideosOnce(
  videos: Iterable<HTMLVideoElement | null | undefined>,
  options: WarmVideoOptions = {},
): WarmVideoHandle {
  const handles: WarmVideoHandle[] = [];
  for (const v of videos) {
    if (v) handles.push(startWarmVideoOnce(v, options));
  }
  return {
    dispose: () => handles.forEach((h) => h.dispose()),
    start: () => handles.forEach((h) => h.start()),
    pause: () => handles.forEach((h) => h.pause()),
  };
}
