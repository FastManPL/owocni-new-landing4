// @ts-nocheck — legacy engine (4500+ LOC); gradual typing deferred.
'use client';

import { useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollRuntime } from '@/lib/scrollRuntime';
import './kinetic-section.css';

// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// registerPlugin() WYŁĄCZNIE wewnątrz useGSAP(() => { ... }).

    function init(container: HTMLElement): { kill: () => void; pause: () => void; resume: () => void } {
        const $ = (sel: string) => container.querySelector(sel);
        const $$ = (sel: string) => container.querySelectorAll(sel);
        const $id = (id: string) => container.querySelector('#' + id);

        const cleanups = [];
        const gsapInstances = [];
        const timerIds = [];
        const tickerFns = [];
        const observers = [];
        const getScroll = (): number => scrollRuntime.getScroll();
        // ENT-SCROLL-API-01: Lenis nie jest na window.lenis — jedyny most to scrollRuntime
        const scrollTo  = (px, opts) => scrollRuntime.scrollTo(px, opts);
        const scrollOn  = (ev, fn)   => scrollRuntime.on(ev, fn);
        const scrollOff = (ev, fn)   => scrollRuntime.off(ev, fn);

        // ── Shared state (closure) — replaces window.* event bus (ENT-JS-09) ──
        const _s = {
            pinnedTl: null,
            bridgeI: 0,
            particleQmark: null,
            cylinder: null,
            blobTweens: null,
            _killed: false,
            _warmMix: { value: 0 }, // neutral→warm pastel transition (GSAP tweens this)
            _pulseOpacity: { value: 0 } // pulse on particle canvas (GSAP tweens this)
        };

        gsap.registerPlugin(ScrollTrigger);
        // ScrollTrigger.config({ ignoreMobileResize: true }) → Shared Core (scrollRuntime.ts)

        // ── IDEMPOTENT INIT: usuń stare piny tej sekcji ──
        try {
            ScrollTrigger.getAll().forEach(function(st) {
                if (!st) return;
                if (st.trigger === container || (st.vars && st.vars.id === "KINETIC_PIN")) {
                    st.kill(true); // true = usuń pin-spacer
                }
            });
        } catch (e) {}

        // ZAKAZ: gsap.ticker.fps() w kodzie sekcji (globalny, zabija Lenis + inne sekcje)
        // Zamiast tego: lokalny throttle gate — tylko tickery TEJ sekcji działają w 30fps
        const SECTION_FPS = 30;
        const SECTION_FRAME_MS = 1000 / SECTION_FPS;
        var _lastSectionTick = 0;
        var _sectionTickOk = false;
        var _deferredTickOk = false;  // P0: stagger — blob/cyl render on NEXT frame after particle
        var _deferredRenderNeeded = false;
        var _sectionVisible = true;
        
        // Lifecycle hooks — wrapper can call these to activate/hibernate KINETIC
        _s.activate = function() { _sectionVisible = true; };
        _s.hibernate = function() { _sectionVisible = false; };
        
        // Gate ticker — MUSI być dodany jako PIERWSZY (GSAP wywołuje w kolejności dodania)
        const _tickSectionGate = function() {
            if (_s._killed) return;
            if (typeof document !== 'undefined' && document.documentElement.classList.contains('kinetic-past')) {
                _sectionTickOk = false;
                _deferredTickOk = false;
                return;
            }
            // H7 FIX: Safety net — jeśli timeline aktywny, sekcja MUSI być widoczna
            // Chroni przed race condition gdy ScrollTrigger refresh wywoła onLeave przed onEnter
            if (!_sectionVisible && _s.pinnedTl && _s.pinnedTl.progress() > 0 && _s.pinnedTl.progress() < 1) {
                _sectionVisible = true;
            }
            if (!_sectionVisible) { _sectionTickOk = false; _deferredTickOk = false; return; } // P1: auto-pause off-screen
            var now = performance.now();
            _sectionTickOk = (now - _lastSectionTick >= SECTION_FRAME_MS);
            if (_sectionTickOk) { _lastSectionTick = now; _deferredRenderNeeded = true; _deferredTickOk = false; }
            else if (_deferredRenderNeeded) { _deferredTickOk = true; _deferredRenderNeeded = false; }
            else { _deferredTickOk = false; }
        };
        gsap.ticker.add(_tickSectionGate);
        tickerFns.push(_tickSectionGate);

        // ── FREEZE FINAL + SNAP-LOCK ─────────────────────────────────
        // freezeFinal: blokuje resize-handlery gdy animacja na końcu (ostatnia klatka)
        // mobileResizeLock: blokuje snap podczas toolbar/resize na touch devices
        let freezeFinal = false;
        var FREEZE_ON  = 0.95;
        var FREEZE_OFF = 0.94;

        const IS_TOUCH = !!ScrollTrigger.isTouch;

        let mobileResizeLock = false;
        let mobileResizeTimer = null;

        function armMobileResizeLock() {
            if (!IS_TOUCH) return;
            mobileResizeLock = true;
            clearTimeout(mobileResizeTimer);
            mobileResizeTimer = setTimeout(function() { mobileResizeLock = false; }, 250);
            timerIds.push(mobileResizeTimer);
        }

        window.addEventListener('resize', armMobileResizeLock, { passive: true });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', armMobileResizeLock, { passive: true });
        }
        cleanups.push(function() {
            window.removeEventListener('resize', armMobileResizeLock);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', armMobileResizeLock);
            }
            clearTimeout(mobileResizeTimer);
        });

        // ============================================
        // ADAPTIVE DPR SYSTEM - dynamiczne skalowanie jakości
        // Start: 0.75, mierzy FPS, adaptuje 0.5-1.5
        // ============================================
        const _isMobileDPR = window.innerWidth < 768;
        const adaptiveDPR = {
            cap: 1.0, // mobile: sharper rendering
            min: 0.5,
            max: 1.5,
            lastTime: performance.now(),
            frameCount: 0,
            avgFPS: 30,
            callbacks: [], // funkcje do wywołania przy zmianie DPR
            _scrollLockUntil: 0,
            lockForScroll: function() {
                this._scrollLockUntil = performance.now() + 600;
            },
            
            tick: function() {
                if (document.hidden) { this.lastTime = performance.now(); this.frameCount = 0; return; }
                this.frameCount++;
                const now = performance.now();
                const elapsed = now - this.lastTime;
                
                // Aktualizuj FPS co 500ms
                if (elapsed >= 500) {
                    const currentFPS = (this.frameCount / elapsed) * 1000;
                    this.avgFPS = this.avgFPS * 0.7 + currentFPS * 0.3; // smoothing
                    this.frameCount = 0;
                    this.lastTime = now;
                    
                    // FIX: Lock DPR during ENTIRE pin, not just scroll
                    // canvas.width= clears GPU buffer → visible flash 0.6s after scroll stop
                    if (now < this._scrollLockUntil || _sectionVisible) return;
                    
                    const oldCap = this.cap;
                    
                    // Dostosowane progi dla 30fps ticker
                    if (this.avgFPS > 28) {
                        this.cap = Math.min(this.cap + 0.05, this.max);
                    }
                    if (this.avgFPS < 22) {
                        this.cap = Math.max(this.cap - 0.1, this.min);
                    }
                    
                    // Powiadom listenery o zmianie
                    if (oldCap !== this.cap) {
                        for (var i = 0; i < this.callbacks.length; i++) {
                            this.callbacks[i](this.cap);
                        }
                    }
                }
            },
            
            get: function() {
                var dpr = Math.min(window.devicePixelRatio || 1, this.cap);
                var maxDPR = 1920 / (window.innerWidth || 1920);
                return Math.min(dpr, maxDPR);
            },
            
            onChange: function(fn) {
                this.callbacks.push(fn);
            }
        };
        
        // Hook do gsap.ticker
        const _tickAdaptiveDPR = function() {
            if (_s._killed) return;
            if (!_sectionTickOk) return;
            adaptiveDPR.tick();
        };
        gsap.ticker.add(_tickAdaptiveDPR);
        tickerFns.push(_tickAdaptiveDPR);

        // ============================================
        // FUNKCJE POMOCNICZE - Cinema Container Blur
        // ============================================
        
        /**
         * Dzieli tekst na pojedyncze litery (spany)
         * @param {HTMLElement} element - Element zawierający tekst
         * @returns {NodeList} - Lista spanów z literami
         */
        function splitIntoChars(element) {
            if (!element) return [];
            const nodes = Array.from(element.childNodes);
            element.innerHTML = '';
            
            // DocumentFragment — eliminuje DOM thrashing (1 appendChild zamiast N)
            const fragment = document.createDocumentFragment();
            let globalIndex = 0;
            
            nodes.forEach((node) => {
                const isText = node.nodeType === 3; // Text node
                const target = isText ? fragment : node.cloneNode(false); // Clone element without children
                
                [...node.textContent].forEach((char) => {
                    const span = document.createElement('span');
                    span.className = 'anim-char';
                    // v139: will-change removed from default — added per-block where needed
                    span.textContent = char === ' ' ? '\u00A0' : char; // Zachowaj spacje
                    span.dataset.index = globalIndex++;
                    target.appendChild(span);
                });
                
                if (!isText) fragment.appendChild(target);
            });
            
            element.appendChild(fragment); // Jeden DOM update
            
            return element.querySelectorAll('.anim-char');
        }
        
        // v140→D: Cylinder wrap functions moved INLINE to timeline section
        // (measureCylinderGeometry, cylinderWrapTransform, buildCylinderWrapTweens removed)

        /**
         * Animacja Block 1 z kolorową falą
         * Litery startują brzoskwiniowe (#ffb998) i przechodzą do czarnego (#141414)
         * Fala koloru przebiega przez litery od lewej do prawej
         * 
         * @param {GSAPTimeline} tl - Główny timeline
         * @param {HTMLElement} b1 - Kontener Block 1
         * @param {NodeList} b1Lines - Linie zwykłe (.line:not(.bold-line))
         * @param {NodeList} b1Bold - Linie bold (.line.bold-line)
         */
        /**
         * ANIMACJA 1A: ColorWave — tekst Block 1 pojawia się z falą koloru
         * 
         * @param {GSAPTimeline} tl - Główny timeline GSAP
         * @param {HTMLElement} b1 - Kontener Block 1
         * @param {NodeList} b1Lines - Linie normalne
         * @param {NodeList} b1Bold - Linie bold
         * @param {number} startPos - Explicit position w timeline (b1Start = I)
         */
        function animateBlock1_ColorWave(tl, b1, b1Lines, b1Bold, startPos, availableTime) {
            
            // ==========================================
            // KROK 1: Przygotuj strukturę
            // ==========================================
            const allLineChars = [];
            
            [...b1Lines, ...b1Bold].forEach(line => {
                const chars = splitIntoChars(line);
                allLineChars.push({ 
                    line, 
                    chars, 
                    isBold: line.classList.contains('bold-line') 
                });
            });
            
            // ==========================================
            // KROK 2: Kolor startowy (natychmiastowy, b1 jest autoAlpha:0)
            // ==========================================
            allLineChars.forEach(({ chars }) => {
                gsap.set(chars, { color: "#141414" });  // Pure black from start
            });
            
            // Explicit position — tekst pojawia się na końcu bridge (b1Start = I)
            tl.set(b1, { visibility: 'visible' }, Math.max(0, startPos - 1.0));
            tl.set(b1, { opacity: 1 }, startPos);
            
            // ==========================================
            // KROK 3: Pojawianie się — explicit position startPos
            // Linie wchodzą jedna po drugiej (stagger 0.5)
            // Trwa 4.5U (dur:3 + stagger:0.5×3=1.5)
            // ==========================================
            var _b1dur = availableTime / 1.5;
            var _b1stagger = _b1dur / 6;
            var _b1colorDur = _b1dur * 0.93;
            
            const normalLines = allLineChars.filter(l => !l.isBold).map(l => l.line);
            const boldLines = allLineChars.filter(l => l.isBold).map(l => l.line);
            const allLines = [...normalLines, ...boldLines];
            
            tl.addLabel("colorWaveStart", startPos);
            
            tl.fromTo(allLines, 
                { y: 60, opacity: 0, scale: 0.95 },
                { y: 0, opacity: 1, scale: 1, duration: _b1dur, stagger: _b1stagger, ease: "power3.out" },
                startPos
            );
            
            allLineChars.forEach(({ chars }, index) => {
                const lineStartTime = index * _b1stagger;
                
                tl.to(chars, {
                    color: "#141414",
                    duration: _b1colorDur,
                    stagger: 0.02,
                    ease: "power2.out"
                }, "colorWaveStart+=" + (lineStartTime + 0.2));
            });
        }
        
        /**
         * ANIMACJA 1B: Cinema Container Blur
         * 
         * Blur na kontenerze (1 element) + litery tylko scale/opacity/y
         * Efekt: kinowe rozmycie wyostrzające się od środka
         * Wydajność: LEKKA (1 blur zamiast 14)
         * 
         * @param {GSAPTimeline} tl - Główny timeline GSAP
         * @param {HTMLElement} b2 - Kontener z tekstem "W czym problem?"
         */

        // ============================================

    // ============ PARTICLE QMARK COMPONENT - "?" z cząsteczek ============
    (function() {
        'use strict';

        // ============================================
        // KONFIGURACJA TIMING - jednostki timeline
        // Zsynchronizowane z pinnedTl
        // ============================================
        const FORM_START   = 0;
        const FORM_END     = 2.0;
        const ROTATE_START = 3.5;
        // Zsynchronizowane z SNAP2_KINETIC_U (główny init): dłuższa faza „?” przed snap2 =
        // więcej scrollu zanim cylinder wrap zasłoni B1 (Blok45 wjeżdża wyżej w kadrze).
        const ROTATE_END   = 14.5;
        const COLLAPSE_START = 14.5;
        const COLLAPSE_END = 17.10; // +2.6U collapse (zsynchronizowane z SNAP2_KINETIC_U)
        
        // ═══════════════════════════════════════════════════════════
        // MAPPING: Bridge × BRIDGE_MULTIPLIER, liniowe formProgress
        // Proporcje particle/rings zachowane automatycznie
        // ═══════════════════════════════════════════════════════════

        // ============================================
        // PALETY KOLORÓW
        // A = niebieska (wykrzyknik, start)
        // B = zielona jasna (znak zapytania) — domyślna
        // C = zielona ciemna (alternatywna)
        // ============================================
        const PALETTE_A = ['#dca368', '#f9a736', '#e8845a', '#7c4b0a', '#f5bd55', '#ffc217', '#fb8840', '#792c01', '#f5bd55', '#ffc217', '#fb8840', '#792c01', '#e6e5de', '#eeede9', '#e6e5de', '#eeede9', '#e6e5de', '#eeede9', '#e6e5de', '#eeede9'];
        const PALETTE_B = ['#c19b8b', '#cbac9a', '#b99383', '#d1af9f', '#c4a99d', '#c8b0a4', '#d7bfb7', '#d4bdb3'];
        

        // ============================================
        // STAŁE FIZYKI / RENDERINGU
        // ============================================
        const FOCAL_LENGTH = 800;
        const PI = Math.PI;
        const PI_2 = Math.PI * 2;
        // Głębokość 3D kształtu — skalowana z viewport
        // Przy rotacji 90° (? → !) tZ staje się grubością "!"
        // Stała=50 → na mobile 3× grubszy proporcjonalnie niż desktop
        // Skalowanie: 50 tuned dla ~600px fontu (desktop 1080p)
        const SHAPE_DEPTH_REF = 50;
        const FONT_REF = 600;
        var shapeDepth = SHAPE_DEPTH_REF; // dynamicznie ustawiane w createParticles
        
        // Clip-path ROI (3-fazowe: full → tight → full) — GPU hardware scissor
        var _clipTop = 0, _clipBottom = 0, _clipLeft = 0, _clipRight = 0;
        var _clipActive = false;
        var _clipOffCount = 0; // debounce counter dla clip-path OFF
        var _particleHidden = false; // P1: phase-aware display:none after collapse
        const VISUAL_SCALE_COMPENSATION = 1.41;

        // ============================================
        // ZMIENNE GLOBALNE
        // ============================================
        const canvas = $id('kinetic-particle-qmark-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return; // fail-soft: brak kontekstu → skip particle layer
        let width, height, cx, cy;
        let frameCount = 0;
        let initialized = false;
        let lastWidth = 0; // Dla mobile resize optimization

        // ============================================
        // STRUCTURE OF ARRAYS (SoA) - wydajność
        // ============================================
        const maxCapacity = 4000;
        let activeCount = 0;

        // Pozycje bieżące
        const pX = new Float32Array(maxCapacity);
        const pY = new Float32Array(maxCapacity);
        const pZ = new Float32Array(maxCapacity);
        // Pozycje docelowe (kształt "?")
        const tX = new Float32Array(maxCapacity);
        const tY = new Float32Array(maxCapacity);
        const tZ = new Float32Array(maxCapacity);
        // Pozycje startowe (pierścień)
        const sX = new Float32Array(maxCapacity);
        const sY = new Float32Array(maxCapacity);
        const sZ = new Float32Array(maxCapacity);

        // Właściwości cząsteczek
        const pSize = new Float32Array(maxCapacity);
        const pSpeedVar = new Float32Array(maxCapacity);
        const pSeed = new Float32Array(maxCapacity);
        const pCurvePhase = new Float32Array(maxCapacity);
        const pCurveFactor = new Float32Array(maxCapacity);

        // Collapse
        const pTyNorm = new Float32Array(maxCapacity);
        const pFallDriftX = new Float32Array(maxCapacity);
        const pFallDriftZ = new Float32Array(maxCapacity);
        const pFallSpeed = new Float32Array(maxCapacity);

        // Geyser + Emergence B2
        const pScaleBoost = new Float32Array(maxCapacity);   // 1=normal, >1=powiększony na starcie

        // Precomputed invariants (computed once in createParticles, eliminates sqrt from hot loops)
        const pCurveScale = new Float32Array(maxCapacity);     // FORM: curveScale per particle
        const pFallTriggerStick = new Float32Array(maxCapacity); // COLLAPSE: triggerCP for stick
        const pFallTriggerDot = new Float32Array(maxCapacity);   // COLLAPSE: triggerCP for dot
        const pArcStrength = new Float32Array(maxCapacity);  // siła łukowego lotu fontannowego
        const pFlightSpeed = new Float32Array(maxCapacity);  // 1=normal, >1=szybszy lot

        // Visual
        const pAlpha = new Float32Array(maxCapacity);
        const pAlphaBase = new Float32Array(maxCapacity).fill(1.0);
        // Desktop alpha variation: layered translucency (mobile: 1.0 = sharp contour)
        const ALPHA_BASE_DESKTOP = [0.58, 0.54, 0.57, 0.30, 0.70, 0.61, 0.68, 0.33, 0.70, 0.61, 0.68, 0.33, 0.75, 0.40, 0.65, 0.30, 0.70, 0.35, 0.60, 0.28];
        // Pre-computed base alpha per color slot: darkest=0.40, brightest=0.80

        // Kolory Pre-calc (A=niebieski, B=zielony)
        
        // ============ COLOR LUT OPTIMIZATION ============
        // Indeksy par kolorów dla lookup table (eliminuje 120k string allocs/sec)
        
        // Precomputed per-particle constants (eliminują powtarzane operacje w hot loop)
        // pFlightBase: (1 - pSpeedVar[i]) * 0.50 — static after createParticles, used 2×/frame in animate+render
        // pBreathY/X: tY[i] * 0.005 / tX[i] * 0.005 — static target coords scaled for breath
        // pColorIdx: aIdx * PB_LEN + bIdx — static color bucket index
        const PA_LEN = PALETTE_A.length; // 20
        const PB_LEN = PALETTE_B.length; // 8
        const COLOR_COMBOS = PA_LEN * PB_LEN; // 160
        const pFlightBase = new Float32Array(maxCapacity); // 8KB
        const pBreathY = new Float32Array(maxCapacity);    // 8KB
        const pBreathX = new Float32Array(maxCapacity);    // 8KB
        const pColorIdx = new Uint8Array(maxCapacity);     // 2KB — total +26KB
        
        // LUT: 16 pre-computed color strings (4×4 kombinacji)
        // PALETTE_A_RGB/B_RGB definiowane po hexToRgb (patrz HELPERS)
        let PALETTE_A_RGB = null;
        let PALETTE_B_RGB = null;
        const colorLUT = new Array(COLOR_COMBOS);
        var _lastGlobalMix = -1; // dirty check: rebuild LUT only when globalMix changes
        var _lastWarmMix = -1;  // dirty check: rebuild LUT when warmMix changes

        // ============ BATCHING BUCKETS ============
        // COLOR_COMBOS kolorów × 8 alpha buckets
        const BUCKET_COUNT = COLOR_COMBOS * 8;
        const bucketX = [];
        const bucketY = [];
        const bucketS = [];
        const bucketCount = new Uint16Array(BUCKET_COUNT);
        const activeBuckets = new Uint16Array(BUCKET_COUNT); // OPT-4: dense active list
        var activeBucketLen = 0;
        for (var b = 0; b < BUCKET_COUNT; b++) {
            bucketX[b] = new Float32Array(512);  // was maxCapacity(4000)=6MB → 512=192KB (fits L2 cache)
            bucketY[b] = new Float32Array(512);
            bucketS[b] = new Float32Array(512);
        }

        // Stan animacji (sterowany przez pinnedTl)
        const state = {
            formProgress: 0,
            rotateProgress: 0,
            collapseProgress: 0,
            colorMixRatio: 0,
            dotTopY: 0,
            dotBottomY: 0,
            // V8 hidden class optimization: definiuj wszystkie klucze na starcie
            _gigaLeft: false,
            _gigaRight: false,
            _gigaLate: false
        };

        // ============================================
        // HELPERS
        // ============================================
        function hexToRgb(hex) {
            const bigint = parseInt(hex.slice(1), 16);
            return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
        }
        
        // BAKED FILTER: CSS filter chain brightness(60%) → saturate(10%) → contrast(200%)
        // wypalone w palety przy init — eliminuje GPU filter pipeline na 100% canvas surface.
        // Matematyczny dowód komutacji z alpha compositing: patrz audyt sesji optymalizacyjnej.
        function bakeFilter(rgb) {
            // brightness(0.6)
            var r = rgb.r * 0.6, g = rgb.g * 0.6, b = rgb.b * 0.6;
            // saturate(0.1) — CSS color matrix per W3C Filter Effects spec
            var s = 0.1;
            var r2 = r * (0.2126 + 0.7874*s) + g * (0.7152 - 0.7152*s) + b * (0.0722 - 0.0722*s);
            var g2 = r * (0.2126 - 0.2126*s) + g * (0.7152 + 0.2848*s) + b * (0.0722 - 0.0722*s);
            var b2 = r * (0.2126 - 0.2126*s) + g * (0.7152 - 0.7152*s) + b * (0.0722 + 0.9278*s);
            // contrast(2.0)
            return {
                r: Math.max(0, Math.min(255, Math.round(r2 * 2 - 128))),
                g: Math.max(0, Math.min(255, Math.round(g2 * 2 - 128))),
                b: Math.max(0, Math.min(255, Math.round(b2 * 2 - 128)))
            };
        }
        
        // Parsuj palety i wypal filtr — kolory piksel-identyczne z CSS filter chain
        PALETTE_A_RGB = PALETTE_A.map(function(hex) { return bakeFilter(hexToRgb(hex)); });
        PALETTE_B_RGB = PALETTE_B.map(function(hex) { return bakeFilter(hexToRgb(hex)); });
        
        // Raw overrides — all skip bakeFilter
        // Dark (original 0-3):
        PALETTE_A_RGB[0] = { r: 220, g: 163, b: 104 }; // #dca368
        PALETTE_A_RGB[1] = { r: 249, g: 167, b: 54 };  // #f9a736
        PALETTE_A_RGB[2] = { r: 232, g: 132, b: 90 };  // #e8845a
        PALETTE_A_RGB[3] = { r: 124, g: 75, b: 10 };   // #7c4b0a
        // Bright (+25% lightness) — 2× in palette for 2:1 spawn ratio
        PALETTE_A_RGB[4]  = { r: 250, g: 219, b: 163 };
        PALETTE_A_RGB[5]  = { r: 255, g: 213, b: 97 };
        PALETTE_A_RGB[6]  = { r: 253, g: 186, b: 145 };
        PALETTE_A_RGB[7]  = { r: 151, g: 57, b: 2 };
        PALETTE_A_RGB[8]  = { r: 250, g: 219, b: 163 };
        PALETTE_A_RGB[9]  = { r: 255, g: 213, b: 97 };
        PALETTE_A_RGB[10] = { r: 253, g: 186, b: 145 };
        PALETTE_A_RGB[11] = { r: 151, g: 57, b: 2 };
        // Slots 12-19: START neutral, TRANSITION to warm pastels at BLOB_BIRTH
        // Neutral start values (alternating):
        PALETTE_A_RGB[12] = { r: 230, g: 229, b: 222 }; // #e6e5de
        PALETTE_A_RGB[13] = { r: 238, g: 237, b: 233 }; // #eeede9
        PALETTE_A_RGB[14] = { r: 230, g: 229, b: 222 };
        PALETTE_A_RGB[15] = { r: 238, g: 237, b: 233 };
        PALETTE_A_RGB[16] = { r: 230, g: 229, b: 222 };
        PALETTE_A_RGB[17] = { r: 238, g: 237, b: 233 };
        PALETTE_A_RGB[18] = { r: 230, g: 229, b: 222 };
        PALETTE_A_RGB[19] = { r: 238, g: 237, b: 233 };

        // Warm pastel targets — S1: Tonal Depth (dark/mid/light 3-layer contrast)
        // DARK saturated [0,2] + MID vivid [4,6] + LIGHT pale [1,3] + LIGHT neutral [5,7]
        var WARM_TARGETS = [
            { r: 171, g: 90, b: 33 },   // [0] DARK saturated amber (−5% for no-multiply)
            { r: 203, g: 183, b: 154 }, // [1] LIGHT pale gold
            { r: 166, g: 76, b: 43 },   // [2] DARK saturated coral (−5% for no-multiply)
            { r: 209, g: 187, b: 159 }, // [3] LIGHT pale brown
            { r: 222, g: 158, b: 95 },  // [4] MID vivid gold
            { r: 238, g: 231, b: 221 }, // [5] LIGHT neutral
            { r: 218, g: 128, b: 82 },  // [6] MID vivid warm
            { r: 238, g: 231, b: 221 }, // [7] LIGHT neutral
        ];
        // Neutral start values (for interpolation)
        var NEUTRAL_START = [
            { r: 230, g: 229, b: 222 }, { r: 238, g: 237, b: 233 },
            { r: 230, g: 229, b: 222 }, { r: 238, g: 237, b: 233 },
            { r: 230, g: 229, b: 222 }, { r: 238, g: 237, b: 233 },
            { r: 230, g: 229, b: 222 }, { r: 238, g: 237, b: 233 },
        ];

        // PALETTE_B raw overrides — Pink (from nigdy plate hue)
        PALETTE_B_RGB[0] = { r: 193, g: 155, b: 139 }; // #c19b8b
        PALETTE_B_RGB[1] = { r: 203, g: 172, b: 154 }; // #cbac9a
        PALETTE_B_RGB[2] = { r: 185, g: 145, b: 131 }; // #b99383
        PALETTE_B_RGB[3] = { r: 209, g: 175, b: 159 }; // #d1af9f
        // Bright:
        PALETTE_B_RGB[4] = { r: 221, g: 201, b: 192 }; // #ddc9c0
        PALETTE_B_RGB[5] = { r: 234, g: 222, b: 215 }; // #eaded7
        PALETTE_B_RGB[6] = { r: 215, g: 191, b: 183 }; // #d7bfb7
        PALETTE_B_RGB[7] = { r: 238, g: 227, b: 221 }; // #eee3dd

        // ═══════════════════════════════════════════════════════════
        // v140: PALETTE SWITCHER — press G to cycle palettes
        // 6 variants: baseline + 5 strategies (HSL-calibrated)
        // ═══════════════════════════════════════════════════════════
        var _paletteVariants = [
            { name: "BASELINE (muted pink)", colors: [
                {r:193,g:155,b:139},{r:203,g:172,b:154},{r:185,g:145,b:131},{r:209,g:175,b:159},
                {r:221,g:201,b:192},{r:234,g:222,b:215},{r:215,g:191,b:183},{r:238,g:227,b:221}
            ]},
            { name: "S1: Monochrome H=17\u00b0", colors: [
                {r:238,g:72,b:6},{r:248,g:82,b:16},{r:249,g:96,b:36},{r:249,g:111,b:56},
                {r:250,g:125,b:75},{r:250,g:139,b:95},{r:251,g:154,b:115},{r:251,g:168,b:135}
            ]},
            { name: "S2: Narrow band 12-22\u00b0", colors: [
                {r:238,g:52,b:6},{r:248,g:70,b:16},{r:247,g:94,b:38},{r:247,g:111,b:58},
                {r:245,g:130,b:80},{r:246,g:148,b:99},{r:246,g:166,b:120},{r:245,g:183,b:141}
            ]},
            { name: "S3: Chroma-matched", colors: [
                {r:252,g:52,b:2},{r:251,g:73,b:13},{r:250,g:92,b:30},{r:249,g:103,b:46},
                {r:249,g:121,b:67},{r:248,g:139,b:88},{r:247,g:155,b:109},{r:247,g:173,b:130}
            ]},
            { name: "S4: Reverse-engineered \u2605", colors: [
                {r:255,g:67,b:25},{r:255,g:97,b:38},{r:255,g:107,b:32},{r:255,g:95,b:19},
                {r:255,g:129,b:58},{r:255,g:139,b:70},{r:255,g:182,b:136},{r:255,g:213,b:180}
            ]},
            { name: "S5: Midpoint conservative", colors: [
                {r:237,g:88,b:42},{r:235,g:106,b:60},{r:235,g:121,b:75},{r:234,g:134,b:91},
                {r:233,g:147,b:107},{r:233,g:160,b:123},{r:232,g:172,b:139},{r:232,g:183,b:154}
            ]}
        ];
        var _currentPaletteIdx = 4; // default: S4 Reverse-engineered

        function _switchPalette(idx) {
            _currentPaletteIdx = idx % _paletteVariants.length;
            var pal = _paletteVariants[_currentPaletteIdx].colors;
            for (var i = 0; i < 8; i++) {
                PALETTE_B_RGB[i] = { r: pal[i].r, g: pal[i].g, b: pal[i].b };
            }
            _lastGlobalMix = -1; // force LUT rebuild next frame
        }

        // Apply S4 palette on init
        (function() {
            var pal = _paletteVariants[4].colors;
            for (var i = 0; i < 8; i++) {
                PALETTE_B_RGB[i] = { r: pal[i].r, g: pal[i].g, b: pal[i].b };
            }
        })();

        // ═══════════════════════════════════════════════════════════
        // v140: PULSE WAVE COLOR PICKER
        // ═══════════════════════════════════════════════════════════
        var _pulseColorR = 255, _pulseColorG = 200, _pulseColorB = 0; // #ffc800

        function _setPulseColor(hex) {
            hex = hex.replace('#', '');
            if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
            if (hex.length !== 6) return;
            _pulseColorR = parseInt(hex.substr(0,2), 16);
            _pulseColorG = parseInt(hex.substr(2,2), 16);
            _pulseColorB = parseInt(hex.substr(4,2), 16);
        }

        function _getPulseRGBA(alpha) {
            return 'rgba(' + _pulseColorR + ',' + _pulseColorG + ',' + _pulseColorB + ',' + alpha + ')';
        }

        // SIN LUT: 256 entries, ~0.025 max error = 0.6px przy 24px amplitudzie (subpikselowe)
        // Eliminuje 6000 Math.sin/cos calls per frame w breath animation
        var SIN_LUT_SIZE = 256;
        var SIN_LUT = new Float32Array(SIN_LUT_SIZE);
        var SIN_LUT_SCALE = SIN_LUT_SIZE / (Math.PI * 2);
        for (var _si = 0; _si < SIN_LUT_SIZE; _si++) {
            SIN_LUT[_si] = Math.sin(_si / SIN_LUT_SCALE);
        }
        function fastSin(x) {
            return SIN_LUT[(x * SIN_LUT_SCALE) % SIN_LUT_SIZE | 0]; // P7: single modulo (args always ≥0)
        }
        function fastCos(x) {
            return fastSin(x + 1.5708); // π/2
        }


        // ============================================
        // GENEROWANIE KSZTAŁTU "?" z pikseli fontu
        // Upscale: rysuje na większym canvas (min 1200px)
        // → więcej pikseli źródłowych → gęstszy kształt na małych ekranach
        // ============================================
        // Reusable tempCanvas (eliminuje alokację ~13MB GPU per resize)
        let _shapeCanvas = null;
        let _shapeCtx = null;
        
        function getShapeCoordinates() {
            if (!width || width === 0) return [];
            
            // Reuse canvas (unikaj createElement per resize)
            if (!_shapeCanvas) {
                _shapeCanvas = document.createElement('canvas');
                _shapeCtx = _shapeCanvas.getContext('2d');
                if (!_shapeCtx) return; // fail-soft
            }
            const tempCanvas = _shapeCanvas;
            const tCtx = _shapeCtx;

            // Upscale: renderuj na min 1200px dla gęstego samplowania
            const MIN_RENDER = 1200;
            const scaleUp = Math.max(1, MIN_RENDER / Math.min(width, height));
            const rW = Math.round(width * scaleUp);
            const rH = Math.round(height * scaleUp);

            // Mobile portrait: większy mnożnik bo min=width jest wąski
            // Mobile portrait: większy mnożnik bo min=width jest wąski
            const size = Math.min(rW, rH) * 0.55;
            tempCanvas.width = rW;
            tempCanvas.height = rH;

            // "?" — renderowane jako pytajnik, 3D depth (dome + taper) przekształca wizualnie w "!"
            tCtx.font = '700 ' + size + 'px "Times New Roman", Georgia, serif';
            tCtx.textAlign = 'center';
            tCtx.textBaseline = 'middle';
            tCtx.fillStyle = '#000000';
            tCtx.fillText('?', rW / 2, rH / 2);

            // Gap stały = 4px na upscaled canvas (daje spójną gęstość)
            const gap = 4;

            try {
                const imageData = tCtx.getImageData(0, 0, rW, rH).data;
                const points = [];
                for (let y = 0; y < rH; y += gap) {
                    for (let x = 0; x < rW; x += gap) {
                        const index = (y * rW + x) * 4;
                        if (imageData[index + 3] > 128) {
                            // Skaluj z powrotem do screen coordinates
                            points.push({ x: x / scaleUp, y: y / scaleUp });
                        }
                    }
                }

                // Znajdź przerwę między kropką a główną częścią "?"
                // (operujemy na screen coords po skalowaniu)
                const ySet = new Set(points.map(function(p) { return Math.round(p.y); }));
                const ySorted = Array.from(ySet).sort(function(a, b) { return a - b; });

                let maxGap = 0, gapStart = 0, gapEnd = 0;
                for (let i = 1; i < ySorted.length; i++) {
                    const diff = ySorted[i] - ySorted[i - 1];
                    if (diff > maxGap) {
                        maxGap = diff;
                        gapStart = ySorted[i - 1];
                        gapEnd = ySorted[i];
                    }
                }

                // Single-pass min/max (eliminuje 4× map() + Math.max.apply = -60k allocs)
                var minY = Infinity, maxY = -Infinity;
                for (var i = 0; i < points.length; i++) {
                    if (points[i].y < minY) minY = points[i].y;
                    if (points[i].y > maxY) maxY = points[i].y;
                }
                
                // FILTRUJ punkty w przerwie (artefakty fontu między "?" a kropką)
                // Te punkty tworzą "trzy kropki" widoczne na mobile
                var filteredPoints = [];
                for (var i = 0; i < points.length; i++) {
                    var py = points[i].y;
                    // Zachowaj tylko punkty POWYŻEJ przerwy (główna część) lub PONIŻEJ (kropka)
                    if (py <= gapStart || py >= gapEnd) {
                        filteredPoints.push(points[i]);
                    }
                }
                
                // Rozsuń kropkę od reszty (lepszy efekt 3D "!")
                // Shift proporcjonalny do wysokości znaku, nie do wykrytej przerwy
                const charRangeY = (maxY - minY) || 1;
                const shift = maxGap > 3 ? charRangeY * 0.13 : 0;
                if (shift > 0) {
                    for (var i = 0; i < filteredPoints.length; i++) {
                        if (filteredPoints[i].y > gapStart) {
                            filteredPoints[i].y += shift;
                        }
                    }
                }

                // Znajdź finalMaxY po shift (single pass)
                var finalMaxY = -Infinity;
                for (var i = 0; i < filteredPoints.length; i++) {
                    if (filteredPoints[i].y > finalMaxY) finalMaxY = filteredPoints[i].y;
                }
                
                const dotTopAfterShift = gapEnd + shift;
                state.dotTopY = dotTopAfterShift - cy;
                state.dotBottomY = finalMaxY - cy;
                
                // Cleanup: zwolnij GPU memory (canvas.width=0 dealokuje buffer)
                tempCanvas.width = 0;
                tempCanvas.height = 0;

                return filteredPoints;
            } catch (e) {
                // Cleanup nawet przy błędzie
                tempCanvas.width = 0;
                tempCanvas.height = 0;
                return [];
            }
        }

        // ============================================
        // POZYCJA STARTOWA - GEJZER + EMERGENCE B2
        // 49% klasyczny gejzer (z dołu, normalne Z)
        // 50% z przodu kamery (ujemne Z, maleją lecąc w głąb)
        // 1% ogromne kropki tuż przed kamerą (giga)
        // ============================================
        function setInitialPosition(idx, currentIdx, total) {
            var baseZ = 600;
            var roll = Math.random();

            // Wspólny start: z dołu ekranu
            // STRATEGIA 4 + OPCJA B: Bimodalny rozkład + łuk zależny od odległości
            sY[idx] = height * 0.55 + Math.random() * height * 0.3;
            
            var u = Math.random();
            var side = Math.random() < 0.5 ? -1 : 1;
            // Mobile: tighter spread (0.15-0.50) → less travel distance → smoother 30fps
            var _mobileSpread = width < 600;
            var spread = _mobileSpread
                ? 0.10 + Math.pow(u, 0.7) * 0.20
                : 0.25 + Math.pow(u, 0.7) * 0.65;
            sX[idx] = side * spread * width;
            
            // OPCJA B: Łuk zależny od odległości
            // Bliżej centrum (spread=0.25) → silny łuk (0.33)
            // Dalej od centrum (spread=0.90) → słaby łuk (0.11)
            pArcStrength[idx] = 0.05 * (1.2 - spread);
            
            pFlightSpeed[idx] = 1;
            pScaleBoost[idx] = 1;

            // Bias proporcjonalny do odległości (zmniejszony z 0.9 → 0.7)
            var bias = -(sX[idx] / (width * 0.8)) * 0.7;

            if (roll < 0.49) {
                // 49% — klasyczny gejzer (z dołu, normalne Z)
                sZ[idx] = baseZ + (Math.random() - 0.5) * 500;
                pCurveFactor[idx] = (Math.random() - 0.5) * 3 + bias;

            } else if (roll < 0.98) {
                // 49% — z przodu: blisko kamery (ujemne Z)
                sZ[idx] = -200 - Math.random() * 400;
                pCurveFactor[idx] = (Math.random() - 0.5) * 3 + bias;

            } else {
                // 2% — giga cząsteczki (≈40 z 2000 = jak 1% z 4000 w reference)
                pCurveFactor[idx] = (Math.random() - 0.5) * 2;

                if (!state._gigaLeft) {
                    sX[idx] = -(0.15 + Math.random() * 0.1) * width;
                    sY[idx] = height * 0.38 + Math.random() * height * 0.08;
                    sZ[idx] = -650 - Math.random() * 100;
                    pScaleBoost[idx] = 24;
                    pSpeedVar[idx] = 0.35;
                    pFlightSpeed[idx] = 1.15;
                    state._gigaLeft = true;
                } else if (!state._gigaRight) {
                    sX[idx] = (0.15 + Math.random() * 0.1) * width;
                    sY[idx] = height * 0.5 + Math.random() * height * 0.1;
                    sZ[idx] = -500 - Math.random() * 100;
                    pScaleBoost[idx] = 16;
                    pSpeedVar[idx] = 0.28;
                    pFlightSpeed[idx] = 1.2;
                    state._gigaRight = true;
                } else if (!state._gigaLate) {
                    sX[idx] = (0.2 + Math.random() * 0.1) * width;
                    sY[idx] = height * 0.35 + Math.random() * height * 0.08;
                    sZ[idx] = -700 - Math.random() * 80;
                    pScaleBoost[idx] = 36;
                    pSpeedVar[idx] = 0.10;
                    pFlightSpeed[idx] = 1.5;
                    state._gigaLate = true;
                } else {
                    sX[idx] = (Math.random() - 0.5) * width * 0.5;
                    sY[idx] = height * 0.55 + Math.random() * height * 0.3;
                    sZ[idx] = -600 - Math.random() * 150;
                    pScaleBoost[idx] = 4 + Math.random() * 4;
                }
            }
        }

        // ============================================
        // TWORZENIE CZĄSTECZEK
        // ============================================
        function createParticles() {
            state._gigaLeft = false;
            state._gigaRight = false;
            state._gigaLate = false;
            const points = getShapeCoordinates();
            if (points.length === 0) {
                return;
            }
            const maxParticles = width < 768 ? 1200 : 2000;
            const step = Math.ceil(points.length / maxParticles);

            activeCount = 0;

            const selected = [];
            for (let i = 0; i < points.length; i += step) selected.push(points[i]);

            // Single-pass min/max (eliminuje 2× map() + Math.min/max.apply = -16KB GC)
            var minY = Infinity, maxY = -Infinity;
            for (var _m = 0; _m < selected.length; _m++) {
                var _sy = selected[_m].y;
                if (_sy < minY) minY = _sy;
                if (_sy > maxY) maxY = _sy;
            }
            const rangeY = (maxY - minY) || 1;

            // Skaluj głębokość 3D proporcjonalnie do rozmiaru kształtu
            // rangeY ≈ font size w screen coords → na desktop ~594, na mobile ~206
            shapeDepth = SHAPE_DEPTH_REF * (rangeY / FONT_REF);

            for (let i = 0; i < selected.length; i++) {
                if (activeCount >= maxCapacity) break;

                var idx = activeCount;

                // Pozycje docelowe (kształt "?")
                tX[idx] = selected[i].x - cx;
                tY[idx] = selected[i].y - cy;
                tZ[idx] = (Math.random() - 0.5) * shapeDepth;

                // tZ override: szerokość "!" widzianego z boku (theta=π/2)
                // Góra zaokrąglona (dome), laska zwęża się w dół, kropka sferyczna
                var dotStartY = state.dotTopY + cy;
                if (selected[i].y >= dotStartY) {
                    // KROPKA — sferyczna
                    var dotCenterY = (dotStartY + (state.dotBottomY + cy)) * 0.5;
                    var dotR = ((state.dotBottomY + cy) - dotStartY) * 0.5 || 20;
                    var dy = (selected[i].y - dotCenterY) / dotR;
                    var dx = (selected[i].x - cx) / dotR;
                    var distNorm = Math.min(1, Math.sqrt(dx * dx + dy * dy));
                    var sphereFactor = Math.sqrt(Math.max(0, 1 - distNorm * distNorm));
                    tZ[idx] = (Math.random() - 0.5) * shapeDepth * 2.0 * sphereFactor;
                } else {
                    // LASKA — szersza u góry, węższa u dołu, zaokrąglona czapka
                    var staffRange = (dotStartY - minY) || 1;
                    var staffNorm = (selected[i].y - minY) / staffRange;
                    var widthFactor = 2.4 - staffNorm * 1.8;
                    var domeCap = Math.sin(Math.min(1, staffNorm / 0.15) * Math.PI * 0.5);
                    tZ[idx] = (Math.random() - 0.5) * shapeDepth * widthFactor * domeCap;
                }

                // Właściwości statyczne
                pSize[idx] = (Math.random() * 3.5 + 1.5) * VISUAL_SCALE_COMPENSATION;
                pSpeedVar[idx] = Math.random() * 0.5 + 0.5;
                pSeed[idx] = Math.random() * 1000;
                pCurvePhase[idx] = Math.random() * PI_2;

                // Collapse
                pTyNorm[idx] = (selected[i].y - minY) / rangeY;
                pFallDriftX[idx] = (Math.random() - 0.5) * 80;
                pFallDriftZ[idx] = (Math.random() - 0.5) * 60;
                pFallSpeed[idx] = 0.8 + Math.random() * 0.5;

                // Kolory (pre-calc dla wydajności)
                // 90% neutral→warm pastels (slots 12-19, transition at blend switch), 10% strong warm
                var aIdx = Math.random() < 0.9
                    ? 12 + Math.floor(Math.random() * 8)    // slots 12-19 (neutral→warm)
                    : Math.floor(Math.random() * 12);        // warm slots 0-11
                var bIdx = Math.floor(Math.random() * PALETTE_B.length);


                // Precomputed per-particle constants (hot-loop elimination)
                // Bottom-up formation: top-of-sign particles delayed by up to 0.20 fp
                var _yDelay = (1 - pTyNorm[idx]) * 0.20;
                pFlightBase[idx] = (1 - pSpeedVar[idx]) * 0.35 + _yDelay;
                pBreathY[idx] = tY[idx] * 0.005;
                pBreathX[idx] = tX[idx] * 0.005;
                pColorIdx[idx] = aIdx * PB_LEN + bIdx;
                pAlphaBase[idx] = width < 600 ? 1.0 : ALPHA_BASE_DESKTOP[aIdx];

                // Pozycja startowa (pierścień)
                setInitialPosition(idx, activeCount, selected.length);
                pX[idx] = sX[idx];
                pY[idx] = sY[idx];
                pZ[idx] = sZ[idx];

                activeCount++;
            }
            
            // ── SHAPE BOUNDS for clip-path ROI (3-fazowe: full → tight → full) ──
            // Compute once per createParticles, reuse in tick for GPU scissor
            var _maxAbsTx = 0, _maxAbsTy = 0, _maxAbsTz = 0;
            for (var _b = 0; _b < activeCount; _b++) {
                var _atx = Math.abs(tX[_b]), _aty = Math.abs(tY[_b]), _atz = Math.abs(tZ[_b]);
                if (_atx > _maxAbsTx) _maxAbsTx = _atx;
                if (_aty > _maxAbsTy) _maxAbsTy = _aty;
                if (_atz > _maxAbsTz) _maxAbsTz = _atz;
            }
            // Max perspective scale (particle closest to camera)
            var _maxScale = FOCAL_LENGTH / (FOCAL_LENGTH - Math.max(_maxAbsTz, shapeDepth));
            // ROI must match render: signScale (×1.40 mobile) + mobileYOffset (-55px mobile)
            var _roiSignScale = width < 600 ? 1.40 : 1;
            var _roiMobileYOff = width < 600 ? 55 : 0; // REF value
            // Conservative extent: max(tX, tZ) for any rotation angle + breath(5) + particle(10) + safety(30)
            var _extentX = Math.max(_maxAbsTx, _maxAbsTz) * _maxScale * _roiSignScale + 45;
            var _extentY = _maxAbsTy * _maxScale * _roiSignScale + _roiMobileYOff + 45;
            // Clamp to valid inset %
            _clipTop = Math.max(0, (cy - _extentY) / height * 100);
            _clipBottom = Math.max(0, (height - cy - _extentY) / height * 100);
            _clipLeft = Math.max(0, (cx - _extentX) / width * 100);
            _clipRight = Math.max(0, (width - cx - _extentX) / width * 100);

            // ── PRECOMPUTE: invariants eliminujące sqrt/abs z hot loops ──
            var _dotTopYLocal = state.dotTopY || 9999;
            var _K_COL = 1.6, _INV_K = 0.625;
            for (var _p = 0; _p < activeCount; _p++) {
                // curveScale: FORM phase (rp=0 → rTx=tZ, rTz=-tX)
                var _dX = tZ[_p] - sX[_p]; if (_dX < 0) _dX = -_dX;
                var _dY = tY[_p] - sY[_p]; if (_dY < 0) _dY = -_dY;
                var _dSq = _dX * _dX + _dY * _dY;
                pCurveScale[_p] = _dSq > 443556 ? 200 : Math.sqrt(_dSq) * 0.3;

                // triggerCP: collapse thresholds (precomputed sqrt)
                pFallTriggerStick[_p] = Math.sqrt(pTyNorm[_p] * _INV_K);
                var _revNorm = (1 - pTyNorm[_p]) * 2.5;
                pFallTriggerDot[_p] = 0.08 + Math.sqrt(_revNorm * _INV_K);
            }
        }

        // ============================================
        // AKTUALIZACJA FAZ - wywoływana z onUpdate timeline
        // ============================================
        function updatePhases(currentUnit) {
            // FAZA 1: Formowanie (U:0 → U:3.5)
            if (currentUnit <= FORM_END) {
                state.formProgress = Math.max(0, currentUnit / FORM_END);
                state.rotateProgress = 0;
                state.collapseProgress = 0;
            }
            // FAZA 2: Obrót + zmiana koloru (U:3.5 → U:ROTATE_END)
            else if (currentUnit <= ROTATE_END) {
                state.formProgress = 1;
                state.rotateProgress = Math.max(0, (currentUnit - ROTATE_START) / (ROTATE_END - ROTATE_START));
                state.collapseProgress = 0;
            }
            // FAZA 3: Collapse (COLLAPSE_START → COLLAPSE_END)
            // v140: ease-in on cp → slow start forward (mirrors the nice slow reassembly backward)
            else if (currentUnit <= COLLAPSE_END) {
                state.formProgress = 1;
                state.rotateProgress = 1;
                var _rawCP = (currentUnit - COLLAPSE_START) / (COLLAPSE_END - COLLAPSE_START);
                state.collapseProgress = _rawCP * _rawCP; // power2.in — slow start, fast finish
            }
            // POZA ZAKRESEM
            else {
                state.formProgress = 1;
                state.rotateProgress = 1;
                state.collapseProgress = 1;
            }

            // Kolor podąża za obrotem (0=niebieski, 1=zielony)
            state.colorMixRatio = state.rotateProgress;
        }

        // ============================================
        // PĘTLA ANIMACJI (wywoływana przez gsap.ticker)
        // ============================================
        function animate() {
            if (!initialized || activeCount === 0) return;
            if (document.hidden) return;

            frameCount++;
            var time = performance.now() * 0.001;
            var fp = state.formProgress;
            var rp = state.rotateProgress;
            var cp = state.collapseProgress;

            // Nie renderuj gdy w pełni zwinięte
            if (cp >= 1) {
                ctx.clearRect(0, 0, width, height);
                return;
            }

            // ============ Rotacja 3D (! → ?) ============
            var _rp2 = -2 * rp + 2;
            var rotEase = rp < 0.5
                ? 4 * rp * rp * rp
                : 1 - (_rp2 * _rp2 * _rp2) / 2; // was Math.pow(_rp2, 3)
            var theta = (PI * 0.5) * (1 - rotEase);
            var cosTheta = Math.cos(theta);
            var sinTheta = Math.sin(theta);

            var globalMix = state.colorMixRatio;

            // OPT: per-frame scalars hoisted from inner loop
            var breathRamp = fp < 0.80 ? 1 + 13 * (1 - fp / 0.80) : 1.0;
            var breathStrength = (1 - cp) * breathRamp;
            var _breathMobile = width < 600;
            var breathScale5 = breathStrength * (_breathMobile ? 3 : 10);
            var breathScale8 = breathStrength * (_breathMobile ? 5 : 15);
            var K_COLLAPSE = 1.6;
            var INV_K = 0.625; // 1/1.6 — div→mul conversion
            var _dotTopY = state.dotTopY || 9999;
            var _fStart = state.dotTopY || 0;
            var _fEnd = state.dotBottomY || (_fStart + 50);
            var _fadeRange = (_fEnd - _fStart) || 1;
            var _timeA = time * 1.04;  // breath freq X — hoisted from 2000× loop
            var _timeB = time * 0.91;  // breath freq Y
            var _timeC = time * 1.56;  // breath freq Z
            var _hFall = height * 0.6;       // collapse fall distance
            var _invHFade = 1 / (height * 0.25); // collapse fade — mul zamiast div

            // ============ LOGIKA CZĄSTECZEK (3-fazowe phase-split) ============
            // STEADY (fp=1, cp=0): p=1 for ALL → ease=1, arc≈0, flightCurve=skip, collapse=skip
            // Eliminates ~55% CPU work during najdłuższa faza (6/17 sek animacji)
            var _formDone = (fp >= 1);
            
            if (!_formDone) {
            // ── FORM LOOP: pełna mechanika lotu ──
            for (var i = 0; i < activeCount; i++) {
                var p = (fp - pFlightBase[i]) / 0.65;
                
                if (pFlightSpeed[i] > 1) {
                    var rawP = p > 0 ? p : 0;
                    var fsBoost = 1 + (pFlightSpeed[i] - 1) * Math.max(0, 1 - rawP * 2.5);
                    p = p * fsBoost;
                }
                
                if (p > 1) p = 1; else if (p < 0) p = 0;

                var invP = 1 - p;
                var ease = 1 - (invP * invP * invP * invP);

                var rTx, rTz;
                if (rp >= 1) {
                    rTx = tX[i]; rTz = tZ[i];
                } else if (rp <= 0) {
                    rTx = tZ[i]; rTz = -tX[i];
                } else {
                    rTx = tX[i] * cosTheta + tZ[i] * sinTheta;
                    rTz = -tX[i] * sinTheta + tZ[i] * cosTheta;
                }

                var lx = sX[i] + (rTx - sX[i]) * ease;
                var ly = sY[i] + (tY[i] - sY[i]) * ease;
                var lz = sZ[i] + (rTz - sZ[i]) * ease;

                if (pArcStrength[i] > 0) {
                    lx += -sX[i] * fastSin(ease * PI) * pArcStrength[i];
                }

                if (p < 0.98) {
                    var pPI = p * PI;
                    var flightCurve = fastSin(pPI);
                    var curveScale = pCurveScale[i]; // precomputed in createParticles

                    var cPhase = pCurvePhase[i];
                    var cFact = pCurveFactor[i];
                    var curveStrength = p < 0.9 ? 1 : invP * 10;
                    var curveMul = cFact * flightCurve * curveScale * curveStrength;

                    lx += fastSin(pPI * 2 + cPhase) * curveMul * 0.4;
                    ly += fastCos(pPI * 2.5 + cPhase + 1.3) * curveMul * 0.3;
                    lz += fastSin(pPI * 3 + pSeed[i]) * flightCurve * 80 * curveStrength;
                }

                if (breathStrength > 0.01) {
                    lx += fastSin(_timeA + pBreathY[i] + pSeed[i]) * breathScale5;
                    ly += fastCos(_timeB + pBreathX[i] + pSeed[i]) * breathScale5;
                    lz += fastSin(_timeC + pSeed[i]) * breathScale8;
                }

                var depthAlpha = Math.max(0, 1 - (lz / 3500));
                var fadeIn = Math.min(1, p * 3);
                var alpha = fadeIn * depthAlpha;

                if (p > 0.5 && lz > 80) {
                    alpha *= Math.max(0.2, 1 - (lz - 80) / 400);
                }

                pX[i] = lx;
                pY[i] = ly;
                pZ[i] = lz;
                alpha *= pAlphaBase[i];
                pAlpha[i] = alpha > 1 ? 1 : (alpha < 0 ? 0 : alpha);
            }
            } else if (cp <= 0) {
            // ── STEADY LOOP ──
            for (var i = 0; i < activeCount; i++) {
                var lx, ly, lz;
                if (rp >= 1) {
                    lx = tX[i]; lz = tZ[i];
                } else if (rp <= 0) {
                    lx = tZ[i]; lz = -tX[i];
                } else {
                    lx = tX[i] * cosTheta + tZ[i] * sinTheta;
                    lz = -tX[i] * sinTheta + tZ[i] * cosTheta;
                }
                ly = tY[i];

                if (breathStrength > 0.01) {
                    lx += fastSin(_timeA + pBreathY[i] + pSeed[i]) * breathScale5;
                    ly += fastCos(_timeB + pBreathX[i] + pSeed[i]) * breathScale5;
                    lz += fastSin(_timeC + pSeed[i]) * breathScale8;
                }

                var alpha = Math.max(0, 1 - (lz / 3500));
                if (lz > 80) {
                    alpha *= Math.max(0.2, 1 - (lz - 80) / 400);
                }

                pX[i] = lx;
                pY[i] = ly;
                pZ[i] = lz;
                pAlpha[i] = alpha > 1 ? 1 : (alpha < 0 ? 0 : alpha);
                alpha *= pAlphaBase[i];
            }
            } else {
            // ── COLLAPSE LOOP ──
            for (var i = 0; i < activeCount; i++) {
                var lx = tX[i];
                var ly = tY[i];
                var lz = tZ[i];

                if (breathStrength > 0.01) {
                    lx += fastSin(_timeA + pBreathY[i] + pSeed[i]) * breathScale5;
                    ly += fastCos(_timeB + pBreathX[i] + pSeed[i]) * breathScale5;
                    lz += fastSin(_timeC + pSeed[i]) * breathScale8;
                }

                var collapseAlpha = 1;
                var isDot = tY[i] >= _dotTopY;
                var triggered = false;
                var triggerCP = 0;

                if (isDot && cp > 0.08) {
                    // Dot: precomputed threshold (eliminates sqrt from loop)
                    if (cp >= pFallTriggerDot[i]) {
                        triggerCP = pFallTriggerDot[i];
                        triggered = true;
                    }
                }

                if (!triggered) {
                    // Stick: precomputed threshold
                    if (cp >= pFallTriggerStick[i]) {
                        triggerCP = pFallTriggerStick[i];
                        triggered = true;
                    }
                }

                if (triggered) {
                    var localTime = cp - triggerCP;
                    if (localTime < 0) localTime = 0;

                    var fallEase = localTime * localTime;
                    var gravMult = isDot ? 7 : 4;
                    var fallY = fallEase * _hFall * pFallSpeed[i] * gravMult;

                    var driftScale = isDot ? 0.25 : 1;
                    var driftX = pFallDriftX[i] * localTime * driftScale;
                    var driftZ = pFallDriftZ[i] * localTime;
                    var wobble = fastSin(localTime * 12 + pSeed[i]) * 8 * Math.max(0, 1 - localTime * 3);

                    ly += fallY;
                    lx += driftX + wobble * (isDot ? 0.4 : 1);
                    lz += driftZ;

                    if (isDot) {
                        collapseAlpha = Math.max(0, 1 - fallY * _invHFade);
                    } else {
                        if (ly >= _fEnd) collapseAlpha = 0;
                        else if (ly >= _fStart) collapseAlpha = 1 - (ly - _fStart) / _fadeRange;
                    }
                }

                if (collapseAlpha <= 0) { pAlpha[i] = 0; pX[i] = lx; pY[i] = ly; pZ[i] = lz; continue; }

                var alpha = Math.max(0, 1 - (lz / 3500)) * collapseAlpha;
                if (lz > 80 && collapseAlpha > 0.5) {
                    alpha *= Math.max(0.2, 1 - (lz - 80) / 400);
                }

                pX[i] = lx;
                pY[i] = ly;
                pZ[i] = lz;
                pAlpha[i] = alpha > 1 ? 1 : (alpha < 0 ? 0 : alpha);
                alpha *= pAlphaBase[i];
            }
            }


            // ============ RENDEROWANIE ============
            // ROI clear: STEADY → tight bounds only, FORM/COLLAPSE → full canvas
            if (_formDone && cp <= 0 && _clipLeft > 0) {
                var _roiX = Math.floor(_clipLeft * width * 0.01);
                var _roiY = Math.floor(_clipTop * height * 0.01);
                var _roiW = width - _roiX - Math.floor(_clipRight * width * 0.01);
                var _roiH = height - _roiY - Math.floor(_clipBottom * height * 0.01);
                ctx.clearRect(_roiX - 2, _roiY - 2, _roiW + 4, _roiH + 4);
            } else {
                ctx.clearRect(0, 0, width, height);
            }
            
            // Mobile: Y=-55, Scale=1.40 (dostosowanie do mniejszego ekranu)
            var isMobileParticle = width < 600;
            var signScale = isMobileParticle ? 1.40 : 1;
            var mobileYOffset = isMobileParticle ? (-35) : 0;
            var particleSizeScale = isMobileParticle ? 0.60 : 1; // REF: mobile 40% mniejsze
            
            // ============ WARM MIX: Interpolate neutral→warm pastels ============
            var warmMix = _s._warmMix.value;
            if (warmMix !== _lastWarmMix) {
                _lastWarmMix = warmMix;
                for (var wi = 0; wi < 8; wi++) {
                    var ns = NEUTRAL_START[wi], wt = WARM_TARGETS[wi];
                    PALETTE_A_RGB[12 + wi] = {
                        r: Math.round(ns.r + (wt.r - ns.r) * warmMix),
                        g: Math.round(ns.g + (wt.g - ns.g) * warmMix),
                        b: Math.round(ns.b + (wt.b - ns.b) * warmMix)
                    };
                }
                _lastGlobalMix = -1; // force LUT rebuild
            }

            // ============ COLOR LUT: Pre-compute kolorów dla aktualnego globalMix ============
            if (globalMix !== _lastGlobalMix) {
                _lastGlobalMix = globalMix;
                for (var lutA = 0; lutA < PA_LEN; lutA++) {
                    var cA = PALETTE_A_RGB[lutA];
                    for (var lutB = 0; lutB < PB_LEN; lutB++) {
                        var cB = PALETTE_B_RGB[lutB];
                        var lutR = Math.floor(cA.r + (cB.r - cA.r) * globalMix);
                        var lutG = Math.floor(cA.g + (cB.g - cA.g) * globalMix);
                        var lutBlue = Math.floor(cA.b + (cB.b - cA.b) * globalMix);
                        colorLUT[lutA * PB_LEN + lutB] = 'rgb(' + lutR + ',' + lutG + ',' + lutBlue + ')';
                    }
                }
            }

            // ============ SIGN RISE: particles form low, gradually rise to final position ============

            // ============ BATCHING: Faza 1 - przypisz do bucketów ============
            // OPT-4: Reset only used buckets from last frame
            for (var _ri = 0; _ri < activeBucketLen; _ri++) bucketCount[activeBuckets[_ri]] = 0;
            activeBucketLen = 0;
            
            for (var i = 0; i < activeCount; i++) {
                var idx = i;
                if (pAlpha[idx] <= 0.01) continue;

                var depth = FOCAL_LENGTH + pZ[idx];
                if (depth < 10) continue;

                var scale = FOCAL_LENGTH / depth;
                var rX2 = cx + pX[idx] * scale * signScale;
                var rY2 = cy + pY[idx] * scale * signScale + mobileYOffset;

                if (rX2 < -50 || rX2 > width + 50 || rY2 < -50 || rY2 > height + 50) continue;

                var rSize = pSize[idx] * scale * particleSizeScale;
                
                // ScaleBoost: giga cząsteczki maleją z easingiem formowania
                if (pScaleBoost[idx] > 1) {
                    var fp2 = fp;
                    var p2 = (fp2 - pFlightBase[idx]) / 0.65;
                    if (p2 > 1) p2 = 1; else if (p2 < 0) p2 = 0;
                    var invP2 = 1 - p2;
                    var ease2 = 1 - (invP2 * invP2 * invP2 * invP2);
                    rSize *= 1 + (pScaleBoost[idx] - 1) * (1 - ease2);
                }
                
                
                if (rSize < 0.1) continue;

                // Przypisz do bucketu (kolor × alpha)
                
                var colorIdx = pColorIdx[idx];
                
                var alphaBucket = Math.min(7, (pAlpha[idx] * 8) | 0);
                var bucketIdx = colorIdx * 8 + alphaBucket;
                
                var c = bucketCount[bucketIdx];
                if (c === 0) activeBuckets[activeBucketLen++] = bucketIdx; // OPT-4
                bucketX[bucketIdx][c] = rX2;
                bucketY[bucketIdx][c] = rY2;
                bucketS[bucketIdx][c] = rSize;
                bucketCount[bucketIdx] = c + 1;
            }
            
            // ============ BATCHING: Faza 2 - renderuj buckety ============
            // OPT-4: iterate only active buckets (~50 vs 1280)
            for (var _ab = 0; _ab < activeBucketLen; _ab++) {
                var bucketIdx = activeBuckets[_ab];
                var colorIdx = (bucketIdx >> 3); // bucketIdx / 8 (integer div)
                var alphaBucket = bucketIdx & 7;  // bucketIdx % 8
                var count = bucketCount[bucketIdx];
                
                ctx.fillStyle = colorLUT[colorIdx];
                ctx.globalAlpha = (alphaBucket + 0.5) * 0.125;
                
                var bx = bucketX[bucketIdx];
                var by = bucketY[bucketIdx];
                var bs = bucketS[bucketIdx];
                
                // P5: Single path per bucket (merge rect+arc → 50% fewer fill() calls)
                ctx.beginPath();
                for (var j = 0; j < count; j++) {
                    var ps = bs[j];
                    if (ps < 2) {
                        ctx.rect(bx[j] - ps, by[j] - ps, ps * 2, ps * 2);
                    } else {
                        ctx.moveTo(bx[j] + ps, by[j]);
                        ctx.arc(bx[j], by[j], ps, 0, PI_2);
                    }
                }
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
            
            // ============ PULSE: source-atop → SHARP WAVE with visible front ============
            var _pulseOp = _s._pulseOpacity.value;
            if (_pulseOp > 0.01 && isFinite(cx) && isFinite(cy)) {
                var _pulseNow = performance.now() / 1000;
                var _pulseCycle = 6.5;
                var _pulseCx = cx;
                var _dotMid = (state.dotTopY !== undefined) 
                    ? (state.dotTopY + state.dotBottomY) * 0.5 + cy
                    : cy;
                var _dotHeight = (state.dotBottomY !== undefined)
                    ? (state.dotBottomY - state.dotTopY) : 40;
                // Center BELOW the dot (dot height × 1.5 lower)
                var _pulseCy = _dotMid + _dotHeight * 1.5 + mobileYOffset;
                var _pulseMaxR = Math.max(width, height) * 0.7;
                if (!isFinite(_pulseCy) || !isFinite(_pulseMaxR) || _pulseMaxR < 1) {
                    // Skip pulse if coordinates are invalid
                } else {
                
                ctx.save();
                ctx.globalCompositeOperation = 'source-atop';
                for (var _pr = 0; _pr < 3; _pr++) {
                    var _pDelay = _pr * 1.5;
                    var _pT = ((_pulseNow - _pDelay) % _pulseCycle) / _pulseCycle;
                    if (_pT < 0) _pT += 1;
                    
                    var _pWaveR = _pulseMaxR * _pT;
                    var _pFade = (1 - _pT) * _pulseOp * 0.6; // reduced: tint, don't override particle colors
                    if (_pFade < 0.01) continue;
                    
                    // Sharp wave front ring + fading trail behind
                    var _pInner = Math.max(1, _pWaveR * 0.7);
                    var _pOuter = _pWaveR * 1.15;
                    if (_pOuter < 2) continue;
                    
                    var _pGrad = ctx.createRadialGradient(_pulseCx, _pulseCy, 0, _pulseCx, _pulseCy, _pOuter);
                    
                    // Trail: light tint behind wave
                    _pGrad.addColorStop(0, _getPulseRGBA(_pFade * 0.15));
                    // Ramp up to wave front
                    var _frontStart = _pInner / _pOuter;
                    _pGrad.addColorStop(Math.min(0.95, _frontStart), _getPulseRGBA(_pFade * 0.2));
                    // WAVE FRONT — bright, narrow band
                    var _frontPeak = (_pWaveR * 0.9) / _pOuter;
                    _pGrad.addColorStop(Math.min(0.96, _frontPeak), _getPulseRGBA(_pFade * 0.85));
                    // Sharp fade after front
                    _pGrad.addColorStop(Math.min(0.99, (_pWaveR * 1.05) / _pOuter), _getPulseRGBA(_pFade * 0.1));
                    _pGrad.addColorStop(1, _getPulseRGBA(0));
                    
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = _pGrad;
                    ctx.fillRect(0, 0, width, height);
                }
                ctx.restore();
                } // end isFinite guard
            }
        }

        // ============================================
        // INIT / RESIZE
        // ============================================
        
        // Funkcja do zmiany DPR bez przebudowy cząsteczek
        function resizeParticleForDPR() {
            var dpr = adaptiveDPR.get();
            var _targetW = Math.round(width * dpr);
            var _targetH = Math.round(height * dpr);
            if (canvas.width !== _targetW || canvas.height !== _targetH) {
                canvas.width = _targetW;
                canvas.height = _targetH;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
            }
        }
        
        function resize() {
            // Freeze: na touch devices przy końcu animacji nie reaguj na toolbar resize
            if (IS_TOUCH && freezeFinal) return;
            var wrapper = canvas.parentElement;
            var newWidth = wrapper ? wrapper.offsetWidth : window.innerWidth;
            height = wrapper ? wrapper.offsetHeight : window.innerHeight;
            
            // Sprawdź czy szerokość się zmieniła (mobile toolbar zmienia tylko height)
            var widthChanged = (newWidth !== lastWidth);
            width = newWidth;
            lastWidth = newWidth;
            
            cx = width / 2;
            cy = height / 2;

            var dpr = adaptiveDPR.get();
            var _targetW = Math.round(width * dpr);
            var _targetH = Math.round(height * dpr);
            if (canvas.width !== _targetW || canvas.height !== _targetH) {
                canvas.width = _targetW;
                canvas.height = _targetH;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
            }

            // Przebuduj cząsteczki TYLKO gdy szerokość się zmieniła
            // Mobile toolbar show/hide zmienia tylko height → skip expensive rebuild
            if (widthChanged) {
                if (document.fonts && !initialized) {
                    document.fonts.ready.then(function() {
                        createParticles();
                        initialized = true;
                    });
                } else {
                    createParticles();
                    initialized = true;
                }
            }
        }

        // ============================================
        // GSAP TICKER - aktualizacja faz + renderowanie
        // Czyta pinnedTl.progress() bezpośrednio (jak cylinder)
        // ============================================
        const _tickParticle = function() {
            if (_s._killed) return;
            if (!_sectionTickOk) return;
            if (_s.pinnedTl) {
                var progress = _s.pinnedTl.progress();
                var duration = _s.pinnedTl.duration();
                var currentUnit = progress * duration;
                var bridgeI = _s.bridgeI;
                
                if (currentUnit < bridgeI) {
                    // ═══ BRIDGE: liniowe mapowanie (proporcje particle/rings zachowane) ═══
                    var bridgeFraction = currentUnit / bridgeI;
                    updatePhases(bridgeFraction * FORM_END);
                } else {
                    // POST-BRIDGE: kineticUnit, FORM locked (clamp min=FORM_END)
                    var kineticUnit = currentUnit - bridgeI;
                    // v139: Subtract DELTA so rotation/collapse fire at shifted timeline positions
                    // kU=3.5+DELTA → passes 3.5 → ROTATE_START → rp=0 (push moment)
                    // kU=SNAP2_KINETIC+DELTA → ROTATE_END → rp=1 (SNAP2)
                    var delta = _s.DELTA || 0;
                    updatePhases(Math.max(FORM_END, kineticUnit - delta));
                    // ROTATION OVERRIDE: bypass delta dead zone (4.13U pause at SNAP1)
                    // Raw kineticUnit: 0 at bridge end, linear through scroll
                    // Maps: kU=0 → rp=0, kU=ROTATE_END+delta → rp=1
                    if (state.formProgress >= 1 && kineticUnit > 0) {
                        var _rotP = kineticUnit / (ROTATE_END + delta);
                        state.rotateProgress = _rotP > 1 ? 1 : (_rotP < 0 ? 0 : _rotP);
                        state.colorMixRatio = state.rotateProgress;
                    }
                }
            }
            // FORM: full-screen (cząsteczki lecą z ±160% width)
            // STEADY: tight clip (kształt uformowany, bounded area)
            // COLLAPSE: full-screen (spadanie rozlewa się po ekranie)
            // FIX: Hysteresis prevents oscillation at formProgress ≈ 1.0 during snap deceleration
            // FIX2: 3-frame debounce absorbs Lenis overshoot (~17ms) before clip-path toggles OFF
            var _fpNow = state.formProgress;
            var _wantClip = _clipActive 
                ? (_fpNow >= 0.995 && state.collapseProgress <= 0)   // already on: keep unless drops below 0.995
                : (_fpNow >= 1 && state.collapseProgress <= 0);      // off: only enable at exact 1.0

            // Debounce: ignoruj krótkie transjensy (Lenis overshoot 1-2 klatki)
            // Tylko dla przejścia ON→OFF (wyłączanie); włączanie jest natychmiastowe
            if (!_wantClip && _clipActive) {
                _clipOffCount = (_clipOffCount || 0) + 1;
                if (_clipOffCount < 3) _wantClip = true; // trzymaj ON przez 3 klatki
            } else {
                _clipOffCount = 0; // reset gdy clip powinien być ON lub już OFF
            }

            if (_wantClip && !_clipActive) {
                canvas.style.clipPath = 'inset(' + _clipTop.toFixed(1) + '% ' + _clipRight.toFixed(1) + '% ' + _clipBottom.toFixed(1) + '% ' + _clipLeft.toFixed(1) + '%)';
                _clipActive = true;
            } else if (!_wantClip && _clipActive) {
                canvas.style.clipPath = '';
                _clipActive = false;
            }
            // P1: Phase-aware — hide particle canvas from compositor after collapse
            if (state.collapseProgress >= 1 && !_particleHidden) {
                canvas.style.display = 'none';
                _particleHidden = true;
                return;
            }
            if (state.collapseProgress < 1 && _particleHidden) {
                canvas.style.display = '';
                _particleHidden = false;
            }
            animate();
        };
        gsap.ticker.add(_tickParticle);
        tickerFns.push(_tickParticle);

        // ============================================
        // START
        // ============================================
        const _resizeParticle = function() { resize(); };
        window.addEventListener('resize', _resizeParticle);
        cleanups.push(() => window.removeEventListener('resize', _resizeParticle));
        resize();
        
        // Adaptive DPR - callback przy zmianie jakości
        adaptiveDPR.onChange(resizeParticleForDPR);

        // ============================================
        // PUBLIC API
        // ============================================
        _s.particleQmark = {
            state: state,
            getActiveCount: function() { return activeCount; },
            canvas: canvas,
            forceResize: function() {
                lastWidth = 0; // Force rebuild
                resize();
            }
        };

    })();

    // ============ CYLINDER COMPONENT - JAVASCRIPT (SCRUB CONTROLLED) ============
    (function() {
        'use strict';
        
        const CYLINDER_CONFIG = {
            startNumber: 95, // v140: 97→98 (1 rotation — lighter during peak)
            endNumber: 98,
            
            // Rozmiary OGROMNE: 225% szerokości, 180% wysokości
            fontSize: 792,
            radius: 900,
            perspective: 288,
            
            fontSizeMobile: 342,
            radiusMobile: 389,
            perspectiveMobile: 124, // Proporcjonalne: 288 * (389/900) = identyczny efekt fisheye
            mobileBreakpoint: 768,
            
            fontFamily: 'Lexend, sans-serif',
            fontWeight: '800',
            superscriptRatio: 0.45,
            
            sliceHeight: 3, // Oryginalna wartość - przy redukcji canvas/tekstur nie potrzeba większych
            
            centerYPercent: 0.502,
            centerYPercentMobile: 0.452,
            
            textColor: '#fefefc', // Wyliczony kolor hard-light (zastępuje blend mode)
        };
        
        const canvas = $id('kinetic-cylinder-canvas');
        if (!canvas) {
            return;
        }
        
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return; // fail-soft: brak kontekstu → skip cylinder layer
        const wrapper = $id('kinetic-cylinder-wrapper');
        
        let width = window.innerWidth;
        let height = window.innerHeight;
        let lastCylWidth = 0;
        
        const textures = [];
        const config = { ...CYLINDER_CONFIG };
        
        let fogTopY = 0;
        let fogBottomY = 0;
        
        // ============ CACHED FOG GRADIENTS (utworzone w resize) ============
        let cachedFogTop = null;
        let cachedFogBottom = null;
        let cachedFogTopEnd = 0;
        let cachedFogBottomStart = 0;
        
        // ============ STAN KONTROLOWANY PRZEZ TIMELINE ============
        const cylinderState = {
            rotation: 0,
            opacity: 0,
            y: -100
        };
        
        // ============ DIRTY CHECK — skip render gdy state identyczny ============
        let lastRotation = null;
        let lastOpacity = null;
        let resizeTriggered = true; // true na start żeby pierwszy render się wykonał
        
        function createWordTexture(text) {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) return null; // fail-soft
            
            const mainFontSize = config.fontSize;
            const superFontSize = Math.round(mainFontSize * config.superscriptRatio);
            
            tempCtx.font = `${config.fontWeight} ${mainFontSize}px ${config.fontFamily}`;
            const mainMetrics = tempCtx.measureText(text);
            const mainWidth = Math.ceil(mainMetrics.width);
            
            tempCtx.font = `${config.fontWeight} ${superFontSize}px ${config.fontFamily}`;
            const superMetrics = tempCtx.measureText('%');
            const superWidth = Math.ceil(superMetrics.width);
            
            const totalWidth = mainWidth + superWidth + 5;
            const textHeight = Math.ceil(mainFontSize * 1.0);
            
            tempCanvas.width = totalWidth;
            tempCanvas.height = textHeight;
            
            tempCtx.font = `${config.fontWeight} ${mainFontSize}px ${config.fontFamily}`;
            tempCtx.textAlign = 'left';
            tempCtx.textBaseline = 'middle';
            tempCtx.fillStyle = config.textColor;
            tempCtx.fillText(text, 0, textHeight / 2);
            
            tempCtx.font = `${config.fontWeight} ${superFontSize}px ${config.fontFamily}`;
            const superOffsetY = textHeight / 2 - mainFontSize * 0.15;
            tempCtx.fillText('%', mainWidth + 5, superOffsetY);
            
            return {
                img: tempCanvas,
                width: totalWidth,
                height: textHeight,
                arcAngle: textHeight / config.radius
            };
        }

        function initTextures() {
            textures.length = 0;
            
            const testTexture = createWordTexture(String(config.endNumber));
            if (!testTexture) return; // fail-soft: font/context unavailable
            config.itemSpacing = (testTexture.height / config.radius) * 0.8;
            
            const maxItems = Math.floor((2 * Math.PI) / config.itemSpacing);
            
            config.words = [];
            for (let i = maxItems - 1; i >= 0; i--) {
                config.words.unshift((config.endNumber - i).toString());
            }
            
            // === STRATEGIA D: Tylko widoczne liczby (94→98) ===
            // Zachowujemy oryginalny index dla poprawnego obliczenia baseAngle
            const visibleNumbers = ['95', '96', '97', '98']; // v140: was ['96','97','98'] — 1 rotation instead of 2
            
            for (let i = 0; i < config.words.length; i++) {
                if (visibleNumbers.includes(config.words[i])) {
                    const tex = createWordTexture(config.words[i]);
                    if (!tex) continue; // fail-soft
                    tex._originalIndex = i; // Zachowaj oryginalny index dla baseAngle
                    
                    // P1: Precompute cos(β)/sin(β) for trig identity: cos(α+β) = cosα·cosβ - sinα·sinβ
                    // β = relY * arcAngle — constant per slice, eliminates Math.cos/sin from inner loop
                    const sh = config.sliceHeight;
                    const nSlices = Math.ceil(tex.height / sh);
                    const invH = 1 / tex.height;
                    tex._cosBeta = new Float32Array(nSlices);
                    tex._sinBeta = new Float32Array(nSlices);
                    for (let s = 0; s < nSlices; s++) {
                        const beta = ((s * sh) * invH - 0.5) * tex.arcAngle;
                        tex._cosBeta[s] = Math.cos(beta);
                        tex._sinBeta[s] = Math.sin(beta);
                    }
                    
                    textures.push(tex);
                }
            }
        }
        
        function getRotationForNumber(num) {
            if (!config.words) return 0; // guard: initTextures() not yet called
            const index = config.words.indexOf(String(num));
            return index === -1 ? 0 : -index * config.itemSpacing;
        }

        function resize() {
            if (IS_TOUCH && freezeFinal) return;
            const rawWidth = wrapper.offsetWidth;
            const rawHeight = wrapper.offsetHeight;
            
            // GUARD: rawWidth=0 → config.fontSize=0 → itemSpacing=0 → maxItems=Infinity → crash
            // Retry po wyrenderowaniu layoutu (RAF gwarantuje że DOM jest gotowy)
            if (rawWidth === 0) {
                requestAnimationFrame(function() { resize(); });
                return;
            }
            
            // === STRATEGIA A: Canvas Max Size ===
            // Ograniczamy canvas do 1440×900 dla wydajności
            // CSS skaluje do pełnego rozmiaru wrappera
            const MAX_CANVAS_W = 1440;
            const MAX_CANVAS_H = 900;
            
            const canvasScale = Math.min(
                rawWidth > MAX_CANVAS_W ? MAX_CANVAS_W / rawWidth : 1,
                rawHeight > MAX_CANVAS_H ? MAX_CANVAS_H / rawHeight : 1
            );
            
            width = Math.round(rawWidth * canvasScale);
            height = Math.round(rawHeight * canvasScale);
            
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
            canvas.style.width = rawWidth + 'px';
            canvas.style.height = rawHeight + 'px';
            // Nie skalujemy ctx - canvas jest mniejszy, CSS rozciąga
            
            // === STRATEGIA B: Proporcjonalne fontSize ===
            // fontSize skalowane proporcjonalnie do rozmiaru canvas
            if (window.innerWidth <= config.mobileBreakpoint) {
                const mobileScale = width / 600; // Bazowa szerokość mobile
                config.fontSize = Math.round(CYLINDER_CONFIG.fontSizeMobile * Math.min(1, mobileScale));
                config.radius = Math.round(CYLINDER_CONFIG.radiusMobile * Math.min(1, mobileScale));
                config.perspective = CYLINDER_CONFIG.perspectiveMobile;
                config.centerYPercent = CYLINDER_CONFIG.centerYPercentMobile;
            } else {
                const desktopScale = width / MAX_CANVAS_W; // Bazowa szerokość desktop = max canvas
                config.fontSize = Math.round(CYLINDER_CONFIG.fontSize * desktopScale);
                config.radius = Math.round(CYLINDER_CONFIG.radius * desktopScale);
                config.perspective = Math.round(CYLINDER_CONFIG.perspective * desktopScale);
                config.centerYPercent = CYLINDER_CONFIG.centerYPercent;
            }
            
            if (window.innerWidth <= config.mobileBreakpoint) {
                fogTopY = height * 0.02;
                fogBottomY = height * 0.98;
            } else {
                fogTopY = height * 0.10;
                fogBottomY = height * 0.90;
            }
            
            // ============ CACHE FOG GRADIENTS - JEDEN SYSTEM ============
            // Dynamiczne fog bounds oparte na centerYPercent
            // Desktop (0.502): fog 0.452-0.552 → praktycznie bez zmian
            // Mobile (0.452): fog 0.402-0.502 → centrum w środku czystej strefy
            cachedFogTopEnd = config.centerYPercent - 0.05;
            cachedFogBottomStart = config.centerYPercent + 0.05;
            
            // Identyczne gradienty dla obu platform
            cachedFogTop = ctx.createLinearGradient(0, 0, 0, height * cachedFogTopEnd);
            cachedFogTop.addColorStop(0, 'rgba(0,0,0,1)');
            cachedFogTop.addColorStop(0.6, 'rgba(0,0,0,0.8)');
            cachedFogTop.addColorStop(1, 'rgba(0,0,0,0)');
            
            cachedFogBottom = ctx.createLinearGradient(0, height * cachedFogBottomStart, 0, height);
            cachedFogBottom.addColorStop(0, 'rgba(0,0,0,0)');
            cachedFogBottom.addColorStop(0.4, 'rgba(0,0,0,0.8)');
            cachedFogBottom.addColorStop(1, 'rgba(0,0,0,1)');
            
            // Tekstury zależą od szerokości, nie wysokości — skip rebuild przy mobile toolbar
            if (rawWidth !== lastCylWidth) {
                var isFirstInit = (lastCylWidth === 0);
                initTextures();
                lastCylWidth = rawWidth;
                
                // Rotacja: TYLKO przy pierwszym renderze (startNumber=95)
                // Przy resize NIE resetujemy — GSAP kontroluje aktualną wartość
                if (isFirstInit) {
                    cylinderState.rotation = getRotationForNumber(CYLINDER_CONFIG.startNumber);
                }
            }
            
            // Wymuś ponowny render po resize
            resizeTriggered = true;
        }
        
        function render() {
            ctx.clearRect(0, 0, width, height);
            
            // Nie renderuj jeśli niewidoczny (opacity kontrolowane w tickerze)
            if (cylinderState.opacity <= 0) return;
            
            const centerX = width * 0.5;
            const centerY = height * config.centerYPercent;
            const angleCutoff = 0.7; // Identyczne mobile/desktop
            const radius = config.radius;
            const perspective = config.perspective;
            const sliceHeight = config.sliceHeight;
            const sliceStep = _cylMotion ? 3 : 1; // halfway: orig=2, was=4
            const renderSliceH = sliceHeight * sliceStep;
            const rotation = cylinderState.rotation;
            const itemSpacing = config.itemSpacing;
            const minY = fogTopY;
            const maxY = fogBottomY;
            
            const textureCount = textures.length;
            for (let i = 0; i < textureCount; i++) {
                const texture = textures[i];
                const originalIndex = texture._originalIndex; // Używaj oryginalnego indexu
                const baseAngle = (originalIndex * itemSpacing) + rotation;
                const cosBase = Math.cos(baseAngle);
                
                if (cosBase < angleCutoff) continue;
                
                const texImg = texture.img;
                const texWidth = texture.width;
                const texHeight = texture.height;
                const _cosBeta = texture._cosBeta;
                const _sinBeta = texture._sinBeta;
                const sinBase = Math.sin(baseAngle); // P1: computed once per texture (was per-slice)

                for (let sy = 0, sIdx = 0; sy < texHeight; sy += renderSliceH, sIdx += sliceStep) {
                    // P1: cos(α+β) = cosα·cosβ - sinα·sinβ (was: Math.cos(sliceAngle))
                    const cb = _cosBeta[sIdx];
                    const sb = _sinBeta[sIdx];
                    const cosSlice = cosBase * cb - sinBase * sb;
                    
                    if (cosSlice < angleCutoff) continue;
                    
                    const sinSlice = sinBase * cb + cosBase * sb; // P1: sin(α+β) = sinα·cosβ + cosα·sinβ
                    const worldY = sinSlice * radius;
                    const depth = radius - (radius * cosSlice);
                    const scale = perspective / (perspective + depth);
                    const screenY = centerY + (worldY * scale);
                    const destHeight = renderSliceH * scale * cosSlice;
                    
                    if (screenY + destHeight < minY) continue;
                    if (screenY > maxY) break;
                    
                    const destWidth = texWidth * scale;
                    const destX = centerX - (destWidth * 0.5);
                    
                    ctx.drawImage(
                        texImg,
                        0, sy, texWidth, renderSliceH,
                        destX, screenY, destWidth, destHeight + 0.5
                    );
                }
            }
            
            // ============ FOG EFFECT - JEDEN SYSTEM DLA WSZYSTKICH ============
            // destination-out wymazuje piksele proporcjonalnie do alpha gradientu
            // Fog bounds są dynamiczne (centerYPercent ± 0.05) więc działa na obu platformach
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            
            // Gradient górny
            ctx.fillStyle = cachedFogTop;
            ctx.fillRect(0, 0, width, height * cachedFogTopEnd);
            
            // Gradient dolny
            ctx.fillStyle = cachedFogBottom;
            ctx.fillRect(0, height * cachedFogBottomStart, width, height * (1 - cachedFogBottomStart));
            
            ctx.restore();
        }

        // ============ TICKER - dirty check + render ============
        var _cylinderHidden = false; // P1: phase-aware display:none
        var _cylMotion = false; // P3: true when rotation changing → coarser slices (motion blur masks)
        var _lastCylTick = 0;
        var _CYL_FRAME_MS = 1000 / 45; // cylinder at 45fps (rest stays at 30fps)
        const _tickCylinder = () => {
            if (_s._killed) return;
            if (!_sectionVisible) return;
            if (!_sectionTickOk) return; // cylinder renders on main frame (cheap — 37ms total from profiler)
            if (document.hidden) return;
            
            // P1: Phase-aware — hide wrapper from compositor when invisible
            if (cylinderState.opacity <= 0 && !_cylinderHidden) {
                wrapper.style.display = 'none';
                _cylinderHidden = true;
                lastOpacity = 0;
                return;
            }
            if (cylinderState.opacity > 0 && _cylinderHidden) {
                wrapper.style.display = '';
                _cylinderHidden = false;
            }
            
            // Zawsze aktualizuj DOM opacity (GSAP może to zmieniać co klatkę)
            if (lastOpacity !== cylinderState.opacity) {
                wrapper.style.opacity = cylinderState.opacity;
            }
            
            // DIRTY CHECK: skip render jeśli state identyczny i nie było resize
            const rotationChanged = lastRotation !== cylinderState.rotation;
            const opacityChanged = lastOpacity !== cylinderState.opacity;
            
            if (!rotationChanged && !opacityChanged && !resizeTriggered) {
                return; // Nic się nie zmieniło — skip canvas work
            }
            
            // Update last values
            lastRotation = cylinderState.rotation;
            lastOpacity = cylinderState.opacity;
            resizeTriggered = false;
            _cylMotion = rotationChanged; // P3: adaptive sliceHeight
            
            render();
        };
        gsap.ticker.add(_tickCylinder);
        tickerFns.push(_tickCylinder);

        // Cylinder desktop transform (was external IIFE — moved inside init per ENT-JS-08)
        if (width >= 600) {
            var _cylCanvasEl = $id('kinetic-cylinder-wrapper')?.querySelector('canvas');
            if (_cylCanvasEl) _cylCanvasEl.style.transform = 'scale(1.15) rotate(-5deg)';
        }

        // ============ INIT ============
        window.addEventListener('resize', resize);
        cleanups.push(() => window.removeEventListener('resize', resize));
        resize(); // Synchronicznie — _s.cylinder musi być ustawiony przed pinnedTl.to
        
        // Mobile font fix: jeśli Lexend nie był gotowy przy resize(), przebuduj tekstury
        // Nie wywołujemy pełnego resize() — tylko initTextures() żeby nie było race condition
        document.fonts.ready.then(function() {
            if (lastCylWidth > 0) {
                initTextures();
                resizeTriggered = true;
            }
        });
        
        // ============ PUBLIC API ============
        _s.cylinder = {
            state: cylinderState,
            getRotationForNumber: getRotationForNumber,
            config: config,  // Lokalny config z words
            setConfig: function(newConfig) {
                if (newConfig.perspective !== undefined) {
                    config.perspective = newConfig.perspective;
                }
                // Wymuszamy ponowny render
                lastRotation = null;
                lastOpacity = null;
            }
        };
    })();

    // ============================================
    // TUNNEL RINGS — obręcze wokół "!"
    // Metoda C: bindowane do formProgress (viewport-niezależne)
    // ============================================
    (function() {
        'use strict';

        const TUNNEL_CONFIG = {
            count:      4,
            twistSpeed: 9.0,
            lwBase:     2.28,
            lwScale:    0.0028,
            maxOp:      0.70,
            glowR: 255, glowG: 136, glowB: 0,
            coreR: 36, coreG: 24, coreB: 0,
        };
        // Metoda C — stałe z formProgress (viewport-niezależne)
        const FP_TUNNEL_START = 0;       // v139: tunnel from first frame
        const FP_TUNNEL_RANGE = 1.0;     // v139: full bridge = full flight
        const FP_SHRINK_START = 0.634;   // shrink zaczyna się przy 63.4%
        const FP_SHRINK_END   = 0.926;   // shrink kończy się przy 92.6%
        const FP_SHRINK_RANGE = 0.292;   // 0.926 - 0.634

        class Tunnel {
            constructor(canvas) {
                this.canvas = canvas;
                this.ctx = null;
                this.rings = [];
                this.globalRot = 0;
                this.shrink = 1.0;
                this.W = 0; this.H = 0; this.cx = 0;
                this.spacing = 0; this.travel = 0;
                this.R_NEAR = 0; this.R_FAR = 0;
                this.lastWidth = 0; // Mobile resize optimization
                this._hasConicGrad = (typeof CanvasRenderingContext2D !== 'undefined' &&
                    typeof CanvasRenderingContext2D.prototype.createConicGradient === 'function');

                const _resizeTunnel = () => { 
                    const newWidth = window.innerWidth;
                    const widthChanged = (newWidth !== this.lastWidth);
                    this._resize(); 
                    // Rebuild rings tylko gdy szerokość się zmieniła (nie mobile toolbar)
                    if (widthChanged) {
                        this._build(); 
                    }
                };
                window.addEventListener('resize', _resizeTunnel);
                cleanups.push(() => window.removeEventListener('resize', _resizeTunnel));
                this._resize();
                this._build();
            }

            _resize() {
                if (IS_TOUCH && freezeFinal) return;
                const dpr = Math.min(devicePixelRatio, 1); // DPR 1 dla ostrości cylindra
                const newW = window.innerWidth;
                const newH = window.innerHeight;
                
                // Sprawdź czy wymiary canvas wymagają zmiany
                // canvas.width= dealokuje GPU buffer - unikaj gdy niepotrzebne
                const targetCanvasW = newW * dpr;
                const targetCanvasH = newH * dpr;
                const needsCanvasResize = (this.canvas.width !== targetCanvasW || 
                                           this.canvas.height !== targetCanvasH);
                
                if (needsCanvasResize) {
                    this.canvas.width = targetCanvasW;
                    this.canvas.height = targetCanvasH;
                    var _newCtx = this.canvas.getContext('2d');
                    if (!_newCtx) return; // fail-soft
                    this.ctx = _newCtx;
                    // Reset transform before scaling (defensive coding)
                    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                    this.ctx.scale(dpr, dpr);
                }
                
                // Zawsze aktualizuj logiczne wymiary (używane w render)
                this.W = newW;
                this.H = newH;
                this.lastWidth = newW; // Track width for _build decision
                this.cx = this.W * 0.5;
                this.spacing = this.H * 0.75;
                this.travel = this.H + this.spacing * 0.15;
                this.R_NEAR = this.W * 0.48;
                this.R_FAR = this.W * 0.1664;
            }

            _build() {
                this.rings = [];
                const N = TUNNEL_CONFIG.count;
                for (let i = 0; i < N; i++) {
                    const t = 1.0 + (N > 1 ? (i / (N - 1)) : 0) * 0.35;
                    let frags;
                    if (i === 2 || i === 4) {
                        const arcLen = 0.35 * Math.PI * 2;
                        const gap = 0.15 * Math.PI * 2;
                        frags = [
                            { offset: Math.PI * 0.5, len: arcLen },
                            { offset: Math.PI * 0.5 + arcLen + gap, len: arcLen }
                        ];
                    } else if (i % 2 === 1) {
                        const extraGap = 0.6 + Math.random() * 1.4;
                        const newGap = 0.30 * (1 + extraGap);
                        const arcLen = Math.max(0.15, 1 - newGap) * Math.PI * 2;
                        frags = [{ offset: Math.PI * 0.5 - arcLen * 0.5, len: arcLen }];
                    } else {
                        const arcLen = 0.70 * Math.PI * 2;
                        frags = [{ offset: Math.PI * 0.5 - arcLen * 0.5, len: arcLen }];
                    }
                    this.rings.push({ t, frags, opacity: 0 });
                }
            }

            render(progress, velocity) {
                const { ctx, W, H, cx, spacing, travel, R_NEAR, R_FAR } = this;
                const v = TUNNEL_CONFIG;
                ctx.clearRect(0, 0, W, H);
                if (progress < 0.01) { return 0; }
                const easedProgress = progress * progress;
                const dynamicSpacing = spacing * (0.5 + easedProgress * 0.75);
                const yBase = H - progress * travel;
                this.globalRot += Math.max(-0.314, Math.min(0.314, velocity * v.twistSpeed * 0.09 + 0.012)); // capped at 3 rps
                this.time = (this.time || 0) + 0.016;
                const timeBase60 = this.time * 60;
                const jitterIntensity = Math.min(1, progress * 1.35);
                const ji = jitterIntensity;
                let visibleCount = 0;
                if (!this._deferBuf) this._deferBuf = [];
                var dBuf = this._deferBuf;
                var dLen = 0;
                for (let i = 0; i < this.rings.length; i++) {
                    const ring = this.rings[i];
                    const finalY = yBase - (1 - ring.t) * dynamicSpacing;
                    const extraPush = progress > 0.7 ? (progress - 0.7) / 0.3 : 0;
                    const adjustedY = finalY - extraPush * extraPush * H * 1.5;
                    if (adjustedY < -H * 0.5) continue;
                    if (adjustedY > H * 1.2) continue;
                    const yNorm = Math.max(0, Math.min(1, adjustedY / H));
                    const rxBase = R_FAR + (R_NEAR - R_FAR) * (yNorm * Math.sqrt(yNorm));
                    const rx = rxBase * this.shrink;
                    if (rx < 1) continue;
                    const tilt = 0.15 + yNorm * 0.35;
                    const ry = rx * tilt;
                    const entryFade = adjustedY > H ? 0 : Math.min(1, (H - adjustedY) / (H * 0.45));
                    ring.opacity = (entryFade * entryFade) * v.maxOp;
                    if (ring.opacity < 0.004) continue;
                    visibleCount++;
                    const lw = Math.max(1.0, v.lwBase + rx * v.lwScale);
                    var _ringGlowGrad = null, _ringCoreGrad = null;
                    var _gR = v.glowR, _gG = v.glowG, _gB = v.glowB;
                    var _cR = v.coreR, _cG = v.coreG, _cB = v.coreB;
                    if (this._hasConicGrad) {
                        if (ji > 0.01) {
                            _ringGlowGrad = ctx.createConicGradient(-Math.PI / 2, cx, adjustedY);
                            _ringGlowGrad.addColorStop(0,'rgba(0,0,0,0.00)');_ringGlowGrad.addColorStop(0.12,'rgba(0,0,0,0.00)');_ringGlowGrad.addColorStop(0.25,'rgba('+_gR+','+_gG+','+_gB+',0.08)');_ringGlowGrad.addColorStop(0.38,'rgba('+_gR+','+_gG+','+_gB+',0.45)');_ringGlowGrad.addColorStop(0.50,'rgba('+_gR+','+_gG+','+_gB+',0.92)');_ringGlowGrad.addColorStop(0.62,'rgba('+_gR+','+_gG+','+_gB+',0.45)');_ringGlowGrad.addColorStop(0.75,'rgba('+_gR+','+_gG+','+_gB+',0.08)');_ringGlowGrad.addColorStop(0.88,'rgba(0,0,0,0.00)');_ringGlowGrad.addColorStop(1,'rgba(0,0,0,0.00)');
                        }
                        _ringCoreGrad = ctx.createConicGradient(-Math.PI / 2, cx, adjustedY);
                        _ringCoreGrad.addColorStop(0,'rgba('+_cR+','+_cG+','+_cB+',0.00)');_ringCoreGrad.addColorStop(0.12,'rgba('+_cR+','+_cG+','+_cB+',0.00)');_ringCoreGrad.addColorStop(0.25,'rgba('+_cR+','+_cG+','+_cB+',0.08)');_ringCoreGrad.addColorStop(0.38,'rgba('+_cR+','+_cG+','+_cB+',0.45)');_ringCoreGrad.addColorStop(0.50,'rgba('+_cR+','+_cG+','+_cB+',0.92)');_ringCoreGrad.addColorStop(0.62,'rgba('+_cR+','+_cG+','+_cB+',0.45)');_ringCoreGrad.addColorStop(0.75,'rgba('+_cR+','+_cG+','+_cB+',0.08)');_ringCoreGrad.addColorStop(0.88,'rgba('+_cR+','+_cG+','+_cB+',0.00)');_ringCoreGrad.addColorStop(1,'rgba('+_cR+','+_cG+','+_cB+',0.00)');
                    }
                    const frags = ring.frags;
                    for (let f = 0; f < frags.length; f++) {
                        const frag = frags[f];
                        const sa = this.globalRot + frag.offset;
                        const ea = sa + frag.len;
                        const jAmt = Math.sin(timeBase60 + i * 7 + f) * 3 * ji;
                        var d = dBuf[dLen]; if (!d) { d = {}; dBuf[dLen] = d; }
                        d.rx=rx;d.ry=ry;d.lw=lw;d.sa=sa;d.ea=ea;d.op=ring.opacity;d.ay=adjustedY;d.jAmt=jAmt;d.glowGrad=_ringGlowGrad;d.coreGrad=_ringCoreGrad;
                        dLen++;
                    }
                }
                if (ji > 0.01 && dLen > 0) {
                    ctx.globalCompositeOperation = 'lighter';
                    for (var di = 0; di < dLen; di++) {
                        var d = dBuf[di]; var jcx = cx + d.jAmt; var jay = d.ay + d.jAmt * 0.3;
                        ctx.lineWidth = d.lw * 6; ctx.globalAlpha = d.op * 0.35 * ji;
                        ctx.strokeStyle = d.glowGrad || 'rgba(214,228,235,0.25)';
                        ctx.beginPath(); ctx.ellipse(jcx, jay, d.rx, d.ry, 0, d.sa, d.ea); ctx.stroke();
                        ctx.lineWidth = d.lw * 1.5; ctx.globalAlpha = d.op * 0.6 * ji;
                        ctx.strokeStyle = d.glowGrad || 'rgba(214,228,235,0.35)';
                        ctx.beginPath(); ctx.ellipse(jcx, jay, d.rx, d.ry, 0, d.sa, d.ea); ctx.stroke();
                    }
                }
                if (dLen > 0) {
                    ctx.globalCompositeOperation = 'source-over';
                    for (var di = 0; di < dLen; di++) {
                        var d = dBuf[di];
                        ctx.lineWidth = d.lw * 0.5; ctx.globalAlpha = d.op;
                        ctx.strokeStyle = d.coreGrad || 'rgba(109,191,214,0.45)';
                        ctx.beginPath(); ctx.ellipse(cx, d.ay, d.rx, d.ry, 0, d.sa, d.ea); ctx.stroke();
                    }
                }
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
                return visibleCount;
            }
        }

        // ============================================
        // INIT + TICKER (Metoda C — formProgress driven)
        // ============================================
        const tunnel = new Tunnel($id('kinetic-tunnel-canvas'));
        let tunnelProgress = 0;
        let tunnelVelocity = 0;

        // Stałe timingu tunelu (precomputed — eliminuje dzielenia/Math.max per tick)
        var fpStart = FP_TUNNEL_START;
        var fpShrinkS = FP_SHRINK_START;
        var fpShrinkE = FP_SHRINK_END;
        var _invFpRange = 1 / (1.0 - fpStart);       // v139: 1/1.0
        var _invShrRange = 1 / (fpShrinkE - fpShrinkS); // 1/0.292

        var _tunnelHidden = false; // P1: phase-aware display:none
        const _tickTunnel = function() {
            if (_s._killed) return;
            if (!_sectionTickOk) return;
            if (document.hidden) return;
            // Czytaj formProgress z particle IIFE
            const fp = _s.particleQmark?.state?.formProgress || 0;

            // P1: Phase-aware — hide tunnel when form complete, show on scroll back
            if (fp >= 1 && !_tunnelHidden) {
                tunnel.ctx.canvas.style.display = 'none';
                _tunnelHidden = true;
                return;
            }
            if (fp < 1 && _tunnelHidden) {
                tunnel.ctx.canvas.style.display = '';
                _tunnelHidden = false;
            }
            if (_tunnelHidden) return;

            // Tunnel progress (mul instead of div)
            tunnelProgress = (fp - fpStart) * _invFpRange;
            if (tunnelProgress < 0) tunnelProgress = 0;
            else if (tunnelProgress > 1) tunnelProgress = 1;

            // Shrink
            if (fp <= fpShrinkS) {
                tunnel.shrink = 1.0;
            } else if (fp >= fpShrinkE) {
                tunnel.shrink = 0.5;
            } else {
                tunnel.shrink = 1.0 - 0.5 * ((fp - fpShrinkS) * _invShrRange);
            }

            // Velocity: scroll impulse + decay for smooth inertia
            var prevProgress = tunnel._prevProgress || 0;
            var currentProgress = _s.pinnedTl ? _s.pinnedTl.progress() : 0;
            var scrollImpulse = (currentProgress - prevProgress) * 60;
            tunnel._prevProgress = currentProgress;

            tunnelVelocity = tunnelVelocity * 0.82 + scrollImpulse;

            tunnel.render(tunnelProgress, tunnelVelocity);
        };
        gsap.ticker.add(_tickTunnel);
        tickerFns.push(_tickTunnel);

    })();

        // MAIN TIMELINE SETUP (formerly initApp)
        // ============================================

            // --- GSAP ---
            
            // Ukrywamy bloki STREFY 1
            gsap.set([$id("kinetic-block-1"), $id("kinetic-block-2"), $id("kinetic-block-3")], { autoAlpha: 0 });
            
            // ============================================
            // FAZA 3.1: Początkowy stan blobów
            // ============================================
            // Bloby startują już duże (scale: 0.7), tylko lekko rosną i pojawiają się
            const _elBlob1 = $id("kinetic-blob1");
            const _elBlob2 = $id("kinetic-blob2");
            const _elBlob3 = $id("kinetic-blob3");
            const _elBlobCarrier = $id("kinetic-blob-carrier");
            gsap.set($$(".blob"), { opacity: 0 });
            gsap.set(_elBlobCarrier, { opacity: 1 });
            
            if (window.innerWidth < 600) {
                gsap.set(_elBlob1, { x: "5vw", y: "5vh", scale: 1.2, rotation: 15 });
                gsap.set(_elBlob2, { xPercent: -50, yPercent: -50, x: "-15vw", y: "-40vh", scale: 1.0, rotation: -10 });
                gsap.set(_elBlob3, { xPercent: -50, yPercent: -50, x: "-9.5vw", y: "-16vh", scale: 0.25, rotation: -30 });
            } else {
                gsap.set(_elBlob1, { x: "5vw", y: "30vh", scale: 0.35, rotation: 29 });
                gsap.set(_elBlob2, { xPercent: -50, yPercent: -50, x: "8vw", y: "8vh", scale: 0.35, rotation: 0 });
                gsap.set(_elBlob3, { xPercent: -50, yPercent: -50, x: "-21vw", y: "0vh", scale: 0.30, rotation: -36 });
            }

            // ============================================
            // BRIDGE: Obliczenia dynamiczne
            // ============================================
            // Całkowita „długość” odcinka kinetic w jednostkach U (musi się zgadzać ze SCROLL_KINETIC).
            // vs bazowe 23U: dłuższy odcinek przed SNAP2 = więcej Blok45 w kadrze zanim wave-wrap na Kinetic.
            const KINETIC_U = 28.0;
            const SCROLL_KINETIC = Math.round((3526 * KINETIC_U) / 23); // zachowaj px/U ≈ jak 3526/23
            /** Po moście I: SNAP2 — im większe, tym później wrap przy narastającym nachodzeniu Blok45. */
            const SNAP2_KINETIC_U = 14.5; // 9.5 → 12.5 → 14.5 */
            
            // ═══════════════════════════════════════════════════════════
            // BRIDGE MULTIPLIER — kontrola tempa pierwszej fazy
            // Zmień tę wartość aby przyspieszyć/zwolnić intro particle/rings
            // 2.5 = szybciej, 3.0 = obecne, 3.5 = wolniej
            // ═══════════════════════════════════════════════════════════
            const BRIDGE_MULTIPLIER = 2.1;
            
            // ── VIEWPORT MEASUREMENT ──────────────────────────────────────
            // svh = small viewport (z paskiem) → pozycje CSS, bridge I
            // lvh = large viewport (bez paska) → stage height, scroll range
            // Fallback: innerHeight + safety margin dla starszych przeglądarek
            const _svhProbe = document.createElement('div');
            _svhProbe.style.cssText = 'position:fixed;top:0;height:100svh;pointer-events:none;visibility:hidden;';
            document.body.appendChild(_svhProbe);
            const _svhRaw = _svhProbe.offsetHeight;
            _svhProbe.style.height = '100lvh';
            const _lvhRaw = _svhProbe.offsetHeight;
            document.body.removeChild(_svhProbe);
            
            // Walidacja: jeśli probe zwrócił 0, browser nie wspiera svh/lvh
            const _supportsViewportUnits = _svhRaw > 0 && _lvhRaw > 0;
            const _fallbackVh = window.visualViewport?.height || window.innerHeight;
            
            const svh = _supportsViewportUnits ? _svhRaw : _fallbackVh;
            const lvh = _supportsViewportUnits ? _lvhRaw : _fallbackVh;
            
            // ── SVH CSS FALLBACK ──────────────────────────────────────
            // iOS Safari <15.4: svh nie istnieje → CSS fallback vh = lvh (za duży o ~28px)
            // Korygujemy inline style używając zmierzonego visualViewport.height ≈ svh
            if (!_supportsViewportUnits && window.innerWidth < 600) {
                var _svhVal = _fallbackVh;
                var _blockPos = [
                    { id: 'kinetic-block-1', px: 115, pct: 0.178 },
                    { id: 'kinetic-block-2', px: 185, pct: 0.262 },
                    { id: 'kinetic-block-3', px: 145, pct: 0.211 }
                ];
                for (var _bi = 0; _bi < _blockPos.length; _bi++) {
                    var _bEl = $id(_blockPos[_bi].id);
                    if (_bEl) {
                        _bEl.style.top = (_blockPos[_bi].px + _blockPos[_bi].pct * _svhVal) + 'px';
                    }
                }
            }
            
            // ── SCROLL RANGE ──────────────────────────────────────────────
            // Formuła: max_scroll = (stage_height + scroll_range) - viewport_when_scrolling
            // Wymóg: max_scroll >= scroll_range → stage_height >= viewport_when_scrolling
            // Gwarancja: stage CSS = 100lvh >= lvh (największy viewport)
            const vh = svh;
            const I_BASE = KINETIC_U * (vh / SCROLL_KINETIC);
            const I = I_BASE * BRIDGE_MULTIPLIER;
            
            _s.bridgeI = I;
            
            
            // ============================================
            // SNAP GATE: bridge = 1:1 scrub, kinetic = directional
            // ============================================
            // Po SNAP3 (Gemius / koniec narracji): dodatkowy dystans scrolla zanim pin puści — UX / dwell
            const OVERSHOOT_U = (_s._overshootOverride !== undefined) ? _s._overshootOverride : 2.5;
            const pxPerU = SCROLL_KINETIC / KINETIC_U; // 153.3
            const SCROLL_OVERSHOOT = OVERSHOOT_U * pxPerU;
            
            // v139: DELTA = przesunięcie startu tekstu z I*0.55 na I
            // Tekst pojawia się gdy "!" gotowy (koniec bridge), nie w trakcie.
            // "!" stoi, tekst i bloby wchodzą w tym samym tempie co teraz.
            // Cała sekwencja po SNAP1 przesuwa się o DELTA — zero zmian w proporcjach.
            const DELTA = I * 0.22; // shift = I - b1Start = I - I*0.78
            const SCROLL_DELTA = DELTA * pxPerU;
            _s.DELTA = DELTA; // shared with particle IIFE
            const TOTAL_U = I + KINETIC_U + DELTA + OVERSHOOT_U;
            
            // ═══════════════════════════════════════════════════════════
            // OBLICZENIA SNAP
            // ═══════════════════════════════════════════════════════════
            
            const b1 = $("#kinetic-block-1");
            
            // b1Start: tekst startuje gdy "!" WYGLĄDA na gotowy (~78% bridge, fp≈0.78)
            // Nie na 100% bridge — ostatnie 22% to niewidoczne dociąganie cząstek
            const b1Start = I * 0.70;
            
            // B1_DRAW i STAGGER — BEZ ZMIAN, identyczne tempo formowania
            const B1_DRAW_DURATION = 3;
            const B1_STAGGER = 0.5;
            const B1_LINE_COUNT = 4;
            const B1_FULL_DRAW_U = b1Start + B1_DRAW_DURATION + B1_STAGGER * (B1_LINE_COUNT - 1);
            
            // SNAP1 = I + 4.5 (wizualnie identyczny z obecnym)
            const SNAP1_U = B1_FULL_DRAW_U;
            const SNAP2_U = I + SNAP2_KINETIC_U + DELTA;
            const SNAP3_U = I + KINETIC_U + DELTA;
            
            // SNAP GATE VALUES
            const KINETIC_SNAPS = [SNAP1_U, SNAP2_U, SNAP3_U].map(u => u / TOTAL_U);
            const BRIDGE_END_PROGRESS = SNAP1_U / TOTAL_U;
            // GRAB_START = first text pixel (b1AnimStart = b1Start - 60% early offset)
            const _grabExtra = (SNAP1_U - b1Start) * 0.6;
            const GRAB_START = (b1Start - _grabExtra) / TOTAL_U;
            const HYS = Math.min(0.03, BRIDGE_END_PROGRESS * 0.25);
            FREEZE_ON = KINETIC_SNAPS[2] - 0.001;
            FREEZE_OFF = KINETIC_SNAPS[2] - 0.005;
            
            // Milestones export — wrapper reads these to translate into master coordinates
            _s.milestones = {
                I: I,
                DELTA: DELTA,
                b1Start: b1Start,
                SNAP1_U: SNAP1_U,
                SNAP2_U: SNAP2_U,
                SNAP3_U: SNAP3_U,
                TOTAL_U: TOTAL_U,
                KINETIC_SNAPS: KINETIC_SNAPS,
                GRAB_START: GRAB_START,
                BRIDGE_END_PROGRESS: BRIDGE_END_PROGRESS
            };

            // ══════════════════════════════════════════════════════════════
            // STATE MACHINE v2 — narracyjny kontroler snapa
            // Zastępuje: ScrollTrigger snap:{}, snapDir, gesture tracking
            // Jeden właściciel scroll: lenis.scrollTo() — zero konfliktu
            // ══════════════════════════════════════════════════════════════

            // Stan narracyjny zadeklarowany w STATE MACHINE v3 poniżej
            // (var _sm zdefiniowane po stworzeniu pinnedTl)

            const pinnedTl = gsap.timeline({
                scrollTrigger: {
                    trigger: container,
                    start: "top top",
                    // Dynamic endPx: re-evaluated on every ScrollTrigger.refresh() (auto on resize)
                    // Fixes: resize viewport → stale endPx → over-scroll past progress 1.0
                    end: () => {
                        return '+=' + (svh * BRIDGE_MULTIPLIER + SCROLL_KINETIC + SCROLL_DELTA + SCROLL_OVERSHOOT);
                    },
                    id: "KINETIC_PIN",
                    scrub: true,              // 1-frame latency; Lenis IS the smoothing layer
                    pin: true,
                    anticipatePin: 0,         // Lenis eliminates pin flash
                    invalidateOnRefresh: true,
                    preventOverlaps: true,

                    // P1: Auto-pause — stop canvas work when section off-screen
                    onEnter: function() { _s.activate(); },
                    onEnterBack: function() { _s.activate(); },
                    onLeave: function() { _s.hibernate(); },
                    onLeaveBack: function() { _s.hibernate(); },

                    // snap: {} USUNIĘTE — zastąpione przez state machine + lenis.scrollTo()
                    // ScrollTrigger pełni tylko rolę: pin + scrub (czyta scroll, nie pisze)

                    onUpdate: function(self) {
                        if (!freezeFinal && self.progress >= FREEZE_ON) {
                            freezeFinal = true;
                        } else if (freezeFinal && self.progress <= FREEZE_OFF) {
                            freezeFinal = false;
                        }
                        adaptiveDPR.lockForScroll();
                        // UWAGA: nie clampuj scrolla do snap3 przy freezeFinal — przy działającym
                        // Lenis (scrollRuntime.scrollTo) blokuje dojazd do st.end i wyjście z pinu.
                        // Overshoot przy formProgress obsługuje debounce w ticku cząsteczek (wyżej).
                        if (_sm.state === 'idle' || _sm.state === 'cooldown') {
                            _reconcileFromScroll();
                        }
                    },

                    onRefresh: function() {
                        _geoCache._valid = false;
                        _sm.state = 'idle';
                        _sm.pendingIndex = null;
                        requestAnimationFrame(function() {
                            var g = _getSnapGeometry();
                            if (!g) return;
                            var scroll = getScroll();
                            if (scroll < g.grabStart - _DISARM_BUF) {
                                _sm.zone = 'bridge'; _sm.committedIndex = -1;
                            } else if (scroll >= g.snaps[2] - 30) {
                                _sm.zone = 'kinetic'; _sm.committedIndex = 2;
                            } else if (scroll >= g.snaps[1] - 30) {
                                _sm.zone = 'kinetic'; _sm.committedIndex = 1;
                            } else if (scroll >= g.snaps[0] - 30) {
                                _sm.zone = 'kinetic'; _sm.committedIndex = 0;
                            } else {
                                _sm.zone = scroll >= g.grabStart + _ARM_BUF ? 'kinetic' : 'bridge';
                                _sm.committedIndex = -1;
                            }
                        });
                    }
                }
            });
            
            // Eksport do window dla zewnętrznych komponentów (Particle, Tunnel, Cylinder)
            _s.pinnedTl = pinnedTl;
            gsapInstances.push(pinnedTl); // PRZYWRÓCONE — scrub filter w pause/resume chroni
            // musi być zarządzana WYŁĄCZNIE przez ScrollTrigger
            

            // ══════════════════════════════════════════════════════════════
            // STATE MACHINE v3 — HARD BEATS ONLY
            // Spec: Bridge=wolny, Kinetic=hard beats, End=hard stop
            // Jeden wykonawca: lenis.scrollTo(lock:true)
            // Dwa detektory intencji: Observer + snap1 magnet
            // Zero idle snap, zero nearest snap, zero autopilotów
            // ══════════════════════════════════════════════════════════════

            var _sm = {
                zone:           'bridge',   // 'bridge' | 'kinetic'
                committedIndex: -1,         // -1=pre/bridge, 0=SNAP1, 1=SNAP2, 2=SNAP3
                pendingIndex:   null,
                state:          'idle'      // 'idle' | 'snapping' | 'cooldown'
            };

            var _ARM_BUF    = IS_TOUCH ? 74 : 50;   // px po grabStart → wejście do Kinetic
            var _DISARM_BUF = IS_TOUCH ? 48 : 32;   // px przed grabStart → wyjście do bridge
            var _COOLDOWN_MS = 50;  // lock:true już chroni podczas lotu; cooldown tylko na lądowanie
            var _cooldownTimer = null;
            var _kineticObserver = null;

            // ── GEOMETRIA ──────────────────────────────────────────────────
            // Oblicza absolutne px snap pointów z ST.start/end
            var _geoCache = { stStart: 0, stEnd: 0, total: 0, grabStart: 0, snaps: [0, 0, 0], _valid: false };
            var _getSnapGeometry = function() {
                if (_geoCache._valid) return _geoCache;
                var st = pinnedTl.scrollTrigger || _s._externalScrollTrigger;
                if (!st || st.start == null || st.end == null) return null;
                var total = st.end - st.start;
                _geoCache.stStart = st.start;
                _geoCache.stEnd = st.end;
                _geoCache.total = total;
                _geoCache.grabStart = st.start + GRAB_START * total;
                for (var _gi = 0; _gi < KINETIC_SNAPS.length; _gi++) {
                    _geoCache.snaps[_gi] = st.start + KINETIC_SNAPS[_gi] * total;
                }
                _geoCache._valid = true;
                return _geoCache;
            };
            _s._geoCache_invalidate = function() { _geoCache._valid = false; };

            // ── RECONCILE — tylko strażnik strefy ─────────────────────────
            // Ustawia zone i robi twardy exit do bridge.
            // NIGDY nie ustawia committedIndex 0/1/2 podczas normalnego scrollu.
            // 0/1/2 tylko przez: snap onComplete, snap1 magnet onComplete, onRefresh.
            var _reconcileFromScroll = function() {
                var g = _getSnapGeometry();
                if (!g) return;
                var scroll = getScroll();

                // Twardy exit do bridge
                if (scroll < g.grabStart - _DISARM_BUF) {
                    _sm.zone = 'bridge';
                    _sm.committedIndex = -1;
                    _sm.pendingIndex = null;
                    if (_sm.state !== 'snapping') _sm.state = 'idle';
                    return;
                }

                // Pas przejściowy — nic nie zmieniaj
                if (scroll < g.grabStart + _ARM_BUF) return;

                // Kinetic zone — tylko ustaw zone
                _sm.zone = 'kinetic';

                // Za daleko za sekcją — reset do bridge
                if (scroll > g.stEnd + _DISARM_BUF) {
                    _sm.zone = 'bridge';
                    _sm.committedIndex = -1;
                    _sm.pendingIndex = null;
                    if (_sm.state !== 'snapping') _sm.state = 'idle';
                    return;
                }

                // Pre-SNAP1: trzymaj -1 dopóki nie dojechał przez magnet/handleIntent
                // Gdy committedIndex=0 (był na SNAP1) ten blok jest pomijany —
                // NIE degraduje 0→-1 przy wolnym scrollu wstecz z SNAP1
                if (_sm.state !== 'snapping' && _sm.committedIndex < 0) {
                    if (scroll < g.snaps[0]) {
                        _sm.committedIndex = -1;
                        _sm.pendingIndex = null;
                    }
                }
            };

            // ── HANDLE INTENT — jedyny właściciel nawigacji ───────────────
            // Jeden gest = jedna decyzja = jeden lenis.scrollTo
            var _handleIntent = function(dir) {
                clearTimeout(_idleSnapTimer);   // anuluj ewentualny pending idle

                if (mobileResizeLock) return;
                // freezeFinal: blokuje forward (hard stop na końcu sekcji)
                // NIE blokuje backward — z SNAP3 można wrócić do SNAP2
                if (freezeFinal && dir > 0) return;
                if (_sm.state === 'snapping') return;
                if (_sm.state === 'cooldown') return;

                var g = _getSnapGeometry();
                if (!g) return;

                var scroll = getScroll();

                // Poniżej Kinetic — zignoruj
                if (scroll < g.grabStart + _ARM_BUF) return;

                // Powyżej Kinetic — zignoruj (chroni przed snap z Block 4)
                if (scroll > g.stEnd + _ARM_BUF) return;

                // Upewnij się że zone jest uzbrojone
                if (_sm.zone !== 'kinetic') _sm.zone = 'kinetic';

                var maxIdx = KINETIC_SNAPS.length - 1;
                var targetIdx;

                if (dir > 0) {
                    // FORWARD: z pre-snap (-1) → SNAP1, inaczej +1
                    targetIdx = _sm.committedIndex < 0
                        ? 0
                        : Math.min(_sm.committedIndex + 1, maxIdx);

                    // GUARD: user cofa się z SNAP1 do bridge (scroll między snap1 a bridge)
                    // Observer łapie mikrogesty forward podczas tego scrollu → blokuj
                    if (_sm.committedIndex === 0 && scroll < g.snaps[0] - 30) return;

                } else {
                    // BACKWARD:
                    if (_sm.committedIndex < 0) return;
                    // SNAP1 → aktywny snap do bridge (poza strefę uzbrojenia)
                    // return powodował 738px ręcznego scrollu + mikrogesty forward = chaos
                    if (_sm.committedIndex === 0) {
                        targetIdx = -1;
                    } else {
                        targetIdx = _sm.committedIndex - 1;
                    }
                }

                var targetPx = targetIdx < 0
                    ? g.grabStart - _ARM_BUF - 10   // 686px — poza magnetStart=844, poniżej bridge exit=722
                    : g.snaps[targetIdx];

                // Już jesteśmy na tym snapie
                if (Math.abs(scroll - targetPx) < 15) return;

                // WYKONAJ — jedyny lenis.scrollTo w całym kontrolerze
                _sm.state = 'snapping';
                _sm.pendingIndex = targetIdx;

                var _snapDuration = targetIdx === 2 || (_sm.committedIndex === 2 && targetIdx === 1)
                    ? 2.50
                    : (_sm.committedIndex === 1 && targetIdx === 0)
                        ? gsap.utils.clamp(0.40, 1.05, Math.abs(scroll - targetPx) / 776)
                        : gsap.utils.clamp(0.80, 2.10, Math.abs(scroll - targetPx) / 776);

                scrollTo(targetPx, {
                    duration: _snapDuration,
                    easing: (targetIdx === 2)
                        ? function(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
                        : (_sm.committedIndex === 2 && targetIdx === 1)
                            ? function(t) {
                                // 2-PHASE: 50% time=95% scroll (scena znika), 50% time=5% scroll (cząsteczki ?)
                                if (t < 0.50) { var p = t / 0.50; return (1 - (1-p)*(1-p)) * 0.95; }
                                var p = (t - 0.50) / 0.50; return 0.95 + p * 0.05;
                              }
                            : (_sm.committedIndex === 1 && targetIdx === 0)
                                ? function(t) { return t * t * t; }
                                : function(t) { return 1 - Math.pow(1 - t, 3); },
                    lock: true,
                    onComplete: function() {
                        _sm.committedIndex = targetIdx < 0 ? -1 : targetIdx;
                        _sm.pendingIndex = null;
                        _sm.zone = targetIdx < 0 ? 'bridge' : 'kinetic';
                        _sm.state = 'cooldown';
                        clearTimeout(_cooldownTimer);
                        _cooldownTimer = setTimeout(function() {
                            _sm.state = 'idle';
                        }, _COOLDOWN_MS);
                        timerIds.push(_cooldownTimer);
                    }
                });
            };

            // ── OBSERVER — detektor intencji ──────────────────────────────
            // Czyta wheel/touch i deleguje do handleIntent.
            // Nie podejmuje własnych decyzji narracyjnych.
            _kineticObserver = ScrollTrigger.observe({
                target:    window,
                type:      'wheel,touch',
                tolerance: IS_TOUCH ? 8 : 10,
                onDown: function(self) { var _t = self.event && self.event.type; _handleIntent(_t && _t.indexOf("touch") === 0 ? -1 : 1); },
                onUp: function(self) { var _t = self.event && self.event.type; _handleIntent(_t && _t.indexOf("touch") === 0 ? 1 : -1); },
                preventDefault: false
            });
            cleanups.push(function() {
                if (_kineticObserver) _kineticObserver.kill();
            });

            // ── SNAP1 MAGNET — jedyna rola: wejście pre-SNAP1 → SNAP1 ─────
            // Odpala się gdy scroll wchodzi w strefę przed SNAP1 z prędkością do przodu.
            // Po committed SNAP1 (committedIndex >= 0) milczy na zawsze.
            var _snap1MagnetFired = false;
            var _idleSnapTimer = null; // potrzebny tylko dla clearTimeout w handleIntent

            var _lenisSnap1Handler = function(e) {
                if (_sm.state === 'snapping') return;
                if (_sm.state === 'cooldown') return;
                if (mobileResizeLock) return;
                if (freezeFinal) return;
                if (_sm.committedIndex >= 0) return;  // już committed — magnet milczy

                // Tylko ruch do przodu, guard na SPA scroll restore velocity spike
                if (e.velocity <= 0 || e.velocity > 5) {
                    _snap1MagnetFired = false;
                    return;
                }
                if (_snap1MagnetFired) return;

                var g = _getSnapGeometry();
                if (!g) return;

                var scroll = e.scroll;
                var snap1Px = g.snaps[0];
                var magnetStart = g.grabStart + _ARM_BUF;

                if (scroll > snap1Px + 15) { _snap1MagnetFired = false; return; }

                if (scroll >= magnetStart && scroll < snap1Px - 15) {
                    _snap1MagnetFired = true;
                    _sm.state = 'snapping';
                    _sm.pendingIndex = 0;

                    scrollTo(snap1Px, {
                        duration: gsap.utils.clamp(1.20, 2.80,
                            Math.abs(scroll - snap1Px) / 600),
                        easing: function(t) { return 1 - Math.pow(1 - t, 3); },
                        lock: true,
                        onComplete: function() {
                            _sm.committedIndex = 0;
                            _sm.pendingIndex = null;
                            _sm.zone = 'kinetic';
                            _sm.state = 'cooldown';
                            clearTimeout(_cooldownTimer);
                            _cooldownTimer = setTimeout(function() {
                                _sm.state = 'idle';
                            }, _COOLDOWN_MS);
                            timerIds.push(_cooldownTimer);
                        }
                    });
                }
            };

            // scrollOff moved to pause(), scrollOn to resume() — ENT-LC-03 fix

            // Init: odczytaj stan z aktualnej pozycji
            requestAnimationFrame(function() {
                _reconcileFromScroll();
            });
            
            // b1 już zdefiniowane wcześniej (przed pinnedTl, potrzebne do SNAP1_U)
            const b1Lines = b1?.querySelectorAll(".line:not(.bold-line)") ?? [];
            const b1Bold = b1?.querySelectorAll(".line.bold-line") ?? [];
            const b2 = $("#kinetic-block-2");
            const b3 = $("#kinetic-block-3");
            const b3Header = b3?.querySelector(".small-header");
            
            // Wybierz odpowiednią wersję block-3 (desktop lub mobile)
            // Nie polegamy na window.innerWidth — na mobile może dać inną wartość niż CSS media query
            // Zamiast tego sprawdzamy który kontener CSS faktycznie renderuje
            const _mobC = b3?.querySelector(".block-3-mobile");
            const _dskC = b3?.querySelector(".block-3-desktop");
            const isMobileB3 = _mobC && window.getComputedStyle(_mobC).display !== 'none';
            const b3Container = isMobileB3 ? _mobC : _dskC;
            const b3Lines = b3Container?.querySelectorAll(".line:not(.bold-line)") ?? [];
            const b3Bold = b3Container?.querySelector(".line.bold-line");
            
            // Palety kolorów dla blobów (z oryginału)
            const palette1 = { 
                bg: "hsl(210, 30%, 94%)", 
                b1: "hsl(200, 35%, 88%)", 
                b2: "hsl(240, 25%, 90%)", 
                b3: "hsl(180, 30%, 92%)" 
            };
            const palette2 = { 
                bg: "hsl(28, 55%, 82%)", 
                b1: "hsl(40, 20%, 97%)", 
                b2: "hsl(50, 18%, 97%)", 
                b3: "hsl(15, 18%, 97%)" 
            };
            const palette3 = { 
                bg: "hsl(270, 20%, 94%)", 
                b1: "hsl(320, 25%, 90%)", 
                b2: "hsl(260, 30%, 91%)", 
                b3: "hsl(290, 20%, 89%)" 
            };

            // --- SEKWENCJA STREFY 1 ---
            
            // BRIDGE SPACER: U:0 → U:I
            // Rezerwuje bridge zone w timeline (scrub potrzebuje ciągłości od 0)
            pinnedTl.to({}, { duration: I }, 0);
            pinnedTl.to({}, { duration: OVERSHOOT_U }, SNAP3_U);
            
            // ============================================
            // LABELS dla snap - kluczowe momenty narracji
            // ============================================
            pinnedTl.addLabel("start", I);
            pinnedTl.addLabel("block1", SNAP1_U);
            pinnedTl.addLabel("block2", 9.0 + I + DELTA);
            pinnedTl.addLabel("block3", 27.0 + I + DELTA);
            pinnedTl.addLabel("end", 28.0 + I + DELTA);
            
            // BLOCK 1 — tekst startuje na I, zero early offset
            // Text starts 60% earlier than b1Start — slower formation, more time to read
            const _b1Extra = (SNAP1_U - b1Start) * 0.6; // 2.7U earlier
            const b1AnimStart = b1Start - _b1Extra;
            animateBlock1_ColorWave(pinnedTl, b1, b1Lines, b1Bold, b1AnimStart, SNAP1_U - b1AnimStart);
            
            // ═══════════════════════════════════════════════════════════
            // ZMIANA D: CYLINDER WRAP — full implementation
            // CHAR_CORRECTIONS, S5 opacity/color, two-tween per char
            // ═══════════════════════════════════════════════════════════
            
            var b1AllLines = b1.querySelectorAll('.line');
            
            // ── CYLINDER CONFIG — matched to RIGHT reference screenshot ──
            var CYLINDER = {
                maxRotY: 50,    // visible 3D, not extreme
                radius: 170,
                depthOffset: 0.2
            };
            
            var ROTATE_START_U = I + 3.5 + DELTA;
            var _lineStagger = 0.5;
            
            // SYNCED wrap: overlaps with forward push, all lines end at SNAP2.
            // SNAP2_KINETIC_U (14.5 vs bazowe 9.5) = więcej scrollu, więcej Blok45 w kadrze zanim wrap.
            // Twardy limit: WRAP_START ≤ SNAP2−1.85 (ostatnia linia + min. czas cylindra).
            var _wrapStaggerSpan = 3 * _lineStagger;
            var _wrapFloorDur = 0.35;
            var WRAP_START_U = Math.min(
              SNAP1_U + 14.5,
              SNAP2_U - _wrapStaggerSpan - _wrapFloorDur,
            );
            var WRAP_DUR_BASE = Math.max(
              _wrapFloorDur,
              SNAP2_U - (WRAP_START_U + _wrapStaggerSpan),
            );
            var _wrapEndU = SNAP2_U;
            // Koniec wrapu = moment drop/ghost (≈ SNAP2 − 1.5U); używane też do startu zaniku cienia.
            var _b1DropTriggerU = WRAP_START_U + WRAP_DUR_BASE;
            
            // ── Temporarily show b1 for geometry measurement ──
            var _b1WasHidden = (b1.style.visibility === 'hidden' || getComputedStyle(b1).visibility === 'hidden');
            if (_b1WasHidden) {
                b1.style.visibility = 'visible';
                b1.style.opacity = '1';
            }
            b1.getBoundingClientRect();
            
            // ── Measure geometry (pixel offsets from line center) ──
            var _b1LineData = [];
            var _b1MaxOffset = 0;
            
            b1AllLines.forEach(function(line) {
                var chars = line.querySelectorAll('.anim-char');
                if (chars.length === 0) return;
                
                var lineRect = line.getBoundingClientRect();
                var lineCenterX = lineRect.left + lineRect.width / 2;
                
                var charData = [];
                var lineMaxOffset = 0;
                chars.forEach(function(ch) {
                    var chRect = ch.getBoundingClientRect();
                    var charCenterX = chRect.left + chRect.width / 2;
                    var pxOffset = charCenterX - lineCenterX;
                    var absPxOffset = Math.abs(pxOffset);
                    if (absPxOffset > _b1MaxOffset) _b1MaxOffset = absPxOffset;
                    if (absPxOffset > lineMaxOffset) lineMaxOffset = absPxOffset;
                    charData.push({ el: ch, pxOffset: pxOffset, absPxOffset: absPxOffset });
                });
                
                _b1LineData.push({ el: line, chars: charData, lineMaxOffset: lineMaxOffset });
            });
            
            // Normalize: GLOBAL (geometry) + PER-LINE (color/opacity)
            _b1LineData.forEach(function(ld) {
                ld.chars.forEach(function(cd) {
                    cd.norm = _b1MaxOffset > 0 ? cd.pxOffset / _b1MaxOffset : 0;
                    cd.absNorm = _b1MaxOffset > 0 ? cd.absPxOffset / _b1MaxOffset : 0;
                    cd.absNormLine = ld.lineMaxOffset > 0 ? cd.absPxOffset / ld.lineMaxOffset : 0;
                });
            });
            
            // ── Restore hidden state ──
            if (_b1WasHidden) {
                b1.style.visibility = '';
                b1.style.opacity = '';
            }
            
            // ── Cylinder transform function ──
            function _cylTransform(absNorm, signedNorm) {
                var rotY = signedNorm * CYLINDER.maxRotY;
                var depth = Math.cos(absNorm * Math.PI * 0.48) * CYLINDER.radius - CYLINDER.radius * CYLINDER.depthOffset;
                var lateralShift = Math.sin(signedNorm * Math.PI * 0.48) * 10;
                var plateauEnd = 0.35;
                var t = Math.max(0, (absNorm - plateauEnd) / (1 - plateauEnd));
                var opacity = 0.05 + Math.pow(t, 2.2) * 0.95;
                var scale = 1 + (1 - absNorm) * 0.05;
                return { rotY: rotY, depth: depth, lateralShift: lateralShift, opacity: opacity, scale: scale };
            }
            
            // ── Phase A: Forward push PER-LINE ──
            var _pushDur = ROTATE_START_U - SNAP1_U;
            b1AllLines.forEach(function(line) {
                pinnedTl.to(line, {
                    z: 80,
                    scale: 1.03, // v140: was 1.06 — halved scale increase
                    duration: _pushDur,
                    ease: "power1.in"
                }, SNAP1_U);
            });
            
            // ── will-change at wrap start ──
            pinnedTl.call(function() {
                _b1LineData.forEach(function(ld) {
                    ld.chars.forEach(function(cd) {
                        cd.el.style.willChange = 'transform, opacity';
                    });
                });
            }, null, WRAP_START_U - 0.1);
            
            // ── CHAR_CORRECTIONS — per-char rotY% ──
            var CHAR_CORRECTIONS = {
                "L0C0":{rotYPct:79},"L0C1":{rotYPct:92},"L0C10":{rotYPct:85},"L0C11":{rotYPct:76},
                "L1C0":{rotYPct:51},"L1C1":{rotYPct:56},"L1C2":{rotYPct:61},"L1C3":{rotYPct:66},
                "L1C4":{rotYPct:71},"L1C5":{rotYPct:80},
                "L1C15":{rotYPct:91},"L1C16":{rotYPct:77},"L1C17":{rotYPct:68},"L1C18":{rotYPct:62},"L1C19":{rotYPct:54},"L1C20":{rotYPct:50},
                "L2C0":{rotYPct:51},"L2C1":{rotYPct:56},"L2C2":{rotYPct:62},"L2C3":{rotYPct:66},"L2C4":{rotYPct:72},"L2C5":{rotYPct:85},
                "L2C14":{rotYPct:80},"L2C15":{rotYPct:73},"L2C16":{rotYPct:67},"L2C17":{rotYPct:61},"L2C18":{rotYPct:56},"L2C19":{rotYPct:51},
                "L3C0":{rotYPct:57},"L3C1":{rotYPct:63},"L3C2":{rotYPct:67},"L3C3":{rotYPct:75},"L3C4":{rotYPct:87},
                "L3C13":{rotYPct:83},"L3C14":{rotYPct:72},"L3C15":{rotYPct:65},"L3C16":{rotYPct:58},"L3C17":{rotYPct:54}
            };
            
            // ── Per-char cylinder wrap (two tweens: geometry + visual) ──
            _b1LineData.forEach(function(ld, li) {
                var lineStart = WRAP_START_U + li * _lineStagger;
                
                ld.chars.forEach(function(cd, ci) {
                    var tf = _cylTransform(cd.absNorm, cd.norm);
                    
                    // Apply per-char correction
                    var corrKey = 'L' + li + 'C' + ci;
                    var corr = CHAR_CORRECTIONS[corrKey];
                    if (corr && corr.rotYPct !== undefined) {
                        tf.rotY = tf.rotY * corr.rotYPct / 100;
                    }
                    
                    // S5: Opacity + Color — pixel-matched to reference screenshot
                    var plateauRot = 0.29;
                    var tPos = cd.absNormLine <= plateauRot ? 0 : Math.pow((cd.absNormLine - plateauRot) / (1 - plateauRot), 0.5);
                    tf.opacity = 0.63 + 0.22 * tPos; // center=0.63, edge=0.85
                    
                    // Color: center=#6c331a(108,51,26) → edge=#652f12(101,47,18)
                    var cR = Math.round(108 - 7 * tPos);
                    var cG = Math.round(51 - 4 * tPos);
                    var cB = Math.round(26 - 8 * tPos);
                    tf.color = 'rgb(' + cR + ',' + cG + ',' + cB + ')';
                    
                    cd.el.dataset.finalRoty = tf.rotY.toFixed(2);
                    
                    // Geometry tween (rotateY, z, x, scale)
                    pinnedTl.to(cd.el, {
                        rotateY: tf.rotY, z: tf.depth, x: tf.lateralShift,
                        scaleX: tf.scale, scaleY: tf.scale,
                        duration: WRAP_DUR_BASE, ease: "power2.inOut"
                    }, lineStart);
                    
                    // Visual tween (SEPARATE — panel killTweensOf won't break geometry)
                    pinnedTl.to(cd.el, {
                        opacity: tf.opacity, color: tf.color,
                        duration: WRAP_DUR_BASE, ease: "power2.inOut"
                    }, lineStart);
                });
            });
            
            // ── Cleanup: remove will-change ──
            pinnedTl.call(function() {
                _b1LineData.forEach(function(ld) {
                    ld.chars.forEach(function(cd) { cd.el.style.willChange = ''; });
                });
            }, null, _wrapEndU + 0.1);
            
            // Block 2 start — LANDS at SNAP2 (ZMIANA B)
            const block2StartPosition = SNAP2_U - 6.0;
            
            // BLOCK 2 - "W czym problem?" - Cinema Container Blur + Kolorowa Fala
            // Przesunięte o 2 jednostki później (zaczyna się na końcu Block 1)
            pinnedTl.addLabel("block2Start", block2StartPosition);
            
            // Musimy ręcznie ustawić pozycję dla animacji Block 2
            const line = $id('kinetic-problem-line');
            const chars = splitIntoChars(line);
            
            // GLOW TRAIL under "problem?": create SVG AFTER splitIntoChars
            line.style.position = 'relative';
            var _ecSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            _ecSvg.setAttribute('id', 'kinetic-problem-trail');
            _ecSvg.setAttribute('viewBox', '0 0 300 32');
            _ecSvg.setAttribute('preserveAspectRatio', 'none');
            _ecSvg.style.cssText = 'position:absolute;right:-2%;bottom:-12px;width:58%;height:40px;overflow:visible;pointer-events:none;z-index:-1;';
            _ecSvg.innerHTML = '<defs><filter id="kinetic-ptrail-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M0 16 Q75 8, 150 16 T300 14" fill="none" stroke="#f75530" stroke-width="60" stroke-linecap="round" filter="url(#kinetic-ptrail-glow)" opacity="0.5" stroke-dasharray="400" stroke-dashoffset="400"/><path d="M0 16 Q75 8, 150 16 T300 14" fill="none" stroke="#f75530" stroke-width="20" stroke-linecap="round" opacity="0.9" stroke-dasharray="400" stroke-dashoffset="400"/>';
            line.appendChild(_ecSvg);
            
            chars.forEach((char) => {
                char.style.willChange = 'transform, opacity';
                gsap.set(char, { 
                    opacity: 0, 
                    scale: 1.5, 
                    y: 100,  // 2x większy łuk (było 50)
                    color: "#a04646"  // Ciemny czerwony - kolor startowy
                });
            });
            
            const appearDuration = 6.0;
            const colorDuration = 8.0;
            
            // Animacja Block 2 zaczyna się na labelce block2Start
            pinnedTl.set(b2, { visibility: 'visible' }, block2StartPosition - 1.0);
            pinnedTl.set(b2, { opacity: 1 }, "block2Start");
            
            pinnedTl.to(chars, {
                opacity: 1,
                scale: 1,
                y: 0,
                duration: appearDuration,
                ease: "power4.out",
                stagger: { from: "center", amount: 0.8 }
            }, "block2Start");
            
            pinnedTl.to(chars, {
                color: "#141414",
                duration: colorDuration,
                ease: "power2.out",
                stagger: { from: "center", amount: 0.8 }
            }, "block2Start+=2.5");
            
            
            // ═══════════════════════════════════════════════════════════
            // CIEŃ LITER — Ghost clone pod B1 (Strategy A: Invisible Clone)
            // Ghost is always under original text. When letters fall → ghost reveals.
            // Ghost fades to 0 during drop so it's gone before B2 halfway.
            // ═══════════════════════════════════════════════════════════
            var _ghostB1 = b1.cloneNode(true);
            _ghostB1.id = 'kinetic-block-1-ghost';
            // Position: match b1 exactly. No z-index — DOM order (ghost before b1 = under)
            _ghostB1.style.cssText = '';
            _ghostB1.style.position = 'absolute';
            _ghostB1.style.top = '36%';
            _ghostB1.style.transform = 'translateY(-50%)';
            _ghostB1.style.width = '100%';
            _ghostB1.style.left = '0';
            _ghostB1.style.display = 'flex';
            _ghostB1.style.flexDirection = 'column';
            _ghostB1.style.alignItems = 'center';
            _ghostB1.style.textAlign = 'center';
            _ghostB1.style.pointerEvents = 'none';
            _ghostB1.style.opacity = '0';
            _ghostB1.style.visibility = 'hidden';
            _ghostB1.style.perspective = '1000px';
            // Ghost text: colors + opacity calculated at TRIGGER TIME (spatial 2D)
            var _ghostChars = _ghostB1.querySelectorAll('.anim-char');
            _ghostChars.forEach(function(ch) {
                // Clear clone's GSAP state
                ch.style.removeProperty('transform');
                ch.style.removeProperty('visibility');
                ch.style.removeProperty('color');
            });
            // Insert ghost BEFORE b1 in DOM (same parent, lower by DOM order)
            b1.parentNode.insertBefore(_ghostB1, b1);
            cleanups.push(function() { if (_ghostB1.parentNode) _ghostB1.parentNode.removeChild(_ghostB1); });
            // Reset ghost lines — clear GSAP inline state from clone
            var _ghostLines = _ghostB1.querySelectorAll('.line, .bold-line');
            _ghostLines.forEach(function(line) {
                line.style.removeProperty('transform');
                line.style.removeProperty('opacity');
                line.style.removeProperty('visibility');
                line.style.removeProperty('scale');
            });
            
            // Ghost: hidden until trigger (NOT at B1_FULL_DRAW_U)
            pinnedTl.set(_ghostB1, { visibility: 'hidden', opacity: 0 }, 0);

            // ═══════════════════════════════════════════════════════════
            // GRAVITY DROP — Block 1 + Block 2 per-char fall at SNAP2
            // ═══════════════════════════════════════════════════════════
            var _vh = window.innerHeight;
            
            var DROP_DUR = 0.78;
            var DROP_OUTLIERS = new Set([9,14,23,25,33,37,44,45,55]);
            var DROP_ROTATORS_3D = new Set([3,11,12,13,20,24,33,35,43,46,47,48,50,54,55,56,66,68]);
            var DROP_ROTATORS_BOTH = new Set([11,13,20,33,43,46,48,54,55,56,66]);
            var DROP_ROTATIONS = [
                {rX:-71.62,rZ:8.74,n:-0.05},{rX:-83.22,rZ:-1.74,n:0.06},{rX:-99.34,rZ:-15.57,n:0.02},{rX:-7.55,rZ:-5.09,n:0.05},
                {rX:-19.87,rZ:15.67,n:0.01},{rX:39.29,rZ:9.11,n:0.04},{rX:65.35,rZ:15.97,n:0.02},{rX:46.22,rZ:-5.48,n:-0.02},
                {rX:-98.98,rZ:-16.03,n:0.01},{rX:0.14,rZ:-15.92,n:-0.04},{rX:88.37,rZ:-10.56,n:-0.01},{rX:-30.03,rZ:-6.65,n:-0.04},
                {rX:-56.45,rZ:-16.88,n:-0.05},{rX:-78.24,rZ:-20.28,n:-0.01},{rX:63.44,rZ:-10.09,n:-0.05},{rX:7.22,rZ:-2.13,n:-0.01},
                {rX:93.60,rZ:-8.17,n:-0.06},{rX:66.27,rZ:-4.41,n:-0.01},{rX:-31.86,rZ:3.89,n:-0.02},{rX:-53.57,rZ:-10.78,n:-0.03},
                {rX:-18.73,rZ:-11.38,n:0.01},{rX:-59.33,rZ:15.73,n:-0.01},{rX:-58.98,rZ:5.28,n:0.03},{rX:-74.11,rZ:20.70,n:-0.05},
                {rX:34.43,rZ:-16.88,n:-0.06},{rX:-9.29,rZ:-18.03,n:-0.04},{rX:85.28,rZ:0.18,n:-0.01},{rX:-82.71,rZ:20.03,n:-0.03},
                {rX:87.08,rZ:-2.98,n:0.02},{rX:38.60,rZ:-9.57,n:0.01},{rX:69.87,rZ:4.09,n:0.06},{rX:97.52,rZ:-14.93,n:-0.04},
                {rX:-96.07,rZ:-5.81,n:0.02},{rX:-3.22,rZ:17.89,n:0.05},{rX:37.97,rZ:-9.61,n:0.06},{rX:-0.85,rZ:21.50,n:-0.07},
                {rX:-61.63,rZ:-18.96,n:-0.06},{rX:62.41,rZ:-2.85,n:0.00},{rX:17.05,rZ:11.76,n:0.02},{rX:-74.80,rZ:-13.38,n:0.06},
                {rX:-52.91,rZ:-6.73,n:0.03},{rX:44.57,rZ:-4.01,n:0.05},{rX:-5.19,rZ:2.25,n:0.04},{rX:-80.54,rZ:19.53,n:-0.02},
                {rX:-27.64,rZ:-15.76,n:-0.07},{rX:-96.66,rZ:-18.95,n:0.03},{rX:-39.11,rZ:-20.48,n:-0.04},{rX:-6.63,rZ:-17.95,n:0.05},
                {rX:-8.07,rZ:17.69,n:0.03},{rX:-27.30,rZ:7.07,n:0.01},{rX:-78.18,rZ:-14.84,n:0.03},{rX:36.50,rZ:-16.03,n:0.02},
                {rX:96.24,rZ:-22.00,n:-0.05},{rX:-51.18,rZ:-8.88,n:0.04},{rX:95.91,rZ:17.69,n:0.02},{rX:-93.03,rZ:7.34,n:0.06},
                {rX:53.86,rZ:9.83,n:-0.02},{rX:71.72,rZ:12.84,n:-0.07},{rX:87.32,rZ:8.95,n:-0.06},{rX:85.22,rZ:1.67,n:0.07},
                {rX:-20.74,rZ:-8.51,n:-0.02},{rX:33.98,rZ:-20.14,n:-0.03},{rX:53.95,rZ:4.19,n:-0.02},{rX:-25.06,rZ:5.10,n:0.00},
                {rX:33.65,rZ:-8.56,n:0.05},{rX:51.32,rZ:5.15,n:0.00},{rX:-95.93,rZ:-5.52,n:0.02},{rX:-53.06,rZ:2.88,n:-0.02},
                {rX:25.18,rZ:15.77,n:0.02},{rX:-26.35,rZ:-2.12,n:-0.01},{rX:23.34,rZ:14.03,n:0.03}
            ];
            var DROP_BASE_DUR = 1.1;
            var DROP_OUTLIER_DUR = 1.2;
            var DROP_ROTX_MULT = 1.0;
            var DROP_TOTAL_NORM = 2.5;
            
            // ── Helper: build per-char gravity drop ──
            // Container-relative offset — fixes stack harness where section is far from viewport at init
            var _sectionTop = container.getBoundingClientRect().top;
            
            function _buildGravityDrop(blockEl, startU, dropDur) {
                dropDur = dropDur || DROP_DUR;
                var allChars = blockEl.querySelectorAll('.anim-char');
                if (!allChars.length) return;
                var dropChars = [];
                var sumX = 0, sumY = 0;
                allChars.forEach(function(ch) {
                    var r = ch.getBoundingClientRect();
                    sumX += r.left + r.width / 2;
                    sumY += r.top + r.height / 2;
                    dropChars.push({ el: ch, top: r.top - _sectionTop });
                });
                var cx = sumX / dropChars.length;
                var cy = sumY / dropChars.length;
                var maxDist = 0;
                dropChars.forEach(function(dc) {
                    var r = dc.el.getBoundingClientRect();
                    dc.dist = Math.sqrt(Math.pow(r.left + r.width/2 - cx, 2) + Math.pow(r.top + r.height/2 - cy, 2));
                    if (dc.dist > maxDist) maxDist = dc.dist;
                });
                dropChars.forEach(function(dc) {
                    dc.normDist = maxDist > 0 ? dc.dist / maxDist : 0;
                });
                dropChars.forEach(function(dc, i) {
                    var rot = DROP_ROTATIONS[i] || { rX: 0, rZ: 0, n: 0 };
                    var baseDelay = Math.max(0, (dc.normDist + rot.n) * 0.5);
                    var tweenStart = startU + baseDelay * dropDur;
                    var tweenDur = (DROP_BASE_DUR / DROP_TOTAL_NORM) * dropDur;
                    var distToExit = _vh - dc.top + 150;
                    var is3D = DROP_ROTATORS_3D.has(i);
                    var isBoth = DROP_ROTATORS_BOTH.has(i);
                    var targetRX = 0, targetRZ = 0;
                    if (isBoth) { targetRX = rot.rX * DROP_ROTX_MULT; targetRZ = rot.rZ; }
                    else if (is3D) { targetRX = rot.rX * DROP_ROTX_MULT; targetRZ = rot.rZ * 0.3; }
                    else { targetRZ = rot.rZ * 0.5; }
                    pinnedTl.to(dc.el, {
                        y: '+=' + distToExit,
                        rotateX: targetRX,
                        rotateZ: targetRZ,
                        opacity: 0,
                        duration: tweenDur,
                        ease: "circ.in"
                    }, tweenStart);
                });
            }
            
            // ═══ B1 GRAVITY DROP — trigger-to-play (ONLY B1, not B2) ═══
            // Forward: SNAP2 arrival → letters fall real-time
            // Backward: SNAP3→SNAP2 → letters return (reverse) real-time
            var COLLAPSE_THIRD = (17.10 - 14.5) / 3;
            
            var _b1DropTl = gsap.timeline({ paused: true });
            var _b1Dropped = false;
            ;(function() {
                var allChars = b1.querySelectorAll('.anim-char');
                if (!allChars.length) return;
                var dropChars = [];
                var sumX = 0, sumY = 0;
                allChars.forEach(function(ch) {
                    var r = ch.getBoundingClientRect();
                    sumX += r.left + r.width / 2;
                    sumY += r.top + r.height / 2;
                    dropChars.push({ el: ch, top: r.top - _sectionTop });
                });
                var dcx = sumX / dropChars.length;
                var dcy = sumY / dropChars.length;
                var maxDist = 0;
                dropChars.forEach(function(dc) {
                    var r = dc.el.getBoundingClientRect();
                    dc.dist = Math.sqrt(Math.pow(r.left + r.width/2 - dcx, 2) + Math.pow(r.top + r.height/2 - dcy, 2));
                    if (dc.dist > maxDist) maxDist = dc.dist;
                });
                dropChars.forEach(function(dc) { dc.normDist = maxDist > 0 ? dc.dist / maxDist : 0; });
                dropChars.forEach(function(dc, i) {
                    var rot = DROP_ROTATIONS[i] || { rX: 0, rZ: 0, n: 0 };
                    var baseDelay = Math.max(0, (dc.normDist + rot.n) * 0.5);
                    var tweenStart = baseDelay * DROP_DUR;
                    var tweenDur = (DROP_BASE_DUR / DROP_TOTAL_NORM) * DROP_DUR;
                    var distToExit = _vh - dc.top + 150;
                    var is3D = DROP_ROTATORS_3D.has(i);
                    var isBoth = DROP_ROTATORS_BOTH.has(i);
                    var targetRX = 0, targetRZ = 0;
                    if (isBoth) { targetRX = rot.rX * DROP_ROTX_MULT; targetRZ = rot.rZ; }
                    else if (is3D) { targetRX = rot.rX * DROP_ROTX_MULT; targetRZ = rot.rZ * 0.3; }
                    else { targetRZ = rot.rZ * 0.5; }
                    _b1DropTl.to(dc.el, {
                        y: '+=' + distToExit,
                        rotateX: targetRX,
                        rotateZ: targetRZ,
                        opacity: 0,
                        duration: tweenDur,
                        ease: "circ.in",
                        overwrite: 'auto'
                    }, tweenStart);
                });
            })();
            
            // CIEŃ LITER: zanik wyłącznie przez opacity (+ lekki ruch y na liniach).
            // BEZ scaleY na kontenerze — inline transform z sync(b1) psuje / przerywa tween skali na scrub.
            // Start od _b1DropTriggerU (ghost pojawia się tu) — dłuższy odcinek scrolla niż start od SNAP2;
            // końcówka za SNAP2 żeby zanik był widoczny pod scrub (nie „migał” na końcu snapu).
            var _ghostFadeStartU = _b1DropTriggerU;
            var _ghostFadeDur = Math.max(11, SNAP2_U + 10 - _ghostFadeStartU);
            var _ghostEase = 'sine.inOut';
            pinnedTl.fromTo(
                _ghostB1,
                { opacity: 1 },
                {
                    opacity: 0,
                    duration: _ghostFadeDur,
                    ease: _ghostEase,
                    immediateRender: false,
                },
                _ghostFadeStartU,
            );
            pinnedTl.to(
                _ghostChars,
                {
                    opacity: 0,
                    duration: _ghostFadeDur,
                    ease: _ghostEase,
                    overwrite: 'auto',
                },
                _ghostFadeStartU,
            );
            if (_ghostLines.length >= 4) {
                pinnedTl.to(_ghostLines[0], { y: '+=50', duration: _ghostFadeDur, ease: _ghostEase }, _ghostFadeStartU);
                pinnedTl.to(_ghostLines[2], { y: '-=50', duration: _ghostFadeDur, ease: _ghostEase }, _ghostFadeStartU);
                pinnedTl.to(_ghostLines[3], { y: '-=100', duration: _ghostFadeDur, ease: _ghostEase }, _ghostFadeStartU);
            }
            
            // Drop at END of SNAP1→SNAP2 scroll (letters gone BEFORE SNAP2 pause)
            // Trigger 0.5U before SNAP2 → drop starts during scroll, done before pause
            // Drop triggers when line 0's wrap COMPLETES → falling starts while later lines still wrapping
            // Creates one continuous motion: wrap deceleration → drop acceleration (circ.in)
            var _origChars = b1.querySelectorAll('.anim-char');
            pinnedTl.call(function() {
                if (!_b1Dropped) {
                    _b1Dropped = true;
                    // CIEŃ LITER: Sync ghost with EXACT visual state of original
                    // 1. Copy CONTAINER transform (scale 0.95→1.08 tween)
                    var b1cs = window.getComputedStyle(b1);
                    _ghostB1.style.transform = b1cs.transform;
                    // 2. Copy per-CHAR transforms (cylinder wrap rotateY etc.)
                    // + Apply spatial 2D color/opacity from original positions
                    var _sumCx = 0, _sumCy = 0;
                    var _charRects = [];
                    for (var _gi = 0; _gi < _origChars.length; _gi++) {
                        var _cr = _origChars[_gi].getBoundingClientRect();
                        var _cx = _cr.left + _cr.width / 2;
                        var _cy = _cr.top + _cr.height / 2;
                        _sumCx += _cx; _sumCy += _cy;
                        _charRects.push({ cx: _cx, cy: _cy });
                    }
                    var _centerX = _sumCx / _origChars.length;
                    var _centerY = _sumCy / _origChars.length;
                    var _maxDist = 1;
                    for (var _gi = 0; _gi < _charRects.length; _gi++) {
                        var _dx = _charRects[_gi].cx - _centerX;
                        var _dy = _charRects[_gi].cy - _centerY;
                        var _d = Math.sqrt(_dx * _dx + _dy * _dy);
                        _charRects[_gi].dist = _d;
                        if (_d > _maxDist) _maxDist = _d;
                    }
                    // Colors: center #ffdac2 (255,218,194) → edge #fef4ec (254,244,236)
                    // Opacity S5: center=0.75, edge=0.89, plateau=0.29, gamma=0.5
                    var _cR0=255,_cG0=218,_cB0=194, _cR1=254,_cG1=244,_cB1=236;
                    for (var _gi = 0; _gi < _origChars.length && _gi < _ghostChars.length; _gi++) {
                        var cs = window.getComputedStyle(_origChars[_gi]);
                        _ghostChars[_gi].style.transform = cs.transform;
                        var norm = _charRects[_gi].dist / _maxDist; // 0=center, 1=edge
                        var r = Math.round(_cR0 + (_cR1-_cR0) * norm);
                        var g = Math.round(_cG0 + (_cG1-_cG0) * norm);
                        var bv = Math.round(_cB0 + (_cB1-_cB0) * norm);
                        _ghostChars[_gi].style.color = 'rgb('+r+','+g+','+bv+')';
                        _ghostChars[_gi].style.webkitTextFillColor = 'rgb('+r+','+g+','+bv+')';
                        var t = norm < 0.29 ? 0 : Math.pow((norm - 0.29) / 0.71, 0.5);
                        _ghostChars[_gi].style.opacity = (0.75 + 0.14 * t).toFixed(3);
                    }
                    // Show ghost instantly
                    gsap.set(_ghostB1, { visibility: 'visible', opacity: 1 });
                    _b1DropTl.play(0);
                } else {
                    _b1Dropped = false;
                    _b1DropTl.reverse();
                    gsap.set(_ghostB1, { visibility: 'hidden', opacity: 0 });
                }
            }, null, _b1DropTriggerU);
            
            // B2 GRAVITY DROP — stays on scrub timeline (unchanged)
            var DROP_DUR_B2 = DROP_DUR * 1.3;
            var B2_DROP_DELAY = 0.42;
            _buildGravityDrop(b2, SNAP2_U + COLLAPSE_THIRD + B2_DROP_DELAY, DROP_DUR_B2);
            pinnedTl.set(b2, { autoAlpha: 0 }, SNAP2_U + COLLAPSE_THIRD + B2_DROP_DELAY + DROP_DUR_B2 + 0.5);

                // BLOCK 3
                // b3Header usunięty z sekwencji - animacja fali dodana NA KOŃCU na pozycji 14
            // Na niskich viewportach yPercent:-50 ciągnie blok w górę o ~½ wysokości → ucina od góry.
            // Przy wysokości < 920px: kotwicz od góry bloku (0), nie od środka.
            function applyKineticB3VerticalAlign() {
                if (!b3) return;
                var shortVp = typeof window !== 'undefined' && window.innerHeight < 920;
                gsap.set(b3, {
                    yPercent: shortVp ? 0 : -50,
                    transformOrigin: 'left center',
                });
            }
            applyKineticB3VerticalAlign();
            var _b3AlignRaf = 0;
            function onKineticB3Resize() {
                cancelAnimationFrame(_b3AlignRaf);
                _b3AlignRaf = requestAnimationFrame(applyKineticB3VerticalAlign);
            }
            window.addEventListener('resize', onKineticB3Resize, { passive: true });
            cleanups.push(function() {
                window.removeEventListener('resize', onKineticB3Resize);
                cancelAnimationFrame(_b3AlignRaf);
            });
            gsap.set([b3Lines, b3Bold], { transformOrigin: "left center" });
            
            // BLOCK 3 - POZYCJA ABSOLUTNA 10.04 (przesunięte -2.7)
            pinnedTl.set(b3, { autoAlpha: 1 }, 15.04 + I + DELTA);
            pinnedTl.fromTo(b3Lines, 
                { y: 60, opacity: 0, scale: 1 }, 
                { y: 0, opacity: 1, scale: 1.08, duration: 8.0, stagger: 0.6, ease: "none" },
                15.04 + I + DELTA);
            
            pinnedTl.fromTo(b3Bold, 
                { opacity: 0, scale: 0.95, y: 60 }, 
                { opacity: 1, scale: 1.12, y: 0, duration: 7.0, ease: "none" },
                17.44 + I + DELTA);

            // CYLINDER INTRO - Speed Ramp v3: 13+I (was 11+I), dur 9 (was 7)
            // Responsywne wartości z pomiarów użytkownika
            const w = window.innerWidth;
            const h = window.innerHeight;
            
            let cylEndScale, cylX, cylEndY, cylRot;
            
            if (w < 600) {
                // === MOBILE ===
                // Scale: interpolacja 270→587 (66%→126%)
                cylEndScale = 0.66 + (w - 270) * (1.26 - 0.66) / (587 - 270);
                cylEndScale = Math.max(0.66, Math.min(1.26, cylEndScale));
                
                // X: stały -2vw
                cylX = -2;
                
                // Y: interpolacja wg HEIGHT (533→1111px → -14vh→-27vh)
                cylEndY = -14 + (h - 533) * (-27 - (-14)) / (1111 - 533);
                cylEndY = Math.max(-27, Math.min(-14, cylEndY));
                
                // Rot: stały 12°
                cylRot = 12;
                
            } else {
                // === DESKTOP ===
                // 3 punkty referencyjne (interpolacja segmentowa):
                // 1101×851  → Scale 84%, Rot -5°, X 0vw, Y -9vh
                // 1645×1111 → Scale 110%, Rot -5°, X -1vw, Y -7vh
                // 2215×1111 → Scale 116%, Rot -5°, X -3vw, Y -7vh
                
                const W1 = 1101, W2 = 1645, W3 = 2215;
                
                // Rot: stałe -5°
                cylRot = -5;
                
                if (w <= W1) {
                    cylEndScale = 0.84;
                    cylX = 0;
                    cylEndY = -9;
                } else if (w <= W2) {
                    const t = (w - W1) / (W2 - W1);
                    cylEndScale = 0.84 + t * (1.10 - 0.84);
                    cylX = 0 + t * (-1 - 0);
                    cylEndY = -9 + t * (-7 - (-9));
                } else if (w <= W3) {
                    const t = (w - W2) / (W3 - W2);
                    cylEndScale = 1.10 + t * (1.16 - 1.10);
                    cylX = -1 + t * (-3 - (-1));
                    cylEndY = -7; // Stałe -7
                } else {
                    cylEndScale = 1.16;
                    cylX = -3;
                    cylEndY = -7;
                }
            }
            
            // Start position: wyżej o 22vh (v140: was 20vh — +10% higher start)
            const cylStartY = (cylEndY - 22) + "vh";
            const cylEndYvh = cylEndY + "vh";
            const cylXvw = cylX + "vw";
            const cylStartScale = w < 600 ? cylEndScale : 0.51; // v140: was 0.60 — 15% smaller start
            
            const _elCylWrap = $id("kinetic-cylinder-wrapper");
            gsap.set(_elCylWrap, { 
                xPercent: -50,
                x: cylXvw,
                y: cylStartY, 
                rotation: cylRot,
                scale: cylStartScale,
                transformOrigin: "center center"
            });
            pinnedTl.to(_elCylWrap, { 
                opacity: 1, 
                xPercent: -50,
                x: cylXvw,
                y: cylEndYvh,
                rotation: cylRot,
                scale: cylEndScale,
                duration: 9.60,   // v140: was 11.96 — delayed start, same end point
                ease: "none" 
            }, 17.40 + I + DELTA);  // po collapse cząsteczek (COLLAPSE_END 17.1 w U kinetic)
            pinnedTl.to(_s.cylinder ? _s.cylinder.state : {}, { 
                opacity: 1, 
                rotation: _s.cylinder ? _s.cylinder.getRotationForNumber(98) : 0,
                duration: 9.60,   // v140: was 11.96
                ease: "none" 
            }, 17.40 + I + DELTA);
            
            // CYLINDER SCALE - już ustawiony wyżej w głównym gsap.set/pinnedTl.to
            
            // ============================================
            // ANIMACJA FALI "Wg badań GEMIUS:" - pozycja absolutna 12.3
            // Dodana NA KOŃCU żeby nie wpływać na sekwencję
            // ============================================
            const b3HeaderChars = splitIntoChars(b3Header);
            
            // GLOW TRAIL: create SVG AFTER splitIntoChars
            b3Header.style.position = 'relative';
            var _gtSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            _gtSvg.setAttribute('id', 'kinetic-glow-trail');
            _gtSvg.setAttribute('viewBox', '0 0 300 32');
            _gtSvg.setAttribute('preserveAspectRatio', 'none');
            _gtSvg.style.cssText = 'position:absolute;left:0;bottom:-10px;width:100%;height:20px;overflow:visible;pointer-events:none;';
            _gtSvg.innerHTML = '<defs><filter id="kinetic-glow-filter" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M0 16 Q75 8, 150 16 T300 14" fill="none" stroke="#f75530" stroke-width="32" stroke-linecap="round" filter="url(#kinetic-glow-filter)" opacity="0.5" stroke-dasharray="400" stroke-dashoffset="400"/><path d="M0 16 Q75 8, 150 16 T300 14" fill="none" stroke="#f75530" stroke-width="12" stroke-linecap="round" opacity="0.9" stroke-dasharray="400" stroke-dashoffset="400"/>';
            b3Header.appendChild(_gtSvg);
            b3HeaderChars.forEach(function(c) { c.style.willChange = 'transform, opacity'; });
            gsap.set(b3HeaderChars, {
                opacity: 0,
                x: 30,
                color: "#ffb998", // Brzoskwiniowy
                immediateRender: true
            });
            
            pinnedTl.to(b3HeaderChars, {
                opacity: 1,
                x: 0,
                duration: 6,
                stagger: 0.06,
                ease: "power2.out",
                immediateRender: false
            }, 19.3 + I + DELTA);
            
            pinnedTl.to(b3HeaderChars, {
                color: "#141414",
                duration: 5.5,
                stagger: 0.06,
                ease: "power1.inOut"
            }, 19.6 + I + DELTA);
            
            // GEMIUS HEADER - pozostaje stabilny i widoczny na U:23
            
            // CYLINDER - pozostaje widoczny z liczbą 98% na U:23
            
            // ============================================
            // BLOCK 1 - SCALE (powiększanie całego kontenera)
            // Start: 0.95, Od jednostki 0 do ~13: 0.95 → 1.08
            // Ease: power2.in - wolny start, przyspiesza
            // ============================================
            gsap.set(b1, { scale: 0.95, transformOrigin: "center center" });
            pinnedTl.to(b1, {
                scale: 1.08,
                duration: SNAP2_U - b1AnimStart,
                ease: "power2.in"
            }, b1AnimStart);
            
            // ============================================
            // BLOCK 3 - SCALE (powiększanie całego kontenera)
            // Start: 0.95, Koniec (jednostka 25): 1.12
            // Ease: power2.out - przyspiesza na początku, zwalnia na końcu
            // Kontynuuje się nawet gdy litery spadają
            // transformOrigin: left center - żeby zachować justowanie do lewej
            // ============================================
            gsap.set(b3, { scale: 0.95 }); // transformOrigin już ustawiony wcześniej
            pinnedTl.to(b3, {
                scale: 1.12,
                duration: 8.0,
                ease: "power3.out"
            }, 15.3 + I + DELTA);
            
            // ============================================
            // BLOCK 1 - SEKWENCYJNE ZWIJANIE LINII W DÓŁ
            // v140: USUNIĘTE — zastąpione cylinder wrap (buildCylinderWrapTweens)
            // ============================================
            // (b1AllLines defined in ZMIANA D wrap section above)
            
            // ============================================
            // BLOCK 2 "W czym problem?" - SCALE (pozycja absolutna)
            // Dodane NA KOŃCU żeby nie wpływać na sekwencję
            // Start: 4.83, Koniec: 12.54, Duration: 7.71
            // ============================================
            const problemLine = $id('kinetic-problem-line');
            gsap.set(problemLine, { scale: 3, transformOrigin: "center center" });
            pinnedTl.to(problemLine, {
                scale: 1,
                duration: 7.71,
                ease: "circ.out"
            }, 2.13 + I + DELTA);
            
            
            // ============================================
            // PARTICLE QMARK - animacje canvasu w timeline
            // Pozycja a) SNAP1_U (B1_FULL_DRAW) → Scale 1.30, Y 14px, Opacity 1.0 ("!" uformowany)
            // Pozycja b) SNAP2_U (I+SNAP2_KINETIC_U) → Scale 1.65, Y 55px ("?" widoczny)
            // U:10.80+I → Collapse zakończony, cząsteczki zniknęły
            // Fazy form/rot/collapse sterowane wewnętrznie przez komponent
            // ============================================
            const pqCanvas = $id('kinetic-particle-qmark-canvas');
            
            // Stan startowy: niewidoczny, mniejszy
            gsap.set(pqCanvas, { 
                scale: 1.11,  // v140: was 0.85 — ! bigger from start (+0.26, half of !→? diff)
                opacity: 0, 
                y: 0,
                transformOrigin: "center center"
            });
            
            // U:0 → U:I+3.50 (SNAP 1): FADE IN + SCALE UP + Y SHIFT
            // Przywrócone oryginalne formuły z 66
            pinnedTl.to(pqCanvas, {
                opacity: 1,
                duration: 1.5,
                ease: "power2.out"
            }, 0);
            
            pinnedTl.to(pqCanvas, {
                scale: 1.56,  // v140: was 1.30 — ! bigger at SNAP1 (+0.26)
                duration: I + 3.5,
                ease: "power2.out"
            }, 0);
            
            pinnedTl.to(pqCanvas, {
                y: 14,
                duration: I + 3.5,
                ease: "power2.out"
            }, 0);
            
            // SNAP 1 → SNAP 2: SCALE 1.56→1.815 (v140: half growth, was 1.30→1.815)
            // Synced with rotation override: both start at SNAP1, end at SNAP2
            pinnedTl.to(pqCanvas, {
                scale: 1.815,
                duration: SNAP2_U - SNAP1_U,
                ease: "power2.inOut"
            }, SNAP1_U);
            
            pinnedTl.to(pqCanvas, {
                y: 55,
                duration: SNAP2_U - SNAP1_U,
                ease: "power2.inOut"
            }, SNAP1_U);
            
            // Od SNAP2: fade canvasu równolegle z fazą collapse cząsteczek (2.6U → COLLAPSE_END 15.1)
            pinnedTl.to(pqCanvas, {
                opacity: 0,
                duration: 2.60,
                ease: "power2.in"
            }, SNAP2_U);
            
            // Brightness 60% — stały od początku (bez tweenu)

            // ============================================
            // ANIMACJE BLOBÓW - W TYM SAMYM TIMELINE
            // Pozycje absolutne (liczby) nie przesuwają playhead
            // ============================================
            
            // BIRTH blobów - PRZENIESIONY do keyframes per-blob (zero konfliktów scale)
            // Każdy blob ma własne "narodziny" wbudowane w keyframes 0% → ~4%
            // Opacity fade-in - bloby pojawiają się razem z tekstem "W internecie"
            const BLOB_BIRTH = b1Start;
            const BLOB_OPACITY_START = b1Start + B1_STAGGER * (B1_LINE_COUNT - 1); // blend switch anchor
            // v140: carrier stays hidden — blob canvas renders instead
            gsap.set(_elBlobCarrier, { visibility: 'hidden' });
            // Blob opacity — RESTORED from reference: simple .to() in timeline
            pinnedTl.to(_elBlob1, { opacity: 0.99, duration: 1.5, ease: "power1.out" }, BLOB_BIRTH);
            pinnedTl.to(_elBlob2, { opacity: 0.99, duration: 1.5, ease: "power1.out" }, 0.1 + BLOB_BIRTH);
            pinnedTl.to(_elBlob3, { opacity: 0.99, duration: 1.5, ease: "power1.out" }, 0.2 + BLOB_BIRTH);

            pinnedTl.fromTo(_elBlob1, { scale: 0.35 }, { scale: 1.1, duration: 4.5, ease: "power1.out" }, BLOB_BIRTH);
            pinnedTl.fromTo(_elBlob2, { scale: 0.35 }, { scale: 1.4, duration: 4.5, ease: "power1.out" }, 0.1 + BLOB_BIRTH);
            pinnedTl.fromTo(_elBlob3, { scale: 0.30 }, { scale: 1.0, duration: 4.5, ease: "power1.out" }, 0.2 + BLOB_BIRTH);

            // PARTICLE BLEND — multiply switch before corona peak
            // Corona building up (opacity ~0.35), letters appearing = max distraction
            // v140: multiply removed — particles stay normal blend (Δ<4% on 97% white bg)
            // COLOR BLOOM: neutral→warm pastels synced with blend switch
            pinnedTl.to(_s._warmMix, { value: 1, duration: 1.5, ease: "power2.out" }, BLOB_BIRTH);
            // COLOR RAMP: 2-phase transition
            // Phase 1 (BLOB_BIRTH → BLEND_SWITCH, ~3U): muted → saturated warm (matching corona)
            // Phase 2 (BLEND_SWITCH → SNAP1, ~1.5U): saturated warm → white (overlap with corona)
            var BLEND_SWITCH_U = BLOB_OPACITY_START + 1.5;
            var _phase1Dur = BLEND_SWITCH_U - BLOB_BIRTH;
            var _phase2Dur = SNAP1_U - BLEND_SWITCH_U;
            
            // Phase 1: P4 Deep warm (S=50-60% instead of muted 20-23%)
            pinnedTl.to(_elBlob1, { backgroundColor: "hsl(30, 55%, 86%)", duration: _phase1Dur, ease: "power2.out" }, BLOB_BIRTH);
            pinnedTl.to(_elBlob2, { backgroundColor: "hsl(50, 60%, 87%)", duration: _phase1Dur, ease: "power2.out" }, BLOB_BIRTH);
            pinnedTl.to(_elBlob3, { backgroundColor: "hsl(15, 50%, 89%)", duration: _phase1Dur, ease: "power2.out" }, BLOB_BIRTH);
            pinnedTl.to($id("kinetic-blob-bg-preview"), { backgroundColor: "hsl(40, 50%, 92%)", duration: _phase1Dur, ease: "power2.out" }, BLOB_BIRTH);
            
            // Phase 2: fade to white (power2.in = slow start, corona takes over)
            pinnedTl.to(_elBlob1, { backgroundColor: "hsl(40, 20%, 97%)", duration: _phase2Dur, ease: "power2.in" }, BLEND_SWITCH_U);
            pinnedTl.to(_elBlob2, { backgroundColor: "hsl(50, 18%, 97%)", duration: _phase2Dur, ease: "power2.in" }, BLEND_SWITCH_U);
            pinnedTl.to(_elBlob3, { backgroundColor: "hsl(15, 18%, 97%)", duration: _phase2Dur, ease: "power2.in" }, BLEND_SWITCH_U);
            pinnedTl.to($id("kinetic-blob-bg-preview"), { backgroundColor: "hsl(28, 55%, 82%)", duration: _phase2Dur, ease: "power2.in" }, BLEND_SWITCH_U);
            


            // ============================================
            // KOLORY - Orchestracja z EKSPLOZJĄ
            // 0 → 4.86:       Blue STATYCZNY
            // 4.86 → 7.0:     Blue → Pierwsza Zieleń (subtelne)
            // 7.0 → 12.40:    Pierwsza Zieleń → Dojrzała Zieleń
            // 12.40 → 12.56:  💥 EKSPLOZJA → Warm (0.16 jednostki!)
            // 12.56 → koniec: Warm FREEZE
            // ============================================
            
            // Palety kolorów
            const paletteBlue = palette1; // już zdefiniowana
            
            const paletteGreen1 = palette2; // SNAP1→SNAP2: blobs stay P4v2 Inv
            
            const paletteGreen2 = palette2; // Deep phase: same P4v2 Inv
            
            const paletteWarm = {
                bg: "hsl(39, 50%, 96%)",
                b1: "hsl(33, 55%, 94%)",
                b2: "hsl(46, 58%, 95%)",
                b3: "hsl(23, 48%, 95%)"
            }; // SNAP3 = S↑L↑ (bright + saturated)
            
            // 0 → 4.86: Blue STATYCZNY (kolory startują jako Blue w CSS background-color)
            
            // P0: Animate backgroundColor directly (flat fill, no gradient regen)
            // Was: CSS var animation → gradient regen ~3M px/frame
            // Now: backgroundColor change → flat fill repaint (trivial cost)
            
            // green1/green2 tweens REMOVED — palette2=green1=green2 (no-op)
            // They conflicted with warm tween by pulling backgroundColor back to palette2
            // during their active range, causing visual "kumulacja" jump before SNAP2
            
            // SNAP2→SNAP3: smooth P4v2 Inv → S↑L↑ (SNAP1→SNAP2 stays full P4v2 Inv)
            pinnedTl.to(_elBlob1, { backgroundColor: paletteWarm.b1, duration: SNAP3_U - SNAP2_U, ease: "none" }, SNAP2_U);
            pinnedTl.to(_elBlob2, { backgroundColor: paletteWarm.b2, duration: SNAP3_U - SNAP2_U, ease: "none" }, SNAP2_U);
            pinnedTl.to(_elBlob3, { backgroundColor: paletteWarm.b3, duration: SNAP3_U - SNAP2_U, ease: "none" }, SNAP2_U);
            pinnedTl.to($id("kinetic-blob-bg-preview"), { backgroundColor: paletteWarm.bg, duration: SNAP3_U - SNAP2_U, ease: "none" }, SNAP2_U);
            
            // 12.56 → koniec: Warm FREEZE (nic nie robimy, kolory pozostają)

            // Wykrycie mobile dla animacji blobów
            const isMobile = window.innerWidth < 600;

            // Organiczny ruch blobów - osobne wartości dla desktop i mobile
            if (isMobile) {
                // MOBILE - ciągły ruch od pojawienia się do SNAP1
                // Usunięto "freeze" keyframes - bloby ruszają się od razu
                
                // BLOB1 (CSS: 20vw, 20vh, 100vw) - startuje lewy-górny
                pinnedTl.to(_elBlob1, {
                    keyframes: {
                        "0%":      { x: "5vw",  y: "5vh",   scale: 1.2,  rotation: 15 },
                        // SNAP1 - pozycja zachowana identycznie
                        "22.00%":  { x: "10vw", y: "10vh",  scale: 1.04, rotation: 20 },
                        "46.00%":  { x: "12vw", y: "8vh",   scale: 0.55, rotation: 22 },
                        "57.60%":  { x: "10vw", y: "16vh",  scale: 1.76, rotation: 25 },
                        "84.00%":  { x: "8vw",  y: "14vh",  scale: 1.62, rotation: 28 },
                        "100%":    { x: "7vw",  y: "13vh",  scale: 1.55, rotation: 30 },
                        easeEach: "sine.inOut"
                    },
                    duration: 25,
                    ease: "none"
                }, I - 2 + DELTA);
                
                // BLOB2 (CSS: 80vw, 80vh, 120vw) - startuje lewy-środek
                pinnedTl.to(_elBlob2, {
                    keyframes: {
                        "0%":      { xPercent: -50, yPercent: -50, x: "-15vw", y: "-40vh", scale: 1.0, rotation: -10 },
                        // SNAP1 - pozycja zachowana identycznie
                        "22.00%":  { x: "-40vw", y: "-37vh", scale: 1.17, rotation: -15 },
                        "46.00%":  { x: "-38vw", y: "-37vh", scale: 1.00, rotation: -18 }, // was scale:0.5 y:-44vh → utrzymuje zasięg nad dołem "!" na SNAP2
                        "57.60%":  { x: "-40vw", y: "-32vh", scale: 1.62, rotation: -20 },
                        "84.00%":  { x: "-42vw", y: "-30vh", scale: 1.49, rotation: -22 },
                        "100%":    { x: "-43vw", y: "-29vh", scale: 1.42, rotation: -23 },
                        easeEach: "sine.inOut"
                    },
                    duration: 25,
                    ease: "none"
                }, I - 2 + DELTA);
                
                // BLOB3 (CSS: 50vw, 50vh, 80vw)
                pinnedTl.to(_elBlob3, {
                    keyframes: {
                        "0%":      { xPercent: -50, yPercent: -50, x: "-9.5vw", y: "-16vh", scale: 0.25, rotation: -30 },
                        // SNAP1 - pozycja zachowana identycznie
                        "29.96%":  { x: "-5vw", y: "-10vh",  scale: 1.11, rotation: -25 },
                        // SNAP2 — blob centruje się
                        "65.27%":  { x: "0vw",  y: "0vh",    scale: 0.5,  rotation: -15 },
                        "82.35%":  { x: "0vw",  y: "1vh",    scale: 1.49, rotation: 0 },
                        "100%":    { x: "0vw",  y: "0vh",    scale: 1.35, rotation: 5 },
                        easeEach: "sine.inOut"
                    },
                    duration: 16.99,
                    ease: "none"
                }, I - 1.59 + DELTA);
            } else {
                // DESKTOP - ciągły ruch od pojawienia się do SNAP1
                // Usunięto "freeze" keyframes - bloby ruszają się od razu
                _s.blobTweens = _s.blobTweens || {};
                
                _s.blobTweens.blob1 = pinnedTl.to(_elBlob1, {
                    keyframes: {
                        "0%":      { x: "5vw",   y: "30vh",  scale: 1.1,  rotation: 29 },
                        "28.59%":  { x: "9vw",    y: "9.5vh",  scale: 0.75, rotation: 29 },
                        "35.04%":  { x: "16.5vw", y: "23vh",   scale: 0.75, rotation: 29 },
                        "47.94%":  { x: "16.5vw", y: "23vh",   scale: 0.70, rotation: 29 },
                        "63.40%":  { x: "13vw",   y: "26.5vh", scale: 1.10, rotation: 29 },
                        "84.00%":  { x: "1vw",    y: "2vh",    scale: 0.85, rotation: 29 },
                        "100%":    { x: "-1vw",   y: "-2vh",   scale: 0.80, rotation: 29 },
                        easeEach: "sine.inOut"
                    },
                    duration: 25,
                    ease: "none"
                }, I - 2 + DELTA);
                
                _s.blobTweens.blob2 = pinnedTl.to(_elBlob2, {
                    keyframes: {
                        "0%":      { x: "8vw",   y: "8vh",    scale: 1.4, rotation: 0 },
                        "31.83%":  { x: "-9vw", y: "-15vh",  scale: 1.35, rotation: 0 },
                        "54.20%":  { x: "-9vw", y: "-15vh",  scale: 0.35, rotation: -85 },
                        "84.00%":  { x: "-9vw", y: "2vh",    scale: 1.00, rotation: -85 },
                        "100%":    { x: "-9vw", y: "5vh",    scale: 1.00, rotation: -85 },
                        easeEach: "sine.inOut"
                    },
                    duration: 25,
                    ease: "none"
                }, I - 2 + DELTA);
                
                _s.blobTweens.blob3 = pinnedTl.to(_elBlob3, {
                    keyframes: {
                        "0%":      { x: "-21vw",  y: "0vh",    scale: 1.00, rotation: -36 },
                        "32.16%":  { x: "-1vw",   y: "0.5vh",  scale: 1.10, rotation: -41 },
                        "56.62%":  { x: "-1vw",   y: "0.5vh",  scale: 0.50, rotation: -45 },
                        "83.74%":  { x: "-23vw",  y: "0vh",    scale: 0.95, rotation: 110 },
                        "100%":    { x: "-28vw",  y: "-1vh",   scale: 0.95, rotation: 115 },
                        easeEach: "sine.inOut"
                    },
                    duration: 24.6,
                    ease: "none"
                }, I - 1.6 + DELTA);
            }

            // BLOBY - pozostają widoczne na U:23 (Speed Ramp v3: rozciągnięte)

            // ============================================
            // ANIMACJA TŁA (kinetic-blob-bg-preview)
            // Start: opacity 0
            // Od 6.0: zaczyna się pojawiać
            // Na 9.0: pełna widoczność (duration = 3)
            // Od 16: zaczyna znikać
            // Na 18.5: pełna przezroczystość (duration = 2.5)
            // ============================================
            const blobBgPreviewEl = $id('kinetic-blob-bg-preview');
            
            // Pojawienie się tła — starts AT SNAP1 (opacity=0 at SNAP1, builds during scroll)
            pinnedTl.to(blobBgPreviewEl, {
                opacity: 1,
                duration: SNAP2_U - SNAP1_U,
                ease: "none"
            }, SNAP1_U);
            
            // blobBgPreview - pozostaje widoczny na U:23

            // ════════════════════════════════════════════════════════════════
            // v140 BLOB CANVAS — replaces DOM multiply blending
            // Draws bg-preview + 3 blob gradients with baked multiply.
            // Canvas source-over only → zero CSS blend modes → +30% compositor.
            // ════════════════════════════════════════════════════════════════
            ;(function initBlobCanvas() {
                var blobCanvas = $id('kinetic-blob-canvas');
                if (!blobCanvas) return;
                var bctx = blobCanvas.getContext('2d');
                if (!bctx) return;

                var blobEls = [_elBlob1, _elBlob2, _elBlob3];
                var PI2 = Math.PI * 2;
                var DEG2RAD = Math.PI / 180;

                // Blob layout config (captured once, viewport-space coords)
                var blobCfg = [];
                for (var _bi = 0; _bi < 3; _bi++) {
                    var _bel = blobEls[_bi];
                    blobCfg.push({
                        cssLeft: _bel.offsetLeft,
                        cssTop:  _bel.offsetTop,
                        sizeW:   _bel.offsetWidth,
                        sizeH:   _bel.offsetHeight
                    });
                }

                // Initial colors (before GSAP touches them)
                var initialBlobRGB = [
                    'rgb(239,237,235)',  // muted warm (single corona calibration)
                    'rgb(239,238,236)',  // muted golden
                    'rgb(239,237,235)'   // muted peach
                ];
                var initialBgPreviewRGB = 'rgb(249,248,246)'; // inverted P4v2: light (blob val)

                // Canvas sizing
                var bW = 0, bH = 0, cScale = 1;
                var BLOB_CANVAS_CAP = 1440;

                function resizeBlobCanvas() {
                    if (IS_TOUCH && freezeFinal) return;
                    var vw = window.innerWidth;
                    var vh = window.innerHeight;
                    var sc = vw > BLOB_CANVAS_CAP ? BLOB_CANVAS_CAP / vw : 1;
                    var newW = Math.round(vw * sc);
                    var newH = Math.round(vh * sc);
                    if (blobCanvas.width !== newW || blobCanvas.height !== newH) {
                        blobCanvas.width = newW;
                        blobCanvas.height = newH;
                    }
                    bW = newW;
                    bH = newH;
                    cScale = sc; // viewport→canvas coordinate ratio
                    blobCanvas.style.width  = vw + 'px';
                    blobCanvas.style.height = vh + 'px';
                }

                resizeBlobCanvas();
                window.addEventListener('resize', resizeBlobCanvas);
                cleanups.push(function() { window.removeEventListener('resize', resizeBlobCanvas); });

                // Hide DOM blobs from compositor
                _elBlobCarrier.style.visibility = 'hidden';

                // RGB parser with cache
                var _rgbCache = {};
                function parseRGB(str) {
                    if (!str) return null;
                    var cached = _rgbCache[str];
                    if (cached) return cached;
                    var m = str.match(/[\d.]+/g);
                    if (!m || m.length < 3) return null;
                    var result = { r: +m[0], g: +m[1], b: +m[2] };
                    if (Object.keys(_rgbCache).length > 300) _rgbCache = {};
                    _rgbCache[str] = result;
                    return result;
                }

                function getBlobColor(el, idx) {
                    return el.style.backgroundColor || initialBlobRGB[idx];
                }
                function getBgPreviewColor() {
                    return blobBgPreviewEl.style.backgroundColor || initialBgPreviewRGB;
                }

                // ── Render (OPT-2: cached reads, skip when progress unchanged) ──
                var _blobLastProgress = -1;
                var _blobCachedBgOp = 0;
                var _blobCachedBgRGB = null;
                var _blobCachedMf = { r: 1, g: 1, b: 1 };
                var _blobCached = [
                    { op: 0, gx: 0, gy: 0, gsc: 1, grot: 0, gxp: 0, gyp: 0, mulR: 239, mulG: 237, mulB: 235 },
                    { op: 0, gx: 0, gy: 0, gsc: 1, grot: 0, gxp: 0, gyp: 0, mulR: 239, mulG: 238, mulB: 236 },
                    { op: 0, gx: 0, gy: 0, gsc: 1, grot: 0, gxp: 0, gyp: 0, mulR: 239, mulG: 237, mulB: 235 }
                ];

                function _updateBlobCache() {
                    var bgOp = parseFloat(gsap.getProperty(blobBgPreviewEl, 'opacity')) || 0;
                    _blobCachedBgOp = bgOp;
                    var mfR = 1, mfG = 1, mfB = 1;
                    if (bgOp > 0.005) {
                        var bgRGB = parseRGB(getBgPreviewColor());
                        _blobCachedBgRGB = bgRGB;
                        if (bgRGB) {
                            mfR = 1.0 - bgOp * (1.0 - bgRGB.r / 255);
                            mfG = 1.0 - bgOp * (1.0 - bgRGB.g / 255);
                            mfB = 1.0 - bgOp * (1.0 - bgRGB.b / 255);
                        }
                    }
                    _blobCachedMf.r = mfR; _blobCachedMf.g = mfG; _blobCachedMf.b = mfB;

                    for (var bi = 0; bi < 3; bi++) {
                        var el = blobEls[bi];
                        var bc = _blobCached[bi];
                        bc.op = parseFloat(gsap.getProperty(el, 'opacity')) || 0;
                        if (bc.op < 0.005) continue;
                        bc.gx  = parseFloat(gsap.getProperty(el, 'x')) || 0;
                        bc.gy  = parseFloat(gsap.getProperty(el, 'y')) || 0;
                        bc.gsc = parseFloat(gsap.getProperty(el, 'scaleX')) || 1;
                        bc.grot = (parseFloat(gsap.getProperty(el, 'rotation')) || 0) * DEG2RAD;
                        bc.gxp = parseFloat(gsap.getProperty(el, 'xPercent')) || 0;
                        bc.gyp = parseFloat(gsap.getProperty(el, 'yPercent')) || 0;
                        var rgb = parseRGB(getBlobColor(el, bi));
                        if (rgb) {
                            bc.mulR = Math.round(rgb.r * mfR);
                            bc.mulG = Math.round(rgb.g * mfG);
                            bc.mulB = Math.round(rgb.b * mfB);
                        }
                    }
                }

                function renderBlobCanvas() {
                    if (_s._killed) return;
                    if (!_sectionTickOk && !_deferredTickOk) return; // P0: renders on deferred frame
                    var _anyVisible = false;
                    for (var _vi = 0; _vi < 3; _vi++) {
                        if ((parseFloat(blobEls[_vi].style.opacity) || 0) > 0.005) { _anyVisible = true; break; }
                    }
                    if (!_anyVisible && _blobCachedBgOp < 0.005) {
                        if (blobCanvas.style.display !== 'none') blobCanvas.style.display = 'none';
                        return;
                    }
                    if (blobCanvas.style.display === 'none') blobCanvas.style.display = '';

                    // Dirty check: skip reads if progress unchanged
                    var curP = _s.pinnedTl ? _s.pinnedTl.progress() : 0;
                    if (curP !== _blobLastProgress) {
                        _blobLastProgress = curP;
                        _updateBlobCache();
                    }

                    bctx.clearRect(0, 0, bW, bH);

                    // Draw bg-preview fill
                    if (_blobCachedBgOp > 0.005 && _blobCachedBgRGB) {
                        bctx.globalAlpha = _blobCachedBgOp;
                        bctx.fillStyle = 'rgb(' + _blobCachedBgRGB.r + ',' + _blobCachedBgRGB.g + ',' + _blobCachedBgRGB.b + ')';
                        bctx.fillRect(0, 0, bW, bH);
                        bctx.globalAlpha = 1;
                    }

                    // Draw blobs from cache
                    for (var i = 0; i < 3; i++) {
                        var bc = _blobCached[i];
                        var cfg = blobCfg[i];
                        if (bc.op < 0.005) continue;

                        var pctFactorX = (bc.gxp / 100) + 0.5;
                        var pctFactorY = (bc.gyp / 100) + 0.5;
                        var cx = (cfg.cssLeft + pctFactorX * cfg.sizeW + bc.gx) * cScale;
                        var cy = (cfg.cssTop  + pctFactorY * cfg.sizeH + bc.gy) * cScale;

                        var halfW = cfg.sizeW * 0.5 * bc.gsc * cScale;
                        var halfH = cfg.sizeH * 0.5 * bc.gsc * cScale;
                        var gradR = Math.max(halfW, halfH) * 1.4142;

                        bctx.save();
                        bctx.globalAlpha = bc.op;
                        bctx.translate(cx, cy);
                        bctx.rotate(bc.grot);

                        var grad = bctx.createRadialGradient(0, 0, 0, 0, 0, gradR);
                        var colorFull = 'rgb(' + bc.mulR + ',' + bc.mulG + ',' + bc.mulB + ')';
                        var colorZero = 'rgba(' + bc.mulR + ',' + bc.mulG + ',' + bc.mulB + ',0)';
                        grad.addColorStop(0,    colorFull);
                        grad.addColorStop(0.20, colorFull);
                        grad.addColorStop(0.75, colorZero);
                        grad.addColorStop(1,    colorZero);

                        bctx.fillStyle = grad;
                        bctx.beginPath();
                        bctx.arc(0, 0, gradR, 0, PI2);
                        bctx.fill();
                        bctx.restore();
                    }
                    bctx.globalAlpha = 1;
                }

                gsap.ticker.add(renderBlobCanvas);
                tickerFns.push(renderBlobCanvas);
            })();

            // ============================================
            // ANIMACJA SŁOWA "NIGDY" - tekst + blaszka osobno
            // Intro + Expo Tunel spadek (bez powrotu)
            // ============================================
            // Elementy z TEGO SAMEGO kontenera co b3Lines (b3Container)
            // Nie polegamy na window.innerWidth — może dać inną wartość niż CSS media query
            const nigdyPlate = b3Container?.querySelector('.nigdy-plate');
            const nigdyText = b3Container?.querySelector('.nigdy-text');
            
            // === GLOW - pozycjonowanie pod słowem "nigdy" ===
            const nigdyGlow = $id('kinetic-nigdy-glow');
            const stageEl = container; // was document.querySelector('.stage-pinned') — IS the root
            
            // Reusable positioning function (null-guarded, idempotent)
            const positionNigdyGlow = function() {
                if (IS_TOUCH && freezeFinal) return;
                if (!nigdyText || !nigdyGlow) return;
                const nigdyRect = nigdyText.getBoundingClientRect();
                const stageRect = stageEl.getBoundingClientRect();
                
                // Centrum słowa "nigdy" względem stage
                const glowLeft = (nigdyRect.left + nigdyRect.width / 2) - stageRect.left;
                const glowTop = (nigdyRect.top + nigdyRect.height / 2) - stageRect.top;
                
                // Offset: mobile X=54, Y=-43; desktop X=-160
                const isMobileGlow = window.innerWidth < 600;
                var glowOffsetX = isMobileGlow ? 54 : -160;
                var glowOffsetY = isMobileGlow ? -43 : -15;
                // v140: read panel offsets from CSS custom properties
                var _gpStyle = getComputedStyle(container);
                glowOffsetX += parseFloat(_gpStyle.getPropertyValue('--gp-mx')) || 0;
                glowOffsetY += parseFloat(_gpStyle.getPropertyValue('--gp-my')) || 0;
                
                nigdyGlow.style.left = (glowLeft + glowOffsetX) + 'px';
                nigdyGlow.style.top = (glowTop + glowOffsetY) + 'px';
            };
            
            requestAnimationFrame(positionNigdyGlow);
            window.addEventListener('resize', positionNigdyGlow);
            cleanups.push(() => window.removeEventListener('resize', positionNigdyGlow));
            
            // === GLOW - ustawienie początkowe (scale: 0, z centrum) ===
            gsap.set(nigdyGlow, { scale: 0, rotation: -185, transformOrigin: "center center" }); // v140: rotation baked from panel
            
            // Timing - przesunięty o -2.7 (cała animacja skrócona)
            const bgStart = 18.80 + I + DELTA; // w zestawie z SNAP2/particle collapse
            const textStart = 20.80 + I + DELTA;
            const textDuration = 7.2; // Speed Ramp v3: was 2.5 (2.9× stretch → NIGDY gęstnieje w slow-mo)
            const bgIntroDuration = 9.2; // Speed Ramp v3: was 4.5 (2× stretch → plate wypełnia do snap3)
            const glowStart = 15.80 + I + DELTA; // Start glow intro (z B3)
            
            // v140: luminosity removed — math proves ΔE=0 (white gradient on warm bg = identical in normal/luminosity)
            // Saves GPU isolated compositing group during peak load at SNAP2
            
            pinnedTl.to(nigdyGlow, {
                opacity: 1,
                duration: bgIntroDuration * 0.25,  // 25% czasu na pełną widoczność
                ease: "power2.out"
            }, glowStart);
            
            // Scale: wolniejsze rozrastanie (pełny czas)
            pinnedTl.to(nigdyGlow, {
                scale: 1,
                duration: bgIntroDuration,
                ease: "power2.out"
            }, glowStart);
            
            // === BLASZKA - ustawienie początkowe ===
            // v140: starts invisible+tiny, grows continuously from B3 appearance
            gsap.set(nigdyPlate, {
                xPercent: -50,
                yPercent: -50,
                scale: 0.05,
                rotation: 60,
                opacity: 0
            });
            
            // === BLASZKA INTRO: ciągła organiczna animacja od pojawienia B3 ===
            // v140: was starting at bgStart (13.80) with 3.76U dead zone
            // Now: starts at 10.04 (B3 text), ends at same point (bgStart+bgIntroDuration)
            var _plateFullDuration = (bgStart + bgIntroDuration) - (15.04 + I + DELTA);
            pinnedTl.to(nigdyPlate, {
                opacity: 1,
                scale: 0.85,
                rotation: -9,
                duration: _plateFullDuration,
                ease: "power2.out"
            }, 15.04 + I + DELTA);
            
            // === TEKST INTRO: fontWeight 300→700 in 8 steps (was 4 = visible jumps) ===
            // 50-unit increments: 300→350→400→450→500→550→600→650→700
            // Each step = 0.9U apart at textDuration=7.2 → smooth enough for scrub
            var _fwStepDur = textDuration / 8;
            pinnedTl.set(nigdyText, { fontWeight: 350 }, textStart + _fwStepDur);
            pinnedTl.set(nigdyText, { fontWeight: 400 }, textStart + _fwStepDur * 2);
            pinnedTl.set(nigdyText, { fontWeight: 450 }, textStart + _fwStepDur * 3);
            pinnedTl.set(nigdyText, { fontWeight: 500 }, textStart + _fwStepDur * 4);
            pinnedTl.set(nigdyText, { fontWeight: 550 }, textStart + _fwStepDur * 5);
            pinnedTl.set(nigdyText, { fontWeight: 600 }, textStart + _fwStepDur * 6);
            pinnedTl.set(nigdyText, { fontWeight: 650 }, textStart + _fwStepDur * 7);
            pinnedTl.set(nigdyText, { fontWeight: 700 }, textStart + _fwStepDur * 8);

            // === TEKST INTRO: scale 1→1.2 (compositable, stays smooth) ===
            pinnedTl.to(nigdyText, {
                scale: 1.2,
                duration: textDuration,
                ease: "power2.out"
            }, textStart);
            
            // === TEKST INTRO: rotation 0→-5 ===
            pinnedTl.to(nigdyText, {
                rotation: -5,
                duration: textDuration,
                ease: "power2.out"
            }, textStart);
            
            // NIGDY - pozostaje w stanie intro na U:23 (spadki usunięte)

        // CORONA: Both peak at BLEND_SWITCH (multiply moment)
        // Maximum brightness masks the blend mode transition
        var _blendMoment = BLOB_OPACITY_START + 1.5;
        var _coronaEl = $id('kinetic-corona');
        if (_coronaEl) {
            // P1: Pause GPU-heavy CSS animations when corona invisible (saves ~360MB VRAM)
            var _coronaRings = _coronaEl.querySelectorAll('.kinetic-corona-ring');
            _coronaRings.forEach(function(r) { r.style.animationPlayState = 'paused'; });
            pinnedTl.call(function() {
                _coronaRings.forEach(function(r) { r.style.animationPlayState = 'running'; });
            }, null, _blendMoment - 1.6);
            pinnedTl.to(_coronaEl, { opacity: 1, duration: 1.5, ease: "power2.out" }, _blendMoment - 1.5);
            pinnedTl.to(_coronaEl, { opacity: 0, duration: 4.0, ease: "power2.in" }, I + 3.0);
            pinnedTl.call(function() {
                _coronaRings.forEach(function(r) { r.style.animationPlayState = 'paused'; });
            }, null, I + 7.1);
        }

        // PULSE: canvas-rendered — tween _pulseOpacity for SNAP2
        pinnedTl.fromTo(_s._pulseOpacity, 
            { value: 0 }, 
            { value: 1, duration: 5.0, ease: "power1.out", immediateRender: false }, 
            SNAP2_U - 5.0
        );
        pinnedTl.to(_s._pulseOpacity, { value: 0, duration: 2.0, ease: "power2.in" }, SNAP2_U + 2.0);

        // VIGNETTE: CSS gradient zamrożony (zero repaint), GSAP tylko opacity
        // Fade in razem z Block 1 text (b1Start → b1Start + 4.5U)
        pinnedTl.to($id('kinetic-vignette'), {
            opacity: 1,
            duration: 4.5,
            ease: "power2.out"
        }, b1Start);

        // VIGNETTE SIDES: zwężenie elipsy przy ? (desktop only)
        if (window.innerWidth >= 1024) {
            var _vigEl = $id('kinetic-vignette');
            var _vigState = { rx: 72 };
            var _vigLastRx = -1;
            function _vigApply() {
                var rx = Math.round(_vigState.rx * 10);
                if (rx === _vigLastRx) return;
                _vigLastRx = rx;
                _vigEl.style.background = 'radial-gradient(' + _vigState.rx + '% 52.5% at 50% 48%, transparent 35%, #f7f6f4 85%)';
            }
            // SNAP1→SNAP2: narrow from 72% to 58% (20% reduction)
            pinnedTl.to(_vigState, {
                rx: 58,
                duration: SNAP2_U - SNAP1_U,
                ease: "power2.in",
                onUpdate: _vigApply
            }, SNAP1_U);
            // block3→: widen back to 72% with "98% osób"
            pinnedTl.to(_vigState, {
                rx: 72,
                duration: 2.0,
                ease: "power2.out",
                onUpdate: _vigApply
            }, 27.0 + I + DELTA);
        }

        // ============ TEXT MARKERS — SVG stroke animations ============
        // Glow Trail under "problem?" — draws in, fully drawn BY SNAP2
        var _problemPaths = $$('#kinetic-problem-trail path');
        if (_problemPaths.length > 0) {
            var _problemReadable = block2StartPosition + 3.5;
            var _probAppearDur = SNAP2_U - _problemReadable; // ends exactly at SNAP2
            
            // APPEAR: draw in (dashoffset 400→0)
            pinnedTl.to(_problemPaths[0], {
                attr: { 'stroke-dashoffset': 0 },
                duration: _probAppearDur,
                ease: "power2.out"
            }, _problemReadable);
            if (_problemPaths[1]) {
                pinnedTl.to(_problemPaths[1], {
                    attr: { 'stroke-dashoffset': 0 },
                    duration: _probAppearDur - 0.3,
                    ease: "power2.out"
                }, _problemReadable + 0.3);
            }
            
            // DISAPPEAR: un-draw left→right (dashoffset 0→-400) — clean start from 0
            var _gemiusTrailStart = (SNAP3_U - 0.7) - 11.0;
            var _probDisGap = _gemiusTrailStart - SNAP2_U; // ~1.8U window
            
            pinnedTl.to(_problemPaths[0], {
                attr: { 'stroke-dashoffset': -400 },
                duration: _probDisGap * 0.75,
                ease: "power2.in"  // slow un-draw → accelerates
            }, SNAP2_U);
            if (_problemPaths[1]) {
                pinnedTl.to(_problemPaths[1], {
                    attr: { 'stroke-dashoffset': -400 },
                    duration: _probDisGap * 0.65,
                    ease: "power2.in"
                }, SNAP2_U + 0.20);
            }
        }
        
        // Glow Trail under "Wg badań GEMIUS:" — 50% slower, same end point
        var _glowPaths = $$('#kinetic-glow-trail path');
        if (_glowPaths.length > 0) {
            var _gemiusEnd = SNAP3_U - 0.7;
            var _gemiusDur = 11.0;
            var _gemiusStart = _gemiusEnd - _gemiusDur;
            pinnedTl.to(_glowPaths[0], {
                attr: { 'stroke-dashoffset': 0 },
                duration: _gemiusDur,
                ease: "power2.out"
            }, _gemiusStart);
            if (_glowPaths[1]) {
                pinnedTl.to(_glowPaths[1], {
                    attr: { 'stroke-dashoffset': 0 },
                    duration: _gemiusDur - 0.5,
                    ease: "power2.out"
                }, _gemiusStart + 0.3);
            }
        }

        // koniec main timeline setup

        // ── RELOAD GUARD: Duży desktop resize ──────────────────────────
        // ENT-NAV-01: RESOLVED — reload usunięty (niekompatybilny z SPA)
        // Drift przy dużym desktop resize (>15%) = max 3.5%, znika przy nawigacji.
        // Docelowo: reinit path (kill→DOM restore→init) gdy splitIntoChars będzie idempotentna.

    // ============================================
    // LIFECYCLE: kill / pause / resume (Typ B)
    // ============================================
    let _paused = false;

    function pause() {
        if (_paused) return;
        _paused = true;
        // Odłącz wszystkie ticker functions
        tickerFns.forEach(fn => { if (fn) gsap.ticker.remove(fn); });
        // Pauzuj główny timeline (i ScrollTrigger)
        // ANTY-AUTODRIFT: skip scrubbed timelines (ST is sole controller)
        gsapInstances.forEach(tl => {
            if (!tl) return;
            if (tl.scrollTrigger && tl.scrollTrigger.vars && tl.scrollTrigger.vars.scrub !== undefined) return;
            if (tl.pause) tl.pause();
        });
        // P1: Zwolnij GPU layers z anim-char (101 spanów × backing store)
        var _ac = $$('.anim-char');
        for (var _i = 0; _i < _ac.length; _i++) _ac[_i].style.willChange = 'auto';
    }

    function resume() {
        if (typeof document !== 'undefined' && document.documentElement.classList.contains('kinetic-past')) return;
        if (!_paused) return;
        _paused = false;
        // Podłącz ticker functions
        tickerFns.forEach(fn => { if (fn) gsap.ticker.add(fn); });
        // Wznów timeline
        // ANTY-AUTODRIFT: skip scrubbed timelines (ST is sole controller)
        gsapInstances.forEach(tl => {
            if (!tl) return;
            if (tl.scrollTrigger && tl.scrollTrigger.vars && tl.scrollTrigger.vars.scrub !== undefined) return;
            if (tl.resume) tl.resume();
        });
        // P1: Przywróć GPU layers tylko dla Block 2 + Block 3 header (per-char stagger)
        var _b2chars = container.querySelectorAll('#kinetic-problem-line .anim-char');
        for (var _i = 0; _i < _b2chars.length; _i++) _b2chars[_i].style.willChange = 'transform, opacity';
        var _b3hchars = container.querySelectorAll('#kinetic-block-3 .small-header .anim-char');
        for (var _i = 0; _i < _b3hchars.length; _i++) _b3hchars[_i].style.willChange = 'transform, opacity';
    }

    function kill() {
        _s._killed = true;
        pause();
        // 1. Wykonaj wszystkie cleanups (removeEventListener, clearTimeout)
        cleanups.forEach(fn => { try { fn(); } catch(e) {} });
        cleanups.length = 0;
        // 2. Kill GSAP instances (pinnedTl + ScrollTrigger + child tweens)
        gsapInstances.forEach(tl => {
            if (tl && tl.scrollTrigger) tl.scrollTrigger.kill();
            if (tl) { tl.revert?.(); tl.kill?.(); }
        });
        gsapInstances.length = 0;
        // 3. Wyczyść ticker references
        tickerFns.length = 0;
        // 4. Wyczyść timer IDs
        timerIds.forEach(id => clearInterval(id));
        timerIds.length = 0;
        // 4b. Wyczyść observers (IntersectionObserver etc.)
        observers.forEach(o => { try { o.disconnect?.(); } catch(e) {} });
        observers.length = 0;
        // 5. Wyczyść window references
        _s.pinnedTl = null;
        _s.cylinder = null;
        _s.particleQmark = null;
        _s.bridgeI = 0;
        _s.blobTweens = null;
        // 7. Reset freeze/lock flags
        freezeFinal = false;
        mobileResizeLock = false;
        clearTimeout(mobileResizeTimer);
        adaptiveDPR._scrollLocked = false;
        clearTimeout(adaptiveDPR._scrollTimer);
        // Reset clip-path ROI
        _clipActive = false;
        _clipOffCount = 0;
        // Reset state machine
        _sm.state = 'idle';
        _sm.committedIndex = -1;
        _sm.pendingIndex = null;
        _sm.zone = 'bridge';
        clearTimeout(_cooldownTimer);
        clearTimeout(_idleSnapTimer);
        _snap1MagnetFired = false;
        if (_kineticObserver) { _kineticObserver.kill(); _kineticObserver = null; }
        var _pqc = $id('kinetic-particle-qmark-canvas');
        if (_pqc) _pqc.style.clipPath = '';
    }

    // ═══ FACTORY P2A: IO GATING — Ścieżka 1 (Typ B, pin:true, IO-safe) ═══
    // Deep offscreen → pause()/resume(). ST stays active (PIN-DISABLE-01).
    // Koegzystencja z internal ST gating (_sectionVisible flag).
    var _factoryIo = null;
    var _factoryIoDebounce = null;
    var _getVH = function() { return window.visualViewport?.height ?? window.innerHeight; };

    function _factoryIoCallback(entries) {
        var e = entries[0];
        if (!e) return;
        if (typeof document !== 'undefined' && document.documentElement.classList.contains('kinetic-past')) {
            pause();
            return;
        }
        if (e.isIntersecting) {
            resume();
        } else {
            pause();
        }
    }

    function _recreateFactoryIo() {
        clearTimeout(_factoryIoDebounce);
        _factoryIoDebounce = setTimeout(function() {
            if (_s._killed) return;
            if (_factoryIo) _factoryIo.disconnect();
            var vh = _getVH();
            var rm = Math.min(1200, Math.max(200, Math.round(0.5 * vh)));
            _factoryIo = new IntersectionObserver(_factoryIoCallback, {
                rootMargin: rm + 'px 0px ' + rm + 'px 0px'
            });
            var _target = container.querySelector('[data-gating-target]') || container;
            _factoryIo.observe(_target);
        }, 50);
    }

    _recreateFactoryIo();

    function _onFactoryVVResize() { _recreateFactoryIo(); }
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', _onFactoryVVResize, { passive: true });
        cleanups.push(function() {
            clearTimeout(_factoryIoDebounce);
            window.visualViewport.removeEventListener('resize', _onFactoryVVResize);
        });
    }
    cleanups.push(function() { if (_factoryIo) _factoryIo.disconnect(); });

    // ═══ FACTORY P2A: ST-REFRESH-01 — section-in-view (bez requestRefresh) + layout-settle ═══
    // Wejściowy refresh z IO szkodził na mobile (skok przy wejściu); observer nadal jednorazowo się odłącza.
    var _stIo = new IntersectionObserver(function(entries) {
        if (!entries[0]?.isIntersecting) return;
        _stIo.disconnect();
    }, { threshold: 0, rootMargin: '0px' });
    _stIo.observe(container);
    observers.push(_stIo);
    cleanups.push(function() { _stIo.disconnect(); });

    var _settleTimer = setTimeout(function() {
        scrollRuntime.requestRefresh('layout-settle');
    }, 1000);
    timerIds.push(_settleTimer);

    return { kill, pause, resume, _s };

    } // END init()


