// @ts-nocheck — plik z Fabryki bez pełnych typów; odblokowuje build (Vercel/tsc)
'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { scrollRuntime } from '@/lib/scrollRuntime';
import './hero-section.css';

// Lottie: dynamic import (client-only) — unikamy "document is not defined" przy SSR
const getLottie = () => import('lottie-web').then((m) => m.default);

// ═══════════════════════════════════════════════════════════════════════════
// HERO SECTION — Fabryka P3 Konwersja
// Typ: B (per-frame rendering: trail.tick, pendulum.update, halo.rAF)
// hasPin: false | hasSnap: false | hasScrollTrigger: false
// ═══════════════════════════════════════════════════════════════════════════

function heroSectionInit(container: HTMLElement | null) {
    if (!container) return { pause: () => {}, resume: () => {}, kill: () => {} };

    const heroInitT0 = performance.now(); // timestamp for deferred systems

    // ─── HAAT TIER COPY (head script → container) ─────────────────
    // Head script ustawia tiery na <html> pre-render. CSS teraz szuka
    // atrybutów na #hero-section, więc kopiujemy je z html na container.
    ['data-h1-tier', 'data-desc-tier'].forEach(attr => {
        const v = document.documentElement.getAttribute(attr);
        if (v) container.setAttribute(attr, v);
    });

    // ─── HELPERS (container-scoped) ─────────────────────────────────
    const $ = (sel: string) => container.querySelector(sel);
    const $$ = (sel: string) => container.querySelectorAll(sel);
    const $id = (id: string) => container.querySelector('#' + id);
    // getScroll helper removed — use scrollRuntime.getScroll()
    // getRawScroll helper removed — use scrollRuntime.getRawScroll()

    // ─── TRACKING ARRAYS ────────────────────────────────────────────
    const cleanups = [];
    const gsapInstances = [];
    const timerIds = [];
    const observersList = [];

    // ─── INTER-MODULE COMMUNICATION (replaces window.* bus) ────────
    let badge20LatKill, badge20LatReplay;
    let badgeGoogleKill, badgeGoogleRevive;
    let haloKillFn, haloReviveFn;
    let marqueeStop = null, marqueeStart = null;

    // ─── TRACKED HELPERS ────────────────────────────────────────────
    function listen(target, event, handler, options) {
        target.addEventListener(event, handler, options);
        cleanups.push(() => target.removeEventListener(event, handler, options));
    }

    function trackedTimeout(fn, delay) {
        const id = setTimeout(fn, delay);
        timerIds.push({ type: 'timeout', id });
        return id;
    }

    function trackGsap(inst) {
        if (inst) gsapInstances.push(inst);
        return inst;
    }

    function trackObserver(obs) {
        if (obs) observersList.push(obs);
        return obs;
    }

    // ─── TYP B: TICKER / HF LISTENER TRACKING ──────────────────────
    const tickFns = [];
    const hfListeners = [];

    function addTickFn(fn) {
        tickFns.push(fn);
        gsap.ticker.add(fn);
    }

    function addHfListener(target, event, handler, options) {
        hfListeners.push({ target, event, handler, options });
        target.addEventListener(event, handler, options);
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 2: MAIN (gradient, blob-mask, orchestrator, badges, HAAT phase 2)
    // ═════════════════════════════════════════════════════════════════
    {
/* ==========================================================================
   SCRIPT BLOCK #2 — MAIN (po gsap.min.js CDN)
   Cleanup: usunięto C1 (fitsInBox), C2 (h1Changed/descChanged), C7 (resInfo)
   Bloki 1 (HEAD HAAT), 3 (Lottie), 4 (Marquee), 5 (Trail), 6 (Mobile BG) — BEZ ZMIAN
   ========================================================================== */

/* ==========================================================================
   DETEKCJA WSPARCIA PRZEGLĄDARKI
   ========================================================================== */

function supportsPremiumGradient() {
    const oklch = CSS.supports("color", "oklch(0.6 0.3 30)");
    const conic = CSS.supports("background-image", "conic-gradient(from 0deg, red, blue)");
    const mask = CSS.supports("mask-image", "radial-gradient(circle, #000 0%, transparent 70%)") ||
                 CSS.supports("-webkit-mask-image", "radial-gradient(circle, #000 0%, transparent 70%)");
    const prop = typeof CSS.registerProperty === 'function';
    return oklch && conic && mask && prop;
}

function supportsDownfall() {
    return CSS.supports("color", "color-mix(in oklab, red 50%, blue)");
}

const FX_PREMIUM = supportsPremiumGradient();
const FX_DOWNFALL = !FX_PREMIUM && supportsDownfall();

// Aktualny tryb (można przełączać do testów)
let currentMode = FX_PREMIUM ? 'premium' : (FX_DOWNFALL ? 'downfall' : 'none');

// Dodaj klasę do sekcji (scoped)
container.classList.toggle("fx-premium-active", currentMode === 'premium');

/* ==========================================================================
   ELEMENTY DOM
   ========================================================================== */

const root = document.documentElement;
const startupGradient = $('.startup-gradient');
const burstContainer = $id('hero-burstContainer');

let fadeOutTimeout = null;
let colorBlobsTimeout = null;
let gradientSafetyKill = null;

/* ==========================================================================
   SAFETY TIMER (Patch B)
   ========================================================================== */

function cssTimeToMs(v) {
    v = (v || '').trim();
    if (v.endsWith('ms')) return parseFloat(v);
    if (v.endsWith('s')) return parseFloat(v) * 1000;
    return 5000;
}

function scheduleGradientAutoFade() {
    if (!startupGradient && !burstContainer) return;
    clearTimeout(gradientSafetyKill);
    
    const dur = cssTimeToMs(getComputedStyle(container).getPropertyValue('--anim-duration') || '5s');
    
    gradientSafetyKill = trackedTimeout(() => {
        // Premium gradient fade-out
        if (currentMode === 'premium' && startupGradient) {
            startupGradient.style.willChange = "auto";
            startupGradient.style.transition = "opacity 3s ease-out";
            startupGradient.style.opacity = "0";
            
            trackedTimeout(() => {
                startupGradient.classList.remove("animate");
                startupGradient.style.visibility = "hidden";
                startupGradient.style.transition = "";
                startupGradient.style.opacity = "";
            }, 3000);
        }
        
        // DOWNFALL nie wymaga cleanup - animacja sama się kończy
    }, dur + 50);
}

/* ==========================================================================
   GRADIENT CONTROL
   ========================================================================== */

function stopGradient() {
    // Clear safety timer
    clearTimeout(gradientSafetyKill);
    gradientSafetyKill = null;
    
    if (fadeOutTimeout) {
        clearTimeout(fadeOutTimeout);
        fadeOutTimeout = null;
    }
    
    // Stop Premium
    if (startupGradient) {
        startupGradient.style.transition = "none";
        startupGradient.style.opacity = "0";
        startupGradient.style.visibility = "hidden";
        startupGradient.style.willChange = "auto";
        startupGradient.classList.remove("animate");
    }
    
    // Stop DOWNFALL
    if (burstContainer) {
        burstContainer.classList.remove("animate");
    }
}

function startGradient() {
    if (currentMode === 'premium' && startupGradient) {
        // Premium gradient
        startupGradient.style.visibility = "hidden";
        startupGradient.style.opacity = "0";
        startupGradient.style.transition = "none";
        startupGradient.style.willChange = "mask-image, background-image, --hero-radial-center, --conic-rotate";
        
        void startupGradient.offsetWidth;
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                startupGradient.style.transition = "";
                startupGradient.style.visibility = "visible";
                startupGradient.style.opacity = "";
                startupGradient.classList.add("animate");
            });
        });
    } else if (currentMode === 'downfall' && burstContainer) {
        // DOWNFALL gradient
        burstContainer.classList.remove("animate");
        void burstContainer.offsetWidth;
        burstContainer.classList.add("animate");
    }
    // Jeśli 'none' - nic się nie dzieje (czyste tło)
}

// Auto-kill premium gradient po zakończeniu animacji
if (startupGradient) {
    startupGradient.addEventListener('animationend', (e) => {
        if (e.animationName === 'hero-gradient-expand') {
            // Clear safety timer - nie potrzebny
            clearTimeout(gradientSafetyKill);
            gradientSafetyKill = null;
            
            startupGradient.style.willChange = "auto";
            startupGradient.style.transition = "opacity 3s ease-out";
            startupGradient.style.opacity = "0";
            
            fadeOutTimeout = trackedTimeout(() => {
                startupGradient.classList.remove("animate");
                startupGradient.style.visibility = "hidden";
                startupGradient.style.transition = "";
                startupGradient.style.opacity = "";
            }, 3000);
        }
    });
}

/* ==========================================================================
   BLOBY
   ========================================================================== */

function hideBlobs() {
    if (colorBlobsTimeout) clearTimeout(colorBlobsTimeout);
}

function showBlobsSequence() {
    // blob-cta removed
}

/* ==========================================================================
   MAIN ENTRY SEQUENCE (ORCHESTRATOR)
   playEntrySequence() → stopGradient → hideBlobs → 50ms → showBlobsSequence
   → startGradient → scheduleGradientAutoFade → badge20LatReplay
   SEKWENCJA MUSI POZOSTAĆ NIENARUSZONA
   ========================================================================== */

function playEntrySequence() {
    stopGradient();
    hideBlobs();
    
    trackedTimeout(() => {
        showBlobsSequence();
        
        // Rozbłysk gradient - delay 0s
        trackedTimeout(() => {
            startGradient();
            scheduleGradientAutoFade();
        }, 0);
        
        // Badge 20 Lat - GSAP kontroluje delay wewnętrznie
        if (badge20LatReplay) {
            badge20LatReplay();
        }
    }, 50);
}

// Init
playEntrySequence();

/* C7 REMOVED: Resolution info (updateRes, resInfo, resize listener)
   Powiązane z DOM element A2 (.resolution-info / #resInfo) — usunięty razem */

