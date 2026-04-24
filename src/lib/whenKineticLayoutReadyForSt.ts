/**
 * DEFERRED-ST-KINETIC-01 — ten sam kontrakt co `FaktyEngine.maybeCreateScrollTriggers`:
 * ScrollTriggery poniżej Kinetic (Case Studies, CaseStudy2, kafelki w Wyniki) nie mogą
 * powstać zanim pin-spacer Kinetic jest w layoutie ORAZ globalny `ScrollTrigger.refresh()`
 * się wykona (`kinetic-ready-and-refreshed` + `window.__kineticReadyAndRefreshed`).
 *
 * Gdy `SHOW_KINETIC_SECTION=false`, w DOM nie ma `#kinetic-section` — `run()` od razu.
 *
 * @returns disposer — wywołaj w cleanup `useGSAP` **przed** `inst.kill()`, żeby anulować
 *         oczekiwanie jeśli komponent odmontuje się zanim Kinetic się zgłosi.
 */
export function scheduleAfterKineticLayoutReady(run: () => void): () => void {
  if (typeof window === 'undefined') {
    run();
    return () => {};
  }
  if (!document.getElementById('kinetic-section')) {
    run();
    return () => {};
  }
  const w = window as unknown as { __kineticReadyAndRefreshed?: boolean };
  if (w.__kineticReadyAndRefreshed === true) {
    run();
    return () => {};
  }

  let done = false;
  let cancelled = false;

  const finish = () => {
    if (cancelled || done) return;
    done = true;
    window.removeEventListener('kinetic-ready-and-refreshed', onReady);
    clearTimeout(safety);
    run();
  };

  const onReady = () => {
    finish();
  };
  const safety = window.setTimeout(() => {
    finish();
  }, 5000);

  window.addEventListener('kinetic-ready-and-refreshed', onReady);

  return () => {
    if (cancelled) return;
    cancelled = true;
    if (!done) {
      window.removeEventListener('kinetic-ready-and-refreshed', onReady);
      clearTimeout(safety);
    }
  };
}
