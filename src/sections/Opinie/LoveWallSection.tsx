'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollRuntime } from '@/lib/scrollRuntime';
import './love-wall-section.css';

// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// Next.js pre-renderuje Client Components na serwerze — window/document nie istnieją.
// registerPlugin() WYŁĄCZNIE wewnątrz useGSAP(() => { ... }) jak poniżej.

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: love-wall-logo — Kinetic Typography (Typ B)
   ═══════════════════════════════════════════════════════════════ */
function loveWallLogoInit(container: HTMLElement): { pause: () => void; resume: () => void; kill: () => void } {

  const $$ = (sel: string) => container.querySelectorAll(sel);
  const $id = (id: string) => container.querySelector('#' + id);

  const cleanups: Array<() => void> = [];
  const gsapInstances: gsap.core.Tween[] = [];
  const timerIds: number[] = [];
  const observers: IntersectionObserver[] = [];

  let tickFn: ((time: number, deltaTime: number) => void) | null = null;
  let ticking = false;
  const hfListeners: Array<{ target: EventTarget; event: string; fn: EventListenerOrEventListenerObject; options: AddEventListenerOptions | undefined }> = [];

  const CFG = {
    CULL_MARGIN: 1000,
    BASE_SPEED: 1.17,
    MAX_SPEED_CAP: 14,
    LERP: 0.18,
    SCROLL_FACTOR: 2.1,
    VELOCITY_SMOOTHING: 0.03,
    VELOCITY_CLAMP: 17,
    // Continuous letter effects: larger epsilon cuts redundant style writes.
    CONTINUOUS_DIST_EPSILON: 0.02
  };

  const SHADOW_HIDDEN = '0 0 2px currentColor, 0 0 4px currentColor, 0 0 8px currentColor, 0 0 16px currentColor, 0 0 32px currentColor, 0 0 48px currentColor, 0 0 64px currentColor, 0 0 80px currentColor';
  const SHADOW_VISIBLE = '0 0 0px transparent, 0 0 0px transparent, 0 0 0px transparent, 0 0 0px transparent, 0 0 0px transparent, 0 0 0px transparent, 0 0 0px transparent, 0 0 0px transparent';

  const BlurStrategy = {
    tier: 'high' as string,
    thresholds: { high: Infinity, mid: 8, low: 4, minimal: 0 } as Record<string, number>,
    stats: { real: 0, fallback: 0 },
    init: function() {
      const cores = navigator.hardwareConcurrency || 4;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isMobile = window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches;
      if (reducedMotion) this.tier = 'minimal';
      else if (cores <= 2 || isMobile) this.tier = 'low';
    },
    getMode: function(charCount: number) {
      const threshold = this.thresholds[this.tier] ?? 0;
      const useReal = charCount <= threshold;
      useReal ? this.stats.real++ : this.stats.fallback++;
      return useReal ? 'real' : 'fallback';
    }
  };

  const DebrisSystem = {
    pools: new WeakMap<Element, {
      particles: any[]; sparks: any[]; triggered: boolean;
      masterTween: gsap.core.Tween | null; poolEl: HTMLElement;
      allItems: any[] | null; totalDuration: number
    }>(),

    initPool: function(wordEl: Element) {
      if (this.pools.has(wordEl)) return;

      const poolEl = document.createElement('div');
      poolEl.className = 'debris-pool';
      wordEl.appendChild(poolEl);

      const h = (wordEl as HTMLElement).offsetHeight || 100;
      const pool = {
        particles: [] as any[], sparks: [] as any[], triggered: false,
        masterTween: null as gsap.core.Tween | null, poolEl,
        allItems: null as any[] | null, totalDuration: 0
      };

      for (let i = 0; i < 24; i++) {
        const el = document.createElement('div');
        el.className = 'debris';
        const isCircle = i % 2 === 0;
        const doesStrobe = isCircle && (i % 4 === 0);
        if (isCircle) el.style.borderRadius = '50%';

        let startX: number;
        if (i <= 2) startX = 20 + Math.random() * 15;
        else if (i >= 21) startX = 35 + Math.random() * 30;
        else if (i >= 18 && i <= 20) startX = 55 + Math.random() * 17;
        else if (i >= 15 && i <= 17) startX = 22 + Math.random() * 16;
        else { const mid = i - 3; startX = 28 + (mid / 11) * 44 + (Math.random() - 0.5) * 12; }

        el.style.left = startX + '%';
        el.style.top = '50%';
        poolEl.appendChild(el);

        const peakMult = (i >= 6 && i <= 11) ? 1.6 + Math.random() * 0.5 : 1.2 + Math.random() * 0.6;
        let ss = 1.0, es = 1.0;
        if (i === 0 || i === 8 || i === 16) { ss = 2.0; es = 0.3; }
        else if (i === 4 || i === 12 || i === 20) { ss = 0.3; es = 2.0; }

        pool.particles.push({
          el, peakY: -h * peakMult, fallY: h * (0.2 + Math.random() * 0.15),
          rot: Math.random() * 360, delay: i * 0.065, ss, es, doesStrobe,
          dur: 3.2, peakT: 0.32, fadeIn: 0.12, fadeOut: 0.88, isSpark: false
        });
      }

      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.className = i % 2 === 0 ? 'spark plus' : 'spark';
        el.style.left = (20 + Math.random() * 52) + '%';
        el.style.top = '50%';
        poolEl.appendChild(el);

        pool.sparks.push({
          el, peakY: -h * (1.8 + Math.random() * 0.8), fallY: h * (0.15 + Math.random() * 0.1),
          rot: 180 + Math.random() * 360, delay: (i * 3 * 0.065) + 0.03,
          ss: 0.6 + Math.random() * 0.8, es: 0.4 + Math.random() * 0.6,
          dur: 2.8, peakT: 0.28, fadeIn: 0.1, fadeOut: 0.85, isSpark: true
        });
      }

      const allItems = pool.particles.concat(pool.sparks);
      let maxDelay = 0, maxDur = 0;
      for (let i = 0; i < allItems.length; i++) {
        if (allItems[i].delay > maxDelay) maxDelay = allItems[i].delay;
        if (allItems[i].dur > maxDur) maxDur = allItems[i].dur;
      }
      pool.allItems = allItems;
      pool.totalDuration = maxDur + maxDelay;

      this.pools.set(wordEl, pool);
    },

    _updateParticle: function(p: any, globalT: number, vpScale: number, totalDuration: number) {
      const localT = Math.max(0, (globalT * totalDuration) - p.delay) / p.dur;
      if (localT <= 0 || localT > 1) { if (localT > 1) p.el.style.opacity = '0'; return; }

      const t = localT;
      const peakY = p.peakY * vpScale;
      const fallY = p.fallY * vpScale;
      let y: number;
      if (t <= p.peakT) { const n = t / p.peakT; y = peakY * (1 - Math.pow(1 - n, 2.5)); }
      else { const n = (t - p.peakT) / (1 - p.peakT); y = peakY + (fallY - peakY) * Math.pow(n, 2.2); }

      let op: number;
      if (t < p.fadeIn) op = t / p.fadeIn;
      else if (t > p.fadeOut) op = 1 - (t - p.fadeOut) / (1 - p.fadeOut);
      else op = 1;

      const rot = p.isSpark ? p.rot * t : p.rot * 0.4 * t;
      const scale = Math.max(0.5, p.ss + (p.es - p.ss) * t);
      let scaleOp = 0.6 + Math.min(scale, 2) * 0.2;

      if (p.doesStrobe && t > p.fadeIn && t < p.fadeOut) {
        const strobe = 0.5 + 0.5 * Math.sin(t * 30 * Math.PI * 2);
        scaleOp *= (0.4 + strobe * 0.6);
      }

      const finalOp = Math.max(0, op * scaleOp);
      p.el.style.transform = 'translateY(' + y + 'px) rotate(' + rot + 'deg) scale(' + scale + ')';
      p.el.style.opacity = finalOp;
    },

    trigger: function(wordEl: Element) {
      const pool = this.pools.get(wordEl);
      if (!pool || pool.triggered) return;
      pool.triggered = true;

      const vpScale = Math.max(0.3, Math.min(1, window.innerWidth / 1400));
      const allItems = pool.allItems;
      if (!allItems) return;
      const totalDuration = pool.totalDuration;

      if (pool.masterTween) { pool.masterTween.kill(); }

      for (let i = 0; i < allItems.length; i++) {
        const p = allItems[i];
        p.el.style.willChange = 'transform, opacity';
        p.el.style.transform = 'translateY(0) rotate(0deg) scale(' + p.ss + ')';
        p.el.style.opacity = '0';
      }

      const self = this;
      const tween = gsap.to({ prog: 0 }, {
        prog: 1, duration: totalDuration, ease: 'none',
        onUpdate: function() {
          const globalT = (this as any).targets()[0].prog;
          for (let i = 0; i < allItems.length; i++) {
            self._updateParticle(allItems[i], globalT, vpScale, totalDuration);
          }
        },
        onComplete: function() {
          pool.masterTween = null;
          for (let i = 0; i < allItems.length; i++) {
            allItems[i].el.style.willChange = '';
          }
        }
      });
      pool.masterTween = tween;
      gsapInstances.push(tween);
    },

    reset: function(wordEl: Element) {
      const pool = this.pools.get(wordEl);
      if (!pool) return;
      pool.triggered = false;
      if (pool.masterTween) { pool.masterTween.kill(); pool.masterTween = null; }
      const items = pool.allItems;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        items[i].el.style.willChange = '';
        items[i].el.style.transform = 'translateY(0) rotate(0deg) scale(' + items[i].ss + ')';
        items[i].el.style.opacity = '0';
      }
    }
  };

  const EFFECTS: Record<string, any> = {
    'optical-bloom': {
      blurModes: new WeakMap<Element, string>(),
      getMode: function(c: any) {
        if (this.blurModes.has(c.wordEl)) return this.blurModes.get(c.wordEl);
        const mode = BlurStrategy.getMode(c.wordEl.querySelectorAll('.char').length);
        this.blurModes.set(c.wordEl, mode);
        return mode;
      },
      setHidden: function(c: any) {
        const mode = this.getMode(c);
        if (mode === 'real') gsap.set(c.el, { scale: 2.5, filter: 'blur(15px)', opacity: 0, transformOrigin: 'center center' });
        else gsap.set(c.el, { scale: 2.5, opacity: 0, textShadow: SHADOW_HIDDEN, transformOrigin: 'center center' });
      },
      animate: function(c: any, s: number) {
        const mode = this.getMode(c);
        if (mode === 'real') gsap.to(c.el, { scale: 1, filter: 'blur(0px)', opacity: 1, duration: 1.8/s, ease: 'power2.inOut', delay: c.idx*0.12/s });
        else gsap.to(c.el, { scale: 1, opacity: 1, textShadow: SHADOW_VISIBLE, duration: 1.8/s, ease: 'power2.inOut', delay: c.idx*0.12/s });
      }
    },
    'zipper': {
      setHidden: function(c: any) { const baseY = 150 * Math.min(1, window.innerWidth / 1400); gsap.set(c.el, { y: c.idx%2===0?-baseY:baseY, opacity:0 }); },
      animate: function(c: any, s: number) { gsap.to(c.el, { y:0, opacity:1, duration:1.4/s, ease:'elastic.out(1,0.6)', delay:c.idx*0.045/s }); }
    },
    'velocity-skew': {
      setHidden: function(c: any) { gsap.set(c.el, { x:200, skewX:-45, opacity:0, scale:0.8 }); },
      animate: function(c: any, s: number) { gsap.to(c.el, { x:0, skewX:0, opacity:1, scale:1, duration:1.6/s, ease:'power4.out', delay:c.idx*0.1/s }); }
    },
    'fluid-tension': {
      setHidden: function(c: any) { gsap.set(c.el, { scaleY:0, scaleX:1.5, opacity:0, transformOrigin:'bottom center' }); },
      animate: function(c: any, s: number) { gsap.to(c.el, { scaleY:1, scaleX:1, opacity:1, duration:1.8/s, ease:'elastic.out(1,0.3)', delay:c.idx*0.08/s + c.animDelay }); }
    },
    'prism-cut': {
      needsWrapper: true,
      setHidden: function(c: any) { gsap.set(c.el, { yPercent:110, scale:1.1, opacity:0 }); },
      animate: function(c: any, s: number) { gsap.to(c.el, { yPercent:0, scale:1, opacity:1, duration:1.4/s, ease:'circ.out', delay:c.idx*0.1/s }); }
    },
    'anchor': {
      setHidden: function(c: any) { gsap.set(c.el, { y:'-0.5em', scaleY:1.25, scaleX:0.88, opacity:0, transformOrigin:'center bottom' }); },
      animate: function(c: any, s: number) { gsap.to(c.el, { y:'0.08em', scaleY:0.92, scaleX:1.06, opacity:1, duration:0.7/s, ease:'power2.in', delay:c.idx*0.11/s, onComplete:function(){ gsap.to(c.el,{y:0,scaleY:1,scaleX:1,duration:0.9/s,ease:'power2.out'}); } }); }
    },
    'growth': {
      setHidden: function(c: any) { gsap.set(c.el, { y:'0.35em', scaleY:0.3, scaleX:1.25, opacity:0, transformOrigin:'center bottom' }); },
      animate: function(c: any, s: number) { gsap.to(c.el, { y:'-0.07em', scaleY:1.12, scaleX:0.94, opacity:1, duration:0.7/s, ease:'power2.out', delay:c.idx*0.1/s, onComplete:function(){ gsap.to(c.el,{y:0,scaleY:1,scaleX:1,duration:0.5/s,ease:'power1.inOut'}); } }); }
    },
    'rotate-3d-scale': {
      type: 'continuous',
      setHidden: function(c: any) {
        c.el.style.opacity = '0';
        c.el.style.transform = 'perspective(800px) translateZ(0px) rotateY(90deg) scale(0.5)';
        if (c.idx === 1) DebrisSystem.reset(c.wordEl);
      },
      update: function(c: any, dist: number, debrisAllowed: boolean) {
        const abs = Math.abs(dist);
        const rotateY = dist * 70;
        const z = -abs * 150;
        const scale = 1 + (1 - abs) * 0.4;
        const opacity = Math.max(0.1, 1 - abs * 0.4);
        c.el.style.transform = 'perspective(800px) translateZ(' + z + 'px) rotateY(' + rotateY + 'deg) scale(' + scale + ')';
        c.el.style.opacity = opacity;
        if (c.idx === 1 && abs < 0.4 && debrisAllowed) { DebrisSystem.trigger(c.wordEl); return true; }
        return false;
      }
    }
  };

  const trackAEl = $id('love-wall-logo-track-a') as HTMLElement | null;
  const trackBEl = $id('love-wall-logo-track-b') as HTMLElement | null;

  if (!trackAEl || !trackBEl) return { pause: () => {}, resume: () => {}, kill: () => {} };

  const setTrackAX = gsap.quickSetter(trackAEl, 'x', 'px');
  const setTrackBX = gsap.quickSetter(trackBEl, 'x', 'px');
  gsap.set(trackAEl, { yPercent: -50, z: 0 });
  gsap.set(trackBEl, { yPercent: -50, z: 0 });

  const state = {
    vpW: 0, trW: 0, baseX: 0, targX: 0, offA: 0, offB: 0,
    lastY: 0, vel: 0, rawVel: 0, active: true, frame: 0,
    baseSpeed: 1.17, debrisTriggeredThisFrame: false
  };

  let wordsA: any[] = [], wordsB: any[] = [];

  function bakeWords(trackEl: HTMLElement) {
    const words: any[] = [];
    trackEl.querySelectorAll('.word').forEach(function(wordEl: Element) {
      const wEl = wordEl as HTMLElement;
      const txt = wEl.textContent?.trim() ?? '';
      const effName = wEl.dataset.effect ?? '';
      const eff = EFFECTS[effName];
      const needsWrap = eff && eff.needsWrapper && BlurStrategy.tier !== 'minimal';
      const timeScale = parseFloat(wEl.dataset.timeScale ?? '1');
      const minDur = wEl.dataset.minDuration ? parseFloat(wEl.dataset.minDuration) : null;
      const trigPoint = parseFloat(wEl.dataset.triggerPoint ?? '0.75');
      const trigDelay = parseFloat(wEl.dataset.triggerDelay ?? '0');
      const animDelay = parseFloat(wEl.dataset.animationDelay ?? '0');
      const maxSpeedFactor = minDur ? (1.5 / minDur) : Infinity;
      const isContinuous = eff && eff.type === 'continuous';

      wEl.innerHTML = '';
      wEl.style.width = 'auto';
      if (wEl.dataset.needs3d === 'true') {
        wEl.style.transformStyle = 'preserve-3d';
        wEl.style.perspective = '1000px';
      }
      if (effName === 'rotate-3d-scale') wEl.style.position = 'relative';

      const chars: any[] = [];
      txt.split('').forEach(function(char: string, i: number) {
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = char === ' ' ? '\u00A0' : char;
        if (needsWrap) {
          const w = document.createElement('span');
          w.className = 'char-wrapper';
          w.appendChild(span);
          wEl.appendChild(w);
        } else {
          wEl.appendChild(span);
        }
        chars.push({ el: span, idx: i, animDelay: animDelay, lastDist: undefined,
          ctx: { el: span, idx: i, wordEl: wEl, animDelay: animDelay } });
      });

      words.push({
        el: wEl, chars, x: 0, w: 0, charStep: 0, state: 0, eff, effName,
        triggerX: 0, trigPoint, timeScale,
        maxSpeedFactor, trigDelay, isContinuous
      });
    });
    return words;
  }

  function updateWords(words: any[], trackPos: number, debrisBudgetAvailable: boolean) {
    const vpW = state.vpW;
    let debrisTriggered = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const sx = trackPos + word.x;
      const sx2 = sx + word.w;

      if (sx > vpW + CFG.CULL_MARGIN) break;
      if (sx2 < -CFG.CULL_MARGIN) {
        if (word.state !== 0) { word.state = 0; resetWordChars(word); }
        continue;
      }

      if (word.isContinuous) {
        if (sx < vpW && sx2 > 0) {
          for (let j = 0; j < word.chars.length; j++) {
            const c = word.chars[j];
            const charCenterX = sx + word.charStep * (j + 0.5);
            const dist = (charCenterX - vpW / 2) / (vpW / 2);
            if (c.lastDist === undefined || Math.abs(dist - c.lastDist) >= CFG.CONTINUOUS_DIST_EPSILON) {
              const canTriggerDebris = debrisBudgetAvailable && !debrisTriggered;
              const didTriggerDebris = word.eff.update(c.ctx, dist, canTriggerDebris);
              if (didTriggerDebris) debrisTriggered = true;
              c.lastDist = dist;
            }
          }
          word.state = 2;
        }
        continue;
      }

      if (word.state === 0 && sx < word.triggerX && sx2 > 0) {
        word.state = 1;
        const rawSpd = 1 + (Math.min(state.vel, 30) * 0.1);
        const spd = Math.min(Math.max(1, rawSpd), word.maxSpeedFactor) * word.timeScale;

        const animateWord = (function(w: any, s: number) {
          return function() {
            for (let j = 0; j < w.chars.length; j++) {
              const ch = w.chars[j];
              gsap.killTweensOf(ch.el);
              if (w.eff && w.eff.setHidden) w.eff.setHidden(ch.ctx);
              if (w.eff && w.eff.animate) w.eff.animate(ch.ctx, s);
            }
          };
        })(word, spd);

        if (word.trigDelay > 0) {
          const dc = gsap.delayedCall(word.trigDelay, animateWord);
          gsapInstances.push(dc as unknown as gsap.core.Tween);
        } else { animateWord(); }
      }

      if (sx > vpW + 50 && word.state !== 0) { word.state = 0; resetWordChars(word); }
    }
    return debrisTriggered;
  }

  function resetWordChars(word: any) {
    for (let j = 0; j < word.chars.length; j++) {
      const c = word.chars[j];
      gsap.killTweensOf(c.el);
      c.lastDist = undefined;
      if (word.eff && word.eff.setHidden) {
        word.eff.setHidden(c.ctx);
      }
    }
  }

  function resetTrackWords(words: any[], _trackEl: HTMLElement) {
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      word.state = 0;
      for (let j = 0; j < word.chars.length; j++) {
        gsap.killTweensOf(word.chars[j].el);
        word.chars[j].lastDist = undefined;
        if (word.eff && word.eff.setHidden) {
          word.eff.setHidden(word.chars[j].ctx);
        }
      }
    }
  }

  const update = function() {
    if (!state.active) return;
    if (state.trW <= 0) return;

    const dt = gsap.ticker.deltaRatio(60);
    state.frame++;

    const scrollY = scrollRuntime.getRawScroll();
    const scrollDelta = Math.abs(scrollY - state.lastY);
    state.lastY = scrollY;

    if ((window as any).__smoothedVelocity !== undefined) {
      state.rawVel = Math.abs((window as any).__smoothedVelocity) / 50;
      state.vel = state.rawVel;
    } else {
      state.rawVel = scrollDelta * 1.2;
      state.vel = state.vel * (1 - CFG.VELOCITY_SMOOTHING) + state.rawVel * CFG.VELOCITY_SMOOTHING;
    }
    state.vel = Math.min(state.vel, CFG.VELOCITY_CLAMP);

    const finalDelta = Math.pow(state.vel, 0.75) * CFG.SCROLL_FACTOR;
    const cappedDelta = finalDelta > CFG.MAX_SPEED_CAP ? CFG.MAX_SPEED_CAP : finalDelta;

    state.targX -= (state.baseSpeed + cappedDelta) * dt;
    const lerpAdj = 1 - Math.pow(1 - CFG.LERP, dt);
    state.baseX += (state.targX - state.baseX) * lerpAdj;

    if (state.baseX + state.offA + state.trW < -CFG.CULL_MARGIN) {
      state.offA = state.offB + state.trW;
      resetTrackWords(wordsA, trackAEl);
    }
    if (state.baseX + state.offB + state.trW < -CFG.CULL_MARGIN) {
      state.offB = state.offA + state.trW;
      resetTrackWords(wordsB, trackBEl);
    }

    const posA = state.baseX + state.offA;
    const posB = state.baseX + state.offB;

    setTrackAX(posA);
    setTrackBX(posB);

    let debrisBudget = true;
    if (posA + state.trW > -CFG.CULL_MARGIN && posA < state.vpW + CFG.CULL_MARGIN) {
      const triggered = updateWords(wordsA, posA, debrisBudget);
      if (triggered) debrisBudget = false;
    }
    if (posB + state.trW > -CFG.CULL_MARGIN && posB < state.vpW + CFG.CULL_MARGIN) {
      updateWords(wordsB, posB, debrisBudget);
    }
  };

  tickFn = update;

  const computeTriggerX = function(vpW: number, trigPoint: number) {
    if (vpW >= 1400) { const frozenFromRight = 1400 * (1 - trigPoint); return vpW - frozenFromRight; }
    else if (vpW <= 700) { return vpW; }
    else { const t = (vpW - 700) / 700; const targetFromRight = (1 - trigPoint) * 1400 * t; return vpW - targetFromRight; }
  };

  const computeBaseSpeed = function(vpW: number) {
    if (vpW >= 1400) return 1.17;
    else if (vpW >= 700) return 0.84 + ((vpW - 700) / 700) * 0.33;
    else if (vpW >= 350) return 0.70 + ((vpW - 350) / 350) * 0.14;
    else return 0.63 + (Math.max(0, (vpW - 240) / 110)) * 0.07;
  };

  const updateLayout = function() {
    const newVpW = (container as HTMLElement).offsetWidth || window.innerWidth;
    if (newVpW === state.vpW && state.trW > 0) return;
    state.vpW = newVpW;
    state.baseSpeed = computeBaseSpeed(state.vpW);

    const oldTrW = state.trW;

    const tRectA = trackAEl.getBoundingClientRect();
    if (tRectA.width > 0) {
      state.trW = tRectA.width;
      for (let i = 0; i < wordsA.length; i++) {
        const word = wordsA[i];
        const wRect = word.el.getBoundingClientRect();
        word.x = wRect.left - tRectA.left;
        word.w = wRect.width;
        word.charStep = word.chars.length > 0 ? word.w / word.chars.length : 0;
        word.triggerX = computeTriggerX(state.vpW, word.trigPoint);
      }
    }
    const tRectB = trackBEl.getBoundingClientRect();
    if (tRectB.width > 0) {
      for (let i = 0; i < wordsB.length; i++) {
        const word = wordsB[i];
        const wRect = word.el.getBoundingClientRect();
        word.x = wRect.left - tRectB.left;
        word.w = wRect.width;
        word.charStep = word.chars.length > 0 ? word.w / word.chars.length : 0;
        word.triggerX = computeTriggerX(state.vpW, word.trigPoint);
      }
    }

    if (state.trW > 0 && oldTrW > 0 && state.trW !== oldTrW) {
      if (state.offA <= state.offB) {
        state.offB = state.offA + state.trW;
      } else {
        state.offA = state.offB + state.trW;
      }
      resetTrackWords(wordsA, trackAEl);
      resetTrackWords(wordsB, trackBEl);
    }

    const resetWordsLayout = function(words: any[]) {
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word.state === 0 && word.eff && word.eff.setHidden) {
          for (let j = 0; j < word.chars.length; j++) {
            word.eff.setHidden(word.chars[j].ctx);
          }
        }
      }
    };
    resetWordsLayout(wordsA);
    resetWordsLayout(wordsB);
  };

  window.addEventListener('resize', updateLayout);
  cleanups.push(function() { window.removeEventListener('resize', updateLayout); });

  const visHandler = function() {
    if (document.hidden) {
      state.active = false;
      if (ticking) { gsap.ticker.remove(tickFn!); ticking = false; }
    } else {
      state.active = true;
      state.lastY = scrollRuntime.getRawScroll();
      const r = (container as HTMLElement).getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        if (!ticking) { gsap.ticker.add(tickFn!); ticking = true; }
      }
    }
  };
  document.addEventListener('visibilitychange', visHandler);
  cleanups.push(function() { document.removeEventListener('visibilitychange', visHandler); });

  BlurStrategy.init();
  state.vpW = (container as HTMLElement).offsetWidth || window.innerWidth;
  wordsA = bakeWords(trackAEl);
  wordsB = bakeWords(trackBEl);
  updateLayout();
  state.offA = 0;
  state.offB = state.trW;

  $$('.word[data-effect="rotate-3d-scale"]').forEach(function(el: Element) { DebrisSystem.initPool(el); });

  const io = new IntersectionObserver(function(entries) {
    const entry = entries[0]; if (!entry) return; /* IO-SAFE-01 */
    const isVisible = entry.isIntersecting;
    state.active = isVisible;
    if (isVisible) {
      state.lastY = scrollRuntime.getRawScroll();
      if (!ticking) { gsap.ticker.add(tickFn!); ticking = true; }
    } else {
      if (ticking) { gsap.ticker.remove(tickFn!); ticking = false; }
    }
  }, { threshold: 0.1 });
  io.observe(container);
  observers.push(io);

  state.lastY = scrollRuntime.getRawScroll();
  const initialRect = (container as HTMLElement).getBoundingClientRect();
  const isInitiallyVisible = initialRect.top < window.innerHeight && initialRect.bottom > 0;
  if (isInitiallyVisible) { state.active = true; gsap.ticker.add(tickFn!); ticking = true; }

  function pause() {
    if (ticking) { gsap.ticker.remove(tickFn!); ticking = false; }
    for (let i = 0; i < hfListeners.length; i++) {
      const hf = hfListeners[i];
      if (!hf) continue;
      hf.target.removeEventListener(hf.event, hf.fn, hf.options);
    }
  }
  function resume() {
    state.lastY = scrollRuntime.getRawScroll(); /* B-VEL-01 */
    if (!ticking) { gsap.ticker.add(tickFn!); ticking = true; }
    for (let i = 0; i < hfListeners.length; i++) {
      const hf = hfListeners[i];
      if (!hf) continue;
      hf.target.addEventListener(hf.event, hf.fn, hf.options);
    }
  }
  function kill() {
    pause();
    for (let i = 0; i < cleanups.length; i++) {
      try {
        const cleanup = cleanups[i];
        if (cleanup) cleanup();
      } catch(e) { console.error('[love-wall-logo] cleanup error:', e); }
    }
    for (let i = 0; i < observers.length; i++) {
      try {
        const observer = observers[i];
        if (observer) observer.disconnect();
      } catch(e) {}
    }
    for (let i = 0; i < timerIds.length; i++) {
      const id = timerIds[i]; if (id) { try { clearTimeout(id); } catch(e) {} try { cancelAnimationFrame(id); } catch(e) {} }
    }
    for (let i = 0; i < gsapInstances.length; i++) {
      try { const inst = gsapInstances[i]; if (inst && (inst as any).revert) (inst as any).revert(); if (inst && inst.kill) inst.kill(); } catch(e) {}
    }
    state.active = false;
  }

  return { pause, resume, kill };
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: love-wall-velocity — Review Cards (Typ B)
   ═══════════════════════════════════════════════════════════════ */
