'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './book-stats-section.css';

// Poster wideo: public/books/Statystyki-stron.png → /books/Statystyki-stron.png

// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// Next.js pre-renderuje Client Components na serwerze — window/document nie istnieją.
// registerPlugin() WYŁĄCZNIE wewnątrz useGSAP(() => { ... }) jak poniżej.

/* ════════════════════════════════════════════════════════════════
   book-stats-section — hardened init(container)
   AUTO-FIXy: B-ISO-01 (CSS), NULL-GUARD-01 (2× patch by owner)
   CPU Gating: Ścieżka 3a (ST-native pin+scrub — brak IO gating)
   ════════════════════════════════════════════════════════════════ */
function init(container: HTMLElement): { kill: () => void; pause: () => void; resume: () => void } {
  /* [FIX-11] Null guard — SPA/lazy-load may call init before section is in DOM */
  if (!container) return { kill: function(){}, pause: function(){}, resume: function(){} };
  const $ = (sel: string) => container.querySelector(sel);
  const $$ = (sel: string) => container.querySelectorAll(sel);
  const $id = (id: string) => container.querySelector('#' + id);

  // DEBUG_MODE removed — TS-LINT-UNUSED-01: declared but never read inside init()
  // (DEV overlay has its own declaration; this was dead code)

  // getScroll removed — TS-LINT-UNUSED-01: declared but never called inside init()

  const cleanups: (() => void)[] = [];
  const gsapInstances: gsap.core.Tween[] = [];
  const timerIds: number[] = [];
  const observers: IntersectionObserver[] = [];
  const hfListeners: (() => void)[] = [];

  /* Shared ref for Typ B pause/resume — bookFrames IIFE populates this */
  let sectionST: ScrollTrigger | null = null;

  /* ========================================================
     COUNTER REELS
     ======================================================== */
  const statsContainer = $('.cs-stats-placeholder');
  const rows = [].slice.call($$('[data-counter-row]')) as HTMLElement[];
  const wrappers = [].slice.call($$('[data-counter]')) as HTMLElement[];
  let ready = false;
  let spun = false;
  let _killed = false; /* P3-CLEAN-01: idempotency guard for kill() */

  /* --- BUILD: bęben cyfrowy 0→target --- */
  function buildReel(parent: HTMLElement, target: number, fullRotations: number) {
    const reel = document.createElement('div');
    reel.className = 'cs-reel';

    let n, r, d;
    for (n = 0; n <= 9; n++) {
      d = document.createElement('div');
      d.className = 'cs-digit';
      d.innerText = String(n);
      reel.appendChild(d);
    }
    for (r = 0; r < fullRotations; r++) {
      for (n = 0; n <= 9; n++) {
        d = document.createElement('div');
        d.className = 'cs-digit';
        d.innerText = String(n);
        reel.appendChild(d);
      }
    }
    if (fullRotations > 0 && target > 0) {
      for (n = 0; n <= target; n++) {
        d = document.createElement('div');
        d.className = 'cs-digit';
        d.innerText = String(n);
        reel.appendChild(d);
      }
    }

    (reel as any)._totalSteps = fullRotations * 10 + target;
    parent.appendChild(reel);
    return reel;
  }

  function buildCounter(w: HTMLElement) {
    w.innerHTML = '';
    const digits = (w.dataset.digits || '').split(',').map(Number);

    const reels = digits.map(function(digit: number) {
      const rotations = digit === 0 ? 1 : 0;
      return buildReel(w, digit, rotations);
    });

    /* [NULL-GUARD-01 PATCH] _reels PRZED guardami suffixa — spin zadziała nawet bez suffixa */
    (w as any)._reels = reels;

    const row = w.closest('[data-counter-row]');
    if (!row) return;
    const suffixSlot = row.querySelector('[data-suffix-slot]');
    if (!suffixSlot) return;

    suffixSlot.innerHTML = '';
    const sym = document.createElement('span');
    sym.className = 'cs-suffix-symbol';
    sym.innerText = w.dataset.suffix || '';
    suffixSlot.appendChild(sym);
  }

  /* --- SPIN: fire & forget + heading sweep --- */
  function spinAll() {
    if (spun) return;
    spun = true;

    const allReels: HTMLElement[] = [];
    wrappers.forEach(function(w: HTMLElement) {
      if (!(w as any)._reels) return;
      (w as any)._reels.forEach(function(reel: HTMLElement) { allReels.push(reel); });
    });

    allReels.forEach(function(reel: HTMLElement) { reel.style.willChange = 'transform'; });

    wrappers.forEach(function(w: HTMLElement) {
      if (!(w as any)._reels) return;
      (w as any)._reels.forEach(function(reel: HTMLElement, i: number) {
        reel.style.transitionDelay = i * 120 + 'ms';
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            reel.style.transform = 'translateY(-' + ((reel as any)._totalSteps * 1.05) + 'em)';
          });
        });
      });
    });

    if (allReels.length > 0) {
      const lastReel = allReels[allReels.length - 1];
      let fallbackTimer: number;
      const cleanupLayers = function() {
        if (lastReel) lastReel.removeEventListener('transitionend', onSpinEnd);
        clearTimeout(fallbackTimer);
        allReels.forEach(function(r: HTMLElement) { r.style.willChange = 'auto'; });
      };
      const onSpinEnd = function(e: TransitionEvent) {
        if (e.propertyName !== 'transform') return;
        cleanupLayers();
      };
      if (lastReel) lastReel.addEventListener('transitionend', onSpinEnd);
      fallbackTimer = setTimeout(cleanupLayers, 2500) as unknown as number;
      cleanups.push(cleanupLayers);
    }

    /* GSAP z importu (nie window.gsap) — animacja „reveal” nagłówków liczników */
    const headings = [].slice.call(container.querySelectorAll('.cs-counter-heading')) as HTMLElement[];
    headings.forEach(function(h: HTMLElement, i: number) {
      const tween = gsap.to(h, {
        backgroundPosition: '0% 0',
        duration: 3,
        delay: 0.3 + i * 0.15,
        ease: 'bounce.out'
      });
      gsapInstances.push(tween);
    });
  }

  /* --- IO: counters visibility --- */
  wrappers.forEach(function(w: HTMLElement) { buildCounter(w); });

  let counterObserver: IntersectionObserver | null = null;
  /* Spin when stats enter upper ~80% of viewport (equiv. old: rect.top < 0.8 * innerHeight).
     IntersectionObserver only — no per-scroll getBoundingClientRect (Etap 4 hot path). */
  function attachSpinWhenReadyObserver() {
    if (!statsContainer || _killed) return;
    let spinIO: IntersectionObserver | null = null;
    spinIO = new IntersectionObserver(function(entries) {
      if (_killed || !ready || spun || !entries[0]) return;
      if (entries[0].isIntersecting) {
        spinAll();
        spinIO?.disconnect();
      }
    }, {
      root: null,
      /* Shrink root from bottom by 20% → intersection region = top 80% of viewport */
      rootMargin: '0px 0px -20% 0px',
      threshold: 0
    });
    spinIO.observe(statsContainer);
    observers.push(spinIO);
  }

  if (statsContainer) {
    counterObserver = new IntersectionObserver(function(entries) {
      if (entries[0]?.isIntersecting && !ready) {
        ready = true;
        rows.forEach(function(row: HTMLElement, i: number) {
          const tid = setTimeout(function() { row.classList.add('visible'); }, i * 180) as unknown as number;
          timerIds.push(tid);
        });
        counterObserver?.disconnect();
        attachSpinWhenReadyObserver();
      }
    }, { threshold: 0.01 });
    counterObserver.observe(statsContainer);
    observers.push(counterObserver);
  }

  /* ========================================================
     BOOK FRAME SEQUENCE — Canvas scroll animation
     ======================================================== */
  (function bookFrames() {
    const FRAME_COUNT = 23;
    const bookContainer = $('.cs-img--book');
    const canvas = $id('book-stats-canvas') as HTMLCanvasElement | null;
    if (!bookContainer || !canvas) return;

    let ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;

    /* [NULL-GUARD-01 PATCH] floorImages guard — defensywny */
    const floorImages = $('.cs-floor--images');
    if (!floorImages) return;

    let frames: (HTMLCanvasElement | HTMLImageElement | ImageBitmap | null)[] = new Array(FRAME_COUNT);
    const loaded: boolean[] = new Array(FRAME_COUNT);
    for (let li = 0; li < FRAME_COUNT; li++) { loaded[li] = false; }
    let loadedCount = 0;
    let displayIndex = -1;
    const playhead = { frame: 0 };
    let bookTl: gsap.core.Timeline | null = null;
    let bookST: ScrollTrigger | null = null;
    let bookRO: ResizeObserver | null = null;
    let sentryIO: IntersectionObserver | null = null;
    let preloadStarted = false;
    let _scrollEnabled = false; /* używane w PRODUCTION PATTERN (obecnie zakomentowany) */
    let allLoaded = false;
    let roRafId = 0;
    /** Po dojściu scrubem do końca: poza strefą ST progress=0 — bez latch znów rysuje się klatka 0. */
    let bookScrubPastEnd = false;
    /** Poprzedni progress ST — rozróżnia glitch pinu (spadek 0.99→0 przy scroll w dół) od realnego y<start przy scroll w górę. */
    let prevBookSTProgress = -1;
    /** Najwyższa klatka faktycznie narysowana — niezależna od progress/prev; pierwsze zejście potrafi nie zdążyć zaktualizować prev przy glitchu y<start. */
    let peakBookFrameIndex = -1;

    const cached = { cw: 0, ch: 0, sx: 0, sy: 0, sw: 0, sh: 0 };

    /* ── Binary Subdivision Load Order ── */
    function buildLoadOrder(count: number) {
      const order: number[] = [];
      const added: Record<number, boolean> = {};

      function add(idx: number) {
        idx = Math.round(idx);
        if (idx < 0 || idx >= count || added[idx]) return;
        added[idx] = true;
        order.push(idx);
      }

      add(0);
      add(count - 1);

      let step = count;
      while (step > 1) {
        step = step / 2;
        for (let i = step; i < count; i += step) {
          add(Math.round(i));
        }
      }

      for (let j = 0; j < count; j++) { add(j); }

      return order;
    }

    const _PRIORITY_COUNT = 5; /* używane w PRODUCTION PATTERN (obecnie zakomentowany) */
    void _PRIORITY_COUNT;

    /* ── Find Nearest Loaded Frame ── */
    function findNearestLoaded(target: number) {
      if (loaded[target]) return target;
      for (let d = 1; d < FRAME_COUNT; d++) {
        if (target - d >= 0 && loaded[target - d]) return target - d;
        if (target + d < FRAME_COUNT && loaded[target + d]) return target + d;
      }
      return 0;
    }

    /** Nad start vs za end vs glitch pinu (y<start przy direction=1 + spadek progress). */
    function effectiveFrameForDraw(): number {
      const lastIdx = FRAME_COUNT - 1;
      const st = bookST;
      const currentP = st ? st.progress : 0;

      if (st && !st.isActive) {
        const y = st.scroll();
        const eps = 1;
        const prevP = prevBookSTProgress;

        /*
         * Po zejściu za `end` (scroll w dół): pin-spacer/RO wywołuje setupCanvasDPR często *zanim*
         * zdążą polecieć onLeave / onUpdate(progress≥0.95) — wtedy bookScrubPastEnd jest jeszcze false,
         * gałęzie poniżej nie ładują, a playhead bywa już 0 → jednorazowy „skok” na klatkę 0 po twardym refreshu.
         * Jeśli faktycznie rysowaliśmy już ostatnią klatkę (peak), trzymaj finał.
         */
        if (y >= st.end - eps && st.direction !== -1 && peakBookFrameIndex >= lastIdx) {
          prevBookSTProgress = currentP;
          return allLoaded ? lastIdx : findNearestLoaded(lastIdx);
        }

        if (y < st.start - eps) {
          /* Realny powrót nad sekcję w górę: direction -1 — zamknięta książka.
             Glitch przy pierwszym zejściu w dół: y chwilowo < start; prevP/bookScrubPastEnd bywa jeszcze niezsynchronizowane,
             ale jeśli ostatnia klatka była już narysowana (peak), trzymamy finał zamiast 0. */
          const forwardGlitch =
            st.direction !== -1 &&
            (peakBookFrameIndex >= lastIdx ||
              (bookScrubPastEnd && prevP >= 0.9));

          if (forwardGlitch) {
            prevBookSTProgress = currentP;
            return allLoaded ? lastIdx : findNearestLoaded(lastIdx);
          }
          prevBookSTProgress = currentP;
          return allLoaded ? 0 : findNearestLoaded(0);
        }

        if (bookScrubPastEnd && (y >= st.end - eps || currentP >= 0.95)) {
          prevBookSTProgress = currentP;
          return allLoaded ? lastIdx : findNearestLoaded(lastIdx);
        }

        /* Pierwsze zejście pinu: refresh często daje !isActive przy y jeszcze między start/end i p<0.95 — inaczej pada playhead 0. */
        if (bookScrubPastEnd) {
          prevBookSTProgress = currentP;
          return allLoaded ? lastIdx : findNearestLoaded(lastIdx);
        }
      }

      let t = Math.round(playhead.frame);
      if (st && st.progress > 0.95 && t < FRAME_COUNT - 3) {
        t = lastIdx;
      }
      /*
       * Pierwsze zejście z pinu: ResizeObserver → setupCanvasDPR często przy isActive===true.
       * Wtedy nie wchodzimy w gałąź !isActive, a GSAP chwilowo ma playhead≈0 + progress≈0 — bez tego rysuje się klatka 0.
       * direction === -1: użytkownik cofa w górę w strefie scrub — nie blokuj.
       */
      if (
        bookScrubPastEnd &&
        st &&
        t < FRAME_COUNT - 3 &&
        st.progress < 0.25 &&
        st.direction !== -1
      ) {
        t = lastIdx;
      }
      const out = allLoaded ? t : findNearestLoaded(t);
      if (st) prevBookSTProgress = st.progress;
      return out;
    }

    /* ── DPR-aware canvas setup ── */
    function setupCanvasDPR() {
      if (!canvas || !ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = bookContainer!.getBoundingClientRect();
      const cw = Math.round(rect.width);
      const ch = Math.round(rect.height);

      if (cw === cached.cw && ch === cached.ch) return;

      const newW = Math.round(rect.width * dpr);
      const newH = Math.round(rect.height * dpr);
      if (canvas.width !== newW || canvas.height !== newH) {
        canvas.width = newW;
        canvas.height = newH;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const iw = 1000, ih = 720;
      const scale = Math.max(cw / iw, ch / ih);
      cached.cw = cw;
      cached.ch = ch;
      cached.sw = Math.round(iw * scale);
      cached.sh = Math.round(ih * scale);
      cached.sx = Math.round((cw - cached.sw) / 2);
      cached.sy = Math.round((ch - cached.sh) / 2);

      if (loadedCount > 0) {
        displayIndex = -1;
        drawFrame(effectiveFrameForDraw());
      }
    }

    /* ── Draw frame (cover fit) ── */
    function drawFrame(index: number) {
      if (index === displayIndex) return;
      if (!ctx) return;

      const img = frames[index];
      if (!img) return;

      displayIndex = index;
      if (index > peakBookFrameIndex) peakBookFrameIndex = index;
      ctx.clearRect(0, 0, cached.cw, cached.ch);
      ctx.drawImage(img as CanvasImageSource, cached.sx, cached.sy, cached.sw, cached.sh);
    }

    /* ── onFrameLoaded (używane w PRODUCTION PATTERN gdy odkomentowany) ── */
    function onFrameLoaded(index: number) {
      loaded[index] = true;
      loadedCount++;
      if (loadedCount === FRAME_COUNT) allLoaded = true;

      const raw = Math.round(playhead.frame);
      const bestNow = effectiveFrameForDraw();

      if (Math.abs(bestNow - raw) < Math.abs(displayIndex - raw) || bestNow === raw) {
        drawFrame(bestNow);
      }
    }
    void onFrameLoaded; /* referencja żeby TS nie zgłaszał unused */

    /* ── ScrollTrigger animation ── */
    function createScrollAnimation() {
      if (typeof window === 'undefined' || !ScrollTrigger) return;
      gsap.registerPlugin(ScrollTrigger);

      bookTl = gsap.timeline({
        scrollTrigger: {
          trigger: floorImages,
          start: function() {
            const elH = (floorImages as HTMLElement).offsetHeight;
            const vh = window.innerHeight;
            const idealTop = elH < vh
              ? Math.round((vh - elH) / 2)
              : Math.max(150, Math.round(vh * 0.25));
            return 'top ' + idealTop;
          },
          end: function() {
            return '+=' + Math.round(Math.max(400, window.innerHeight * 0.45));
          },
          scrub: true,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate(self) {
            if (self.progress >= 0.95) bookScrubPastEnd = true;
          },
          onLeave() {
            bookScrubPastEnd = true;
          },
          onEnterBack() {
            bookScrubPastEnd = false;
            prevBookSTProgress = -1;
            peakBookFrameIndex = -1;
          },
          onLeaveBack() {
            bookScrubPastEnd = false;
            prevBookSTProgress = -1;
            peakBookFrameIndex = -1;
          },
        }
      });

      bookTl.to(playhead, {
        frame: FRAME_COUNT - 1,
        snap: 'frame',
        ease: 'none',
        onUpdate: function() {
          if (Math.round(playhead.frame) >= FRAME_COUNT - 1) bookScrubPastEnd = true;
          drawFrame(effectiveFrameForDraw());
        }
      });

      bookST = bookTl.scrollTrigger!;
      sectionST = bookST;
      _scrollEnabled = true;

      // Nie wywołujemy requestRefresh — globalny refresh przelicza ST we wszystkich sekcjach
      // (m.in. fakty) i psuje animacje przy scrolle od góry. Pin/scrub book-stats działają bez tego.
    }

    /* ── ResizeObserver ── */
    function setupResizeObserver() {
      if (!window.ResizeObserver) return;

      bookRO = new ResizeObserver(function() {
        cancelAnimationFrame(roRafId);
        roRafId = requestAnimationFrame(function() { setupCanvasDPR(); });
      });
      bookRO.observe(bookContainer!);
    }

    /* ── Preload: klatki z /books/Ksiazka-Klatki/ (frame-001.webp … frame-023.webp) ── */
    function startPreload() {
      if (preloadStarted) return;
      preloadStarted = true;

      const BASE_URL = '/books/Ksiazka-Klatki/';
      const loadOrder = buildLoadOrder(FRAME_COUNT);
      const loadQueue = loadOrder.slice();
      let concurrency = 0;
      const MAX_CONCURRENT = 3;

      function loadNext() {
        while (concurrency < MAX_CONCURRENT && loadQueue.length > 0) {
          const idx = loadQueue.shift()!;
          concurrency++;
          preloadSingleFrame(idx).then(function(loadedIdx: number) {
            concurrency--;
            onFrameLoaded(loadedIdx);

            if (!_scrollEnabled && loadedCount >= _PRIORITY_COUNT) {
              createScrollAnimation();
              setupResizeObserver();
              if (canvas) canvas.classList.add('is-ready');
            }

            loadNext();
          }).catch(function(err: unknown) {
            concurrency--;
            console.warn('Frame load failed:', err);
            loadNext();
          });
        }
      }

      function preloadSingleFrame(index: number): Promise<number> {
        const url = BASE_URL + 'frame-' + String(index + 1).padStart(3, '0') + '.webp';
        return fetch(url)
          .then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
            return res.blob();
          })
          .then(function(blob) {
            if (typeof window.createImageBitmap === 'function') {
              return createImageBitmap(blob).then(function(bmp) {
                frames[index] = bmp;
                return index;
              });
            }
            return new Promise(function(resolve) {
              const img = new Image();
              const objUrl = URL.createObjectURL(blob);
              img.onload = function() {
                URL.revokeObjectURL(objUrl);
                if (img.decode) {
                  img.decode().then(function() {
                    frames[index] = img;
                    resolve(index);
                  }).catch(function() {
                    frames[index] = img;
                    resolve(index);
                  });
                } else {
                  frames[index] = img;
                  resolve(index);
                }
              };
              img.onerror = function() {
                URL.revokeObjectURL(objUrl);
                resolve(index);
              };
              img.src = objUrl;
            });
          });
      }

      preloadSingleFrame(loadOrder[0]!).then(function(idx: number) {
        onFrameLoaded(idx);
        setupCanvasDPR();
        drawFrame(0);

        loadQueue.shift();
        loadNext();
      }).catch(function(err: unknown) {
        console.error('Critical: frame 0 failed to load', err);
      });
    }

    /* ── Sentry IO: early preload ── */
    const sentryEl = $id('book-stats-sentry');
    if (sentryEl) {
      sentryIO = new IntersectionObserver(function(entries) {
        if (entries[0]?.isIntersecting) {
          startPreload();
          sentryIO?.disconnect();
        }
      }, { rootMargin: '1000px 0px 1000px 0px' });
      sentryIO.observe(sentryEl);
      observers.push(sentryIO);
    } else {
      startPreload();
    }

    /* ── Cleanup ── */
    cleanups.push(function bookFramesCleanup() {
      if (bookST) {
        bookST.kill();
        bookST = null;
        sectionST = null;
      }
      if (bookTl) {
        bookTl.kill();
        bookTl = null;
      }

      cancelAnimationFrame(roRafId);
      if (bookRO) {
        bookRO.disconnect();
        bookRO = null;
      }

      if (sentryIO) {
        sentryIO.disconnect();
        sentryIO = null;
      }

      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
        const releaseCtx = canvas.getContext('2d');
        if (releaseCtx) releaseCtx.clearRect(0, 0, 1, 1);
        canvas.classList.remove('is-ready');
      }

      if (frames && frames.length) {
        frames.forEach(function(f) {
          if (f && typeof (f as any).close === 'function') (f as any).close();
        });
      }
      frames = [];
      for (let ci = 0; ci < FRAME_COUNT; ci++) { loaded[ci] = false; }
      loadedCount = 0;
      allLoaded = false;
      _scrollEnabled = false;
      void _scrollEnabled; /* read so TS does not flag unused (used in PRODUCTION PATTERN when uncommented) */
      preloadStarted = false;
      bookScrubPastEnd = false;
      prevBookSTProgress = -1;
      peakBookFrameIndex = -1;
      playhead.frame = 0;
      displayIndex = -1;
      ctx = null;
    });
  })();

  /* ========================================================
     KILL — pełny cleanup
     ======================================================== */
  function kill() {
    if (_killed) return; /* P3-CLEAN-01: idempotent — drugie wywołanie = no-op */
    _killed = true;
    cleanups.forEach(function(fn) { try { fn(); } catch(e) { /* swallow */ } });
    hfListeners.forEach(function(fn) { try { fn(); } catch(e) { /* swallow */ } });
    timerIds.forEach(function(id) { clearTimeout(id); clearInterval(id); });
    observers.forEach(function(o) { if (o && o.disconnect) o.disconnect(); });
    gsapInstances.forEach(function(inst) {
      if (inst && inst.revert) inst.revert();
      if (inst && inst.kill) inst.kill();
    });
    ready = false;
    spun = false;
  }

  /* ========================================================
     Typ B lifecycle: pause / resume
     Canvas + ScrollTrigger scrub = ST-native gating (Ścieżka 3a).
     Factory NIE wywołuje tych funkcji (pin+scrub = native gating).
     Zachowane dla kompatybilności lifecycle interfejsu.
     ⚠️ UWAGA: sectionST.disable() przy pin:true zwalnia pin-spacer.
     Bezpieczne TYLKO jeśli NIE wywoływane przez IO gating.
     ======================================================== */
  function pause() {
    if (_killed) return; /* P3-CLEAN-01: no-op after kill */
    if (sectionST) sectionST.disable();
  }

  function resume() {
    if (_killed) return; /* P3-CLEAN-01: no-op after kill */
    if (sectionST) sectionST.enable();
  }

  return { kill: kill, pause: pause, resume: resume };
}

