import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import gsap from 'gsap';
import { scrollRuntime } from '@/lib/scrollRuntime';

/** Blokuje overflow-X podczas flipu 3D — `clip` zamiast `hidden` (mniej konfliktu ze scrollbar-gutter / podwójnym paskiem). */
function setKalkulatorFlipOverflowLock(on) {
  const el = document.documentElement;
  if (!on) {
    el.style.overflowX = '';
    return;
  }
  if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('overflow-x', 'clip')) {
    el.style.overflowX = 'clip';
  } else {
    el.style.overflowX = 'hidden';
  }
}

// ============================================
// MODUŁ-LEVEL OPTIMIZATIONS
// ============================================

// Pre-compiled regex
const THOUSANDS_REGEX = /\B(?=(\d{3})+(?!\d))/g;

// Singleton Intl.NumberFormat
const PL_NUMBER_FORMATTER = new Intl.NumberFormat('pl-PL');

function formatPL(n) {
  return Math.round(n).toString().replace(THOUSANDS_REGEX, " ");
}

function formatNumber(num) {
  return PL_NUMBER_FORMATTER.format(num);
}

// Font Lexend i GSAP — z layoutu / npm (brak powielania)

// ============================================
// SPRING SOLVER
// ============================================
class SpringSolver {
  constructor(stiffness, damping, mass) {
    this.k = stiffness;
    this.c = damping;
    this.m = mass;
    this.omega0 = Math.sqrt(stiffness / mass);
    this.zeta = damping / (2 * Math.sqrt(stiffness * mass));
    
    if (this.zeta < 1) {
      this.type = 'underdamped';
      this.omega1 = this.omega0 * Math.sqrt(1 - this.zeta * this.zeta);
    } else if (Math.abs(this.zeta - 1) < 0.0001) {
      this.type = 'critical';
    } else {
      this.type = 'overdamped';
      const sqrtTerm = Math.sqrt(this.zeta * this.zeta - 1);
      this.s1 = -this.omega0 * (this.zeta - sqrtTerm);
      this.s2 = -this.omega0 * (this.zeta + sqrtTerm);
    }
    
    this._cachedDuration = this._computeDuration(0.01, 0.1);
  }

  solve(t, from, to, initialVelocity = 0) {
    const x0 = to - from;
    const v0 = initialVelocity;
    
    if (this.type === 'underdamped') {
      const decay = Math.exp(-this.zeta * this.omega0 * t);
      const A = x0;
      const B = (this.zeta * this.omega0 * x0 + v0) / this.omega1;
      return to - decay * (A * Math.cos(this.omega1 * t) + B * Math.sin(this.omega1 * t));
    } else if (this.type === 'critical') {
      const decay = Math.exp(-this.omega0 * t);
      return to - decay * (x0 + (this.omega0 * x0 + v0) * t);
    } else {
      const c2 = (v0 - this.s1 * x0) / (this.s2 - this.s1);
      const c1 = x0 - c2;
      return to - (c1 * Math.exp(this.s1 * t) + c2 * Math.exp(this.s2 * t));
    }
  }

  velocity(t, from, to, initialVelocity = 0) {
    const x0 = to - from;
    const v0 = initialVelocity;
    
    if (this.type === 'underdamped') {
      const decay = Math.exp(-this.zeta * this.omega0 * t);
      const A = x0;
      const B = (this.zeta * this.omega0 * x0 + v0) / this.omega1;
      const cos = Math.cos(this.omega1 * t);
      const sin = Math.sin(this.omega1 * t);
      const dDecay = -this.zeta * this.omega0 * decay;
      const dCos = -this.omega1 * sin;
      const dSin = this.omega1 * cos;
      return -(dDecay * (A * cos + B * sin) + decay * (A * dCos + B * dSin));
    } else if (this.type === 'critical') {
      const decay = Math.exp(-this.omega0 * t);
      const term = x0 + (this.omega0 * x0 + v0) * t;
      const dTerm = this.omega0 * x0 + v0;
      return -(-this.omega0 * decay * term + decay * dTerm);
    } else {
      const c2 = (v0 - this.s1 * x0) / (this.s2 - this.s1);
      const c1 = x0 - c2;
      return -(c1 * this.s1 * Math.exp(this.s1 * t) + c2 * this.s2 * Math.exp(this.s2 * t));
    }
  }

  _computeDuration(restDelta = 0.01, restSpeed = 0.1) {
    let t = 0;
    const step = 0.001;
    const maxT = 10;
    while (t < maxT) {
      const pos = this.solve(t, 0, 1);
      const vel = Math.abs(this.velocity(t, 0, 1));
      if (Math.abs(1 - pos) < restDelta && vel < restSpeed) return t;
      t += step;
    }
    return maxT;
  }

  getDuration(restDelta = 0.01, restSpeed = 0.1) {
    if (restDelta === 0.01 && restSpeed === 0.1) {
      return this._cachedDuration;
    }
    return this._computeDuration(restDelta, restSpeed);
  }
}

// ============================================
// UTILITIES - F3: Zero-allocation color math
// ============================================
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// F3: Reusable temp objects dla interpolacji kolorów (unikamy alokacji w hot path)
const _tempRGB1 = { r: 0, g: 0, b: 0 };
const _tempRGB2 = { r: 0, g: 0, b: 0 };

// F3: Zero-allocation lerpColorRGB - mutuje out zamiast tworzyć nowy obiekt
function lerpColorRGB(c1, c2, t, out) {
  out.r = c1.r + (c2.r - c1.r) * t;
  out.g = c1.g + (c2.g - c1.g) * t;
  out.b = c1.b + (c2.b - c1.b) * t;
  return out;
}

// F3: Zero-allocation lerpColor3RGB
function lerpColor3RGB(rgb1, rgb2, rgb3, t, out) {
  if (t <= 0.5) {
    return lerpColorRGB(rgb1, rgb2, t * 2, out);
  }
  return lerpColorRGB(rgb2, rgb3, (t - 0.5) * 2, out);
}

// F3: Direct RGB string output (unikamy hex conversion w hot path)
function rgbToStyleString(rgb) {
  return `rgb(${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)})`;
}

// N1: Single tokenization - parsuje formatted string raz
// Zwraca strukturę reużywalną przez updateDigitStability, updateDigitSpans, triggerGhost
function tokenizeFormatted(formatted) {
  const chars = [];
  const digits = [];
  const digitIndices = []; // mapowanie: która pozycja w chars to która cyfra
  
  for (let i = 0; i < formatted.length; i++) {
    const char = formatted[i];
    chars.push(char);
    if (char !== ' ') {
      digitIndices.push(i);
      digits.push(char);
    }
  }
  
  return {
    chars,        // wszystkie znaki włącznie ze spacjami
    digits,       // tylko cyfry (bez spacji)
    digitIndices, // indeksy cyfr w chars
    length: digits.length
  };
}

function precomputePaletteRGB(palette) {
  return {
    gold: hexToRgb(palette.gold),
    light: hexToRgb(palette.light),
    mid: hexToRgb(palette.mid),
    goldHex: palette.gold,
    lightHex: palette.light,
    midHex: palette.mid,
    accent: palette.accent,
    stableGray: 'rgba(0,0,0,0.2)',
    stableDark: '#141414',
  };
}

// ============================================
// MEMOIZED BACKGROUND LAYERS
// ============================================

// [QA-FIX-12] Safari compat for scrollIntoView options
function safeScrollIntoView(el) {
  try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  catch(e) { el.scrollIntoView(true); }
}
const DesktopBackgroundEffects = React.memo(() => (
  <>
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0px, rgba(255,255,255,0.3) 163px, transparent 325px)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 300% 345px at 19% -20px, rgba(255,255,255,0.85) 0%, transparent 50%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 85% 260px at 50% 52px, rgba(255,254,252,0.5) 0%, transparent 45%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 80% 228px at 50% 650px, rgba(255,255,255,0.25) 0%, transparent 50%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0px, transparent 7px)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'linear-gradient(0deg, rgba(235,234,232,0.4) 0px, rgba(242,241,239,0.2) 8px, transparent 23px)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'linear-gradient(90deg, rgba(238,237,235,0.28) 0%, transparent 2.5%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'linear-gradient(270deg, rgba(238,237,235,0.28) 0%, transparent 2.5%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 35% 195px at 0% 650px, rgba(232,231,229,0.22) 0%, transparent 50%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 35% 195px at 100% 650px, rgba(232,231,229,0.22) 0%, transparent 50%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 175px 137% at -17px 53%, rgba(255,255,255,0.85) 0%, transparent 50%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
      zIndex: 1,
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 1872px 250% at 1890px 57%, rgba(255,255,255,0.85) 0%, transparent 50%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
      zIndex: 1,
    }} />
  </>
));

const MobileBackgroundEffects = React.memo(() => (
  <>
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 25%, transparent 50%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 300% 53% at 19% -3%, rgba(255,255,255,0.85) 0%, transparent 50%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 85% 40% at 50% 8%, rgba(255,254,252,0.5) 0%, transparent 45%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 80% 35% at 50% 100%, rgba(255,255,255,0.25) 0%, transparent 50%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 1%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'linear-gradient(0deg, rgba(235,234,232,0.4) 0%, rgba(242,241,239,0.2) 1.2%, transparent 3.5%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'linear-gradient(90deg, rgba(238,237,235,0.28) 0%, transparent 2.5%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'linear-gradient(270deg, rgba(238,237,235,0.28) 0%, transparent 2.5%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 35% 30% at 0% 100%, rgba(232,231,229,0.22) 0%, transparent 50%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 35% 30% at 100% 100%, rgba(232,231,229,0.22) 0%, transparent 50%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 175px 137% at -17px 53%, rgba(255,255,255,0.85) 0%, transparent 50%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
      zIndex: 1,
    }} />
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0, left: 0,
      borderRadius: '2rem',
      background: 'radial-gradient(ellipse 1872px 250% at 1890px 57%, rgba(255,255,255,0.85) 0%, transparent 50%)',
      mixBlendMode: 'normal',
      pointerEvents: 'none',
      zIndex: 1,
    }} />
  </>
));

// ============================================
// COLOR PALETTES
// ============================================
const COLOR_PALETTES = {
  orange: precomputePaletteRGB({
    gold: '#f5be39',
    light: '#f57f39',
    mid: '#dd4a0f',
    accent: '#f47225',
    stableGray: 'rgba(0, 0, 0, 0.2)',
    stableDark: '#141414',
  }),
  green: precomputePaletteRGB({
    gold: '#6fc683',
    light: '#28a745',
    mid: '#1e7e34',
    accent: '#28a745',
    stableGray: 'rgba(0, 0, 0, 0.2)',
    stableDark: '#141414',
  })
};

function getColorPalette(accentColor) {
  if (accentColor === '#28a745' || accentColor === '#1e7e34') {
    return COLOR_PALETTES.green;
  }
  return COLOR_PALETTES.orange;
}

// ============================================
// CONFIG
// ============================================
const VALUE_SPRING = new SpringSolver(800, 50, 0.2);
const MAIN_SPRING = new SpringSolver(420, 28, 1);
const GHOST_CONFIG = {
  duration: 0.22,
  ease: "power2.out",
  y: -8,
  startOpacity: 0.35,
  endOpacity: 0,
  blur: 3
};
const STABILITY_VELOCITY_THRESHOLD = 800;
const MAX_DIGITS = 14; // [QA-FIX-7] 13 chars max ("1 000 000 000") + 1 buffer
const GHOST_COUNT = 8;