// ═══════════════════════════════════════════════════════════════════════════
// BADGE 20 LAT — WERSJA KULOODPORNA
// 
// Implementuje:
// ✓ FAZA 1A: Timeline Discipline (kill duplicates, overwrite)
// ✓ FAZA 1B: Cleanup on page hide
// ✓ FAZA 1C: Touch Guard (hasHover detection, tap + auto-timeout)
// ═══════════════════════════════════════════════════════════════════════════
(function() {
    'use strict';
    
    if (typeof gsap === 'undefined') return;
    
    // ─────────────────────────────────────────────────────────────────────────
    // DOM ELEMENTS
    // ─────────────────────────────────────────────────────────────────────────
    const wrapper = $('.badge-20lat-wrapper');
    const svg = $('.badge-20lat-wrapper .rotating-svg');
    const badge = $('.badge-20lat');
    const number = $('.badge-20lat .number-20');
    const label = $('.badge-20lat-wrapper .label-lat');
    const textTop = $('.badge-20lat-wrapper .rotating-text.text-top');
    const textBottom = $('.badge-20lat-wrapper .rotating-text.text-bottom');
    
    if (!wrapper || !svg || !badge || !number || !label) return;
    
    // ─────────────────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────────────────
    let pendulum = null;
    let timeScaleController = null;
    let hoverTweens = [];
    let isEntryComplete = false;
    let isHoverActive = false;
    let autoCloseTimer = null;
    const MOBILE_HOVER_DURATION = 2500;
    
    // Touch Guard: Detect hover capability
    const hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    
    // ─────────────────────────────────────────────────────────────────────────
    // HELPER: Kill hover tweens
    // ─────────────────────────────────────────────────────────────────────────
    function killHoverTweens() {
        hoverTweens.forEach(tween => tween?.kill?.());
        hoverTweens = [];
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // HELPER: Kill all animations
    // ─────────────────────────────────────────────────────────────────────────
    function killAllAnimations() {
        pendulum?.kill?.();
        timeScaleController?.kill?.();
        killHoverTweens();
        if (autoCloseTimer) {
            clearTimeout(autoCloseTimer);
            autoCloseTimer = null;
        }
        pendulum = null;
        timeScaleController = null;
        isEntryComplete = false;
        isHoverActive = false;
        
        // Clear ALL GSAP inline styles — return to CSS base state.
        // Without this, killed tweens leave orphaned transform/opacity/scale
        // on elements, causing PRZEWAGA/DOŚWIADCZENIA text to shift position.
        [wrapper, svg, badge, number, label].forEach(el => {
            if (el) gsap.set(el, { clearProps: "all" });
        });
        if (textTop && textBottom) {
            gsap.set([textTop, textBottom], { clearProps: "all" });
        }
        // Hide wrapper — playEntry() will reveal it on revive
        if (wrapper) gsap.set(wrapper, { autoAlpha: 0 });
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // PLAY ENTRY ANIMATION
    // ─────────────────────────────────────────────────────────────────────────
    function playEntry() {
        // Guard: badge-20lat-wrapper is display:none below 650px
        if (window.innerWidth < 650) return;
        killAllAnimations();
        [wrapper, svg, badge, number, label, textTop, textBottom].forEach(el => {
            if (el) gsap.killTweensOf(el);
        });
        gsap.set(wrapper, { autoAlpha: 0 });
        gsap.set(svg, { rotation: 180, scale: 0.8, opacity: 0, y: 0, transformOrigin: '50% 50%' });
        gsap.set(badge, { scale: 0.5, opacity: 0 });
        gsap.set(number, { y: 20, opacity: 0, color: '#f7f6f4' });
        gsap.set(label, { opacity: 0, xPercent: -50, x: 1, y: 15, scale: 1 });
        if (textTop && textBottom) { gsap.set([textTop, textBottom], { opacity: 0.8 }); }
        
        const badge20Delay = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--badge-20lat-delay')) || 1.25;
        const master = trackGsap(gsap.timeline({ delay: badge20Delay }));
        
        master.to(wrapper, { autoAlpha: 1, duration: 0.01 }, 0);
        master.to(svg, { rotation: 33, scale: 1, opacity: 1, duration: 1.4, ease: 'power2.out', transformOrigin: '50% 50%' }, 0);
        master.to(badge, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' }, 0.4);
        master.to(number, { y: -5, opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.7);
        master.to(label, { opacity: 0.8, duration: 0.4, ease: 'power2.out' }, 0.9);
        
        master.call(() => {
            isEntryComplete = true;
            pendulum = trackGsap(gsap.to(svg, {
                rotation: -33, duration: 9.75, ease: 'sine.inOut',
                transformOrigin: '50% 50%', yoyo: true, repeat: -1
            }));
        }, [], 1.4);
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // HOVER ENTER
    // ─────────────────────────────────────────────────────────────────────────
    function handleHoverEnter() {
        if (!isEntryComplete || !pendulum) return;
        if (isHoverActive) return;
        isHoverActive = true;
        killHoverTweens();
        hoverTweens = [
            gsap.to(badge, { scale: 0.85, duration: 1.5, ease: 'power2.out', overwrite: 'auto' }),
            gsap.to(number, { color: 'transparent', textShadow: '1px 1px 0px rgba(255,255,255,0.2), -1px -1px 0px rgba(0,0,0,0)', duration: 1, overwrite: 'auto' }),
            gsap.to(label, { opacity: 1, color: '#b0b0b0', scale: 0.85, duration: 0.6, ease: 'power2.out', overwrite: 'auto' }),
            gsap.to(svg, { scale: 1.1, duration: 2.0, ease: 'elastic.out(1, 0.3)', transformOrigin: '50% 50%', overwrite: 'auto' })
        ];
        if (textTop && textBottom) {
            hoverTweens.push(gsap.to([textTop, textBottom], { opacity: 0.5, duration: 2.0, ease: 'elastic.out(1, 0.3)', overwrite: 'auto' }));
        }
        timeScaleController?.kill?.();
        timeScaleController = trackGsap(gsap.timeline()
            .to(pendulum, { timeScale: 12, duration: 4, ease: 'sine.in' })
            .to(pendulum, { timeScale: 1, duration: 6, ease: 'sine.out' }));
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // HOVER LEAVE
    // ─────────────────────────────────────────────────────────────────────────
    function handleHoverLeave() {
        if (!isEntryComplete) return;
        if (!isHoverActive) return;
        isHoverActive = false;
        killHoverTweens();
        if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
        hoverTweens = [
            gsap.to(badge, { scale: 1, duration: 1.5, overwrite: 'auto' }),
            gsap.to(number, { color: '#f7f6f4', textShadow: '-2px -2px 3px rgba(255,255,255,1), 2px 2px 3px rgba(0,0,0,0.15)', duration: 1, overwrite: 'auto' }),
            gsap.to(label, { opacity: 0.8, color: '#a0a0a0', scale: 1, duration: 0.6, ease: 'power2.out', overwrite: 'auto' }),
            gsap.to(svg, { scale: 1, duration: 2.0, ease: 'elastic.out(1, 0.3)', transformOrigin: '50% 50%', overwrite: 'auto' })
        ];
        if (textTop && textBottom) {
            hoverTweens.push(gsap.to([textTop, textBottom], { opacity: 0.8, duration: 2.0, ease: 'elastic.out(1, 0.3)', overwrite: 'auto' }));
        }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────────────────
    listen(wrapper, 'mouseenter', () => { if (!hasHover) return; handleHoverEnter(); });
    listen(wrapper, 'mouseleave', () => { if (!hasHover) return; handleHoverLeave(); });
    listen(wrapper, 'click', () => {
        if (hasHover) return;
        if (autoCloseTimer) { clearTimeout(autoCloseTimer); }
        if (isHoverActive) { autoCloseTimer = setTimeout(handleHoverLeave, MOBILE_HOVER_DURATION); return; }
        handleHoverEnter();
        autoCloseTimer = setTimeout(handleHoverLeave, MOBILE_HOVER_DURATION);
    });
    
    let gradientCooldown = false;
    const blobMask = $('.blob-mask');
    function triggerGradientWithCooldown() {
        if (gradientCooldown) return;
        if (typeof startGradient === 'function') { startGradient(); }
        // Blob-mask pulse: shrink 0.5s → regrow 3s
        if (blobMask) {
            blobMask.style.animation = 'none';
            void blobMask.offsetWidth;
            blobMask.style.animation = 'hero-blobMaskPulse 3.5s cubic-bezier(0.45, 0, 0.55, 1) forwards';
        }
        gradientCooldown = true;
        trackedTimeout(() => { gradientCooldown = false; }, 6000);
    }
    wrapper.addEventListener('mouseenter', triggerGradientWithCooldown);
    wrapper.addEventListener('click', triggerGradientWithCooldown);
    
    // ─────────────────────────────────────────────────────────────────────────
    // EXPOSE FOR RESET (init przez playEntrySequence)
    // ─────────────────────────────────────────────────────────────────────────
    badge20LatReplay = playEntry;
    badge20LatKill = killAllAnimations;
    
    // Culling: pause pendulum when badge is off-screen
    const pendulumIO = trackObserver(new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (pendulum) { e.isIntersecting ? pendulum.resume() : pendulum.pause(); }
        });
    }, { rootMargin: '50px' }));
    pendulumIO.observe(wrapper);
})();

// ═══════════════════════════════════════════════════════════════════════════
// BADGE SATYSFAKCJI — CSS kontroluje animację przez backwards + delay
// Replay nie jest potrzebny - pulse bursts kontrolowane przez JS
// ═══════════════════════════════════════════════════════════════════════════
(function() {
    'use strict';
    const badgeWrap = $id('hero-badgeSatysfakcjiWrapper');
    if (!badgeWrap) return;
    // foilShift: continuous CSS animation, IO pauses off-screen to save paint
    const goldLayer = badgeWrap.querySelector('.layer-gold');
    if (goldLayer) {
        const foilIO = trackObserver(new IntersectionObserver((entries) => {
            goldLayer.style.animationPlayState = entries[0].isIntersecting ? 'running' : 'paused';
        }, { rootMargin: '50px' }));
        foilIO.observe(badgeWrap);
    }
})();

// ═══════════════════════════════════════════════════════════════════════════
// BADGE GOOGLE — HOVER STARS INTERACTION (FINAL VERSION)
// CSS kontroluje animację wejścia, JS tylko hover i finalizacja
// ═══════════════════════════════════════════════════════════════════════════
(function() {
    'use strict';
    
    const wrapper = $id('hero-badgeGoogleWrapper');
    const badge = $id('hero-badgeGoogle');
    const starsRow = $id('hero-googleStars');
    if (!wrapper || !badge || !starsRow) return;
    
    function generateStars() {
        const starPath = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";
        const badgeGoogleDelay = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--badge-google-delay')) || 1.5;
        const baseEntranceDelay = badgeGoogleDelay + 1.05;
        let html = '';
        for (let i = 0; i < 5; i++) {
            const entDelay = (baseEntranceDelay + (i * 0.05)).toFixed(2) + 's';
            const hovDelay = (i * 0.05).toFixed(2) + 's';
            html += `<svg class="star" viewBox="0 0 24 24" style="--ent-delay: ${entDelay}; --hov-delay: ${hovDelay};"><path d="${starPath}"/></svg>`;
        }
        starsRow.innerHTML = html;
    }
    
    function setupStarsInteraction() {
        const startHover = () => {
            if (wrapper.classList.contains('entrance-playing') || badge.dataset.starsLocked === '1') return;
            badge.dataset.starsLocked = '1';
            badge.classList.remove('stars-finished', 'stars-running');
            void badge.offsetWidth;
            badge.classList.add('stars-running');
            trackedTimeout(() => { badge.classList.remove('stars-running'); badge.dataset.starsLocked = '0'; }, 1400);
        };
        badge.addEventListener('mouseenter', startHover);
        badge.addEventListener('touchstart', startHover, {passive: true});
        const lastStar = starsRow.querySelector('.star:last-child');
        if (lastStar) {
            lastStar.addEventListener('animationend', (e) => {
                if (e.animationName === 'hero-badgeGoogleStarFlip') {
                    badge.classList.remove('stars-running');
                    badge.dataset.starsLocked = '0';
                    if (badge.matches(':hover')) badge.classList.add('stars-finished');
                }
            });
        }
        listen(badge, 'mouseleave', () => {
            if (badge.dataset.starsLocked !== '1') badge.classList.remove('stars-finished');
        });
    }
    
    function setupFinishEntrance() {
        let finished = false;
        const finalize = () => {
            if (finished) return;
            finished = true;
            wrapper.classList.remove('entrance-playing');
            wrapper.classList.add('anim-finished');
            badge.classList.add('anim-finished');
        };
        // Listen for the last animation in the badge sequence (caption fade ends ~5.5s)
        const caption = wrapper.querySelector('.badge-caption');
        if (caption) {
            caption.addEventListener('animationend', (e) => {
                if (e.animationName === 'hero-badgeGoogleCaptionFadeIn') finalize();
            });
        }
        // Safety watchdog — only fires if animationend never arrived (tab in bg, CSS disabled)
        trackedTimeout(finalize, 10000);
    }
    
    generateStars();
    setupStarsInteraction();
    setupFinishEntrance();
    
    // Expose kill/revive for action-area dormant system
    badgeGoogleKill = function() {
        wrapper.classList.remove('active', 'entrance-playing', 'anim-finished');
        badge.classList.remove('anim-finished', 'stars-running', 'stars-finished');
        badge.dataset.starsLocked = '0';
        starsRow.innerHTML = '';
    };
    badgeGoogleRevive = function() {
        wrapper.classList.add('active', 'entrance-playing');
        wrapper.classList.remove('anim-finished');
        badge.classList.remove('anim-finished', 'stars-running', 'stars-finished');
        badge.dataset.starsLocked = '0';
        generateStars();
        setupFinishEntrance();
    };
})();

// --- CTA BUTTON WAVE EFFECT ---
$$('.btn-wrapper-wave').forEach(wrapEl => {
    listen(wrapEl, 'click', () => {
        const wave = document.createElement('span');
        wave.classList.add('wave-effect', 'animating');
        const ref = wrapEl.firstChild;
        if (ref && wrapEl.contains(ref)) wrapEl.insertBefore(wave, ref);
        else wrapEl.appendChild(wave);
        wave.addEventListener('animationend', () => wave.remove()); // once: dynamic element, self-removes
    });
});

// --- HAAT: Hybrydowa Architektura Auto-Skalowania Typografii ---
// FAZA 2: Client-Side Correction (symulacja useLayoutEffect)
(function() {
    'use strict';
    
    const TIERS = ['L', 'M', 'S'];
    const MAX_LINES = { h1: 2, desc: 3 };
    
    function isDesktop() { return window.innerWidth > 1200; }
    
    function countLines(element) {
        const style = getComputedStyle(element);
        const lineHeight = parseFloat(style.lineHeight);
        const height = element.scrollHeight;
        return Math.round(height / lineHeight);
    }
    
    /* C1 REMOVED: fitsInBox() — zdefiniowana ale nigdy wywołana (pusty mobile branch) */
    
    function degradeTier(currentTier) {
        const index = TIERS.indexOf(currentTier);
        if (index < TIERS.length - 1) { return TIERS[index + 1]; }
        return currentTier;
    }
    
    function clientSideCorrection() {
        const h1 = $('.hero-title');
        const desc = $('.hero-description');
        if (!h1 || !desc) return;
        
        const desktop = isDesktop();
        let h1Tier = container.getAttribute('data-h1-tier') || 'M';
        let descTier = container.getAttribute('data-desc-tier') || 'M';
        /* C2 REMOVED: h1Changed, descChanged — write-only variables, nigdy odczytywane */
        
        if (desktop) {
            let h1Lines = countLines(h1);
            let h1Iterations = 0;
            while (h1Lines > MAX_LINES.h1 && h1Tier !== 'S' && h1Iterations < 3) {
                h1Tier = degradeTier(h1Tier);
                container.setAttribute('data-h1-tier', h1Tier);
                h1Lines = countLines(h1);
                h1Iterations++;
            }
            let descLines = countLines(desc);
            let descIterations = 0;
            while (descLines > MAX_LINES.desc && descTier !== 'S' && descIterations < 3) {
                descTier = degradeTier(descTier);
                container.setAttribute('data-desc-tier', descTier);
                descLines = countLines(desc);
                descIterations++;
            }
        } else {
            // MOBILE: overflow:hidden + max-height kontroluje widoczność
        }
    }
    
    requestAnimationFrame(() => { requestAnimationFrame(() => { clientSideCorrection(); }); });
    
    let resizeTimeout;
    let haatLastWidth = window.innerWidth;
    listen(window, 'resize', () => {
        // Guard: mobile Safari/Chrome fires resize on URL bar show/hide (height-only change)
        const currentWidth = window.innerWidth;
        if (currentWidth === haatLastWidth) return;
        haatLastWidth = currentWidth;
        clearTimeout(resizeTimeout);
        resizeTimeout = trackedTimeout(() => {
            if (window.HAAT && window.HAAT.tiers) {
                container.setAttribute('data-h1-tier', window.HAAT.tiers.h1);
                container.setAttribute('data-desc-tier', window.HAAT.tiers.desc);
            }
            clientSideCorrection();
        }, 150);
    });
    
    window.HAAT = window.HAAT || {};
    window.HAAT.clientCorrection = clientSideCorrection;
    window.HAAT.countLines = countLines;
    
})();
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 3: LOTTIE LAUR
    // ═════════════════════════════════════════════════════════════════
    {
// ═══════════════════════════════════════════════════════════════════════════
        // LOTTIE LAUR — PARA SYMETRYCZNA (CANVAS)
        // ═══════════════════════════════════════════════════════════════════════════
        (function() {
            'use strict';
            
            const containerLeft = $id('hero-lottieLaurLeft');
            const containerRight = $id('hero-lottieLaurRight');
            if (!containerLeft && !containerRight) return;
            
            // Inline animation data (wspólne dla obu)
            const animationData = {"v":"5.7.14","fr":30,"ip":0,"op":28,"w":372,"h":556,"nm":"Comp 2","ddd":0,"assets":[{"id":"comp_0","nm":"Comp 1","layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Shape Layer 2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[500,500,0],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"shapes":[],"ip":0,"op":30,"st":-30,"bm":0},{"ddd":0,"ind":2,"ty":4,"nm":"Shape Layer 1","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[500,500,0],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"shapes":[],"ip":0,"op":30,"st":-30,"bm":0},{"ddd":0,"ind":3,"ty":0,"nm":"laur 2","parent":4,"refId":"comp_1","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-68.144,"ix":10},"p":{"a":0,"k":[59.602,48.427,0],"ix":2,"l":2},"a":{"a":0,"k":[66,206.511,0],"ix":1,"l":2},"s":{"a":0,"k":[36.941,36.941,100],"ix":6,"l":2}},"ao":0,"w":132,"h":223,"ip":17.875,"op":180,"st":17.875,"bm":0},{"ddd":0,"ind":4,"ty":3,"nm":"Null 2","parent":6,"sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[21.387,32.574,0],"ix":2,"l":2},"a":{"a":0,"k":[50,50,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":180,"st":17.875,"bm":0},{"ddd":0,"ind":5,"ty":0,"nm":"laur","parent":6,"refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-63.043,"ix":10},"p":{"a":0,"k":[51.558,51.905,0],"ix":2,"l":2},"a":{"a":0,"k":[102.353,181.936,0],"ix":1,"l":2},"s":{"a":0,"k":[29.056,29.056,100],"ix":6,"l":2}},"ao":0,"w":240,"h":193,"ip":16.25,"op":180,"st":16.25,"bm":0},{"ddd":0,"ind":6,"ty":3,"nm":"Null 13","parent":8,"sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":5,"ix":10},"p":{"a":0,"k":[24.614,21.425,0],"ix":2,"l":2},"a":{"a":0,"k":[50,50,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":180,"st":16.25,"bm":0},{"ddd":0,"ind":7,"ty":0,"nm":"laur","parent":8,"refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-52.591,"ix":10},"p":{"a":0,"k":[55.28,50.225,0],"ix":2,"l":2},"a":{"a":0,"k":[116.059,178.892,0],"ix":1,"l":2},"s":{"a":0,"k":[38.161,38.161,100],"ix":6,"l":2}},"ao":0,"w":240,"h":193,"ip":14.625,"op":180,"st":14.625,"bm":0},{"ddd":0,"ind":8,"ty":3,"nm":"Null 12","parent":10,"sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":-7,"ix":10},"p":{"a":0,"k":[18.477,15.651,0],"ix":2,"l":2},"a":{"a":0,"k":[50,50,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":180,"st":14.625,"bm":0},{"ddd":0,"ind":9,"ty":0,"nm":"laur","parent":10,"refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-51.455,"ix":10},"p":{"a":0,"k":[57.17,53.798,0],"ix":2,"l":2},"a":{"a":0,"k":[109.287,183.117,0],"ix":1,"l":2},"s":{"a":0,"k":[42.875,42.875,100],"ix":6,"l":2}},"ao":0,"w":240,"h":193,"ip":13,"op":180,"st":13,"bm":0},{"ddd":0,"ind":10,"ty":3,"nm":"Null 11","parent":12,"sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":-1,"ix":10},"p":{"a":0,"k":[15.885,-2.123,0],"ix":2,"l":2},"a":{"a":0,"k":[50,50,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":180,"st":13,"bm":0},{"ddd":0,"ind":11,"ty":0,"nm":"laur","parent":12,"refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-40.357,"ix":10},"p":{"a":0,"k":[49.327,48.42,0],"ix":2,"l":2},"a":{"a":0,"k":[105.203,181.936,0],"ix":1,"l":2},"s":{"a":0,"k":[47.833,47.833,100],"ix":6,"l":2}},"ao":0,"w":240,"h":193,"ip":11.375,"op":180,"st":11.375,"bm":0},{"ddd":0,"ind":12,"ty":3,"nm":"Null 10","parent":14,"sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":-1,"ix":10},"p":{"a":0,"k":[37.737,-2.494,0],"ix":2,"l":2},"a":{"a":0,"k":[50,50,0],"ix":1,"l":2},"s":{"a":0,"k":[99,99,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":180,"st":11.375,"bm":0},{"ddd":0,"ind":13,"ty":0,"nm":"laur","parent":14,"refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-24.311,"ix":10},"p":{"a":0,"k":[53.317,51.941,0],"ix":2,"l":2},"a":{"a":0,"k":[111.795,183.973,0],"ix":1,"l":2},"s":{"a":0,"k":[53.307,53.307,100],"ix":6,"l":2}},"ao":0,"w":240,"h":193,"ip":9.75,"op":180,"st":9.75,"bm":0},{"ddd":0,"ind":14,"ty":3,"nm":"Null 9","parent":16,"sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":3,"ix":10},"p":{"a":0,"k":[50,-17.123,0],"ix":2,"l":2},"a":{"a":0,"k":[50,50,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":180,"st":9.75,"bm":0},{"ddd":0,"ind":15,"ty":0,"nm":"laur","parent":16,"refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-11.031,"ix":10},"p":{"a":0,"k":[56.048,49.786,0],"ix":2,"l":2},"a":{"a":0,"k":[115.092,182.064,0],"ix":1,"l":2},"s":{"a":0,"k":[58.091,58.091,100],"ix":6,"l":2}},"ao":0,"w":240,"h":193,"ip":8.125,"op":180,"st":8.125,"bm":0},{"ddd":0,"ind":16,"ty":3,"nm":"Null 8","parent":18,"sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[61.833,-16.922,0],"ix":2,"l":2},"a":{"a":0,"k":[50,50,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":180,"st":8.125,"bm":0},{"ddd":0,"ind":17,"ty":0,"nm":"laur","parent":18,"refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":6.625,"s":[-6.437]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":7.5,"s":[-5.437]},{"t":8.375,"s":[-0.437]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":6.625,"s":[51.799,64.079,0],"to":[2.449,-2.59,0],"ti":[-0.015,0.029,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":7.5,"s":[60.202,50.705,0],"to":[0.072,-0.144,0],"ti":[0.648,0,0]},{"t":8.375,"s":[56.312,50.705,0]}],"ix":2,"l":2},"a":{"a":0,"k":[111.646,185.833,0],"ix":1,"l":2},"s":{"a":0,"k":[63.431,63.431,100],"ix":6,"l":2}},"ao":0,"w":240,"h":193,"ip":6.5,"op":180,"st":6.5,"bm":0},{"ddd":0,"ind":18,"ty":3,"nm":"Null 7","parent":20,"sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[76.021,-15.822,0],"ix":2,"l":2},"a":{"a":0,"k":[50,50,0],"ix":1,"l":2},"s":{"a":0,"k":[102,102,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":180,"st":6.5,"bm":0},{"ddd":0,"ind":19,"ty":0,"nm":"laur","parent":20,"refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":5.375,"s":[2.443]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":6.375,"s":[-0.057]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":7.375,"s":[13.443]},{"t":8.625,"s":[13.443]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":5.375,"s":[54.987,53.17,0],"to":[-0.551,-0.037,0],"ti":[1.378,0.092,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":6.375,"s":[56.971,52.95,0],"to":[-1.378,-0.092,0],"ti":[0.551,0.037,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":7.375,"s":[48.373,52.729,0],"to":[-1.102,-0.073,0],"ti":[0.551,0.037,0]},{"t":8.625,"s":[48.153,52.729,0]}],"ix":2,"l":2},"a":{"a":0,"k":[107.12,186.933,0],"ix":1,"l":2},"s":{"a":0,"k":[70.016,70.016,100],"ix":6,"l":2}},"ao":0,"w":240,"h":193,"ip":5.125,"op":180,"st":5.125,"bm":0},{"ddd":0,"ind":20,"ty":3,"nm":"Null 6","sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[795.749,615.31,0],"ix":2,"l":2},"a":{"a":0,"k":[50,50,0],"ix":1,"l":2},"s":{"a":0,"k":[113.404,113.404,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":180,"st":5.125,"bm":0}]},{"id":"comp_1","nm":"laur 2","layers":[{"ddd":0,"ind":1,"ty":4,"nm":"lewy","parent":2,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":38,"ix":10},"p":{"a":0,"k":[0.714,1.969,0],"ix":2,"l":2},"a":{"a":0,"k":[147.714,206.969,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.003,0.003,0.003],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":0,"s":[0,0,100]},{"t":4.125,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[-38.973,-29.064],[-47.339,99.742],[-24,-12.33],[13.431,-69.798],[17.175,39.633]],"o":[[0,0],[0,0],[24,12.331],[0,0],[0,0]],"v":[[43.046,60.88],[-15.303,-60.88],[17.284,-26.313],[49.211,56.918],[6.275,1.872]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0,0,0,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[100.781,148.469],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0,"op":384.125,"st":0,"bm":0},{"ddd":0,"ind":2,"ty":3,"nm":"Null 3","sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[61.5,174.5,0],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.859,0.859,0.667],"y":[0.996,0.996,1]},"o":{"x":[1,1,0.333],"y":[0,0,0]},"t":0,"s":[100,100,100]},{"i":{"x":[0,0,0.667],"y":[1.005,1.005,1]},"o":{"x":[0.096,0.096,0.333],"y":[-0.006,-0.006,0]},"t":4.632,"s":[120,120,100]},{"t":11.875,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"ip":0,"op":381.75,"st":0,"bm":0}]},{"id":"comp_2","nm":"laur","layers":[{"ddd":0,"ind":1,"ty":0,"nm":"lisc1","refId":"comp_3","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[108.25,168.25,0],"ix":2,"l":2},"a":{"a":0,"k":[87.75,151.75,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.859,0.859,0.667],"y":[0.996,0.996,1]},"o":{"x":[1,1,0.333],"y":[0,0,0]},"t":0,"s":[100,100,100]},{"i":{"x":[0,0,0.667],"y":[1.005,1.005,1]},"o":{"x":[0.096,0.096,0.333],"y":[-0.006,-0.006,0]},"t":4.632,"s":[120,120,100]},{"t":11.875,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"w":199,"h":160,"ip":0,"op":330,"st":0,"bm":0}]},{"id":"comp_3","nm":"lisc1","layers":[{"ddd":0,"ind":1,"ty":3,"nm":"Null 1","sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":7.594,"ix":10},"p":{"a":0,"k":[84.5,147,0],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":343.125,"st":0,"bm":0},{"ddd":0,"ind":2,"ty":4,"nm":"stem","parent":1,"td":1,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[0.65,2.25,0],"ix":2,"l":2},"a":{"a":0,"k":[-14.75,71.75,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[0.985,-28.416],[0,0],[0,0],[-0.799,33.315],[0,0]],"o":[[0,0],[-1.176,33.946],[0,0],[0,0],[0.792,-33.036],[0,0]],"v":[[8.333,-67.5],[19.762,-3.414],[8.485,72.25],[-10,67.75],[2.166,-2.914],[-14.794,-87.942]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0,0,0,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[-14.75,4],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[82.5,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Rectangle 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0.25,"op":345.5,"st":0,"bm":0},{"ddd":0,"ind":3,"ty":4,"nm":"stemask","parent":1,"tt":1,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":1,"k":[{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":0,"s":[-1.5,185,0],"to":[0,-26.667,0],"ti":[0,26.667,0]},{"t":2.25,"s":[-1.5,25,0]}],"ix":2,"l":2},"a":{"a":0,"k":[-17.5,248.5,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[0,0],[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0],[0,0],[0,0]],"v":[[18,-54.5],[34,88.5],[-34,88.5],[-8,-61.75],[-1.5,-88.5]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0,0,0,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[-17.5,160],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Rectangle 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0.25,"op":345.5,"st":0,"bm":0},{"ddd":0,"ind":4,"ty":4,"nm":"prawy","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":1,"k":[{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":0.5,"s":[88.51,154.616,0],"to":[0.833,0,0],"ti":[-0.833,0,0]},{"t":4.625,"s":[93.51,154.616,0]}],"ix":2,"l":2},"a":{"a":0,"k":[168.01,209.616,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":0.5,"s":[0,0,100]},{"t":4.625,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[6.385,-55.266],[-84.55,24.44],[-10.129,18.715],[86.312,-11.009],[7.706,-7.926],[-44.477,30.606]],"o":[[0,0],[29.284,-8.808],[0,0],[-20.918,2.422],[0,0],[0,0]],"v":[[-49.982,64.734],[3.963,-36.77],[53.945,-68.697],[-5.725,56.367],[-40.734,68.697],[3.082,0]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0,0,0,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[214.286,144.616],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0.5,"op":346,"st":0.5,"bm":0},{"ddd":0,"ind":5,"ty":4,"nm":"lewy","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":1,"k":[{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":0.75,"s":[80.714,151.969,0],"to":[-0.833,0,0],"ti":[0.833,0,0]},{"t":4.875,"s":[75.714,151.969,0]}],"ix":2,"l":2},"a":{"a":0,"k":[147.714,206.969,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":0.75,"s":[0,0,100]},{"t":4.875,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[-38.973,-29.064],[-47.339,99.742],[-24,-12.33],[13.431,-69.798],[17.175,39.633]],"o":[[0,0],[0,0],[24,12.331],[0,0],[0,0]],"v":[[43.046,60.88],[-15.303,-60.88],[17.284,-26.313],[49.211,56.918],[6.275,1.872]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0,0,0,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[100.781,148.469],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0.75,"op":346.25,"st":0.75,"bm":0}]}],"layers":[{"ddd":0,"ind":1,"ty":0,"nm":"Comp 1","td":1,"refId":"comp_0","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":7.612,"ix":10},"p":{"a":0,"k":[84,26,0],"ix":2,"l":2},"a":{"a":0,"k":[649,135,0],"ix":1,"l":2},"s":{"a":0,"k":[101.426,101.426,100],"ix":6,"l":2}},"ao":0,"w":1000,"h":1000,"ip":0,"op":180,"st":0,"bm":0},{"ddd":0,"ind":2,"ty":4,"nm":"Shape Layer 1","tt":1,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[188,287,0],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":0,"k":[100,99.488,100],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ty":"rc","d":1,"s":{"a":0,"k":[472,766],"ix":2},"p":{"a":0,"k":[0,0],"ix":3},"r":{"a":0,"k":0,"ix":4},"nm":"Rectangle Path 1","mn":"ADBE Vector Shape - Rect","hd":false},{"ty":"gf","o":{"a":0,"k":100,"ix":10},"r":1,"bm":0,"g":{"p":3,"k":{"a":0,"k":[0,0.957,0.937,0.922,0.525,0.947,0.922,0.898,1,0.937,0.906,0.875,0,0.8,0.505,0.9,1,1],"ix":9}},"s":{"a":0,"k":[26,247.265],"ix":5},"e":{"a":0,"k":[-101,-254.301],"ix":6},"t":1,"nm":"Gradient Fill 1","mn":"ADBE Vector Graphic - G-Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[-2,-8],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Rectangle 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0,"op":28,"st":0,"bm":0}],"markers":[]};
            
            let animLeft = null;
            let animRight = null;
            let isVisible = false;
            
            // Flagi stanu animacji
            let isStopped = true;      // Na starcie czeka na wyrysowanie
            let hasCompleted = false;  // Czy animacja została już wyrysowana
            let isUnfolded = false;    // Czy liście są rozwinięte (do scroll observer)
            let isReversing = false;   // Guard: native reverse w toku (blokuje complete handler)
            let isFolding = false;     // Blokada podczas animacji zwijania
            let reverseRemaining = 0;  // Ile animacji jeszcze nie zakończyło reverse
            
            function onOneReverseComplete(anim) {
                anim.setDirection(1);
                anim.goToAndStop(0, true);
                reverseRemaining--;
                if (reverseRemaining <= 0) {
                    isFolding = false;
                    isReversing = false;
                }
            }
            
            // Inicjalizacja obu Lottie
            // reentryDelay: null = initial page choreography (--lottie-delay), number = re-entry delay
            let lottieHasInit = false;
            async function initLottie(reentryDelay) {
                const lottie = await getLottie();
                // Reset state for clean init / re-entry
                isStopped = true;
                hasCompleted = false;
                isUnfolded = false;
                isReversing = false;
                isFolding = false;
                reverseRemaining = 0;
                
                const config = {
                    renderer: 'canvas',
                    loop: false,  // Jednorazowe wyrysowanie
                    autoplay: false,
                    animationData: animationData,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet',
                        clearCanvas: true,
                        progressiveLoad: true
                    }
                };
                
                // Flaga ile animacji jest gotowych
                let loadedCount = 0;
                const totalAnims = (containerLeft ? 1 : 0) + (containerRight ? 1 : 0);
                
                // Funkcja startująca animację z delay z CSS variable
                function scheduleAnimationStart() {
                    loadedCount++;
                    if (loadedCount === totalAnims) {
                        const lottieDelay = (reentryDelay != null) ? reentryDelay : (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--lottie-delay')) || 1750);
                        trackedTimeout(() => {
                            isStopped = false;
                            animLeft?.setSpeed(0.3);
                            animRight?.setSpeed(0.3);
                            animLeft?.play();
                            animRight?.play();
                        }, lottieDelay);
                    }
                }
                
                if (containerLeft) {
                    animLeft = lottie.loadAnimation({ ...config, container: containerLeft });
                    animLeft.addEventListener('DOMLoaded', () => {
                        animLeft.goToAndStop(0, true);
                        scheduleAnimationStart();
                    });
                    animLeft.addEventListener('complete', () => {
                        if (isReversing) { onOneReverseComplete(animLeft); return; }
                        animLeft.goToAndStop(27, true);
                        if (!hasCompleted) onAnimationComplete();
                    });
                }
                
                if (containerRight) {
                    animRight = lottie.loadAnimation({ ...config, container: containerRight });
                    animRight.addEventListener('DOMLoaded', () => {
                        animRight.goToAndStop(0, true);
                        scheduleAnimationStart();
                    });
                    animRight.addEventListener('complete', () => {
                        if (isReversing) { onOneReverseComplete(animRight); return; }
                        animRight.goToAndStop(27, true);
                    });
                }
                lottieHasInit = true;
            }
            
            // Pełne niszczenie instancji Lottie (canvas + internal renderer + state reset)
            function destroyLottie() {
                animLeft?.destroy(); animRight?.destroy();
                animLeft = null; animRight = null;
                isStopped = true;
                hasCompleted = false;
                isUnfolded = false;
                isReversing = false;
                isFolding = false;
                reverseRemaining = 0;
            }
            
            // Funkcja do aktualizacji stanu po zakończeniu animacji
            function onAnimationComplete() {
                hasCompleted = true;
                isStopped = true;
                isUnfolded = true;  // Liście są teraz rozwinięte
            }
            
            // IntersectionObserver - pauza gdy nie widoczny + scroll fold/unfold
            function setupVisibilityObserver() {
                const target = containerLeft || containerRight;
                if (!target) {
                    return;
                }
                
                // IO: destroy when off-screen, rebuild from zero on re-entry
                const observer = trackObserver(new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        isVisible = entry.isIntersecting;
                        if (!isVisible) {
                            // OFF-SCREEN → full teardown (canvas + renderer + state)
                            destroyLottie();
                        } else if (lottieHasInit && !animLeft && !animRight) {
                            // ON-SCREEN re-entry → rebuild with instant play (0ms delay)
                            initLottie(0);
                        }
                    });
                }, { threshold: 0.1, rootMargin: '50px' }));
                observer.observe(target);
                
                // Scroll observer dla fold/unfold
                let lastScrollY = 0;
                let ticking = false;
                
                // Native Lottie reverse — rAF-synced, no setTimeout chain
                // fr=30, op=28: 28/30 = 0.933s @ 1×. setSpeed(1.85) → 0.933/1.85 ≈ 504ms
                function animateFold() {
                    if (isFolding) return;
                    isFolding = true;
                    isReversing = true;
                    reverseRemaining = [animLeft, animRight].filter(Boolean).length;
                    
                    [animLeft, animRight].forEach(anim => {
                        if (!anim) return;
                        anim.setDirection(-1);
                        anim.setSpeed(1.85);
                        anim.play();
                    });
                }
                
                function handleScroll() {
                    if (!ticking) {
                        requestAnimationFrame(() => {
                            const currentScrollY = scrollRuntime.getScroll();
                            
                            if (!hasCompleted) {
                                lastScrollY = currentScrollY;
                                ticking = false;
                                return;
                            }
                            
                            // Scroll w dół > 50px → zwiń liście (animacja reverse)
                            if (currentScrollY > lastScrollY && currentScrollY > 50 && isUnfolded && !isFolding) {
                                animateFold();
                                isUnfolded = false;
                            }
                            // Na samej górze → rozwiń liście (animacja forward)
                            else if (currentScrollY === 0 && !isUnfolded && !isFolding) {
                                animLeft?.setSpeed(1);
                                animRight?.setSpeed(1);
                                animLeft?.goToAndPlay(0, true);
                                animRight?.goToAndPlay(0, true);
                                isUnfolded = true;
                            }
                            
                            lastScrollY = currentScrollY;
                            ticking = false;
                        });
                        ticking = true;
                    }
                }
                
                // Nasłuchuj na wszystkich możliwych źródłach
                listen(window, 'scroll', handleScroll, { passive: true });
                listen(document, 'scroll', handleScroll, { passive: true });
                
                // WHEEL EVENT - fallback dla iframe gdzie scroll nie działa
                let wheelAccumulator = 0;
                const WHEEL_THRESHOLD = 5; // Próg aktywacji - NISKI dla natychmiastowej reakcji
                
                listen(document, 'wheel', (e) => {
                    if (!hasCompleted || isFolding) return;
                    
                    // Reset accumulator przy zmianie kierunku
                    if ((wheelAccumulator > 0 && e.deltaY < 0) || (wheelAccumulator < 0 && e.deltaY > 0)) {
                        wheelAccumulator = 0;
                    }
                    
                    wheelAccumulator += e.deltaY;
                    
                    // Scroll w dół (wheel down) → zwiń liście (animacja reverse)
                    if (e.deltaY > 0 && wheelAccumulator > WHEEL_THRESHOLD && isUnfolded) {
                        animateFold();
                        isUnfolded = false;
                        wheelAccumulator = 0;
                    }
                    // Scroll w górę (wheel up) → rozwiń liście (animacja forward)
                    else if (e.deltaY < 0 && wheelAccumulator < -WHEEL_THRESHOLD && !isUnfolded) {
                        animLeft?.setSpeed(1);  // Normalna prędkość (nie 0.3x jak na starcie)
                        animRight?.setSpeed(1);
                        animLeft?.goToAndPlay(0, true);
                        animRight?.goToAndPlay(0, true);
                        isUnfolded = true;
                        wheelAccumulator = 0;
                    }
                }, { passive: true });
                
                // Sprawdź czy jest jakiś scrollable parent
                const scrollParent = container?.parentElement;
                if (scrollParent && scrollParent !== document.body) {
                    listen(scrollParent, 'scroll', handleScroll, { passive: true });
                }
            }
            
            
            // Init
            initLottie();
            setupVisibilityObserver();
            
            // Lottie cleanup for kill()
            cleanups.push(destroyLottie);
        })();
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 4: BRANDS MARQUEE (logotypy z /LOGOTYPY/)
    // ═════════════════════════════════════════════════════════════════
    {
            // 1. ZASOBY — pliki z public/LOGOTYPY (wersje _new)
            const logoFiles = [
                '1sklepy1_new.svg', '2mbank1_new.svg', '3zabka1_new.svg', '4deloitte1_new.svg',
                '5grycan1_new.svg', '6gsk1_new.svg', '7ministerstwo1_new.svg', '8mokate1_new.svg',
                '9wella1_new.svg', '10oracle1_new.svg', '11sokolow1_new.svg', '12skanska1_new.svg'
            ];
            const logosOnScreen = 10;

            function createLogoItem() {
                const div = document.createElement('div');
                div.className = 'logo-item';
                const img = document.createElement('img');
                img.alt = '';
                img.loading = 'lazy';
                img.draggable = false;
                div.appendChild(img);
                return div;
            }

            function setLogoItemSource(div, index) {
                const img = div.querySelector('img');
                if (img) img.src = `/LOGOTYPY/${logoFiles[index % logoFiles.length]}`;
            }

            let currentMarqueeInstance = null;
            marqueeStop = () => currentMarqueeInstance?.stop?.();
            marqueeStart = () => currentMarqueeInstance?.start?.();

            // 2. SILNIK FIZYKI — TIDAL DRIFT (v2: quickSetter, no CSS Bridge)
            // ─────────────────────────────────────────────────────────────
            // CSS Bridge (transition: 33ms linear) USUNIĘTY — fundamentalnie
            // niekompatybilny z wrap/loop. Przy wrapie przeglądarka interpoluje
            // skok ~1660px przez 33ms = widoczny flash. Nie da się tego obejść
            // bez layout thrashing (void offsetWidth na każdym wrapie).
            //
            // Render: gsap.quickSetter("x","px") — bezpośredni DOM write,
            // zero transition overhead. 30fps throttle wystarczy dla marquee
            // (wolny drift, ~21px/s base). quickSetter omija string parsing
            // i jest sprawdzony w produkcji (stary silnik używał tego samego).
            //
            // Input: wheel = PRIMARY (działa w iframe), scroll = FALLBACK.
            // Guard: jeśli wheel odpalił w tej klatce, scroll delta jest
            // ignorowany — zapobiega podwójnej akumulacji tego samego gestu.
            //
            // Przygotowane pod scrollRuntime (Next.js):
            // scrollRuntime.getRawScroll() z outer scope
            // Klasa nie importuje nic — czyta helper z heroSectionInit scope.
            // ─────────────────────────────────────────────────────────────
            class TidalDriftMarquee {
                constructor(trackElement, loopLimitPx) {
                    this.track = trackElement;
                    this.limit = Math.abs(loopLimitPx);

                    // ⚙️ TIDAL DRIFT — parametry fizyki
                    this.cfg = {
                        baseSpeed:     0.35,   // px/frame base drift (← kierunek)
                        lerp:          0.07,   // smoothing: 7% luki/frame → "masa" bez betonozy
                        friction:      0.95,   // decay per frame @60fps (dt-aware)
                        scrollGain:    5.0,    // czułość reakcji na scroll
                        maxBoost:      12,     // hard cap na velocity (px/frame)
                        velocityClamp: 40      // hard cap na akumulowaną velocity
                    };

                    // Stan pozycyjny — 2-layer architecture (target + visual)
                    this.x        = 0;
                    this.targetX  = 0;
                    this.velocity = 0;
                    this.rawDelta = 0;
                    this._wheelFiredThisFrame = false; // guard: deduplikacja wheel vs scroll

                    this.isPaused  = false;
                    this.isActive  = false;

                    // Bindings
                    this.update   = this.update.bind(this);
                    this.onWheel  = this.onWheel.bind(this);
                    this.onScroll = this.onScroll.bind(this);
                    this.lastScrollY = scrollRuntime.getRawScroll();

                    // Render: quickSetter = bezpośredni DOM write, zero transition
                    this._setX = gsap.quickSetter(trackElement, "x", "px");
                    this._lastRender = 0; // 30fps throttle
                }

                start() {
                    if (this.isActive) return;
                    this.isActive = true;

                    // B-VEL-01 AUTO-FIX: reset velocity state on re-entry
                    // Zapobiega spike z nagromadzonego scrollY podczas pauzy
                    this.velocity = 0;
                    this.rawDelta = 0;
                    this.lastScrollY = scrollRuntime.getRawScroll();

                    // wheel = PRIMARY source (działa w iframe + na stronie)
                    window.addEventListener('wheel', this.onWheel, { passive: true });
                    // scroll = FALLBACK (na wypadek braku wheel events, np. touch scroll)
                    window.addEventListener('scroll', this.onScroll, { passive: true });

                    if (typeof gsap !== 'undefined') {
                        gsap.ticker.add(this.update);
                    }
                }

                stop() {
                    if (!this.isActive) return;
                    this.isActive = false;
                    window.removeEventListener('wheel', this.onWheel);
                    window.removeEventListener('scroll', this.onScroll);
                    if (typeof gsap !== 'undefined') {
                        gsap.ticker.remove(this.update);
                    }
                }

                // ── INPUT: wheel (PRIMARY — zachowuje kierunek) ──
                onWheel(e) {
                    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX)
                        ? e.deltaY : e.deltaX;
                    if (Math.abs(delta) > 1) {
                        this.rawDelta += delta * 0.8;
                        this._wheelFiredThisFrame = true; // blokuj scroll w tej klatce
                    }
                }

                // ── INPUT: scroll (FALLBACK — ignorowany gdy wheel aktywny) ──
                onScroll() {
                    if (this._wheelFiredThisFrame) return; // wheel już dostarczył delta
                    const currentY = scrollRuntime.getRawScroll();
                    const delta = currentY - this.lastScrollY;
                    this.lastScrollY = currentY;
                    if (Math.abs(delta) > 500) return; // skip scroll restoration spike
                    if (Math.abs(delta) > 0) {
                        this.rawDelta += delta * 0.8;
                    }
                }

                // ── TICK: fizyka + render (gsap.ticker) ──
                update() {
                    if (this.isPaused || this.limit <= 0) return;

                    const dt = gsap.ticker.deltaRatio(60);

                    // 1. ACCUMULATE — rawDelta → velocity (signed, bezpośrednio)
                    this.velocity += this.rawDelta * this.cfg.scrollGain * 0.01;
                    this.velocity = Math.max(
                        -this.cfg.velocityClamp,
                        Math.min(this.cfg.velocityClamp, this.velocity)
                    );
                    this.rawDelta = 0;
                    this._wheelFiredThisFrame = false; // reset guard for next frame

                    // 2. FRICTION DECAY — dt-aware (stabilne na 60/120/144Hz)
                    this.velocity *= Math.pow(this.cfg.friction, dt);
                    if (Math.abs(this.velocity) < 0.001) this.velocity = 0;

                    // 3. TOTAL SPEED — base (← zawsze) + velocity (± scroll dir)
                    const totalSpeed = (-this.cfg.baseSpeed + this.velocity) * dt;

                    // 4. ADVANCE TARGET
                    this.targetX += totalSpeed;

                    // 5. LERP — dt-aware
                    const lerpFactor = 1 - Math.pow(1 - this.cfg.lerp, dt);
                    this.x += (this.targetX - this.x) * lerpFactor;

                    // 6. WRAP — bidirektionalny infinite loop
                    while (this.x <= -this.limit) {
                        this.x      += this.limit;
                        this.targetX += this.limit;
                    }
                    while (this.x >= 0) {
                        this.x      -= this.limit;
                        this.targetX -= this.limit;
                    }

                    // 7. RENDER — 30fps throttle, quickSetter (bezpośredni DOM write)
                    //    Brak transition = wrap jest instant i niewidoczny
                    //    (duplikat logo na granicy wrapu = identyczny układ)
                    const now = performance.now();
                    if (now - this._lastRender >= 33.3) {
                        this._setX(this.x);
                        this._lastRender = now;
                    }
                }

                destroy() {
                    this.stop();
                    gsap.set(this.track, { clearProps: "transform" });
                }
            }

            // 3. BUDOWANIE HTML (Integracja)
            // reentryDelay: null = initial page choreography (--marquee-offset), number = re-entry stagger base
            let brandsHasBuilt = false;
            function buildBrandsTrack(reentryDelay) {
                const track = $id('hero-brandsMarqueeTrack');
                if (!track) return;
                
                // Sprzątanie starej instancji
                if (currentMarqueeInstance) {
                    currentMarqueeInstance.destroy();
                    currentMarqueeInstance = null;
                }

                // Reset DOM
                track.innerHTML = '';
                track.style.animation = 'none';  
                track.style.transform = 'translate3d(0,0,0)';
                
                const fragment = document.createDocumentFragment();

                // Zestaw 1 (animacja wejścia)
                const startOffset = (reentryDelay != null)
                    ? reentryDelay
                    : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--marquee-offset')) || 2.0;
                for (let i = 0; i < logosOnScreen; i++) {
                    const div = createLogoItem();
                    setLogoItemSource(div, i);
                    div.classList.add('with-entry');
                    const baseDelay = 0.08;
                    const wave = Math.sin(i * 0.4) * 0.015;
                    const delay = (startOffset + i * baseDelay + wave).toFixed(3);
                    div.style.animationDelay = `${delay}s, ${delay}s`;
                    div.addEventListener('animationend', () => { div.classList.remove('with-entry'); }, { once: true });
                    fragment.appendChild(div);
                }
                
                // Zestaw 2 (Bufor)
                const approxItemWidth = 166; 
                const itemsNeededToFillScreen = Math.ceil(window.innerWidth / approxItemWidth);
                const bufferCount = Math.max(logosOnScreen + 2, itemsNeededToFillScreen + 4);

                for (let i = 0; i < bufferCount; i++) {
                    const div = createLogoItem();
                    setLogoItemSource(div, logosOnScreen + i);
                    fragment.appendChild(div);
                }

                track.appendChild(fragment);
                
                // Start silnika JS
                requestAnimationFrame(() => {
                    const items = track.children;
                    if (items.length < logosOnScreen + 1) return;

                    const firstItem = items[0];
                    const duplicateStartItem = items[logosOnScreen];
                    
                    const rawDistance = duplicateStartItem.offsetLeft - firstItem.offsetLeft;
                    const dpr = window.devicePixelRatio || 1;
                    const scrollDistance = Math.round(rawDistance * dpr) / dpr;
                    
                    if (scrollDistance <= 0) return;
                    currentMarqueeInstance = new TidalDriftMarquee(track, scrollDistance);
                    currentMarqueeInstance.start();
                    brandsHasBuilt = true;
                });
            }
            
            // 4. OPTYMALIZACJA — full destroy/rebuild on viewport exit/entry
            // Off-screen: destroy marquee + clear DOM (zero CPU/GPU/events)
            // On-screen:  rebuild with short re-entry animation (fresh physics state)
            function setupBrandsVisibilityObserver() {
                const wrapper = $id('hero-brandsMarqueeWrapper');
                if (!wrapper) return;
                
                const observer = trackObserver(new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (!entry.isIntersecting) {
                            // OFF-SCREEN → full teardown (ticker + global events + DOM)
                            if (currentMarqueeInstance) {
                                currentMarqueeInstance.destroy();
                                currentMarqueeInstance = null;
                            }
                            const track = $id('hero-brandsMarqueeTrack');
                            if (track) { track.innerHTML = ''; track.style.transform = 'translate3d(0,0,0)'; }
                        } else if (brandsHasBuilt && !currentMarqueeInstance) {
                            // ON-SCREEN re-entry → rebuild with short stagger (0s base + wave)
                            buildBrandsTrack(0);
                        }
                    });
                }, { threshold: 0.0 }));
                
                observer.observe(wrapper);
            }

            // Marquee cleanup for kill()
            cleanups.push(() => {
                if (currentMarqueeInstance) { currentMarqueeInstance.destroy(); currentMarqueeInstance = null; }
            });

            // Init
            requestAnimationFrame(() => {
                buildBrandsTrack();
                setupBrandsVisibilityObserver();
            });
            
            let brandsResizeTimeout;
            let lastBrandsWidth = window.innerWidth;
            listen(window, 'resize', () => {
                if (window.innerWidth === lastBrandsWidth) return; // skip height-only changes (mobile address bar)
                lastBrandsWidth = window.innerWidth;
                clearTimeout(brandsResizeTimeout);
                brandsResizeTimeout = trackedTimeout(() => buildBrandsTrack(0), 200);
            });
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 5: TRAIL (PARTICLE SYSTEM) — PHOTO PLACEHOLDERS
    // ═════════════════════════════════════════════════════════════════
    {
        (function() {
        const trailEl = $id('hero-trailContainer');
        if (!trailEl || typeof gsap === 'undefined' || window.innerWidth <= 1200) return;

        /* ═══ CONFIG ═══ */
        const vw = window.innerWidth;
        const SIZE_SCALE = vw >= 2000 ? 1
                         : vw <= 1200 ? 0.7
                         : 0.7 + (vw - 1200) / 800 * 0.3;

        const V = {
            ASPECT:         241 / 308,    // proporcje realnych zdjęć (308×241px)
            SIZE_MAX:       Math.round(288 * SIZE_SCALE),
            SIZE_MIN_RATIO: 0.80,
            SPACING_SLOW:   250,
            SPACING_FAST:   130,
            SPEED_FLOOR:    0.15,
            SPEED_CEIL:     2.5,
            HISTORY_MS:     200,
            LIFESPAN_BASE:  1100,  // min time from spawn (incl. 0.6s entry + 0.5s visible)
            LIFESPAN_MAX:   1800,  // max time when few on screen
            MAX_VISIBLE:    3,
            IN_S:           0.6,
            OUT_S:          0.8,
            OUT_S_FAST:     0.3,   // overflow (>MAX_VISIBLE na ekranie)
            OUT_S_FLUSH:    0.5,   // EarlyFlush (zmiana grupy kolorów)
            MAX_ROT:        8,
            ENTRY_ROT_MIN:  10,
            ENTRY_ROT_MAX:  30,
            IN_EASE:        "back.out(1.4)",
            IN_ROT_EASE:    "power2.out",
            OUT_EASE:       "power2.in",
            BORDER_RADIUS:  4,
            INNER_MASK_START: 0.35,
            BRIGHT_START:   200,
            DRIFT_MULT:     110,
            DRIFT_CAP:      1.2,   // max drift magnitude — sublinear above 1.0
            DRIFT_S:        1.5,
            DRIFT_EASE:     "power4",
        };

        /* ═══ PHOTO ENGINE ═══════════════════════════════════════════════════════
           Format:       AVIF jeśli obsługiwany (probe), fallback WebP
           Rozdzielczość: _RETINA gdy DPR≥2 + szybkie łącze + !saveData
           Kolejność:    QuotaCycle S1 — 4 spawny z grupy A, potem B, C, D, A…
                         EarlyFlush — przy zmianie grupy ubija starych natychmiast
           Pliki:        /trail/XX_strrona_internetowa[_RETINA].[avif|webp]
           ═══════════════════════════════════════════════════════════════════ */

        /* -- Format detection: AVIF probe (async, wynik gotowy przed 1. spawnem) -- */
        let _avifSupported = null;
        (function probeAvif() {
            const img = new Image();
            img.onload  = () => { _avifSupported = true;  };
            img.onerror = () => { _avifSupported = false; };
            img.src = 'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxAAAA';
        })();

        /* -- Rozdzielczość: Retina + connection quality -- */
        const _conn      = navigator.connection || null;
        const _isRetina  = window.devicePixelRatio >= 2;
        const _saveData  = _conn?.saveData === true;
        const _eff       = _conn?.effectiveType || '4g';
        const _downlink  = _conn?.downlink ?? 10;
        const _slowConn  = _saveData || _eff !== '4g' || _downlink < 5;
        const _useRetina = _isRetina && !_slowConn;

        /* -- IMAGE_GROUPS: klucze plików (A1…D4) pogrupowane kolorystycznie -- */
        const IMAGE_GROUPS = {
            A: ['A1','A2','A3','A4'],
            B: ['B1','B2','B3','B4'],
            C: ['C1','C2','C3','C4'],
            D: ['D1','D2','D3','D4'],
        };
        const GROUP_KEYS = Object.keys(IMAGE_GROUPS);
        const FLAT_META  = GROUP_KEYS.flatMap(k => IMAGE_GROUPS[k].map(c => ({ k, c })));

        /* -- Budowanie elementu img z kluczem (np. 'A1') -- */
        function _getPhotoEl(key) {
            const res = _useRetina ? '_RETINA' : '';
            const fmt = (_avifSupported === false) ? 'webp' : 'avif';
            const src = `/trail/${key}_strrona_internetowa${res}.${fmt}`;
            const img = document.createElement('img');
            img.src           = src;
            img.alt           = '';
            img.draggable     = false;
            img.decoding      = 'async';
            img.fetchpriority = 'low';
            img.onerror       = function() { this.classList.add('load-failed'); };
            return img;
        }

        /* ═══ STRATEGIA — QuotaSequence (flat 16-element cycle) ════════════════
           Flat sekwencja 16 kluczy (A1…D4). Po 16 spawnach wraca do punktu startowego.
           Przy zmianie grupy: flush=true → spawn() ubija żywych → 0% miksów kolorów.
           Po pauzie (alive===0): reset() przesuwa do następnej grupy, nie do zera.
           ═══════════════════════════════════════════════════════════════════════ */
        const strategy = (function makeQuotaSequence() {
            let globalIdx = 0;
            let curKey    = null;
            let curPos    = 0;
            let usedInCat = 0;
            let quota     = 0;
            function advanceToNextKey() {
                const k = FLAT_META[globalIdx % FLAT_META.length].k;
                while (FLAT_META[globalIdx % FLAT_META.length].k === k)
                    globalIdx = (globalIdx + 1) % FLAT_META.length;
                return k;
            }
            return {
                flush: false,
                reset() {
                    if (curKey !== null) {
                        while (FLAT_META[globalIdx % FLAT_META.length].k === curKey)
                            globalIdx = (globalIdx + 1) % FLAT_META.length;
                        curKey = null;
                    }
                    this.flush = false;
                },
                getColor() {
                    const prevKey = curKey;
                    if (curKey === null || usedInCat >= quota) {
                        const k   = advanceToNextKey();
                        const arr = IMAGE_GROUPS[k];
                        quota     = arr.length;
                        curKey    = k;
                        curPos    = 0;
                        usedInCat = 0;
                        this.flush = (prevKey !== null);
                    } else {
                        this.flush = false;
                    }
                    const arr = IMAGE_GROUPS[curKey];
                    const c   = arr[curPos % arr.length];
                    curPos++;
                    usedInCat++;
                    return c;
                }
            };
        })();

        const pickColor = () => strategy.getColor();

        /* ═══ CONTAINER RECT (position: absolute → need offset) ═══ */
        let containerRect = trailEl.getBoundingClientRect();
        let rectDirty = false;

        const marqueeEl = $id('hero-brandsMarqueeWrapper');
        let trailMaxY = containerRect.bottom;

        function updateContainerRect() {
            containerRect = trailEl.getBoundingClientRect();
            if (marqueeEl) {
                trailMaxY = marqueeEl.getBoundingClientRect().bottom;
            }
            rectDirty = false;
        }
        listen(window, 'resize', updateContainerRect);
        listen(window, 'scroll', () => { rectDirty = true; }, { passive: true });
        updateContainerRect();

        /* ═══ STATE ═══ */
        const trail  = [];
        const dying  = new Set();

        // Ring buffer — zero alokacji w runtime (eliminuje GC pressure)
        const HIST_SIZE = 12;
        const histX = new Float32Array(HIST_SIZE);
        const histY = new Float32Array(HIST_SIZE);
        const histT = new Float32Array(HIST_SIZE);
        let histHead = 0, histLen = 0;

        let mx = 0, my = 0;
        let lmx = 0, lmy = 0;
        let cmx = 0, cmy = 0;
        let isMoving = false;
        let lastMoveT = 0;
        let zIdx = 1;

        /* ═══ HELPERS ═══ */
        const SIZE_MIN   = Math.round(V.SIZE_MAX * V.SIZE_MIN_RATIO);  // pre-computed
        const getSize    = (t) => V.SIZE_MAX - (V.SIZE_MAX - SIZE_MIN) * t;
        const getSpacing = (t) => V.SPACING_SLOW + (V.SPACING_FAST - V.SPACING_SLOW) * t;
        const dist       = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
        const lerp       = (a, b, n) => (1 - n) * a + n * b;

        const pushHistory = (x, y) => {
            const now = performance.now();
            histX[histHead] = x;
            histY[histHead] = y;
            histT[histHead] = now;
            histHead = (histHead + 1) % HIST_SIZE;
            if (histLen < HIST_SIZE) histLen++;

            // Trim old entries (equivalent to while loop)
            while (histLen > 1) {
                const oldest = (histHead - histLen + HIST_SIZE) % HIST_SIZE;
                if (now - histT[oldest] > V.HISTORY_MS) histLen--;
                else break;
            }
        };

        const getSpeed = () => {
            if (histLen < 2) return 0;
            const oldest = (histHead - histLen + HIST_SIZE) % HIST_SIZE;
            const newest = (histHead - 1 + HIST_SIZE) % HIST_SIZE;
            const dt = histT[newest] - histT[oldest];
            if (dt < 4) return 0;
            return Math.hypot(histX[newest] - histX[oldest], histY[newest] - histY[oldest]) / dt;
        };

        const speedNorm = () => Math.min(1, Math.max(0,
            (getSpeed() - V.SPEED_FLOOR) / (V.SPEED_CEIL - V.SPEED_FLOOR)));

        const getLifespan = () => {
            let alive = 0;
            for (let i = 0; i < trail.length; i++) {
                if (!dying.has(trail[i])) alive++;
            }
            const ratio = 1 - Math.min(alive / V.MAX_VISIBLE, 1);
            return V.LIFESPAN_BASE + (V.LIFESPAN_MAX - V.LIFESPAN_BASE) * ratio;
        };

        /* ═══ KILL ═══ */
        const kill = (obj, outS) => {
            if (dying.has(obj)) return;
            dying.add(obj);

            if (obj.animTarget) {
                gsap.killTweensOf(obj.animTarget);
                gsap.killTweensOf(obj.wrap);
            }
            if (obj.flash) {
                gsap.killTweensOf(obj.flash);
            }

            // Mask-close exit: photo counter-scales UP while mask shrinks DOWN
            if (obj.animTarget) {
                gsap.to(obj.animTarget, {
                    scale: 3, duration: outS, ease: V.OUT_EASE, overwrite: "auto"
                });
            }

            gsap.to(obj.inner, {
                scale: 0, duration: outS, ease: V.OUT_EASE, overwrite: "auto"
            });
            gsap.to(obj.wrap, {
                rotation: obj.rot + 360, duration: outS, ease: V.OUT_EASE,
                overwrite: "auto",
                onComplete: () => { obj.wrap.remove(); dying.delete(obj); }
            });
        };

        /* ═══ SPAWN ═══ */
        const spawn = (t) => {
            const key   = pickColor();                   // 'A1'…'D4' — QuotaCycle zarządza grupą

            // EarlyFlush: przy zmianie grupy ubij żywych natychmiast → 0% miksów
            if (strategy.flush) {
                for (let i = 0; i < trail.length; i++) {
                    if (!dying.has(trail[i])) kill(trail[i], V.OUT_S_FLUSH);
                }
            }

            const w = getSize(t);
            const h = w * V.ASPECT;
            const rot = (Math.random() - 0.5) * V.MAX_ROT * 2;
            const lifespan = getLifespan();

            const entryExtra = (V.ENTRY_ROT_MIN + Math.random() * (V.ENTRY_ROT_MAX - V.ENTRY_ROT_MIN))
                             * (Math.random() < 0.5 ? -1 : 1);
            const startRot = rot + entryExtra;

            // Convert viewport coords → container-local coords
            const x = mx - containerRect.left;
            const y = my - containerRect.top;
            const cx = cmx - containerRect.left;
            const cy = cmy - containerRect.top;

            const wrap = document.createElement("div");
            wrap.className = "trail-wrap hw-hint";
            wrap.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;

            const inner = document.createElement("div");
            inner.className = "trail-block is-photo";
            inner.style.borderRadius = V.BORDER_RADIUS + "px";

            const img = _getPhotoEl(key);
            img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";

            // Flash overlay (GPU-optimized — opacity jest COMPOSITE, nie PAINT)
            const flash = document.createElement("div");
            flash.className = "trail-flash";
            inner.appendChild(img);
            inner.appendChild(flash);
            wrap.appendChild(inner);
            trailEl.appendChild(wrap);

            ++zIdx;

            // Cache→mouse vector for drift direction
            const dx = mx - cmx;
            const dy = my - cmy;
            const cdist = Math.sqrt(dx * dx + dy * dy);
            let ndx = 0, ndy = 0;
            if (cdist > 0) { ndx = dx / cdist; ndy = dy / cdist; }
            // Sublinear drift: ≤100px unchanged, above → compressed by sqrt
            // Slow mouse (cdist=50): raw=0.5 → 0.5 (unchanged)
            // Medium (cdist=150): raw=1.5 → 1.0 + sqrt(0.5)*0.2 = ~1.14
            // Fast (cdist=300): raw=3.0 → 1.0 + sqrt(2.0)*0.2 = ~1.28 (capped at DRIFT_CAP)
            const rawDrift = cdist / 100;
            const driftScale = rawDrift <= 1
                ? rawDrift
                : Math.min(1 + Math.sqrt(rawDrift - 1) * 0.2, V.DRIFT_CAP);
            ndx *= driftScale;
            ndy *= driftScale;

            gsap.set(wrap, { xPercent: -50, yPercent: -50, rotation: startRot, opacity: 1, zIndex: zIdx });

            // Entry — wrap: slide from cache→mouse + scale 0→1
            gsap.fromTo(wrap,
                { x: cx - x, y: cy - y, scale: 0 },
                { x: 0, y: 0, scale: 1, duration: V.IN_S, ease: V.IN_EASE, overwrite: "auto" }
            );
            // Entry — rotation spin
            gsap.to(wrap, {
                rotation: rot, duration: V.IN_S, ease: V.IN_ROT_EASE, overwrite: "auto"
            });
            // Entry — scale on img
            gsap.fromTo(img,
                { scale: V.INNER_MASK_START },
                { scale: 1, duration: V.IN_S, ease: V.IN_EASE }
            );
            // Entry — flash overlay (opacity = GPU COMPOSITE, nie PAINT!)
            gsap.fromTo(flash,
                { opacity: 0 },
                {
                    keyframes: [
                        { opacity: 0, duration: 0 },
                        { opacity: 0.7, duration: 0.12, ease: "power2.out" },
                        { opacity: 0, duration: 0.48, ease: "power2.inOut" }
                    ]
                }
            );
            // Drift — momentum slide in movement direction
            gsap.to(wrap, {
                x: `+=${ndx * V.DRIFT_MULT}`, y: `+=${ndy * V.DRIFT_MULT}`,
                duration: V.DRIFT_S, ease: V.DRIFT_EASE, delay: 0.05
            });

            trail.push({ wrap, inner, animTarget: img, flash, rot, born: performance.now(), die: performance.now() + lifespan });
        };

        /* ═══ SPAWN / CLEANUP LOOP ═══ */
        const isInContainer = (x, y) => {
            return x >= containerRect.left && x <= containerRect.right
                && y >= containerRect.top && y <= trailMaxY;
        };

        const trySpawn = () => {
            if (!isMoving) return;
            if (!isInContainer(mx, my)) return;
            const t = speedNorm();
            // First spawn after all photos died: skip spacing, spawn immediately
            if (!trailWasEmpty && dist(mx, my, lmx, lmy) < getSpacing(t)) return;
            lmx = mx; lmy = my;
            trailWasEmpty = false;
            spawn(t);
        };

        const cleanup = () => {
            const now = performance.now();
            let alive = 0;
            for (let i = 0; i < trail.length; i++) {
                if (!dying.has(trail[i])) alive++;
            }

            if (alive === 0 && zIdx !== 1) zIdx = 1;

            let i = 0;
            while (alive > V.MAX_VISIBLE && i < trail.length) {
                // Overflow: new photo pushes oldest out — no age guard
                // (the dying→entering overlap is the ONLY moment 4 can coexist)
                if (!dying.has(trail[i])) {
                    kill(trail[i], V.OUT_S_FAST); alive--;
                }
                i++;
            }
            while (trail.length && !dying.has(trail[0]) && now >= trail[0].die) {
                kill(trail[0], V.OUT_S);
                trail.shift();
            }
            while (trail.length && dying.has(trail[0])) trail.shift();
        };

        /* ═══ MOUSE INPUT (registered at activation, not at init) ═══ */
        listen(document, "mouseover", function init(e) {
            mx = lmx = cmx = e.clientX;
            my = lmy = cmy = e.clientY;
            pushHistory(mx, my);
            document.removeEventListener("mouseover", init);
        });

        /* ═══ DEFERRED ACTIVATION ═══
           Trail is the LAST hero subsystem to activate.
           Two conditions must both be met:
             1. window 'load' fired (all hero assets: fonts, Lottie, CSS, images)
             2. Minimum 3.5s elapsed since heroSectionInit start
           This prevents visual overload during hero entrance animation. */

        /* ═══ PRELOAD ALL TRAIL IMAGES ═══
           Efekt trail NIE włącza się dopóki wszystkie 16 zdjęć nie są załadowane.
           Dzięki temu flash (brightness) działa na widocznym obrazku, nie na pustym. */

        let imagesPreloaded = false;

        function preloadAllImages() {
            return new Promise<void>((resolve) => {
                const keys = FLAT_META.map(m => m.c);  // ['A1','A2',...,'D4']
                const res = _useRetina ? '_RETINA' : '';
                const fmt = (_avifSupported === false) ? 'webp' : 'avif';

                let loaded = 0;
                const total = keys.length;

                keys.forEach(key => {
                    const img = new Image();
                    img.onload = img.onerror = () => {
                        loaded++;
                        if (loaded >= total) {
                            imagesPreloaded = true;
                            resolve();
                        }
                    };
                    img.src = `/trail/${key}_strrona_internetowa${res}.${fmt}`;
                });
            });
        }

        let trailActive = false;

        function activateTrail() {
            if (trailActive) return;
            if (!imagesPreloaded) return;
            trailActive = true;

            addHfListener(document, "mousemove", (e) => {
                mx = e.clientX;
                my = e.clientY;
                pushHistory(mx, my);
                isMoving = true;
                lastMoveT = performance.now();
            }, { passive: true });

            addTickFn(tick);
        }

        let trailWasEmpty = true; // skip spacing on first spawn after pause

        function tick() {
            if (isMoving && performance.now() - lastMoveT > 100) isMoving = false;

            // Always update cache position — prevents stale cmx/cmy after pause
            cmx = lerp(cmx, mx, 0.1);
            cmy = lerp(cmy, my, 0.1);

            // Always update rect if dirty — prevents stale bounds after scroll
            if (rectDirty) updateContainerRect();

            if (!isMoving && trail.length === 0) return;

            // Track: are there any alive (non-dying) photos on screen?
            // If not → next spawn skips spacing check (immediate response to movement)
            let alive = 0;
            for (let i = 0; i < trail.length; i++) {
                if (!dying.has(trail[i])) alive++;
            }
            if (alive === 0) { trailWasEmpty = true; strategy.reset(); }

            trySpawn();
            cleanup();
        }

        const TRAIL_MIN_DELAY = 3500; // ms from hero init

        function tryActivate() {
            const elapsed = performance.now() - heroInitT0;
            if (elapsed >= TRAIL_MIN_DELAY) {
                preloadAllImages().then(activateTrail);
            } else {
                trackedTimeout(() => {
                    preloadAllImages().then(activateTrail);
                }, TRAIL_MIN_DELAY - elapsed);
            }
        }

        // W React init() jest zawsze wywołany po mount → readyState === 'complete'.
        // Reference.html: skrypt na końcu <body> → DOMContentLoaded już wystrzelił.
        // Nie rejestrujemy window.load wewnątrz init() (INIT-DOM-01).
        tryActivate();

        // Trail cleanup for global kill()
        cleanups.push(() => {
            trail.forEach(obj => {
                gsap.killTweensOf(obj.wrap);
                gsap.killTweensOf(obj.inner);
                gsap.killTweensOf(obj.animTarget);
                if (obj.flash) gsap.killTweensOf(obj.flash);
                obj.wrap.remove();
            });
            trail.length = 0;
            dying.clear();
        });

        })();
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 5B: VARIABLE PROXIMITY H1 — USUNIĘTY
    // Efekt powiększania wagi liter H1 przy kursorze usunięty.
    // ═════════════════════════════════════════════════════════════════

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 6: MOBILE BG FADEOUT
    // ═════════════════════════════════════════════════════════════════
    {
            const banner = container;
            const heroContent = $('.hero-content');
            if (banner && heroContent) {
            
            function updateCutoff() {
                if (window.innerWidth > 600) {
                    banner.style.removeProperty('--bg-cutoff');
                    return;
                }
                const bannerRect = banner.getBoundingClientRect();
                const heroRect = heroContent.getBoundingClientRect();
                const actionArea = $('.action-area');
                const actionRect = actionArea ? actionArea.getBoundingClientRect() : heroRect;
                const cutoff = heroRect.bottom - bannerRect.top + (actionRect.height / 2);
                banner.style.setProperty('--bg-cutoff', cutoff + 'px');
            }
            
            // W React init() jest zawsze wywołany po mount → readyState === 'complete'.
            // Nie rejestrujemy window.load wewnątrz init() (INIT-DOM-01).
            updateCutoff();
            
            // Aktualizacja przy resize
            let cutoffTimeout;
            let lastCutoffW = window.innerWidth;
            listen(window, 'resize', () => {
                if (window.innerWidth === lastCutoffW) return; // skip height-only (mobile address bar)
                lastCutoffW = window.innerWidth;
                clearTimeout(cutoffTimeout);
                cutoffTimeout = trackedTimeout(updateCutoff, 250);
            });
            } // end if (banner && heroContent)
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 7: CTA — MOBILE TOUCH HANDLING
    // ═════════════════════════════════════════════════════════════════
    {
        const ctaWrapper = $('.btn-wrapper-wave');
        if (ctaWrapper) {
            ctaWrapper.addEventListener('touchstart', function() {
                this.classList.add('touching');
            }, { passive: true });
            ctaWrapper.addEventListener('touchend', function() {
                this.classList.remove('touching');
            }, { passive: true });
            ctaWrapper.addEventListener('touchcancel', function() {
                this.classList.remove('touching');
            }, { passive: true });
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 8: CTA — SEASON PILL
    // ═════════════════════════════════════════════════════════════════
    {
        function seasonPillPL() {
            const now = new Date();
            const m = now.getMonth();
            const d = now.getDate();
            const hard = d >= 15;
            if (m === 0 || m === 1) return hard ? "Ostatnie terminy na start roku" : "Zacznij rok z nową stroną";
            if (m === 2 || m === 3) return hard ? "Ostatnie terminy na majówkę" : "Strona gotowa na majówkę";
            if (m === 4 || m === 5) return hard ? "Ostatnie terminy przed urlopami" : "Start przed urlopami";
            if (m === 6) return "Strona gotowa na wrzesień";
            if (m === 7) return hard ? "Ostatnie terminy na wrzesień" : "Strona gotowa na wrzesień";
            if (m === 8 || m === 9) return hard ? "Ostatnie terminy na jesień" : "Strona gotowa na jesień";
            if (m === 10) return hard ? "Ostatnie terminy przed świętami" : "Strona gotowa przed świętami";
            return hard ? "Ostatnie terminy w tym roku" : "Domknij projekt w tym roku";
        }
        const seasonEl = $id("hero-season-pill");
        if (seasonEl) { const txt = seasonPillPL(); if (txt) seasonEl.textContent = txt; }
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 9: CTA — BRAIN TIP TOOLTIP (disabled <600px via CSS)
    // ═════════════════════════════════════════════════════════════════
    {
        const ctaBtn = $('.cta-button');
        const ctaPendulum = $('.pendulum-container');
        const ctaSeasonPill = $('.cta-note');
        const ctaTooltip = $id('hero-brainTooltip');
        const ctaCloseBtn = ctaTooltip ? ctaTooltip.querySelector('.tooltip-close') : null;
        
        if (ctaTooltip) {
            let ctaHoverTimer = null;
            let ctaIsDismissed = false;
            const TRIGGER_AT_TAP2_CYCLE2 = 8105;
            
            function showCtaTooltip() {
                if (ctaIsDismissed || window.innerWidth < 600) return;
                ctaTooltip.classList.add('visible');
            }
            function hideCtaTooltip() { ctaTooltip.classList.remove('visible'); ctaIsDismissed = true; }
            
            if (ctaPendulum) listen(ctaPendulum, 'mouseenter', showCtaTooltip);
            if (ctaSeasonPill) listen(ctaSeasonPill, 'mouseenter', showCtaTooltip);
            
            if (ctaBtn) {
                listen(ctaBtn, 'mouseenter', () => {
                    if (ctaIsDismissed || window.innerWidth < 600) return;
                    ctaHoverTimer = trackedTimeout(showCtaTooltip, TRIGGER_AT_TAP2_CYCLE2);
                });
                listen(ctaBtn, 'mouseleave', () => {
                    if (ctaHoverTimer) { clearTimeout(ctaHoverTimer); ctaHoverTimer = null; }
                });
            }
            // Dismiss on resize — prevents accidental trigger when scaling
            listen(window, 'resize', () => {
                if (ctaHoverTimer) { clearTimeout(ctaHoverTimer); ctaHoverTimer = null; }
                ctaTooltip.classList.remove('visible');
            });
            if (ctaCloseBtn) {
                listen(ctaCloseBtn, 'click', (e) => { e.stopPropagation(); hideCtaTooltip(); });
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // SHARED STAR SPRITES — used by both Halo (Block 10) and Cursor (Block 11)
    // 3 twinkle phases × star shape + 1 dot sprite. Created once, drawn thousands of times.
    // ═════════════════════════════════════════════════════════════════
    const STAR_PTS = 8;
    const starCos = new Float32Array(STAR_PTS), starSin = new Float32Array(STAR_PTS);
    for (let i = 0; i < STAR_PTS; i++) { const a = (i * Math.PI) / 4; starCos[i] = Math.cos(a); starSin[i] = Math.sin(a); }

    const STAR_SPR_SZ = 128;
    const STAR_SPR_HALF = STAR_SPR_SZ / 2;
    const sharedStarPhases = [0, 0.5, 1.0].map(tw => {
        const c = document.createElement('canvas'); c.width = STAR_SPR_SZ; c.height = STAR_SPR_SZ;
        const ctx = c.getContext('2d');
        if (!ctx) return c;
        ctx.translate(STAR_SPR_HALF, STAR_SPR_HALF);
        const gr = ctx.createRadialGradient(0,0,0, 0,0, STAR_SPR_HALF);
        gr.addColorStop(0,'#ffffff');
        gr.addColorStop(0.3,'#fffde8');
        gr.addColorStop(0.6,'#ffeaa0');
        gr.addColorStop(1,'rgba(255,234,160,0)');
        ctx.fillStyle = gr;
        const refSize = STAR_SPR_HALF / 2;
        const oR = refSize * (1.4 + tw * 0.5);
        const iR = refSize * 0.35;
        ctx.beginPath();
        for (let i=0;i<STAR_PTS;i++){
            const r=(i&1)===0?oR:iR;
            if(i===0) ctx.moveTo(starCos[i]*r,starSin[i]*r);
            else ctx.lineTo(starCos[i]*r,starSin[i]*r);
        }
        ctx.closePath(); ctx.fill();
        return c;
    });
    const sharedDotSprite = document.createElement('canvas'); sharedDotSprite.width = 64; sharedDotSprite.height = 64;
    {
        const ctx = sharedDotSprite.getContext('2d');
        if (ctx) {
            ctx.translate(32, 32);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0,0, 32*0.15, 0, Math.PI*2); ctx.fill();
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 10: CTA — HALO CANVAS (aureola, desktop only)
    // ═════════════════════════════════════════════════════════════════
    {
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth >= 600) {
            const haloWrapper = $('.btn-wrapper-wave');
            const haloButton = $('.cta-button');
            if (haloWrapper && haloButton) {
                const haloCanvas = document.createElement('canvas');
                const haloCtx = haloCanvas.getContext('2d');
                if (haloCtx) {
                haloCanvas.style.cssText = 'position:absolute;top:-100%;left:-100%;width:300%;height:300%;pointer-events:none;z-index:5';
                const ref = haloWrapper.firstChild;
                if (ref && haloWrapper.contains(ref)) haloWrapper.insertBefore(haloCanvas, ref);
                else haloWrapper.appendChild(haloCanvas);
                
                let hW, hH, hCX, hCY, hBtnW = 0;
                const H_PROX_X = 400, H_PROX_Y = 180, H_PROX_EXIT_X = 415, H_PROX_EXIT_Y = 195;
                let hIsHover = false, hIsProx = false, hWasHovered = false;
                let hBtnRect = null, hBtnCX = 0, hBtnCY = 0;
                
                function hUpdateRect() { hBtnRect = haloButton.getBoundingClientRect(); hBtnCX = hBtnRect.left + hBtnRect.width/2; hBtnCY = hBtnRect.top + hBtnRect.height/2; }
                function hShouldBeActive() { return hIsHover || (hIsProx && !hWasHovered); }
                
                let hAnimId = null, hIsAnim = false, hResizeSched = false;
                function hResize() {
                    hResizeSched = false;
                    const dpr = window.devicePixelRatio || 1;
                    const r = haloWrapper.getBoundingClientRect();
                    hBtnW = haloButton.getBoundingClientRect().width;
                    hW = r.width * 3; hH = r.height * 3;
                    haloCanvas.width = hW * dpr; haloCanvas.height = hH * dpr;
                    haloCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    hCX = hW / 2; hCY = hH / 2;
                    hUpdateRect();
                }
                function hSchedResize() { if (!hResizeSched) { hResizeSched = true; requestAnimationFrame(hResize); } }
                listen(window, 'resize', hSchedResize);
                hResize();
                
                const hRand = (a, b) => Math.random() * (b - a) + a;
                
                class HaloP {
                    constructor() { this.init(); }
                    init() {
                        this.angle = hRand(0, Math.PI*2); this.radius = (hBtnW > 0 ? hBtnW : 200) * 0.55;
                        this.angleSpeed = hRand(0.0056, 0.0105) * (Math.random() > 0.5 ? 1 : -1);
                        this.masterAlpha = 0; this.fadeRate = hRand(0.015, 0.035); this.wakeDelay = hRand(0, 20);
                        this.baseSize = Math.random() < 0.75 ? hRand(2, 4) : hRand(5, 8);
                        this.rotation = hRand(0, Math.PI*2); this.rotationSpeed = (Math.random()-0.5)*0.1;
                        this.twinkle = hRand(0, Math.PI*2); this.twinkleSpeed = hRand(0.1, 0.28);
                    }
                    update() {
                        // 2× step: physics calibrated for 60fps, we run at 30fps
                        this.angle += this.angleSpeed * 2; this.rotation += this.rotationSpeed * 2; this.twinkle += this.twinkleSpeed * 2;
                        if (hShouldBeActive()) { if (this.wakeDelay > 0) this.wakeDelay--; else if (this.masterAlpha < 1) this.masterAlpha += this.fadeRate; }
                        else { this.wakeDelay = hRand(0, 15); if (this.masterAlpha > 0) this.masterAlpha -= this.fadeRate; }
                        const sA = Math.sin(this.angle), cA = Math.cos(this.angle);
                        this.x = hCX + cA * this.radius * 0.6;
                        this.y = (hCY - 39) + sA * this.radius * 0.12;
                        this.size = this.baseSize * (1.5 - (sA+1)*0.45);
                        this.life = this.masterAlpha;
                    }
                    draw(dpr) {
                        if (this.life <= 0.01) return;
                        const tw = (Math.sin(this.twinkle)+1)*0.5, al = this.life*(0.5+tw*0.5);
                        const co = Math.cos(this.rotation), si = Math.sin(this.rotation);
                        haloCtx.setTransform(co*dpr, si*dpr, -si*dpr, co*dpr, this.x*dpr, this.y*dpr);
                        haloCtx.globalAlpha = al;
                        // Select nearest twinkle phase sprite (0→compact, 1→medium, 2→expanded)
                        const phase = tw < 0.25 ? 0 : tw < 0.75 ? 1 : 2;
                        // Draw star sprite: sprite covers ±(size*2) in particle coords
                        const drawR = this.size * 2;
                        haloCtx.drawImage(sharedStarPhases[phase], -drawR, -drawR, drawR*2, drawR*2);
                        // White center dot — life alpha only (no twinkle), more stable anchor
                        haloCtx.globalAlpha = this.life;
                        haloCtx.drawImage(sharedDotSprite, -drawR, -drawR, drawR*2, drawR*2);
                    }
                }
                
                const hParts = []; for (let i=0;i<50;i++) hParts.push(new HaloP());
                function hCheckFaded() { for (let i=0;i<hParts.length;i++) if (hParts[i].masterAlpha>0.01) return false; return true; }
                const H_FRAME_MS = 1000 / 30; // 30fps throttle — sparkles don't need 60fps
                let hLastPaint = 0;
                function hAnimate(ts) {
                    if (ts - hLastPaint < H_FRAME_MS) { hAnimId = requestAnimationFrame(hAnimate); return; }
                    hLastPaint = ts;
                    const dpr = window.devicePixelRatio || 1;
                    haloCtx.setTransform(dpr,0,0,dpr,0,0); haloCtx.clearRect(0,0,hW,hH);
                    haloCtx.globalCompositeOperation = 'lighter';
                    for (let i=0;i<hParts.length;i++){hParts[i].update();hParts[i].draw(dpr);}
                    if (!hShouldBeActive() && hCheckFaded()) { hIsAnim = false; hAnimId = null; return; }
                    hAnimId = requestAnimationFrame(hAnimate);
                }
                function hStart() { if (!hIsAnim) { hIsAnim = true; hAnimId = requestAnimationFrame(hAnimate); } }
                
                listen(haloButton, 'mouseenter', () => { hIsHover = true; hStart(); });
                listen(haloButton, 'mouseleave', () => { hIsHover = false; hWasHovered = true; });
                
                // ── GLOBAL LISTENERS (always alive — cheap math only) ──
                // mousemove: proximity check = ~0.01ms (Math.abs × 2)
                // scroll: dirty flag only, NO getBoundingClientRect per event
                let hRectDirty = false;
                
                addHfListener(document, 'mousemove', (e) => {
                    // Lazy rect update: only recalc when scroll moved AND mouse active
                    if (hRectDirty) { hUpdateRect(); hRectDirty = false; }
                    if (!hBtnRect) hUpdateRect();
                    const dx = Math.abs(e.clientX - hBtnCX), dy = Math.abs(e.clientY - hBtnCY);
                    if (!hIsProx && dx < H_PROX_X && dy < H_PROX_Y) { hIsProx = true; if (!hIsHover && !hWasHovered) hStart(); }
                    else if (hIsProx && (dx > H_PROX_EXIT_X || dy > H_PROX_EXIT_Y)) { hIsProx = false; hWasHovered = false; }
                }, { passive: true });
                listen(window, 'scroll', () => { hRectDirty = true; }, { passive: true });
                
                // Expose hooks for killActionArea / reviveActionArea
                // Kill: stop rAF + reset state (listeners stay — they're cheap)
                // Revive: refresh rect + allow restart on next interaction
                haloKillFn = () => {
                    if (hAnimId) { cancelAnimationFrame(hAnimId); hAnimId = null; }
                    hIsAnim = false;
                    hIsProx = false;
                    hWasHovered = false;
                    hIsHover = false;
                    hRectDirty = true; // force rect refresh on revive
                };
                haloReviveFn = () => {
                    hUpdateRect();
                    hRectDirty = false;
                };
                
                listen(document, 'visibilitychange', () => { if (document.hidden) { hIsHover = false; hIsProx = false; hWasHovered = false; } });
                
                cleanups.push(() => {
                    if (hAnimId) { cancelAnimationFrame(hAnimId); hAnimId = null; }
                    hIsAnim = false;
                    haloKillFn = null; haloReviveFn = null;
                });
                } // end if (haloCtx)
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 11: CTA — CURSOR CANVAS (sparkles, desktop only)
    // ═════════════════════════════════════════════════════════════════
    {
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth >= 600) {
            const cWrapper = $('.btn-wrapper-wave');
            const cButton = $('.cta-button');
            if (cWrapper && cButton) {
                const cCanvas = document.createElement('canvas');
                const cCtx = cCanvas.getContext('2d');
                if (cCtx) {
                cCanvas.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:100';
                cCanvas.width = 500; cCanvas.height = 300;
                cWrapper.appendChild(cCanvas);
                
                let cIsHover = false, cLastSpawn = 0;
                const cSpawnRate = 31;
                let cMX = 250, cMY = 150, cTMX = 250, cTMY = 150, cLMX = 250, cLMY = 150;
                let cMSpeed = 0, cMAngle = 0, cSmSpeed = 0, cIdleTime = 0, cLastTs = 0;
                let cAnimId = null, cIsAnim = false;
                const C_MAX = 150;
                const cParts = new Array(C_MAX).fill(null);
                let cActive = 0;
                
                // Glow sprite (cursor-specific — warm halo for 25% of particles)
                const cGlow = document.createElement('canvas'); cGlow.width = 128; cGlow.height = 128;
                const cGCtx = cGlow.getContext('2d');
                if (cGCtx) {
                    const cGG = cGCtx.createRadialGradient(64,64,0,64,64,64);
                    cGG.addColorStop(0,'rgba(255,255,255,1)'); cGG.addColorStop(0.2,'rgba(255,253,232,0.71)');
                    cGG.addColorStop(0.5,'rgba(255,234,160,0.29)'); cGG.addColorStop(1,'rgba(255,234,160,0)');
                    cGCtx.fillStyle = cGG; cGCtx.fillRect(0,0,128,128);
                }
                
                let cRect = null, cScX = 1, cScY = 1;
                function cUpdateRect() { cRect = cCanvas.getBoundingClientRect(); cScX = cCanvas.width / cRect.width; cScY = cCanvas.height / cRect.height; }
                requestAnimationFrame(cUpdateRect);
                let cResizeSched = false;
                listen(window, 'resize', () => { if (!cResizeSched) { cResizeSched = true; requestAnimationFrame(() => { cUpdateRect(); cResizeSched = false; }); } });
                
                const cRand = (a, b) => Math.random() * (b-a) + a;
                
                addHfListener(cWrapper, 'mousemove', (e) => { if (!cRect) return; cTMX = (e.clientX-cRect.left)*cScX; cTMY = (e.clientY-cRect.top)*cScY; });
                listen(cButton, 'mouseenter', () => { cIsHover = true; cUpdateRect(); cStartAnim(); });
                listen(cButton, 'mouseleave', () => { cIsHover = false; });
                
                class CurP {
                    constructor() { this.reset(0,0,0,0); }
                    reset(x,y,sp,an) {
                        this.x=x; this.y=y;
                        this.size = Math.random()<0.25 ? cRand(5.625,8.625) : cRand(2.25,4.375);
                        this.hasGlow = Math.random() < 0.25;
                        const mv = sp > 0.5;
                        if (mv) { const oa=an+Math.PI, spr=(Math.random()-0.5)*Math.PI*0.6, ag=oa+spr, s=cRand(0.3,0.9)+sp*0.1; this.sx=Math.cos(ag)*s; this.sy=Math.sin(ag)*s; }
                        else { const ag=cRand(0,Math.PI*2), s=cRand(0.15,0.45); this.sx=Math.cos(ag)*s; this.sy=Math.sin(ag)*s; }
                        this.life=0; this.maxLife=1; this.fadeIn=0.07; this.isFI=true; this.decay=cRand(0.006,0.018);
                        this.grav=-0.002; this.rot=cRand(0,Math.PI*2); this.rotS=(Math.random()-0.5)*0.15;
                        this.tw=cRand(0,Math.PI*2); this.twS=cRand(0.1,0.32);
                        return this;
                    }
                    update() {
                        // 2× step: physics calibrated for 60fps, we run at 30fps
                        if (this.isFI) { this.life+=this.fadeIn*2; if (this.life>=this.maxLife){this.life=this.maxLife;this.isFI=false;} } else { this.life-=this.decay*2; }
                        this.x+=this.sx*2; this.y+=this.sy*2; this.sy+=this.grav*2; this.sx*=Math.pow(0.985,2); this.sy*=Math.pow(0.985,2);
                        this.rot+=this.rotS*2; this.tw+=this.twS*2;
                        return this.life>0;
                    }
                    draw() {
                        if (this.life<=0) return;
                        const tw=(Math.sin(this.tw)+1)*0.5, al=this.life*(0.5+tw*0.5);
                        const co=Math.cos(this.rot), si=Math.sin(this.rot);
                        cCtx.setTransform(co,si,-si,co,this.x,this.y);
                        if (this.hasGlow) { const gd=(this.size*4+10+tw*8)*0.75*2, go=-gd/2; cCtx.globalAlpha=al*0.35; cCtx.drawImage(cGlow,go,go,gd,gd); }
                        cCtx.globalAlpha=al;
                        // Select nearest twinkle phase
                        const phase = tw < 0.25 ? 0 : tw < 0.75 ? 1 : 2;
                        const drawR = this.size * 2;
                        cCtx.drawImage(sharedStarPhases[phase], -drawR, -drawR, drawR*2, drawR*2);
                        // White center dot — life alpha only
                        cCtx.globalAlpha = this.life;
                        cCtx.drawImage(sharedDotSprite, -drawR, -drawR, drawR*2, drawR*2);
                    }
                }
                
                const cPool = [];
                function cGetP(x,y,s,a) { let p=cPool.pop(); if(!p) p=new CurP(); return p.reset(x,y,s,a); }
                function cRelP(p) { if (cPool.length<50) cPool.push(p); }
                function cSpawn() {
                    if (cActive>=C_MAX) return;
                    const minR=10,maxR=30,offY=Math.random()<0.9?28:0;
                    let sR,sA;
                    if(cSmSpeed>0.5){const oa=cMAngle+Math.PI;sA=oa+(Math.random()-0.5)*Math.PI*0.8;sR=minR+Math.random()*(maxR-minR)+cSmSpeed*3;}
                    else{sA=cRand(0,Math.PI*2);sR=minR+Math.random()*(maxR-minR);}
                    const px=cMX+Math.cos(sA)*sR, py=cMY+Math.sin(sA)*sR+offY;
                    const p=cGetP(px,py,cSmSpeed,cMAngle);
                    for(let i=0;i<C_MAX;i++){if(cParts[i]===null){cParts[i]=p;cActive++;return;}}
                }
                function cStartAnim() { if (!cIsAnim) { cIsAnim=true; cLastTs=performance.now(); cAnimId=requestAnimationFrame(cAnimate); } }
                const C_FRAME_MS = 1000 / 30; // 30fps throttle
                let cLastPaint = 0;
                function cAnimate(ts) {
                    if (ts - cLastPaint < C_FRAME_MS) { cAnimId = requestAnimationFrame(cAnimate); return; }
                    cLastPaint = ts;
                    const dt = cLastTs ? (ts-cLastTs)/1000 : 0; cLastTs = ts;
                    cMX+=(cTMX-cMX)*0.18; cMY+=(cTMY-cMY)*0.18;
                    const dx=cMX-cLMX, dy=cMY-cLMY; cMSpeed=Math.sqrt(dx*dx+dy*dy);
                    if (cMSpeed>0.1) cMAngle=Math.atan2(dy,dx);
                    cSmSpeed+=(cMSpeed-cSmSpeed)*0.15;
                    if (cSmSpeed<0.5) cIdleTime+=dt; else cIdleTime=0;
                    cLMX=cMX; cLMY=cMY;
                    cCtx.setTransform(1,0,0,1,0,0); cCtx.clearRect(0,0,cCanvas.width,cCanvas.height);
                    if (cIsHover) {
                        let rate=cSpawnRate; if(cIdleTime>0){rate=cSpawnRate*(1+1.5*Math.min(cIdleTime/3,1));}
                        if (ts-cLastSpawn>rate){cSpawn();cLastSpawn=ts;}
                    }
                    for(let i=0;i<C_MAX;i++){const p=cParts[i];if(!p)continue;if(p.update())p.draw();else{cRelP(p);cParts[i]=null;cActive--;}}
                    if (!cIsHover && cActive===0) { cIsAnim=false; cAnimId=null; return; }
                    cAnimId=requestAnimationFrame(cAnimate);
                }
                
                cleanups.push(() => { if (cAnimId) { cancelAnimationFrame(cAnimId); cAnimId = null; } cIsAnim = false; });
                } // end if (cCtx)
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 12: CTA — ROYAL PENDULUM ENGINE
    // ═════════════════════════════════════════════════════════════════
    {
        const rpCanvas = $id('hero-royalCanvas');
        if (rpCanvas) {
            const rpCtx = rpCanvas.getContext('2d', { alpha: false });
            if (rpCtx) {
            const RP_CONFIG = { BPM: 25.5, anchor: { x: 11.6, y: -12.0 }, armLength: 20.8, swingAmp: 0.65, precessionSpeed: 0.05, coreSize: 14.52 };
            const RP_VIRTUAL_START = 61.0, RP_VIRTUAL_END = 94.0, RP_TARGET_DURATION = 6.0;
            const RP_ORBIT_SPEED = (RP_VIRTUAL_END - RP_VIRTUAL_START) / RP_TARGET_DURATION;
            const RP_BPM_SCALE = (Math.PI * 2) / (60 / RP_CONFIG.BPM);
            const RP_FRAME_TIME = 1000 / 30;
            let rpLastRenderTime = 0, rpLoopDir = 1, rpSwingAcc = 0, rpOrbitAcc = RP_VIRTUAL_START, rpLastFrame = 0;
            let rpActive = true, rpRafId = null;

            // Pre-render static background gradient (never changes)
            const rpBgSprite = document.createElement('canvas');
            rpBgSprite.width = 16; rpBgSprite.height = 16;
            const rpBgCtx = rpBgSprite.getContext('2d');
            if (rpBgCtx) {
                const rpBg = rpBgCtx.createRadialGradient(11.5, 6.1, 0, 11.5, 6.1, 13.3);
                rpBg.addColorStop(0, 'rgba(130, 117, 104, 1)'); rpBg.addColorStop(1, 'rgba(0, 0, 0, 1)');
                rpBgCtx.fillStyle = rpBg; rpBgCtx.fillRect(0, 0, 16, 16);
            }
            
            function rpRender(timestamp) {
                if (!rpActive) { rpRafId = null; return; }
                if (rpLastFrame === 0) rpLastFrame = timestamp;
                let rpDt = (timestamp - rpLastFrame) / 1000;
                rpLastFrame = timestamp;
                if (rpDt > 0.1) rpDt = 0.1;
                rpSwingAcc += rpDt;
                rpOrbitAcc += rpDt * RP_ORBIT_SPEED * rpLoopDir;
                if (rpOrbitAcc >= RP_VIRTUAL_END) { rpOrbitAcc = RP_VIRTUAL_END; rpLoopDir = -1; }
                else if (rpOrbitAcc <= RP_VIRTUAL_START) { rpOrbitAcc = RP_VIRTUAL_START; rpLoopDir = 1; }
                
                if (timestamp - rpLastRenderTime >= RP_FRAME_TIME) {
                    rpLastRenderTime = timestamp;
                    const swT = rpSwingAcc * RP_BPM_SCALE;
                    const rawSw = Math.sin(swT) + (0.02 * Math.cos(swT * 0.5));
                    const swAngle = (rawSw + 0.05 * Math.sin(3 * swT)) * RP_CONFIG.swingAmp;
                    const slT = rpOrbitAcc * 0.5 * RP_CONFIG.precessionSpeed;
                    const orbAngle = slT + (Math.sin(slT * 0.5) * 0.5);
                    const sinSw = Math.sin(swAngle);
                    const lX = RP_CONFIG.armLength * sinSw * Math.cos(orbAngle);
                    const lZ = RP_CONFIG.armLength * sinSw * Math.sin(orbAngle);
                    const lY = RP_CONFIG.armLength * Math.cos(swAngle);
                    const bX = RP_CONFIG.anchor.x + lX, bY = RP_CONFIG.anchor.y + lY;
                    const sc = 1.0 + (lZ * 0.025);
                    rpCtx.globalCompositeOperation = 'source-over';
                    // Static BG from pre-rendered sprite (zero allocations)
                    rpCtx.drawImage(rpBgSprite, 0, 0);
                    const bOff = -2.4, yR = RP_CONFIG.coreSize * sc * 0.45, tR = RP_CONFIG.coreSize * sc;
                    const g = rpCtx.createRadialGradient(bX + 2.4 + bOff, bY - 2.4, 0, bX + bOff, bY, tR);
                    g.addColorStop(0, 'rgba(255, 208, 43, 1)'); g.addColorStop(yR / tR, 'rgba(240, 176, 0, 1)'); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    rpCtx.fillStyle = g; rpCtx.beginPath(); rpCtx.arc(bX + bOff, bY, tR, 0, Math.PI * 2); rpCtx.fill();
                }
                rpRafId = requestAnimationFrame(rpRender);
            }
            rpRafId = requestAnimationFrame(rpRender);

            // IO: pause rAF when canvas is off-screen
            const rpIO = trackObserver(new IntersectionObserver((entries) => {
                const vis = entries[0].isIntersecting;
                if (vis && !rpActive) {
                    rpActive = true;
                    rpLastFrame = 0; // reset dt to avoid physics jump
                    rpRafId = requestAnimationFrame(rpRender);
                } else if (!vis && rpActive) {
                    rpActive = false;
                    if (rpRafId) { cancelAnimationFrame(rpRafId); rpRafId = null; }
                }
            }, { rootMargin: '50px' }));
            rpIO.observe(rpCanvas);

            cleanups.push(() => { rpActive = false; if (rpRafId) { cancelAnimationFrame(rpRafId); rpRafId = null; } });
            } // end if (rpCtx)
        }
    }

        // ═════════════════════════════════════════════════════════════════
    // TYP B: PAUSE / RESUME / KILL
    // ═════════════════════════════════════════════════════════════════

    function pause() {
        marqueeStop?.();
        tickFns.forEach(fn => gsap.ticker.remove(fn));
        hfListeners.forEach(({ target, event, handler, options }) => {
            target.removeEventListener(event, handler, options);
        });
    }

    function resume() {
        marqueeStart?.();
        tickFns.forEach(fn => gsap.ticker.add(fn));
        hfListeners.forEach(({ target, event, handler, options }) => {
            target.addEventListener(event, handler, options);
        });
    }

    // P3-CLEAN-01: idempotency guard
    let _killed = false;

    function kill() {
        if (_killed) return;
        _killed = true;
        pause();
        cleanups.forEach(fn => { try { fn(); } catch(e) {} });
        timerIds.forEach(t => {
            if (t.type === 'timeout') clearTimeout(t.id);
            if (t.type === 'interval') clearInterval(t.id);
            if (t.type === 'raf') cancelAnimationFrame(t.id);
        });
        observersList.forEach(o => o?.disconnect?.());
        gsapInstances.forEach(inst => {
            try { inst?.revert?.(); } catch(e) {}
            try { inst?.kill?.(); } catch(e) {}
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ACTION AREA — MASTER IO KILL/REVIVE
    // Off-screen: total kill (zero memory/CPU). Re-entry: fresh start.
    // Lottie + foilShift already have own IOs — they'll self-manage.
    // Halo + Cursor are hover/proximity triggered — self-stop when idle.
    // ═══════════════════════════════════════════════════════════════════
    (function() {
        const actionArea = container?.querySelector('.action-area');
        if (!actionArea) return;
        
        const root = document.documentElement;
        let hasBeenVisible = false; // first load = CSS handles choreography
        
        // Re-entry delays (fast replay, not first-load choreography)
        const REENTRY_DELAYS = {
            '--badge-satysfakcji-delay': '0.15s',
            '--badge-google-delay': '0.15s',
            '--badge-20lat-delay': '0.15',
            '--lottie-delay': '150'
        };
        
        // Save original delays for restore after re-entry animation completes
        const originalDelays = {};
        Object.keys(REENTRY_DELAYS).forEach(k => {
            originalDelays[k] = getComputedStyle(root).getPropertyValue(k).trim();
        });
        
        function killActionArea() {
            // 1. Badge 20 lat (GSAP)
            badge20LatKill?.();
            
            // 2. Badge Google (CSS + JS)
            badgeGoogleKill?.();
            
            // 3. Halo canvas (unbind global listeners + stop rAF)
            haloKillFn?.();
            
            // 4. dormant attribute kills ALL CSS animations on children
            actionArea.setAttribute('data-dormant', '');
            
            // 5. foilShift goldLayer — reset opacity + playState to CSS initial
            const goldLayer = actionArea.querySelector('.layer-gold');
            if (goldLayer) {
                goldLayer.style.removeProperty('opacity');
                goldLayer.style.removeProperty('animation-play-state');
            }
        }
        
        function reviveActionArea() {
            // 1. Set fast re-entry delays
            Object.entries(REENTRY_DELAYS).forEach(([k, v]) => root.style.setProperty(k, v));
            
            // 2. Remove dormant — CSS animations restart with new delays
            actionArea.removeAttribute('data-dormant');
            void actionArea.offsetWidth; // force reflow — animations pick up
            
            // 3. Badge Google entrance
            badgeGoogleRevive?.();
            
            // 4. Badge 20 lat (GSAP) — reads --badge-20lat-delay internally
            badge20LatReplay?.();
            
            // 5. Halo canvas (rebind global listeners)
            haloReviveFn?.();
            
            // 6. Restore original delays after animations complete (~4s)
            trackedTimeout(() => {
                Object.entries(originalDelays).forEach(([k, v]) => root.style.setProperty(k, v));
            }, 4000);
        }
        
        const actionIO = trackObserver(new IntersectionObserver((entries) => {
            const visible = entries[0].isIntersecting;
            if (visible) {
                if (hasBeenVisible) {
                    // Re-entry → full revive (fresh start)
                    reviveActionArea();
                }
                hasBeenVisible = true;
            } else if (hasBeenVisible) {
                // Exit → total kill
                killActionArea();
            }
        }, { rootMargin: '50px' }));
        actionIO.observe(actionArea);
        
        cleanups.push(() => killActionArea());
    })();

    // ═══════════════════════════════════════════════════════════════════
    // FACTORY:CPU-GATING — Ścieżka 1: Typ B
    // IO wywołuje pause()/resume(). rootMargin: 0.5×VH, clamp 200–1200px.
    // Obserwuje: container (brak pin, brak data-gating-target).
    // Koegzystencja z 5 internal IO (rpIO, actionIO, pendulumIO, foilIO,
    // brandsIO) — bezpieczna: B-CPU-03 PASS + ENT-LC-06 PASS.
    // Asymetria: Factory rootMargin (~450px) >> internal (50px) — korzystna.
    // UWAGA: marqueeStop=null — marquee self-manages przez brandsVisibilityObserver.
    // Nie trafia do observersList[] — dynamic recreation zarządzana przez cleanups.
    // ═══════════════════════════════════════════════════════════════════
    (function() {
        const getVH = () => window.visualViewport?.height ?? window.innerHeight;
        const getMargin = () => Math.min(1200, Math.max(200, Math.round(0.5 * getVH())));

        let factoryGatingObs = null;

        function createGatingObserver(m) {
            const obs = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) resume();
                    else pause();
                },
                { rootMargin: `${m}px 0px`, threshold: 0.01 }
            );
            obs.observe(container);
            return obs;
        }

        function recreateGating() {
            if (factoryGatingObs) factoryGatingObs.disconnect();
            factoryGatingObs = createGatingObserver(getMargin());
        }

        recreateGating();

        const onViewportChange = () => recreateGating();
        window.addEventListener('resize', onViewportChange, { passive: true });
        window.addEventListener('orientationchange', onViewportChange, { passive: true });
        window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true });

        cleanups.push(() => {
            window.removeEventListener('resize', onViewportChange);
            window.removeEventListener('orientationchange', onViewportChange);
            window.visualViewport?.removeEventListener('resize', onViewportChange);
            if (factoryGatingObs) { factoryGatingObs.disconnect(); factoryGatingObs = null; }
        });
    })();
    // ═══ KONIEC FACTORY:CPU-GATING ═══

    // ════════════════════════════════════════════════════════════════════════
    // LOGO LOTTIE ENGINE
    // ════════════════════════════════════════════════════════════════════════
    // KONTEKST:
    //   Dotychczas: <svg class="main-logo"> — statyczny inline SVG, brak animacji
    //   Po zmianie: <div class="logo-lottie" id="hero-logo-lottie"> + lottie-web
    //
    // KLASYFIKACJA per Konstytucja:
    //   Priorytet: HOT (G2) — ładowany natychmiast, od pierwszego widoku
    //   Typ silnika: Typ B (D2) — per-frame renderer lottie-web (SVG rAF loop)
    //   Lifecycle: init natychmiast → kill gdy sekcja off-screen (G4)
    //   Kill: bez pause/resume — logo nie scrolluje, off-screen = destroy OK
    //   Hover: mouseenter (reverse wstecz) / mouseleave (forward od bieżącej klatki)
    //   Passive: mousemove/mouseenter/mouseleave nie blokują main thread (C11 ✓)
    //   IO gating: Factory gating (Ścieżka 1) wywołuje pause()/resume() — NIE kill().
    //   Logo lottie rAF off-screen: bije nadal podczas pause() (lottie-web SVG behavior).
    //   Po onComplete anim.pause() koszt rAF marginalny (0 klatek renderowanych).
    //   kill() → cleanups → destroyLogoLottie() → anim.destroy() zatrzymuje rAF definitywnie.
    //
    // ZACHOWANIE animacji:
    //   1. init → play forward → po dojściu do lastFrame → pause (zatrzymanie)
    //   2. mouseenter → setDirection(-1) → play (cofanie)
    //   3. mouseleave → setDirection(1) → play od bieżącej klatki (naprzód)
    //   4. ponowne dojście do lastFrame → pause (bez pętli)
    //
    // FORMAT PLIKU — UWAGA INTEGRATORA:
    //   lottie-web@5.12.2 (CDN załadowany w hero) obsługuje TYLKO JSON.
    //   LOGO_OWOCNI.lottie = format DotLottie (plik ZIP z JSON + zasoby).
    //   PRZED INTEGRACJĄ skonwertuj do JSON jedną z metod:
    //     a) Online: https://lottiefiles.com/tools/convert — pobierz .json
    //     b) CLI:    npx @lottiefiles/dotlottie-js unpack LOGO_OWOCNI.lottie
    //   Skonwertowany plik umieść w: /public/animations/LOGO_OWOCNI.json
    //   Lub: podmień CDN na @lottiefiles/dotlottie-web (obsługuje .lottie nativo)
    //
    // ════════════════════════════════════════════════════════════════════════
    getLottie().then((lottie) => {
        'use strict';

        // Guard: kontener
        const logoEl = $id('hero-logo-lottie');
        if (!logoEl) {
            if (window.location.search.includes('debug=1')) {
                console.warn('[LOGO LOTTIE] #hero-logo-lottie not found — skip init');
            }
            return;
        }

        // Hover tylko na urzadzeniach z prawdziwym kursorem (C11)
        // matchMedia guard: blokuje ghost-tap reverse na iOS/Android
        const canHover = window.matchMedia &&
            window.matchMedia('(hover: hover) and (pointer: fine)').matches;

        // Stan lokalny
        let anim = null;
        let destroyed = false;

        // Predkosci: reverse 2x szybszy niz forward
        const SPEED_FORWARD = 1;   // normalne tempo play
        const SPEED_REVERSE = 2;   // 2x przy hover (cofanie)

        // Named handlers — wymagane do poprawnego removeEventListener.
        // Anonimowe funkcje NIE moga byc zdjete przez removeEventListener.
        // Bez named handlers: kazdy INIT AGAIN kumuluje listenery -> hover chaos.
        function onEnter() {
            if (destroyed || !anim) return;
            // setSpeed PRZED play() — musi obowiazywac od pierwszej klatki reverse
            anim.setSpeed(SPEED_REVERSE);
            anim.setDirection(-1);
            anim.play();
        }
        function onLeave() {
            if (destroyed || !anim) return;
            // Powrot do normalnego tempa przed puszczeniem do przodu
            anim.setSpeed(SPEED_FORWARD);
            anim.setDirection(1);
            anim.play();
        }
        function onComplete() {
            if (destroyed || !anim) return;
            // Pauza na koncu niezaleznie od kierunku (lastFrame lub frame 0)
            // Speed przy pauzie nie ma znaczenia — reset nastapi przy kolejnym onEnter/onLeave
            anim.pause();
        }

        // Init lottie-web
        anim = lottie.loadAnimation({
            container: logoEl,
            renderer: 'svg',
            loop: false,
            autoplay: true,
            path: '/animations/LOGO_OWOCNI.json',
            rendererSettings: {
                preserveAspectRatio: 'xMidYMid meet',
                progressiveLoad: false,
                hideOnTransparent: true,
                viewBoxOnly: true,   // Lottie NIE wstrzykuje width/height na <svg>
                                     // -> CSS rzadzi rozmiarem bez !important
            }
        });

        anim.addEventListener('complete', onComplete);

        // Hover listeners (tylko desktop/pointer:fine)
        // pointerenter/leave > mouseenter/leave: obsluguje tez pioro, pen tablet
        if (canHover) {
            logoEl.addEventListener('pointerenter', onEnter);
            logoEl.addEventListener('pointerleave', onLeave);
        }

        // Cleanup: pelny — listenery + anim
        cleanups.push(function destroyLogoLottie() {
            if (destroyed) return;
            destroyed = true;

            // Zdejmujemy listenery PRZED destroy — named handlers sa identyfikowalne
            if (canHover) {
                logoEl.removeEventListener('pointerenter', onEnter);
                logoEl.removeEventListener('pointerleave', onLeave);
            }

            if (anim) {
                anim.removeEventListener('complete', onComplete);
                anim.destroy();
                anim = null;
            }
        });

    });
    // ═══ KONIEC LOGO LOTTIE ENGINE ═══

    return { pause, resume, kill };

}

// ═══════════════════════════════════════════════════════════════════════════
// REACT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function HeroSection() {
  const rootRef = useRef<HTMLElement | null>(null);

  useGSAP(() => {
    const el = rootRef.current;
    if (!el) {
      // DEV: twardy sygnał — null tu oznacza błąd wiring-u ref w JSX
      if (process.env.NODE_ENV !== 'production') {
        throw new Error('[P3] rootRef.current is null — ref not attached to <section>.');
      }
      return;
    }
    const inst = heroSectionInit(el);
    return () => inst?.kill?.();
    // scope: useGSAP Context revertuje instancje GSAP z init() automatycznie
    // inst.kill() revertuje je powtórnie + czyści observers/timers/listeners
    // Double cleanup nie jest problemem — bezpieczeństwo wynika z:
    // 1. _killed guard w kill() — idempotencja gwarantowana przez kod
    // 2. useGSAP scope — context revert czyszczony przez React
  }, { scope: rootRef });

  return (
    <section id="hero-section" className="banner-section" ref={rootRef}>
      <div className="trail-container" id="hero-trailContainer"></div>
      {/* ANIMACJA STARTOWA - Premium Gradient (oklch) */}
      <div className="gradient-perf-wrapper">
        <div className="startup-gradient"></div>
      </div>
      
      {/* ANIMACJA STARTOWA - DOWNFALL Gradient (color-mix fallback) */}
      <div className="burst-container" id="hero-burstContainer">
        <div className="burst-ripple burst-ripple--1"></div>
        <div className="burst-ripple burst-ripple--2"></div>
        <div className="burst-ripple burst-ripple--3"></div>
        <div className="burst-ripple burst-ripple--4"></div>
      </div>
      
      {/* Content */}
      <div className="content-layer">
        <div className="center-wrapper">
          <div className="logo-area">
            {/* LOGO LOTTIE — HOT asset (G2)
                Zastąpił: <svg class="main-logo"> (inline SVG statyczny)
                Plik: LOGO_OWOCNI.json (lottie-web@5.12.2 wymaga JSON)
                ⚠ UWAGA: LOGO_OWOCNI.lottie → .json WYMAGANE przed deployem */}
            <div className="logo-lottie" id="hero-logo-lottie"></div>
          </div>
          
          <div className="hero-content">
            {/* BLOBY WEWNĄTRZ HERO-CONTENT */}
            <div className="blob-mask"></div>
            
            {/* Hero-Title Wrapper: punkt odniesienia dla Laurów Lottie */}
            <div className="hero-title-wrapper">
              <h1 className="hero-title">Dream team do tworzenia<br />porządnych stron w <strong>Warszawie</strong>.</h1>
              {/* Lottie Laur - pozycjonowane względem dolnej linii hero-title */}
              <div className="lottie-laur-container lottie-laur-left" id="hero-lottieLaurLeft"></div>
              <div className="lottie-laur-container lottie-laur-right" id="hero-lottieLaurRight"></div>
            </div>
            <p className="hero-description">Z Owocnymi zdobędziesz dokładnie takich klientów, na jakich najbardziej Ci zależy. Dajemy Ci na 100% gwarancji. Wyskocz ponad konkurencję z Warszawy. Wystartuj stronę szybciej i pozwól swojej firmie działać na pełnych obrotach.</p>
            
            {/* Marquee logotypów */}
            <div className="hero-brands-marquee">
              <p className="hero-brands-text hero-brands-text--desktop"><strong>4500+ projektów.</strong> Zaufanie marek, które znasz.</p>
              <p className="hero-brands-text hero-brands-text--mobile"><strong>4500+</strong> Udanych projektów.</p>
              <div className="luxury-wrapper" id="hero-brandsMarqueeWrapper">
                <div className="marquee-track" id="hero-brandsMarqueeTrack"></div>
              </div>
            </div>
          </div>
          
          <div className="action-area">
            <div className="badge-20lat-wrapper">
              <svg className="rotating-svg" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink">
                <defs>
                  <path id="hero-arc-top" d="M 11,74 A 59,59 0 0,1 129,74"/>
                  <path id="hero-arc-bottom" d="M 11,74 A 59,59 0 0,0 129,74"/>
                </defs>
                <text className="rotating-text text-top" textAnchor="middle">
                  <textPath href="#hero-arc-top" xlinkHref="#hero-arc-top" startOffset="50%">PRZEWAGA</textPath>
                </text>
                <text className="rotating-text text-bottom" textAnchor="middle">
                  <textPath href="#hero-arc-bottom" xlinkHref="#hero-arc-bottom" startOffset="50%">DOŚWIADCZENIA</textPath>
                </text>
              </svg>
              <span className="label-lat">LAT</span>
              <button className="badge-20lat" type="button">
                <div className="pulse"></div>
                <div className="typography-container">
                  <span className="number-20">20</span>
                </div>
              </button>
            </div>
            <div className="trust-column">
              <div className="badge-wrapper" id="hero-badgeSatysfakcjiWrapper">
                <div className="badge">
                  <div className="gold">
                    <div className="number-stack">
                      <span className="layer-gold layer-common">100%</span>
                      <div className="layer-black layer-common">
                        <span className="char" style={{ '--i': 0 } as React.CSSProperties}>1</span>
                        <span className="char" style={{ '--i': 1 } as React.CSSProperties}>0</span>
                        <span className="char" style={{ '--i': 2 } as React.CSSProperties}>0</span>
                        <span className="char" style={{ '--i': 3 } as React.CSSProperties}>%</span>
                      </div>
                    </div>
                    <div className="shine"></div>
                  </div>
                  <div className="badge-text">
                    <span className="main">SATYSFAKCJI</span>
                    <span className="sub">lub zwrot pieniędzy</span>
                  </div>
                </div>
                <p className="badge-caption">Jedyni w Polsce oferujemy<br />pełną <strong>Gwarancję wyników.</strong></p>
              </div>
            </div>
            <div className="trust-column">
              <div className="badge-google-wrapper active entrance-playing" id="hero-badgeGoogleWrapper">
                <div className="badge-google" id="hero-badgeGoogle">
                  <svg className="google-icon" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <div className="google-content">
                    <div className="stars" id="hero-googleStars"></div>
                    <span className="google-text">150+ OPINII</span>
                  </div>
                </div>
                <p className="badge-caption highlight"><strong>98% pozytywnych opinii</strong><br />na temat owocnych stron</p>
              </div>
            </div>
            <div className="cta-group">
              <div className="brain-tooltip" id="hero-brainTooltip">
                <button className="tooltip-close" aria-label="Zamknij"></button>
                <div className="tooltip-header"><span className="brain-tip">#BRAIN TIP:71</span> Ludzie widzą to, co chcą widzieć.</div>
                <div className="tooltip-sub">
                  Żółta kropka kręci się lewo–prawo? A może lata przód–tył?<br />
                  <strong><em>PS: „Skup się, a zmienisz to myśląc o tym."</em></strong>
                </div>
              </div>
              <div className="btn-wrapper-wave">
                <a href="#" className="cta-button">
                  <span className="btn-hole"></span>
                  <span className="btn-cap"></span>
                  <span className="btn-text" data-text="Otrzymaj wycenę teraz">Otrzymaj wycenę teraz</span>
                </a>
              </div>
              <div className="cta-note-wrapper">
                <div className="pendulum-container">
                  <canvas className="cta-royal-canvas" id="hero-royalCanvas" width={16} height={16}></canvas>
                  <div className="aura"></div>
                  <div className="sonar"></div>
                </div>
                <span className="cta-note" id="hero-season-pill">Ostatnie terminy na lato</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