function loveWallVelocityInit(container: HTMLElement): { pause: () => void; resume: () => void; kill: () => void } {
  'use strict';

  const $id = (id: string) => container.querySelector('#' + id);

  const cleanups: Array<() => void> = [];
  const gsapInstances: gsap.core.Tween[] = [];
  const timerIds: number[] = [];
  const observers: IntersectionObserver[] = [];

  let tickFn: ((time: number, deltaTime: number) => void) | null = null;
  let ticking = false;
  const hfListeners: Array<{ target: EventTarget; type: string; fn: EventListenerOrEventListenerObject; options: AddEventListenerOptions | boolean | undefined }> = [];

  function addHfListener(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, options: AddEventListenerOptions | boolean | undefined) {
    target.addEventListener(type, fn, options);
    hfListeners.push({ target, type, fn, options });
  }

  function addCleanup(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, options: AddEventListenerOptions | boolean | undefined) {
    target.addEventListener(type, fn, options);
    cleanups.push(function() { target.removeEventListener(type, fn, options as EventListenerOptions); });
  }

  const reviewsRow1 = [
    { text: "Wybitny profesjonalizm i dbałość o szczegóły i pełne zaangażowanie w uzyskanie efektu.", author: "Paweł Śledziński", fontClass: "card__quote--lexend-600 card__quote--size-90", avatar: "https://i.pravatar.cc/88?img=11" },
    { text: "Tutaj widać element twórczy. Kreacja stworzona przez Owocnych w końcu spełniła moje wymagania. Polecam.", author: "Tytus Rogalewski", fontClass: "card__quote--fraunces", avatar: "https://i.pravatar.cc/88?img=12" },
    { text: "Jako trener sprzedaży i biznesu, często muszę delegować zadania. Co można powiedzieć o owocnych? To najlepsze miejsce w które możesz trafić.", author: "Patryk Jasiński", fontClass: "card__quote--lexend-200 card__quote--mobile-md", avatar: "https://i.pravatar.cc/88?img=13" },
    { text: "Zespół potrafił wykonać projekt lepiej niż było to w moich wyobrażeniach. Dziękuję :) Polecam!!!", author: "A. Osiej", fontClass: "card__quote--lexend-400", avatar: "https://i.pravatar.cc/88?img=14" },
    { text: "Ci ludzie naprawdę znają się na swojej pracy! Jesteśmy zachwycone efektem końcowym projektu, jak i życzliwym podejściem całego zespołu.", author: "Małgorzata Rokicka", fontClass: "card__quote--lexend-200 card__quote--mobile-md", avatar: "https://i.pravatar.cc/88?img=15" },
    { text: "Ta firma dba o to, aby nie tylko poznać potrzeby klienta, ale również je zrozumieć. Zdecydowanie polecam.", author: "Maciej Nowak", fontClass: "card__quote--arial", avatar: "https://i.pravatar.cc/88?img=16" },
    { text: "Owocni to profesjonalna firma i jak każda popełnia błędy - ale ich wyróżnia to, że potrafią je poprawić. Dzięki i do zobaczenia!", author: "Konrad Kardacz", fontClass: "card__quote--lexend-600 card__quote--mobile-sm", avatar: "https://i.pravatar.cc/88?img=17" },
    { text: "Warto zainwestować swoje pieniądze w tak rzetelnej firmie. Dziękuję za współpracę!", author: "Maciej Śl", fontClass: "card__quote--lexend-800", avatar: "https://i.pravatar.cc/88?img=18" },
    { text: "Pomimo że dzieli nas cała Polska, kontakt był bardzo dobry.", author: "Mateusz Weredyński", fontClass: "card__quote--lexend-800 card__quote--size-xl-90", avatar: "https://i.pravatar.cc/88?img=19" },
    { text: "Analiza potrzeb i dużo pomysłów – nie ma tu przypadkowych działań. Pozdrawiam szczególnie Panią Karolinę. Polecam! \u{1F60A}", author: "Ula Jóźwik", fontClass: "card__quote--lexend-200 card__quote--mobile-sm", avatar: "https://i.pravatar.cc/88?img=20" }
  ];

  const reviewsRow2 = [
    { text: "Serdecznie Wam wszystkim dziękuję za zaangażowanie i cierpliwość! Dobra robota - świetny projekt. Pełen profesjonalizm!", author: "Arletta Szczurek", fontClass: "card__quote--fraunces card__quote--mobile-sm", avatar: "https://i.pravatar.cc/88?img=21" },
    { text: "Wszystko na świetnym poziomie: obsługa klienta, która urzeka profesjonalizmem, szybkość reakcji, wsłuchiwanie się w potrzeby.", author: "Anna Kopanczyk", fontClass: "card__quote--lexend-400 card__quote--mobile-md", avatar: "https://i.pravatar.cc/88?img=22" },
    { text: "Świetna firma, świetni ludzie. Współpraca przebiegała rewelacyjnie i szybko. Efekt końcowy świetny. Polecam!", author: "Piotr Orzeł", fontClass: "card__quote--lexend-600 card__quote--mobile-sm", avatar: "https://i.pravatar.cc/88?img=23" },
    { text: "Chciałbym gorąco polecić cały zespół owocnych w szczególności Panią Adriannę i Marcjannę które od początku współpracy dbają o nasz projekt.", author: "Maciej Szukała", fontClass: "card__quote--lexend-200 card__quote--mobile-md", avatar: "https://i.pravatar.cc/88?img=24" },
    { text: "Współpraca bardzo OWOCNA :) dużo cierpliwości..., kreatywności i rzetelnego podejścia. Z wielką przyjemnością polecam współpracę!", author: "Beata Glinka", fontClass: "card__quote--georgia card__quote--mobile-md", avatar: "https://i.pravatar.cc/88?img=25" },
    { text: "Już od pierwszego kontaktu czułem, że to właśnie ta firma. Polecam wszystkim, którzy chcą dobrze zainwestować w marketing swojej firmy.", author: "Wojciech Urbanowicz", fontClass: "card__quote--courier card__quote--size-xs card__quote--mobile-lg", avatar: "https://i.pravatar.cc/88?img=26" },
    { text: "Współpraca w pełni mnie usatysfakcjonowała, szczególnie pomysłowość i dobry kontakt z klientem. Polecam!!!", author: "Kinga Mizerska", fontClass: "card__quote--arial card__quote--mobile-sm", avatar: "https://i.pravatar.cc/88?img=27" },
    { text: "Stworzony projekt wyszedł super. Polecam na 100%.", author: "Bartosz Siwek", fontClass: "card__quote--lexend-800 card__quote--size-xl", avatar: "https://i.pravatar.cc/88?img=28" },
    { text: "Obsługa jest bardzo miła. Odpowiadają cierpliwie na każde pytanie. Jestem w 100% zadowolona ze strony", author: "Jzdoo", fontClass: "card__quote--courier card__quote--mobile-sm", avatar: "https://i.pravatar.cc/88?img=29" },
    { text: "Polecam Agencję Owocni z całego serca. Fenomenalna jakość usług w dobrej cenie.", author: "Wojciech Musiał", fontClass: "card__quote--lexend-800", avatar: "https://i.pravatar.cc/88?img=30" }
  ];

  function createCard(r: { text: string; author: string; fontClass: string; avatar: string }, i: number) {
    return '<div class="card-shell" data-index="' + i + '"><div class="card-tilt"><article class="card"><div class="card__rating"><span class="card__rating-number">5.0</span><div class="card__stars">' +
      '<svg class="card__star" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'.repeat(5) +
      '</div></div><p class="card__quote ' + (r.fontClass || '') + '">\u201C' + r.text + '\u201D</p><div class="card__author"><img class="card__avatar" loading="lazy" decoding="async" width="27" height="27" src="' + r.avatar + '" onerror="this.classList.add(\'load-failed\');this.onerror=null;" alt="' + r.author + '"><span class="card__name">' + r.author + '</span><button class="card__expand-btn" aria-label="Powiększ opinię">+</button></div></article></div></div>';
  }

  const REPEATS = 2;
  const repeatedRow1 = Array.from({ length: REPEATS }, function() { return reviewsRow1; }).flat();
  const repeatedRow2 = Array.from({ length: REPEATS }, function() { return reviewsRow2; }).flat();

  const row1Mover = $id('love-wall-row1-mover') as HTMLElement | null;
  const row2Mover = $id('love-wall-row2-mover') as HTMLElement | null;
  const row1Viewport = $id('love-wall-row1-viewport') as HTMLElement | null;
  const row2Viewport = $id('love-wall-row2-viewport') as HTMLElement | null;

  if (!row1Mover || !row2Mover || !row1Viewport || !row2Viewport) return { pause: () => {}, resume: () => {}, kill: () => {} };

  row1Mover.innerHTML = repeatedRow1.map(function(r, i) { return createCard(r, i); }).join('');
  row2Mover.innerHTML = repeatedRow2.map(function(r, i) { return createCard(r, i); }).join('');

  let resizeTimeout: number | null = null;
  function onResizeMeasure() {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    if (expandedState.shell) collapseExpandedCard();
    resizeTimeout = setTimeout(function() {
      measureSeam();
      scrollRuntime.requestRefresh('st-refresh');
    }, 250) as unknown as number;
    timerIds.push(resizeTimeout);
  }
  addCleanup(window, 'resize', onResizeMeasure, { passive: true });

  const CONFIG = {
    dtCap: 2.0, softResumeDuration: 0.6, softResumeEase: 'expo.out',
    maxTiltY: 6, gradientStart: 30, gradientRange: 25, gradientScaleMax: 1.15, textDriftMultiplier: 0.4,
    row1: {
      baseSpeed: 0.084,
      motion: { friction: 0.94, inputDecay: 0.22, velocityClamp: 6000, saturation: 800, boostFactor: 0.0028, deadzone: 40, riseClamp: 1260 },
      physics: { friction: 0.97, inputDecay: 0.25, velocityClamp: 9000, saturation: 2500, skewDivider: 200, scaleDivider: 15000, smooth: 0.03, deadzone: 40, riseClamp: 1540 }
    },
    row2: {
      baseSpeed: 0.118,
      motion: { friction: 0.96, inputDecay: 0.22, velocityClamp: 6000, saturation: 800, boostFactor: 0.0028, deadzone: 40, riseClamp: 1260 },
      physics: { friction: 0.96, inputDecay: 0.25, velocityClamp: 9000, saturation: 2500, skewDivider: 200, scaleDivider: 15000, smooth: 0.15, deadzone: 40, riseClamp: 1540 }
    }
  };

  const state = {
    tickerEnabled: false, lastScrollY: scrollRuntime.getRawScroll(),
    row1: { x: 0, paused: false, speedScale: { current: 1 }, activeShell: null as HTMLElement | null, hoverSuppressed: false, motionVelocity: 0, motionVelocityInput: 0, physicsVelocity: 0, physicsVelocityInput: 0, skew: 0, scale: 1, lastAppliedSkew: 0, lastAppliedScale: 1, scrollDeltaAccum: 0, stableScrollTime: 0 },
    row2: { x: 0, paused: false, speedScale: { current: 1 }, activeShell: null as HTMLElement | null, hoverSuppressed: false, motionVelocity: 0, motionVelocityInput: 0, physicsVelocity: 0, physicsVelocityInput: 0, skew: 0, scale: 1, lastAppliedSkew: 0, lastAppliedScale: 1, scrollDeltaAccum: 0, stableScrollTime: 0 }
  };

  let SEGMENT_PX_ROW1 = 0, SEGMENT_PX_ROW2 = 0, PX_PER_PERCENT_ROW1 = 0, PX_PER_PERCENT_ROW2 = 0;
  function measureSeam() {
    const p1 = reviewsRow1.length;
    const s1 = row1Mover!.querySelectorAll('.card-shell');
    const s1Start = s1[0] as HTMLElement | undefined;
    const s1Pivot = s1[p1] as HTMLElement | undefined;
    if (s1Start && s1Pivot) { const seg = s1Pivot.offsetLeft - s1Start.offsetLeft, w = row1Mover!.scrollWidth; if (seg > 0 && w > 0) { SEGMENT_PX_ROW1 = seg; PX_PER_PERCENT_ROW1 = w / 100; } }
    const p2 = reviewsRow2.length;
    const s2 = row2Mover!.querySelectorAll('.card-shell');
    const s2Start = s2[0] as HTMLElement | undefined;
    const s2Pivot = s2[p2] as HTMLElement | undefined;
    if (s2Start && s2Pivot) { const seg = s2Pivot.offsetLeft - s2Start.offsetLeft, w = row2Mover!.scrollWidth; if (seg > 0 && w > 0) { SEGMENT_PX_ROW2 = seg; PX_PER_PERCENT_ROW2 = w / 100; } }
  }
  measureSeam();

  const setRow1X = gsap.quickSetter(row1Mover, 'x', 'px');
  const setRow2X = gsap.quickSetter(row2Mover, 'x', 'px');
  const setRow1Skew = gsap.quickSetter(row1Viewport, '--row-skew');
  const setRow1Scale = gsap.quickSetter(row1Viewport, '--row-scale');
  const setRow2Skew = gsap.quickSetter(row2Viewport, '--row-skew');
  const setRow2Scale = gsap.quickSetter(row2Viewport, '--row-scale');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const canHover = window.matchMedia('(hover:hover)').matches;
  function fastTanh(x: number) { return x / (1 + Math.abs(x)); }
  const VELOCITY_EPSILON = 0.1, PHYSICS_EPSILON = 0.001;
  let lastWrittenRow1X: number | null = null, lastWrittenRow2X: number | null = null;

  function updateRowPhysics(rowState: typeof state.row1, cfg: typeof CONFIG.row1, vScroll: number, dt: number) {
    const motionCfg = cfg.motion, physicsCfg = cfg.physics;
    const vMotionIn = vScroll < (motionCfg.deadzone || 0) ? 0 : vScroll;
    const vPhysIn = vScroll < (physicsCfg.deadzone || 0) ? 0 : vScroll;

    rowState.motionVelocityInput = Math.min(motionCfg.velocityClamp, vMotionIn);
    rowState.physicsVelocityInput = Math.min(physicsCfg.velocityClamp, vPhysIn);

    rowState.motionVelocity *= Math.pow(motionCfg.friction, dt);
    const targetMotion = rowState.motionVelocityInput;
    if (targetMotion > rowState.motionVelocity) {
      const riseClamp = motionCfg.riseClamp || 1e9;
      rowState.motionVelocity = Math.min(targetMotion, rowState.motionVelocity + riseClamp * dt);
    }
    rowState.motionVelocityInput *= Math.pow(motionCfg.inputDecay, dt);
    if (rowState.motionVelocity < VELOCITY_EPSILON) rowState.motionVelocity = 0;

    const vMotionEff = motionCfg.saturation * fastTanh(rowState.motionVelocity / motionCfg.saturation);
    const motionBoost = vMotionEff * motionCfg.boostFactor;

    rowState.physicsVelocity *= Math.pow(physicsCfg.friction, dt);
    const targetPhys = rowState.physicsVelocityInput;
    if (targetPhys > rowState.physicsVelocity) {
      const riseClamp = physicsCfg.riseClamp || 1e9;
      rowState.physicsVelocity = Math.min(targetPhys, rowState.physicsVelocity + riseClamp * dt);
    }
    rowState.physicsVelocityInput *= Math.pow(physicsCfg.inputDecay, dt);
    if (rowState.physicsVelocity < VELOCITY_EPSILON) rowState.physicsVelocity = 0;

    const vPhysEff = physicsCfg.saturation * fastTanh(rowState.physicsVelocity / physicsCfg.saturation);
    const targetSkew = Math.max(-15, Math.min(15, -(vPhysEff / physicsCfg.skewDivider)));
    const targetScale = Math.max(1, Math.min(1.15, 1 + (vPhysEff / physicsCfg.scaleDivider)));
    const alpha = 1 - Math.pow(1 - physicsCfg.smooth, dt);

    if (Math.abs(targetSkew - rowState.skew) > PHYSICS_EPSILON) rowState.skew += (targetSkew - rowState.skew) * alpha;
    if (Math.abs(targetScale - rowState.scale) > PHYSICS_EPSILON) rowState.scale += (targetScale - rowState.scale) * alpha;

    return motionBoost;
  }

  function tick(_time: number, deltaTime: number) {
    const y = scrollRuntime.getRawScroll(), dy = y - (state.lastScrollY || 0);
    state.lastScrollY = y;
    const dtMs = deltaTime || 0, dtSec = dtMs > 0 ? dtMs / 1000 : 0, absDy = Math.abs(dy);
    const DY_DEADZONE = 2;

    let vScroll: number;
    if ((window as any).__smoothedVelocity !== undefined) {
      vScroll = (window as any).__smoothedVelocity;
    } else {
      vScroll = (absDy < DY_DEADZONE || dtSec <= 0) ? 0 : absDy / dtSec;
    }
    const dtRaw = dtMs / 16.66, dt = Math.min(dtRaw, CONFIG.dtCap);

    const SCROLL_KILL_THRESHOLD = 4;
    if (state.row1.activeShell && absDy > 0) {
      state.row1.scrollDeltaAccum += absDy;
      if (state.row1.scrollDeltaAccum >= SCROLL_KILL_THRESHOLD) { clearRowFocus(state.row1, row1Viewport!); }
    }
    if (state.row2.activeShell && absDy > 0) {
      state.row2.scrollDeltaAccum += absDy;
      if (state.row2.scrollDeltaAccum >= SCROLL_KILL_THRESHOLD) { clearRowFocus(state.row2, row2Viewport!); }
    }

    const STABLE_SCROLL_EPSILON = 0.5, STABLE_SCROLL_THRESHOLD = 150;
    if (absDy < STABLE_SCROLL_EPSILON) { state.row1.stableScrollTime += dtMs; state.row2.stableScrollTime += dtMs; }
    else { state.row1.stableScrollTime = 0; state.row2.stableScrollTime = 0; }

    // STABLE_SCROLL_THRESHOLD referenced in logic — suppress unused warning
    void STABLE_SCROLL_THRESHOLD;

    let motionBoost1 = 0;
    if (!state.row1.paused) {
      motionBoost1 = updateRowPhysics(state.row1, CONFIG.row1, vScroll, dt);
      const SKEW_THRESHOLD = 0.05, SCALE_THRESHOLD = 0.002;
      const skewChanged = Math.abs(state.row1.skew - state.row1.lastAppliedSkew) > SKEW_THRESHOLD;
      const scaleChanged = Math.abs(state.row1.scale - state.row1.lastAppliedScale) > SCALE_THRESHOLD;
      if (skewChanged || scaleChanged) {
        setRow1Skew(state.row1.skew.toFixed(2) + 'deg');
        setRow1Scale(state.row1.scale.toFixed(3));
        state.row1.lastAppliedSkew = state.row1.skew;
        state.row1.lastAppliedScale = state.row1.scale;
      }
      const ts = (CONFIG.row1.baseSpeed + motionBoost1) * dt;
      const dp = 0.05 * ts * state.row1.speedScale.current;
      const dx = dp * (PX_PER_PERCENT_ROW1 || 0);
      state.row1.x -= dx;
      if (SEGMENT_PX_ROW1 > 0) while (state.row1.x <= -SEGMENT_PX_ROW1) state.row1.x += SEGMENT_PX_ROW1;
    }

    let motionBoost2 = 0;
    if (!state.row2.paused) {
      motionBoost2 = updateRowPhysics(state.row2, CONFIG.row2, vScroll, dt);
      const SKEW_THRESHOLD = 0.05, SCALE_THRESHOLD = 0.002;
      const skewChanged = Math.abs(state.row2.skew - state.row2.lastAppliedSkew) > SKEW_THRESHOLD;
      const scaleChanged = Math.abs(state.row2.scale - state.row2.lastAppliedScale) > SCALE_THRESHOLD;
      if (skewChanged || scaleChanged) {
        setRow2Skew(state.row2.skew.toFixed(2) + 'deg');
        setRow2Scale(state.row2.scale.toFixed(3));
        state.row2.lastAppliedSkew = state.row2.skew;
        state.row2.lastAppliedScale = state.row2.scale;
      }
      const ts = (CONFIG.row2.baseSpeed + motionBoost2) * dt;
      const dp = 0.05 * ts * state.row2.speedScale.current;
      const dx = dp * (PX_PER_PERCENT_ROW2 || 0);
      state.row2.x -= dx;
      if (SEGMENT_PX_ROW2 > 0) while (state.row2.x <= -SEGMENT_PX_ROW2) state.row2.x += SEGMENT_PX_ROW2;
    }

    if (state.row1.x !== lastWrittenRow1X) { setRow1X(state.row1.x); lastWrittenRow1X = state.row1.x; }
    if (state.row2.x !== lastWrittenRow2X) { setRow2X(state.row2.x); lastWrittenRow2X = state.row2.x; }
  }

  function startTicker() { if (!state.tickerEnabled) { state.tickerEnabled = true; ticking = true; gsap.ticker.add(tickFn!); } }
  function stopTicker() { if (state.tickerEnabled) { state.tickerEnabled = false; ticking = false; gsap.ticker.remove(tickFn!); } }

  function clearRowFocus(rowState: typeof state.row1, viewport: HTMLElement) {
    if (expandedState.shell && expandedState.rowState === rowState) {
      collapseExpandedCard();
    }
    const hadActiveShell = rowState.activeShell;
    if (hadActiveShell) {
      const activeTilt = hadActiveShell.querySelector('.card-tilt') as HTMLElement | null;
      if (activeTilt) {
        activeTilt.style.removeProperty('--lift-z');
        activeTilt.style.removeProperty('--card-scale');
        activeTilt.style.removeProperty('--lift-y');
        activeTilt.style.removeProperty('--tilt-x');
        activeTilt.style.removeProperty('--tilt-y');
      }
      const activeCard = hadActiveShell.querySelector('.card') as HTMLElement | null;
      if (activeCard) { activeCard.style.removeProperty('opacity'); }
      hadActiveShell.classList.remove('is-active');
      rowState.activeShell = null;
    }
    viewport.classList.remove('is-hovering');

    rowState.paused = false;
    rowState.scrollDeltaAccum = 0;
    rowState.hoverSuppressed = false;

    const setSkew = viewport === row1Viewport ? setRow1Skew : setRow2Skew;
    const setScale = viewport === row1Viewport ? setRow1Scale : setRow2Scale;

    gsap.killTweensOf(rowState);
    gsap.killTweensOf(rowState.speedScale);

    const tweenA = gsap.to(rowState, {
      skew: 0, scale: 1, physicsVelocity: 0,
      duration: CONFIG.softResumeDuration, ease: CONFIG.softResumeEase,
      onUpdate: function() {
        setSkew(rowState.skew.toFixed(2) + 'deg');
        setScale(rowState.scale.toFixed(3));
        rowState.lastAppliedSkew = rowState.skew;
        rowState.lastAppliedScale = rowState.scale;
      },
      onComplete: function() { rowState.physicsVelocityInput = 0; }
    });
    gsapInstances.push(tweenA);

    const tweenB = gsap.to(rowState.speedScale, { current: 1, duration: CONFIG.softResumeDuration, ease: CONFIG.softResumeEase, overwrite: true });
    gsapInstances.push(tweenB);
  }

  function resetAllOnScroll() {
    clearRowFocus(state.row1, row1Viewport!);
    clearRowFocus(state.row2, row2Viewport!);
  }

  if (!prefersReducedMotion) {
    const stInstance = ScrollTrigger.create({
      trigger: container,
      start: 'top bottom',
      end: 'bottom top',
      onEnter: function() { startTicker(); attachHfListeners(); },
      onEnterBack: function() { startTicker(); attachHfListeners(); },
      onLeave: function() { resetAllOnScroll(); stopTicker(); detachHfListeners(); },
      onLeaveBack: function() { resetAllOnScroll(); stopTicker(); detachHfListeners(); }
    });
    gsapInstances.push(stInstance as unknown as gsap.core.Tween);
  }

  let hfAttached = false;
  function attachHfListeners() {
    if (hfAttached) return;
    hfAttached = true;
    for (let i = 0; i < hfListeners.length; i++) {
      const h = hfListeners[i];
      if (!h) continue;
      h.target.addEventListener(h.type, h.fn, h.options);
    }
  }
  function detachHfListeners() {
    if (!hfAttached) return;
    hfAttached = false;
    for (let i = 0; i < hfListeners.length; i++) {
      const h = hfListeners[i];
      if (!h) continue;
      h.target.removeEventListener(h.type, h.fn, h.options as EventListenerOptions);
    }
  }

  if (canHover && !prefersReducedMotion) {
    const tiltState = new WeakMap<HTMLElement, { clientX: number; raf: number; bounds: { width: number; centerX: number }; cardEl: HTMLElement | null; tiltEl: HTMLElement | null }>();
    let lastPMTarget: EventTarget | null = null, lastPMShell: HTMLElement | null = null;

    function resetTilt(shell: HTMLElement) {
      const cached = tiltState.get(shell);
      const card = (cached && cached.cardEl) || shell.querySelector('.card') as HTMLElement | null;
      const tiltEl = (cached && cached.tiltEl) || shell.querySelector('.card-tilt') as HTMLElement | null;
      if (tiltEl) { tiltEl.style.setProperty('--tilt-y', '0deg'); tiltEl.style.removeProperty('--tilt-x'); }
      if (card) { card.style.setProperty('--gradient-x', CONFIG.gradientStart + '%'); card.style.setProperty('--gradient-scale', '1'); card.style.setProperty('--text-x', '0px'); }
    }

    function updateTilt(shell: HTMLElement) {
      const s = tiltState.get(shell); if (!s) return; s.raf = 0;
      const card = s.cardEl, tiltEl = s.tiltEl; if (!card || !tiltEl) return;
      const width = s.bounds.width, centerX = s.bounds.centerX;
      const relX = (s.clientX - centerX) / (width / 2), x = Math.max(-1, Math.min(1, relX));
      const tiltY = x * CONFIG.maxTiltY, gradientX = CONFIG.gradientStart - (x * CONFIG.gradientRange), gradientScale = 1 + (Math.abs(x) * (CONFIG.gradientScaleMax - 1)), textX = x * CONFIG.maxTiltY * CONFIG.textDriftMultiplier;
      tiltEl.style.setProperty('--tilt-y', tiltY + 'deg'); card.style.setProperty('--gradient-x', gradientX + '%'); card.style.setProperty('--gradient-scale', '' + gradientScale); card.style.setProperty('--text-x', textX + 'px');
    }

    function setActiveShell(viewport: HTMLElement, rowState: typeof state.row1, shell: HTMLElement, clientX: number) {
      if (rowState.activeShell && rowState.activeShell !== shell) {
        rowState.activeShell.classList.remove('is-active');
        const p = tiltState.get(rowState.activeShell);
        if (p && p.raf) { cancelAnimationFrame(p.raf); }
        resetTilt(rowState.activeShell);
      }
      rowState.activeShell = shell;
      shell.classList.add('is-active');
      viewport.classList.add('is-hovering');
      const rect = shell.getBoundingClientRect();
      const cardEl = shell.querySelector('.card') as HTMLElement | null;
      const tiltEl = shell.querySelector('.card-tilt') as HTMLElement | null;
      tiltState.set(shell, { clientX, raf: 0, bounds: { width: rect.width, centerX: rect.left + rect.width / 2 }, cardEl, tiltEl });
      const s = tiltState.get(shell);
      if (s && !s.raf) { const rafId = requestAnimationFrame(function() { updateTilt(shell); }); s.raf = rafId; }
    }

    function setupRowHover(viewport: HTMLElement, rowState: typeof state.row1, _cfg: typeof CONFIG.row1) {
      function onPointerEnter() { if (rowState.hoverSuppressed) return; rowState.scrollDeltaAccum = 0; }

      function onPointerMoveRow(e: Event) {
        const pe = e as PointerEvent;
        let shell: HTMLElement | null;
        if (pe.target === lastPMTarget) { shell = lastPMShell; }
        else { shell = (pe.target as HTMLElement).closest('.card-shell'); lastPMTarget = pe.target; lastPMShell = shell; }

        if (rowState.hoverSuppressed && shell) return;

        if (!shell) {
          if (rowState.hoverSuppressed) rowState.hoverSuppressed = false;
          if (rowState.activeShell) {
            rowState.activeShell.classList.remove('is-active');
            const s = tiltState.get(rowState.activeShell);
            if (s && s.raf) cancelAnimationFrame(s.raf);
            resetTilt(rowState.activeShell);
            rowState.activeShell = null;
          }
          viewport.classList.remove('is-hovering');
          if (rowState.paused) {
            rowState.paused = false;
            gsap.killTweensOf(rowState);
            const tw1 = gsap.to(rowState.speedScale, { current: 1, duration: CONFIG.softResumeDuration, ease: CONFIG.softResumeEase, overwrite: true });
            gsapInstances.push(tw1);
            const setSkew = viewport === row1Viewport ? setRow1Skew : setRow2Skew;
            const setScale = viewport === row1Viewport ? setRow1Scale : setRow2Scale;
            const tw2 = gsap.to(rowState, {
              skew: 0, scale: 1, duration: CONFIG.softResumeDuration, ease: CONFIG.softResumeEase,
              onUpdate: function() {
                setSkew(rowState.skew.toFixed(2) + 'deg');
                setScale(rowState.scale.toFixed(3));
                rowState.lastAppliedSkew = rowState.skew;
                rowState.lastAppliedScale = rowState.scale;
              }
            });
            gsapInstances.push(tw2);
          }
          return;
        }

        viewport.classList.add('is-hovering');
        if (!rowState.activeShell || rowState.activeShell !== shell) {
          setActiveShell(viewport, rowState, shell, pe.clientX);
        } else {
          const s = tiltState.get(shell);
          if (!s) return;
          if (s.clientX === pe.clientX) return;
          s.clientX = pe.clientX;
          if (!s.raf) { const rafId = requestAnimationFrame(function() { updateTilt(shell!); }); s.raf = rafId; }
        }

        if (!rowState.paused) {
          rowState.paused = true;
          gsap.killTweensOf(rowState.speedScale);
          gsap.killTweensOf(rowState);
          const currentSpeed = rowState.speedScale.current;
          const brakeDuration = Math.max(0.3, Math.min(0.8, currentSpeed * 0.6));
          const tw3 = gsap.to(rowState.speedScale, { current: 0, duration: brakeDuration, ease: 'power3.out', overwrite: true });
          gsapInstances.push(tw3);
          const setSkew = viewport === row1Viewport ? setRow1Skew : setRow2Skew;
          const setScale = viewport === row1Viewport ? setRow1Scale : setRow2Scale;
          const tw4 = gsap.to(rowState, {
            skew: 0, scale: 1, duration: brakeDuration * 1.2, ease: 'power2.out',
            onUpdate: function() {
              setSkew(rowState.skew.toFixed(2) + 'deg');
              setScale(rowState.scale.toFixed(3));
              rowState.lastAppliedSkew = rowState.skew;
              rowState.lastAppliedScale = rowState.scale;
            }
          });
          gsapInstances.push(tw4);
        }
      }

      function onPointerLeave() {
        rowState.hoverSuppressed = false;
        lastPMTarget = null; lastPMShell = null;
        clearRowFocus(rowState, viewport);
      }

      addCleanup(viewport, 'pointerenter', onPointerEnter, undefined);
      addHfListener(viewport, 'pointermove', onPointerMoveRow, undefined);
      addCleanup(viewport, 'pointerleave', onPointerLeave, undefined);
    }

    setupRowHover(row1Viewport, state.row1, CONFIG.row1);
    setupRowHover(row2Viewport, state.row2, CONFIG.row2);
  }

  if (!canHover && !prefersReducedMotion) {
    function deactivateRow(rowState: typeof state.row1, viewport: HTMLElement) {
      if (rowState.activeShell) { rowState.activeShell.classList.remove('is-active'); rowState.activeShell = null; }
      viewport.classList.remove('is-hovering');
      rowState.paused = false;
      const tw = gsap.to(rowState.speedScale, { current: 1, duration: CONFIG.softResumeDuration, ease: CONFIG.softResumeEase, overwrite: true });
      gsapInstances.push(tw);
    }

    function activateCard(viewport: HTMLElement, rowState: typeof state.row1, shell: HTMLElement) {
      if (rowState.activeShell && rowState.activeShell !== shell) { rowState.activeShell.classList.remove('is-active'); }
      rowState.paused = true;
      gsap.killTweensOf(rowState.speedScale);
      rowState.speedScale.current = 0;
      rowState.activeShell = shell;
      shell.classList.add('is-active');
      viewport.classList.add('is-hovering');
    }

    function setupTapToggle(viewport: HTMLElement, rowState: typeof state.row1) {
      function onPointerDown(e: Event) {
        if (isMobileExpandMode()) return;
        const pe = e as PointerEvent;
        const shell = (pe.target as HTMLElement).closest('.card-shell') as HTMLElement | null;
        if (shell && shell !== rowState.activeShell) { activateCard(viewport, rowState, shell); return; }
        if (rowState.activeShell) deactivateRow(rowState, viewport);
      }
      addCleanup(viewport, 'pointerdown', onPointerDown, undefined);
    }

    setupTapToggle(row1Viewport, state.row1);
    setupTapToggle(row2Viewport, state.row2);
  }

  const MOBILE_BREAKPOINT = 500, TAP_THRESHOLD = 10;
  const expandedState: { shell: HTMLElement | null; viewport: HTMLElement | null; rowState: typeof state.row1 | null; rowId: string | null; activePointerId: number | null; pointerStart: { x: number; y: number } | null; wasDrag: boolean; suppressNextClick: boolean } = { shell: null, viewport: null, rowState: null, rowId: null, activePointerId: null, pointerStart: null, wasDrag: false, suppressNextClick: false };

  const swipe: { tracking: boolean; dragging: boolean; decided: boolean; pointerId: number | null; startX: number; startY: number; lastX: number; viewport: HTMLElement | null; rowState: typeof state.row1 | null; rowId: string | null; samples: Array<{ x: number; t: number }> } = { tracking: false, dragging: false, decided: false, pointerId: null, startX: 0, startY: 0, lastX: 0, viewport: null, rowState: null, rowId: null, samples: [] };

  function isMobileExpandMode() { return window.innerWidth < MOBILE_BREAKPOINT; }

  function freezeRow(rowState: typeof state.row1, viewport: HTMLElement) {
    rowState.paused = true;
    gsap.killTweensOf(rowState.speedScale);
    rowState.speedScale.current = 0;
    rowState.skew = 0; rowState.scale = 1;
    rowState.physicsVelocity = 0; rowState.physicsVelocityInput = 0;
    const setSkew = viewport === row1Viewport ? setRow1Skew : setRow2Skew;
    const setScale = viewport === row1Viewport ? setRow1Scale : setRow2Scale;
    setSkew('0deg'); setScale('1');
  }

  function unfreezeRow(rowState: typeof state.row1) {
    rowState.paused = false;
    const tw = gsap.to(rowState.speedScale, { current: 1, duration: CONFIG.softResumeDuration, ease: CONFIG.softResumeEase });
    gsapInstances.push(tw);
  }

  const gyro = {
    permission: 'pending' as string,
    listening: false,
    active: false,
    rafId: null as number | null,
    currentTiltY: 0,
    currentTiltX: 0,
    rawGamma: 0,
    rawBeta: 0,
    neutralBeta: 70,
    tiltEl: null as HTMLElement | null,
    cardEl: null as HTMLElement | null
  };

  function gyroOnOrientation(e: Event) {
    const oe = e as DeviceOrientationEvent;
    if (oe.gamma !== null) gyro.rawGamma = oe.gamma;
    if (oe.beta !== null) gyro.rawBeta = oe.beta;
  }

  function gyroStartListening() {
    if (gyro.listening) return;
    gyro.listening = true;
    window.addEventListener('deviceorientation', gyroOnOrientation, { passive: true });
    cleanups.push(function() { window.removeEventListener('deviceorientation', gyroOnOrientation); });
  }

  function gyroRequestPermission(callback: (status: string) => void) {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission().then(function(result: string) {
        gyro.permission = result === 'granted' ? 'granted' : 'denied';
        if (gyro.permission === 'granted') gyroStartListening();
        callback(gyro.permission);
      }).catch(function() {
        gyro.permission = 'denied';
        callback('denied');
      });
    } else if ('DeviceOrientationEvent' in window) {
      gyro.permission = 'granted';
      gyroStartListening();
      callback('granted');
    } else {
      gyro.permission = 'unavailable';
      callback('unavailable');
    }
  }

  function gyroUpdate() {
    if (!gyro.active || !gyro.tiltEl) return;

    const gammaClamp = Math.max(-45, Math.min(45, gyro.rawGamma));
    const targetTiltY = (gammaClamp / 45) * 8;

    const betaDelta = gyro.rawBeta - gyro.neutralBeta;
    const betaClamp = Math.max(-30, Math.min(30, betaDelta));
    const targetTiltX = (betaClamp / 30) * 5;

    gyro.currentTiltY += (targetTiltY - gyro.currentTiltY) * 0.12;
    gyro.currentTiltX += (targetTiltX - gyro.currentTiltX) * 0.12;

    gyro.tiltEl.style.setProperty('--tilt-y', gyro.currentTiltY.toFixed(2) + 'deg');
    gyro.tiltEl.style.setProperty('--tilt-x', gyro.currentTiltX.toFixed(2) + 'deg');

    if (gyro.cardEl) {
      const x = gyro.currentTiltY / 8;
      const gradientX = CONFIG.gradientStart - (x * CONFIG.gradientRange);
      const gradientScale = 1 + (Math.abs(x) * (CONFIG.gradientScaleMax - 1));
      gyro.cardEl.style.setProperty('--gradient-x', gradientX + '%');
      gyro.cardEl.style.setProperty('--gradient-scale', '' + gradientScale);
    }

    gyro.rafId = requestAnimationFrame(gyroUpdate);
  }

  function gyroActivate(shell: HTMLElement) {
    if (gyro.permission !== 'granted') return;
    const tiltEl = shell.querySelector('.card-tilt') as HTMLElement | null;
    const cardEl = shell.querySelector('.card') as HTMLElement | null;
    if (!tiltEl) return;

    gyro.tiltEl = tiltEl;
    gyro.cardEl = cardEl;
    gyro.neutralBeta = gyro.rawBeta || 70;
    gyro.currentTiltY = 0;
    gyro.currentTiltX = 0;
    gyro.active = true;

    tiltEl.style.transition = 'none';
    tiltEl.style.willChange = 'transform';

    gyroUpdate();
  }

  function gyroDeactivate() {
    gyro.active = false;
    if (gyro.rafId) { cancelAnimationFrame(gyro.rafId); gyro.rafId = null; }

    if (gyro.tiltEl) {
      gyro.tiltEl.style.setProperty('--tilt-y', '0deg');
      gyro.tiltEl.style.setProperty('--tilt-x', '0deg');
      gyro.tiltEl.style.removeProperty('transition');
      gyro.tiltEl.style.removeProperty('will-change');
    }
    if (gyro.cardEl) {
      gyro.cardEl.style.setProperty('--gradient-x', CONFIG.gradientStart + '%');
      gyro.cardEl.style.setProperty('--gradient-scale', '1');
    }
    gyro.tiltEl = null;
    gyro.cardEl = null;
  }

  function getOffsetToCenter(shell: HTMLElement) {
    const r = shell.getBoundingClientRect();
    return window.innerWidth / 2 - (r.left + r.width / 2);
  }

  function centerCard(shell: HTMLElement, rowState: typeof state.row1, segmentPx: number, setRowX: (val: number) => void, onComplete?: () => void) {
    if (segmentPx <= 0) { if (onComplete) onComplete(); return; }
    const offset = getOffsetToCenter(shell), startX = rowState.x, anim = { progress: 0 };
    const tweenVars: gsap.TweenVars = {
      progress: 1, duration: 0.45, ease: 'power2.out',
      onUpdate: function() {
        rowState.x = startX + (offset * anim.progress);
        while (rowState.x <= -segmentPx) rowState.x += segmentPx;
        while (rowState.x > 0) rowState.x -= segmentPx;
        setRowX(rowState.x);
      },
    };
    if (onComplete) tweenVars.onComplete = onComplete;
    const tw = gsap.to(anim, tweenVars);
    gsapInstances.push(tw);
  }

  function expandCardMobile(shell: HTMLElement, viewport: HTMLElement, rowState: typeof state.row1, rowId: string) {
    if (expandedState.shell) collapseExpandedCard();
    expandedState.shell = shell; expandedState.viewport = viewport;
    expandedState.rowState = rowState; expandedState.rowId = rowId;
    freezeRow(rowState, viewport);

    if (rowState.activeShell && rowState.activeShell !== shell) rowState.activeShell.classList.remove('is-active');
    rowState.activeShell = shell;
    shell.classList.add('is-active');
    shell.classList.add('is-expanded');
    viewport.classList.add('has-expanded');
    const rowClip = viewport.parentElement;
    if (rowClip) { rowClip.style.position = 'relative'; rowClip.style.zIndex = '10'; rowClip.classList.add('is-row-expanded'); }

    const segmentPx = rowId === 'row1' ? SEGMENT_PX_ROW1 : SEGMENT_PX_ROW2;
    const setRowX = rowId === 'row1' ? setRow1X : setRow2X;
    centerCard(shell, rowState, segmentPx, setRowX as (val: number) => void, function() {
      const gyroTimer = setTimeout(function() {
        if (expandedState.shell === shell) gyroActivate(shell);
      }, 250) as unknown as number;
      timerIds.push(gyroTimer);
    });
  }

  function collapseExpandedCard() {
    if (!expandedState.shell) return;
    gyroDeactivate();
    const shell = expandedState.shell, viewport = expandedState.viewport, rowState = expandedState.rowState;
    expandedState.shell = null; expandedState.viewport = null;
    expandedState.rowState = null; expandedState.rowId = null;
    expandedState.activePointerId = null; expandedState.pointerStart = null; expandedState.wasDrag = false;
    shell.classList.remove('is-expanded'); shell.classList.remove('is-active');
    if (!viewport) return;
    viewport.classList.remove('has-expanded');
    const rowClip = viewport.parentElement;
    if (rowClip) { rowClip.style.position = ''; rowClip.style.zIndex = ''; rowClip.classList.remove('is-row-expanded'); }
    if (rowState) rowState.activeShell = null;
    if (rowState) unfreezeRow(rowState);
  }

  function onTapOutside(e: Event) { if (!expandedState.shell) return; if (!(e.target as HTMLElement).closest('.card-shell')) collapseExpandedCard(); }
  addCleanup(document, 'pointerup', onTapOutside, undefined);

  function handleRowPointerDown(e: Event, viewport: HTMLElement, rowState: typeof state.row1, rowId: string) {
    if (!isMobileExpandMode()) return;
    const pe = e as PointerEvent;
    const shell = (pe.target as HTMLElement).closest('.card-shell') as HTMLElement | null;
    if (!shell) { if (expandedState.shell) collapseExpandedCard(); return; }
    if (shell === expandedState.shell) {
      if (pe.isPrimary) { expandedState.activePointerId = pe.pointerId; expandedState.pointerStart = { x: pe.clientX, y: pe.clientY }; expandedState.wasDrag = false; }
      return;
    }
    if (!pe.isPrimary) return;
    swipe.tracking = true; swipe.dragging = false; swipe.decided = false;
    swipe.pointerId = pe.pointerId;
    swipe.startX = pe.clientX; swipe.startY = pe.clientY; swipe.lastX = pe.clientX;
    swipe.viewport = viewport; swipe.rowState = rowState; swipe.rowId = rowId;
    swipe.samples = [{ x: pe.clientX, t: Date.now() }];
  }

  function handleRowClick(e: Event, viewport: HTMLElement, rowState: typeof state.row1, rowId: string) {
    if (!isMobileExpandMode()) return;
    if (expandedState.suppressNextClick) { expandedState.suppressNextClick = false; return; }
    const shell = (e.target as HTMLElement).closest('.card-shell') as HTMLElement | null;
    if (!shell || shell === expandedState.shell) return;
    if (expandedState.shell) collapseExpandedCard();
    if (gyro.permission === 'pending') {
      gyroRequestPermission(function(status) {
        if (status === 'granted' && expandedState.shell) gyroActivate(expandedState.shell);
      });
    }
    expandCardMobile(shell, viewport, rowState, rowId);
  }

  function onRow1PointerDown(e: Event) { handleRowPointerDown(e, row1Viewport!, state.row1, 'row1'); }
  function onRow2PointerDown(e: Event) { handleRowPointerDown(e, row2Viewport!, state.row2, 'row2'); }
  function onRow1Click(e: Event) { handleRowClick(e, row1Viewport!, state.row1, 'row1'); }
  function onRow2Click(e: Event) { handleRowClick(e, row2Viewport!, state.row2, 'row2'); }
  row1Viewport.addEventListener('pointerdown', onRow1PointerDown, { capture: true });
  cleanups.push(function() { row1Viewport.removeEventListener('pointerdown', onRow1PointerDown, { capture: true }); });
  row2Viewport.addEventListener('pointerdown', onRow2PointerDown, { capture: true });
  cleanups.push(function() { row2Viewport.removeEventListener('pointerdown', onRow2PointerDown, { capture: true }); });
  row1Viewport.addEventListener('click', onRow1Click, { capture: true });
  cleanups.push(function() { row1Viewport.removeEventListener('click', onRow1Click, { capture: true }); });
  row2Viewport.addEventListener('click', onRow2Click, { capture: true });
  cleanups.push(function() { row2Viewport.removeEventListener('click', onRow2Click, { capture: true }); });

  function onDocPointerMove(e: Event) {
    const pe = e as PointerEvent;
    if (!expandedState.shell || !expandedState.pointerStart || pe.pointerId !== expandedState.activePointerId) {
      /* fall through to swipe check */
    } else {
      const dx = Math.abs(pe.clientX - expandedState.pointerStart.x), dy = Math.abs(pe.clientY - expandedState.pointerStart.y);
      if (dx > TAP_THRESHOLD || dy > TAP_THRESHOLD) {
        expandedState.wasDrag = true; expandedState.activePointerId = null; expandedState.pointerStart = null;
        expandedState.suppressNextClick = true;
        collapseExpandedCard();
      }
      return;
    }

    if (!swipe.tracking || pe.pointerId !== swipe.pointerId) return;
    if (swipe.decided && !swipe.dragging) return;

    const sdx = pe.clientX - swipe.startX, sdy = pe.clientY - swipe.startY;
    const adx = Math.abs(sdx), ady = Math.abs(sdy);

    if (!swipe.decided) {
      if (ady > adx && ady > 8) { swipe.decided = true; swipe.tracking = false; return; }
      if (adx > 8) {
        swipe.decided = true; swipe.dragging = true;
        if (expandedState.shell) { expandedState.suppressNextClick = true; collapseExpandedCard(); }
        if (swipe.rowState && swipe.viewport) freezeRow(swipe.rowState, swipe.viewport);
      } else { return; }
    }

    const moveDx = pe.clientX - swipe.lastX;
    const rs = swipe.rowState;
    if (!rs) return;
    const segPx = swipe.rowId === 'row1' ? SEGMENT_PX_ROW1 : SEGMENT_PX_ROW2;
    const setRX = swipe.rowId === 'row1' ? setRow1X : setRow2X;
    rs.x += moveDx;
    if (segPx > 0) { while (rs.x <= -segPx) rs.x += segPx; while (rs.x > 0) rs.x -= segPx; }
    setRX(rs.x);
    swipe.lastX = pe.clientX;
    swipe.samples.push({ x: pe.clientX, t: Date.now() });
    if (swipe.samples.length > 5) swipe.samples.shift();
  }
  addHfListener(document, 'pointermove', onDocPointerMove, { passive: true });

  function onDocPointerUp(e: Event) {
    const pe = e as PointerEvent;
    if (expandedState.shell && expandedState.pointerStart && pe.pointerId === expandedState.activePointerId) {
      const wasActualTap = !expandedState.wasDrag;
      expandedState.activePointerId = null; expandedState.pointerStart = null; expandedState.wasDrag = false;
      if (wasActualTap) { expandedState.suppressNextClick = true; collapseExpandedCard(); }
      return;
    }

    if (!swipe.tracking || pe.pointerId !== swipe.pointerId) return;
    const wasDragging = swipe.dragging;
    const capturedRowState = swipe.rowState;
    const capturedRowId = swipe.rowId;
    swipe.tracking = false; swipe.pointerId = null;

    if (wasDragging && capturedRowState) {
      const s = swipe.samples;
      let vx = 0;
      if (s.length >= 2) {
        const first = s[0];
        const last = s[s.length - 1];
        if (first && last) {
          const dt = (last.t - first.t) / 1000;
          if (dt > 0.01) vx = (last.x - first.x) / dt;
        }
      }
      vx = Math.max(-2500, Math.min(2500, vx));

      if (Math.abs(vx) > 60) {
        const segPx = capturedRowId === 'row1' ? SEGMENT_PX_ROW1 : SEGMENT_PX_ROW2;
        const setRX = capturedRowId === 'row1' ? setRow1X : setRow2X;
        const mom = { v: vx };
        const tw = gsap.to(mom, {
          v: 0, duration: Math.min(1.0, Math.abs(vx) / 2000), ease: 'power2.out',
          onUpdate: function() {
            capturedRowState.x += mom.v * 0.016;
            if (segPx > 0) { while (capturedRowState.x <= -segPx) capturedRowState.x += segPx; while (capturedRowState.x > 0) capturedRowState.x -= segPx; }
            setRX(capturedRowState.x);
          },
          onComplete: function() { unfreezeRow(capturedRowState); }
        });
        gsapInstances.push(tw);
      } else {
        unfreezeRow(capturedRowState);
      }
      expandedState.suppressNextClick = true;
    }
  }
  addCleanup(document, 'pointerup', onDocPointerUp, undefined);

  function onDocPointerCancel(e: Event) {
    const pe = e as PointerEvent;
    if (pe.pointerId === expandedState.activePointerId) {
      expandedState.activePointerId = null; expandedState.pointerStart = null; expandedState.wasDrag = false;
    }
    if (swipe.tracking && pe.pointerId === swipe.pointerId) {
      if (swipe.dragging && swipe.rowState) unfreezeRow(swipe.rowState);
      swipe.tracking = false; swipe.pointerId = null;
    }
  }
  addCleanup(document, 'pointercancel', onDocPointerCancel, undefined);

  function onLoad() { measureSeam(); scrollRuntime.requestRefresh('st-refresh'); }
  addCleanup(window, 'load', onLoad, { once: true });

  let wasTickerRunning = false;
  function onVisibilityChange() {
    if (document.hidden) {
      wasTickerRunning = state.tickerEnabled;
      if (state.tickerEnabled) stopTicker();
    } else {
      if (wasTickerRunning) {
        clearRowFocus(state.row1, row1Viewport!);
        clearRowFocus(state.row2, row2Viewport!);
        state.row1.speedScale.current = 1; state.row2.speedScale.current = 1;
        state.row1.motionVelocity = 0; state.row1.physicsVelocity = 0;
        state.row1.skew = 0; state.row1.scale = 1;
        state.row2.motionVelocity = 0; state.row2.physicsVelocity = 0;
        state.row2.skew = 0; state.row2.scale = 1;
        state.lastScrollY = scrollRuntime.getRawScroll();
        lastWrittenRow1X = null; lastWrittenRow2X = null;
        setRow1Skew('0deg'); setRow1Scale('1');
        setRow2Skew('0deg'); setRow2Scale('1');
        const tid = setTimeout(function() { startTicker(); }, 300) as unknown as number;
        timerIds.push(tid);
      }
    }
  }
  addCleanup(document, 'visibilitychange', onVisibilityChange, undefined);

  tickFn = tick;

  hfAttached = true;

  function pause() {
    if (ticking) { gsap.ticker.remove(tickFn!); ticking = false; }
    state.tickerEnabled = false;
    detachHfListeners();
  }

  function resume() {
    state.lastScrollY = scrollRuntime.getRawScroll(); /* B-VEL-01 */
    if (tickFn && !ticking) { gsap.ticker.add(tickFn); ticking = true; state.tickerEnabled = true; }
    attachHfListeners();
  }

  function kill() {
    pause();
    gyroDeactivate();
    cleanups.forEach(function(fn) { try { fn(); } catch (e) {} });
    timerIds.forEach(function(id) {
      if (id) { try { clearTimeout(id); } catch (e) {} try { clearInterval(id); } catch (e) {} try { cancelAnimationFrame(id); } catch (e) {} }
    });
    observers.forEach(function(obs) { if (obs && obs.disconnect) obs.disconnect(); });
    gsapInstances.forEach(function(inst) { try { if (inst && (inst as any).revert) (inst as any).revert(); } catch (e) {} try { if (inst && inst.kill) inst.kill(); } catch (e) {} });
  }

  return { pause, resume, kill };
}