// ============================================
// COUNTER ENGINE FACTORY - FULLY OPTIMIZED
// ============================================
function createCounterEngine(container, gsap, config) {
  const { accentColor, fontSize } = config;
  const COLORS = getColorPalette(accentColor);
  const mainSpringDuration = MAIN_SPRING.getDuration();
  
  // === STATE ===
  const state = {
    currentValue: 0,
    targetValue: 0,
    currentVelocity: 0,
    lastFormattedValue: "0",
    lastRoundedValue: 0,
    ghostPoolIndex: 0,
    isFirstRender: true,
    animationFrameId: null,
    springStartTime: null,
    springStartValue: 0,
    springInitialVelocity: 0,
    activeMainNumber: 'new',
    mainNumberAnimationId: null,
    mainCrossfadeStartTime: null,
    mainCrossfadeIncomingEl: null,
    mainCrossfadePausedElapsed: null,
    // [OPT-4] Pre-allocated fixed-size arrays — in-place mutation, zero allocation in hot path
    stableDigits: new Array(MAX_DIGITS).fill(false),
    stableDigitsLen: 0,
    previousDigits: new Array(MAX_DIGITS).fill(''),
    previousDigitsLen: 0,
    hasHotDigits: false,
    // N1: cached tokenization
    lastTokenized: null,
    // [OPT-6] Visibility state for pause/resume
    isDocumentHidden: false,
  };

  // === DOM CREATION ===
  function createDigitSpans(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `<span class="digit digit-${i}" style="display: inline-block; width: 0.6em; text-align: center; color: #141414;"></span>`;
    }
    return html;
  }

  const ghostsHTML = Array.from({ length: GHOST_COUNT }, (_, i) => 
    `<div class="ghost" id="kalkulator-ghost${i}" style="
      position: absolute;
      right: 0;
      top: 0;
      font-size: ${fontSize};
      font-weight: 600;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      will-change: transform, opacity, filter;
      font-variant-numeric: tabular-nums;
      font-family: 'Lexend', sans-serif;
      transform: translateZ(0);
    "><span class="ghost-plus" style="opacity: 0.3;">+</span><span class="ghost-value">${createDigitSpans(MAX_DIGITS)}</span></div>`
  ).join('');

  container.innerHTML = `
    <div class="number-container" style="
      position: relative; 
      display: inline-block;
      transform: translateZ(0);
    ">
      ${ghostsHTML}
      <div class="main-number main-number-old" id="kalkulator-mainNumberOld" style="
        position: absolute;
        right: 0;
        top: 0;
        font-size: ${fontSize};
        font-weight: 600;
        white-space: nowrap;
        transform-origin: right center;
        will-change: transform, opacity;
        font-variant-numeric: tabular-nums;
        font-family: 'Lexend', sans-serif;
        transform: translateZ(0);
      ">
        <span class="plus" style="color: ${accentColor};">+</span><span class="value" id="kalkulator-mainValueOld">${createDigitSpans(MAX_DIGITS)}</span>
      </div>
      <div class="main-number main-number-new" id="kalkulator-mainNumberNew" style="
        position: relative;
        font-size: ${fontSize};
        font-weight: 600;
        white-space: nowrap;
        transform-origin: right center;
        will-change: transform, opacity;
        font-variant-numeric: tabular-nums;
        font-family: 'Lexend', sans-serif;
        transform: translateZ(0);
      ">
        <span class="plus" style="color: ${accentColor};">+</span><span class="value" id="kalkulator-mainValueNew">${createDigitSpans(MAX_DIGITS)}</span>
      </div>
    </div>
  `;

  // === DOM REFERENCES ===
  const ghosts = Array.from({ length: GHOST_COUNT }, (_, i) => {
    const ghost = container.querySelector(`#kalkulator-ghost${i}`);
    const digitSpans = Array.from(ghost.querySelectorAll('.digit'));
    return {
      element: ghost,
      plus: ghost.querySelector('.ghost-plus'),
      value: ghost.querySelector('.ghost-value'),
      digitSpans,
      // F2: Per-span state cache dla ghostów — [OPT-5] added width field
      spanCache: digitSpans.map(() => ({ display: 'inline-block', text: '', color: '', width: '0.6em' })),
      allElements: [ghost, ghost.querySelector('.ghost-plus'), ...digitSpans]
    };
  });
  
  const mainNumberOld = container.querySelector('#kalkulator-mainNumberOld');
  const mainValueOld = container.querySelector('#kalkulator-mainValueOld');
  const mainNumberNew = container.querySelector('#kalkulator-mainNumberNew');
  const mainValueNew = container.querySelector('#kalkulator-mainValueNew');
  
  const mainOldDigitSpans = Array.from(mainValueOld.querySelectorAll('.digit'));
  const mainNewDigitSpans = Array.from(mainValueNew.querySelectorAll('.digit'));
  
  // F2: Per-span state cache dla main numbers — [OPT-5] added width field
  const mainOldSpanCache = mainOldDigitSpans.map(() => ({ display: 'inline-block', text: '', color: '', width: '0.6em' }));
  const mainNewSpanCache = mainNewDigitSpans.map(() => ({ display: 'inline-block', text: '', color: '', width: '0.6em' }));

  // === [OPT-4] DIGIT STABILITY — in-place mutation, zero allocation ===
  function updateDigitStability(oldTokenized, newTokenized) {
    const oldDigits = oldTokenized.digits;
    const newDigits = newTokenized.digits;
    const oldLen = oldDigits.length;
    const newLen = newDigits.length;
    const absVelocity = Math.abs(state.currentVelocity);
    
    if (absVelocity < 10) {
      // All stable — fill in-place
      for (let i = 0; i < newLen; i++) {
        state.stableDigits[i] = true;
      }
      state.stableDigitsLen = newLen;
      // Copy previousDigits in-place
      for (let i = 0; i < newLen; i++) {
        state.previousDigits[i] = newDigits[i];
      }
      state.previousDigitsLen = newLen;
      state.hasHotDigits = false;
      return;
    }
    
    let hasHot = false;
    
    // Porównanie od prawej strony — mutacja in-place
    for (let i = 0; i < newLen; i++) {
      const newIdx = newLen - 1 - i;
      const oldIdx = oldLen - 1 - i;
      
      let oldChar = oldIdx >= 0 ? oldDigits[oldIdx] : ' ';
      let newChar = newDigits[newIdx];
      
      const wasStable = newIdx < state.stableDigitsLen && state.stableDigits[newIdx] === true;
      const didNotChange = oldChar === newChar;
      const velocityLow = absVelocity < STABILITY_VELOCITY_THRESHOLD;
      
      const isStable = wasStable || (didNotChange && velocityLow);
      state.stableDigits[newIdx] = isStable;
      
      if (!isStable) hasHot = true;
    }
    
    state.stableDigitsLen = newLen;
    // Copy previousDigits in-place
    for (let i = 0; i < newLen; i++) {
      state.previousDigits[i] = newDigits[i];
    }
    state.previousDigitsLen = newLen;
    state.hasHotDigits = hasHot;
  }

  // === [OPT-5] Per-span dirty check with width caching ===
  function updateDigitSpans(digitSpans, spanCache, tokenized, forGhost = false) {
    const { chars, digits } = tokenized;
    const totalDigits = digits.length;
    const totalChars = chars.length;
    
    // Oblicz startowy indeks spanu (wyrównanie do prawej)
    const startSpanIdx = digitSpans.length - totalChars;
    
    // Najpierw: ukryj spany które powinny być ukryte (od lewej)
    for (let i = 0; i < startSpanIdx && i < digitSpans.length; i++) {
      const cache = spanCache[i];
      if (cache.display !== 'none') {
        digitSpans[i].style.display = 'none';
        cache.display = 'none';
      }
    }
    
    // Następnie: aktualizuj widoczne spany
    let digitIndex = 0;
    for (let i = 0; i < totalChars; i++) {
      const spanIdx = startSpanIdx + i;
      if (spanIdx < 0 || spanIdx >= digitSpans.length) continue;
      
      const span = digitSpans[spanIdx];
      const cache = spanCache[spanIdx];
      const char = chars[i];
      
      if (char === ' ') {
        // Separator tysięcy
        const newDisplay = 'inline-block';
        const newWidth = '0.30em';
        
        if (cache.display !== newDisplay) {
          span.style.display = newDisplay;
          cache.display = newDisplay;
        }
        if (cache.text !== '') {
          span.textContent = '';
          cache.text = '';
        }
        // [OPT-5] Dirty check width
        if (cache.width !== newWidth) {
          span.style.width = newWidth;
          cache.width = newWidth;
        }
        // [OPT-5] Dirty check color for separator
        const sepColor = 'transparent';
        if (cache.color !== sepColor) {
          span.style.color = sepColor;
          cache.color = sepColor;
        }
      } else {
        // Cyfra
        const isStable = digitIndex < state.stableDigitsLen && state.stableDigits[digitIndex] === true;
        let color;
        
        if (isStable) {
          color = forGhost ? COLORS.stableGray : COLORS.stableDark;
        } else {
          // F3: Zero-allocation color interpolation
          const t = totalDigits > 1 ? digitIndex / (totalDigits - 1) : 0.5;
          lerpColor3RGB(COLORS.gold, COLORS.light, COLORS.mid, t, _tempRGB1);
          color = rgbToStyleString(_tempRGB1);
        }
        
        // F2: Dirty check - aktualizuj DOM tylko gdy wartość się zmieniła
        const newDisplay = 'inline-block';
        if (cache.display !== newDisplay) {
          span.style.display = newDisplay;
          cache.display = newDisplay;
        }
        
        if (cache.text !== char) {
          span.textContent = char;
          cache.text = char;
        }
        
        if (cache.color !== color) {
          span.style.color = color;
          cache.color = color;
        }
        
        // [OPT-5] Dirty check width for digit
        const digitWidth = '0.6em';
        if (cache.width !== digitWidth) {
          span.style.width = digitWidth;
          cache.width = digitWidth;
        }
        
        digitIndex++;
      }
    }
  }

  // === GHOST ===
  function getNextGhost() {
    const ghost = ghosts[state.ghostPoolIndex];
    state.ghostPoolIndex = (state.ghostPoolIndex + 1) % ghosts.length;
    return ghost;
  }

  // === [OPT-1] triggerGhost — eliminated per-digit GSAP tweens ===
  // Before: gsap.timeline() with N individual .to() per hot digit + plus tween = up to 8 tweens per ghost
  // After: gsap.set() colors immediately + single gsap.to() for element fade = 1 tween per ghost
  // Ghost fades to opacity:0 anyway, so intermediate color animation is invisible
  function triggerGhost(oldTokenized) {
    const ghost = getNextGhost();
    
    gsap.killTweensOf(ghost.allElements);
    
    // N1: Użyj pre-tokenized data
    updateDigitSpans(ghost.digitSpans, ghost.spanCache, oldTokenized, true);
    
    const rawIntensity = Math.min(1, Math.abs(state.currentVelocity) / 50000);
    const hasHotDigits = state.hasHotDigits;
    
    gsap.set(ghost.element, {
      y: 0,
      opacity: GHOST_CONFIG.startOpacity + rawIntensity * 0.3,
      filter: "blur(0px)",
      textShadow: hasHotDigits && rawIntensity > 0.3 ? `0 0 ${rawIntensity * 12}px ${COLORS.goldHex}` : 'none',
      immediateRender: true
    });
    
    // [OPT-1] Set plus color immediately instead of tweening
    const plusColor = hasHotDigits ? COLORS.goldHex : COLORS.stableGray;
    gsap.set(ghost.plus, { color: plusColor, opacity: hasHotDigits ? 0.5 : 0.3 });

    const dur = GHOST_CONFIG.duration * (1 + rawIntensity * 0.5);

    // [OPT-1] Single tween for the whole ghost element — replaces timeline with N digit tweens
    gsap.to(ghost.element, {
      y: GHOST_CONFIG.y * (1 + rawIntensity * 0.5),
      opacity: GHOST_CONFIG.endOpacity,
      filter: `blur(${GHOST_CONFIG.blur + rawIntensity * 2}px)`,
      textShadow: 'none',
      duration: dur,
      ease: "power2.out",
      overwrite: true
    });

    // [OPT-1] Set final colors on hot digits immediately via gsap.set (no per-frame interpolation)
    // Since ghost opacity → 0 over 0.22s, color transition is imperceptible
    // [QA-FIX-6] Use digitIndices + chars.length for correct separator-aware span mapping
    const digits = oldTokenized.digits;
    const startSpanIdx = ghost.digitSpans.length - oldTokenized.chars.length;
    
    for (let i = 0; i < digits.length; i++) {
      if (i < state.stableDigitsLen && state.stableDigits[i] !== true) {
        const charPos = oldTokenized.digitIndices[i];
        const spanIndex = startSpanIdx + charPos;
        if (spanIndex >= 0 && ghost.digitSpans[spanIndex]) {
          gsap.set(ghost.digitSpans[spanIndex], { color: COLORS.midHex });
        }
      }
    }

    // [OPT-1] Set plus final state immediately
    gsap.set(ghost.plus, {
      color: hasHotDigits ? COLORS.midHex : COLORS.stableGray,
    });
  }

  // === MAIN NUMBER ===
  function attachMainCrossfadeTicker(incomingElement, startTimeMs) {
    state.mainCrossfadeStartTime = startTimeMs;
    state.mainCrossfadeIncomingEl = incomingElement;
    state.mainCrossfadePausedElapsed = null;
    const springDuration = mainSpringDuration;

    const springTicker = () => {
      const elapsed = (performance.now() - startTimeMs) / 1000;

      if (elapsed >= springDuration) {
        gsap.set(incomingElement, { opacity: 1 });
        gsap.ticker.remove(springTicker);
        state.mainNumberAnimationId = null;
        state.mainCrossfadeStartTime = null;
        state.mainCrossfadeIncomingEl = null;
        state.mainCrossfadePausedElapsed = null;
        return;
      }

      const springOpacity = MAIN_SPRING.solve(elapsed, 0, 1);

      gsap.set(incomingElement, {
        opacity: Math.min(1, Math.max(0, springOpacity))
      });
    };

    state.mainNumberAnimationId = springTicker;
    gsap.ticker.add(springTicker);
  }

  function animateMainNumber(tokenized) {
    if (state.isFirstRender) {
      updateDigitSpans(mainNewDigitSpans, mainNewSpanCache, tokenized, false);
      updateDigitSpans(mainOldDigitSpans, mainOldSpanCache, tokenized, false);
      gsap.set(mainNumberNew, { opacity: 1 });
      gsap.set(mainNumberOld, { opacity: 0 });
      state.isFirstRender = false;
      return;
    }

    if (state.mainNumberAnimationId) {
      gsap.ticker.remove(state.mainNumberAnimationId);
      state.mainNumberAnimationId = null;
      state.mainCrossfadeStartTime = null;
      state.mainCrossfadeIncomingEl = null;
      state.mainCrossfadePausedElapsed = null;
    }
    gsap.killTweensOf(mainNumberOld);
    gsap.killTweensOf(mainNumberNew);

    let outgoingElement, incomingElement;
    
    if (state.activeMainNumber === 'new') {
      outgoingElement = mainNumberNew;
      incomingElement = mainNumberOld;
      state.activeMainNumber = 'old';
    } else {
      outgoingElement = mainNumberOld;
      incomingElement = mainNumberNew;
      state.activeMainNumber = 'new';
    }

    // N1: Użyj tokenized dla obu
    updateDigitSpans(mainNewDigitSpans, mainNewSpanCache, tokenized, false);
    updateDigitSpans(mainOldDigitSpans, mainOldSpanCache, tokenized, false);

    gsap.set(outgoingElement, { opacity: 0, immediateRender: true });
    gsap.set(incomingElement, { opacity: 0, immediateRender: true });

    attachMainCrossfadeTicker(incomingElement, performance.now());
  }

  function finalizeDigitsAsStable() {
    for (let i = 0; i < state.stableDigitsLen; i++) {
      state.stableDigits[i] = true;
    }
    state.hasHotDigits = false;
    
    const activeSpans = state.activeMainNumber === 'new' ? mainNewDigitSpans : mainOldDigitSpans;
    const activeCache = state.activeMainNumber === 'new' ? mainNewSpanCache : mainOldSpanCache;
    
    for (let i = 0; i < activeSpans.length; i++) {
      const cache = activeCache[i];
      if (cache.display !== 'none' && cache.text) {
        gsap.to(activeSpans[i], { 
          color: COLORS.stableDark, 
          duration: 0.15, 
          ease: "power2.out" 
        });
        cache.color = COLORS.stableDark;
      }
    }
  }

  // === ANIMATION ===
  function startSpringAnimation(newTarget) {
    // [OPT-4] Reset stability in-place
    state.stableDigitsLen = 0;
    state.previousDigitsLen = 0;
    state.hasHotDigits = false;
    
    if (state.animationFrameId !== null) {
      const elapsed = (performance.now() - state.springStartTime) / 1000;
      state.springInitialVelocity = VALUE_SPRING.velocity(elapsed, state.springStartValue, state.targetValue, state.springInitialVelocity);
      
      const directionToTarget = newTarget - state.currentValue;
      if (state.springInitialVelocity * directionToTarget < 0) {
        state.springInitialVelocity = 0;
      }
    } else {
      state.springInitialVelocity = 0;
    }
    
    state.targetValue = newTarget;
    state.springStartValue = state.currentValue;
    state.springStartTime = performance.now();
    
    if (!state.animationFrameId) {
      // [OPT-6] Don't start rAF if document is hidden
      if (!state.isDocumentHidden) {
        state.animationFrameId = requestAnimationFrame(updateSpring);
      }
    }
  }

  function updateSpring(timestamp) {
    // [OPT-6] If document became hidden, stop rAF loop (will resume on visibility change)
    if (state.isDocumentHidden) {
      state.animationFrameId = null;
      return;
    }
    
    const elapsed = (timestamp - state.springStartTime) / 1000;
    
    let newValue = VALUE_SPRING.solve(elapsed, state.springStartValue, state.targetValue, state.springInitialVelocity);
    newValue = Math.max(0, Math.min(newValue, 1000000000));
    
    state.currentVelocity = VALUE_SPRING.velocity(elapsed, state.springStartValue, state.targetValue, state.springInitialVelocity);
    
    const roundedNewValue = Math.round(newValue);
    
    if (roundedNewValue !== state.lastRoundedValue) {
      state.lastRoundedValue = roundedNewValue;
      const newFormatted = formatPL(roundedNewValue);
      
      if (newFormatted !== state.lastFormattedValue) {
        // N1: Tokenize raz i reuse
        const newTokenized = tokenizeFormatted(newFormatted);
        const oldTokenized = state.lastTokenized || tokenizeFormatted(state.lastFormattedValue);
        
        updateDigitStability(oldTokenized, newTokenized);
        triggerGhost(oldTokenized);
        animateMainNumber(newTokenized);
        
        state.lastFormattedValue = newFormatted;
        state.lastTokenized = newTokenized;
      }
    }
    
    state.currentValue = newValue;
    
    const distanceToTarget = Math.abs(state.targetValue - state.currentValue);
    const restDelta = 0.01 * Math.abs(state.targetValue - state.springStartValue) || 0.01;
    const isSettled = distanceToTarget < restDelta && Math.abs(state.currentVelocity) < 0.1;
    const minDuration = 0.25;
    
    if (isSettled && elapsed > minDuration) {
      state.currentValue = state.targetValue;
      state.currentVelocity = 0;
      const finalFormatted = formatPL(state.targetValue);
      
      finalizeDigitsAsStable();
      
      if (finalFormatted !== state.lastFormattedValue) {
        const finalTokenized = tokenizeFormatted(finalFormatted);
        const oldTokenized = state.lastTokenized || tokenizeFormatted(state.lastFormattedValue);
        
        updateDigitStability(oldTokenized, finalTokenized);
        triggerGhost(oldTokenized);
        animateMainNumber(finalTokenized);
        
        state.lastFormattedValue = finalFormatted;
        state.lastTokenized = finalTokenized;
      }
      
      state.lastRoundedValue = Math.round(state.targetValue);
      state.animationFrameId = null;
      return;
    }
    
    state.animationFrameId = requestAnimationFrame(updateSpring);
  }

  // === [OPT-6] Visibility change handler ===
  function handleVisibilityChange() {
    if (document.hidden) {
      state.isDocumentHidden = true;
      // rAF loop will self-terminate on next tick (checks isDocumentHidden)
      // GSAP ticker also throttles automatically in background tabs
    } else {
      state.isDocumentHidden = false;
      // If we have a pending animation target, restart rAF from current state
      if (state.animationFrameId === null && state.currentValue !== state.targetValue) {
        // Reset spring from current position to avoid visual jump
        state.springStartValue = state.currentValue;
        state.springStartTime = performance.now();
        state.springInitialVelocity = 0;
        state.animationFrameId = requestAnimationFrame(updateSpring);
      }
    }
  }
  
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // === INIT ===
  // [OPT-4] Initialize stability with in-place approach
  state.stableDigits[0] = false;
  state.stableDigitsLen = 1;
  state.lastRoundedValue = 0;
  state.lastTokenized = tokenizeFormatted("0");
  
  updateDigitSpans(mainNewDigitSpans, mainNewSpanCache, state.lastTokenized, false);
  updateDigitSpans(mainOldDigitSpans, mainOldSpanCache, state.lastTokenized, false);
  gsap.set(mainNumberNew, { opacity: 1, immediateRender: true });
  gsap.set(mainNumberOld, { opacity: 0, immediateRender: true });

  // === PUBLIC API ===
  return {
    setValue: (value) => {
      startSpringAnimation(value);
    },
    pause: () => {
      if (state.animationFrameId) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
      }
      if (state.mainNumberAnimationId) {
        const elapsed = (performance.now() - state.mainCrossfadeStartTime) / 1000;
        gsap.ticker.remove(state.mainNumberAnimationId);
        state.mainNumberAnimationId = null;
        state.mainCrossfadeStartTime = null;
        if (state.mainCrossfadeIncomingEl && elapsed < mainSpringDuration) {
          state.mainCrossfadePausedElapsed = elapsed;
        } else {
          if (state.mainCrossfadeIncomingEl) {
            gsap.set(state.mainCrossfadeIncomingEl, { opacity: 1 });
          }
          state.mainCrossfadeIncomingEl = null;
          state.mainCrossfadePausedElapsed = null;
        }
      }
    },
    resume: () => {
      if (state.isDocumentHidden) return;
      if (state.mainCrossfadePausedElapsed != null && state.mainCrossfadeIncomingEl) {
        const saved = state.mainCrossfadePausedElapsed;
        const incomingElement = state.mainCrossfadeIncomingEl;
        if (saved >= mainSpringDuration) {
          gsap.set(incomingElement, { opacity: 1 });
          state.mainCrossfadeIncomingEl = null;
          state.mainCrossfadePausedElapsed = null;
        } else {
          attachMainCrossfadeTicker(incomingElement, performance.now() - saved * 1000);
        }
      }
      if (state.animationFrameId === null && state.currentValue !== state.targetValue && !state.isDocumentHidden) {
        state.springStartValue = state.currentValue;
        state.springStartTime = performance.now();
        state.springInitialVelocity = 0;
        state.animationFrameId = requestAnimationFrame(updateSpring);
      }
    },
    destroy: () => {
      try {
        // [OPT-6] Remove visibility listener
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        
        if (state.animationFrameId) {
          cancelAnimationFrame(state.animationFrameId);
          state.animationFrameId = null;
        }
        if (state.mainNumberAnimationId) {
          gsap.ticker.remove(state.mainNumberAnimationId);
          state.mainNumberAnimationId = null;
        }
        state.mainCrossfadeStartTime = null;
        state.mainCrossfadeIncomingEl = null;
        state.mainCrossfadePausedElapsed = null;
        ghosts.forEach(ghost => { try { gsap.killTweensOf(ghost.allElements); } catch(e) {} });
        try { gsap.killTweensOf(mainNumberOld); } catch(e) {}
        try { gsap.killTweensOf(mainNumberNew); } catch(e) {}
        container.innerHTML = '';
      } catch(e) {
        // [PIPELINE] Graceful cleanup failure
      }
    }
  };
}

