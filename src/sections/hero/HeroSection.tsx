// @ts-nocheck — mechaniczny port P3; doprecyzowanie typów w Fabryce (strict TS)
'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { scrollRuntime } from '@/lib/scrollRuntime';
import type { HeroVariant } from '@/config/heroVariantTypes';
import { CENNIK_STRONY_URL } from '@/config/ctaUrls';
import './hero-section.css';

/** Jedna obietnica na całą sekcję — lottie-web poza krytycznym parse głównego chunka Hero. */
const heroLottieLibPromise = import('lottie-web').then((m) => m.default);

/** Kolejność logotypów marquee — assety w `public/LOGOTYPY/` */
const HERO_MARQUEE_LOGO_SRCS = [
  '/LOGOTYPY/1sklepy1_new.svg',
  '/LOGOTYPY/2mbank1_new.svg',
  '/LOGOTYPY/3zabka1_new.svg',
  '/LOGOTYPY/4deloitte1_new.svg',
  '/LOGOTYPY/5grycan1_new.svg',
  '/LOGOTYPY/6gsk1_new.svg',
  '/LOGOTYPY/7ministerstwo1_new.svg',
  '/LOGOTYPY/8mokate1_new.svg',
  '/LOGOTYPY/9wella1_new.svg',
  '/LOGOTYPY/10oracle1_new.svg',
  '/LOGOTYPY/11sokolow1_new.svg',
  '/LOGOTYPY/12skanska1_new.svg',
] as const;

/** Slot .logo-item (desktop) — zgodnie z hero-section.css; mobile 66×33 zachowuje ~ten sam aspect */
const HERO_MARQUEE_LOGO_BOX = { w: 131, h: 65 };

// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// Next.js pre-renderuje Client Components na serwerze — window/document nie istnieją.
// Ta sekcja nie używa ScrollTrigger — gsap.registerPlugin() nie jest wymagany.

// ─── init(container) — identyczna logika jak reference.html, bez DEV overlay ───
// Źródło prawdy: hero.reference.html (P2A golden master)
// Tłumaczenie mechaniczne P3: typy TS, import zamiast CDN, scrollRuntime z modułu

