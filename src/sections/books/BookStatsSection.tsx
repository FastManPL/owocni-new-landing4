'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollRuntime } from '@/shared/scroll-runtime';
import './book-stats.css';

gsap.registerPlugin(ScrollTrigger);

/* ════════════════════════════════════════════════════════════════════════════
   book-stats — init(container)
   ════════════════════════════════════════════════════════════════════════════
   Typ B: canvas + ScrollTrigger scrub + drawFrame
   CPU Gating: Ścieżka 3a (N/A) — pin+scrub = natural gating
   ════════════════════════════════════════════════════════════════════════════ */

function init(container: HTMLElement | null): { kill: () => void; pause: () => void; resume: () => void } {
  /* [FIX-11] Null guard — SPA/lazy-load may call init before section is in DOM */
  if (!container) return { kill: function(){}, pause: function(){}, resume: function(){} };
  const $ = function(sel: string) { return container.querySelector(sel); };
  const $$ = function(sel: string) { return container.querySelectorAll(sel); };
  const $id = function(id: string) { return container.querySelector('#' + id); };

  const DEBUG_MODE = (new URLSearchParams(window.location.search)).has('debug')
    || localStorage.getItem('debug') === '1';

  const getScroll = function() { return scrollRuntime.scroll(); };

  const cleanups: Array<() => void> = [];
  const gsapInstances: Array<gsap.core.Tween | gsap.core.Timeline> = [];
  const timerIds: Array<ReturnType<typeof setTimeout>> = [];
  const observers: Array<IntersectionObserver | ResizeObserver> = [];
  const hfListeners: Array<() => void> = [];

  /* Shared ref for Typ B pause/resume — bookFrames IIFE populates this */
  let sectionST: ScrollTrigger | null = null;

  /* FACTORY: P3-CLEAN-01 — idempotency guard for React StrictMode */
  let _killed = false;

  /* ========================================================
     COUNTER REELS
     ======================================================== */
  const statsContainer = $('.cs-stats-placeholder') as HTMLElement | null;
  const rows = [].slice.call($$('[data-counter-row]')) as HTMLElement[];
  const wrappers = [].slice.call($$('[data-counter]')) as HTMLElement[];
  let ready = false;
  let spun = false;

  /* --- BUILD: bęben cyfrowy 0→target ---
     Logika identyczna z oryginałem:
     - digit=0 → fullRotations=1 (pełny obrót, ląduje na 0)
     - digit>0 → fullRotations=0 (bezpośredni spin do targetu)
     - _totalSteps = fullRotations×10 + target
     - translateY = _totalSteps × 1.05em (HARD CONSTRAINT)
  */
  function buildReel(parent: HTMLElement, target: number, fullRotations: number): HTMLDivElement & { _totalSteps: number } {
    const reel = document.createElement('div') as HTMLDivElement & { _totalSteps: number };
    reel.className = 'cs-reel';

    let n: number, r: number, d: HTMLDivElement;
    /* Bazowy cykl 0-9 (zawsze) */
    for (n = 0; n <= 9; n++) {
      d = document.createElement('div');
      d.className = 'cs-digit';
      d.innerText = String(n);
      reel.appendChild(d);
    }
    /* Dodatkowe pełne rotacje */
    for (r = 0; r < fullRotations; r++) {
      for (n = 0; n <= 9; n++) {
        d = document.createElement('div');
        d.className = 'cs-digit';
        d.innerText = String(n);
        reel.appendChild(d);
      }
    }
    /* Tail: docieranie do targetu po rotacjach */
    if (fullRotations > 0 && target > 0) {
      for (n = 0; n <= target; n++) {
        d = document.createElement('div');
        d.className = 'cs-digit';
        d.innerText = String(n);
        reel.appendChild(d);
      }
    }

    reel._totalSteps = fullRotations * 10 + target;
    parent.appendChild(reel);
    return reel;
  }

  function buildCounter(w: HTMLElement & { _reels?: Array<HTMLDivElement & { _totalSteps: number }> }) {
    w.innerHTML = '';
    const digits = (w.dataset.digits || '0').split(',').map(Number);

    const reels = digits.map(function(digit) {
      const rotations = digit === 0 ? 1 : 0;
      return buildReel(w, digit, rotations);
    });

    /* Suffix: budowany dynamicznie w sąsiednim slocie */
    const row = w.closest('[data-counter-row]');
    const suffixSlot = row?.querySelector('[data-suffix-slot]');
    if (suffixSlot) {
      suffixSlot.innerHTML = '';
      const sym = document.createElement('span');
      sym.className = 'cs-suffix-symbol';
      sym.innerText = w.dataset.suffix || '';
      suffixSlot.appendChild(sym);
    }

    w._reels = reels;
  }

  /* --- SPIN: fire & forget + heading sweep ---
     rAF w spinAll są fire-and-forget, NIE wchodzą do timerIds.
     CSS transitions na reelach nie podlegają cleanup (zamierzone). */
  function spinAll() {
    if (spun) return;
    spun = true;

    /* #16: Collect all reels for will-change lifecycle */
    const allReels: Array<HTMLDivElement & { _totalSteps: number }> = [];
    wrappers.forEach(function(w: HTMLElement & { _reels?: Array<HTMLDivElement & { _totalSteps: number }> }) {
      if (!w._reels) return;
      w._reels.forEach(function(reel) { allReels.push(reel); });
    });

    /* #16: Promote to GPU layers BEFORE animation starts */
    allReels.forEach(function(reel) { reel.style.willChange = 'transform'; });

    wrappers.forEach(function(w: HTMLElement & { _reels?: Array<HTMLDivElement & { _totalSteps: number }> }) {
      if (!w._reels) return;
      w._reels.forEach(function(reel, i) {
        reel.style.transitionDelay = i * 120 + 'ms';
        /* Double-rAF: gwarantuje że przeglądarka zacommituje
           początkowy stan (translateY:0) przed ustawieniem celu.
           Bez tego transition może nie odpalić. */
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            reel.style.transform = 'translateY(-' + (reel._totalSteps * 1.05) + 'em)';
          });
        });
      });
    });

    /* #16: Reclaim GPU layers after last reel finishes.
       Last reel = longest delay. Listen once, clean all.
       [FIX-8] Watchdog timer: if transitionend fails (device sleep, tab bg),
       setTimeout at 2500ms (--cr-duration=2400ms + 100ms buffer) ensures cleanup. */
    if (allReels.length > 0) {
      const lastReel = allReels[allReels.length - 1];
      let fallbackTimer: ReturnType<typeof setTimeout>;
      const cleanupLayers = function() {
        lastReel.removeEventListener('transitionend', onSpinEnd);
        clearTimeout(fallbackTimer);
        allReels.forEach(function(r) { r.style.willChange = 'auto'; });
      };
      const onSpinEnd = function(e: TransitionEvent) {
        if (e.propertyName !== 'transform') return;
        cleanupLayers();
      };
      lastReel.addEventListener('transitionend', onSpinEnd);
      fallbackTimer = setTimeout(cleanupLayers, 2500);
      cleanups.push(cleanupLayers);
    }

    /* Headingi: sweep kolor left→right z bounce.out */
    /* [FIX-12] Guard — CDN fail degrades gracefully (headings stay gray) */
    const headings = [].slice.call(container.querySelectorAll('.cs-counter-heading')) as HTMLElement[];
    headings.forEach(function(h, i) {
      const tween = gsap.to(h, {
        backgroundPosition: '0% 0',
        duration: 3,
        delay: 0.3 + i * 0.15,
        ease: 'bounce.out'
      });
      gsapInstances.push(tween);
    });
  }

  /* --- IO: build reels when stats placeholder enters viewport ---
     #11: Counters are now built EAGERLY in init (below).
     IO only sets ready + adds .visible classes (opacity fade-in).
     This eliminates ~90 DOM node insertions from scroll-time. */

  /* EAGER BUILD: counters constructed immediately (hidden, opacity 0) */
  wrappers.forEach(function(w) { buildCounter(w as HTMLElement & { _reels?: Array<HTMLDivElement & { _totalSteps: number }> }); });

  let counterObserver: IntersectionObserver | null = null;
  if (statsContainer) {
    counterObserver = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting && !ready) {
        ready = true;
        rows.forEach(function(row, i) {
          const tid = setTimeout(function() { row.classList.add('visible'); }, i * 180);
          timerIds.push(tid);
        });
        counterObserver?.disconnect();
      }
    }, { threshold: 0.01 });
    counterObserver.observe(statsContainer);
    observers.push(counterObserver);
  }

  /* --- Scroll trigger: spin when 80% in viewport ---
     Sprawdza pozycję .cs-stats-placeholder (nie całej sekcji). */
  function onScroll() {
    if (!ready || spun || !statsContainer) return;
    const rect = statsContainer.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.80) {
      spinAll();
      /* OPT #5: Mission done — detach immediately. Eliminates
         all further scroll-driven layout reads for counters. */
      window.removeEventListener('scroll', onScroll);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(function() { window.removeEventListener('scroll', onScroll); });

  /* ========================================================
     BOOK FRAME SEQUENCE — Canvas scroll animation
     ========================================================
     Architecture: Type A (standard ScrollTrigger, no velocity)
     Integration: scrollRuntime-compatible (requestRefresh, no direct ST.refresh)
     Pattern: GSAP official imageSequenceScrub + research-backed DPR/cleanup
     ======================================================== */
  (function bookFrames() {
    const FRAME_COUNT = 23;
    const bookContainer = $('.cs-img--book') as HTMLElement | null;
    const canvas = $id('book-stats-canvas') as HTMLCanvasElement | null;
    if (!bookContainer || !canvas) return;

    let ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    /* [FIX-3] ctx null guard — iOS low-memory: getContext returns null.
       Early return from IIFE → fallback label stays visible, counters work normally. */
    if (!ctx) return;
    let frames: Array<HTMLCanvasElement | HTMLImageElement | ImageBitmap | null> = new Array(FRAME_COUNT);
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
    let scrollEnabled = false;
    let allLoaded = false;
    let roRafId = 0;

    /* OPT #1: Cached geometry — updated ONLY in setupCanvasDPR/RO.
       Eliminates getBoundingClientRect() from hot path (60-120×/s → 0). */
    const cached = { cw: 0, ch: 0, sx: 0, sy: 0, sw: 0, sh: 0 };

    /* ============================================================
       Binary Subdivision Load Order
       ============================================================ */
    function buildLoadOrder(count: number): number[] {
      const order: number[] = [];
      const added: Record<number, boolean> = {};

      function add(idx: number) {
        idx = Math.round(idx);
        if (idx < 0 || idx >= count || added[idx]) return;
        added[idx] = true;
        order.push(idx);
      }

      /* Wave 1: bookends */
      add(0);
      add(count - 1);

      /* Wave 2-N: binary subdivision */
      let step = count;
      while (step > 1) {
        step = step / 2;
        for (let i = step; i < count; i += step) {
          add(Math.round(i));
        }
      }

      /* Safety: fill any gaps */
      for (let j = 0; j < count; j++) { add(j); }

      return order;
    }

    const PRIORITY_COUNT = 5;

    /* ============================================================
       Find Nearest Loaded Frame
       ============================================================ */
    function findNearestLoaded(target: number): number {
      if (loaded[target]) return target;
      for (let d = 1; d < FRAME_COUNT; d++) {
        if (target - d >= 0 && loaded[target - d]) return target - d;
        if (target + d < FRAME_COUNT && loaded[target + d]) return target + d;
      }
      return 0;
    }

    /* --- Generate placeholder frames (colored canvases with numbers) --- */
    function generatePlaceholders(): HTMLCanvasElement[] {
      const arr: HTMLCanvasElement[] = new Array(FRAME_COUNT);
      for (let i = 0; i < FRAME_COUNT; i++) {
        const hue = Math.round((i / FRAME_COUNT) * 300 + 20);
        const offscreen = document.createElement('canvas');
        offscreen.width = 1000;
        offscreen.height = 720;
        const octx = offscreen.getContext('2d');
        if (!octx) continue;

        /* Background gradient */
        const grad = octx.createLinearGradient(0, 0, 1000, 720);
        grad.addColorStop(0, 'hsl(' + hue + ', 30%, 75%)');
        grad.addColorStop(1, 'hsl(' + ((hue + 40) % 360) + ', 25%, 65%)');
        octx.fillStyle = grad;
        octx.fillRect(0, 0, 1000, 720);

        /* Frame number */
        octx.fillStyle = 'rgba(0,0,0,0.25)';
        octx.font = 'bold 180px sans-serif';
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillText(String(i + 1), 500, 340);

        /* Label */
        octx.fillStyle = 'rgba(0,0,0,0.15)';
        octx.font = '32px sans-serif';
        octx.fillText('Frame ' + (i + 1) + ' / ' + FRAME_COUNT, 500, 460);

        arr[i] = offscreen;
      }
      return arr;
    }

    /* --- DPR-aware canvas setup --- */
    function setupCanvasDPR() {
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = bookContainer!.getBoundingClientRect();
      const cw = Math.round(rect.width);
      const ch = Math.round(rect.height);

      if (cw === cached.cw && ch === cached.ch) return;

      const newW = Math.round(rect.width * dpr);
      const newH = Math.round(rect.height * dpr);
      if (canvas!.width !== newW || canvas!.height !== newH) {
        canvas!.width = newW;
        canvas!.height = newH;
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
        drawFrame(findNearestLoaded(Math.round(playhead.frame)));
      }
    }

    /* --- Draw frame (cover fit) --- */
    function drawFrame(index: number) {
      if (index === displayIndex) return;
      if (!ctx) return;

      const img = frames[index];
      if (!img) return;

      displayIndex = index;
      ctx.clearRect(0, 0, cached.cw, cached.ch);
      ctx.drawImage(img as CanvasImageSource, cached.sx, cached.sy, cached.sw, cached.sh);
    }

    /* --- Called after each new frame loads --- */
    function onFrameLoaded(index: number) {
      loaded[index] = true;
      loadedCount++;
      if (loadedCount === FRAME_COUNT) allLoaded = true;

      const target = Math.round(playhead.frame);
      const bestNow = allLoaded ? target : findNearestLoaded(target);

      if (Math.abs(bestNow - target) < Math.abs(displayIndex - target) || bestNow === target) {
        drawFrame(bestNow);
      }
    }

    /* --- GSAP ScrollTrigger animation --- */
    function createScrollAnimation() {
      const floorImages = $('.cs-floor--images') as HTMLElement | null;
      if (!floorImages) return;

      bookTl = gsap.timeline({
        scrollTrigger: {
          trigger: floorImages,
          start: function() {
            const elH = floorImages.offsetHeight;
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
        }
      });

      bookTl.to(playhead, {
        frame: FRAME_COUNT - 1,
        snap: 'frame',
        ease: 'none',
        onUpdate: function() {
          const target = Math.round(playhead.frame);
          drawFrame(allLoaded ? target : findNearestLoaded(target));
        }
      });

      bookST = bookTl.scrollTrigger!;
      sectionST = bookST;
      scrollEnabled = true;

      /* Signal scrollRuntime (production) */
      if (scrollRuntime.requestRefresh) {
        scrollRuntime.requestRefresh('book-frames-loaded');
      }
    }

    /* --- ResizeObserver --- */
    function setupResizeObserver() {
      if (!window.ResizeObserver) return;

      bookRO = new ResizeObserver(function() {
        cancelAnimationFrame(roRafId);
        roRafId = requestAnimationFrame(function() { setupCanvasDPR(); });
      });
      bookRO.observe(bookContainer!);
    }

    /* ============================================================
       Preload — TEST SHELL (placeholders)
       ============================================================ */
    function startPreload() {
      if (preloadStarted) return;
      preloadStarted = true;

      /* TEST SHELL: instant placeholder generation */
      const placeholders = generatePlaceholders();
      const loadOrder = buildLoadOrder(FRAME_COUNT);

      for (let i = 0; i < loadOrder.length; i++) {
        const idx = loadOrder[i];
        frames[idx] = placeholders[idx];
        loaded[idx] = true;
        loadedCount++;
      }
      allLoaded = true;

      setupCanvasDPR();
      drawFrame(0);
      canvas!.classList.add('is-ready');

      createScrollAnimation();
      setupResizeObserver();
    }

    /* --- Sentry IO: start preload early (1000px before section) --- */
    const sentryEl = $id('book-stats-sentry');
    if (sentryEl) {
      sentryIO = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) {
          startPreload();
          sentryIO?.disconnect();
        }
      }, { rootMargin: '1000px 0px 1000px 0px' });
      sentryIO.observe(sentryEl);
      observers.push(sentryIO);
    } else {
      startPreload();
    }

    /* --- Cleanup: register in kill() pipeline --- */
    cleanups.push(function bookFramesCleanup() {
      /* 1. Kill ScrollTrigger + timeline */
      if (bookST) {
        bookST.kill();
        bookST = null;
        sectionST = null;
      }
      if (bookTl) {
        bookTl.kill();
        bookTl = null;
      }

      /* 2. ResizeObserver + pending rAF */
      cancelAnimationFrame(roRafId);
      if (bookRO) {
        bookRO.disconnect();
        bookRO = null;
      }

      /* 3. Sentry IO */
      if (sentryIO) {
        sentryIO.disconnect();
        sentryIO = null;
      }

      /* 4. Canvas memory release (Safari iOS pattern — width=1, not 0) */
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
        const releaseCtx = canvas.getContext('2d');
        if (releaseCtx) releaseCtx.clearRect(0, 0, 1, 1);
        canvas.classList.remove('is-ready');
      }

      /* 5. Release ImageBitmaps (explicit .close() for GPU memory) */
      if (frames && frames.length) {
        frames.forEach(function(f) {
          if (f && typeof (f as ImageBitmap).close === 'function') (f as ImageBitmap).close();
        });
      }
      frames = [];
      for (let ci = 0; ci < FRAME_COUNT; ci++) { loaded[ci] = false; }
      loadedCount = 0;
      allLoaded = false;
      scrollEnabled = false;
      preloadStarted = false;
      playhead.frame = 0;
      displayIndex = -1;
      ctx = null;
    });
  })();

  /* ========================================================
     KILL — pełny cleanup
     ======================================================== */
  function kill() {
    /* FACTORY: P3-CLEAN-01 — idempotency guard */
    if (_killed) return;
    _killed = true;

    cleanups.forEach(function(fn) { try { fn(); } catch(e) {} });
    hfListeners.forEach(function(fn) { try { fn(); } catch(e) {} });
    timerIds.forEach(function(id) { clearTimeout(id); clearInterval(id); });
    observers.forEach(function(o) { if (o && o.disconnect) o.disconnect(); });
    gsapInstances.forEach(function(inst) {
      if (inst && (inst as gsap.core.Timeline).revert) (inst as gsap.core.Timeline).revert();
      if (inst && inst.kill) inst.kill();
    });
    ready = false;
    spun = false;
  }

  /* ========================================================
     Typ B lifecycle: pause / resume
     ======================================================== */
  function pause() {
    if (sectionST) sectionST.disable();
  }

  function resume() {
    if (sectionST) sectionST.enable();
  }

  return { kill: kill, pause: pause, resume: resume };
}