// ============================================
// REACT COMPONENT - AnimatedNumberGSAP
// ============================================
function AnimatedNumberGSAP({ value, accentColor, fontSize, sectionInView = true }) {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const [ready, setReady] = useState(false);
  const initializedRef = useRef(false);
  const lastConfigRef = useRef({ accentColor, fontSize });

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (containerRef.current && !engineRef.current) {
      try {
        engineRef.current = createCounterEngine(containerRef.current, gsap, {
          accentColor,
          fontSize
        });
        setReady(true);
      } catch (e) {
        if (containerRef.current) {
          containerRef.current.textContent = formatPL(value);
          containerRef.current.style.cssText = `font-size:${fontSize};font-weight:600;color:#141414;font-family:var(--font-brand),sans-serif`;
        }
      }
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !engineRef.current) return;
    
    const configChanged = 
      lastConfigRef.current.accentColor !== accentColor || 
      lastConfigRef.current.fontSize !== fontSize;
    
    if (!configChanged) return;

    lastConfigRef.current = { accentColor, fontSize };
    let cancelled = false;

    engineRef.current.destroy();
    engineRef.current = null;
    if (!cancelled && containerRef.current) {
      try {
        engineRef.current = createCounterEngine(containerRef.current, gsap, {
          accentColor,
          fontSize
        });
        engineRef.current.setValue(value);
      } catch (e) {
        if (!cancelled && containerRef.current) {
          containerRef.current.textContent = formatPL(value);
          containerRef.current.style.cssText = `font-size:${fontSize};font-weight:600;color:#141414;font-family:var(--font-brand),sans-serif`;
        }
      }
    }

    return () => { cancelled = true; };
  }, [accentColor, fontSize, ready, value]);

  useEffect(() => {
    if (ready && engineRef.current) {
      engineRef.current.setValue(value);
    }
  }, [value, ready]);

  useEffect(() => {
    if (!ready || !engineRef.current) return;
    if (sectionInView) {
      engineRef.current.resume();
    } else {
      engineRef.current.pause();
    }
  }, [sectionInView, ready]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'relative', 
        display: 'inline-block',
        fontFamily: "'Lexend', sans-serif"
      }} 
    />
  );
}

// ============================================
// GLOBAL SLIDER CSS
// ============================================
const SLIDER_GLOBAL_STYLES = `
#kalkulator-section .slider-active-styles .active.bubble{background-color:var(--accent)!important;border-color:var(--accent)!important;border-radius:20px!important;transform:translateX(-50%) scale(1.15)!important;box-shadow:0 15px 30px rgba(254,199,8,0.4)!important}
#kalkulator-section .slider-active-styles .active.unit{opacity:0!important;transform:translateY(-50%) translateX(10px)!important}
#kalkulator-section .slider-active-styles .active.thumb{transform:translate(-50%,-50%) scale(0.95)!important;background:linear-gradient(145deg, rgba(255,255,255,0.95), rgba(255,255,255,0.7))!important;border:1px solid rgba(255,255,255,0.5)!important;box-shadow:0 15px 40px -10px rgba(254, 199, 8, 0.3), inset 0 2px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(200, 180, 140, 0.2)!important}
#kalkulator-section .slider-active-styles .active.grip-line{background:var(--accent)!important;box-shadow:0 0 5px var(--accent)!important}
#kalkulator-section .slider-active-styles .active.grip-left{border-right-color:var(--accent)!important;filter:drop-shadow(-1px 0 4px var(--accent))!important}
#kalkulator-section .slider-active-styles .active.grip-right{border-left-color:var(--accent)!important;filter:drop-shadow(1px 0 4px var(--accent))!important}
#kalkulator-section .slider-active-styles input[type="number"]::-webkit-outer-spin-button,#kalkulator-section .slider-active-styles input[type="number"]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
#kalkulator-section .slider-active-styles input[type="number"],#kalkulator-section .slider-active-styles input[type="text"]{-moz-appearance:textfield}
@keyframes kalkulator-snapRight{0%{left:4px;width:146px}45%{left:174px;width:121px}70%{left:144px;width:151px}85%{left:151px;width:144px}100%{left:149px;width:146px}}
@keyframes kalkulator-snapLeft{0%{left:149px;width:146px}45%{left:4px;width:121px}70%{left:4px;width:151px}85%{left:4px;width:144px}100%{left:4px;width:146px}}
@keyframes kalkulator-snapRightMobile{0%{left:3px;width:112px}45%{left:133px;width:93px}70%{left:110px;width:116px}85%{left:115px;width:111px}100%{left:114px;width:112px}}
@keyframes kalkulator-snapLeftMobile{0%{left:114px;width:112px}45%{left:3px;width:93px}70%{left:3px;width:116px}85%{left:3px;width:111px}100%{left:3px;width:112px}}
@keyframes kalkulator-snapRightPeriod{0%{left:3px;width:92px}45%{left:112px;width:74px}70%{left:89px;width:97px}85%{left:95px;width:91px}100%{left:94px;width:92px}}
@keyframes kalkulator-snapLeftPeriod{0%{left:94px;width:92px}45%{left:3px;width:74px}70%{left:3px;width:97px}85%{left:3px;width:91px}100%{left:3px;width:92px}}
#kalkulator-section .anim-right-period{animation:kalkulator-snapRightPeriod 0.35s cubic-bezier(0.18,0.89,0.32,1.1) forwards}
#kalkulator-section .anim-left-period{animation:kalkulator-snapLeftPeriod 0.35s cubic-bezier(0.18,0.89,0.32,1.1) forwards}
#kalkulator-section .toggle-pill{will-change:left,width}
#kalkulator-section .anim-right{animation:kalkulator-snapRight 0.35s cubic-bezier(0.18,0.89,0.32,1.1) forwards}
#kalkulator-section .anim-left{animation:kalkulator-snapLeft 0.35s cubic-bezier(0.18,0.89,0.32,1.1) forwards}
#kalkulator-section .anim-right-mobile{animation:kalkulator-snapRightMobile 0.35s cubic-bezier(0.18,0.89,0.32,1.1) forwards}
#kalkulator-section .anim-left-mobile{animation:kalkulator-snapLeftMobile 0.35s cubic-bezier(0.18,0.89,0.32,1.1) forwards}
#kalkulator-section .source-btn > * + *{margin-left:clamp(8px, 0.6vw, 12px)}
#kalkulator-section .thumb > * + *{margin-left:8px}
#kalkulator-section label.flex.items-center > * + *{margin-left:0.5rem}
`;

// [PIPELINE] Style injection moved to React lifecycle — see injectKalkulatorStyles()

// ============================================
// FLIP ANIMATION GLOBAL STYLES
// ============================================
const FLIP_GLOBAL_STYLES = `
#kalkulator-section.kalkulator-flip-animating .source-btn {
  opacity: 0.5 !important;
  pointer-events: none !important;
}
`;

/** IO gating: poza viewport — zero kosztu GPU na nieskończonej animacji kropki */
const KALKULATOR_VIEWPORT_STYLES = `
#kalkulator-section.kalkulator-section--offscreen [data-kalkulator-dot] {
  animation-play-state: paused !important;
}
`;