export function BookStatsSection() {
  const rootRef = useRef<HTMLElement | null>(null);

  useGSAP(() => {
    gsap.registerPlugin(ScrollTrigger); // ← TUTAJ, nie na top-level (GSAP-SSR-01)

    const el = rootRef.current;
    if (!el) {
      // DEV: twardy sygnał — null tu oznacza błąd wiring-u ref w JSX
      if (process.env.NODE_ENV !== 'production') {
        throw new Error('[P3] rootRef.current is null — ref not attached to <section>.');
      }
      return;
    }
    const inst = init(el);
    return () => inst?.kill?.();
    // scope: useGSAP Context revertuje instancje GSAP z init() automatycznie
    // inst.kill() revertuje je powtórnie + czyści observers/timers/listeners
    // Double cleanup nie jest problemem — bezpieczeństwo wynika z:
    // 1. _killed guard w kill() — idempotencja gwarantowana przez kod, nie założenia o GSAP
    // 2. useGSAP scope — context revert czyszczony przez React
  }, { scope: rootRef });

  return (
    <section id="book-stats-section" className="section" ref={rootRef}>
      {/* SENTRY: Early preload trigger — inside section for React container scope */}
      <div id="book-stats-sentry" aria-hidden="true" style={{ height: 0, overflow: 'hidden', pointerEvents: 'none' }} />

      <div className="container">

        {/* PIĘTRO 1: OBRAZY */}
        <div className="cs-floor cs-floor--images">
          <div className="cs-floor__left">
            <video
              className="cs-img--stats cs-video"
              src="/books/Kalendarz_1-mute-video.mp4"
              poster="/books/Statystyki-stron.png"
              playsInline
              muted
              loop
              autoPlay
              preload="metadata"
              aria-hidden
            />
          </div>
          <div className="cs-floor__right">
            <div className="cs-img-placeholder cs-img--book">
              <canvas id="book-stats-canvas" aria-hidden="true" />
              <span className="cs-img-fallback">Książka · 1000 × 720</span>
            </div>
          </div>
        </div>

        <div className="cs-divider" />

        {/* PIĘTRO 2: TEKSTY */}
        <div className="cs-floor cs-floor--texts">
          <div className="cs-floor__left">
            <div className="cs-text-block">
              <h2>Rezultaty,<br />obserwowane<br />po&nbsp;<strong style={{ fontWeight: 800 }}>10</strong> miesiącach.</h2>
              <p>Większość przedsiębiorców<br /> <strong>obserwuje poprawę,</strong> w&nbsp;całym<br />procesie zdobywania klientów.</p>
            </div>
          </div>
          <div className="cs-floor__right">
            <div className="cs-stats-placeholder">

              {/* ========== COUNTER REELS ========== */}
              <div className="cs-counters">

                <div className="cs-counter-row" data-counter-row>
                  <div className="cs-counter-digits" data-counter data-digits="5,3" data-suffix="%" />
                  <div className="cs-counter-suffix" data-suffix-slot />
                  <div className="cs-counter-label">
                    <span className="cs-counter-heading">Więcej zapytań</span>
                    <span className="cs-counter-sub">Pewność ciągłości zamówień</span>
                  </div>
                </div>

                <div className="cs-counter-row" data-counter-row>
                  <div className="cs-counter-digits" data-counter data-digits="3,9" data-suffix="%" />
                  <div className="cs-counter-suffix" data-suffix-slot />
                  <div className="cs-counter-label">
                    <span className="cs-counter-heading">Wzrostu przychodów</span>
                    <span className="cs-counter-sub">Więcej pieniędzy w kieszeni</span>
                  </div>
                </div>

                <div className="cs-counter-row" data-counter-row>
                  <div className="cs-counter-digits" data-counter data-digits="1,0" data-suffix="h" />
                  <div className="cs-counter-suffix" data-suffix-slot />
                  <div className="cs-counter-label">
                    <span className="cs-counter-heading">Odzyskanych tygodniowo</span>
                    <span className="cs-counter-sub">Na tłumaczeniu klientom oferty</span>
                  </div>
                </div>

              </div>
              {/* ========== /COUNTER REELS ========== */}

            </div>
          </div>
        </div>

        <div className="cs-divider cs-divider--bottom" />

      </div>
    </section>
  );
}