/* ════════════════════════════════════════════════════════════════════════════
   React Component
   ════════════════════════════════════════════════════════════════════════════ */

export default function BookStatsSection() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const inst = init(rootRef.current);
    return () => inst?.kill?.();
  }, { scope: rootRef });

  return (
    <>
      {/* SENTRY: Early preload trigger for book frame sequence */}
      <div id="book-stats-sentry" aria-hidden="true" style={{ height: 0, overflow: 'hidden', pointerEvents: 'none' }} />

      <section id="book-stats-section" className="section" ref={rootRef}>
        <div className="container">

          {/* PIĘTRO 1: OBRAZY */}
          <div className="cs-floor cs-floor--images">
            <div className="cs-floor__left">
              <div className="cs-img-placeholder cs-img--stats"><span>Statystyki · 606 × 456</span></div>
            </div>
            <div className="cs-floor__right">
              <div className="cs-img-placeholder cs-img--book">
                <canvas id="book-stats-canvas" aria-hidden="true"></canvas>
                <span className="cs-img-fallback">Książka · 1000 × 720</span>
              </div>
            </div>
          </div>

          <div className="cs-divider"></div>

          {/* PIĘTRO 2: TEKSTY */}
          <div className="cs-floor cs-floor--texts">
            <div className="cs-floor__left">
              <div className="cs-text-block">
                <h2>Rezultaty,<br/>obserwowane<br/>po&nbsp;<strong style={{ fontWeight: 800 }}>10</strong>&nbsp;miesiącach.</h2>
                <p>Większość przedsiębiorców<br/>obserwuje poprawę, w&nbsp;całym<br/>procesie zdobywania klientów.</p>
              </div>
            </div>
            <div className="cs-floor__right">
              <div className="cs-stats-placeholder">

                {/* ========== COUNTER REELS ========== */}
                <div className="cs-counters">

                  <div className="cs-counter-row" data-counter-row>
                    <div className="cs-counter-digits" data-counter data-digits="5,3" data-suffix="%"></div>
                    <div className="cs-counter-suffix" data-suffix-slot></div>
                    <div className="cs-counter-label">
                      <span className="cs-counter-heading">Więcej zapytań</span>
                      <span className="cs-counter-sub">Pewność ciągłości zamówień</span>
                    </div>
                  </div>

                  <div className="cs-counter-row" data-counter-row>
                    <div className="cs-counter-digits" data-counter data-digits="3,9" data-suffix="%"></div>
                    <div className="cs-counter-suffix" data-suffix-slot></div>
                    <div className="cs-counter-label">
                      <span className="cs-counter-heading">Wzrostu przychodów</span>
                      <span className="cs-counter-sub">Więcej pieniędzy w kieszeni</span>
                    </div>
                  </div>

                  <div className="cs-counter-row" data-counter-row>
                    <div className="cs-counter-digits" data-counter data-digits="1,0" data-suffix="h"></div>
                    <div className="cs-counter-suffix" data-suffix-slot></div>
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

        </div>
      </section>
    </>
  );
}