/* ═══════════════════════════════════════════════════════════════
   WRAPPER: loveWallInit — delegates to both sub-components
   ═══════════════════════════════════════════════════════════════ */
function loveWallInit(container: HTMLElement): { pause: () => void; resume: () => void; kill: () => void } {
  const logoEl = container.querySelector('#love-wall-logo-section') as HTMLElement | null;
  /* NULL-GUARD-01 */
  const logoInstance = logoEl ? loveWallLogoInit(logoEl) : { pause: function(){}, resume: function(){}, kill: function(){} };

  const velocityInstance = loveWallVelocityInit(container);

  let _paused = false;
  let _killed = false;

  let _io: IntersectionObserver | null = null;
  let _stIo: IntersectionObserver | null = null;
  let _ioDebounce: ReturnType<typeof setTimeout> | null = null;
  let _settleTimer: ReturnType<typeof setTimeout> | null = null;

  function _getVH() { return (window.visualViewport ? window.visualViewport.height : window.innerHeight) || 800; }
  function _computeRootMargin() {
    const raw = Math.round(0.5 * _getVH());
    const clamped = Math.min(1200, Math.max(200, raw));
    return clamped + 'px 0px ' + clamped + 'px 0px';
  }

  function _ioCallback(entries: IntersectionObserverEntry[]) {
    const entry = entries[0]; if (!entry) return; /* IO-SAFE-01 */
    if (entry.isIntersecting) {
      if (_paused && !_killed) { _paused = false; resume(); }
    } else {
      if (!_paused && !_killed) { _paused = true; pause(); }
    }
  }

  function _createIO() {
    if (_killed) return;
    if (_io) _io.disconnect();
    _io = new IntersectionObserver(_ioCallback, { rootMargin: _computeRootMargin() });
    _io.observe(container);
  }

  function _onVVResize() {
    clearTimeout(_ioDebounce!);
    _ioDebounce = setTimeout(function() { if (!_killed) _createIO(); }, 50);
  }
  function _onResizeIO() { _onVVResize(); }

  _createIO();
  if (window.visualViewport) window.visualViewport.addEventListener('resize', _onVVResize, { passive: true });
  window.addEventListener('resize', _onResizeIO, { passive: true });

  /* ── ST-REFRESH-01: section-in-view (one-shot IO) ── */
  _stIo = new IntersectionObserver(function(entries) {
    const e = entries[0]; if (!e || !e.isIntersecting) return;
    scrollRuntime.requestRefresh('section-in-view');
    if (_stIo) { _stIo.disconnect(); _stIo = null; }
  }, { threshold: 0, rootMargin: '0px' });
  _stIo.observe(container);

  /* ── ST-REFRESH-01: layout-settle (1s after init) ── */
  _settleTimer = setTimeout(function() { scrollRuntime.requestRefresh('layout-settle'); }, 1000);

  function pause() {
    velocityInstance.pause();
    logoInstance.pause();
  }
  function resume() {
    logoInstance.resume();
    velocityInstance.resume();
  }
  function kill() {
    if (_killed) return;
    _killed = true;
    if (_io) { _io.disconnect(); _io = null; }
    if (_stIo) { _stIo.disconnect(); _stIo = null; }
    if (_ioDebounce) clearTimeout(_ioDebounce);
    if (_settleTimer) clearTimeout(_settleTimer);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', _onVVResize);
    window.removeEventListener('resize', _onResizeIO);
    velocityInstance.kill();
    logoInstance.kill();
  }

  // suppress unused warning on _paused (used only by _ioCallback)
  void _paused;

  return { pause, resume, kill };
}

