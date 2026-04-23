/**
 * J12 (Konstytucja LP v2.9): rozcięcie ciężkich synchronicznych bloków GSAP init
 * na mniejsze kroki — oddaje main thread między fazami żeby przeglądarka mogła
 * obsłużyć input / paint / wheel / touch.
 *
 * `scheduler.yield()` (Chromium 129+, Edge 129+) jest natywnym API — oddaje main
 * thread do kolejnej klatki z priorytetem "user-blocking", więc nie wpada w tie
 * z `setTimeout` (który jest rzutowany w najniższy priorytet).
 *
 * Fallback `setTimeout(resolve, 0)` jest OBOWIĄZKOWY bo Safari/Firefox nie mają
 * `scheduler.yield()`. Minimum latency fallbacku to ~4ms clamp (HTML spec).
 *
 * KIEDY UŻYWAĆ:
 *  - `useGSAP(() => init(el))` gdzie `init` robi >50ms pracy sync
 *  - Między fazami: DOM query → DOM create → canvas/sprite gen → GSAP timeline
 *    → ScrollTrigger.create → event listeners
 *  - J3 NIENARUSZALNE: kolejność `gsap.to/from/set` wewnątrz timeline — yield
 *    zawsze PRZED lub PO całym timeline bloku, nigdy w środku
 *
 * KIEDY NIE UŻYWAĆ:
 *  - Init <50ms (narzut ~4ms per yield na fallback = regresja dla lekkich sekcji)
 *  - Krytyczne sync-musi-być-teraz (np. appendChild canvas PRZED pomiarem layoutu)
 *  - Wewnątrz pojedynczego timeline (J3)
 *
 * Guard pattern (race condition):
 *   await yieldToMain();
 *   if (_killed) return noop;   // user unmountował sekcję w trakcie yieldu
 */
export function yieldToMain(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const sched = (window as unknown as {
    scheduler?: { yield?: () => Promise<void> };
  }).scheduler;
  if (sched && typeof sched.yield === 'function') {
    return sched.yield();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
