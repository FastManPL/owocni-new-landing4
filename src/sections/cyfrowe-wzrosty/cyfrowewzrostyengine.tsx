'use client';

import { useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { scrollRuntime } from '@/lib/scrollRuntime';
import './cyfrowe-wzrosty-section.css';

// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// registerPlugin() WYŁĄCZNIE wewnątrz useGSAP(() => { ... }) jak poniżej.

// ═══════════════════════════════════════════════════════════════
// init(container) — 1:1 z reference.html (P2A), z:
//   - _killed guard (P3-CLEAN-01)
//   - DEBUG_MODE usunięty (TS-LINT-UNUSED-01: dead code)
//   - Adnotacje TypeScript (TS strict)
//   - IO-SAFE-01 guard na entries[0]
//   - ARRAY-ASSIGN-01 guard na parseInt(dataset)
//   - scrollRuntime: import modułowy (nie window global)
// ═══════════════════════════════════════════════════════════════
function init(container: HTMLElement): { pause: () => void; resume: () => void; kill: () => void } {

  var $$ = function(sel: string) { return container.querySelectorAll<HTMLElement>(sel); };
  var $id = function(id: string) { return container.querySelector<HTMLElement>('#' + id); };

  var _killed = false;
  var cleanups: Array<() => void> = [];
  var gsapInstances: Array<gsap.core.Animation> = [];
  var timerIds: number[] = [];
  var observers: IntersectionObserver[] = [];

  // ═══════════════════════════════════════════════════════════════
  // 3D TEXT — TICKER STATE (Type B)
  // ═══════════════════════════════════════════════════════════════
  var tickFn: (() => void) | null = null;
  var ticking = false;

  // === CONFIG ===
  var WORD = "WZROSTU";
  var WORD_LEN = WORD.length;

  var CASCADE_START  = 0.0;
  var CASCADE_SPREAD = 0.12;
  var CASCADE_RAMP   = 0.45;
  var CHAIN_COUPLING = 0.18;

  var LAYERS_PER_LETTER = [1, 7, 11, 14, 18, 20, 23];
  var LAYER_OFFSET = 2.5;
  var MAX_DEPTH    = 7;
  var WZROST_BASE_DEPTHS = [0, 0.9, 1.4, 2.2, 3.2, 4.5, 6.6];

  var STIFFNESS   = 0.025;
  var DAMPING     = 0.85;

  var HORIZON_RATIO        = 0.65;
  var PERSPECTIVE_STRENGTH = 1.0;
  var MAX_TILT             = 1.5;
  var ANIMATION_THRESHOLD  = 0.35;

  var SETTLE_FRAMES   = 6;
  var SETTLE_VEL_EPS  = 0.005;
  var DIRTY_VD_EPS    = 0.03;
  var DIRTY_TILT_EPS  = 0.005;

  function clamp(v: number, mn: number, mx: number) { return Math.max(mn, Math.min(mx, v)); }
  function smoothstep(t: number) { return t * t * (3 - 2 * t); }

  // PRECOMPUTE LAYER CONFIGS
  var LETTER_LAYER_CONFIGS: Array<Array<{ isTop: boolean; deltaR: number; deltaG: number; deltaB: number; zMul: number }>> = [];
  for (var lci = 0; lci < WORD_LEN; lci++) {
    var count = LAYERS_PER_LETTER[lci] ?? 0;
    var configs: Array<{ isTop: boolean; deltaR: number; deltaG: number; deltaB: number; zMul: number }> = [];
    for (var i = 0; i < count; i++) {
      var n = (i + 1) / count;
      var isTop = i === count - 1;
      var bR = 232 + n * 23;
      var bG = 228 + n * 27;
      var bB = 224 + n * 31;
      configs[i] = {
        isTop: isTop,
        deltaR: bR - 247,
        deltaG: bG - 246,
        deltaB: bB - 244,
        zMul: (i + 1) * LAYER_OFFSET
      };
    }
    LETTER_LAYER_CONFIGS[lci] = configs;
  }

  // PHYSICS STATE
  var curDepth = new Float64Array(WORD_LEN);
  var tgtDepth = new Float64Array(WORD_LEN);
  var vel      = new Float64Array(WORD_LEN);
  var prevD    = new Float64Array(WORD_LEN);

  // DIRTY CHECK STATE
  var lastVd   = new Float64Array(WORD_LEN);
  var lastTilt = new Float64Array(WORD_LEN);
  for (var si = 0; si < WORD_LEN; si++) {
    lastVd[si]   = -1;
    lastTilt[si] = -999;
  }

  var settledFrames = 0;
  var frameCount = 0;

  // POINTER
  var mouseActive = false;
  var ptrX = 0, ptrY = 0;

  // PUNCH
  var punch = new Float64Array(WORD_LEN);
  var PUNCH_FALLOFF = [1.0, 0.65, 0.35];

  function startPunch(ci: number) {
    for (var o = 0; o < PUNCH_FALLOFF.length; o++) {
      var s = PUNCH_FALLOFF[o] ?? 0;
      if (ci - o >= 0) punch[ci - o] = Math.max(punch[ci - o], s);
      if (o > 0 && ci + o < WORD_LEN) punch[ci + o] = Math.max(punch[ci + o], s);
    }
    for (var j = 0; j < WORD_LEN; j++) {
      if (punch[j] > 0) vel[j] += 0.8 * punch[j];
    }
  }

  function endPunch() {
    for (var j = 0; j < WORD_LEN; j++) {
      if (punch[j] > 0) vel[j] *= 0.1;
    }
    punch.fill(0);
  }

  // SCROLL — Type B: read from scrollRuntime, skip first frame
  var prevScroll = 0;
  var isFirstFrame = true;

  var depthScale = 1.0;

  // CACHED GEOMETRY
  var cachedStageH = 0;
  var cachedHY     = 0;
  var cachedNorm   = 0;
  var cachedStageBottom = 0;
  var cachedLetterCx      = new Float64Array(WORD_LEN);
  var cachedLetterBaseCy  = new Float64Array(WORD_LEN);
  var cachedLetterBaseTop = new Float64Array(WORD_LEN);

  function cacheGeometry() {
    depthScale = clamp(window.innerWidth / 1200, 0.3, 1.0);

    cachedStageH = stageEl.offsetHeight || window.innerHeight;
    cachedHY   = cachedStageH * HORIZON_RATIO;
    cachedNorm = cachedStageH * 0.5;

    var scroll = scrollRuntime.getScroll();
    var stageRect = stageEl.getBoundingClientRect();
    cachedStageBottom = stageRect.bottom + scroll;

    for (var ci = 0; ci < WORD_LEN; ci++) {
      var rect = letterEls[ci].getBoundingClientRect();
      cachedLetterCx[ci]      = rect.left + rect.width * 0.5;
      cachedLetterBaseCy[ci]  = rect.top  + rect.height * 0.5 + scroll;
      cachedLetterBaseTop[ci] = rect.top  + scroll;
    }

    for (var ri = 0; ri < WORD_LEN; ri++) {
      lastVd[ri]   = -1;
      lastTilt[ri] = -999;
    }

    // Tiles geometry
    tilesRecalcGeometry();

    // Tiles reveal trigger
    var viewH = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
    if (tiles.length && !tilesRevealed) {
      var firstTileRect = tiles[0].getBoundingClientRect();
      var tileMidInContent = firstTileRect.top + scroll + firstTileRect.height * 0.5;
      cachedTilesRevealScroll = Math.max(0, tileMidInContent - viewH);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILD DOM — 3D TEXT
  // ═══════════════════════════════════════════════════════════════
  var lettersRow = $id('cyfrowe-wzrosty-letters-row');
  var stageEl    = $id('cyfrowe-wzrosty-stage');
  var contentEl  = $id('cyfrowe-wzrosty-content');

  if (!lettersRow || !stageEl || !contentEl) {
    return { pause: function(){}, resume: function(){}, kill: function(){} };
  }

  var letterEls: HTMLDivElement[] = [];
  var layerEls: HTMLDivElement[][] = [];

  for (var ci = 0; ci < WORD_LEN; ci++) {
    var ch = WORD[ci];

    var wrap = document.createElement('div');
    wrap.className = 'letter-wrap';
    wrap.dataset.idx = String(ci);
    wrap.style.cursor = 'pointer';

    var sizer = document.createElement('span');
    sizer.className = 'letter-sizer';
    sizer.textContent = ch;
    wrap.appendChild(sizer);

    var lc = document.createElement('div');
    lc.className = 'layers-container';

    var arr: HTMLDivElement[] = [];
    var layerCount = LAYERS_PER_LETTER[ci];
    var lConfigs = LETTER_LAYER_CONFIGS[ci];
    for (var li = 0; li < layerCount; li++) {
      var layer = document.createElement('div');
      layer.className = li === layerCount - 1 ? 'layer layer-top' : 'layer';
      layer.textContent = ch;

      var cfg = lConfigs[li];
      if (cfg.isTop) {
        layer.style.color = 'rgb(255,255,255)';
      } else {
        layer.style.color = 'rgb(' +
          (247 + cfg.deltaR + 0.5 | 0) + ',' +
          (246 + cfg.deltaG + 0.5 | 0) + ',' +
          (244 + cfg.deltaB + 0.5 | 0) + ')';
      }

      lc.appendChild(layer);
      arr[li] = layer;
    }
    layerEls[ci] = arr;

    wrap.appendChild(lc);
    lettersRow.appendChild(wrap);
    letterEls[ci] = wrap;
  }

  // ═══════════════════════════════════════════════════════════════
  // DOM REFS — TILES
  // ═══════════════════════════════════════════════════════════════
  var tilesTrackEl   = $id('cyfrowe-wzrosty-track');
  var tiles          = $$('.tile');
  var dots         = $$('.pagination-dot');
  var prevBtn      = $id('cyfrowe-wzrosty-prevBtn');
  var nextBtn      = $id('cyfrowe-wzrosty-nextBtn');

  var tilesCurrentIndex = 0;
  var tilesRevealTL: gsap.core.Timeline | null = null;
  var tilesRevealed     = false;
  var cachedTilesRevealScroll = 0;

  // ═══════════════════════════════════════════════════════════════
  // TILES — GEOMETRY CACHE
  // ═══════════════════════════════════════════════════════════════
  var tilesCachedStride    = 0;
  var tilesCachedMaxScroll = 0;
  var tilesCount           = tiles.length;

  function tilesRecalcGeometry() {
    if (!tilesTrackEl || !tiles.length) return;
    var firstTile = tiles[0];
    var tileW     = firstTile.offsetWidth;
    var gapRaw = (getComputedStyle(container).getPropertyValue('--gap') || '').trim();
    var gapVal: number;
    if (gapRaw.slice(-3) === 'rem') {
      var rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      gapVal = parseFloat(gapRaw) * rootFs;
    } else {
      gapVal = parseFloat(gapRaw) || 32;
    }
    tilesCachedStride    = tileW + gapVal;
    tilesCachedMaxScroll = tilesTrackEl.scrollWidth - tilesTrackEl.clientWidth;
  }

  // ═══════════════════════════════════════════════════════════════
  // TILES — REVEAL
  // ═══════════════════════════════════════════════════════════════
  function tilesInitReveal() {
    if (tilesRevealed) return;
    tilesRevealed = true;

    if (!hasHover) {
      tiles.forEach(function(tile) { tile.classList.add('is-visible'); });
      return;
    }

    if (tilesRevealTL) tilesRevealTL.kill();

    var origOverflow = tilesTrackEl ? tilesTrackEl.style.overflow : '';
    if (tilesTrackEl) tilesTrackEl.style.overflow = 'hidden';

    tilesRevealTL = gsap.timeline({
      onComplete: function() {
        tiles.forEach(function(tile) { tile.classList.add('is-visible'); });
        gsap.set(tiles, { clearProps: 'all' });
        if (tilesTrackEl) tilesTrackEl.style.overflow = origOverflow || '';
      }
    });
    gsapInstances.push(tilesRevealTL);

    tilesRevealTL.fromTo(tiles,
      {
        opacity: 0,
        x: function(i: number) { return 80 + i * 60; },
        y: 20,
        scale: 0.97,
        rotation: function(i: number) { return 1.5 + i * 0.5; }
      },
      {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        duration: 0.9,
        ease: 'back.out(1.4)',
        stagger: {
          each: 0.04,
          from: 'start'
        }
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // TILES — DRAG TO SCROLL (desktop mouse only)
  // ═══════════════════════════════════════════════════════════════
  var tilesDragActive = false;
  var tilesDragStartX = 0;
  var tilesDragScrollLeft = 0;
  var tilesDragTrackLeft = 0;

  function tilesDragDown(e: MouseEvent) {
    if (!tilesTrackEl) return;
    tilesDragActive = true;
    tilesTrackEl.style.scrollSnapType = 'none';
    tilesTrackEl.style.cursor = 'grabbing';
    tilesDragTrackLeft = tilesTrackEl.offsetLeft;
    tilesDragStartX = e.pageX - tilesDragTrackLeft;
    tilesDragScrollLeft = tilesTrackEl.scrollLeft;
  }

  function tilesDragLeave() {
    if (tilesDragActive && tilesTrackEl) {
      tilesDragActive = false;
      tilesTrackEl.style.scrollSnapType = 'x mandatory';
      tilesTrackEl.style.cursor = 'grab';
    }
  }

  function tilesDragUp() {
    if (tilesDragActive && tilesTrackEl) {
      tilesDragActive = false;
      tilesTrackEl.style.scrollSnapType = 'x mandatory';
      tilesTrackEl.style.cursor = 'grab';
    }
  }

  function tilesDragMove(e: MouseEvent) {
    if (!tilesDragActive || !tilesTrackEl) return;
    e.preventDefault();
    var x = e.pageX - tilesDragTrackLeft;
    var walk = (x - tilesDragStartX) * 1.5;
    tilesTrackEl.scrollLeft = tilesDragScrollLeft - walk;
  }

  if (tilesTrackEl) {
    tilesTrackEl.addEventListener('mousedown', tilesDragDown);
    cleanups.push(function() { tilesTrackEl!.removeEventListener('mousedown', tilesDragDown); });

    tilesTrackEl.addEventListener('mouseleave', tilesDragLeave);
    cleanups.push(function() { tilesTrackEl!.removeEventListener('mouseleave', tilesDragLeave); });

    tilesTrackEl.addEventListener('mouseup', tilesDragUp);
    cleanups.push(function() { tilesTrackEl!.removeEventListener('mouseup', tilesDragUp); });

    tilesTrackEl.addEventListener('mousemove', tilesDragMove);
    cleanups.push(function() { tilesTrackEl!.removeEventListener('mousemove', tilesDragMove); });
  }

  // ═══════════════════════════════════════════════════════════════
  // TILES — NAVIGATION
  // ═══════════════════════════════════════════════════════════════
  function tilesScrollTo(index: number) {
    if (!tilesTrackEl) return;
    if (index < 0 || index >= tilesCount) return;
    tilesTrackEl.style.scrollSnapType = 'none';

    var tween = gsap.to(tilesTrackEl, {
      scrollLeft: index * tilesCachedStride,
      duration: 0.7,
      ease: 'expo.out',
      onComplete: function() {
        if (tilesTrackEl) tilesTrackEl.style.scrollSnapType = 'x mandatory';
        tilesCurrentIndex = index;
        tilesUpdateUI();
      }
    });
    gsapInstances.push(tween);
  }

  function tilesOnPrev() {
    if (tilesCurrentIndex > 0) tilesScrollTo(tilesCurrentIndex - 1);
  }
  function tilesOnNext() {
    if (tilesCurrentIndex < tilesCount - 1) tilesScrollTo(tilesCurrentIndex + 1);
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', tilesOnPrev);
    cleanups.push(function() { prevBtn!.removeEventListener('click', tilesOnPrev); });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', tilesOnNext);
    cleanups.push(function() { nextBtn!.removeEventListener('click', tilesOnNext); });
  }

  // Keyboard
  function tilesOnKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' && tilesCurrentIndex > 0) {
      e.preventDefault(); tilesScrollTo(tilesCurrentIndex - 1);
    } else if (e.key === 'ArrowRight' && tilesCurrentIndex < tilesCount - 1) {
      e.preventDefault(); tilesScrollTo(tilesCurrentIndex + 1);
    }
  }
  document.addEventListener('keydown', tilesOnKey);
  cleanups.push(function() { document.removeEventListener('keydown', tilesOnKey); });

  // Dots
  if (dots.length) {
    dots.forEach(function(dot) {
      function onDotClick() {
        var index = parseInt((dot as HTMLElement).dataset.index ?? '', 10);
        if (isNaN(index)) return; // ARRAY-ASSIGN-01
        tilesScrollTo(index);
      }
      dot.addEventListener('click', onDotClick);
      cleanups.push(function() { dot.removeEventListener('click', onDotClick); });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TILES — ACTIVE CARD TRACKING
  // ═══════════════════════════════════════════════════════════════
  function tilesUpdateActive() {
    if (!tilesTrackEl || tilesCachedStride <= 0) return;
    var newIndex = Math.round(tilesTrackEl.scrollLeft / tilesCachedStride);
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= tilesCount) newIndex = tilesCount - 1;
    if (newIndex === tilesCurrentIndex) return;
    tilesCurrentIndex = newIndex;
    tilesUpdateUI();
  }

  function tilesUpdateUI() {
    if (!tilesTrackEl) return;
    var sl = tilesTrackEl.scrollLeft;
    var canLeft  = sl > 5;
    var canRight = sl < (tilesCachedMaxScroll - 5);

    dots.forEach(function(dot, i) {
      dot.classList.toggle('active', i === tilesCurrentIndex);
    });
    if (prevBtn) (prevBtn as HTMLButtonElement).disabled = !canLeft;
    if (nextBtn) (nextBtn as HTMLButtonElement).disabled = !canRight;
  }

  var tilesScrollTicking = false;
  var tilesScrollRafId: number | null = null;

  function tilesOnTrackScroll() {
    if (tilesScrollTicking) return;
    tilesScrollTicking = true;
    tilesScrollRafId = requestAnimationFrame(function() {
      tilesScrollRafId = null;
      tilesScrollTicking = false;
      tilesUpdateActive();
    });
    timerIds.push(tilesScrollRafId);
  }

  if (tilesTrackEl) {
    tilesTrackEl.addEventListener('scroll', tilesOnTrackScroll, { passive: true });
    cleanups.push(function() { tilesTrackEl!.removeEventListener('scroll', tilesOnTrackScroll); });
  }

  // ═══════════════════════════════════════════════════════════════
  // TILE HOVER — GRAVITY (create once, play/reverse)
  // ═══════════════════════════════════════════════════════════════
  var hasHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;
  var tilesHoverTLs: Array<gsap.core.Timeline | null> = [];

  tiles.forEach(function(tile, tileIdx) {
    var number     = tile.querySelector<HTMLElement>('.ribbon-number');
    var divider    = tile.querySelector<HTMLElement>('.ribbon-divider');
    var text       = tile.querySelector<HTMLElement>('.ribbon-text');
    var tileName   = tile.querySelector<HTMLElement>('.ribbon-name');
    var stageLabel = tile.querySelector<HTMLElement>('.stage-label');
    var heading    = tile.querySelector<HTMLElement>('.tile-heading');
    var body       = tile.querySelector<HTMLElement>('.tile-body');
    var els        = [number, divider, text, tileName];

    var tl = gsap.timeline({ paused: true });

    tl.fromTo(stageLabel,
      { scale: 1.3, color: 'rgba(0,0,0,0.18)' },
      { scale: 5, color: 'rgba(0,0,0,0.05)', duration: 0.6, ease: 'power4.out' }, 0);

    for (var i = 0; i < els.length; i++) {
      tl.fromTo(els[i],
        { y: -18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, ease: 'back.out(2.5)' },
        0.01 + i * 0.03);
    }

    tl.to(heading,
      { scale: 1.06, y: 10, duration: 0.6, ease: 'power4.out', transformOrigin: 'left top' }, 0);
    tl.to(body,
      { scale: 1.04, y: 8, duration: 0.6, ease: 'power4.out', transformOrigin: 'left top' }, 0.04);

    tilesHoverTLs[tileIdx] = tl;
    gsapInstances.push(tl);

    if (hasHover) {
      function onTileEnter() { tl.play(); }
      function onTileLeave() { tl.reverse(); }
      tile.addEventListener('mouseenter', onTileEnter);
      cleanups.push(function() { tile.removeEventListener('mouseenter', onTileEnter); });
      tile.addEventListener('mouseleave', onTileLeave);
      cleanups.push(function() { tile.removeEventListener('mouseleave', onTileLeave); });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // INIT GEOMETRY
  // ═══════════════════════════════════════════════════════════════
  cacheGeometry();
  tilesUpdateUI();
  if (prevBtn) (prevBtn as HTMLButtonElement).disabled = true;

  // ═══════════════════════════════════════════════════════════════
  // WAKE HELPER + VISIBILITY GATE (internal IO kill switch)
  // ═══════════════════════════════════════════════════════════════
  var sectionVisible = true;

  function wakeUp() {
    if (!sectionVisible) return;
    settledFrames = 0;
    resume();
  }

  // Internal IntersectionObserver: pause/resume when offscreen (rootMargin 200px)
  if (typeof IntersectionObserver !== 'undefined') {
    var visObs = new IntersectionObserver(function(entries) {
      if (!entries[0]) return; // IO-SAFE-01
      var entry = entries[0];
      sectionVisible = entry.isIntersecting;
      if (sectionVisible) {
        isFirstFrame = true;
        cacheGeometry();
        wakeUp();
      } else {
        pause();
      }
    }, { rootMargin: '200px 0px' });
    visObs.observe(container);
    observers.push(visObs);
  }

  // ═══════════════════════════════════════════════════════════════
  // FACTORY CPU GATING — Ścieżka 1: Typ B (IO → pause/resume)
  // rootMargin: 0.5 × viewport height (nie WebGL)
  // Koegzystencja: B-CPU-03 PASS + ENT-LC-06 PASS
  // Factory margin (~400-500px) > internal margin (200px) = pre-warming
  // ═══════════════════════════════════════════════════════════════
  var _factoryGetVH = function() {
    return window.visualViewport ? window.visualViewport.height : window.innerHeight;
  };

  var _factoryGatingObserver = _factoryCreateGating(Math.round(0.5 * _factoryGetVH()));

  function _factoryCreateGating(m: number) {
    var obs = new IntersectionObserver(
      function(entries) {
        if (!entries[0]) return; // IO-SAFE-01
        var entry = entries[0];
        if (entry.isIntersecting) {
          resume();
        } else {
          pause();
        }
      },
      { rootMargin: m + 'px 0px', threshold: 0.01 }
    );
    obs.observe(container);
    return obs;
  }

  var _factoryOnViewportChange = function() {
    var newMargin = Math.round(0.5 * _factoryGetVH());
    _factoryGatingObserver.disconnect();
    _factoryGatingObserver = _factoryCreateGating(newMargin);
  };
  window.addEventListener('resize', _factoryOnViewportChange, { passive: true });
  window.addEventListener('orientationchange', _factoryOnViewportChange, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _factoryOnViewportChange, { passive: true });
  }
  cleanups.push(function() {
    window.removeEventListener('resize', _factoryOnViewportChange);
    window.removeEventListener('orientationchange', _factoryOnViewportChange);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', _factoryOnViewportChange);
    }
  });
  observers.push(_factoryGatingObserver);
  // ═══ KONIEC FACTORY CPU GATING ═══

  // ═══════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════
  var lastWindowWidth  = window.innerWidth;
  var lastWindowHeight = window.innerHeight;
  function onResize() {
    var ww = window.innerWidth;
    var wh = window.innerHeight;
    if (ww === lastWindowWidth && wh === lastWindowHeight) return;
    lastWindowWidth  = ww;
    lastWindowHeight = wh;
    cacheGeometry();
    wakeUp();
  }
  window.addEventListener('resize', onResize);
  cleanups.push(function() { window.removeEventListener('resize', onResize); });

  // LENIS SCROLL → wake section tick
  if (scrollRuntime.lenis) {
    scrollRuntime.lenis.on('scroll', wakeUp);
    cleanups.push(function() {
      if (scrollRuntime.lenis) scrollRuntime.lenis.off('scroll', wakeUp);
    });
  }

  // MOUSEMOVE — fine pointer only, with proximity gate
  if (hasHover) {
    var MOUSE_PROXIMITY = 400;
    function onMouseMove(e: MouseEvent) {
      ptrX = e.clientX;
      ptrY = e.clientY;
      var scroll = scrollRuntime.getScroll();
      var stageScreenBottom = cachedStageBottom - scroll;
      if (ptrY < stageScreenBottom + MOUSE_PROXIMITY && ptrY > -MOUSE_PROXIMITY) {
        mouseActive = true;
        wakeUp();
      } else {
        mouseActive = false;
      }
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    cleanups.push(function() { window.removeEventListener('mousemove', onMouseMove); });
  }

  function findIdx(target: EventTarget | null): number {
    if (!(target instanceof Element)) return -1;
    var w = target.closest('.letter-wrap');
    return w ? parseInt((w as HTMLElement).dataset.idx ?? '', 10) : -1;
  }

  function isInTilesTrack(target: EventTarget | null): boolean {
    return tilesTrackEl != null && target instanceof Node && tilesTrackEl.contains(target);
  }

  // MOUSE — punch on 3D letters
  function onMouseDown(e: MouseEvent) {
    if (isInTilesTrack(e.target)) return;
    var idx = findIdx(e.target);
    if (idx >= 0) { e.preventDefault(); startPunch(idx); wakeUp(); }
  }
  window.addEventListener('mousedown', onMouseDown);
  cleanups.push(function() { window.removeEventListener('mousedown', onMouseDown); });

  function onMouseUp() { endPunch(); }
  window.addEventListener('mouseup', onMouseUp);
  cleanups.push(function() { window.removeEventListener('mouseup', onMouseUp); });

  // TOUCH — punch only, NO scroll hijacking
  var touchMode = 'none';
  var touchStartY = 0;

  function onTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY;
    var idx = findIdx(e.target);
    if (idx >= 0) {
      touchMode = 'punch';
      startPunch(idx);
      wakeUp();
    } else {
      touchMode = 'none';
    }
  }
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  cleanups.push(function() { window.removeEventListener('touchstart', onTouchStart); });

  function onTouchMove(e: TouchEvent) {
    if (touchMode === 'punch') {
      var y = e.touches[0].clientY;
      if (Math.abs(touchStartY - y) > 10) {
        endPunch();
        touchMode = 'none';
      }
    }
  }
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  cleanups.push(function() { window.removeEventListener('touchmove', onTouchMove); });

  function onTouchEnd() {
    if (touchMode === 'punch') endPunch();
    touchMode = 'none';
  }
  window.addEventListener('touchend', onTouchEnd);
  cleanups.push(function() { window.removeEventListener('touchend', onTouchEnd); });

  function onTouchCancel() {
    if (touchMode === 'punch') endPunch();
    touchMode = 'none';
  }
  window.addEventListener('touchcancel', onTouchCancel);
  cleanups.push(function() { window.removeEventListener('touchcancel', onTouchCancel); });

  // VISIBILITY CHANGE
  function onVisChange() {
    if (document.hidden) {
      pause();
    } else {
      for (var vi = 0; vi < WORD_LEN; vi++) vel[vi] = 0;
      isFirstFrame = true;
      wakeUp();
    }
  }
  document.addEventListener('visibilitychange', onVisChange);
  cleanups.push(function() { document.removeEventListener('visibilitychange', onVisChange); });

  // FONT LOAD
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() {
      cacheGeometry();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ANIMATION LOOP — 3D TEXT (Type B: reads scrollRuntime)
  // ═══════════════════════════════════════════════════════════════
  var THROTTLE_VD_THRESHOLD = 0.05;

  tickFn = function() {

    var scroll = scrollRuntime.getScroll();

    if (isFirstFrame) {
      prevScroll = scroll;
      isFirstFrame = false;
      return;
    }

    var scrollDirty = Math.abs(scroll - prevScroll) > 0.1;
    prevScroll = scroll;

    // Tiles reveal
    if (!tilesRevealed && scroll >= cachedTilesRevealScroll) {
      tilesInitReveal();
    }

    frameCount++;
    var isThrottleFrame = (frameCount % 3 !== 0);

    var sH   = cachedStageH;
    var hY   = cachedHY;
    var norm = cachedNorm;

    for (var c = 0; c < WORD_LEN; c++) prevD[c] = curDepth[c];

    var anyLetterActive = false;

    for (var ci = 0; ci < WORD_LEN; ci++) {

      var cx      = cachedLetterCx[ci];
      var cy      = cachedLetterBaseCy[ci] - scroll;
      var rectTop = cachedLetterBaseTop[ci] - scroll;

      var dY = cy - hY;
      var rY = clamp(dY / norm, -MAX_TILT, MAX_TILT);
      var sp = clamp(1 - (rectTop / sH), 0, 1);

      var phase = (WORD_LEN - 1 - ci) / (WORD_LEN - 1);
      var st = CASCADE_START + phase * CASCADE_SPREAD;
      var gate = smoothstep(clamp((sp - st) / CASCADE_RAMP, 0, 1));

      var anim = rY < ANIMATION_THRESHOLD;
      var tilt = anim ? (rY - ANIMATION_THRESHOLD) * gate : 0;

      var mbl = WZROST_BASE_DEPTHS[ci];
      var lbd = anim ? mbl * sp * gate : 0;

      var mc = 0;
      if (mouseActive && anim) {
        var dx = ptrX - cx;
        var dy = ptrY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var t5 = clamp(dist * 0.0025, 0, 1);
        var mi = 1 - t5 * Math.sqrt(t5);
        mc = mi * (MAX_DEPTH - lbd) * gate;
      }

      var chain = (ci < WORD_LEN - 1 ? prevD[ci + 1] : 0) * CHAIN_COUPLING * gate;
      var ft = clamp(lbd + mc + chain, 0, MAX_DEPTH);

      if (punch[ci] > 0) {
        ft = MAX_DEPTH * punch[ci] > ft ? MAX_DEPTH * punch[ci] : ft;
      }

      tgtDepth[ci] = ft;

      var isPunched = punch[ci] > 0;
      var stiff = isPunched ? 0.12 : STIFFNESS;
      var damp  = isPunched ? 0.78 : DAMPING;

      var force = (ft - curDepth[ci]) * stiff;
      var nv = (vel[ci] + force) * damp;
      var nc = curDepth[ci] + nv;

      if (nc < 0) { nc = 0; nv = -nv * 0.5; }
      if (nc > MAX_DEPTH + 0.5) { nv -= (nc - (MAX_DEPTH + 0.5)) * 0.15; }

      vel[ci] = nv;
      curDepth[ci] = nc;

      if (nv > SETTLE_VEL_EPS || nv < -SETTLE_VEL_EPS || punch[ci] > 0) {
        anyLetterActive = true;
      }

      var vd = nc * depthScale;
      var currentTilt = tilt;

      var vdDelta   = vd - lastVd[ci];
      var tiltDelta = currentTilt - lastTilt[ci];
      if (vdDelta < 0) vdDelta = -vdDelta;
      if (tiltDelta < 0) tiltDelta = -tiltDelta;

      if (vdDelta < DIRTY_VD_EPS && tiltDelta < DIRTY_TILT_EPS) {
        continue;
      }

      lastVd[ci]   = vd;
      lastTilt[ci] = currentTilt;

      var lays = layerEls[ci];
      var lConfigs = LETTER_LAYER_CONFIGS[ci];
      var lCount = LAYERS_PER_LETTER[ci];

      var activeMovement = (vdDelta > THROTTLE_VD_THRESHOLD);
      var nearFlat = (vd < 0.5);
      var halfCount = lCount >> 1;
      var startLi = (isThrottleFrame && !activeMovement && !nearFlat) ? halfCount : 0;

      for (var li = startLi; li < lCount; li++) {
        var cfg = lConfigs[li];
        var z = cfg.isTop ? (cfg.zMul * vd > 0.1 ? cfg.zMul * vd : 0.1) : cfg.zMul * vd;
        lays[li].style.transform = 'translate3d(0,' + (currentTilt * z * PERSPECTIVE_STRENGTH) + 'px,' + z + 'px)';
      }
    }

    if (!anyLetterActive && !scrollDirty) {
      settledFrames++;
      if (settledFrames >= SETTLE_FRAMES) {
        pause();
      }
    } else {
      settledFrames = 0;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // PAUSE / RESUME / KILL
  // Sekcja NIGDY nie zatrzymuje/startuje Lenisa
  // ═══════════════════════════════════════════════════════════════
  function resume() {
    if (ticking) return;
    ticking = true;
    settledFrames = 0;
    if (tickFn) gsap.ticker.add(tickFn);
  }

  function pause() {
    if (!ticking) return;
    ticking = false;
    if (tickFn) gsap.ticker.remove(tickFn);
  }

  function kill() {
    if (_killed) return; // P3-CLEAN-01: idempotencja
    _killed = true;

    pause();

    for (var i = 0; i < cleanups.length; i++) {
      try { cleanups[i](); } catch(e) { /* noop */ }
    }
    cleanups.length = 0;

    for (var j = 0; j < timerIds.length; j++) {
      try { clearTimeout(timerIds[j]); clearInterval(timerIds[j]); cancelAnimationFrame(timerIds[j]); } catch(e) { /* noop */ }
    }
    timerIds.length = 0;
    if (tilesScrollRafId !== null) {
      cancelAnimationFrame(tilesScrollRafId);
      tilesScrollRafId = null;
    }

    for (var k = 0; k < observers.length; k++) {
      try { observers[k].disconnect(); } catch(e) { /* noop */ }
    }
    observers.length = 0;

    for (var th = 0; th < tilesHoverTLs.length; th++) {
      if (tilesHoverTLs[th]) {
        try { tilesHoverTLs[th]!.revert(); } catch(e) { /* noop */ }
        try { tilesHoverTLs[th]!.kill(); } catch(e) { /* noop */ }
        tilesHoverTLs[th] = null;
      }
    }

    for (var m = 0; m < gsapInstances.length; m++) {
      try { if (gsapInstances[m].revert) gsapInstances[m].revert(); } catch(e) { /* noop */ }
      try { if (gsapInstances[m].kill) gsapInstances[m].kill(); } catch(e) { /* noop */ }
    }
    gsapInstances.length = 0;

    if (lettersRow) lettersRow.innerHTML = '';
  }

  // Start
  resume();

  return { pause: pause, resume: resume, kill: kill };
}

// ═══════════════════════════════════════════════════════════════
// React Component — Engine (loaded via dynamic import)
// ═══════════════════════════════════════════════════════════════
export default function CyfroweWzrostyEngine() {
  const rootRef = useRef<HTMLElement | null>(null);

  useGSAP(() => {
    gsap.registerPlugin(ScrollToPlugin); // GSAP-SSR-01: wewnątrz useGSAP, nie top-level

    const el = rootRef.current;
    if (!el) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error('[P3] rootRef.current is null — ref not attached to <section>.');
      }
      return;
    }
    const inst = init(el);
    return () => inst?.kill?.();
    // scope: useGSAP Context revertuje instancje GSAP z init() automatycznie
    // inst.kill() revertuje je powtórnie + czyści observers/timers/listeners
    // Double cleanup OK — _killed guard gwarantuje idempotencję
  }, { scope: rootRef });

  // Dynamic import: double rAF refresh after mount (pin/snap wrażliwe)
  useEffect(() => {
    scrollRuntime.requestRefresh('dynamic-mounted');
    let id1 = 0;
    let id2 = 0;
    id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        scrollRuntime.requestRefresh('dynamic-mounted-settle');
      });
    });
    return () => {
      if (id1) cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, []);

  return (
    <section id="cyfrowe-wzrosty-section" className="cyfrowe-wzrosty-section" ref={rootRef}>
      <div id="cyfrowe-wzrosty-content">

        {/* 3D TEXT */}
        <div id="cyfrowe-wzrosty-stage">
          <div id="cyfrowe-wzrosty-word-container">
            <div id="cyfrowe-wzrosty-cyfrowe-label">4 ETAPY</div>
            <div id="cyfrowe-wzrosty-letters-row"></div>
          </div>
        </div>

        {/* TILES */}
        <div id="cyfrowe-wzrosty-tiles-wrapper">
          <div className="tiles-track" id="cyfrowe-wzrosty-track">

            <article className="tile" data-index="0">
              <span className="stage-label">Etap 01</span>
              <div className="tile-hover-ribbon">
                <span className="ribbon-number">01</span>
                <div className="ribbon-divider"></div>
                <span className="ribbon-text">Etap</span>
                <span className="ribbon-name">Prototyp</span>
              </div>
              <div className="tile-content">
                <h3 className="tile-heading"><strong>Klikalny prototyp strony</strong> gotowy w 15 dni roboczych.</h3>
                <p className="tile-body">Akceptujesz układ UX i komplet treści przed etapem designu. <strong>= zero niespodzianek.</strong></p>
              </div>
              <div className="tile-media">
                <div className="tile-media-placeholder">Multimedia 1</div>
              </div>
            </article>

            <article className="tile" data-index="1">
              <span className="stage-label">Etap 02</span>
              <div className="tile-hover-ribbon">
                <span className="ribbon-number">02</span>
                <div className="ribbon-divider"></div>
                <span className="ribbon-text">Etap</span>
                <span className="ribbon-name">Design</span>
              </div>
              <div className="tile-content">
                <h3 className="tile-heading"><strong>Bezkonkurencyjny design.</strong><br />— Przed upływem 21 dni.</h3>
                <p className="tile-body"><strong>Profesjonalizm Twojej firmy widoczny od pierwszego spojrzenia.</strong> — Będziesz z tego dumny na każdym spotkaniu.</p>
              </div>
              <div className="tile-media">
                <div className="tile-media-placeholder">Multimedia 2</div>
              </div>
            </article>

            <article className="tile" data-index="2">
              <span className="stage-label">Etap 03</span>
              <div className="tile-hover-ribbon">
                <span className="ribbon-number">03</span>
                <div className="ribbon-divider"></div>
                <span className="ribbon-text">Etap</span>
                <span className="ribbon-name">Wdrożenie</span>
              </div>
              <div className="tile-content">
                <h3 className="tile-heading"><strong>Wsparcie przy starcie</strong><br />— Konsultacje i szkolenia.</h3>
                <p className="tile-body"><strong>Uruchamiamy, monitorujemy, reagujemy.</strong> Upewniamy się, że w pełni wykorzystujesz możliwości nowej strony.</p>
              </div>
              <div className="tile-media">
                <div className="tile-media-placeholder">Multimedia 3</div>
              </div>
            </article>

            <article className="tile" data-index="3">
              <span className="stage-label">Etap 04</span>
              <div className="tile-hover-ribbon">
                <span className="ribbon-number">04</span>
                <div className="ribbon-divider"></div>
                <span className="ribbon-text">Etap</span>
                <span className="ribbon-name">Opieka</span>
              </div>
              <div className="tile-content">
                <h3 className="tile-heading"><strong>Stała opieka</strong><br />— W opcjach nawet 24/7.</h3>
                <p className="tile-body"><strong>Pełna dostępność zespołu i szybkie zmiany, gdy ich potrzebujesz.</strong> W opcjach 24/7 dla tych, którzy nie mogą sobie pozwolić na przestój.</p>
              </div>
              <div className="tile-media">
                <div className="tile-media-placeholder">Multimedia 4</div>
              </div>
            </article>

          </div>
        </div>

        {/* NAVIGATION */}
        <div className="navigation-row">
          <button className="nav-arrow nav-arrow--prev" id="cyfrowe-wzrosty-prevBtn" aria-label="Poprzedni">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div className="pagination" id="cyfrowe-wzrosty-pagination">
            <button className="pagination-dot active" data-index="0"></button>
            <button className="pagination-dot" data-index="1"></button>
            <button className="pagination-dot" data-index="2"></button>
            <button className="pagination-dot" data-index="3"></button>
          </div>
          <button className="nav-arrow nav-arrow--next" id="cyfrowe-wzrosty-nextBtn" aria-label="Następny">
            <svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"></polyline></svg>
          </button>
        </div>

        {/* SPACER */}
        <div id="cyfrowe-wzrosty-spacer"></div>
      </div>
    </section>
  );
}