/* ═══════════════════════════════════════════════════════════════
   REACT COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function LoveWallSection() {
  const rootRef = useRef<HTMLElement | null>(null);

  useGSAP(() => {
    gsap.registerPlugin(ScrollTrigger); // ← TUTAJ, nie na top-level (GSAP-SSR-01)

    const el = rootRef.current;
    if (!el) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error('[P3] rootRef.current is null — ref not attached to <section>.');
      }
      return;
    }
    const inst = loveWallInit(el);
    return () => inst?.kill?.();
    // scope: useGSAP Context revertuje instancje GSAP z loveWallInit() automatycznie
    // inst.kill() revertuje je powtórnie + czyści IO/timers/listeners
    // Double cleanup bezpieczny — _killed guard zapewnia idempotencję
  }, { scope: rootRef });

  return (
    <section id="love-wall-section" ref={rootRef}>

      {/* Debug panel — gated by CSS body.debug-mode */}
      <div className="debug-panel" id="love-wall-debugPanel">
        <div className="debug-panel__title">Resolution</div>
        <div className="debug-panel__value" id="love-wall-debugResolution">— × —</div>
        <div className="debug-panel__title" style={{ marginTop: '8px' }}>Lenis Velocity</div>
        <div className="debug-panel__value" id="love-wall-debugVelocity">—</div>
        <div className="debug-panel__title" style={{ marginTop: '8px' }}>Source</div>
        <div className="debug-panel__value" id="love-wall-debugSource">—</div>
      </div>

      <div className="rows-wrapper" id="love-wall-rows-wrapper">

        {/* ─── ROW 1: Review cards ─── */}
        <div className="row-clip">
          <div className="row-viewport" id="love-wall-row1-viewport">
            <div className="row-mover" id="love-wall-row1-mover"></div>
          </div>
          <div className="row-fade row-fade--l"></div><div className="row-fade row-fade--r"></div>
        </div>

        {/* ─── ROW 2: Kinetic Typography (mounted in slot) ─── */}
        <div id="love-wall-mount-embed" className="mount-slot">
          <div id="love-wall-logo-section">
            <div className="love-wall-logo-inner">
              <div className="track" id="love-wall-logo-track-a" style={{ transform: 'translateY(-50%)' }}>
                <div className="polecamy-stack" style={{ position: 'relative', display: 'inline-block' }}>
                  <div className="word" data-effect="fluid-tension" data-trigger-point="0.675" data-time-scale="0.8" data-min-duration="3" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 600, WebkitTextStroke: 'clamp(0.2px, 0.0893vw, 1.25px) #000', color: 'transparent', fontSize: 'calc(10 * var(--vw-cap))', position: 'relative', zIndex: 1, opacity: 0.4 }}>POLECAMY</div>
                  <div className="word" data-effect="fluid-tension" data-trigger-point="0.675" data-time-scale="0.8" data-min-duration="3" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 600, WebkitTextStroke: 'clamp(0.2px, 0.0893vw, 1.25px) #000', color: 'transparent', fontSize: 'calc(10 * var(--vw-cap))', position: 'absolute', left: 0, top: 0, transform: 'translate(0.2%, -2%)', zIndex: 2, opacity: 0.6 }}>POLECAMY</div>
                  <div className="word" data-effect="fluid-tension" data-trigger-point="0.675" data-time-scale="0.8" data-min-duration="3" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 600, WebkitTextStroke: 'clamp(0.2px, 0.0893vw, 1.25px) #000', color: 'transparent', fontSize: 'calc(10 * var(--vw-cap))', position: 'absolute', left: 0, top: 0, transform: 'translate(0.4%, -4%)', zIndex: 3, opacity: 0.8 }}>POLECAMY</div>
                </div>
                <div className="word" data-effect="anchor" data-time-scale="0.55" data-trigger-point="0.675" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 900, fontSize: 'calc(12.15 * var(--vw-cap))', color: '#000' }}>WZÓR</div>
                <div className="word" data-effect="optical-bloom" data-trigger-point="0.625" data-time-scale="0.6" style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 'calc(14 * var(--vw-cap))', color: '#000' }}>10na10</div>
                <div className="word" data-effect="velocity-skew" data-trigger-point="0.70" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 900, fontSize: 'calc(8 * var(--vw-cap))', color: '#333', textTransform: 'uppercase' }}>Ekspres</div>
                <div className="word" data-effect="rotate-3d-scale" data-needs-3d="true" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 900, color: '#1a1a1a', fontSize: 'calc(16.5 * var(--vw-cap))' }}>WOW</div>
                <div className="word" data-effect="prism-cut" data-time-scale="0.75" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 400, fontSize: 'calc(6.6 * var(--vw-cap))', letterSpacing: '-0.05em', color: '#1a1a1a' }}>Niezawodni</div>
                <div className="word" data-effect="zipper" data-min-duration="2" data-trigger-point="0.625" data-time-scale="0.448" style={{ fontFamily: "'Fraunces', serif", fontSize: 'calc(12 * var(--vw-cap))', color: '#1a1a1a' }}>Elegancja</div>
                <div className="word" data-effect="growth" data-trigger-point="0.70" data-time-scale="0.49" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: 'italic', fontSize: 'calc(12 * var(--vw-cap))', color: '#555', marginTop: 'calc(-2.4 * var(--vw-cap))' }}>Wrócę!</div>
              </div>
              <div className="track" id="love-wall-logo-track-b" style={{ transform: 'translateY(-50%)' }}>
                <div className="polecamy-stack" style={{ position: 'relative', display: 'inline-block' }}>
                  <div className="word" data-effect="fluid-tension" data-trigger-point="0.675" data-time-scale="0.8" data-min-duration="3" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 600, WebkitTextStroke: 'clamp(0.2px, 0.0893vw, 1.25px) #000', color: 'transparent', fontSize: 'calc(10 * var(--vw-cap))', position: 'relative', zIndex: 1, opacity: 0.4 }}>POLECAMY</div>
                  <div className="word" data-effect="fluid-tension" data-trigger-point="0.675" data-time-scale="0.8" data-min-duration="3" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 600, WebkitTextStroke: 'clamp(0.2px, 0.0893vw, 1.25px) #000', color: 'transparent', fontSize: 'calc(10 * var(--vw-cap))', position: 'absolute', left: 0, top: 0, transform: 'translate(0.2%, -2%)', zIndex: 2, opacity: 0.6 }}>POLECAMY</div>
                  <div className="word" data-effect="fluid-tension" data-trigger-point="0.675" data-time-scale="0.8" data-min-duration="3" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 600, WebkitTextStroke: 'clamp(0.2px, 0.0893vw, 1.25px) #000', color: 'transparent', fontSize: 'calc(10 * var(--vw-cap))', position: 'absolute', left: 0, top: 0, transform: 'translate(0.4%, -4%)', zIndex: 3, opacity: 0.8 }}>POLECAMY</div>
                </div>
                <div className="word" data-effect="anchor" data-time-scale="0.55" data-trigger-point="0.675" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 900, fontSize: 'calc(12.15 * var(--vw-cap))', color: '#000' }}>WZÓR</div>
                <div className="word" data-effect="optical-bloom" data-trigger-point="0.625" data-time-scale="0.6" style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 'calc(14 * var(--vw-cap))', color: '#000' }}>10na10</div>
                <div className="word" data-effect="velocity-skew" data-trigger-point="0.70" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 900, fontSize: 'calc(8 * var(--vw-cap))', color: '#333', textTransform: 'uppercase' }}>Ekspres</div>
                <div className="word" data-effect="rotate-3d-scale" data-needs-3d="true" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 900, color: '#1a1a1a', fontSize: 'calc(16.5 * var(--vw-cap))' }}>WOW</div>
                <div className="word" data-effect="prism-cut" data-time-scale="0.75" style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 400, fontSize: 'calc(6.6 * var(--vw-cap))', letterSpacing: '-0.05em', color: '#1a1a1a' }}>Niezawodni</div>
                <div className="word" data-effect="zipper" data-min-duration="2" data-trigger-point="0.625" data-time-scale="0.448" style={{ fontFamily: "'Fraunces', serif", fontSize: 'calc(12 * var(--vw-cap))', color: '#1a1a1a' }}>Elegancja</div>
                <div className="word" data-effect="growth" data-trigger-point="0.70" data-time-scale="0.49" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: 'italic', fontSize: 'calc(12 * var(--vw-cap))', color: '#555', marginTop: 'calc(-2.4 * var(--vw-cap))' }}>Wrócę!</div>
              </div>
            </div>
          </div>
          <div className="row-fade row-fade--l"></div><div className="row-fade row-fade--r"></div>
        </div>

        {/* ─── ROW 3: Review cards ─── */}
        <div className="row-clip">
          <div className="row-viewport" id="love-wall-row2-viewport">
            <div className="row-mover" id="love-wall-row2-mover"></div>
          </div>
          <div className="row-fade row-fade--l"></div><div className="row-fade row-fade--r"></div>
        </div>

      </div>
    </section>
  );
}