const BACKSIDE_GLOBAL_STYLES = `
/* ═══════════════════════════════════════════════════════════════
   TYŁ - PARALAKSA 3D
   
   WARSTWY Z (desktop):
   Z=0    : Tło (gradient)
   Z=50px : Biały kontener .back-left
   Z=80px : .model-section h2 "Który model"
   Z=100px: .model-row (tagi + teksty), .back-note, .back-btn
   
   KRYTYCZNE: transform-style: preserve-3d na CAŁEJ hierarchii!
   KRYTYCZNE: ŻADNEGO overflow: hidden - łamie 3D!
   ═══════════════════════════════════════════════════════════════ */

#kalkulator-section .banner-back {
  position: absolute;
  top: 0; right: 0; bottom: 0; left: 0;
  border-radius: 2rem;
  background: #D5D1C7;
  background: linear-gradient(349deg, rgba(213, 209, 199, 1) 0%, rgba(241, 241, 241, 1) 49%, rgba(255, 255, 255, 1) 100%);
  transform-style: preserve-3d;
  display: flex;
  flex-direction: column;
  font-family: 'Lexend', sans-serif;
  visibility: hidden;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  /* BRAK overflow: hidden! To łamie preserve-3d */
}

/* Back rotation for 3D flip */
@media (min-width: 1200px) {
  #kalkulator-section .banner-back {
    transform: rotateX(180deg); 
    padding: clamp(2rem, 4vw, 3.5rem); 
  }
}
@media (max-width: 1199px) {
  #kalkulator-section .banner-back {
    transform: rotateY(180deg); 
    padding: 2rem;
  }
}
@media (max-width: 599px) {
  #kalkulator-section .banner-back { padding: 1.5rem; }
}
@media (max-width: 399px) {
  #kalkulator-section .banner-back { padding: 1rem; }
}

/* ═══════════════════════════════════════════════════════════════
   GRID - preserve-3d KRYTYCZNE!
   ═══════════════════════════════════════════════════════════════ */
#kalkulator-section .back-content-wrapper {
  flex: 1;
  display: grid;
  align-items: center;
  transform-style: preserve-3d;
}

@media (min-width: 1200px) {
  #kalkulator-section .back-content-wrapper {
    grid-template-columns: 1.15fr 0.85fr;
    gap: clamp(2rem, 4vw, 3.5rem);
  }
}
@media (max-width: 1199px) {
  #kalkulator-section .back-content-wrapper {
    grid-template-columns: 1fr;
    gap: 0;
  }
}

/* ═══════════════════════════════════════════════════════════════
   BACK LEFT - Z=50px (desktop), Z=40px (tablet), etc.
   ═══════════════════════════════════════════════════════════════ */
#kalkulator-section .back-left {
  background: linear-gradient(349deg, rgba(232, 229, 223, 1) 0%, rgba(249, 249, 249, 1) 100%);
  border-radius: 24px;
  box-shadow: 8px 8px 16px rgba(201, 198, 192, 0.7), -8px -8px 16px #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transform-style: preserve-3d;
}

@media (min-width: 1200px) {
  #kalkulator-section .back-left {
    transform: translateZ(50px);
    padding: clamp(1.2rem, 2vw, 1.75rem) clamp(1.2rem, 2.2vw, 1.8rem);
    min-height: 260px;
    margin-left: 20px;
  }
  #kalkulator-section .back-left h3 { font-size: clamp(1.4rem, 2.2vw, 1.9rem); margin-bottom: 0.75rem; }
  #kalkulator-section .back-left p { font-size: clamp(1rem, 1.4vw, 1.2rem); }
}
@media (max-width: 1199px) {
  #kalkulator-section .back-left {
    transform: translateZ(40px);
    padding: 1rem 1.25rem;
    min-height: auto;
    margin-left: 0;
    margin-bottom: 1.25rem;
  }
  #kalkulator-section .back-left h3 { font-size: 1.15rem; margin-bottom: 0.6rem; }
  #kalkulator-section .back-left p { font-size: 0.95rem; }
}
@media (max-width: 599px) {
  #kalkulator-section .back-left {
    transform: translateZ(35px);
    padding: 0.85rem 1rem;
    margin-bottom: 1rem;
    border-radius: 20px;
  }
  #kalkulator-section .back-left h3 { font-size: 1rem; margin-bottom: 0.5rem; }
  #kalkulator-section .back-left p { font-size: 0.85rem; }
}
@media (max-width: 399px) {
  #kalkulator-section .back-left {
    transform: translateZ(30px);
    padding: 0.75rem 0.85rem;
    margin-bottom: 0.85rem;
    border-radius: 16px;
  }
  #kalkulator-section .back-left h3 { font-size: 0.9rem; margin-bottom: 0.4rem; }
  #kalkulator-section .back-left p { font-size: 0.78rem; }
}

#kalkulator-section .back-left h3 { font-weight: 400; color: #141414; line-height: 1.35; }
#kalkulator-section .back-left h3 .bold { font-weight: 700; }
#kalkulator-section .back-left p { font-weight: 400; color: rgba(20, 20, 20, 0.6); line-height: 1.5; margin: 0; margin-top: 0.75em; }
#kalkulator-section .back-left .highlight { color: #1e7e34; font-weight: 700; }

/* ═══════════════════════════════════════════════════════════════
   BACK RIGHT - preserve-3d dla dzieci
   ═══════════════════════════════════════════════════════════════ */
#kalkulator-section .back-right {
  transform-style: preserve-3d;
}
@media (min-width: 1200px) {
  #kalkulator-section .back-right { margin-right: 15px; }
}
@media (max-width: 1199px) {
  #kalkulator-section .back-right { margin-right: 0; }
}

/* ═══════════════════════════════════════════════════════════════
   MODEL SECTION - preserve-3d, text-align center na mobile
   ═══════════════════════════════════════════════════════════════ */
#kalkulator-section .model-section {
  transform-style: preserve-3d;
}
@media (max-width: 1199px) {
  #kalkulator-section .model-section { text-align: center; }
}

/* Z=80px (desktop) -> Z=60/50/40/35 na mniejszych */
#kalkulator-section .model-section h2 {
  font-weight: 700;
  color: #141414;
}
@media (min-width: 1200px) {
  #kalkulator-section .model-section h2 { transform: translateZ(80px); font-size: clamp(1.1rem, 1.6vw, 1.4rem); margin-bottom: 1.5rem; }
}
@media (max-width: 1199px) {
  #kalkulator-section .model-section h2 { transform: translateZ(60px); font-size: 1.1rem; margin-bottom: 1rem; }
}
@media (max-width: 599px) {
  #kalkulator-section .model-section h2 { transform: translateZ(50px); font-size: 1rem; margin-bottom: 0.85rem; }
}
@media (max-width: 399px) {
  #kalkulator-section .model-section h2 { transform: translateZ(40px); font-size: 0.88rem; margin-bottom: 0.7rem; }
}

/* ═══════════════════════════════════════════════════════════════
   MODEL ROWS - Z=100px (desktop) -> Z=80/65/55 na mniejszych
   ═══════════════════════════════════════════════════════════════ */
#kalkulator-section .model-row {
  display: flex;
  align-items: center;
}
#kalkulator-section .model-row p { color: #141414; line-height: 1.4; margin: 0; }

@media (min-width: 1200px) {
  #kalkulator-section .model-row { transform: translateZ(100px); margin-bottom: 1.5rem; }
  #kalkulator-section .model-row > * + * { margin-left: 1.25rem; }
  #kalkulator-section .model-row p { font-size: clamp(1rem, 1.4vw, 1.15rem); }
}
@media (max-width: 1199px) {
  #kalkulator-section .model-row { transform: translateZ(80px); justify-content: center; margin-bottom: 0.85rem; flex-direction: row; }
  #kalkulator-section .model-row > * + * { margin-left: 1rem; }
  #kalkulator-section .model-row p { font-size: 0.95rem; }
}
@media (max-width: 599px) {
  #kalkulator-section .model-row { transform: translateZ(65px); flex-direction: column; gap: 0.3rem; margin-bottom: 0.7rem; }
  #kalkulator-section .model-row p { font-size: 0.9rem; text-align: center; }
}
@media (max-width: 399px) {
  #kalkulator-section .model-row { transform: translateZ(55px); gap: 0.2rem; margin-bottom: 0.55rem; }
  #kalkulator-section .model-row p { font-size: 0.82rem; }
}
#kalkulator-section .model-row:last-of-type { margin-bottom: 0; }

/* ═══════════════════════════════════════════════════════════════
   MODEL TAGS
   ═══════════════════════════════════════════════════════════════ */
#kalkulator-section .model-tag {
  display: inline-block;
  border-radius: 25px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  box-shadow: 4px 4px 8px rgba(201, 198, 192, 0.7), -4px -4px 8px #ffffff;
}
#kalkulator-section .model-tag.cautious { background: #d3ebd5; color: #043e0b; }
#kalkulator-section .model-tag.ambitious { background: #ffd1ab; color: #c5141c; }

@media (min-width: 1200px) { #kalkulator-section .model-tag { padding: 10px 20px; font-size: 0.85rem; } }
@media (max-width: 1199px) { #kalkulator-section .model-tag { padding: 8px 16px; font-size: 0.75rem; } }
@media (max-width: 599px) { #kalkulator-section .model-tag { padding: 7px 14px; font-size: 0.72rem; } }
@media (max-width: 399px) { #kalkulator-section .model-tag { padding: 6px 12px; font-size: 0.65rem; } }

/* ═══════════════════════════════════════════════════════════════
   BACK NOTE - Z=100px (desktop) -> Z=80/65/55 na mniejszych
   ═══════════════════════════════════════════════════════════════ */
#kalkulator-section .back-note {
  background: rgba(255,255,255,0.5);
  border-radius: 14px;
  color: rgba(20, 20, 20, 0.6);
  line-height: 1.6;
}
@media (min-width: 1200px) {
  #kalkulator-section .back-note { transform: translateZ(100px); margin-top: 1.5rem; padding: 1rem; font-size: clamp(0.75rem, 0.95vw, 0.85rem); max-width: 90%; }
}
@media (max-width: 1199px) {
  #kalkulator-section .back-note { transform: translateZ(80px); margin-top: 1.25rem; padding: 0.85rem 1rem; font-size: 0.8rem; text-align: left; max-width: 100%; }
}
@media (max-width: 599px) {
  #kalkulator-section .back-note { transform: translateZ(65px); margin-top: 1rem; padding: 0.75rem 0.85rem; font-size: 0.75rem; border-radius: 12px; }
}
@media (max-width: 399px) {
  #kalkulator-section .back-note { transform: translateZ(55px); margin-top: 0.85rem; padding: 0.6rem 0.75rem; font-size: 0.68rem; border-radius: 10px; }
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER & BUTTON - Z=100px (desktop) -> Z=80/65/55 na mniejszych
   ═══════════════════════════════════════════════════════════════ */
#kalkulator-section .back-footer {
  margin-top: auto;
  text-align: center;
  transform-style: preserve-3d;
}
@media (min-width: 1200px) { #kalkulator-section .back-footer { padding-top: 2rem; padding-bottom: 1rem; } }
@media (max-width: 1199px) { #kalkulator-section .back-footer { padding-top: 1.25rem; padding-bottom: 0.75rem; } }
@media (max-width: 599px) { #kalkulator-section .back-footer { padding-top: 1rem; padding-bottom: 0.5rem; } }
@media (max-width: 399px) { #kalkulator-section .back-footer { padding-top: 0.85rem; } }

/* Premium Yellow Button */
#kalkulator-section .btn-banner {
  --radius: 60px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  outline: none;
  padding: 16px 44px;
  border-radius: var(--radius);
  font-family: 'Lexend', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #262626;
  background: #ffc600;
  box-shadow: 
    0 0 0 1px rgba(255, 220, 100, 0.8),
    inset 0 6px 12px -2px rgba(255, 240, 180, 0.8),
    inset 0 -6px 12px -2px rgba(200, 150, 0, 0.4),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.6);
  overflow: hidden;
  transition: box-shadow 0.15s cubic-bezier(0.25, 1, 0.5, 1);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
}

#kalkulator-section .btn-banner::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    ellipse at 30% 20%,
    rgba(255, 255, 255, 0.4) 0%,
    transparent 40%
  );
  pointer-events: none;
}

#kalkulator-section .btn-banner:hover {
  box-shadow: 
    0 0 0 1px rgba(255, 220, 100, 0.9),
    inset 0 6px 14px -2px rgba(255, 240, 180, 0.9),
    inset 0 -6px 14px -2px rgba(200, 150, 0, 0.5),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.7),
    0 8px 24px rgba(255, 198, 0, 0.4);
}

#kalkulator-section .btn-text-banner {
  position: relative;
  z-index: 20;
  color: #262626;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
  pointer-events: none;
}

#kalkulator-section .btn-text-banner::after {
  content: attr(data-text);
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    110deg,
    transparent 30%,
    rgba(254, 215, 79, 0.5) 45%,
    rgba(254, 215, 79, 1.0) 50%,
    rgba(254, 215, 79, 0.5) 55%,
    transparent 70%
  );
  background-size: 200% 100%;
  background-position: 150% 0;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: none;
  transition: background-position 1.2s cubic-bezier(0.19, 1, 0.22, 1);
}

#kalkulator-section .btn-banner:hover .btn-text-banner::after {
  background-position: -50% 0;
}

/* Button Z-depth */
@media (min-width: 1200px) {
  #kalkulator-section .btn-banner { transform: translateZ(100px); }
}
@media (max-width: 1199px) {
  #kalkulator-section .btn-banner { transform: translateZ(80px); padding: 14px 36px; font-size: 1rem; }
}
@media (max-width: 599px) {
  #kalkulator-section .btn-banner { transform: translateZ(65px); padding: 12px 28px; font-size: 0.9rem; }
}
@media (max-width: 399px) {
  #kalkulator-section .btn-banner { transform: translateZ(55px); padding: 10px 24px; font-size: 0.85rem; --radius: 50px; }
}
`;

// [PIPELINE] Style injection moved to React lifecycle — see injectKalkulatorStyles()


// ============================================
// [PIPELINE] LIFECYCLE-MANAGED STYLE INJECTION
// ============================================
function injectKalkulatorStyles() {
  const ids = [
    { id: 'kalkulator-slider-global-styles', css: SLIDER_GLOBAL_STYLES },
    { id: 'kalkulator-flip-global-styles', css: FLIP_GLOBAL_STYLES },
    { id: 'kalkulator-viewport-styles', css: KALKULATOR_VIEWPORT_STYLES },
    { id: 'kalkulator-backside-global-styles', css: BACKSIDE_GLOBAL_STYLES },
  ];
  const elements = [];
  ids.forEach(({ id, css }) => {
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = css;
      document.head.appendChild(el);
      elements.push(el);
    } else {
      elements.push(document.getElementById(id));
    }
  });
  return elements;
}