function init(container: HTMLElement): { kill: () => void; pause: () => void; resume: () => void } {

    const heroInitT0 = performance.now(); // timestamp for deferred systems

    // ─── HELPERS (container-scoped) ─────────────────────────────────
    const $ = (sel: string) => container.querySelector(sel);
    const $$ = (sel: string) => container.querySelectorAll(sel);
    const $id = (id: string) => container.querySelector('#' + id);
    // Scroll helpers: use scrollRuntime.getScroll() / getRawScroll()


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
    let logoLottiePause = null, logoLottieResume = null; // [FIX ENT-LC-03]

    // ─── BROKEN IMAGE HANDLER (ukryj gdy nie załaduje) ────────────────
    $$('img').forEach(img => {
        if (img.complete && img.naturalWidth === 0) {
            img.style.opacity = '0'; // już broken
        }
        img.addEventListener('error', function() {
            this.style.opacity = '0';
        }, { once: true });
    });

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
    // BLOCK 2: MAIN (gradient, orchestrator, badges)
    // ═════════════════════════════════════════════════════════════════
    {
/* ==========================================================================
   SCRIPT BLOCK #2 — MAIN (po gsap.min.js CDN)
   Cleanup: usunięto C1 (fitsInBox), C2 (h1Changed/descChanged), C7 (resInfo)
   HAAT runtime removed — typography uses CSS-only root defaults
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
        // ⚠️ will-change CELOWO USUNIĘTY — Chrome rasteryzowałby w rozmiarze 
        // po scale(4) = pełna rozdzielczość = utrata zysku 25% DPR
        
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
    // [FIX #1] Named function + listen() for proper cleanup
    const onGradientAnimEnd = (e) => {
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
    };
    listen(startupGradient, 'animationend', onGradientAnimEnd);
    cleanups.push(() => stopGradient()); // force-stop on kill
}

/* ==========================================================================
   MAIN ENTRY SEQUENCE (ORCHESTRATOR)
   playEntrySequence() → stopGradient → startGradient → badge20LatReplay
   SEKWENCJA MUSI POZOSTAĆ NIENARUSZONA
   ========================================================================== */

function playEntrySequence() {
    stopGradient();
    
    trackedTimeout(() => {
        // [A10] Gradient OKLCH — Faza 2: delay 2000ms (minimalizacja peak)
        // Badge'e + Laurel startują w 0.3s (CSS variables)
        // Gradient startuje w 2s; logo Lottie osobno ~6s (po szczycie animacji gradientu)
        trackedTimeout(() => {
            startGradient();
            scheduleGradientAutoFade();
        }, 2000);
        
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
        
        const badge20Delay = parseFloat(getComputedStyle(container).getPropertyValue('--badge-20lat-delay')) || 1.25; /* [FIX] was: documentElement */
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
    function triggerGradientWithCooldown() {
        if (gradientCooldown) return;
        if (typeof startGradient === 'function') { startGradient(); }
        gradientCooldown = true;
        trackedTimeout(() => { gradientCooldown = false; }, 6000);
    }
    listen(wrapper, 'mouseenter', triggerGradientWithCooldown); /* [FIX #1] tracked */
    listen(wrapper, 'click', triggerGradientWithCooldown); /* [FIX #1] tracked */
    
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
    
    let entranceFinalizeTimer = null; /* [FIX #2] Track timer for kill/revive race */
    
    function generateStars() {
        const starPath = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";
        const badgeGoogleDelay = parseFloat(getComputedStyle(container).getPropertyValue('--badge-google-delay')) || 1.5; /* [FIX] was: documentElement */
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
        listen(badge, 'mouseenter', startHover); /* [FIX #1] tracked */
        listen(badge, 'touchstart', startHover, {passive: true}); /* [FIX #1] tracked */
        const lastStar = starsRow.querySelector('.star:last-child');
        if (lastStar) {
            // [FIX #1] Named function for cleanup
            const onStarAnimEnd = (e) => {
                if (e.animationName === 'hero-badgeGoogleStarFlip') {
                    badge.classList.remove('stars-running');
                    badge.dataset.starsLocked = '0';
                    if (badge.matches(':hover')) badge.classList.add('stars-finished');
                }
            };
            listen(lastStar, 'animationend', onStarAnimEnd);
        }
        listen(badge, 'mouseleave', () => {
            if (badge.dataset.starsLocked !== '1') badge.classList.remove('stars-finished');
        });
    }
    
    function setupFinishEntrance() {
        /* [FIX #2] Clear any pending timer from previous entrance */
        if (entranceFinalizeTimer) {
            clearTimeout(entranceFinalizeTimer);
            entranceFinalizeTimer = null;
        }
        
        let finished = false;
        const finalize = () => {
            if (finished) return;
            finished = true;
            entranceFinalizeTimer = null; /* [FIX #2] Clear ref after execution */
            wrapper.classList.remove('entrance-playing');
            wrapper.classList.add('anim-finished');
            badge.classList.add('anim-finished');
        };
        // Listen for the last animation in the badge sequence (caption fade ends ~5.5s)
        // Caption ma instant visibility (bez animacji)
        // Finalize po zakończeniu innych animacji badge (~2s)
        entranceFinalizeTimer = trackedTimeout(finalize, 2000); /* [FIX #2] Store timer ID */
    }
    
    generateStars();
    setupStarsInteraction();
    setupFinishEntrance();
    
    // Expose kill/revive for action-area dormant system
    badgeGoogleKill = function() {
        /* [FIX #2] Clear pending finalize timer to prevent race condition */
        if (entranceFinalizeTimer) {
            clearTimeout(entranceFinalizeTimer);
            entranceFinalizeTimer = null;
        }
        
        wrapper.classList.remove('active', 'entrance-playing', 'anim-finished');
        badge.classList.remove('anim-finished', 'stars-running', 'stars-finished');
        badge.dataset.starsLocked = '0';
        starsRow.innerHTML = '';

        // reset visual reveal state (transform + clip-path)
        badge.style.removeProperty('transform');
        badge.style.removeProperty('clip-path');
        badge.style.removeProperty('-webkit-clip-path');
    };
    badgeGoogleRevive = function() {
        wrapper.classList.add('active', 'entrance-playing');
        wrapper.classList.remove('anim-finished');
        badge.classList.remove('anim-finished', 'stars-running', 'stars-finished');
        badge.dataset.starsLocked = '0';

        // ensure start from CSS base reveal state (transform + clip-path)
        badge.style.removeProperty('transform');
        badge.style.removeProperty('clip-path');
        badge.style.removeProperty('-webkit-clip-path');

        generateStars();
        setupStarsInteraction(); /* [FIX #8] Restore interaction after regenerating stars */
        setupFinishEntrance();
    };
})();

// --- CTA BUTTON WAVE EFFECT ---
$$('.btn-wrapper-wave').forEach(wrapEl => {
    listen(wrapEl, 'click', () => {
        const wave = document.createElement('span');
        wave.classList.add('wave-effect', 'animating');
        wrapEl.insertBefore(wave, wrapEl.firstChild);
        wave.addEventListener('animationend', () => wave.remove()); // once: dynamic element, self-removes
    });
});

    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 3: LOTTIE LAUR — MIRROR OPTIMIZATION v3
    // ═════════════════════════════════════════════════════════════════
    // ARCHITEKTURA:
    //   1× lottie.loadAnimation (animSource = prawy laur, containerRight)
    //   1× plain <canvas>       (mirrorCanvas = lewy laur, containerLeft)
    //
    // SYNC: drawnFrame event (strzela PO renderze klatki na canvas)
    //       → queueMirrorSync() → rAF → drawImage(source, 0, 0)
    //
    // MIRROR: CSS .lottie-laur-left ma scaleX(-1) → wizualne odbicie.
    //         JS kopiuje RAW piksele bez flipa. ZERO podwójnego odbicia.
    //
    // LIFECYCLE: Bez zmian semantycznych vs oryginał.
    //   init → play → complete → fold/unfold → destroy → re-entry
    // ═════════════════════════════════════════════════════════════════
    {
        (function() {
            'use strict';
    
            const containerLeft = $id('hero-lottieLaurLeft');
            const containerRight = $id('hero-lottieLaurRight');
            // Source MUSI być w containerRight. Bez niego — brak animacji.
            // containerLeft jest opcjonalny — bez niego brak mirror, source działa solo.
            if (!containerRight) return;

            let laurelLottieCancelled = false;
            cleanups.push(() => {
                laurelLottieCancelled = true;
            });

            heroLottieLibPromise.then(function (lottie) {
                if (laurelLottieCancelled || !lottie) return;

            // Inline animation data (identyczne jak oryginał — ZERO zmian w uassecie)
                    const animationData = {"v":"5.7.14","fr":90,"ip":0,"op":84,"w":372,"h":556,"nm":"Comp 2","ddd":0,"assets":[{"id":"comp_0","nm":"Comp 1","layers":[{"ddd":0,"ind":3,"ty":0,"nm":"laur 2","refId":"comp_1","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-69.144,"ix":10},"p":{"a":0,"k":[701.112,172.379,0],"ix":2},"a":{"a":0,"k":[66,206.511,0],"ix":1,"l":2},"s":{"a":0,"k":[42.303,42.303,100],"ix":6}},"ao":0,"w":132,"h":223,"ip":53.625,"op":540,"st":53.625,"bm":0},{"ddd":0,"ind":5,"ty":0,"nm":"laur","refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-64.043,"ix":10},"p":{"a":0,"k":[725.08,195.902,0],"ix":2},"a":{"a":0,"k":[102.353,181.936,0],"ix":1,"l":2},"s":{"a":0,"k":[33.273,33.273,100],"ix":6}},"ao":0,"w":240,"h":193,"ip":48.75,"op":540,"st":48.75,"bm":0},{"ddd":0,"ind":7,"ty":0,"nm":"laur","refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-58.591,"ix":10},"p":{"a":0,"k":[761.63,222.881,0],"ix":2},"a":{"a":0,"k":[116.059,178.892,0],"ix":1,"l":2},"s":{"a":0,"k":[43.7,43.7,100],"ix":6}},"ao":0,"w":240,"h":193,"ip":43.875,"op":540,"st":43.875,"bm":0},{"ddd":0,"ind":9,"ty":0,"nm":"laur","refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-50.455,"ix":10},"p":{"a":0,"k":[799.131,267.708,0],"ix":2},"a":{"a":0,"k":[109.287,183.117,0],"ix":1,"l":2},"s":{"a":0,"k":[49.098,49.098,100],"ix":6}},"ao":0,"w":240,"h":193,"ip":39,"op":540,"st":39,"bm":0},{"ddd":0,"ind":11,"ty":0,"nm":"laur","refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-38.357,"ix":10},"p":{"a":0,"k":[827.25,322.397,0],"ix":2},"a":{"a":0,"k":[105.203,181.936,0],"ix":1,"l":2},"s":{"a":0,"k":[54.776,54.776,100],"ix":6}},"ao":0,"w":240,"h":193,"ip":34.125,"op":540,"st":34.125,"bm":0},{"ddd":0,"ind":13,"ty":0,"nm":"laur","refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-21.311,"ix":10},"p":{"a":0,"k":[842.659,388.055,0],"ix":2},"a":{"a":0,"k":[111.795,183.973,0],"ix":1,"l":2},"s":{"a":0,"k":[61.661,61.661,100],"ix":6}},"ao":0,"w":240,"h":193,"ip":29.25,"op":540,"st":29.25,"bm":0},{"ddd":0,"ind":15,"ty":0,"nm":"laur","refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":-11.031,"ix":10},"p":{"a":0,"k":[845.941,463.007,0],"ix":2},"a":{"a":0,"k":[115.092,182.064,0],"ix":1,"l":2},"s":{"a":0,"k":[67.195,67.195,100],"ix":6}},"ao":0,"w":240,"h":193,"ip":24.375,"op":540,"st":24.375,"bm":0},{"ddd":0,"ind":17,"ty":0,"nm":"laur","refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":19.875,"s":[-6.437]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":22.5,"s":[-5.437]},{"t":25.125,"s":[-0.437]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":19.875,"s":[827.339,556.95,0],"to":[2.833,-2.996,0],"ti":[-0.017,0.034,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":22.5,"s":[837.059,541.48,0],"to":[0.083,-0.167,0],"ti":[0.75,0.0,0]},{"t":25.125,"s":[832.559,541.48,0]}],"ix":2,"l":2},"a":{"a":0,"k":[111.646,185.833,0],"ix":1,"l":2},"s":{"a":0,"k":[73.372,73.372,100],"ix":6}},"ao":0,"w":240,"h":193,"ip":19.5,"op":540,"st":19.5,"bm":0},{"ddd":0,"ind":19,"ty":0,"nm":"laur","refId":"comp_2","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":16.125,"s":[2.443]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":19.125,"s":[-0.057]},{"i":{"x":[0.833],"y":[0.833]},"o":{"x":[0.167],"y":[0.167]},"t":22.125,"s":[13.443]},{"t":25.875,"s":[13.443]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":16.125,"s":[801.404,618.905,0],"to":[-0.625,-0.042,0],"ti":[1.563,0.104,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":19.125,"s":[803.654,618.655,0],"to":[-1.563,-0.104,0],"ti":[0.625,0.042,0]},{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":22.125,"s":[793.904,618.405,0],"to":[-1.25,-0.083,0],"ti":[0.625,0.042,0]},{"t":25.875,"s":[793.654,618.405,0]}],"ix":2,"l":2},"a":{"a":0,"k":[107.12,186.933,0],"ix":1,"l":2},"s":{"a":0,"k":[79.401,79.401,100],"ix":6}},"ao":0,"w":240,"h":193,"ip":15.375,"op":540,"st":15.375,"bm":0}]},{"id":"comp_1","nm":"laur 2","layers":[{"ddd":0,"ind":1,"ty":4,"nm":"lewy","parent":2,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":38,"ix":10},"p":{"a":0,"k":[0.714,1.969,0],"ix":2,"l":2},"a":{"a":0,"k":[147.714,206.969,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.003,0.003,0.003],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":0,"s":[0,0,100]},{"t":12.375,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[-38.973,-29.064],[-47.339,99.742],[-24,-12.33],[13.431,-69.798],[17.175,39.633]],"o":[[0,0],[0,0],[24,12.331],[0,0],[0,0]],"v":[[43.046,60.88],[-15.303,-60.88],[17.284,-26.313],[49.211,56.918],[6.275,1.872]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0,0,0,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[100.781,148.469],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0,"op":1152.375,"st":0,"bm":0},{"ddd":0,"ind":2,"ty":3,"nm":"Null 3","sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[61.5,174.5,0],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.859,0.859,0.667],"y":[0.996,0.996,1]},"o":{"x":[1,1,0.333],"y":[0,0,0]},"t":0,"s":[100,100,100]},{"i":{"x":[0,0,0.667],"y":[1.005,1.005,1]},"o":{"x":[0.096,0.096,0.333],"y":[-0.006,-0.006,0]},"t":13.896,"s":[120,120,100]},{"t":35.625,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"ip":0,"op":1145.25,"st":0,"bm":0}]},{"id":"comp_2","nm":"laur","layers":[{"ddd":0,"ind":1,"ty":0,"nm":"lisc1","refId":"comp_3","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[108.25,168.25,0],"ix":2,"l":2},"a":{"a":0,"k":[87.75,151.75,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.859,0.859,0.667],"y":[0.996,0.996,1]},"o":{"x":[1,1,0.333],"y":[0,0,0]},"t":0,"s":[100,100,100]},{"i":{"x":[0,0,0.667],"y":[1.005,1.005,1]},"o":{"x":[0.096,0.096,0.333],"y":[-0.006,-0.006,0]},"t":13.896,"s":[120,120,100]},{"t":35.625,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"w":199,"h":160,"ip":0,"op":990,"st":0,"bm":0}]},{"id":"comp_3","nm":"lisc1","layers":[{"ddd":0,"ind":1,"ty":3,"nm":"Null 1","sr":1,"ks":{"o":{"a":0,"k":0,"ix":11},"r":{"a":0,"k":7.594,"ix":10},"p":{"a":0,"k":[84.5,147,0],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"ip":0,"op":1029.375,"st":0,"bm":0},{"ddd":0,"ind":2,"ty":4,"nm":"stem","parent":1,"td":1,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[0.65,2.25,0],"ix":2,"l":2},"a":{"a":0,"k":[-14.75,71.75,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[0.985,-28.416],[0,0],[0,0],[-0.799,33.315],[0,0]],"o":[[0,0],[-1.176,33.946],[0,0],[0,0],[0.792,-33.036],[0,0]],"v":[[8.333,-67.5],[19.762,-3.414],[8.485,72.25],[-10,67.75],[2.166,-2.914],[-14.794,-87.942]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0,0,0,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[-14.75,4],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[82.5,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Rectangle 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0.75,"op":1036.5,"st":0,"bm":0},{"ddd":0,"ind":3,"ty":4,"nm":"stemask","parent":1,"tt":1,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":1,"k":[{"i":{"x":0.833,"y":0.833},"o":{"x":0.167,"y":0.167},"t":0,"s":[-1.5,185,0],"to":[0,-26.667,0],"ti":[0,26.667,0]},{"t":6.75,"s":[-1.5,25,0]}],"ix":2,"l":2},"a":{"a":0,"k":[-17.5,248.5,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[0,0],[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0],[0,0],[0,0]],"v":[[18,-54.5],[34,88.5],[-34,88.5],[-8,-61.75],[-1.5,-88.5]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0,0,0,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[-17.5,160],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Rectangle 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0.75,"op":1036.5,"st":0,"bm":0},{"ddd":0,"ind":4,"ty":4,"nm":"prawy","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":1,"k":[{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":1.5,"s":[88.51,154.616,0],"to":[0.833,0,0],"ti":[-0.833,0,0]},{"t":13.875,"s":[93.51,154.616,0]}],"ix":2,"l":2},"a":{"a":0,"k":[168.01,209.616,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":1.5,"s":[0,0,100]},{"t":13.875,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[6.385,-55.266],[-84.55,24.44],[-10.129,18.715],[86.312,-11.009],[7.706,-7.926],[-44.477,30.606]],"o":[[0,0],[29.284,-8.808],[0,0],[-20.918,2.422],[0,0],[0,0]],"v":[[-49.982,64.734],[3.963,-36.77],[53.945,-68.697],[-5.725,56.367],[-40.734,68.697],[3.082,0]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0,0,0,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[214.286,144.616],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":1.5,"op":1038,"st":1.5,"bm":0},{"ddd":0,"ind":5,"ty":4,"nm":"lewy","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":1,"k":[{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":2.25,"s":[80.714,151.969,0],"to":[-0.833,0,0],"ti":[0.833,0,0]},{"t":14.625,"s":[75.714,151.969,0]}],"ix":2,"l":2},"a":{"a":0,"k":[147.714,206.969,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":2.25,"s":[0,0,100]},{"t":14.625,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[-38.973,-29.064],[-47.339,99.742],[-24,-12.33],[13.431,-69.798],[17.175,39.633]],"o":[[0,0],[0,0],[24,12.331],[0,0],[0,0]],"v":[[43.046,60.88],[-15.303,-60.88],[17.284,-26.313],[49.211,56.918],[6.275,1.872]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0,0,0,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[100.781,148.469],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":2.25,"op":1038.75,"st":2.25,"bm":0}]}],"layers":[{"ddd":0,"ind":1,"ty":0,"nm":"Comp 1","td":1,"refId":"comp_0","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":7.612,"ix":10},"p":{"a":0,"k":[84,26,0],"ix":2,"l":2},"a":{"a":0,"k":[649,135,0],"ix":1,"l":2},"s":{"a":0,"k":[101.426,101.426,100],"ix":6,"l":2}},"ao":0,"w":1000,"h":1000,"ip":0,"op":540,"st":0,"bm":0},{"ddd":0,"ind":2,"ty":4,"nm":"Shape Layer 1","tt":1,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[188,287,0],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":0,"k":[100,99.488,100],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ty":"rc","d":1,"s":{"a":0,"k":[372,556],"ix":2},"p":{"a":0,"k":[0,0],"ix":3},"r":{"a":0,"k":0,"ix":4},"nm":"Rectangle Path 1","mn":"ADBE Vector Shape - Rect","hd":false},{"ty":"gf","o":{"a":0,"k":100,"ix":10},"r":1,"bm":0,"g":{"p":3,"k":{"a":0,"k":[0,0.957,0.937,0.922,0.525,0.947,0.922,0.898,1,0.937,0.906,0.875,0,0.8,0.505,0.9,1,1],"ix":9}},"s":{"a":0,"k":[26,247.265],"ix":5},"e":{"a":0,"k":[-101,-254.301],"ix":6},"t":3,"nm":"Gradient Fill 1","mn":"ADBE Vector Graphic - G-Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[-2,-8],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Rectangle 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0,"op":84,"st":0,"bm":0}],"markers":[]};
            // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
            // UWAGA DLA DEVELOPERA: skopiuj cały obiekt animationData
            // z oryginalnego kodu (linia ~3473 oryginału).
    
            // ═══ STATE ═══
            let animSource = null;       // jedyna instancja Lottie
            let mirrorCanvas = null;     // plain <canvas> w containerLeft
            let mirrorCtx = null;        // 2d context mirror
            let mirrorRaf = 0;           // ID requestAnimationFrame (deduplikacja + cleanup)
            let isVisible = false;
    
            // Flagi stanu animacji (identyczne jak oryginał)
            let isStopped = true;
            let hasCompleted = false;
            let hasEverOpened = false;
            let isUnfolded = false;
            let isReversing = false;
            let isFolding = false;
            let reverseRemaining = 0;
    
            // [A4.2] Frame constants for 90fps optimized JSON
            const LAST_FRAME = 81;
    
            // Pamięć ostatniego sensownego frame po park/destroy
            let parkedFrame = LAST_FRAME;
    
            // Lifecycle hygiene
            let startTimer = null;
            let hiddenDestroyTimer = null;
            let foldCooldownUntil = 0;
    
            // Config (identyczny jak oryginał)
            const LAUREL_CFG = {
                introSpeed: 0.30,
                unfoldSpeed: 1.00,
                foldSpeed: 1.85,
                foldScrollMinY: 80,
                unfoldTopEpsilon: 8,
                wheelThreshold: 50,
                stateCooldownMs: 600,
                hiddenDestroyMs: 4000,
                ioThreshold: 0.05,
                ioRootMargin: '200px'
            };
    
            // ═══ MIRROR CANVAS ═══
    
            /**
             * Tworzy plain <canvas> w containerLeft.
             * innerHTML = '' czyści kontener z ghost elementów (safety net).
             * Wymiary kopiowane z source canvas.
             */
            function createMirrorCanvas(sourceCanvas) {
                if (!containerLeft) return;
    
                // Pełny cleanup kontenera — zabezpieczenie przed ghost elementami
                containerLeft.innerHTML = '';
    
                mirrorCanvas = document.createElement('canvas');
                mirrorCanvas.width = sourceCanvas.width;
                mirrorCanvas.height = sourceCanvas.height;
                mirrorCanvas.style.width = '100%';
                mirrorCanvas.style.height = '100%';
                mirrorCanvas.setAttribute('aria-hidden', 'true');
    
                mirrorCtx = mirrorCanvas.getContext('2d', { alpha: true });
    
                containerLeft.appendChild(mirrorCanvas);
            }
    
            /**
             * Synchroniczna kopia pikseli source → mirror.
             * ZERO flipa — CSS scaleX(-1) na containerLeft robi mirror.
             * Zwraca true jeśli kopia się powiodła.
             */
            function syncMirror() {
                if (!mirrorCanvas || !mirrorCtx || !animSource) return false;
                if (!mirrorCanvas.isConnected) return false;
    
                const sourceCanvas = containerRight.querySelector('canvas');
                if (!sourceCanvas) return false;
                
                // Guard: sourceCanvas musi mieć wymiary > 0 (Lottie jeszcze nie wyrenderowało)
                if (sourceCanvas.width === 0 || sourceCanvas.height === 0) return false;
    
                // Sync wymiarów (resize / DPR edge case)
                if (mirrorCanvas.width !== sourceCanvas.width) mirrorCanvas.width = sourceCanvas.width;
                if (mirrorCanvas.height !== sourceCanvas.height) mirrorCanvas.height = sourceCanvas.height;
    
                mirrorCtx.clearRect(0, 0, mirrorCanvas.width, mirrorCanvas.height);
                mirrorCtx.drawImage(sourceCanvas, 0, 0);
                return true;
            }
    
            /**
             * Asynchroniczna kopia via rAF.
             * - Deduplikacja: jeśli rAF już zakolejkowany, nie dodaje nowego.
             * - Retry: jeśli kopia się nie uda (canvas jeszcze nie w DOM), próbuje ponownie
             *   przez max `retries` kolejnych rAF. Krytyczne przy pierwszym DOMLoaded.
             */
            function queueMirrorSync(retries) {
                if (!containerLeft) return;
                if (mirrorRaf) return;  // deduplikacja — max 1 kopia per frame
    
                if (retries === undefined) retries = 8;
    
                mirrorRaf = requestAnimationFrame(() => {
                    mirrorRaf = 0;
                    const ok = syncMirror();
                    if (!ok && retries > 0) queueMirrorSync(retries - 1);
                });
            }
    
            /**
             * Pełny cleanup mirror canvas + anulowanie pending rAF.
             */
            function destroyMirror() {
                if (mirrorRaf) {
                    cancelAnimationFrame(mirrorRaf);
                    mirrorRaf = 0;
                }
                if (mirrorCanvas && mirrorCanvas.isConnected) {
                    mirrorCanvas.remove();
                }
                mirrorCanvas = null;
                mirrorCtx = null;
            }
    
            // ═══ HELPERS ═══
    
            function clearLaurelTimers() {
                if (startTimer) { clearTimeout(startTimer); startTimer = null; }
                if (hiddenDestroyTimer) { clearTimeout(hiddenDestroyTimer); hiddenDestroyTimer = null; }
            }
    
            function getLaurelInstances() {
                return animSource ? [animSource] : [];
            }
    
            function setBothSpeed(speed) {
                getLaurelInstances().forEach(anim => anim.setSpeed(speed));
            }
    
            function setBothDirection(dir) {
                getLaurelInstances().forEach(anim => anim.setDirection(dir));
            }
    
            function playBoth() {
                getLaurelInstances().forEach(anim => anim.play());
            }
    
            function pauseBoth() {
                getLaurelInstances().forEach(anim => anim.pause());
                queueMirrorSync();  // goToAndStop/pause nie triggerują drawnFrame
            }
    
            function stopBothAt(frame) {
                getLaurelInstances().forEach(anim => anim.goToAndStop(frame, true));
                queueMirrorSync();  // goToAndStop nie triggeruje drawnFrame
            }
    
            function canTransition() {
                return performance.now() >= foldCooldownUntil;
            }
    
            function commitCooldown() {
                foldCooldownUntil = performance.now() + LAUREL_CFG.stateCooldownMs;
            }
    
            function onOneReverseComplete() {
                if (animSource) {
                    animSource.setDirection(1);
                    animSource.goToAndStop(0, true);
                }
                queueMirrorSync();
    
                reverseRemaining = 0;
                isFolding = false;
                isReversing = false;
                isStopped = true;
                hasCompleted = true;
                isUnfolded = false;
                parkedFrame = 0;
            }
    
            function onAnimationComplete() {
                hasCompleted = true;
                hasEverOpened = true;
                isStopped = true;
                isUnfolded = true;
                isFolding = false;
                isReversing = false;
                parkedFrame = LAST_FRAME;
            }
    
            // ═══ INIT LOTTIE ═══
    
            function initLottie(reentryDelay, restoreFrame = null) {
                // [FIX H4] Zawsze czyść timery przed ponowną inicjalizacją
                clearLaurelTimers();

                // [FIX H2/H3] Guard na istniejący animSource — defensywny destroy
                if (animSource) {
                    animSource.destroy();
                    animSource = null;
                }

                // [FIX H1] Defensywne czyszczenie containerRight — ghost canvas prevention
                containerRight.innerHTML = '';

                isStopped = true;
                hasCompleted = restoreFrame != null;
                isUnfolded = restoreFrame === LAST_FRAME;
                isReversing = false;
                isFolding = false;
                reverseRemaining = 0;
    
                destroyMirror();
    
                const config = {
                    renderer: 'canvas',
                    loop: false,
                    autoplay: false,
                    animationData: animationData,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet',
                        clearCanvas: true,
                        progressiveLoad: true
                    }
                };
    
                function onSourceLoaded() {
                    // Stwórz mirror canvas
                    const sourceCanvas = containerRight.querySelector('canvas');
                    if (containerLeft && sourceCanvas) {
                        createMirrorCanvas(sourceCanvas);
                        queueMirrorSync();  // pierwszy sync z retry
                    }
    
                    // RESTORE PATH — po hard destroy, wróć do sensownego frame
                    if (restoreFrame != null) {
                        animSource.goToAndStop(restoreFrame, true);
                        queueMirrorSync();
                        isStopped = true;
                        hasCompleted = true;
                        isUnfolded = restoreFrame === LAST_FRAME;
                        parkedFrame = restoreFrame;
                        return;
                    }
    
                    // NORMAL INTRO PATH
                    const lottieDelay =
                        (reentryDelay != null)
                            ? reentryDelay
                            : (parseInt(getComputedStyle(container) /* [FIX] was: documentElement */
                                .getPropertyValue('--lottie-delay')) || 1750);
    
                    startTimer = trackedTimeout(() => {
                        if (!animSource) return;
    
                        isStopped = false;
                        setBothSpeed(LAUREL_CFG.introSpeed);
                        setBothDirection(1);
                        playBoth();
                    }, lottieDelay);
                }
    
                // Jedna instancja Lottie — zawsze w containerRight
                animSource = lottie.loadAnimation({ ...config, container: containerRight });
                animSource.setSubframe(false); // [A4.1]
    
                animSource.addEventListener('DOMLoaded', () => {
                    animSource.goToAndStop(restoreFrame != null ? restoreFrame : 0, true);
                    onSourceLoaded();
                });
    
                // drawnFrame strzela PO renderze klatki na canvas
                // → kopiujemy aktualną klatkę, nie poprzednią (w odróżnieniu od enterFrame)
                animSource.addEventListener('drawnFrame', () => {
                    queueMirrorSync();
                });
    
                animSource.addEventListener('complete', () => {
                    if (isReversing) {
                        onOneReverseComplete();
                        return;
                    }
                    animSource.goToAndStop(LAST_FRAME, true);
                    queueMirrorSync();
                    if (!hasCompleted) onAnimationComplete();
                });
            }
    
            // ═══ DESTROY ═══
    
            function destroyLottie() {
                clearLaurelTimers();
    
                // Zniszcz instancję Lottie (zdejmuje wszystkie listenery automatycznie)
                animSource?.destroy();
                animSource = null;
    
                // Zniszcz mirror canvas + anuluj pending rAF
                destroyMirror();
    
                isStopped = true;
                hasCompleted = false;
                isReversing = false;
                isFolding = false;
                reverseRemaining = 0;
    
                // hasEverOpened i parkedFrame zostają — pamięć semantyczna lifecycle
            }
    
            // ═══ VISIBILITY OBSERVER ═══
    
            function setupVisibilityObserver() {
                const target = containerRight;
                if (!target) return;
    
                const observer = trackObserver(new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        isVisible = entry.isIntersecting;
    
                        if (!isVisible) {
                            // SHORT HIDDEN → park
                            clearTimeout(hiddenDestroyTimer);
                            hiddenDestroyTimer = trackedTimeout(() => {
                                // LONG HIDDEN → hard destroy
                                destroyLottie();
                            }, LAUREL_CFG.hiddenDestroyMs);
    
                            if (animSource) {
                                pauseBoth();
                                parkedFrame = isUnfolded ? LAST_FRAME : 0;
                                isStopped = true;
                            }
    
                            return;
                        }
    
                        // visible again
                        clearTimeout(hiddenDestroyTimer);
                        hiddenDestroyTimer = null;
    
                        if (animSource) {
                            // re-entry po short hidden
                            if (hasCompleted) {
                                stopBothAt(isUnfolded ? LAST_FRAME : 0);
                                isStopped = true;
                                isReversing = false;
                                isFolding = false;
                                reverseRemaining = 0;
                            } else {
                                // re-entry przed completion — resume intro
                                isStopped = false;
                                setBothDirection(1);
                                setBothSpeed(LAUREL_CFG.introSpeed);
                                playBoth();
                            }
                            return;
                        }
    
                        // re-entry po destroy — odtwórz sensowny stan
                        if (hasEverOpened) {
                            initLottie(0, parkedFrame);
                            return;
                        }
    
                        // pierwszy start lub re-entry zanim osiągnęły open
                        initLottie(0);
                    });
                }, {
                    threshold: LAUREL_CFG.ioThreshold,
                    rootMargin: LAUREL_CFG.ioRootMargin
                }));
    
                observer.observe(target);
    
                let lastScrollY = scrollRuntime.getScroll();
                let ticking = false;
                let wheelAccumulator = 0;
    
                // ═══ FOLD / UNFOLD ═══
    
                function animateFold() {
                    if (isFolding) return;
                    if (!canTransition()) return;
                    if (!animSource) return;
    
                    isFolding = true;
                    isReversing = true;
                    reverseRemaining = 1;
    
                    animSource.setDirection(-1);
                    animSource.setSpeed(LAUREL_CFG.foldSpeed);
                    animSource.play();
                    // mirror sync via drawnFrame — automatyczne
    
                    commitCooldown();
                }
    
                function animateUnfold() {
                    if (!canTransition()) return;
                    if (!animSource) return;
    
                    setBothDirection(1);
                    setBothSpeed(LAUREL_CFG.unfoldSpeed);
                    playBoth();
    
                    isUnfolded = true;
                    isReversing = false;
                    isFolding = false;
                    commitCooldown();
                }
    
                function handleScroll() {
                    if (ticking) return;
    
                    ticking = true;
                    requestAnimationFrame(() => {
                        const currentScrollY = scrollRuntime.getScroll();
    
                        if (!hasCompleted) {
                            lastScrollY = currentScrollY;
                            ticking = false;
                            return;
                        }
    
                        if (!isVisible) {
                            lastScrollY = currentScrollY;
                            ticking = false;
                            return;
                        }
    
                        const delta = currentScrollY - lastScrollY;
    
                        if (delta > 0 && currentScrollY > LAUREL_CFG.foldScrollMinY && isUnfolded && !isFolding) {
                            animateFold();
                            isUnfolded = false;
                        }
                        else if (currentScrollY <= LAUREL_CFG.unfoldTopEpsilon && !isUnfolded && !isFolding) {
                            animateUnfold();
                        }
    
                        lastScrollY = currentScrollY;
                        ticking = false;
                    });
                }
    
                listen(window, 'scroll', handleScroll, { passive: true });
                listen(document, 'scroll', handleScroll, { passive: true });
    
                listen(document, 'wheel', (e) => {
                    if (!hasCompleted || isFolding || !isVisible) return;
                    if (!canTransition()) return;
    
                    if ((wheelAccumulator > 0 && e.deltaY < 0) || (wheelAccumulator < 0 && e.deltaY > 0)) {
                        wheelAccumulator = 0;
                    }
    
                    wheelAccumulator += e.deltaY;
    
                    if (wheelAccumulator > LAUREL_CFG.wheelThreshold && isUnfolded) {
                        animateFold();
                        isUnfolded = false;
                        wheelAccumulator = 0;
                    }
                    else if (wheelAccumulator < -LAUREL_CFG.wheelThreshold && !isUnfolded) {
                        animateUnfold();
                        wheelAccumulator = 0;
                    }
                }, { passive: true });
    
                const scrollParent = containerRight?.parentElement;
                if (scrollParent && scrollParent !== document.body) {
                    listen(scrollParent, 'scroll', handleScroll, { passive: true });
                }
            }
    
    
            // ═══ INIT ═══
            initLottie();
            setupVisibilityObserver();
    
            // Cleanup for kill()
            cleanups.push(() => {
                clearLaurelTimers();
                destroyLottie();
            });
            }).catch(function () {});
        })();
    }
    // ═════════════════════════════════════════════════════════════════
    // BLOCK 4: BRANDS MARQUEE — STABLE CORE (A6)
    // ═════════════════════════════════════════════════════════════════
    // A6: Stabilny marquee z:
    // - exact sequence width (nie heurystyki)
    // - pause/resume zamiast destroy/rebuild
    // - zachowanie pozycji przy re-entry i resize
    // - idle mode (lżejsza praca gdy brak inputu)
    // - przygotowanie pod drag (jeden model ruchu)
    // ═════════════════════════════════════════════════════════════════
    {
            // 1. ZASOBY — SVG logotypy z /public/LOGOTYPY (HERO_MARQUEE_LOGO_SRCS)
            const LOGO_COUNT = HERO_MARQUEE_LOGO_SRCS.length;

            function createLogoItemElement(index, withEntry) {
                const div = document.createElement('div');
                div.className = withEntry ? 'logo-item with-entry' : 'logo-item';
                const img = document.createElement('img');
                img.src = HERO_MARQUEE_LOGO_SRCS[index % LOGO_COUNT];
                img.alt = '';
                img.width = HERO_MARQUEE_LOGO_BOX.w;
                img.height = HERO_MARQUEE_LOGO_BOX.h;
                img.loading = 'eager';
                img.decoding = 'async';
                img.setAttribute('fetchpriority', 'low');
                div.appendChild(img);
                return div;
            }

            let currentMarqueeInstance = null;
            marqueeStop = () => currentMarqueeInstance?.stop?.();
            marqueeStart = () => currentMarqueeInstance?.start?.();

            // ═══════════════════════════════════════════════════════════════
            // SILNIK FIZYKI — STABLE TIDAL DRIFT (A6) + DRAG (A8)
            // ───────────────────────────────────────────────────────────────
            // Jeden model ruchu: pos + velocity + baseSpeed
            // Scroll/wheel/drag injectuje impuls do velocity
            // Wrap oparty na exact sequenceWidth (mierzone po renderze)
            // Idle mode: throttle render gdy velocity ≈ 0
            // ═══════════════════════════════════════════════════════════════
            class StableTidalMarquee {
                constructor(trackElement, sequenceWidth, viewportElement) {
                    this.track = trackElement;
                    this.viewport = viewportElement;
                    this.sequenceWidth = Math.abs(sequenceWidth);

                    // ⚙️ TIDAL DRIFT — parametry fizyki
                    this.cfg = {
                        baseSpeed:     0.35,   // px/frame base drift (← kierunek)
                        lerp:          0.07,   // smoothing: 7% luki/frame
                        friction:      0.95,   // decay per frame @60fps (dt-aware)
                        scrollGain:    5.0,    // czułość reakcji na scroll
                        velocityClamp: 40,     // hard cap na velocity
                        idleThreshold: 0.01,   // próg dla idle mode
                        dragMomentum:  0.18    // mnożnik release velocity → impulse
                    };

                    // Stan pozycyjny — jeden source of truth
                    this.x        = 0;       // visual position
                    this.targetX  = 0;       // target position (lerped)
                    this.velocity = 0;       // scroll-induced velocity
                    this.rawDelta = 0;       // accumulated input delta
                    this._wheelFiredThisFrame = false;

                    this.isActive = false;
                    this._lastRender = 0;
                    this._isIdle = true;     // idle mode flag

                    // ═══ DRAG STATE (A8) ═══
                    this.isDragging = false;
                    this._dragPointerId = null;
                    this._dragLastX = 0;
                    this._dragLastT = 0;
                    this._dragReleaseVel = 0;

                    // Bindings
                    this.update   = this.update.bind(this);
                    this.onWheel  = this.onWheel.bind(this);
                    this.onScroll = this.onScroll.bind(this);
                    this.onPointerDown = this.onPointerDown.bind(this);
                    this.onPointerMove = this.onPointerMove.bind(this);
                    this.onPointerUp   = this.onPointerUp.bind(this);
                    this.lastScrollY = scrollRuntime.getRawScroll();

                    // Render: quickSetter = bezpośredni DOM write
                    this._setX = gsap.quickSetter(trackElement, "x", "px");
                }

                start() {
                    if (this.isActive) return;
                    this.isActive = true;

                    // Reset velocity (ale NIE pozycji!) przy start
                    this.velocity = 0;
                    this.rawDelta = 0;
                    this.lastScrollY = scrollRuntime.getRawScroll();

                    window.addEventListener('wheel', this.onWheel, { passive: true });
                    window.addEventListener('scroll', this.onScroll, { passive: true });

                    // Drag events na viewport
                    this.viewport.addEventListener('pointerdown', this.onPointerDown, { passive: true }); /* [FIX #4] no preventDefault needed */

                    if (typeof gsap !== 'undefined') {
                        gsap.ticker.add(this.update);
                    }
                }

                stop() {
                    if (!this.isActive) return;
                    this.isActive = false;

                    // Zakończ drag bezpiecznie jeśli aktywny
                    if (this.isDragging) {
                        this._endDrag();
                    }

                    window.removeEventListener('wheel', this.onWheel);
                    window.removeEventListener('scroll', this.onScroll);
                    this.viewport.removeEventListener('pointerdown', this.onPointerDown);

                    if (typeof gsap !== 'undefined') {
                        gsap.ticker.remove(this.update);
                    }
                    // POZYCJA ZACHOWANA — nie resetujemy x, targetX
                }

                // ═══ DRAG HANDLERS (A8) ═══

                onPointerDown(e) {
                    if (!e.isPrimary) return;
                    
                    this.isDragging = true;
                    this._dragPointerId = e.pointerId;
                    this._dragLastX = e.clientX;
                    this._dragLastT = performance.now();
                    this._dragReleaseVel = 0;

                    // Capture pointer for reliable tracking
                    this.viewport.setPointerCapture(e.pointerId);
                    this.viewport.classList.add('is-dragging');

                    // Global listeners for move/up
                    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
                    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
                    window.addEventListener('pointercancel', this.onPointerUp, { passive: true });

                    this._isIdle = false;
                }

                onPointerMove(e) {
                    if (!this.isDragging || e.pointerId !== this._dragPointerId) return;

                    const now = performance.now();
                    const dx = e.clientX - this._dragLastX;
                    const dt = Math.max((now - this._dragLastT) / 1000, 0.001);

                    // Direct update to same position (ten sam pos co autoplay)
                    this.x += dx;
                    this.targetX += dx;

                    // Track release velocity
                    this._dragReleaseVel = dx / dt;

                    this._dragLastX = e.clientX;
                    this._dragLastT = now;

                    // Wrap podczas drag
                    while (this.x <= -this.sequenceWidth) {
                        this.x        += this.sequenceWidth;
                        this.targetX  += this.sequenceWidth;
                    }
                    while (this.x >= 0) {
                        this.x        -= this.sequenceWidth;
                        this.targetX  -= this.sequenceWidth;
                    }

                    // Render immediately
                    this._setX(this.x);
                    this._lastRender = now;
                }

                onPointerUp(e) {
                    if (!this.isDragging || e.pointerId !== this._dragPointerId) return;
                    this._endDrag();
                }

                _endDrag() {
                    if (!this.isDragging) return;

                    // Inject release momentum into physics
                    this.velocity = this._dragReleaseVel * this.cfg.dragMomentum;
                    this.velocity = Math.max(
                        -this.cfg.velocityClamp,
                        Math.min(this.cfg.velocityClamp, this.velocity)
                    );

                    // Cleanup
                    this.isDragging = false;
                    this.viewport.classList.remove('is-dragging');

                    if (this._dragPointerId !== null) {
                        try {
                            this.viewport.releasePointerCapture(this._dragPointerId);
                        } catch (e) { /* already released */ }
                    }
                    this._dragPointerId = null;

                    window.removeEventListener('pointermove', this.onPointerMove);
                    window.removeEventListener('pointerup', this.onPointerUp);
                    window.removeEventListener('pointercancel', this.onPointerUp);
                }

                // ── INPUT: wheel (PRIMARY) ──
                onWheel(e) {
                    if (this.isDragging) return; // ignore during drag
                    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX)
                        ? e.deltaY : e.deltaX;
                    if (Math.abs(delta) > 1) {
                        this.rawDelta += delta * 0.8;
                        this._wheelFiredThisFrame = true;
                        this._isIdle = false; // wyjście z idle
                    }
                }

                // ── INPUT: scroll (FALLBACK) ──
                onScroll() {
                    if (this.isDragging) return; // ignore during drag
                    if (this._wheelFiredThisFrame) return;
                    const currentY = scrollRuntime.getRawScroll();
                    const delta = currentY - this.lastScrollY;
                    this.lastScrollY = currentY;
                    if (Math.abs(delta) > 500) return; // skip restoration spike
                    if (Math.abs(delta) > 0) {
                        this.rawDelta += delta * 0.8;
                        this._isIdle = false;
                    }
                }

                // ── TICK: fizyka + render ──
                update() {
                    if (this.sequenceWidth <= 0) return;

                    // Skip physics during drag (direct control)
                    if (this.isDragging) return;

                    const dt = gsap.ticker.deltaRatio(60);

                    // 1. ACCUMULATE input → velocity
                    this.velocity += this.rawDelta * this.cfg.scrollGain * 0.01;
                    this.velocity = Math.max(
                        -this.cfg.velocityClamp,
                        Math.min(this.cfg.velocityClamp, this.velocity)
                    );
                    this.rawDelta = 0;
                    this._wheelFiredThisFrame = false;

                    // 2. FRICTION DECAY (dt-aware)
                    this.velocity *= Math.pow(this.cfg.friction, dt);
                    if (Math.abs(this.velocity) < 0.001) this.velocity = 0;

                    // 3. TOTAL SPEED = base + velocity
                    const totalSpeed = (-this.cfg.baseSpeed + this.velocity) * dt;

                    // 4. ADVANCE TARGET
                    this.targetX += totalSpeed;

                    // 5. LERP (dt-aware)
                    const lerpFactor = 1 - Math.pow(1 - this.cfg.lerp, dt);
                    this.x += (this.targetX - this.x) * lerpFactor;

                    // 6. WRAP — bidirectional infinite loop
                    while (this.x <= -this.sequenceWidth) {
                        this.x        += this.sequenceWidth;
                        this.targetX  += this.sequenceWidth;
                    }
                    while (this.x >= 0) {
                        this.x        -= this.sequenceWidth;
                        this.targetX  -= this.sequenceWidth;
                    }

                    // 7. IDLE MODE — throttle render gdy velocity ≈ 0
                    const isCurrentlyIdle = Math.abs(this.velocity) < this.cfg.idleThreshold;
                    const now = performance.now();

                    if (isCurrentlyIdle && this._isIdle) {
                        // W idle: render co 33ms (30fps)
                        if (now - this._lastRender < 33.3) return;
                    }

                    this._isIdle = isCurrentlyIdle;
                    this._setX(this.x);
                    this._lastRender = now;
                }

                // ── RESIZE: przelicz limit bez resetu pozycji ──
                updateSequenceWidth(newWidth) {
                    if (newWidth <= 0) return;
                    const oldWidth = this.sequenceWidth;
                    this.sequenceWidth = newWidth;

                    // Przelicz pozycję proporcjonalnie
                    if (oldWidth > 0) {
                        const ratio = newWidth / oldWidth;
                        this.x *= ratio;
                        this.targetX *= ratio;
                    }

                    // Re-normalize do nowego zakresu
                    while (this.x <= -this.sequenceWidth) {
                        this.x        += this.sequenceWidth;
                        this.targetX  += this.sequenceWidth;
                    }
                    while (this.x >= 0) {
                        this.x        -= this.sequenceWidth;
                        this.targetX  -= this.sequenceWidth;
                    }
                }

                destroy() {
                    this.stop();
                    gsap.set(this.track, { clearProps: "transform" });
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // DOM BUILDER — exact sequence, raz budowany
            // ═══════════════════════════════════════════════════════════════
            let brandsHasBuilt = false;
            let domIsBuilt = false;

            function buildBrandsDOM(track, reentryDelay) {
                if (domIsBuilt) return; // DOM już istnieje

                track.style.transform = 'translate3d(0,0,0)';
                const startOffset = (reentryDelay != null)
                    ? reentryDelay
                    : parseFloat(getComputedStyle(container).getPropertyValue('--marquee-offset')) || 2.0; /* [FIX] was: documentElement */

                const existing = track.querySelectorAll('.logo-item');
                const hasSSR = existing.length >= LOGO_COUNT;

                if (hasSSR) {
                    // SSR: pierwsza sekwencja już w HTML — tylko animacja wejścia + klon pod pętlę
                    for (let i = 0; i < LOGO_COUNT; i++) {
                        const div = existing[i];
                        div.classList.add('with-entry');
                        const baseDelay = 0.08;
                        const wave = Math.sin(i * 0.4) * 0.015;
                        const delay = (startOffset + i * baseDelay + wave).toFixed(3);
                        div.style.animationDelay = `${delay}s, ${delay}s`;
                        div.addEventListener('animationend', () => { div.classList.remove('with-entry'); }, { once: true });
                    }
                    for (let i = 0; i < LOGO_COUNT; i++) {
                        const clone = existing[i].cloneNode(true);
                        clone.classList.remove('with-entry');
                        clone.className = 'logo-item';
                        clone.style.animationDelay = '';
                        track.appendChild(clone);
                    }
                } else {
                    track.innerHTML = '';
                    const fragment = document.createDocumentFragment();
                    for (let i = 0; i < LOGO_COUNT; i++) {
                        const div = createLogoItemElement(i, true);
                        const baseDelay = 0.08;
                        const wave = Math.sin(i * 0.4) * 0.015;
                        const delay = (startOffset + i * baseDelay + wave).toFixed(3);
                        div.style.animationDelay = `${delay}s, ${delay}s`;
                        div.addEventListener('animationend', () => { div.classList.remove('with-entry'); }, { once: true });
                        fragment.appendChild(div);
                    }
                    for (let i = 0; i < LOGO_COUNT; i++) {
                        fragment.appendChild(createLogoItemElement(i, false));
                    }
                    track.appendChild(fragment);
                }
                domIsBuilt = true;
            }

            function measureSequenceWidth(track) {
                const items = track.children;
                if (items.length < LOGO_COUNT + 1) return 0;

                // Exact measurement: różnica offsetLeft między item[0] a item[LOGO_COUNT]
                // (początek drugiej sekwencji)
                // BEZ DPR rounding — offsetLeft jest już w CSS pixels
                return items[LOGO_COUNT].offsetLeft - items[0].offsetLeft;
            }

            function initMarquee(reentryDelay) {
                const track = $id('hero-brandsMarqueeTrack');
                const wrapper = $id('hero-brandsMarqueeWrapper');
                if (!track || !wrapper) return;

                // Zniszcz starą instancję (ale DOM zostaje)
                if (currentMarqueeInstance) {
                    currentMarqueeInstance.destroy();
                    currentMarqueeInstance = null;
                }

                // Buduj DOM tylko raz
                buildBrandsDOM(track, reentryDelay);

                // Double rAF = layout committed, pomiar stabilny
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const sequenceWidth = measureSequenceWidth(track);
                        if (sequenceWidth <= 0) return;

                        currentMarqueeInstance = new StableTidalMarquee(track, sequenceWidth, wrapper);
                        currentMarqueeInstance.start();
                        brandsHasBuilt = true;
                    });
                });
            }

            // ═══════════════════════════════════════════════════════════════
            // LIFECYCLE — pause/resume, NIE destroy/rebuild
            // ═══════════════════════════════════════════════════════════════
            function setupBrandsVisibilityObserver() {
                const wrapper = $id('hero-brandsMarqueeWrapper');
                if (!wrapper) return;

                const observer = trackObserver(new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (!entry.isIntersecting) {
                            // OFF-SCREEN → stop physics (DOM stays, position preserved)
                            currentMarqueeInstance?.stop();
                        } else {
                            // ON-SCREEN → resume from current position
                            if (currentMarqueeInstance) {
                                currentMarqueeInstance.start();
                            } else if (brandsHasBuilt) {
                                // Instancja zniszczona przez kill() → rebuild
                                initMarquee(0);
                            }
                        }
                    });
                }, { threshold: 0.0, rootMargin: '100px' }));

                observer.observe(wrapper);
            }

            // ═══════════════════════════════════════════════════════════════
            // RESIZE — przelicz limit, zachowaj pozycję
            // ═══════════════════════════════════════════════════════════════
            let brandsResizeTimeout;
            let lastBrandsWidth = window.innerWidth;

            listen(window, 'resize', () => {
                if (window.innerWidth === lastBrandsWidth) return;
                lastBrandsWidth = window.innerWidth;
                clearTimeout(brandsResizeTimeout);

                brandsResizeTimeout = trackedTimeout(() => {
                    const track = $id('hero-brandsMarqueeTrack');
                    if (!track || !currentMarqueeInstance) return;

                    // Remeasure sequence width
                    const newWidth = measureSequenceWidth(track);
                    if (newWidth <= 0) return;

                    // Update limit bez resetu pozycji
                    currentMarqueeInstance.updateSequenceWidth(newWidth);
                }, 200);
            });

            // Cleanup for kill()
            cleanups.push(() => {
                if (currentMarqueeInstance) {
                    currentMarqueeInstance.destroy();
                    currentMarqueeInstance = null;
                }
                // Przy kill() czyścimy też DOM
                const track = $id('hero-brandsMarqueeTrack');
                if (track) {
                    track.innerHTML = '';
                    track.style.transform = '';
                }
                domIsBuilt = false;
                brandsHasBuilt = false;
            });

            // Init
            requestAnimationFrame(() => {
                initMarquee();
                setupBrandsVisibilityObserver();
            });
    }


    // ═════════════════════════════════════════════════════════════════
    // BLOCK 5: TRAIL (PARTICLE SYSTEM) — FINAL PRODUCTION PATCH
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
                ASPECT:         241 / 308,
                SIZE_MAX:       Math.round(288 * SIZE_SCALE),
                SIZE_MIN_RATIO: 0.80,
                SPACING_SLOW:   250,
                SPACING_FAST:   130,
                SPEED_FLOOR:    0.15,
                SPEED_CEIL:     2.5,
                HISTORY_MS:     200,
                LIFESPAN_BASE:  1100,
                LIFESPAN_MAX:   1800,
                MAX_VISIBLE:    4,
                IN_S:           0.6,
                OUT_S:          0.8,
                OUT_S_FAST:     0.3,
                OUT_S_FLUSH:    0.5,
                MAX_ROT:        8,
                ENTRY_ROT_MIN:  10,
                ENTRY_ROT_MAX:  30,
                IN_EASE:        "back.out(1.4)",
                IN_ROT_EASE:    "power2.out",
                OUT_EASE:       "power2.in",
                BORDER_RADIUS:  8,
                DRIFT_MULT:     110,
                DRIFT_CAP:      1.2,
                DRIFT_S:        1.5,
                DRIFT_EASE:     "power4",
            };

            const MAX_DYING = 2;
            const POOL_SIZE = V.MAX_VISIBLE + MAX_DYING;

            // bounded catch-up — kalkulator-safe
            const MAX_SPAWNS_PER_TICK   = 3;
            const MAX_SEGMENTS_PER_TICK = 12;
            const MIN_SEGMENT_PX        = 0.5;
            const MAX_CARRY_MULT        = 2.0;

            /* ═══ PHOTO ENGINE ═══ */
            let _avifSupported = null;
            (function probeAvif() {
                const img = new Image();
                img.onload  = () => { _avifSupported = true;  };
                img.onerror = () => { _avifSupported = false; };
                img.src = 'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxAAAA';
            })();

            const _conn      = navigator.connection || null;
            const _isRetina  = window.devicePixelRatio >= 2;
            const _saveData  = _conn?.saveData === true;
            const _eff       = _conn?.effectiveType || '4g';
            const _downlink  = _conn?.downlink ?? 10;
            const _slowConn  = _saveData || _eff !== '4g' || _downlink < 5;
            const _useRetina = _isRetina && !_slowConn;

            const IMAGE_GROUPS = {
                A: ['A1','A2','A3','A4'],
                B: ['B1','B2','B3','B4'],
                C: ['C1','C2','C3','C4'],
                D: ['D1','D2','D3','D4'],
            };
            const GROUP_KEYS = Object.keys(IMAGE_GROUPS);
            const FLAT_META  = GROUP_KEYS.flatMap(k => IMAGE_GROUPS[k].map(c => ({ k, c })));

            const imageTemplates = new Map();

            /* ═══ STRATEGY — QuotaSequence ═══ */
            const strategy = (function makeQuotaSequence() {
                let globalIdx = 0;
                let curKey    = null;
                let curPos    = 0;
                let usedInCat = 0;
                let quota     = 0;

                function advanceToNextKey() {
                    const k = FLAT_META[globalIdx % FLAT_META.length].k;
                    while (FLAT_META[globalIdx % FLAT_META.length].k === k) {
                        globalIdx = (globalIdx + 1) % FLAT_META.length;
                    }
                    return k;
                }

                return {
                    flush: false,
                    reset() {
                        if (curKey !== null) {
                            while (FLAT_META[globalIdx % FLAT_META.length].k === curKey) {
                                globalIdx = (globalIdx + 1) % FLAT_META.length;
                            }
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

            /* ═══ BOUNDS CACHE — document-space ═══ */
            const marqueeEl = $id('hero-brandsMarqueeWrapper');
            const heroContentEl = $('.hero-content'); /* [FIX ENT-JS-03] was: document.querySelector */

            const bounds = {
                leftDoc: 0,
                topDoc: 0,
                rightDoc: 0,
                bottomDoc: 0,
                maxYDoc: 0
            };

            // Exclusion zone — trail nie spawnuje w obszarze hero-content (H1/H2)
            const exclusion = {
                leftDoc: 0,
                topDoc: 0,
                rightDoc: 0,
                bottomDoc: 0,
                active: false
            };

            let measureRaf = 0;
            let measureQueued = false;

            function measureBoundsNow() {
                measureQueued = false;

                const sx = window.scrollX || window.pageXOffset || 0;
                const sy = window.scrollY || window.pageYOffset || 0;

                const r = trailEl.getBoundingClientRect();
                bounds.leftDoc   = r.left + sx;
                bounds.topDoc    = r.top + sy;
                bounds.rightDoc  = r.right + sx;
                bounds.bottomDoc = r.bottom + sy;

                bounds.maxYDoc = bounds.bottomDoc;
                if (marqueeEl) {
                    const mr = marqueeEl.getBoundingClientRect();
                    bounds.maxYDoc = mr.bottom + sy;
                }

                // Measure exclusion zone (hero-content = H1/H2 area)
                if (heroContentEl) {
                    const er = heroContentEl.getBoundingClientRect();
                    exclusion.leftDoc   = er.left + sx;
                    exclusion.topDoc    = er.top + sy;
                    exclusion.rightDoc  = er.right + sx;
                    exclusion.bottomDoc = er.bottom + sy;
                    exclusion.active    = true;
                }
            }

            function scheduleMeasureBounds() {
                if (measureQueued) return;
                measureQueued = true;
                measureRaf = requestAnimationFrame(measureBoundsNow);
            }

            const boundsRO = typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(scheduleMeasureBounds)
                : null;

            if (boundsRO) {
                boundsRO.observe(trailEl);
                if (marqueeEl) boundsRO.observe(marqueeEl);
                if (heroContentEl) boundsRO.observe(heroContentEl);
            }

            listen(window, 'resize', scheduleMeasureBounds, { passive: true });
            listen(window, 'orientationchange', scheduleMeasureBounds, { passive: true });

            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(scheduleMeasureBounds);
            }

            scheduleMeasureBounds();

            /* ═══ POOL CREATION ═══ */
            const slots = [];
            const liveSlots = [];
            let dyingCount = 0;
            let liveCount = 0;
            let zIdx = 1;

            function createTrailSlot(index) {
                const wrap = document.createElement('div');
                wrap.className = 'trail-wrap hw-hint';
                wrap.dataset.slot = String(index);

                const inner = document.createElement('div');
                inner.className = 'trail-block is-photo';
                inner.style.borderRadius = V.BORDER_RADIUS + 'px';

                const img = document.createElement('img');
                img.alt = '';
                img.draggable = false;
                img.decoding = 'async';
                img.fetchpriority = 'low';
                img.onload = function() { 
                    this.classList.add('loaded');
                    wrap.classList.add('img-ready'); // slot widoczny dopiero teraz
                };
                img.onerror = function() { this.classList.add('load-failed'); };

                const flash = document.createElement('div');
                flash.className = 'trail-flash';

                inner.appendChild(img);
                inner.appendChild(flash);
                wrap.appendChild(inner);
                trailEl.appendChild(wrap);

                gsap.set(wrap, {
                    autoAlpha: 0,
                    xPercent: -50,
                    yPercent: -50,
                    scale: 0,
                    x: 0,
                    y: 0,
                    rotation: 0,
                    zIndex: 0
                });

                return {
                    id: index,
                    state: 'idle',
                    key: '',
                    wrap,
                    inner,
                    img,
                    flash,
                    bornAt: 0,
                    dieAt: 0
                };
            }

            function buildTrailPool() {
                for (let i = 0; i < POOL_SIZE; i++) {
                    slots.push(createTrailSlot(i));
                }
            }

            buildTrailPool();

            /* ═══ SLOT PHOTO SWAP ═══ */
            function setSlotPhoto(slot, key) {
                if (slot.key === key) return;

                const tpl = imageTemplates.get(key);
                if (!tpl) return;

                const nextSrc = tpl.currentSrc || tpl.src;
                if (slot.img.src !== nextSrc) {
                    slot.img.classList.remove('loaded', 'load-failed');
                    slot.wrap.classList.remove('img-ready'); // ukryj do załadowania
                    slot.img.src = nextSrc;
                    
                    // Cached image — onload może nie odpalić
                    if (slot.img.complete && slot.img.naturalWidth > 0) {
                        slot.img.classList.add('loaded');
                        slot.wrap.classList.add('img-ready');
                    }
                }

                slot.key = key;
            }

            /* ═══ SLOT LIFECYCLE ═══ */
            function getIdleSlot() {
                for (let i = 0; i < slots.length; i++) {
                    if (slots[i].state === 'idle') return slots[i];
                }
                return null;
            }

            function resetSlot(slot) {
                gsap.killTweensOf(slot.wrap);
                gsap.killTweensOf(slot.inner);
                gsap.killTweensOf(slot.img);
                gsap.killTweensOf(slot.flash);

                slot.state = 'idle';
                slot.bornAt = 0;
                slot.dieAt = 0;
                slot.wrap.classList.remove('img-ready'); // reset widoczności

                gsap.set(slot.wrap, {
                    autoAlpha: 0,
                    x: 0,
                    y: 0,
                    scale: 0,
                    rotation: 0,
                    zIndex: 0
                });

                gsap.set(slot.inner, { scale: 1 });
                gsap.set(slot.img,   { scale: 1 });
                gsap.set(slot.flash, { opacity: 0 });
            }

            function beginExit(slot, outS) {
                if (!slot || slot.state !== 'live') return;

                slot.state = 'exiting';
                liveCount = Math.max(0, liveCount - 1);
                dyingCount++;

                gsap.killTweensOf(slot.wrap);
                gsap.killTweensOf(slot.inner);
                gsap.killTweensOf(slot.img);
                gsap.killTweensOf(slot.flash);

                gsap.fromTo(slot.img,
                    { scale: 1 },
                    { scale: 3, duration: outS, ease: V.OUT_EASE, overwrite: 'auto' }
                );

                gsap.fromTo(slot.inner,
                    { scale: 1 },
                    { scale: 0, duration: outS, ease: V.OUT_EASE, overwrite: 'auto' }
                );

                gsap.to(slot.wrap, {
                    rotation: '+=360',
                    autoAlpha: 0,
                    duration: outS,
                    ease: V.OUT_EASE,
                    overwrite: 'auto',
                    onComplete: () => {
                        dyingCount = Math.max(0, dyingCount - 1);
                        resetSlot(slot);
                    }
                });
            }

            /**
             * cullSlot — natychmiastowe przerwanie bez widocznego "fast shrink".
             * Używane przy overflow/recycle zamiast beginExit(OUT_S_FAST).
             * Oko łatwiej wybacza brak dokończenia ogona niż turbo-przyspieszony shrink.
             */
            function cullSlot(slot) {
                if (!slot) return;

                // Korekta liczników zależnie od stanu
                if (slot.state === 'live') {
                    liveCount = Math.max(0, liveCount - 1);
                } else if (slot.state === 'exiting') {
                    dyingCount = Math.max(0, dyingCount - 1);
                }

                gsap.killTweensOf(slot.wrap);
                gsap.killTweensOf(slot.inner);
                gsap.killTweensOf(slot.img);
                gsap.killTweensOf(slot.flash);

                resetSlot(slot);
            }

            /* ═══ HELPERS ═══ */
            const SIZE_MIN = Math.round(V.SIZE_MAX * V.SIZE_MIN_RATIO);
            const getSize  = (t) => V.SIZE_MAX - (V.SIZE_MAX - SIZE_MIN) * t;
            const getSpacing = (t) => V.SPACING_SLOW + (V.SPACING_FAST - V.SPACING_SLOW) * t;

            /* ═══ RING BUFFER — speed ═══ */
            const HIST_SIZE = 12;
            const histX = new Float32Array(HIST_SIZE);
            const histY = new Float32Array(HIST_SIZE);
            const histT = new Float32Array(HIST_SIZE);
            let histHead = 0;
            let histLen = 0;

            function pushHistory(x, y) {
                const now = performance.now();
                histX[histHead] = x;
                histY[histHead] = y;
                histT[histHead] = now;
                histHead = (histHead + 1) % HIST_SIZE;
                if (histLen < HIST_SIZE) histLen++;

                while (histLen > 1) {
                    const oldest = (histHead - histLen + HIST_SIZE) % HIST_SIZE;
                    if (now - histT[oldest] > V.HISTORY_MS) histLen--;
                    else break;
                }
            }

            function getSpeed() {
                if (histLen < 2) return 0;
                const oldest = (histHead - histLen + HIST_SIZE) % HIST_SIZE;
                const newest = (histHead - 1 + HIST_SIZE) % HIST_SIZE;
                const dt = histT[newest] - histT[oldest];
                if (dt < 4) return 0;

                return Math.hypot(
                    histX[newest] - histX[oldest],
                    histY[newest] - histY[oldest]
                ) / dt;
            }

            function speedNorm() {
                return Math.min(1, Math.max(0,
                    (getSpeed() - V.SPEED_FLOOR) / (V.SPEED_CEIL - V.SPEED_FLOOR)
                ));
            }

            function getLifespan() {
                const ratio = 1 - Math.min(liveCount / V.MAX_VISIBLE, 1);
                return V.LIFESPAN_BASE + (V.LIFESPAN_MAX - V.LIFESPAN_BASE) * ratio;
            }

            /* ═══ INPUT QUEUE / RESAMPLER ═══ */
            const INPUT_Q_MAX = 32;
            const qX = new Float32Array(INPUT_Q_MAX);
            const qY = new Float32Array(INPUT_Q_MAX);
            let qHead = 0;
            let qTail = 0;
            let qLen  = 0;

            let sampleCursorX = 0;
            let sampleCursorY = 0;
            let hasSampleCursor = false;
            let carryDist = 0;

            const tmpPt = { x: 0, y: 0 };

            function enqueuePointerPoint(x, y) {
                qX[qTail] = x;
                qY[qTail] = y;
                qTail = (qTail + 1) % INPUT_Q_MAX;

                if (qLen < INPUT_Q_MAX) {
                    qLen++;
                } else {
                    qHead = (qHead + 1) % INPUT_Q_MAX;
                }
            }

            function dequeuePointerPoint(out) {
                if (qLen === 0) return false;
                out.x = qX[qHead];
                out.y = qY[qHead];
                qHead = (qHead + 1) % INPUT_Q_MAX;
                qLen--;
                return true;
            }

            function emergencyKeepLatestPoint() {
                if (qLen <= 1) return;

                const lastIdx = (qTail - 1 + INPUT_Q_MAX) % INPUT_Q_MAX;
                const x = qX[lastIdx];
                const y = qY[lastIdx];

                qHead = 0;
                qTail = 1;
                qLen = 1;

                qX[0] = x;
                qY[0] = y;
            }

            /* ═══ STATE ═══ */
            let mx = 0;
            let my = 0;
            let lmx = 0;
            let lmy = 0;
            let isMoving = false;
            let lastMoveT = 0;
            let trailWasEmpty = true;
            let tickRegistered = false;

            /* ═══ OVERSHOOT CONFIG ═══ */
            const OVERSHOOT = {
                wrap: {
                    peak: 1.07,
                    peakDur: 0.76,
                    settleDur: 0.35,
                    peakEase: 'sine.out',
                    settleEase: 'sine.inOut'
                },
                img: {
                    peak: 1.07,
                    peakDur: 0.76,
                    settleDur: 0.40,
                    peakEase: 'sine.out',
                    settleEase: 'sine.inOut'
                }
            };

            /* ═══ SPAWN ═══ */
            function spawnIntoSlot(slot, t, xDoc, yDoc, fromXDoc, fromYDoc) {
                const key = pickColor();

                if (strategy.flush) {
                    for (let i = 0; i < liveSlots.length; i++) {
                        const s = liveSlots[i];
                        if (s.state === 'live') beginExit(s, V.OUT_S_FLUSH);
                    }
                }

                const w = getSize(t);
                const h = w * V.ASPECT;
                const rot = (Math.random() - 0.5) * V.MAX_ROT * 2;
                const lifespan = getLifespan();

                const entryExtra = (V.ENTRY_ROT_MIN + Math.random() * (V.ENTRY_ROT_MAX - V.ENTRY_ROT_MIN))
                                 * (Math.random() < 0.5 ? -1 : 1);
                const startRot = rot + entryExtra;

                const x = xDoc - bounds.leftDoc;
                const y = yDoc - bounds.topDoc;
                const fromX = fromXDoc - bounds.leftDoc;
                const fromY = fromYDoc - bounds.topDoc;

                setSlotPhoto(slot, key);

                slot.state = 'live';
                liveCount++;
                slot.bornAt = performance.now();
                slot.dieAt = slot.bornAt + lifespan;

                const ws = slot.wrap.style;
                ws.left   = x + 'px';
                ws.top    = y + 'px';
                ws.width  = w + 'px';
                ws.height = h + 'px';

                ++zIdx;

                const dx = xDoc - fromXDoc;
                const dy = yDoc - fromYDoc;
                const cdist = Math.hypot(dx, dy);

                let ndx = 0;
                let ndy = 0;
                if (cdist > 0) {
                    ndx = dx / cdist;
                    ndy = dy / cdist;
                }

                const rawDrift = cdist / 100;
                const driftScale = rawDrift <= 1
                    ? rawDrift
                    : Math.min(1 + Math.sqrt(rawDrift - 1) * 0.2, V.DRIFT_CAP);

                ndx *= driftScale;
                ndy *= driftScale;

                gsap.killTweensOf(slot.wrap);
                gsap.killTweensOf(slot.inner);
                gsap.killTweensOf(slot.img);
                gsap.killTweensOf(slot.flash);

                gsap.set(slot.wrap, {
                    autoAlpha: 1,
                    xPercent: -50,
                    yPercent: -50,
                    x: 0,
                    y: 0,
                    scale: 0,
                    rotation: startRot,
                    zIndex: zIdx
                });

                gsap.set(slot.inner, { scale: 1 });
                gsap.set(slot.img,   { scale: 1 });
                gsap.set(slot.flash, { opacity: 0 });

                gsap.fromTo(slot.wrap,
                    { x: fromX - x, y: fromY - y },
                    { x: 0, y: 0, duration: V.IN_S, ease: V.IN_EASE, overwrite: 'auto' }
                );

                gsap.fromTo(slot.wrap,
                    { scale: 0 },
                    {
                        keyframes: [
                            { scale: OVERSHOOT.wrap.peak, duration: OVERSHOOT.wrap.peakDur, ease: OVERSHOOT.wrap.peakEase },
                            { scale: 1, duration: OVERSHOOT.wrap.settleDur, ease: OVERSHOOT.wrap.settleEase }
                        ],
                        overwrite: 'auto'
                    }
                );

                gsap.fromTo(slot.wrap,
                    { rotation: startRot },
                    {
                        rotation: rot,
                        duration: V.IN_S,
                        ease: V.IN_ROT_EASE,
                        overwrite: 'auto'
                    }
                );

                gsap.fromTo(slot.img,
                    { scale: 1 },
                    {
                        keyframes: [
                            { scale: OVERSHOOT.img.peak, duration: OVERSHOOT.img.peakDur, ease: OVERSHOOT.img.peakEase },
                            { scale: 1, duration: OVERSHOOT.img.settleDur, ease: OVERSHOOT.img.settleEase }
                        ],
                        overwrite: 'auto'
                    }
                );

                gsap.fromTo(slot.flash,
                    { opacity: 0 },
                    {
                        keyframes: [
                            { opacity: 0,    duration: 0 },
                            { opacity: 0.65, duration: 0.20, ease: 'power2.out' },
                            { opacity: 0,    duration: 0.90, ease: 'sine.inOut' }
                        ],
                        overwrite: 'auto'
                    }
                );

                gsap.to(slot.wrap, {
                    x: `+=${ndx * V.DRIFT_MULT}`,
                    y: `+=${ndy * V.DRIFT_MULT}`,
                    duration: V.DRIFT_S,
                    ease: V.DRIFT_EASE,
                    delay: 0.05,
                    overwrite: 'auto'
                });

                liveSlots.push(slot);
            }

            /* ═══ CONTAINER CHECK ═══ */
            function isInContainerDoc(xDoc, yDoc) {
                // Must be inside trail container
                if (xDoc < bounds.leftDoc || xDoc > bounds.rightDoc ||
                    yDoc < bounds.topDoc  || yDoc > bounds.maxYDoc) {
                    return false;
                }
                // Must NOT be inside exclusion zone (hero-content = H1/H2 area)
                if (exclusion.active &&
                    xDoc >= exclusion.leftDoc && xDoc <= exclusion.rightDoc &&
                    yDoc >= exclusion.topDoc  && yDoc <= exclusion.bottomDoc) {
                    return false;
                }
                return true;
            }

            /* ═══ SLOT ACQUISITION / PRESSURE ═══ */
            function getSpawnSlot(spacing) {
                const idle = getIdleSlot();
                if (idle) return idle;

                // Controlled recycle only under real pressure.
                // Używamy cullSlot() — natychmiastowe ucięcie bez widocznego shrinka.
                if (qLen > 3 || carryDist > spacing) {
                    for (let i = 0; i < liveSlots.length; i++) {
                        const slot = liveSlots[i];
                        if (slot.state === 'live') {
                            liveSlots.splice(i, 1);
                            cullSlot(slot);
                            return slot;
                        }
                    }
                }

                return null;
            }

            /* ═══ INPUT DRAIN — arc-length resampling ═══ */
            function drainPointerQueue() {
                let spawnsLeft = MAX_SPAWNS_PER_TICK;
                let segments   = 0;

                while (qLen > 0 && segments < MAX_SEGMENTS_PER_TICK) {
                    if (!dequeuePointerPoint(tmpPt)) break;
                    segments++;

                    const endX = tmpPt.x;
                    const endY = tmpPt.y;

                    if (!hasSampleCursor) {
                        sampleCursorX = endX;
                        sampleCursorY = endY;
                        hasSampleCursor = true;
                        continue;
                    }

                    if (trailWasEmpty && spawnsLeft > 0 && isInContainerDoc(sampleCursorX, sampleCursorY)) {
                        const slot0 = getSpawnSlot(V.SPACING_SLOW);
                        if (slot0) {
                            const t0 = speedNorm();
                            lmx = sampleCursorX;
                            lmy = sampleCursorY;
                            trailWasEmpty = false;
                            carryDist = 0;
                            spawnIntoSlot(
                                slot0,
                                t0,
                                sampleCursorX,
                                sampleCursorY,
                                sampleCursorX,
                                sampleCursorY
                            );
                            spawnsLeft--;
                        }
                    }

                    let startX = sampleCursorX;
                    let startY = sampleCursorY;
                    let dx = endX - startX;
                    let dy = endY - startY;
                    let segLen = Math.hypot(dx, dy);

                    if (segLen < MIN_SEGMENT_PX) {
                        sampleCursorX = endX;
                        sampleCursorY = endY;
                        continue;
                    }

                    while (spawnsLeft > 0) {
                        const t = speedNorm();
                        const spacing = getSpacing(t);
                        const debt = Math.min(carryDist, spacing);
                        const step = spacing - debt;

                        // guard against zero / near-zero step
                        if (step <= MIN_SEGMENT_PX) {
                            carryDist = 0;
                            break;
                        }

                        if (debt + segLen < spacing) break;

                        const ratio = step / segLen;
                        const sampleX = startX + dx * ratio;
                        const sampleY = startY + dy * ratio;

                        if (isInContainerDoc(sampleX, sampleY)) {
                            const slot = getSpawnSlot(spacing);
                            if (!slot) {
                                if (qLen > 2) emergencyKeepLatestPoint();
                                carryDist = Math.min(debt + segLen, spacing * MAX_CARRY_MULT);
                                sampleCursorX = endX;
                                sampleCursorY = endY;
                                return;
                            }

                            lmx = sampleX;
                            lmy = sampleY;
                            spawnIntoSlot(slot, t, sampleX, sampleY, startX, startY);
                            spawnsLeft--;
                        }

                        startX = sampleX;
                        startY = sampleY;
                        dx = endX - startX;
                        dy = endY - startY;
                        segLen = Math.hypot(dx, dy);
                        carryDist = 0;

                        if (segLen < MIN_SEGMENT_PX) break;
                    }

                    carryDist = Math.min(carryDist + segLen, V.SPACING_SLOW * MAX_CARRY_MULT);
                    sampleCursorX = endX;
                    sampleCursorY = endY;

                    if (spawnsLeft <= 0) {
                        if (qLen > 8) emergencyKeepLatestPoint();
                        break;
                    }
                }
            }

            /* ═══ CLEANUP ═══ */
            function cleanup() {
                const now = performance.now();

                if (liveCount === 0 && zIdx !== 1) zIdx = 1;

                // OVERFLOW POLICY:
                // Pod presją NIE przyspieszamy widocznego shrinka (beginExit + OUT_S_FAST).
                // Zamiast tego natychmiastowe ucięcie (cullSlot) najstarszych live slotów.
                // Oko łatwiej wybacza brak dokończenia ogona niż turbo-przyspieszony collapse.
                if (liveCount > V.MAX_VISIBLE) {
                    for (let i = 0; i < liveSlots.length; i++) {
                        const slot = liveSlots[i];
                        if (slot.state === 'live') {
                            liveSlots.splice(i, 1);
                            cullSlot(slot);
                            if (liveCount <= V.MAX_VISIBLE) break;
                            i--;  // splice shifted indices
                        }
                    }
                }

                // Natural lifespan expiry — normalne, spokojne wygaszenie
                if (dyingCount < MAX_DYING) {
                    for (let i = 0; i < liveSlots.length; i++) {
                        const slot = liveSlots[i];
                        if (slot.state === 'live' && now >= slot.dieAt) {
                            beginExit(slot, V.OUT_S);
                            if (dyingCount >= MAX_DYING) break;
                        }
                    }
                }

                // Cleanup idle slots from liveSlots array
                for (let i = liveSlots.length - 1; i >= 0; i--) {
                    if (liveSlots[i].state === 'idle') {
                        liveSlots.splice(i, 1);
                    }
                }
            }

            /* ═══ TICK ═══ */
            function tick() {
                // sync after external resume() re-adds tick from tickFns[]
                if (!tickRegistered) tickRegistered = true;

                if (isMoving && performance.now() - lastMoveT > 100) {
                    isMoving = false;
                }

                if (!isMoving && qLen === 0 && liveCount === 0 && dyingCount === 0) {
                    if (tickRegistered) {
                        gsap.ticker.remove(tick);
                        tickRegistered = false;
                    }
                    trailWasEmpty = true;
                    strategy.reset();
                    return;
                }

                if (liveCount === 0) {
                    trailWasEmpty = true;
                    strategy.reset();
                }

                drainPointerQueue();
                cleanup();
            }

            function ensureTicking() {
                // defensive against pause/resume + self-unregister state desync
                gsap.ticker.remove(tick);
                gsap.ticker.add(tick);
                tickRegistered = true;
            }

            /* ═══ INPUT ═══ */
            /** Lenis ustawia html.lenis-scrolling podczas smooth scroll — omijamy trail (manifest: is-scrolling guard). */
            function isHeroLenisScrolling() {
                return document.documentElement.classList.contains('lenis-scrolling');
            }

            function onTrailPointerMove(e) {
                if (e.pointerType && e.pointerType !== 'mouse') return;
                if (isHeroLenisScrolling()) return;

                const sx = window.scrollX || window.pageXOffset || 0;
                const sy = window.scrollY || window.pageYOffset || 0;

                const batch = (typeof e.getCoalescedEvents === 'function')
                    ? e.getCoalescedEvents()
                    : null;

                if (batch && batch.length) {
                    for (let i = 0; i < batch.length; i++) {
                        const ev = batch[i];
                        const x = ev.clientX + sx;
                        const y = ev.clientY + sy;
                        mx = x;
                        my = y;
                        pushHistory(x, y);
                        enqueuePointerPoint(x, y);
                    }
                } else {
                    const x = e.clientX + sx;
                    const y = e.clientY + sy;
                    mx = x;
                    my = y;
                    pushHistory(x, y);
                    enqueuePointerPoint(x, y);
                }

                isMoving = true;
                lastMoveT = performance.now();
                ensureTicking();
            }

            listen(document, "mouseover", function init(e) {
                if (isHeroLenisScrolling()) return;
                const sx = window.scrollX || window.pageXOffset || 0;
                const sy = window.scrollY || window.pageYOffset || 0;

                mx = lmx = e.clientX + sx;
                my = lmy = e.clientY + sy;

                pushHistory(mx, my);
                enqueuePointerPoint(mx, my);

                sampleCursorX = mx;
                sampleCursorY = my;
                hasSampleCursor = true;
                carryDist = 0;

                document.removeEventListener("mouseover", init);
            });

            /* ═══ PRELOAD ═══ */
            let imagesPreloaded = false;

            function trailSrcCandidates(key) {
                const retina = _useRetina ? '_RETINA' : '';
                const base = `/trail/${key}_strrona_internetowa`;
                return [
                    `${base}${retina}.avif`,
                    `${base}.avif`,
                    `${base}${retina}.webp`,
                    `${base}.webp`,
                ];
            }

            async function preloadAllImages() {
                const keys = FLAT_META.map(m => m.c);
                const BATCH_SIZE = 4;

                for (let i = 0; i < keys.length; i += BATCH_SIZE) {
                    const batch = keys.slice(i, i + BATCH_SIZE);

                    await Promise.all(batch.map(key => {
                        return new Promise((resolve) => {
                            const img = document.createElement('img');
                            img.alt = '';
                            img.draggable = false;
                            img.decoding = 'async';
                            img.setAttribute('fetchpriority', 'low');

                            const candidates = trailSrcCandidates(key);
                            let ci = 0;

                            function tryNext() {
                                if (ci >= candidates.length) {
                                    img.classList.add('load-failed');
                                    resolve();
                                    return;
                                }
                                const url = candidates[ci];
                                ci++;
                                img.onload = () => {
                                    imageTemplates.set(key, img);
                                    resolve();
                                };
                                img.onerror = tryNext;
                                img.src = url;
                            }
                            tryNext();
                        });
                    }));
                }

                imagesPreloaded = true;
            }

            /* ═══ ACTIVATION ═══ */
            let trailActive = false;

            function activateTrail() {
                if (trailActive) return;
                if (!imagesPreloaded) return;
                trailActive = true;

                if ('PointerEvent' in window) {
                    addHfListener(document, 'pointermove', onTrailPointerMove, { passive: true });
                } else {
                    addHfListener(document, 'mousemove', (e) => {
                        if (isHeroLenisScrolling()) return;
                        const sx = window.scrollX || window.pageXOffset || 0;
                        const sy = window.scrollY || window.pageYOffset || 0;
                        const x = e.clientX + sx;
                        const y = e.clientY + sy;
                        mx = x;
                        my = y;
                        pushHistory(x, y);
                        enqueuePointerPoint(x, y);
                        isMoving = true;
                        lastMoveT = performance.now();
                        ensureTicking();
                    }, { passive: true });
                }

                // compatibility with factory pause()/resume()
                tickFns.push(tick);
            }

            const TRAIL_MIN_DELAY = 4500;

            function tryActivate() {
                const elapsed = performance.now() - heroInitT0;

                if (elapsed >= TRAIL_MIN_DELAY) {
                    preloadAllImages().then(() => {
                        scheduleMeasureBounds();
                        activateTrail();
                    });
                } else {
                    trackedTimeout(() => {
                        preloadAllImages().then(() => {
                            scheduleMeasureBounds();
                            activateTrail();
                        });
                    }, TRAIL_MIN_DELAY - elapsed);
                }
            }

            tryActivate();

            /* ═══ CLEANUP ═══ */
            cleanups.push(() => {
                if (measureRaf) cancelAnimationFrame(measureRaf);
                if (boundsRO) boundsRO.disconnect();

                if (tickRegistered) {
                    gsap.ticker.remove(tick);
                    tickRegistered = false;
                }

                const idx = tickFns.indexOf(tick);
                if (idx !== -1) tickFns.splice(idx, 1);

                for (const slot of slots) {
                    gsap.killTweensOf(slot.wrap);
                    gsap.killTweensOf(slot.inner);
                    gsap.killTweensOf(slot.img);
                    gsap.killTweensOf(slot.flash);
                    slot.wrap.remove();
                }

                slots.length = 0;
                liveSlots.length = 0;
                liveCount = 0;
                dyingCount = 0;
                qHead = 0;
                qTail = 0;
                qLen = 0;
                hasSampleCursor = false;
                carryDist = 0;
            });

        })();
    }

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
            /* [FIX #1] tracked listeners */
            listen(ctaWrapper, 'touchstart', () => ctaWrapper.classList.add('touching'), { passive: true });
            listen(ctaWrapper, 'touchend', () => ctaWrapper.classList.remove('touching'), { passive: true });
            listen(ctaWrapper, 'touchcancel', () => ctaWrapper.classList.remove('touching'), { passive: true });
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 7B: PILL — plus jednorazowy klik
    // ═════════════════════════════════════════════════════════════════
    {
        const pillPlus  = $('.pill-av-plus');
        const pillBadge = $('.pill-badge');
        const pillTxt   = $('.pill-txt');
        if (pillPlus && pillBadge && pillTxt) {
            listen(pillPlus, 'click', () => {
                pillBadge.style.display = 'none';
                pillTxt.textContent = '→ Przewiń w dół, aby zobaczyć opinie.';
            }, { once: true });
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
    // [FIX #5] LAZY INIT — sprites created only when needed (desktop hover only)
    // ═════════════════════════════════════════════════════════════════
    const STAR_PTS = 8;
    const starCos = new Float32Array(STAR_PTS), starSin = new Float32Array(STAR_PTS);
    for (let i = 0; i < STAR_PTS; i++) { const a = (i * Math.PI) / 4; starCos[i] = Math.cos(a); starSin[i] = Math.sin(a); }

    const STAR_SPR_SZ = 128;
    const STAR_SPR_HALF = STAR_SPR_SZ / 2;
    
    /* [FIX #5] Lazy sprite cache */
    let _sharedStarPhases = null;
    let _sharedDotSprite = null;
    
    function getSharedStarPhases() {
        if (_sharedStarPhases) return _sharedStarPhases;
        _sharedStarPhases = [0, 0.5, 1.0].map(tw => {
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
        return _sharedStarPhases;
    }
    
    function getSharedDotSprite() {
        if (_sharedDotSprite) return _sharedDotSprite;
        _sharedDotSprite = document.createElement('canvas'); 
        _sharedDotSprite.width = 64; 
        _sharedDotSprite.height = 64;
        const ctx = _sharedDotSprite.getContext('2d');
        if (ctx) {
            ctx.translate(32, 32);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0,0, 32*0.15, 0, Math.PI*2); ctx.fill();
        }
        return _sharedDotSprite;
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 10: CTA — HALO CANVAS (aureola, desktop only)
    // ═════════════════════════════════════════════════════════════════
    // Delayed 4s to avoid PEAK CPU usage during entrance animations
    {
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth >= 600) {
            trackedTimeout(() => {
            const haloWrapper = $('.btn-wrapper-wave');
            const haloButton = $('.cta-button');
            if (haloWrapper && haloButton) {
                const haloCanvas = document.createElement('canvas');
                const haloCtx = haloCanvas.getContext('2d');
                if (haloCtx) {
                haloCanvas.style.cssText = 'position:absolute;top:-100%;left:-100%;width:300%;height:300%;pointer-events:none;z-index:5;opacity:0;transition:opacity 0.5s ease-out';
                haloWrapper.insertBefore(haloCanvas, haloWrapper.firstChild);
                // Fade in after insert
                requestAnimationFrame(() => { haloCanvas.style.opacity = '1'; });
                
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
                        haloCtx.drawImage(getSharedStarPhases()[phase], -drawR, -drawR, drawR*2, drawR*2);
                        // White center dot — life alpha only (no twinkle), more stable anchor
                        haloCtx.globalAlpha = this.life;
                        haloCtx.drawImage(getSharedDotSprite(), -drawR, -drawR, drawR*2, drawR*2);
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
            }, 4000); // 4s delay — avoid PEAK CPU during entrance
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 11: CTA — CURSOR CANVAS (sparkles, desktop only)
    // ═════════════════════════════════════════════════════════════════
    // [A9] Hardening: DPR-aware backing store, scroll rect update
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
                
                // [A9] DPR-aware backing store
                const C_LOGICAL_W = 500, C_LOGICAL_H = 300;
                let cDpr = window.devicePixelRatio || 1;
                cCanvas.width = C_LOGICAL_W * cDpr;
                cCanvas.height = C_LOGICAL_H * cDpr;
                cCanvas.style.width = C_LOGICAL_W + 'px';
                cCanvas.style.height = C_LOGICAL_H + 'px';
                cWrapper.appendChild(cCanvas);
                
                let cIsHover = false, cLastSpawn = 0;
                const cSpawnRate = 31;
                let cMX = 250, cMY = 150, cTMX = 250, cTMY = 150, cLMX = 250, cLMY = 150;
                let cMSpeed = 0, cMAngle = 0, cSmSpeed = 0, cIdleTime = 0, cLastTs = 0;
                let cAnimId = null, cIsAnim = false;
                const C_MAX = 150;
                const C_FRICTION = 0.970225; // Math.pow(0.985, 2) pre-computed for 2× step
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
                
                // [A9] Rebuild backing store on DPR change
                function cRebuildBackingStore() {
                    const newDpr = window.devicePixelRatio || 1;
                    if (newDpr !== cDpr) {
                        cDpr = newDpr;
                        cCanvas.width = C_LOGICAL_W * cDpr;
                        cCanvas.height = C_LOGICAL_H * cDpr;
                    }
                }
                
                function cUpdateRect() {
                    cRect = cCanvas.getBoundingClientRect();
                    cScX = C_LOGICAL_W / cRect.width;
                    cScY = C_LOGICAL_H / cRect.height;
                }
                requestAnimationFrame(cUpdateRect);
                
                let cResizeSched = false;
                listen(window, 'resize', () => {
                    if (!cResizeSched) {
                        cResizeSched = true;
                        requestAnimationFrame(() => {
                            cRebuildBackingStore(); // [A9] check DPR change
                            cUpdateRect();
                            cResizeSched = false;
                        });
                    }
                });
                
                // [A9] Scroll rect update tylko podczas hover
                let cScrollSched = false;
                const cOnScroll = () => {
                    if (!cIsHover) return; // skip when not hovering
                    if (!cScrollSched) {
                        cScrollSched = true;
                        requestAnimationFrame(() => {
                            cUpdateRect();
                            cScrollSched = false;
                        });
                    }
                };
                listen(window, 'scroll', cOnScroll, { passive: true });
                
                const cRand = (a, b) => Math.random() * (b-a) + a;
                
                addHfListener(cWrapper, 'mousemove', (e) => { if (!cRect) return; cTMX = (e.clientX-cRect.left)*cScX; cTMY = (e.clientY-cRect.top)*cScY; });
                listen(cButton, 'mouseenter', () => { cIsHover = true; cRebuildBackingStore(); cUpdateRect(); cStartAnim(); });
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
                        // [A9] 30fps with 2× step: visually acceptable approximation for decorative effect
                        // NOT mathematically identical to 60fps (smoothing is frame-dependent)
                        if (this.isFI) { this.life+=this.fadeIn*2; if (this.life>=this.maxLife){this.life=this.maxLife;this.isFI=false;} } else { this.life-=this.decay*2; }
                        this.x+=this.sx*2; this.y+=this.sy*2; this.sy+=this.grav*2;
                        this.sx*=C_FRICTION; this.sy*=C_FRICTION; // pre-computed Math.pow(0.985, 2)
                        this.rot+=this.rotS*2; this.tw+=this.twS*2;
                        return this.life>0;
                    }
                    draw() {
                        if (this.life<=0) return;
                        const tw=(Math.sin(this.tw)+1)*0.5, al=this.life*(0.5+tw*0.5);
                        const co=Math.cos(this.rot), si=Math.sin(this.rot);
                        // [A9] DPR-aware transform
                        cCtx.setTransform(co*cDpr,si*cDpr,-si*cDpr,co*cDpr,this.x*cDpr,this.y*cDpr);
                        if (this.hasGlow) { const gd=(this.size*4+10+tw*8)*0.75*2, go=-gd/2; cCtx.globalAlpha=al*0.35; cCtx.drawImage(cGlow,go,go,gd,gd); }
                        cCtx.globalAlpha=al;
                        // Select nearest twinkle phase
                        const phase = tw < 0.25 ? 0 : tw < 0.75 ? 1 : 2;
                        const drawR = this.size * 2;
                        cCtx.drawImage(getSharedStarPhases()[phase], -drawR, -drawR, drawR*2, drawR*2);
                        // White center dot — life alpha only
                        cCtx.globalAlpha = this.life;
                        cCtx.drawImage(getSharedDotSprite(), -drawR, -drawR, drawR*2, drawR*2);
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
                    // [A9] DPR-aware clear
                    cCtx.setTransform(cDpr,0,0,cDpr,0,0); cCtx.clearRect(0,0,C_LOGICAL_W,C_LOGICAL_H);
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
        logoLottiePause?.();  // [FIX ENT-LC-03]
        marqueeStop?.();
        tickFns.forEach(fn => gsap.ticker.remove(fn));
        hfListeners.forEach(({ target, event, handler, options }) => {
            target.removeEventListener(event, handler, options);
        });
    }

    function resume() {
        logoLottieResume?.(); // [FIX ENT-LC-03]
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
        
        /* [FIX #9] CSS vars defined on #hero-section, not :root */
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
            originalDelays[k] = getComputedStyle(container).getPropertyValue(k).trim(); /* [FIX #9] */
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
            Object.entries(REENTRY_DELAYS).forEach(([k, v]) => container.style.setProperty(k, v)); /* [FIX #9] */
            
            // 2. Remove dormant — schedule animation pickup in next frame
            actionArea.removeAttribute('data-dormant');
            
            // [A7] Async pickup zamiast sync reflow (void actionArea.offsetWidth)
            // Double rAF gwarantuje że przeglądarka przetworzyła removeAttribute
            // i CSS animations mogą się uruchomić z nowymi delays
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // 3. Badge Google entrance
                    badgeGoogleRevive?.();
                    
                    // 4. Badge 20 lat (GSAP) — reads --badge-20lat-delay internally
                    badge20LatReplay?.();
                    
                    // 5. Halo canvas (rebind global listeners)
                    haloReviveFn?.();
                });
            });
            
            // 6. Restore original delays after animations complete (~4s)
            trackedTimeout(() => {
                Object.entries(originalDelays).forEach(([k, v]) => container.style.setProperty(k, v)); /* [FIX #9] */
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

    // ═════════════════════════════════════════════════════════════════
    // BLOCK 13: RAINBOW LETTERS H1
    // ═════════════════════════════════════════════════════════════════
    // KLASYFIKACJA:
    //   Priorytet: DEFER (G2) — efekt premium, nie krytyczny dla LCP
    //   Typ: CSS opacity transition (compositor-driven, zero rAF)
    //   Init: Faza 2 (2000ms) — po LCP, zero CLS
    //   Gate: ≥600px + hover:hover (touch/mobile = zero kosztów)
    //   Fallback: statyczny gradient (no-op)
    //
    // ARCHITEKTURA:
    //   1. .hero-title-wrapper: position:relative (anchor dla overlay)
    //   2. .hero-title (base): gradient text, NIGDY modyfikowany
    //   3. .hero-title.hero-overlay: kolorowe litery, opacity animation
    //
    // KOSZT: +~60 DOM nodes (spany), zero rAF, zero tick loop
    // ═════════════════════════════════════════════════════════════════
    (function() {
        'use strict';

        // CAPABILITY GATE: ≥600px + hover:hover
        // Touch/mobile = zero kosztów, zero DOM mutation
        const canHover = window.matchMedia &&
            window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        if (!canHover || window.innerWidth < 600) return;

        const SATURATION = 88, LIGHTNESS = 55;
        // INIT_DELAY usunięte — trigger na mouseenter

        const headline = container.querySelector('.hero-title');
        const wrapper = headline?.closest('.hero-title-wrapper');
        if (!headline || !wrapper) return;

        let overlay = null;
        let baseLetters = null;
        let ovLetters = null;
        let total = 0;
        let hueOffset = Math.random() * 360;
        let initialized = false;

        // HSL → RGB (cold path: init + click)
        function hslToRgb(h) {
            const s = SATURATION / 100, l = LIGHTNESS / 100;
            const k = (n) => (n + h / 30) % 12;
            const a = s * Math.min(l, 1 - l);
            const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
            return [Math.round(f(0)*255), Math.round(f(8)*255), Math.round(f(4)*255)];
        }

        function splitLetters(node) {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            while (walker.nextNode()) textNodes.push(walker.currentNode);

            textNodes.forEach(textNode => {
                const parent = textNode.parentNode;
                const text = textNode.textContent;
                const frag = document.createDocumentFragment();
                
                for (let i = 0; i < text.length; i++) {
                    if (text[i] === ' ') {
                        frag.appendChild(document.createTextNode(' '));
                    } else {
                        const span = document.createElement('span');
                        span.className = 'letter';
                        span.textContent = text[i];
                        frag.appendChild(span);
                    }
                }
                parent.replaceChild(frag, textNode);
            });
        }

        function assignHues() {
            for (let i = 0; i < total; i++) {
                const hue = (hueOffset + (i / total) * 360) % 360;
                const rgb = hslToRgb(hue);
                ovLetters[i].style.setProperty('--lc',
                    'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')');
            }
        }

        function onMouseOver(e) {
            const span = e.target;
            if (!span.classList || !span.classList.contains('letter')) return;
            const idx = span._idx;
            if (idx !== undefined && ovLetters[idx]) {
                ovLetters[idx].classList.add('lit');
            }
        }

        function onMouseOut(e) {
            const span = e.target;
            if (!span.classList || !span.classList.contains('letter')) return;
            const idx = span._idx;
            if (idx !== undefined && ovLetters[idx]) {
                ovLetters[idx].classList.remove('lit');
            }
        }

        function onClick() {
            hueOffset = Math.random() * 360;
            assignHues();
        }

        // Safety net: gdy kursor opuści headline → wyczyść WSZYSTKIE .lit
        function clearAllLit() {
            for (let i = 0; i < total; i++) {
                ovLetters[i].classList.remove('lit');
            }
        }

        function initRainbow() {
            if (initialized) return;
            initialized = true;

            // 1. Split letters w base H1
            splitLetters(headline);

            // 2. Klon po splicie — identyczna struktura spanów
            overlay = headline.cloneNode(true);
            overlay.removeAttribute('id');
            overlay.classList.add('hero-overlay');
            overlay.setAttribute('aria-hidden', 'true');
            wrapper.appendChild(overlay);

            // 3. Query listy liter z obu warstw
            baseLetters = headline.querySelectorAll('.letter');
            ovLetters = overlay.querySelectorAll('.letter');
            total = baseLetters.length;

            // 4. Przypisz indeksy do base letters (dla event mappingu)
            for (let i = 0; i < total; i++) {
                baseLetters[i]._idx = i;
            }

            // 5. Przypisz kolory do overlay
            assignHues();

            // 6. Event listeners (delegation na headline)
            headline.addEventListener('mouseover', onMouseOver);
            headline.addEventListener('mouseout', onMouseOut);
            headline.addEventListener('mouseleave', clearAllLit); // safety net
            headline.addEventListener('click', onClick);
        }

        function destroyRainbow() {
            if (!initialized) return;

            headline.removeEventListener('mouseover', onMouseOver);
            headline.removeEventListener('mouseout', onMouseOut);
            headline.removeEventListener('mouseleave', clearAllLit);
            headline.removeEventListener('click', onClick);

            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            overlay = null;
            baseLetters = null;
            ovLetters = null;
            initialized = false;
        }

        // Trigger: pierwszy mouseenter na H1 (zamiast timeout 2000ms)
        // Eliminuje delay z critical path — zero pracy JS przed interakcją
        function onFirstEnter() {
            headline.removeEventListener('mouseenter', onFirstEnter);
            initRainbow();
        }
        headline.addEventListener('mouseenter', onFirstEnter);

        cleanups.push(() => {
            headline.removeEventListener('mouseenter', onFirstEnter);
            destroyRainbow();
        });
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
    // [PERF] Canvas vs SVG renderer (benchmark):
    //   Init: 1.07s vs 14.6s (−93%, 13.5s szybciej)
    //   DOM: 1 element vs 1909 (−99.9%)
    //   Playback: identyczny, hover: −50% dropped frames
    //   Logo OWOCNI = 127 unikalnych klatek frame-by-frame.
    //   SVG tworzy wszystkie 127 jako DOM upfront = blokuje main thread.
    //   Canvas rysuje tylko aktualną klatkę (2 warstwy max).
    //
    // KLASYFIKACJA per Konstytucja:
    //   Priorytet: HOT (G2) — ładowany natychmiast, od pierwszego widoku
    //   Typ silnika: Typ B (D2) — per-frame renderer lottie-web (Canvas rAF loop)
    //   Lifecycle: init natychmiast → kill gdy sekcja off-screen (G4)
    //   Kill: bez pause/resume — logo nie scrolluje, off-screen = destroy OK
    //   Hover: mouseenter (reverse wstecz) / mouseleave (forward od bieżącej klatki)
    //   Passive: mousemove/mouseenter/mouseleave nie blokują main thread (C11 ✓)
    //   IO gating: Factory gating (Ścieżka 1) wywołuje pause()/resume() — NIE kill().
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
    (function initLogoLottie() {
        'use strict';

        // Guard: kontener i biblioteka
        const logoEl = $id('hero-logo-lottie');
        if (!logoEl) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[LOGO LOTTIE] #hero-logo-lottie not found — skip init');
            }
            return;
        }

        // Guard: file:// protocol blokuje XHR (CORS) — tylko przy lokalnym podglądzie
        // Produkcja (HTTP) działa normalnie. Uruchom z serwera: python -m http.server
        if (window.location.protocol === 'file:') {
            console.warn('[LOGO LOTTIE] file:// — CORS blokuje /animations/LOGO_OWOCNI.json. Uruchom z HTTP (python -m http.server / VS Code Live Server).');
            return;
        }

        let logoLottieCancelled = false;
        cleanups.push(() => {
            logoLottieCancelled = true;
        });

        heroLottieLibPromise
            .then(function (lottie) {
                if (logoLottieCancelled) return;
                if (!lottie) {
                    logoEl.style.visibility = 'hidden';
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
        // [A10] autoplay: false — Logo startuje po szczycie gradientu (~6s od load), nie z pierwszym błyskiem
        // [PERF] Canvas renderer: init 1.07s vs SVG 14.6s (−93%), 1 DOM element vs 1909

        anim = lottie.loadAnimation({
            container: logoEl,
            renderer: 'canvas',
            loop: false,
            autoplay: false,
            path: '/animations/LOGO_OWOCNI.json',
            rendererSettings: {
                preserveAspectRatio: 'xMidYMid meet',
                clearCanvas: true,
                progressiveLoad: true,
            }
        });

        // Po szczycie gradientu: Faza 2 (2s) + --anim-duration (4s w hero-section.css) ≈ start znikania
        let logoStartTimer = trackedTimeout(() => {
            if (!destroyed && anim) {
                anim.play();
            }
        }, 6000);

        anim.addEventListener('complete', onComplete);

        // Hover listeners (tylko desktop/pointer:fine)
        // pointerenter/leave > mouseenter/leave: obsluguje tez pioro, pen tablet
        if (canHover) {
            logoEl.addEventListener('pointerenter', onEnter);
            logoEl.addEventListener('pointerleave', onLeave);
        }

        // [FIX ENT-LC-03] Expose pause/resume to parent scope
        let wasPlayingBeforePause = false;
        logoLottiePause = () => {
            if (destroyed || !anim) return;
            wasPlayingBeforePause = !anim.isPaused;
            anim.pause();
        };
        logoLottieResume = () => {
            if (destroyed || !anim) return;
            if (wasPlayingBeforePause) anim.play();
        };

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

            })
            .catch(function () {
                if (!logoLottieCancelled) logoEl.style.visibility = 'hidden';
            });

    })();
    // ═══ KONIEC LOGO LOTTIE ENGINE ═══
    return { pause, resume, kill };

}


// ─── HeroSection — Server-rendered markup, client-side animations ───────────
// H1/H2 jako ReactNode z heroVariants.generated.tsx (SSR, zero client swap)
// Engine: marquee, trail, lottie, badges, rainbow — nie dotyka treści

export function HeroSection({ variant }: { variant: HeroVariant }) {
  const rootRef = useRef<HTMLElement | null>(null);

  useGSAP(() => {
    // Brak ScrollTrigger w tej sekcji — gsap.registerPlugin() nie wymagany
    const el = rootRef.current;
    if (!el) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error('[P3] rootRef.current is null — ref not attached to <section>.');
      }
      return;
    }
    const inst = init(el);
    return () => inst?.kill?.();
    // scope nie przekazywany — brak GSAP animacji tworzonych bezpośrednio w useGSAP callbacku
    // init() zarządza własnym lifecycle przez kill()
  }, { scope: rootRef });

  return (
    <section id="hero-section" className="banner-section" ref={rootRef}>
      <div className="trail-container" id="hero-trailContainer"></div>
      <div className="gradient-perf-wrapper">
        <div className="startup-gradient"></div>
      </div>
      <div className="burst-container" id="hero-burstContainer">
        <div className="burst-ripple burst-ripple--1"></div>
        <div className="burst-ripple burst-ripple--2"></div>
        <div className="burst-ripple burst-ripple--3"></div>
        <div className="burst-ripple burst-ripple--4"></div>
      </div>
      <div className="content-layer">
        <div className="center-wrapper">
          <div className="logo-area">
            <div className="logo-lottie" id="hero-logo-lottie"></div>
          </div>
          <div className="hero-content">
            {/* H1 — DYNAMIC: variant.h1 (ReactNode z heroVariants.generated.tsx) */}
            <div className="hero-title-wrapper">
              <h1 className="hero-title">{variant.h1}</h1>
              <div className="lottie-laur-container lottie-laur-left" id="hero-lottieLaurLeft"></div>
              <div className="lottie-laur-container lottie-laur-right" id="hero-lottieLaurRight"></div>
            </div>

            {/* PILL BADGE — STATIC: heroContent.ts */}
            <div className="pill-wrap">
              <span className="pill-avatars pill-avatars-left">
                <span className="pill-av pill-av-plus"></span>
                <img className="pill-av" src="/avatars/Klient1.avif" alt="" width={39} height={39} loading="eager" decoding="async" fetchPriority="low" />
                <img className="pill-av" src="/avatars/Klient2.avif" alt="" width={39} height={39} loading="eager" decoding="async" fetchPriority="low" />
                <img className="pill-av" src="/avatars/Klient3.avif" alt="" width={39} height={39} loading="eager" decoding="async" fetchPriority="low" />
                <img className="pill-av" src="/avatars/Klient4.avif" alt="" width={39} height={39} loading="eager" decoding="async" fetchPriority="low" />
                <img className="pill-av" src="/avatars/Klient5.avif" alt="" width={39} height={39} loading="eager" decoding="async" fetchPriority="low" />
                <img className="pill-av" src="/avatars/Klient6.avif" alt="" width={39} height={39} loading="eager" decoding="async" fetchPriority="low" />
                <img className="pill-av" src="/avatars/Klient7.avif" alt="" width={39} height={39} loading="eager" decoding="async" fetchPriority="low" />
              </span>
              <span className="pill">
                <span className="pill-badge"><span className="ponad">Ponad&nbsp;</span>3500+</span>
                <span className="pill-txt">zadowolonych klientów.</span>
              </span>
              <span className="pill-avatars pill-avatars-right"></span>
            </div>

            {/* H2 — DYNAMIC: variant.h2 (ReactNode z heroVariants.generated.tsx) */}
            <p className="hero-description">{variant.h2}</p>

            {/* MARQUEE — logotypy w pierwszym HTML (FOUC); buildBrandsDOM klony pod pętlę seamless */}
            <div className="hero-brands-marquee">
              <p className="hero-brands-text hero-brands-text--desktop">Zaufały nam <strong>marki, które znasz.</strong></p>
              <p className="hero-brands-text hero-brands-text--mobile">Zaufały nam <strong>marki, które znasz.</strong></p>
              <div className="luxury-wrapper" id="hero-brandsMarqueeWrapper">
                <div className="marquee-track" id="hero-brandsMarqueeTrack">
                  {HERO_MARQUEE_LOGO_SRCS.map((src) => (
                    <div key={src} className="logo-item">
                      <img
                        src={src}
                        alt=""
                        width={HERO_MARQUEE_LOGO_BOX.w}
                        height={HERO_MARQUEE_LOGO_BOX.h}
                        loading="eager"
                        decoding="async"
                        fetchPriority="low"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="action-area">
            <div className="badge-20lat-wrapper">
              <svg className="rotating-svg" viewBox="0 0 140 140">
                <defs>
                  <path id="hero-arc-top" d="M 11,74 A 59,59 0 0,1 129,74" />
                  <path id="hero-arc-bottom" d="M 11,74 A 59,59 0 0,0 129,74" />
                </defs>
                <text className="rotating-text text-top" textAnchor="middle">
                  <textPath href="#hero-arc-top" startOffset="50%">PRZEWAGA</textPath>
                </text>
                <text className="rotating-text text-bottom" textAnchor="middle">
                  <textPath href="#hero-arc-bottom" startOffset="50%">DOŚWIADCZENIA</textPath>
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
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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
                  <strong><em>PS: „Skup się, a zmienisz to myśląc o tym.&#34;</em></strong>
                </div>
              </div>
              <div className="btn-wrapper-wave">
                <a href={CENNIK_STRONY_URL} className="cta-button">
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
