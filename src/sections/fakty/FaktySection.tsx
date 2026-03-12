'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollRuntime } from '@/lib/scrollRuntime';
import './fakty-section.css';

// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// Next.js pre-renderuje Client Components na serwerze — window/document nie istnieją.
// registerPlugin() WYŁĄCZNIE wewnątrz useGSAP(() => { ... }) jak poniżej.

// ════════════════════════════════════════════════════════════════
// SEKCJA: fakty — hardened init(container)
// AUTO-FIXy: NULL-GUARD-01, TS-LINT-UNUSED-01
// CPU Gating: Ścieżka 3a (brak — ST-native)
// Format negotiation: CSS image-set() (AVIF/WebP)
// ════════════════════════════════════════════════════════════════

function init(container: HTMLElement): { kill: () => void } {
  const $id = (id: string) => container.querySelector('#' + id);

  const cleanups: (() => void)[] = [];
  const gsapInstances: (gsap.core.Tween | gsap.core.Timeline | ScrollTrigger)[] = [];
  const timerIds: { type: string; id: number | (() => number | null) }[] = [];
  const observers: (IntersectionObserver | MutationObserver | ResizeObserver)[] = [];

  const FRAME_COUNT = 34;
  const FRAME_PATH = '/frames/fakty-';
  const KERNING_MARGINS = [0, -0.1459, -0.1101, -0.1196, -0.1316];
  const TEXT_ROWS = [
    { text: 'FAKTY', weight: 900, kerning: KERNING_MARGINS },
    { text: 'SĄ TAKIE', weight: 139, kerning: null as number[] | null }
  ];

  const faktyBlock = $id('fakty-block') as HTMLElement | null;
  const faktyDom = $id('fakty-dom') as HTMLElement | null;

  if (!faktyBlock || !faktyDom) {
    console.warn('[fakty] Brak wymaganych elementów DOM');
    return { kill: () => {} };
  }

  let charOffsets: { el: Element; x: number; y: number }[] = [];
  let currentFrame = -1;
  const playhead = { frame: 0 };
  let isKilled = false;
  let stableViewportHeight = window.innerHeight;

  // ═══ IMAGE-SET FEATURE DETECTION ═══
  // Przeglądarka wybiera AVIF jeśli obsługuje, inaczej WebP
  const supportsImageSet = typeof CSS !== 'undefined' && 
    CSS.supports && 
    CSS.supports('background-image', 'image-set(url("x.webp") type("image/webp"))');

  function buildFrameValue(index: number): string {
    const num = String(index + 1).padStart(2, '0');
    if (supportsImageSet) {
      return `image-set(url('${FRAME_PATH}${num}.avif') type('image/avif'), url('${FRAME_PATH}${num}.webp') type('image/webp'))`;
    }
    // Fallback dla starych przeglądarek — WebP
    return `url('${FRAME_PATH}${num}.webp')`;
  }

  // Pre-build wszystkie wartości CSS
  const frameValues = Array.from({ length: FRAME_COUNT }, (_, i) => buildFrameValue(i));

  function buildDOM() {
    faktyDom.innerHTML = '';
    TEXT_ROWS.forEach((rowDef, ri) => {
      const rowSpan = document.createElement('span');
      rowSpan.className = 'title-row title-row--' + (ri + 1);

      if (ri === 0) {
        const words = rowDef.text.split(' ');
        let charIndex = 0;
        words.forEach(word => {
          const wordSpan = document.createElement('span');
          wordSpan.className = 'word';
          [...word].forEach(ch => {
            const span = document.createElement('span');
            span.className = 'char video-fill';
            span.textContent = ch;
            if (rowDef.kerning && charIndex < rowDef.kerning.length && rowDef.kerning[charIndex] !== 0) {
              span.style.marginLeft = rowDef.kerning[charIndex] + 'em';
            }
            wordSpan.appendChild(span);
            charIndex++;
          });
          rowSpan.appendChild(wordSpan);
          charIndex++;
        });
      } else {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'word video-fill';
        wordSpan.textContent = rowDef.text;
        rowSpan.appendChild(wordSpan);
      }
      faktyDom.appendChild(rowSpan);
    });
  }

  function computeAndSetBase() {
    const targetW = faktyBlock.getBoundingClientRect().width;
    const rows = faktyDom.querySelectorAll('.title-row');
    const r1 = rows[0] as HTMLElement | undefined;
    const r2 = rows[1] as HTMLElement | undefined;
    if (!r1 || !r2) return;

    r1.style.fontSize = '200px';
    r2.style.fontSize = '200px';
    const r1w = r1.getBoundingClientRect().width;
    const r2w = r2.getBoundingClientRect().width;
    const base = Math.floor((targetW / r1w) * 200);
    const ratio = (r1w / r2w).toFixed(4);

    faktyBlock.style.setProperty('--base', base + 'px');
    faktyBlock.style.setProperty('--ratio', ratio);
    r1.style.fontSize = '';
    r2.style.fontSize = '';

    const row1Size = base;
    const row2Size = base * parseFloat(ratio);
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return;
    
    measureCtx.font = '900 ' + row1Size + 'px Lexend';
    const bearingR1 = Math.abs(measureCtx.measureText('F').actualBoundingBoxLeft);
    measureCtx.font = '139 ' + row2Size + 'px Lexend';
    const bearingR2 = Math.abs(measureCtx.measureText('S').actualBoundingBoxLeft);
    const bearingDiff = bearingR1 - bearingR2;
    
    if (bearingDiff > 0.5) {
      faktyBlock.style.setProperty('--sideoffset-r1', '0px');
      faktyBlock.style.setProperty('--sideoffset-r2', bearingDiff.toFixed(1) + 'px');
    } else if (bearingDiff < -0.5) {
      faktyBlock.style.setProperty('--sideoffset-r1', (-bearingDiff).toFixed(1) + 'px');
      faktyBlock.style.setProperty('--sideoffset-r2', '0px');
    } else {
      faktyBlock.style.setProperty('--sideoffset-r1', '0px');
      faktyBlock.style.setProperty('--sideoffset-r2', '0px');
    }
    faktyBlock.classList.add('ready');
  }

  function measureCharOffsets() {
    const blockRect = faktyBlock.getBoundingClientRect();
    charOffsets = [];
    faktyDom.querySelectorAll('.video-fill').forEach(el => {
      const r = el.getBoundingClientRect();
      charOffsets.push({ el: el, x: r.left - blockRect.left, y: r.top - blockRect.top });
    });
  }

  // ═══ FRAME APPLICATION ═══
  // Bez ręcznego preloadu — przeglądarka ładuje przez CSS image-set()
  // visibilitychange listener wymusza re-apply frame po tab switch

  function applyFrame(index: number) {
    if (index === currentFrame) return;
    currentFrame = index;
    const value = frameValues[index];
    if (value) {
      faktyDom.style.setProperty('--current-frame-url', value);
    }
  }

  function setupVideoFill() {
    const blockW = faktyBlock.getBoundingClientRect().width;
    const frameH = Math.round(blockW * 540 / 960);
    charOffsets.forEach(co => {
      // Dwie warstwy: obraz wideo + czarny fallback
      (co.el as HTMLElement).style.backgroundSize = blockW + 'px ' + frameH + 'px, cover';
      (co.el as HTMLElement).style.backgroundPosition = (-co.x) + 'px ' + (-co.y) + 'px, center';
    });
  }

  function buildPhase1() {
    const rows = faktyDom.querySelectorAll('.title-row');
    const row1 = rows[0] as HTMLElement | undefined;
    const row2 = rows[1] as HTMLElement | undefined;
    if (!row1 || !row2) return;
    
    const row1Chars = [...row1.querySelectorAll('.char')] as HTMLElement[];
    if (row1Chars.length === 0) return;
    
    row1Chars.forEach(ch => gsap.set(ch.parentNode, { perspective: 1000 }));
    const setWC = (els: HTMLElement[], value: string) => els.forEach(el => { el.style.willChange = value; });

    setWC(row1Chars, 'transform, opacity');
    gsap.set(row1Chars, { opacity: 0, rotationX: -90, z: -200, transformOrigin: '50% 0%' });

    const row2Word = row2.querySelector('.word.video-fill') as HTMLElement | null;
    if (!row2Word) return;
    
    setWC([row2Word], 'transform');
    gsap.set(row2Word, { scaleY: 0, transformOrigin: '50% 0%' });

    const opacityEnd = 54;

    const st1 = ScrollTrigger.create({
      trigger: row1, start: 'center bottom', end: 'top top+=20%', scrub: true,
      animation: gsap.to(row1Chars, { ease: 'power1', stagger: 0.07, rotationX: 0, z: 0 }),
      onLeave: () => setWC(row1Chars, 'auto'),
      onEnterBack: () => setWC(row1Chars, 'transform, opacity'),
      onLeaveBack: () => setWC(row1Chars, 'auto'),
    });
    gsapInstances.push(st1);

    const st2 = ScrollTrigger.create({
      trigger: row1, start: 'center bottom', end: `top top+=${opacityEnd}%`, scrub: true,
      animation: gsap.to(row1Chars, { opacity: 1, ease: 'power2.in', stagger: 0.07 }),
    });
    gsapInstances.push(st2);

    const tl = gsap.timeline();
    tl.to(row2Word, { ease: 'power1.inOut', scaleY: 1, duration: 0.50 }, 0.08);
    const st3 = ScrollTrigger.create({
      trigger: faktyBlock, start: 'center bottom', end: 'top top', scrub: true, animation: tl,
      onEnter: () => setWC([row2Word], 'transform'),
      onLeave: () => setWC([row2Word], 'auto'),
      onEnterBack: () => setWC([row2Word], 'transform'),
      onLeaveBack: () => setWC([row2Word], 'auto'),
    });
    gsapInstances.push(st3);
  }

  let frameST: ScrollTrigger | null = null;

  function buildFrameScroll() {
    if (frameST) { frameST.kill(); frameST = null; }
    const row1 = faktyDom.querySelector('.title-row--1');
    if (!row1) return;

    playhead.frame = 0;
    currentFrame = -1;
    const START_PCT = 66;

    const tween = gsap.to(playhead, { frame: FRAME_COUNT - 1, snap: 'frame', ease: 'none' });

    frameST = ScrollTrigger.create({
      trigger: row1, start: 'top top+=' + START_PCT + '%',
      end: function() {
        const ratio = faktyBlock.offsetHeight / stableViewportHeight;
        const endPct = Math.max(5, Math.round(ratio * 45));
        return 'top top-=' + endPct + '%';
      },
      scrub: true, invalidateOnRefresh: true, animation: tween,
      onUpdate: function() { applyFrame(Math.round(playhead.frame)); },
    });
    gsapInstances.push(frameST);
  }

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastBlockWidth = 0;
  let lastInnerWidth = window.innerWidth;
  
  function onResize() {
    const currentInnerWidth = window.innerWidth;
    if (currentInnerWidth === lastInnerWidth) return;
    lastInnerWidth = currentInnerWidth;
    stableViewportHeight = window.innerHeight;
    
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isKilled || !container.isConnected) return;
      const currentWidth = faktyBlock.offsetWidth;
      if (currentWidth === lastBlockWidth) return;
      lastBlockWidth = currentWidth;

      computeAndSetBase();
      measureCharOffsets();
      setupVideoFill();
      currentFrame = -1;
      applyFrame(Math.round(playhead.frame));
      scrollRuntime.requestRefresh('st-refresh');
    }, 150);
  }
  window.addEventListener('resize', onResize, { passive: true });
  cleanups.push(() => window.removeEventListener('resize', onResize));
  timerIds.push({ type: 'timeout', id: () => resizeTimer as unknown as number | null });

  function kill() {
    isKilled = true;
    cleanups.forEach(fn => { try { fn(); } catch(e) { /* ignore */ } });
    timerIds.forEach(t => {
      try {
        const id = typeof t.id === 'function' ? t.id() : t.id;
        if (id == null) return;
        if (t.type === 'timeout') clearTimeout(id);
        else if (t.type === 'interval') clearInterval(id);
        else if (t.type === 'raf') cancelAnimationFrame(id);
        else if (t.type === 'idle' && typeof cancelIdleCallback === 'function') cancelIdleCallback(id);
      } catch(e) { /* ignore */ }
    });
    observers.forEach(obs => { try { obs?.disconnect?.(); } catch(e) { /* ignore */ } });
    gsapInstances.forEach(inst => {
      try { (inst as ScrollTrigger)?.revert?.(); } catch(e) { /* ignore */ }
      try { inst?.kill?.(); } catch(e) { /* ignore */ }
    });
    faktyBlock.classList.remove('ready');
    faktyDom.innerHTML = '';
  }

  document.fonts.ready.then(async () => {
    if (isKilled || !container.isConnected) return;
    stableViewportHeight = window.innerHeight;
    buildDOM();
    computeAndSetBase();
    lastBlockWidth = faktyBlock.offsetWidth;
    measureCharOffsets();
    setupVideoFill();
    applyFrame(0);
    buildPhase1();
    buildFrameScroll();
    
    // FIX: Force re-apply frame po powrocie do karty
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const frame = currentFrame;
        currentFrame = -1;  // reset guard
        applyFrame(frame);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    cleanups.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));
  });

  return { kill };
}

export function FaktySection() {
  const rootRef = useRef<HTMLElement | null>(null);

  useGSAP(() => {
    gsap.registerPlugin(ScrollTrigger); // ← TUTAJ, nie na top-level

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
  }, { scope: rootRef });

  return (
    <section id="fakty-section" ref={rootRef}>
      <div className="title-block" id="fakty-block">
        <div className="title-dom" id="fakty-dom"></div>
      </div>
    </section>
  );
}