// ============================================
// BACKSIDE CONTENT COMPONENT
// ============================================
const BacksideContent = React.memo(({ backRef, onFlipBack }) => {
  return (
    <div ref={backRef} className="banner-back">
      <div className="back-content-wrapper">
        <div className="back-left">
          <h3>
            <span className="bold">Kalkulator</span> pokazuje ile{' '}
            dodatkowych pieniędzy zarobisz, 
            gdy choć 1% więcej osób, które odwiedzą Twoją stronę zostanie Twoimi klientami.
          </h3>
          <p>
            <span className="highlight">Konwersja</span> oznacza ile osób po wejściu 
            na Twoją stronę mówi „Tak, chcę tego!" — Wypełnia formularz, dzwoni lub kupuje.
          </p>
        </div>
        <div className="back-right">
          <div className="model-section">
            <h2>Który model będzie bardziej wiarygodny?</h2>
            <div className="model-row">
              <span className="model-tag cautious">Ostrożny</span>
              <p>Jeśli Twoja strona już jest dobra</p>
            </div>
            <div className="model-row">
              <span className="model-tag ambitious">Ambitny</span>
              <p>Jeśli Twoja strona jest dziś słaba</p>
            </div>
          </div>
          <div className="back-note">
            <strong>Ważne:</strong> Wartości prognozują wyłącznie dodatkowy przychód. 
            Bez znaczenia czy Twoja aktualna konwersja wynosi 0% czy 25%.
          </div>
        </div>
      </div>
      <div className="back-footer">
        <button className="btn-banner" onClick={onFlipBack}>
          <span className="btn-text-banner" data-text="← Wróć do kalkulatora">← Wróć do kalkulatora</span>
        </button>
      </div>
    </div>
  );
});

// ============================================
// SLIDER & OTHER COMPONENTS
// ============================================

const CONFIG = { sensitivity: 15, rotateMult: 35, returnTime: '0.4s', bubbleGap: '20px', padOuter: 0, padInner: 55, trackHeight: 56, thumbWidth: 85, totalTicks: 36 };
const COLORS = { accent: '#fec708', accentLight: 'rgba(254, 199, 8, 0.7)', accentDark: '#d4a906', tickBase: 'rgba(58, 46, 30, 0.15)', tickMajor: 'rgba(58, 46, 30, 0.15)' };
const MODES = { conservative: { low: 0.01, high: 0.05 }, ambitious: { low: 0.06, high: 0.10 } };

function calculateRevenue(traffic, avgProfit, rate) {
  const monthlyRaw = traffic * avgProfit * rate;
  return { monthly: Math.floor(monthlyRaw), yearly: Math.floor(monthlyRaw * 12) };
}

const ratioToValue = (ratio, min, max) => ratio <= 0 ? min : ratio >= 1 ? max : min * Math.pow(max / min, ratio);
const valueToRatio = (value, min, max) => value <= min ? 0 : value >= max ? 1 : Math.log(value / min) / Math.log(max / min);

const Tick = React.memo(({ isMajor }) => {
  const height = isMajor ? 12 : 6;
  return (
    <div style={{ width: '2px', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '1px', height: `${height}px`, background: isMajor ? COLORS.tickMajor : COLORS.tickBase, opacity: isMajor ? 1 : 0.5, borderRadius: 1 }} />
    </div>
  );
});

const PremiumSlider = React.memo(({ min = 1, max = 50000, defaultValue = 35, unit = 'PLN', onChange, onRatioChange, isMobile = false, inputValue, setInputValue, scaleFactor = 1 }) => {
  const wrapperRef = useRef(null), rangeRef = useRef(null), bubbleRef = useRef(null), thumbRef = useRef(null), unitRef = useRef(null), gripLineRef = useRef(null), gripLeftRef = useRef(null), gripRightRef = useRef(null);
  const defaultRatio = valueToRatio(defaultValue, min, max), prevRatioRef = useRef(defaultRatio), isActiveRef = useRef(false);
  const padInner = Math.max(35, Math.round(CONFIG.padInner * scaleFactor)), thumbWidth = Math.max(60, Math.round(CONFIG.thumbWidth * scaleFactor)), trackHeight = Math.max(44, Math.round(CONFIG.trackHeight * scaleFactor));
  const [localInputValue, setLocalInputValue] = useState(formatNumber(Math.round(defaultValue)));
  const [isActive, setIsActive] = useState(false);
  const actualInputValue = inputValue !== undefined ? inputValue : localInputValue;
  const actualSetInputValue = setInputValue !== undefined ? setInputValue : setLocalInputValue;
  
  // F1: Dirty check refs dla slider
  const lastRoundedRef = useRef(Math.round(defaultValue));
  const lastInputLenRef = useRef(0);

  const resizeInput = useCallback((value) => {
    const formatted = formatNumber(Math.round(value));
    const len = formatted.length || 1;
    
    if (len === lastInputLenRef.current) return;
    lastInputLenRef.current = len;
    
    if (bubbleRef.current) { 
      const input = bubbleRef.current.querySelector('input'); 
      if (input) input.style.width = `${len + 1}ch`; 
    }
  }, []);

  // F1: Dirty check w updateFromRange
  const updateFromRange = useCallback(() => {
    if (!wrapperRef.current || !rangeRef.current) return;
    
    const rangeVal = parseFloat(rangeRef.current.value);
    const ratio = rangeVal / 100;
    const actualValue = ratioToValue(ratio, min, max);
    const delta = ratio - prevRatioRef.current;
    const momentum = Math.max(-1, Math.min(1, delta * CONFIG.sensitivity));
    
    // CSS vars aktualizujemy zawsze (smooth animation)
    wrapperRef.current.style.setProperty('--ratio', ratio);
    wrapperRef.current.style.setProperty('--momentum', momentum);
    prevRatioRef.current = ratio;
    
    const roundedVal = Math.round(actualValue);
    
    // F1: DIRTY CHECK - skip formatowanie jeśli wartość się nie zmieniła
    if (roundedVal === lastRoundedRef.current) {
      return; // Tylko CSS vars zaktualizowane, reszta skip
    }
    lastRoundedRef.current = roundedVal;
    
    // Formatowanie i callbacks tylko gdy wartość się zmieniła
    actualSetInputValue(formatNumber(roundedVal));
    resizeInput(roundedVal);
    onChange?.(roundedVal);
    onRatioChange?.(ratio);
  }, [min, max, resizeInput, onChange, onRatioChange, actualSetInputValue]);

  const commitBubbleValue = useCallback(() => {
    if (!wrapperRef.current || !rangeRef.current) return;
    let val = parseFloat(actualInputValue.replace(/\s/g, '').replace(/,/g, '.'));
    if (isNaN(val)) val = min; if (val > max) val = max; if (val < min) val = min;
    const toRatio = valueToRatio(val, min, max);
    rangeRef.current.value = toRatio * 100;
    wrapperRef.current.style.setProperty('--ratio', toRatio);
    wrapperRef.current.style.setProperty('--momentum', 0);
    prevRatioRef.current = toRatio;
    const roundedVal = Math.round(val);
    lastRoundedRef.current = roundedVal;
    actualSetInputValue(formatNumber(roundedVal));
    resizeInput(roundedVal);
    onChange?.(roundedVal);
    onRatioChange?.(toRatio);
  }, [actualInputValue, min, max, resizeInput, onChange, onRatioChange, actualSetInputValue]);

  const activate = useCallback(() => {
    isActiveRef.current = true; setIsActive(true);
    bubbleRef.current?.classList.add('active'); thumbRef.current?.classList.add('active'); unitRef.current?.classList.add('active');
    gripLineRef.current?.classList.add('active'); gripLeftRef.current?.classList.add('active'); gripRightRef.current?.classList.add('active');
  }, []);

  const deactivate = useCallback(() => {
    if (!isActiveRef.current) return; isActiveRef.current = false; setIsActive(false);
    wrapperRef.current?.style.setProperty('--momentum', 0);
    bubbleRef.current?.classList.remove('active'); thumbRef.current?.classList.remove('active'); unitRef.current?.classList.remove('active');
    gripLineRef.current?.classList.remove('active'); gripRightRef.current?.classList.remove('active'); gripLeftRef.current?.classList.remove('active');
  }, []);

  useEffect(() => {
    const handleGlobalUp = () => { if (isActiveRef.current) deactivate(); };
    const passive = { passive: true };
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp, passive);
    window.addEventListener('touchcancel', handleGlobalUp, passive);
    window.addEventListener('pointerup', handleGlobalUp, passive);
    window.addEventListener('blur', handleGlobalUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp, passive);
      window.removeEventListener('touchcancel', handleGlobalUp, passive);
      window.removeEventListener('pointerup', handleGlobalUp, passive);
      window.removeEventListener('blur', handleGlobalUp);
    };
  }, [deactivate]);

  useEffect(() => {
    resizeInput(defaultValue);
    lastRoundedRef.current = Math.round(defaultValue);
    const ratio = valueToRatio(defaultValue, min, max);
    if (wrapperRef.current) wrapperRef.current.style.setProperty('--ratio', ratio);
    if (rangeRef.current) rangeRef.current.value = ratio * 100;
  }, [defaultValue, min, max, resizeInput]);

  const ticks = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= CONFIG.totalTicks; i++) {
      arr.push(<Tick key={i} isMajor={i % 6 === 0} />);
    }
    return arr;
  }, []);
  
  const padTotal = CONFIG.padOuter + padInner;

  return (
    <div ref={wrapperRef} style={{ width: '100%', position: 'relative', height: `${trackHeight}px`, overflow: 'visible', fontFamily: "'Lexend', sans-serif", '--ratio': defaultRatio, '--momentum': 0, '--rotate-mult': CONFIG.rotateMult, '--return-time': CONFIG.returnTime, '--pad-total': `${padTotal}px`, '--track-height': `${trackHeight}px`, '--thumb-width': `${thumbWidth}px`, '--accent': COLORS.accent, '--ease-elastic': 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
      <div className="slider-active-styles" style={{ position: 'relative', height: '100%' }}>
        {!isMobile && (
        <div ref={bubbleRef} className="bubble" style={{ position: 'absolute', bottom: `calc(100% + ${CONFIG.bubbleGap})`, left: `calc(${padTotal}px + var(--ratio) * (100% - ${2 * padTotal}px))`, transform: 'translateX(-50%) rotate(calc(var(--momentum) * var(--rotate-mult) * -1deg))', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', zIndex: 20, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '8px 12px', minWidth: '60px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', transition: 'transform 0.4s var(--ease-elastic), background-color 0.3s, border-color 0.3s, border-radius 0.4s, box-shadow 0.3s', transformOrigin: 'center calc(100% + 40px)' }}>
          <input type="text" value={actualInputValue} style={{ border: 'none', background: 'transparent', fontSize: '16px', transform: 'scale(1.4)', fontWeight: 700, textAlign: 'center', color: '#141414', padding: 0, margin: 0, outline: 'none', minWidth: '30px', maxWidth: '200px' }} onChange={(e) => actualSetInputValue(e.target.value)} onBlur={commitBubbleValue} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} onFocus={activate} />
          <span ref={unitRef} className="unit" style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '12px', fontSize: '1.18rem', fontWeight: 700, color: '#888', whiteSpace: 'nowrap', opacity: 1, transition: 'opacity 0.2s ease, transform 0.3s ease', pointerEvents: 'none' }}>{unit}</span>
        </div>
        )}
        <input ref={rangeRef} type="range" min={0} max={100} step={0.1} defaultValue={defaultRatio * 100} style={{ position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10, margin: 0, touchAction: 'none', WebkitTapHighlightColor: 'transparent' }} onInput={updateFromRange} onMouseDown={activate} onTouchStart={activate} onMouseUp={deactivate} onTouchEnd={deactivate} onBlur={deactivate} />
        <div style={{ position: 'absolute', top: 0, left: `${CONFIG.padOuter}px`, right: `${CONFIG.padOuter}px`, height: '100%' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: '999px', background: 'linear-gradient(to bottom, rgba(198, 168, 105, 0.08) 0%, rgba(198, 168, 105, 0) 40%), linear-gradient(to top, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 50%)', boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.8), inset 0 -1px 0.5px rgba(255,255,255,0.6)', overflow: 'hidden', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: '999px', overflow: 'hidden', zIndex: 2, background: isActive ? `radial-gradient(110px 80px at calc(${padInner}px + var(--ratio) * (100% - ${2 * padInner}px)) 50%, #fec708 0%, transparent 70%)` : `radial-gradient(176px 72px at calc(${padInner}px + var(--ratio) * (100% - ${2 * padInner}px)) 50%, ${COLORS.accentLight} 0%, transparent 65%)`, transition: isActive ? 'background 0.1s' : 'background 2.5s cubic-bezier(0.19, 1, 0.22, 1)' }} />
        </div>
        <div style={{ position: 'absolute', top: 0, height: '100%', left: `${padTotal}px`, right: `${padTotal}px`, pointerEvents: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maskImage: 'linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)', zIndex: 3 }}>{ticks}</div>
        <div ref={thumbRef} className="thumb" style={{ position: 'absolute', top: '50%', left: `calc(${padTotal}px + var(--ratio) * (100% - ${2 * padTotal}px))`, width: `${thumbWidth}px`, height: `${Math.max(44, Math.round(48 * scaleFactor))}px`, transform: 'translate(-50%, -50%)', background: 'linear-gradient(145deg, #fff, #f5f5f5)', border: '1px solid transparent', borderRadius: '99px', boxShadow: '0 4px 14px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.1), inset 0 2px 0 rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 5, transition: 'transform 0.25s, box-shadow 0.25s, background 0.25s, border 0.25s' }}>
          <div ref={gripLeftRef} className="grip-left" style={{ width: 0, height: 0, border: '6px solid transparent', borderRight: '7px solid #c0c0c0', transition: 'all 0.2s ease-out' }} />
          <div ref={gripLineRef} className="grip-line" style={{ width: '2px', height: '18px', background: '#c0c0c0', borderRadius: '1px', transition: 'all 0.2s ease-out' }} />
          <div ref={gripRightRef} className="grip-right" style={{ width: 0, height: 0, border: '6px solid transparent', borderLeft: '7px solid #c0c0c0', transition: 'all 0.2s ease-out' }} />
        </div>
      </div>
    </div>
  );
});

const SourceButton = ({ font, isMobile = false, onFlip }) => {
  const [isHovered, setIsHovered] = useState(false);
  const circleSize = 'clamp(24px, 1.8vw, 32px)';
  const textSize = isMobile ? '12px' : '13px';
  const textColor = isHovered ? '#333' : 'rgba(20, 20, 20, 0.75)';
  return (
    <div className="source-btn" style={{ display: 'flex', alignItems: 'center',  cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', padding: '8px 12px 8px 8px', borderRadius: '12px', transition: 'transform 0.2s ease, opacity 0.3s ease' }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onClick={onFlip}>
      <div className="flex items-center justify-center transition-all duration-300" style={{ width: circleSize, height: circleSize, borderRadius: '50%', background: isHovered ? 'rgba(244, 114, 37, 0.05)' : '#f7f6f4', boxShadow: isHovered ? 'inset 2px 2px 5px rgba(163, 177, 198, 0.18), inset -2px -2px 5px rgba(255, 255, 255, 1)' : '3px 3px 6px rgba(163, 177, 198, 0.15), -3px -3px 6px rgba(255, 255, 255, 1)', border: isHovered ? '1px solid transparent' : '1px solid rgba(255,255,255,0.6)', fontFamily: font, fontSize: 'clamp(12px, 0.9vw, 16px)', fontWeight: 700, lineHeight: 1, color: isHovered ? '#d63e08' : 'rgba(20, 20, 20, 0.75)', textRendering: 'geometricPrecision', WebkitFontSmoothing: 'antialiased' }}>?</div>
      <span style={{ fontFamily: font, fontSize: textSize, fontWeight: 600, letterSpacing: '-0.01em', color: textColor, whiteSpace: 'nowrap', transition: 'color 0.3s ease', textRendering: 'geometricPrecision', WebkitFontSmoothing: 'antialiased' }}>Źródła danych</span>
    </div>
  );
};

const DebugLabel = ({ show, name, color, position = 'top-left' }) => {
  if (!show) return null;
  const posStyle = {
    'top-left': { top: 4, left: 4 },
    'top-right': { top: 4, right: 4 },
    'bottom-left': { bottom: 4, left: 4 },
    'bottom-right': { bottom: 4, right: 4 },
  };
  return (
    <div style={{ position: 'absolute', ...posStyle[position], background: color, color: '#fff', fontSize: 9, padding: '2px 5px', borderRadius: 3, fontWeight: 700, zIndex: 100, whiteSpace: 'nowrap' }}>{name}</div>
  );
};

// ============================================
// [OPT-3] MEMOIZED STATIC SECTIONS
// ============================================

// Static desktop question labels - never change, no need to re-render
const DesktopQuestionLabel1 = React.memo(({ font, fontSize, questionAlign, dbg, D, showDebug }) => (
  <div className="relative" style={{ marginTop: '1.875rem', marginBottom: '-0.5rem', display: 'block', outline: dbg(D.q1Desktop), position: 'relative' }}>
    <DebugLabel show={showDebug} name="Q1-DESKTOP" color={D.q1Desktop} />
    <p style={{ color: '#141414', fontFamily: font, fontWeight: 500, fontSize: fontSize, lineHeight: 1.3, textAlign: questionAlign }}>Średni zysk<br />z klienta?</p>
  </div>
));

const DesktopQuestionLabel2 = React.memo(({ font, fontSize, questionAlign, dbg, D, showDebug }) => (
  <div className="relative" style={{ marginTop: '0.25rem', marginBottom: '-0.5rem', display: 'block', outline: dbg(D.q2Desktop), position: 'relative' }}>
    <DebugLabel show={showDebug} name="Q2-DESKTOP" color={D.q2Desktop} />
    <p style={{ color: '#141414', fontFamily: font, fontWeight: 500, fontSize: fontSize, lineHeight: 1.3, textAlign: questionAlign }}>Ile osób odwiedza<br />stronę miesięcznie?</p>
  </div>
));

// Separator line - static, never changes
const SeparatorLine = React.memo(({ isMobile, isExtraLarge }) => (
  <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 0, order: isMobile ? 5 : 'unset', marginTop: isMobile ? '1rem' : '2.75rem', marginBottom: isMobile ? '1rem' : 0, width: isMobile ? '100%' : (isExtraLarge ? '600px' : 'calc(100% - 660px - 2%)'), position: 'relative' }}>
    <div style={{ height: '2px', background: 'linear-gradient(to bottom, rgba(58, 46, 30, 0.15) 0%, rgba(58, 46, 30, 0.15) 50%, rgba(255, 255, 255, 0.6) 50%, rgba(255, 255, 255, 0.6) 100%)', maskImage: 'linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent)', transform: 'translateZ(0)' }} />
  </div>
));

const RadioGroup = React.memo(({ value, onChange, dotGradient, dotShadow, font }) => (
  <div className="flex flex-col" style={{ width: '130px', gap: 0 }}>
    <label className="flex items-center cursor-pointer" onClick={() => onChange('yearly')} style={{ height: '24px', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, position: 'relative', background: '#f4f3f1', boxShadow: 'inset 2px 2px 5px rgba(163, 177, 198, 0.18), inset -2px -2px 5px rgba(255, 255, 255, 1)', marginRight: '0.5rem' }}>
        {value === 'yearly' && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '10px', height: '10px', borderRadius: '50%', background: dotGradient, boxShadow: dotShadow }} />}
      </div>
      <span style={{ fontFamily: font, fontWeight: value === 'yearly' ? 600 : 500, fontSize: '1.1rem', color: value === 'yearly' ? '#333' : '#9ca3af' }}>Rocznie</span>
    </label>
    <label className="flex items-center cursor-pointer" onClick={() => onChange('monthly')} style={{ height: '24px', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, position: 'relative', background: '#f4f3f1', boxShadow: 'inset 2px 2px 5px rgba(163, 177, 198, 0.18), inset -2px -2px 5px rgba(255, 255, 255, 1)', marginRight: '0.5rem' }}>
        {value === 'monthly' && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '10px', height: '10px', borderRadius: '50%', background: dotGradient, boxShadow: dotShadow }} />}
      </div>
      <span style={{ fontFamily: font, fontWeight: value === 'monthly' ? 600 : 500, fontSize: '1.1rem', color: value === 'monthly' ? '#333' : '#9ca3af' }}>Miesięcznie</span>
    </label>
  </div>
));

