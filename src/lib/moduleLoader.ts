/**
 * H5/H6: Module Loader — globalny loader ciężkich modułów (>100KB) z cache + warmup.
 * Sekcje deklarują zależność i politykę warmup w manifeście; nie ładują bibliotek samodzielnie.
 */

export type WarmupPolicy = 'immediate' | 'idle' | 'near-viewport';

export interface WarmupEntry {
  import: () => Promise<unknown>;
  policy: WarmupPolicy;
  rootMargin?: string;
}

const cache = new Map<string, Promise<unknown>>();
let idleScheduled = false;
const nearViewportObservers = new Map<string, IntersectionObserver>();

function loadImmediate(entry: WarmupEntry): Promise<unknown> {
  return entry.import();
}

function loadIdle(entry: WarmupEntry): Promise<unknown> {
  const key = entry.import.toString();
  if (cache.has(key)) return cache.get(key)!;
  const p =
    typeof requestIdleCallback !== 'undefined'
      ? new Promise<unknown>((resolve) => {
          requestIdleCallback(() => resolve(entry.import()), { timeout: 2000 });
        })
      : Promise.resolve().then(() => entry.import());
  cache.set(key, p);
  return p;
}

function loadNearViewport(entry: WarmupEntry): Promise<unknown> {
  const key = entry.import.toString();
  if (cache.has(key)) return cache.get(key)!;
  const p = new Promise<unknown>((resolve) => {
    const rootMargin = entry.rootMargin ?? '2000px';
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        nearViewportObservers.delete(key);
        resolve(entry.import());
      },
      { rootMargin, threshold: 0 }
    );
    observer.observe(document.body);
    nearViewportObservers.set(key, observer);
  });
  cache.set(key, p);
  return p;
}

/**
 * Pobierz moduł według polityki warmup. Jednokrotne ładowanie + cache.
 */
export function loadModule(entry: WarmupEntry): Promise<unknown> {
  switch (entry.policy) {
    case 'immediate':
      return loadImmediate(entry);
    case 'idle':
      if (!idleScheduled) {
        idleScheduled = true;
      }
      return loadIdle(entry);
    case 'near-viewport':
      return loadNearViewport(entry);
    default:
      return entry.import();
  }
}

/**
 * Uruchom warmup dla listy wpisów (np. z manifestów sekcji).
 * Wywołane raz w client boundary po mount (np. w SmoothScrollProvider lub layout wrapper).
 */
export function runWarmupPolicy(entries: WarmupEntry[]): void {
  entries.forEach((entry) => {
    loadModule(entry).catch(() => {
      // Cichy fail — sekcja dostanie błąd przy mount i może pokazać fallback
    });
  });
}