export default function KineticEngine() {
  const rootRef = useRef<HTMLElement | null>(null);
  const kineticApiRef = useRef<{ pause: () => void; resume: () => void } | null>(null);

  useGSAP(() => {
    gsap.registerPlugin(ScrollTrigger);
    const el = rootRef.current;
    if (!el) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error('[P3] rootRef.current is null — ref not attached to <section>.');
      }
      return;
    }
    const inst = init(el);
    kineticApiRef.current = inst;
    return () => {
      kineticApiRef.current = null;
      inst?.kill?.();
    };
  }, { scope: rootRef });

  useEffect(() => {
    const syncKineticPast = () => {
      const past = document.documentElement.classList.contains('kinetic-past');
      if (past) kineticApiRef.current?.pause();
      else kineticApiRef.current?.resume();
    };
    window.addEventListener('kinetic-visibility', syncKineticPast);
    requestAnimationFrame(syncKineticPast);
    return () => window.removeEventListener('kinetic-visibility', syncKineticPast);
  }, []);

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
    <section id="kinetic-section" ref={rootRef} className="stage stage-pinned">
              
              {/* GLOW LAYER - ambient light pod słowem "nigdy" */}
              <div className="nigdy-glow" id="kinetic-nigdy-glow"></div>
              
              {/* ============================================
                   FAZA 2.1: Blob carrier z 3 blobami
                   ============================================ */}
              <div className="blob-carrier" id="kinetic-blob-carrier">
                  <div className="blob-bg-preview" id="kinetic-blob-bg-preview"></div>
                  <div className="blob blob-1" id="kinetic-blob1"></div>
                  <div className="blob blob-2" id="kinetic-blob2"></div>
                  <div className="blob blob-3" id="kinetic-blob3"></div>
              </div>
              
              {/* v140: Blob canvas — replaces DOM multiply blending with baked source-over */}
              <canvas id="kinetic-blob-canvas"></canvas>
              
              {/* PARTICLE QMARK - "?" z cząsteczek, za tekstem */}
              <canvas id="kinetic-tunnel-canvas"></canvas>
              <canvas id="kinetic-particle-qmark-canvas"></canvas>
              
              <div className="content-wrapper" data-gating-target>
                  
                  {/* BLOK 1 */}
                  <div className="text-block" id="kinetic-block-1">
                      <div className="line">W internecie</div>
                      <div className="line">jest więcej klientów,</div>
                      <div style={{ height: "0.8rem" }}></div>
                      <div className="line bold-line line-large">niż Twoja firma jest</div>
                      <div className="line bold-line line-large">w stanie obsłużyć!</div>
                  </div>
      
                  {/* BLOK 2 */}
                  <div className="text-block" id="kinetic-block-2">
                      <div className="line bold-line line-xlarge" id="kinetic-problem-line">W czym problem?</div>
                  </div>
      
                  {/* BLOK 3 */}
                  <div className="text-block" id="kinetic-block-3">
                      <div className="small-header">Wg badań <span className="highlight">GEMIUS</span>:</div>
                      
                      {/* DESKTOP VERSION */}
                      <div className="block-3-desktop">
                          <div className="line">98% osób, które odwiedzi</div>
                          <div className="line">stronę polskiej firmy&nbsp;<span className="word-anchor"><span className="bg-layer"><span className="nigdy-plate" id="kinetic-nigdy-plate"></span></span><span className="text-layer"><span className="nigdy-text" id="kinetic-word-nigdy">nigdy</span></span></span></div>
                          <div className="line bold-line">nie stanie się jej klientami.</div>
                      </div>
                      
                      {/* MOBILE VERSION */}
                      <div className="block-3-mobile">
                          <div className="line">98% osób,</div>
                          <div className="line">które odwiedzi</div>
                          <div className="line">stronę polskiej firmy</div>
                          <div className="line"><span className="word-anchor"><span className="bg-layer"><span className="nigdy-plate" id="kinetic-nigdy-plate-mobile"></span></span><span className="text-layer"><span className="nigdy-text" id="kinetic-word-nigdy-mobile">nigdy</span></span></span>&nbsp;<span className="bold-text">nie stanie</span></div>
                          <div className="line bold-line">się jej klientami.</div>
                      </div>
                  </div>
      
              </div> {/* Koniec content-wrapper */}
      
              {/* PULSE: moved to particle canvas renderer (zero DOM, zero GPU layers) */}
      
              {/* CYLINDER COMPONENT - fog renderowany w canvas */}
              <div id="kinetic-cylinder-wrapper">
                  <canvas id="kinetic-cylinder-canvas"></canvas>
              </div>
      
              {/* VIGNETTE ELLIPSE — narastająca od krawędzi w ostatnich klatkach */}
              <div className="kinetic-vignette" id="kinetic-vignette"></div>
              
              {/* CORONA: Słoneczna Aura za wykrzyknikiem (pure CSS, zero canvas cost) */}
              <div id="kinetic-corona" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "100%", height: "100%", pointerEvents: "none", zIndex: 6, opacity: 0 }}>
                  <div className="kinetic-corona-ring"></div>
                  <div className="kinetic-corona-ring reverse"></div>
              </div>
      
    </section>
  );
}