export default function ConversionCalculator() {
  const [screenSize, setScreenSize] = useState(() => ({ w: typeof window !== 'undefined' ? window.innerWidth : 0, h: typeof window !== 'undefined' ? window.innerHeight : 0 }));
  const [isAmbitious, setIsAmbitious] = useState(false);
  const [period1, setPeriod1] = useState('yearly');
  const [period2, setPeriod2] = useState('yearly');
  const [sharedPeriod, setSharedPeriod] = useState('yearly');
  const [showDebug] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'));
  const [dotSize] = useState(750);
  const [whiteStop] = useState(37);
  const [transparentStop] = useState(74);
  const [centerX] = useState(78);
  const [centerY] = useState(56);
  const [rangeX] = useState(6);
  const [rangeY] = useState(10.5);
  const [duration] = useState(16);
  
  const lastWidthRef = useRef(0);
  const rootRef = useRef(null);
  const [sectionInView, setSectionInView] = useState(true);

  // [PIPELINE] Style injection with cleanup
  useEffect(() => {
    const styleEls = injectKalkulatorStyles();
    return () => {
      styleEls.forEach(el => {
        try { el.remove(); } catch(e) {}
      });
      flipTweenRef.current?.kill();
      flipTweenRef.current = null;
      rootRef.current?.classList.remove('kalkulator-flip-animating');
      try { setKalkulatorFlipOverflowLock(false); } catch(e) {}
    };
  }, []);

  const bannerRef = useRef(null);
  const spotlightRequestRef = useRef(null);
  
  // FLIP ANIMATION REFS
  const cardRef = useRef(null);
  const backRef = useRef(null);
  const isFlippedRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const flipTweenRef = useRef(null);

  // IO: poza viewport — pauza animacji kropki (CSS) + spring liczb (engine pause/resume)
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        setSectionInView(e.isIntersecting);
      },
      { rootMargin: '120px 0px', threshold: 0 }
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);
  
  useEffect(() => {
    return () => {
      if (spotlightRequestRef.current) cancelAnimationFrame(spotlightRequestRef.current);
    };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (isFlippedRef.current) return;
    if (!bannerRef.current || spotlightRequestRef.current) return;

    spotlightRequestRef.current = requestAnimationFrame(() => {
      if (!bannerRef.current) { spotlightRequestRef.current = null; return; }
      const rect = bannerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      bannerRef.current.style.setProperty('--x', `${x}px`);
      bannerRef.current.style.setProperty('--y', `${y}px`);
      spotlightRequestRef.current = null;
    });
  }, []);

  // FLIP ANIMATION — original JS visibility toggle preserved
  // backface-visibility: hidden alone doesn't work because front has rgba(255,255,255,0.58) background
  // Semi-transparent front lets back show through — must use visibility: hidden/visible as hard block
  const handleFlip = useCallback(() => {
    if (isAnimatingRef.current || !cardRef.current || !bannerRef.current || !backRef.current) return;

    isAnimatingRef.current = true;
    rootRef.current?.classList.add('kalkulator-flip-animating');
    setKalkulatorFlipOverflowLock(true);

    const isMobileView = window.innerWidth < 1200;
    const rotAxis = isMobileView ? 'rotateY' : 'rotateX';
    const startRotation = isFlippedRef.current ? 180 : 0;
    const endRotation = isFlippedRef.current ? 0 : 180;

    const state = { rotation: startRotation };

    flipTweenRef.current?.kill();
    flipTweenRef.current = gsap.to(state, {
      rotation: endRotation,
      duration: 2.5,
      ease: "elastic.out(1, 0.4)",
      onUpdate: () => {
        if (!cardRef.current || !bannerRef.current || !backRef.current) return;
        
        const rotation = state.rotation;
        const radians = rotation * Math.PI / 180;
        const sinValue = Math.sin(radians);
        const scale = 1 - (0.12 * sinValue);
        
        cardRef.current.style.transform = `${rotAxis}(${rotation}deg) scale(${scale})`;
        
        // JS visibility toggle — required because front is semi-transparent (0.58 alpha)
        const normalizedRotation = ((rotation % 360) + 360) % 360;
        if (normalizedRotation < 90 || normalizedRotation > 270) {
          bannerRef.current.style.visibility = 'visible';
          backRef.current.style.visibility = 'hidden';
        } else {
          bannerRef.current.style.visibility = 'hidden';
          backRef.current.style.visibility = 'visible';
        }
      },
      onComplete: () => {
        isFlippedRef.current = !isFlippedRef.current;
        isAnimatingRef.current = false;
        rootRef.current?.classList.remove('kalkulator-flip-animating');
        setKalkulatorFlipOverflowLock(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollRuntime.requestRefresh('kalkulator-flip-end');
          });
        });

        if (!bannerRef.current || !backRef.current) return;
        
        // Set final visibility state
        if (isFlippedRef.current) {
          bannerRef.current.style.visibility = 'hidden';
          backRef.current.style.visibility = 'visible';
        } else {
          bannerRef.current.style.visibility = 'visible';
          backRef.current.style.visibility = 'hidden';
        }
        flipTweenRef.current = null;
      }
    });
  }, []);

  // Jeden listener resize: breakpoint layout (rAF) + oś flip gdy karta obrócona
  useEffect(() => {
    let resizeRafId = null;
    const applyScreenUpdate = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      if (newWidth !== lastWidthRef.current) {
        lastWidthRef.current = newWidth;
        setScreenSize({ w: newWidth, h: newHeight });
      }
    };
    const scheduleScreenUpdate = () => {
      if (resizeRafId !== null) return;
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        applyScreenUpdate();
      });
    };
    const handleFlipAxisOnResize = () => {
      if (isAnimatingRef.current || !isFlippedRef.current || !cardRef.current) return;
      const isMobileView = window.innerWidth < 1200;
      const rotAxis = isMobileView ? 'rotateY' : 'rotateX';
      const otherAxis = isMobileView ? 'rotateX' : 'rotateY';
      cardRef.current.style.transform = `${rotAxis}(180deg) ${otherAxis}(0deg) scale(1)`;
    };
    const onWindowResize = () => {
      scheduleScreenUpdate();
      handleFlipAxisOnResize();
    };
    applyScreenUpdate();
    const passiveResize = { passive: true };
    window.addEventListener('resize', onWindowResize, passiveResize);
    window.addEventListener('orientationchange', onWindowResize, passiveResize);
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener('resize', onWindowResize, passiveResize);
    }
    return () => {
      window.removeEventListener('resize', onWindowResize, passiveResize);
      window.removeEventListener('orientationchange', onWindowResize, passiveResize);
      if (vv) {
        vv.removeEventListener('resize', onWindowResize, passiveResize);
      }
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
        resizeRafId = null;
      }
    };
  }, []);

  const isLargeScreen = screenSize.w >= 1200;
  const isExtraLarge = screenSize.w >= 1500;
  const isMobile = screenSize.w > 0 && screenSize.w < 1200;
  const isSmallMobile = screenSize.w > 0 && screenSize.w < 800;
  const isVerySmallMobile = screenSize.w > 0 && screenSize.w < 500;
  const isTinyMobile = screenSize.w > 0 && screenSize.w < 400;
  const isMicroMobile = screenSize.w > 0 && screenSize.w < 315;
  const scaleFactor = screenSize.w < 290 ? 290 / 800 : isSmallMobile ? Math.max(0.65, screenSize.w / 800) : 1;
  
  const slider1Default = isLargeScreen ? 35 : 1;
  const slider2Default = isLargeScreen ? 490 : 10;
  
  const [slider1Value, setSlider1Value] = useState(slider1Default);
  const [slider2Value, setSlider2Value] = useState(slider2Default);
  const [input1Value, setInput1Value] = useState(formatNumber(slider1Default));
  const [input2Value, setInput2Value] = useState(formatNumber(slider2Default));

  const handleSlider1Change = useCallback((val) => { setSlider1Value(val); setInput1Value(formatNumber(val)); }, []);
  const handleSlider2Change = useCallback((val) => { setSlider2Value(val); setInput2Value(formatNumber(val)); }, []);
  
  const questionAlign = isLargeScreen ? 'left' : 'right';
  const mode = isAmbitious ? 'ambitious' : 'conservative';
  const rates = MODES[mode];
  const result1 = useMemo(() => calculateRevenue(slider2Value, slider1Value, rates.low), [slider2Value, slider1Value, rates.low]);
  const result2 = useMemo(() => calculateRevenue(slider2Value, slider1Value, rates.high), [slider2Value, slider1Value, rates.high]);
  const display1 = useMemo(() => (isMobile ? sharedPeriod : period1) === 'yearly' ? result1.yearly : result1.monthly, [result1, period1, sharedPeriod, isMobile]);
  const display2 = useMemo(() => (isMobile ? sharedPeriod : period2) === 'yearly' ? result2.yearly : result2.monthly, [result2, period2, sharedPeriod, isMobile]);

  const numberFontSize = useMemo(() => {
    const w = screenSize.w;
    if (w >= 1750) return '5.5rem';
    if (w >= 1500) {
      const scale = (w - 1500) / 250;
      return `${3.75 + scale * 1.75}rem`;
    }
    if (w >= 1200) return '3.75rem';
    if (w >= 900) return `${(3.5 + ((w - 700) / 500) * 0.25) * 1.6}rem`;
    if (w >= 700) return '4.6rem';
    if (w >= 600) return `${(1.8 + ((w - 313) / 387) * 1.7) * 1.25}rem`;
    if (w >= 500) return '3rem';
    if (w >= 400) return '2.4rem';
    if (w >= 350) return '2.2rem';
    if (w >= 313) return `${1.8 + ((w - 313) / 387) * 1.7}rem`;
    return '1.8rem';
  }, [screenSize.w]);

  const smallFontSize = useMemo(() => {
    if (!isMobile) return '1.1rem';
    if (screenSize.w >= 800) return '2rem';
    if (screenSize.w >= 520) return `${1.5 + ((screenSize.w - 520) / 280) * 0.5}rem`;
    if (screenSize.w >= 270) return `${0.715 + ((screenSize.w - 270) / 250) * 0.785}rem`;
    return '0.715rem';
  }, [screenSize.w, isMobile]);

  const font = "'Lexend', sans-serif";
  const fontSize = { label: 'clamp(1.1rem, 1.45vw, 1.5rem)', small: screenSize.w < 290 ? '0.715rem' : (isMobile ? `${1.1 * scaleFactor}rem` : '1.2rem'), question: smallFontSize, badge: 'clamp(0.625rem, 1vw, 1rem)', number: numberFontSize };
  const accentColor = isAmbitious ? '#f47225' : '#28a745';
  const accentGradient = isAmbitious ? 'linear-gradient(135deg, #f47225, #d63e08)' : 'linear-gradient(135deg, #28a745, #1e7e34)';
  const dotGradient = isAmbitious ? 'radial-gradient(circle at 30% 30%, #ffad7a 0%, #f47225 50%, #d63e08 100%)' : 'radial-gradient(circle at 30% 30%, #7ddf90 0%, #28a745 50%, #1e7e34 100%)';
  const dotShadow = isAmbitious ? 'inset 0.5px 0.5px 1px rgba(255, 255, 255, 1), 0 2px 4px rgba(214, 62, 8, 0.4)' : 'inset 0.5px 0.5px 1px rgba(255, 255, 255, 1), 0 2px 4px rgba(30, 126, 52, 0.4)';
  const gap = { headerToContent: '-0.5rem', sectionGap: '3rem' };

  const D = {
    screen: '#e74c3c', banner: '#3498db', grid: '#2ecc71', topControls: '#9b59b6',
    q1Desktop: '#e67e22', header1: '#f39c12', q1Mobile: '#d35400', slider1: '#1abc9c', result1: '#16a085',
    q2Desktop: '#c0392b', header2: '#e91e63', q2Mobile: '#ff5722', slider2: '#00bcd4', result2: '#009688',
    mobileToggles: '#8e44ad', mobileSource: '#34495e', emptyCell: '#7f8c8d', desktopBottom: '#2c3e50',
  };

  const dbg = (color) => showDebug ? `3px dashed ${color}` : 'none';

  const dotKeyframes = useMemo(() => `
    @keyframes kalkulator-dotMove {
      0% { transform: translate3d(${centerX + rangeX}vw, ${centerY}%, 0) translate(-50%, -50%); }
      12.5% { transform: translate3d(${centerX + rangeX * Math.cos(Math.PI / 4)}vw, ${centerY + rangeY * Math.sin(Math.PI / 4)}%, 0) translate(-50%, -50%); }
      25% { transform: translate3d(${centerX}vw, ${centerY + rangeY}%, 0) translate(-50%, -50%); }
      37.5% { transform: translate3d(${centerX + rangeX * Math.cos(3 * Math.PI / 4)}vw, ${centerY + rangeY * Math.sin(3 * Math.PI / 4)}%, 0) translate(-50%, -50%); }
      50% { transform: translate3d(${centerX - rangeX}vw, ${centerY}%, 0) translate(-50%, -50%); }
      62.5% { transform: translate3d(${centerX + rangeX * Math.cos(5 * Math.PI / 4)}vw, ${centerY + rangeY * Math.sin(5 * Math.PI / 4)}%, 0) translate(-50%, -50%); }
      75% { transform: translate3d(${centerX}vw, ${centerY - rangeY}%, 0) translate(-50%, -50%); }
      87.5% { transform: translate3d(${centerX + rangeX * Math.cos(7 * Math.PI / 4)}vw, ${centerY + rangeY * Math.sin(7 * Math.PI / 4)}%, 0) translate(-50%, -50%); }
      100% { transform: translate3d(${centerX + rangeX}vw, ${centerY}%, 0) translate(-50%, -50%); }
    }
  `, [centerX, centerY, rangeX, rangeY]);

  return (
    <div id="kalkulator-section" ref={rootRef} className={`min-h-screen w-full flex items-center justify-center p-4${!sectionInView ? ' kalkulator-section--offscreen' : ''}`} style={{ backgroundColor: '#f7f6f4', outline: dbg(D.screen), position: 'relative', isolation: 'isolate' }}>
      <DebugLabel show={showDebug} name="SCREEN" color={D.screen} />
      
      {/* PERSPECTIVE WRAPPER */}
      <div style={{ perspective: '1200px', width: 'min(92vw, 1750px)' }}>
        {/* CARD WRAPPER - 3D transform container */}
        <div ref={cardRef} style={{ 
          position: 'relative', 
          width: '100%', 
          height: isMobile ? 'auto' : '650px',
          minHeight: isMobile ? '50vh' : 'auto',
          transformStyle: 'preserve-3d',
        }}>
          {/* FRONT - Original calculator */}
          <div 
            ref={bannerRef}
            onMouseMove={!isMobile ? handleMouseMove : undefined}
            style={{ 
            width: '100%', 
        minHeight: isMobile ? '50vh' : 'auto', 
        height: isMobile ? 'auto' : '650px', 
        background: 'rgba(255, 255, 255, 0.58)', 
        borderRadius: '2rem', 
        display: 'flex', 
        justifyContent: 'center', 
        paddingTop: isMobile ? '2rem' : 'clamp(5.75rem, 7.25vw, 7.25rem)', 
        paddingBottom: isMobile ? '0' : 'clamp(3rem, 5vw, 5rem)', 
        paddingLeft: isTinyMobile ? '0.5rem' : 'clamp(2rem, 5vw, 8rem)', 
        paddingRight: isTinyMobile ? '0.5rem' : 'clamp(1rem, 2.5vw, 4rem)', 
        position: 'relative', 
        outline: dbg(D.banner), 
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.45)',
        boxShadow: isMobile ? '0 25px 60px -15px rgba(0,0,0,0.09)' : '0 45px 100px -25px rgba(0,0,0,0.09)',
        backdropFilter: 'saturate(135%)',
        WebkitBackdropFilter: 'saturate(135%)',
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        maskImage: '-webkit-radial-gradient(white, black)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        '--x': '50%',
        '--y': '50%',
      }}>
        <DebugLabel show={showDebug} name="BANNER" color={D.banner} />
        
        {isLargeScreen && (
          <>
            <style>{dotKeyframes}</style>
            <div
              data-kalkulator-dot
              style={{ 
              position: 'absolute', 
              width: `${dotSize}px`, 
              height: `${dotSize}px`, 
              background: `radial-gradient(circle, #ffffff ${whiteStop}%, transparent ${transparentStop}%)`, 
              borderRadius: '50%', 
              left: 0,
              top: 0,
              animation: `kalkulator-dotMove ${duration}s linear infinite`, 
              pointerEvents: 'none', 
              zIndex: 1, 
              opacity: 1,
              willChange: 'transform'
            }} />
          </>
        )}
        
        {isLargeScreen && <DesktopBackgroundEffects />}
        {isMobile && <MobileBackgroundEffects />}
        
        {!isMobile && (
          <div style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0, left: 0,
            borderRadius: '2rem',
            background: 'radial-gradient(700px circle at var(--x) var(--y), rgba(255,255,255,0.95), transparent 50%)',
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
            zIndex: 1,
            willChange: 'background',
          }} />
        )}
        
        {!isMobile && (
          <div style={{ position: 'absolute', top: '35px', right: '4rem', display: 'flex', alignItems: 'center',  outline: dbg(D.topControls), zIndex: 10 }}>
            <DebugLabel show={showDebug} name="TOP-CONTROLS" color={D.topControls} />
            <div className={`toggle-container-15x ${isAmbitious ? 'state-ambitious' : ''}`} style={{ width: '300px', height: '33px', borderRadius: '16.5px', position: 'relative', cursor: 'pointer', display: 'flex', userSelect: 'none', backgroundColor: '#e6e4e2', boxShadow: 'inset 2px 2px 6px rgba(163, 177, 198, 0.25), inset -2px -2px 6px rgba(255, 255, 255, 0.8), 0 2px 4px rgba(0,0,0,0.02)', border: '1px solid rgba(255,255,255,0.4)', overflow: 'hidden', WebkitTapHighlightColor: 'transparent' }} onClick={(e) => { setIsAmbitious(!isAmbitious); const pill = e.currentTarget.querySelector('.desktop-pill'); if (pill) { pill.classList.remove('anim-right', 'anim-left'); void pill.offsetWidth; pill.classList.add(!isAmbitious ? 'anim-right' : 'anim-left'); } }}>
              <div className="toggle-pill desktop-pill" style={{ position: 'absolute', top: '4px', height: 'calc(100% - 8px)', left: '4px', width: '146px', background: '#ffffff', borderRadius: '12.5px', border: '1px solid rgba(255, 255, 255, 0.9)', borderBottomColor: 'rgba(0, 0, 0, 0.05)', borderRightColor: 'rgba(0, 0, 0, 0.04)', boxShadow: '0 2px 6px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255, 255, 255, 1)', zIndex: 1 }} />
              <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', zIndex: 10, pointerEvents: 'none', top: 0, left: 0 }}>
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 500, letterSpacing: '-0.01em', color: isAmbitious ? 'rgba(20, 20, 20, 0.75)' : '#28a745', textShadow: !isAmbitious ? '0 1px 2px rgba(255,255,255,0.8)' : 'none', transition: 'color 0.3s ease', whiteSpace: 'nowrap', fontFamily: font }}>Model ostrożny</span>
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 500, letterSpacing: '-0.01em', color: isAmbitious ? '#e06c38' : 'rgba(20, 20, 20, 0.75)', textShadow: isAmbitious ? '0 1px 2px rgba(255,255,255,0.8)' : 'none', transition: 'color 0.3s ease', whiteSpace: 'nowrap', fontFamily: font }}>Model ambitny</span>
              </div>
            </div>
            <SourceButton font={font} onFlip={handleFlip} />
          </div>
        )}

        <div style={{ width: '100%', maxWidth: '1600px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (isExtraLarge ? '600px 1fr' : 'minmax(280px, 1fr) 660px'), overflow: 'visible', columnGap: isMobile ? 'clamp(1rem, 3vw, 4rem)' : '0', outline: dbg(D.grid), position: 'relative', zIndex: 2 }}>
          <DebugLabel show={showDebug} name="GRID" color={D.grid} />
          
          {/* [OPT-3] Memoized static question label */}
          {!isMobile && (
            <DesktopQuestionLabel1 font={font} fontSize={fontSize.label} questionAlign={questionAlign} dbg={dbg} D={D} showDebug={showDebug} />
          )}
          
          <div className="flex items-center" style={{  marginTop: isMobile ? 0 : '3.125rem', marginBottom: isMobile ? '0.75rem' : gap.headerToContent, transform: isMobile ? 'none' : 'translateY(clamp(-1.5rem, -0.5vw, 0rem))', order: isMobile ? 1 : 'unset', outline: dbg(D.header1), position: 'relative' }}>
            <DebugLabel show={showDebug} name="HEADER-1" color={D.header1} />
            <span style={{ fontFamily: font, fontSize: fontSize.small, color: '#333', flex: 1, textAlign: 'right', lineHeight: isMobile ? 1.1 : 1.5 }}><span style={{ fontWeight: 700 }}>Dodatkowy zysk</span>{isMicroMobile ? <br /> : null}<span style={{ fontWeight: 500 }}> z konwersji wyższej o</span></span>
            <div style={{ width: isMobile ? 'auto' : '130px', display: 'flex', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
              <span className="inline-flex items-center justify-center rounded-full transition-all duration-300" style={{ background: accentGradient, color: '#fff', fontFamily: font, fontWeight: 600, fontSize: fontSize.badge, width: 'clamp(38px, 3vw, 55px)', height: 'clamp(20px, 1.6vw, 28px)', lineHeight: 1 }}>{rates.low * 100}%</span>
            </div>
          </div>

          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', order: 6, marginTop: '1rem', marginBottom: '0.75rem', outline: dbg(D.q1Mobile), position: 'relative' }}>
              <DebugLabel show={showDebug} name="Q1-MOBILE" color={D.q1Mobile} />
              <p style={{ color: '#000000', fontFamily: font, fontWeight: 500, fontSize: fontSize.question, lineHeight: 1.3, textAlign: 'left', margin: 0, flex: 1, minWidth: 0, marginLeft: '0.5rem' }}>{isVerySmallMobile ? <>Średni zysk<br />z klienta?</> : 'Średni zysk z klienta?'}</p>
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: '8px' }}>
                <input type="text" inputMode="numeric" pattern="[0-9\s]*" value={input1Value} onChange={(e) => setInput1Value(e.target.value)} onFocus={(e) => safeScrollIntoView(e.target)} onBlur={() => { let val = parseFloat(input1Value.replace(/\s/g, '').replace(/,/g, '.')); if (isNaN(val)) val = 1; if (val > 50000) val = 50000; if (val < 1) val = 1; setInput1Value(formatNumber(Math.round(val))); setSlider1Value(Math.round(val)); }} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} style={{ background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: `${8 * scaleFactor}px`, padding: `${8 * scaleFactor}px ${12 * scaleFactor}px`, fontSize: `max(16px, ${1.3 * scaleFactor}rem)`, fontWeight: 700, textAlign: 'right', color: '#141414', outline: 'none', width: `${110 * scaleFactor}px`, fontFamily: font, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', WebkitTapHighlightColor: 'transparent' }} />
                <span style={{ fontFamily: font, fontWeight: 700, fontSize: `${1.45 * scaleFactor}rem`, color: '#888', marginLeft: `${8 * scaleFactor}px` }}>PLN</span>
              </div>
            </div>
          )}

          <div className="flex items-center" style={{ order: isMobile ? 7 : 'unset', outline: dbg(D.slider1), position: 'relative' }}>
            <DebugLabel show={showDebug} name="SLIDER-1" color={D.slider1} />
            <div style={{ marginRight: isLargeScreen ? '2%' : 0, width: '100%' }}>
              <PremiumSlider key={`slider1-${isLargeScreen}`} min={1} max={50000} defaultValue={slider1Default} unit="PLN" onChange={handleSlider1Change} isMobile={isMobile} inputValue={input1Value} setInputValue={setInput1Value} scaleFactor={scaleFactor} />
            </div>
          </div>
          
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', order: isMobile ? 2 : 'unset', paddingRight: isMobile ? '0' : '140px', outline: dbg(D.result1) }}>
            <DebugLabel show={showDebug} name="RESULT-1" color={D.result1} />
            <div style={{ fontFamily: font, lineHeight: 1.1, textAlign: 'right', display: 'flex', alignItems: isMobile ? 'flex-end' : 'baseline', justifyContent: 'flex-end',  }}>
              <AnimatedNumberGSAP value={display1} accentColor={accentColor} fontSize={fontSize.number} sectionInView={sectionInView} />
              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginLeft: '0.5em',  height: fontSize.number }}>
                  <span style={{ fontSize: `calc(${fontSize.number} * 0.48)`, fontWeight: 600, color: '#141414', lineHeight: 0.85, letterSpacing: '0.08em' }}>PLN</span>
                  <span style={{ fontSize: `calc(${fontSize.number} * 0.2)`, fontWeight: 600, color: '#141414', lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sharedPeriod === 'yearly' ? 'Rocznie' : 'Miesiąc'}</span>
                </div>
              ) : (
                <span style={{ fontSize: fontSize.number, fontWeight: 600, color: '#141414', marginLeft: '0.5em' }}>PLN</span>
              )}
            </div>
            {!isMobile && (<div style={{ position: 'absolute', right: '-8px', top: '50%', transform: 'translateY(-50%)' }}><RadioGroup value={period1} onChange={setPeriod1} dotGradient={dotGradient} dotShadow={dotShadow} font={font} /></div>)}
          </div>

          {/* [OPT-3] Memoized separator */}
          <SeparatorLine isMobile={isMobile} isExtraLarge={isExtraLarge} />

          {/* [OPT-3] Memoized static question label */}
          {!isMobile && (
            <DesktopQuestionLabel2 font={font} fontSize={fontSize.label} questionAlign={questionAlign} dbg={dbg} D={D} showDebug={showDebug} />
          )}
          
          <div className="flex items-center" style={{  marginTop: isMobile ? '1rem' : '0.25rem', marginBottom: isMobile ? '0.75rem' : gap.headerToContent, transform: isMobile ? 'none' : 'translateY(clamp(-1.5rem, -0.5vw, 0rem))', order: isMobile ? 3 : 'unset', outline: dbg(D.header2), position: 'relative' }}>
            <DebugLabel show={showDebug} name="HEADER-2" color={D.header2} />
            <span style={{ fontFamily: font, fontSize: fontSize.small, color: '#333', flex: 1, textAlign: 'right', lineHeight: isMobile ? 1.1 : 1.5 }}><span style={{ fontWeight: 700 }}>Dodatkowy zysk</span>{isMicroMobile ? <br /> : null}<span style={{ fontWeight: 500 }}> z konwersji wyższej o</span></span>
            <div style={{ width: isMobile ? 'auto' : '130px', display: 'flex', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
              <span className="inline-flex items-center justify-center rounded-full transition-all duration-300" style={{ background: accentGradient, color: '#fff', fontFamily: font, fontWeight: 600, fontSize: fontSize.badge, width: 'clamp(38px, 3vw, 55px)', height: 'clamp(20px, 1.6vw, 28px)', lineHeight: 1 }}>{rates.high * 100}%</span>
            </div>
          </div>

          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', order: 8, marginTop: '1.5rem', marginBottom: '0.75rem', outline: dbg(D.q2Mobile), position: 'relative' }}>
              <DebugLabel show={showDebug} name="Q2-MOBILE" color={D.q2Mobile} />
              <p style={{ color: '#000000', fontFamily: font, fontWeight: 500, fontSize: fontSize.question, lineHeight: 1.3, textAlign: 'left', margin: 0, flex: 1, minWidth: 0, marginLeft: '0.5rem' }}>{isVerySmallMobile ? <>Ile osób odwiedza<br />stronę miesięcznie?</> : 'Ile osób odwiedza stronę miesięcznie?'}</p>
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: '8px' }}>
                <input type="text" inputMode="numeric" pattern="[0-9\s]*" value={input2Value} onChange={(e) => setInput2Value(e.target.value)} onFocus={(e) => safeScrollIntoView(e.target)} onBlur={() => { let val = parseFloat(input2Value.replace(/\s/g, '').replace(/,/g, '.')); if (isNaN(val)) val = 10; if (val > 9000) val = 9000; if (val < 10) val = 10; setInput2Value(formatNumber(Math.round(val))); setSlider2Value(Math.round(val)); }} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} style={{ background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: `${8 * scaleFactor}px`, padding: `${8 * scaleFactor}px ${12 * scaleFactor}px`, fontSize: `max(16px, ${1.3 * scaleFactor}rem)`, fontWeight: 700, textAlign: 'right', color: '#141414', outline: 'none', width: `${110 * scaleFactor}px`, fontFamily: font, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', WebkitTapHighlightColor: 'transparent' }} />
                <span style={{ fontFamily: font, fontWeight: 700, fontSize: `${1.45 * scaleFactor}rem`, color: '#888', marginLeft: `${8 * scaleFactor}px` }}>os.</span>
              </div>
            </div>
          )}

          <div className="flex items-center" style={{ order: isMobile ? 9 : 'unset', outline: dbg(D.slider2), position: 'relative' }}>
            <DebugLabel show={showDebug} name="SLIDER-2" color={D.slider2} />
            <div style={{ marginRight: isLargeScreen ? '2%' : 0, width: '100%' }}>
              <PremiumSlider key={`slider2-${isLargeScreen}`} min={10} max={9000} defaultValue={slider2Default} unit="os." onChange={handleSlider2Change} isMobile={isMobile} inputValue={input2Value} setInputValue={setInput2Value} scaleFactor={scaleFactor} />
            </div>
          </div>
          
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', order: isMobile ? 4 : 'unset', paddingRight: isMobile ? '0' : '140px', outline: dbg(D.result2) }}>
            <DebugLabel show={showDebug} name="RESULT-2" color={D.result2} />
            <div style={{ fontFamily: font, lineHeight: 1.1, textAlign: 'right', display: 'flex', alignItems: isMobile ? 'flex-end' : 'baseline', justifyContent: 'flex-end',  }}>
              <AnimatedNumberGSAP value={display2} accentColor={accentColor} fontSize={fontSize.number} sectionInView={sectionInView} />
              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginLeft: '0.5em',  height: fontSize.number }}>
                  <span style={{ fontSize: `calc(${fontSize.number} * 0.48)`, fontWeight: 600, color: '#141414', lineHeight: 0.85, letterSpacing: '0.08em' }}>PLN</span>
                  <span style={{ fontSize: `calc(${fontSize.number} * 0.2)`, fontWeight: 600, color: '#141414', lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sharedPeriod === 'yearly' ? 'Rocznie' : 'Miesiąc'}</span>
                </div>
              ) : (
                <span style={{ fontSize: fontSize.number, fontWeight: 600, color: '#141414', marginLeft: '0.5em' }}>PLN</span>
              )}
            </div>
            {!isMobile && (<div style={{ position: 'absolute', right: '-8px', top: '50%', transform: 'translateY(-50%)' }}><RadioGroup value={period2} onChange={setPeriod2} dotGradient={dotGradient} dotShadow={dotShadow} font={font} /></div>)}
          </div>

          {isMobile && (
            <div style={{ order: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '1.5rem', paddingBottom: '2rem', marginTop: '1rem', flexWrap: 'wrap', outline: dbg(D.mobileToggles), position: 'relative' }}>
              <DebugLabel show={showDebug} name="MOBILE-TOGGLES" color={D.mobileToggles} />
              <div className={`toggle-container-15x ${isAmbitious ? 'state-ambitious' : ''}`} style={{ width: '230px', height: '26px', borderRadius: '13px', position: 'relative', cursor: 'pointer', display: 'flex', userSelect: 'none', backgroundColor: '#e6e4e2', boxShadow: 'inset 2px 2px 6px rgba(163, 177, 198, 0.25), inset -2px -2px 6px rgba(255, 255, 255, 0.8), 0 2px 4px rgba(0,0,0,0.02)', border: '1px solid rgba(255,255,255,0.4)', overflow: 'hidden', WebkitTapHighlightColor: 'transparent' }} onClick={(e) => { setIsAmbitious(!isAmbitious); const pill = e.currentTarget.querySelector('.mobile-pill'); if (pill) { pill.classList.remove('anim-right-mobile', 'anim-left-mobile'); void pill.offsetWidth; pill.classList.add(!isAmbitious ? 'anim-right-mobile' : 'anim-left-mobile'); } }}>
                <div className="toggle-pill mobile-pill" style={{ position: 'absolute', top: '3px', height: 'calc(100% - 6px)', left: '3px', width: '112px', background: '#ffffff', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.9)', borderBottomColor: 'rgba(0, 0, 0, 0.05)', borderRightColor: 'rgba(0, 0, 0, 0.04)', boxShadow: '0 2px 6px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255, 255, 255, 1)', zIndex: 1 }} />
                <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', zIndex: 10, pointerEvents: 'none', top: 0, left: 0 }}>
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 500, letterSpacing: '-0.01em', color: isAmbitious ? 'rgba(20, 20, 20, 0.75)' : '#28a745', textShadow: !isAmbitious ? '0 1px 2px rgba(255,255,255,0.8)' : 'none', transition: 'color 0.3s ease', whiteSpace: 'nowrap', fontFamily: font }}>Model ostrożny</span>
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 500, letterSpacing: '-0.01em', color: isAmbitious ? '#e06c38' : 'rgba(20, 20, 20, 0.75)', textShadow: isAmbitious ? '0 1px 2px rgba(255,255,255,0.8)' : 'none', transition: 'color 0.3s ease', whiteSpace: 'nowrap', fontFamily: font }}>Model ambitny</span>
                </div>
              </div>
              <div style={{ width: '190px', height: '26px', borderRadius: '13px', position: 'relative', cursor: 'pointer', display: 'flex', userSelect: 'none', backgroundColor: '#e6e4e2', boxShadow: 'inset 2px 2px 6px rgba(163, 177, 198, 0.25), inset -2px -2px 6px rgba(255, 255, 255, 0.8), 0 2px 4px rgba(0,0,0,0.02)', border: '1px solid rgba(255,255,255,0.4)', overflow: 'hidden', WebkitTapHighlightColor: 'transparent' }} onClick={(e) => { const newPeriod = sharedPeriod === 'yearly' ? 'monthly' : 'yearly'; setSharedPeriod(newPeriod); const pill = e.currentTarget.querySelector('.period-pill'); if (pill) { pill.classList.remove('anim-right-period', 'anim-left-period'); void pill.offsetWidth; pill.classList.add(newPeriod === 'monthly' ? 'anim-right-period' : 'anim-left-period'); } }}>
                <div className="toggle-pill period-pill" style={{ position: 'absolute', top: '3px', height: 'calc(100% - 6px)', left: '3px', width: '92px', background: '#ffffff', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.9)', borderBottomColor: 'rgba(0, 0, 0, 0.05)', borderRightColor: 'rgba(0, 0, 0, 0.04)', boxShadow: '0 2px 6px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255, 255, 255, 1)', zIndex: 1 }} />
                <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', zIndex: 10, pointerEvents: 'none', top: 0, left: 0 }}>
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 500, letterSpacing: '-0.01em', color: sharedPeriod === 'yearly' ? '#28a745' : 'rgba(20, 20, 20, 0.75)', textShadow: sharedPeriod === 'yearly' ? '0 1px 2px rgba(255,255,255,0.8)' : 'none', transition: 'color 0.3s ease', whiteSpace: 'nowrap', fontFamily: font }}>Rocznie</span>
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 500, letterSpacing: '-0.01em', color: sharedPeriod === 'monthly' ? '#e06c38' : 'rgba(20, 20, 20, 0.75)', textShadow: sharedPeriod === 'monthly' ? '0 1px 2px rgba(255,255,255,0.8)' : 'none', transition: 'color 0.3s ease', whiteSpace: 'nowrap', fontFamily: font }}>Miesięcznie</span>
                </div>
              </div>
              <SourceButton font={font} isMobile={true} onFlip={handleFlip} />
            </div>
          )}

          <div style={{ display: isMobile ? 'none' : 'block' }} />
          <div style={{ marginTop: '2rem', display: isMobile ? 'none' : 'block' }} />
        </div>
      </div>
      
      {/* BACK - inside cardRef for 3D transform */}
      <BacksideContent backRef={backRef} onFlipBack={handleFlip} />
      
        </div>
      </div>
    </div>
  );
}
