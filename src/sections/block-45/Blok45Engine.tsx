'use client';

import { useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollRuntime } from '@/lib/scrollRuntime';
import './blok-4-5-section.css';

// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// registerPlugin() WYŁĄCZNIE wewnątrz useGSAP(() => { ... }) jak poniżej.

function init(container: HTMLElement): { pause: () => void; resume: () => void; kill: () => void } {
    const $ = function(sel: string) { return container.querySelector(sel); };
    const $$ = function(sel: string) { return container.querySelectorAll(sel); };
    const $id = function(id: string) { return container.querySelector('#' + id); };

    const cleanups: Array<() => void> = [];
    const gsapInstances: Array<any> = [];
    const timerIds: Array<{ type: string; id: number | ReturnType<typeof setTimeout> }> = [];
    const observers: Array<IntersectionObserver> = [];

    var DEBUG_MODE = new URLSearchParams(window.location.search).has('debug') || localStorage.getItem('debug') === '1';
    if (DEBUG_MODE) container.classList.add('debug-mode');

    var debugEl = $id('blok-4-5-res-debug');
    if (debugEl && DEBUG_MODE) {
      function updDebug() { (debugEl as HTMLElement).textContent = window.innerWidth + '×' + window.innerHeight; }
      updDebug();
      function onResizeDebug() { updDebug(); }
      window.addEventListener('resize', onResizeDebug);
      cleanups.push(function() { window.removeEventListener('resize', onResizeDebug); });
    }

    var debugPanel: HTMLElement | null = null;
    var debugState = {
      waveState: 'IDLE_CLOSED', waveProgress: 0, kipielTime: 0, orgTime: 0,
      triggerFired: false, walkingStarted: false, starsActive: false
    };

    if (DEBUG_MODE) {
      debugPanel = document.createElement('div');
      debugPanel.id = 'blok-4-5-debug-panel';
      debugPanel.style.cssText = 'position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.4 monospace;padding:10px;border-radius:6px;z-index:99999;max-width:280px;pointer-events:none;';
      document.body.appendChild(debugPanel);
      (window as any)._blok45Debug = debugState;
      function updateDebugPanel() {
        if (!debugPanel) return;
        var voidEl = $id('blok-4-5-voidSectionWrapper');
        var textAboveEl = $('.text-above-illustration');
        var voidRect = voidEl ? voidEl.getBoundingClientRect() : {top:0,bottom:0};
        var textRect = textAboveEl ? textAboveEl.getBoundingClientRect() : {top:0,bottom:0};
        var vh = window.innerHeight;
        debugPanel.innerHTML =
          '<b>WAVE DEBUG</b><br>State: <span style="color:#ff0">' + debugState.waveState + '</span><br>' +
          'Progress: ' + debugState.waveProgress.toFixed(3) + '<br>' +
          'Kipiel: ' + debugState.kipielTime.toFixed(0) + 'ms<br>' +
          'ORG: ' + debugState.orgTime.toFixed(0) + 'ms<br>' +
          'Trigger fired: ' + (debugState.triggerFired ? '<span style="color:#0f0">YES</span>' : '<span style="color:#f00">NO</span>') + '<br>' +
          '<br><b>ELEMENTS</b><br>' +
          '.text-above top: ' + (textRect as DOMRect).top.toFixed(0) + 'px (' + ((textRect as DOMRect).top/vh*100).toFixed(0) + '%)<br>' +
          '.text-above btm: ' + (textRect as DOMRect).bottom.toFixed(0) + 'px (' + ((textRect as DOMRect).bottom/vh*100).toFixed(0) + '%)<br>' +
          '#voidWrapper top: ' + (voidRect as DOMRect).top.toFixed(0) + 'px (' + ((voidRect as DOMRect).top/vh*100).toFixed(0) + '%)<br>' +
          '#voidWrapper btm: ' + (voidRect as DOMRect).bottom.toFixed(0) + 'px (' + ((voidRect as DOMRect).bottom/vh*100).toFixed(0) + '%)<br>' +
          '<br><b>OTHER</b><br>' +
          'Walking: ' + (debugState.walkingStarted ? '<span style="color:#0f0">YES</span>' : '<span style="color:#f00">NO</span>') + '<br>' +
          'Stars: ' + (debugState.starsActive ? '<span style="color:#0f0">ACTIVE</span>' : 'idle') + '<br>' +
          'Viewport: ' + window.innerWidth + '×' + vh;
      }
      var _debugPanelInterval = setInterval(updateDebugPanel, 100);
      timerIds.push({ type: 'interval', id: _debugPanelInterval });
      cleanups.push(function() { if (debugPanel) debugPanel.remove(); });
    }

    // =========================================================
    // UNDERLINE SVG
    // =========================================================
    function initUnderlineSVG() {
      var ellipseBox = $id('blok-4-5-ellipseBox');
      var zmienicText = $id('blok-4-5-zmienicText');
      if (!ellipseBox) return;
      ellipseBox.querySelectorAll('path').forEach(function(path) {
        var el = path as SVGPathElement;
        if (el.getTotalLength) {
          var length = el.getTotalLength();
          el.style.strokeDasharray = String(length);
          el.style.strokeDashoffset = String(length);
        }
      });
      ellipseBox.classList.add('active');
      if (zmienicText) zmienicText.classList.add('active');
    }

    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.defaults({ markers: false });

    // =========================================================
    // WAVE REVEAL
    // =========================================================
    (function initWave() {
      var waveWrap = $id('blok-4-5-wave-wrap');
      var wavePaths = waveWrap ? waveWrap.querySelectorAll('.wave-path') : [];
      if (!waveWrap || wavePaths.length !== 4) return;
      var lastWaveD = ['', '', '', ''];
      var PI = Math.PI, PI2 = PI * 2, sin = Math.sin, pow = Math.pow, NUM_PATHS = 4;
      function r2(x: number) { return Math.round(x * 100) / 100; }

      var kipiel = (function() {
        var NUM_POINTS = 8, SEG = NUM_POINTS - 1, DELAY_MAX = 180;
        var PER_PATH = [{ delay: 0, duration: 850 }, { delay: 90, duration: 900 }, { delay: 200, duration: 950 }, { delay: 340, duration: 480 }];
        var HALF_PI = PI / 2;
        function elasticOut(t: number, amplitude: number, period: number) { if (t <= 0) return 0; if (t >= 1) return 1; var s = period / PI2 * HALF_PI; return amplitude * pow(2, -10 * t) * sin((t - s) * PI2 / period) + 1; }
        function backOut(t: number, ov: number) { var u = t - 1; return u * u * ((ov + 1) * u + ov) + 1; }
        function power3Out(t: number) { var u = 1 - t; return 1 - u * u * u; }
        var easeFns = [function(t: number) { return elasticOut(t, 1.0, 0.35); }, function(t: number) { return elasticOut(t, 1.0, 0.45); }, function(t: number) { return backOut(t, 1.2); }, function(t: number) { return power3Out(t); }];
        var delayPoints = new Float64Array(NUM_POINTS);
        for (var i = 0; i < NUM_POINTS; i++) { delayPoints[i] = (i / (NUM_POINTS - 1)) * DELAY_MAX; }
        var P = new Float64Array(SEG), CP = new Float64Array(SEG), INV = 100 / SEG;
        for (var i = 0; i < SEG; i++) { var pVal = Math.round((i + 1) * INV * 100) / 100; P[i] = pVal; CP[i] = Math.round((pVal - INV / 2) * 100) / 100; }
        var TPL_PRE: string[] = [], TPL_MID: string[] = [], TPL_POST: string[] = [];
        for (var i = 0; i < SEG; i++) { TPL_PRE[i] = ' C ' + CP[i] + ' '; TPL_MID[i] = ' ' + CP[i] + ' '; TPL_POST[i] = ' ' + P[i] + ' '; }
        var maxTime = 0;
        for (var p = 0; p < NUM_PATHS; p++) { var t = PER_PATH[p].delay + PER_PATH[p].duration + DELAY_MAX; if (t > maxTime) maxTime = t; }
        var pointsBuf = new Float64Array(NUM_POINTS);
        var _kParts: Array<string | number> = new Array(2 + SEG * 6);
        function updatePath(time: number, duration: number, pathIdx: number) {
          var ease = easeFns[pathIdx];
          for (var i = 0; i < NUM_POINTS; i++) { var raw = (time - delayPoints[i]) / duration; var t = raw < 0 ? 0 : (raw > 1 ? 1 : raw); pointsBuf[i] = r2(100 - ease(t) * 100); }
          var idx = 0;
          _kParts[idx++] = 'M 0 100 V '; _kParts[idx++] = pointsBuf[0];
          for (var i = 0; i < SEG; i++) { _kParts[idx++] = TPL_PRE[i]; _kParts[idx++] = pointsBuf[i]; _kParts[idx++] = TPL_MID[i]; _kParts[idx++] = pointsBuf[i + 1]; _kParts[idx++] = TPL_POST[i]; _kParts[idx++] = pointsBuf[i + 1]; }
          _kParts[idx] = ' V 100 H 0';
          return _kParts.join('');
        }
        function render(time: number) { var clamped = Math.max(0, Math.min(maxTime, time)); for (var i = 0; i < NUM_PATHS; i++) { var d = updatePath(clamped - PER_PATH[i].delay, PER_PATH[i].duration, i); if (d !== lastWaveD[i]) { (wavePaths[i] as SVGPathElement).setAttribute('d', d); lastWaveD[i] = d; } } }
        return { maxTime: maxTime, render: render };
      })();

      var org = (function() {
        var HALF_PI = PI / 2, NUM_POINTS = 6, SEG = NUM_POINTS - 1, DELAY_MAX = 168;
        var PER_PATH = [{ delay: 0, duration: 980 }, { delay: 53, duration: 980 }, { delay: 105, duration: 980 }, { delay: 273, duration: 427 }];
        function sineOut(t: number) { return sin(t * HALF_PI); }
        var delayPoints = new Float64Array(NUM_POINTS);
        for (var i = 0; i < NUM_POINTS; i++) { delayPoints[i] = (sin((i / (NUM_POINTS - 1)) * PI) + 1) / 2 * DELAY_MAX; }
        var P = new Float64Array(SEG), CP = new Float64Array(SEG), INV = 100 / SEG;
        for (var i = 0; i < SEG; i++) { var pVal = Math.round((i + 1) * INV * 100) / 100; P[i] = pVal; CP[i] = Math.round((pVal - INV / 2) * 100) / 100; }
        var TPL_PRE: string[] = [], TPL_MID: string[] = [], TPL_POST: string[] = [];
        for (var i = 0; i < SEG; i++) { TPL_PRE[i] = ' C ' + CP[i] + ' '; TPL_MID[i] = ' ' + CP[i] + ' '; TPL_POST[i] = ' ' + P[i] + ' '; }
        var maxTime = 0;
        for (var p = 0; p < NUM_PATHS; p++) { var t = PER_PATH[p].delay + PER_PATH[p].duration + DELAY_MAX; if (t > maxTime) maxTime = t; }
        var pointsBuf = new Float64Array(NUM_POINTS);
        var _oParts: Array<string | number> = new Array(2 + SEG * 6);
        function updatePath(time: number, duration: number) {
          for (var i = 0; i < NUM_POINTS; i++) { var raw = (time - delayPoints[i]) / duration; var t = raw < 0 ? 0 : (raw > 1 ? 1 : raw); pointsBuf[i] = r2(100 - sineOut(t) * 100); }
          var idx = 0;
          _oParts[idx++] = 'M 0 100 V '; _oParts[idx++] = pointsBuf[0];
          for (var j = 0; j < SEG; j++) { _oParts[idx++] = TPL_PRE[j]; _oParts[idx++] = pointsBuf[j]; _oParts[idx++] = TPL_MID[j]; _oParts[idx++] = pointsBuf[j + 1]; _oParts[idx++] = TPL_POST[j]; _oParts[idx++] = pointsBuf[j + 1]; }
          _oParts[idx] = ' V 100 H 0';
          return _oParts.join('');
        }
        function render(time: number) { var clamped = Math.max(0, Math.min(maxTime, time)); for (var i = 0; i < NUM_PATHS; i++) { var d = updatePath(clamped - PER_PATH[i].delay, PER_PATH[i].duration); if (d !== lastWaveD[i]) { (wavePaths[i] as SVGPathElement).setAttribute('d', d); lastWaveD[i] = d; } } }
        return { maxTime: maxTime, render: render };
      })();

      var STATE_IDLE_CLOSED = 0, STATE_KIPIEL_OPENING = 1, STATE_KIPIEL_CLOSING = 2, STATE_IDLE_OPEN = 3, STATE_ORG_CLOSING = 4, STATE_ORG_OPENING = 5;
      var state = STATE_IDLE_CLOSED, currentTimeKipiel = 0, currentTimeOrg = 0, timeStart = 0;
      var tickFn: (() => void) | null = null;

      function tickKipielOpen() {
        var now = performance.now(), elapsed = now - timeStart;
        timeStart = now; currentTimeKipiel = currentTimeKipiel + elapsed;
        if (currentTimeKipiel >= kipiel.maxTime) { currentTimeKipiel = kipiel.maxTime; stopTicker(); state = STATE_IDLE_OPEN; currentTimeOrg = org.maxTime; }
        kipiel.render(currentTimeKipiel);
      }
      function startTicker() { if (tickFn) return; tickFn = tickKipielOpen; gsap.ticker.add(tickFn); }
      function stopTicker() { if (!tickFn) return; gsap.ticker.remove(tickFn); tickFn = null; }
      function updateDebugStateW() {
        if ((window as any)._blok45Debug) {
          var stateNames = ['IDLE_CLOSED', 'KIPIEL_OPENING', 'KIPIEL_CLOSING', 'IDLE_OPEN', 'ORG_CLOSING', 'ORG_OPENING'];
          (window as any)._blok45Debug.waveState = stateNames[state] || 'UNKNOWN';
          (window as any)._blok45Debug.kipielTime = currentTimeKipiel;
          (window as any)._blok45Debug.orgTime = currentTimeOrg;
        }
      }
      function startKipielOpen() {
        (waveWrap as HTMLElement).style.display = '';
        if (state === STATE_IDLE_OPEN) return;
        if (state === STATE_IDLE_CLOSED) { currentTimeKipiel = 0; }
        state = STATE_KIPIEL_OPENING;
        if ((window as any)._blok45Debug) (window as any)._blok45Debug.triggerFired = true;
        updateDebugStateW(); timeStart = performance.now(); startTicker();
      }
      function updateKipielCloseProgress(progress: number) {
        currentTimeKipiel = progress * kipiel.maxTime; kipiel.render(currentTimeKipiel);
        if (progress <= 0) { state = STATE_IDLE_CLOSED; currentTimeKipiel = 0; }
      }
      function updateOrgCloseProgress(progress: number) {
        currentTimeOrg = progress * org.maxTime; org.render(currentTimeOrg);
        if (progress <= 0) { state = STATE_IDLE_CLOSED; currentTimeOrg = 0; }
        else if (progress >= 1) { state = STATE_IDLE_OPEN; currentTimeOrg = org.maxTime; }
      }
      function handleScroll(scrollProgress: number, direction: number) {
        if ((window as any)._blok45Debug) (window as any)._blok45Debug.waveProgress = scrollProgress;
        switch (state) {
          case STATE_IDLE_CLOSED: if (direction === 1 && scrollProgress > 0) { startKipielOpen(); } break;
          case STATE_KIPIEL_OPENING: if (direction === -1) { stopTicker(); state = STATE_KIPIEL_CLOSING; updateDebugStateW(); updateKipielCloseProgress(scrollProgress); } break;
          case STATE_KIPIEL_CLOSING: if (direction === 1) { startKipielOpen(); } else { updateKipielCloseProgress(scrollProgress); } break;
          case STATE_IDLE_OPEN: if (direction === -1) { state = STATE_ORG_CLOSING; currentTimeOrg = org.maxTime; updateOrgCloseProgress(scrollProgress); } break;
          case STATE_ORG_CLOSING: if (direction === 1) { state = STATE_ORG_OPENING; updateOrgCloseProgress(scrollProgress); } else { updateOrgCloseProgress(scrollProgress); } break;
          case STATE_ORG_OPENING: if (direction === -1) { state = STATE_ORG_CLOSING; updateOrgCloseProgress(scrollProgress); } else { updateOrgCloseProgress(scrollProgress); } break;
        }
      }

      var stWaveVis = ScrollTrigger.create({ trigger: container, start: 'top bottom', end: 'bottom top', onEnter: function() { (waveWrap as HTMLElement).style.display = ''; }, onLeave: function() { (waveWrap as HTMLElement).style.display = 'none'; }, onEnterBack: function() { (waveWrap as HTMLElement).style.display = ''; }, onLeaveBack: function() { (waveWrap as HTMLElement).style.display = 'none'; } });
      gsapInstances.push(stWaveVis);
      var waveAnchor = container.querySelector('.text-above-illustration');
      var stWaveTrigger = ScrollTrigger.create({ trigger: waveAnchor, start: 'top bottom', once: true, onEnter: function() { startKipielOpen(); } });
      gsapInstances.push(stWaveTrigger);
      var getTriggerPercent = function() { return window.innerWidth < 600 ? 80 : 75; };
      var stWaveScroll = ScrollTrigger.create({
        trigger: waveAnchor, start: 'top bottom',
        end: function() { return 'bottom ' + getTriggerPercent() + '%'; },
        invalidateOnRefresh: true,
        onUpdate: function(self) { handleScroll(self.progress, self.direction); },
        onLeaveBack: function() {
          if (state !== STATE_IDLE_CLOSED) { kipiel.render(0); currentTimeKipiel = 0; currentTimeOrg = 0; state = STATE_IDLE_CLOSED; updateDebugStateW(); }
          lastWaveD[0] = lastWaveD[1] = lastWaveD[2] = lastWaveD[3] = '';
        }
      });
      gsapInstances.push(stWaveScroll);

      function debounce(ms: number, fn: () => void) { var t = 0; return function() { clearTimeout(t); t = setTimeout(fn, ms); }; }
      var refreshST = debounce(120, function() { scrollRuntime.requestRefresh('st-refresh'); });
      window.addEventListener('resize', refreshST);
      window.addEventListener('orientationchange', refreshST);
      if (window.visualViewport) { window.visualViewport.addEventListener('resize', refreshST); }
      cleanups.push(function() {
        window.removeEventListener('resize', refreshST);
        window.removeEventListener('orientationchange', refreshST);
        if (window.visualViewport) window.visualViewport.removeEventListener('resize', refreshST);
      });
    })();

    var stUnderline = ScrollTrigger.create({
      trigger: '#blok-4-5-mozemy-to-zmienic', start: 'top 35%', once: true,
      onEnter: function() { var tid = setTimeout(initUnderlineSVG, 100); timerIds.push({ type: 'timeout', id: tid }); }
    });
    gsapInstances.push(stUnderline);

    // =========================================================
    // GLOW + BUTTON
    // =========================================================
    var glowEl = $id('blok-4-5-glow') as HTMLElement | null;
    var btnWrap = $id('blok-4-5-btnWrap') as HTMLElement | null;
    var btn = $id('blok-4-5-btn') as HTMLElement | null;

    function easeOutPower4(t: number) { var u = 1 - t; var u2 = u * u; return 1 - u2 * u2; }
    function easeInPower4(t: number) { var t2 = t * t; return t2 * t2; }

    var mouseOver = false;
    var GLOW_RISE_DUR = 1000, GLOW_FALL_DUR = 1500;
    var glowValue = 0, glowTarget = 0, glowFrom = 0, glowStartTime = 0;
    var glowSettled = true, glowWillChangeActive = false;

    function setGlowTarget(newTarget: number, now: number) {
      if (newTarget === glowTarget) return;
      glowFrom = glowValue; glowStartTime = now; glowTarget = newTarget; glowSettled = false;
      if (!glowWillChangeActive && glowEl) { glowEl.style.willChange = 'transform, opacity'; glowWillChangeActive = true; }
    }

    function updateGlow(now: number) {
      if (glowSettled || !glowEl) return;
      var elapsed = now - glowStartTime;
      var dur = glowTarget === 1 ? GLOW_RISE_DUR : GLOW_FALL_DUR;
      var t = Math.min(elapsed / dur, 1);
      if (glowTarget === 1) { glowValue = glowFrom + (1 - glowFrom) * easeOutPower4(t); }
      else { glowValue = glowFrom * (1 - easeInPower4(t)); }
      var opacity: number;
      if (glowValue >= 0.2) { opacity = 1; }
      else if (glowTarget === 1) { opacity = glowValue / 0.2; }
      else { var t2 = glowValue / 0.2; opacity = t2 * t2 * t2; }
      if (t >= 1) {
        glowValue = glowTarget; opacity = glowTarget === 1 ? 1 : 0; glowSettled = true;
        if (glowTarget === 0 && glowWillChangeActive) { glowEl.style.willChange = 'auto'; glowWillChangeActive = false; }
      }
      glowEl.style.transform = 'translate(-50%, -50%) scale(' + glowValue + ')';
      glowEl.style.opacity = String(opacity);
    }

    var CYCLE = 7000, AUTO_GLOW_ON_END = 1000, AUTO_BTN_ON_END = 1300, INITIAL_DELAY = 600;
    var cycleStart = 0, lastMouseLeaveTime = 0, MOUSE_COOLDOWN = 3000;

    var starsState = {
      triggerAuto: 0, triggerManual: 0, btnElement: btn,
      wake: null as (() => void) | null, dispose: null as (() => void) | null
    };

    // =========================================================
    // THREE.JS STARS ENGINE
    // =========================================================
    function createStarsEngine(THREE: any, RoundedBoxGeometry: any, RoomEnvironment: any, BufferGeometryUtils: any, starsContainer: HTMLElement, starsState: any) {
      var _disposed = false;
      var CLEAR_COLOR = '#ffffff', MIN_Y_DRIFT_PX = 30, Y_MULT = 2.0, CURVE_PEAK_PX = 24 * Y_MULT, PARTICLE_COUNT = 14;
      var containerConfig = { width: 326, offsetX: 0, offsetY: -4, minY: -44, maxY: 55 };
      var state = { particles: [] as any[], pixelToUnit: 0.01, mouse: new THREE.Vector2(0, 0), sizeScaleFactor: 1.0, sceneSeed: 1, hasActiveParticles: false };
      var centerCache = { x: 0, y: 0 };
      var btnRectCache = { cx: 0, cy: 0, width: 0, height: 0 };
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.z = 15;
      var renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      renderer.setScissorTest(true);
      starsContainer.appendChild(renderer.domElement);
      var _envMapReady = false, _envMapIdleId = 0;
      function _generateEnvMap() {
        if (_envMapReady || _disposed) return;
        var pmremGenerator = new THREE.PMREMGenerator(renderer);
        scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        pmremGenerator.dispose(); _envMapReady = true;
      }
      if (typeof window.requestIdleCallback === 'function') { _envMapIdleId = window.requestIdleCallback(_generateEnvMap); }
      else { setTimeout(_generateEnvMap, 500); }
      scene.add(new THREE.AmbientLight(0xffffff, 1.0));
      var dirLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
      dirLight.position.set(5, 10, 7); scene.add(dirLight);
      function setMouseFromClient(clientX: number, clientY: number) { state.mouse.x = (clientX / window.innerWidth) * 2 - 1; state.mouse.y = -(clientY / window.innerHeight) * 2 + 1; }
      function mouseHandler(e: MouseEvent) { setMouseFromClient(e.clientX, e.clientY); }
      function touchHandler(e: TouchEvent) { if (e.touches.length > 0) { setMouseFromClient(e.touches[0].clientX, e.touches[0].clientY); } }
      function btnPointerDown(e: PointerEvent) { setMouseFromClient(e.clientX, e.clientY); }
      function btnTouchStart(e: TouchEvent) { if (e.touches && e.touches[0]) { setMouseFromClient(e.touches[0].clientX, e.touches[0].clientY); } }
      function hash32(x: number) { x |= 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return (x ^ (x >>> 16)) >>> 0; }
      var UNIT_T = 0.40, UNIT_S = 1.0, UNIT_D = 0.36, UNIT_R = 0.16;
      var unitVGeom = new RoundedBoxGeometry(UNIT_T, UNIT_S, UNIT_D, 4, UNIT_R);
      var unitHGeom = new RoundedBoxGeometry(UNIT_S, UNIT_T, UNIT_D, 4, UNIT_R);
      var crossGeom = BufferGeometryUtils.mergeGeometries([unitVGeom, unitHGeom], false);
      unitVGeom.dispose(); unitHGeom.dispose();
      var threeRunning = false, canvasVisible = true;
      function wakeThreeLoop() {
        if (!_envMapReady) _generateEnvMap();
        if (!threeRunning) {
          threeRunning = true; cacheButtonRect(); updateResponsiveConfig();
          document.addEventListener('mousemove', mouseHandler);
          document.addEventListener('touchmove', touchHandler, { passive: true });
          if (!canvasVisible) { renderer.domElement.style.visibility = 'visible'; canvasVisible = true; }
          clock.getDelta(); requestAnimationFrame(animate);
        }
      }
      starsState.wake = wakeThreeLoop;
      var LUT_SIZE = 256;
      var LUT_tyPx = new Float32Array(LUT_SIZE), LUT_rP = new Float32Array(LUT_SIZE), LUT_op = new Float32Array(LUT_SIZE), LUT_sc = new Float32Array(LUT_SIZE);
      (function buildLUT() {
        for (var i = 0; i < LUT_SIZE; i++) {
          var p = i / (LUT_SIZE - 1), pScale = Math.min(1.0, p / 0.6);
          var tyPx: number, rP: number, op: number, sc: number, k: number;
          if (p < 0.15) { k = p/0.15; tyPx = 12-(6*k); rP = k*0.15; }
          else if (p < 0.28) { k = (p-0.15)/0.13; tyPx = 6-(6*k); rP = 0.15+k*0.13; }
          else if (p < 0.35) { k = (p-0.28)/0.07; tyPx = 0-(3*k); rP = 0.28+k*0.07; }
          else if (p < 0.40) { k = (p-0.35)/0.05; tyPx = -3-(2*k); rP = 0.35+k*0.05; }
          else if (p < 0.45) { k = (p-0.40)/0.05; tyPx = -5-(2*k); rP = 0.40+k*0.05; }
          else if (p < 0.52) { k = (p-0.45)/0.07; tyPx = -7-(3*k); rP = 0.45+k*0.07; }
          else if (p < 0.65) { k = (p-0.52)/0.13; tyPx = -10-(6*k); rP = 0.52+k*0.13; }
          else { k = (p-0.65)/0.35; tyPx = -16-(8*k); rP = 0.65+k*0.35; }
          if (pScale < 0.15) { k = pScale/0.15; op = k; sc = k; }
          else if (pScale < 0.28) { op = 1; sc = 1; }
          else if (pScale < 0.35) { k = (pScale-0.28)/0.07; op = 1; sc = 1+k*0.15; }
          else if (pScale < 0.40) { k = (pScale-0.35)/0.05; op = 1; sc = 1.15-k*0.20; }
          else if (pScale < 0.45) { k = (pScale-0.40)/0.05; op = 1; sc = 0.95+k*0.25; }
          else if (pScale < 0.52) { k = (pScale-0.45)/0.07; op = 1; sc = 1.2-k*0.3; }
          else if (pScale < 0.65) { k = (pScale-0.52)/0.13; op = 1; sc = 0.9-k*0.1; }
          else { k = (pScale-0.65)/0.35; op = 1-k; sc = 0.8-k*0.5; }
          LUT_tyPx[i] = tyPx; LUT_rP[i] = rP; LUT_op[i] = op; LUT_sc[i] = sc;
        }
      })();
      var _baseMaterialAuto = new THREE.MeshStandardMaterial({ color: CLEAR_COLOR, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.5, side: THREE.DoubleSide, emissive: '#000000', emissiveIntensity: 0 });
      var _baseMaterialManualBlack = new THREE.MeshStandardMaterial({ color: '#000000', transparent: true, opacity: 1, roughness: 0.3, metalness: 0.1, envMapIntensity: 1.0, side: THREE.DoubleSide, emissive: '#000000', emissiveIntensity: 0.4 });
      var _baseMaterialManualRed = new THREE.MeshStandardMaterial({ color: '#e24132', transparent: true, opacity: 1, roughness: 0.3, metalness: 0.1, envMapIntensity: 1.0, side: THREE.DoubleSide, emissive: '#e24132', emissiveIntensity: 0.4 });

      class VelvetParticle {
        index: number; mesh: any; seed: number; material: any; alive: boolean;
        baseOpacity = 0; meshScale = 0; baseX = 0; baseY = 0; duration = 0; delay = 0; timer = 0;
        rotX = 0; rotY = 0; rotZ = 0; initialSpinX = 0; initialSpinY = 0; initialSpinZ = 0;
        yMultiplier = 1; yBoost = 1; mass = 1;
        repelX = 0; repelY = 0; velocityX = 0; velocityY = 0; prevVelX = 0; prevVelY = 0;
        spinVelocity = 0; cumulativeSpin = 0;
        constructor(i: number) {
          this.index = i; this.mesh = new THREE.Mesh(crossGeom, null);
          this.seed = hash32(state.sceneSeed ^ Math.imul(i + 1, 0x9E3779B9));
          this.material = null; this.alive = false;
          scene.add(this.mesh); this.mesh.visible = false; this.mesh.frustumCulled = false;
        }
        random() { var t = this.seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
        spawn(staggerDelay: number, isManual = false) {
          this.alive = true; this.seed = Math.random() * 0xFFFFFFFF;
          var color: string, opacity: number, roughness: number, envIntensity: number, emissiveColor: string, emissiveIntensity: number, isRed = false;
          if (isManual) { isRed = this.random() < 0.15; color = isRed ? '#e24132' : '#000000'; emissiveColor = color; emissiveIntensity = 0.4; opacity = 1; roughness = 0.3; envIntensity = 1.0; }
          else { color = CLEAR_COLOR; emissiveColor = '#000000'; emissiveIntensity = 0; opacity = 0.45; roughness = 0.05; envIntensity = 1.5; }
          this.baseOpacity = opacity;
          if (this.material) { this.material.color.set(color); this.material.emissive.set(emissiveColor); this.material.emissiveIntensity = emissiveIntensity; this.material.opacity = opacity; this.material.roughness = roughness; this.material.envMapIntensity = envIntensity; }
          else { var base = isManual ? (isRed ? _baseMaterialManualRed : _baseMaterialManualBlack) : _baseMaterialAuto; this.material = base.clone(); }
          var scale = state.pixelToUnit || 0.01, sizeRand = this.random(), sizePx: number;
          if (sizeRand < 0.4) sizePx = 20 + this.random() * 9;
          else if (sizeRand < 0.8) sizePx = 28 + this.random() * 10;
          else sizePx = 38 + this.random() * 8;
          sizePx *= state.sizeScaleFactor; this.meshScale = sizePx * scale;
          this.mesh.material = this.material;
          var count = PARTICLE_COUNT, u = (this.index + this.random()) / count;
          var xBasePx = (u - 0.5) * containerConfig.width, xJitterPx = (this.random() - 0.5) * 20;
          this.baseX = (xBasePx + xJitterPx + containerConfig.offsetX) * scale;
          var yRange = containerConfig.maxY - containerConfig.minY;
          var yStartPx = containerConfig.offsetY + containerConfig.minY + this.random() * yRange + (this.random() - 0.5) * 10;
          this.baseY = -yStartPx * scale;
          var speedRand = this.random(), speedMultiplier = 1.0;
          if (speedRand < 0.2) speedMultiplier = 0.67; else if (speedRand > 0.8) speedMultiplier = 1.5;
          this.duration = (1.6 + this.random() * 1.0) * 2 * speedMultiplier;
          this.delay = staggerDelay; this.timer = 0;
          this.rotX = (this.random() - 0.5) * Math.PI * 1.2; this.rotY = (this.random() - 0.5) * Math.PI * 1.2;
          this.rotZ = (this.random() - 0.5) * Math.PI * 3;
          this.initialSpinX = (this.random() - 0.5) * Math.PI * 2; this.initialSpinY = (this.random() - 0.5) * Math.PI * 2;
          this.initialSpinZ = (this.random() - 0.5) * Math.PI * 4;
          this.yMultiplier = this.random() > 0.5 ? 2.0 : 1.0;
          this.yBoost = Math.max(1.0, MIN_Y_DRIFT_PX / (CURVE_PEAK_PX * this.yMultiplier));
          this.mass = 0.8 + this.random() * 0.4;
          this.mesh.visible = true;
          this.repelX = 0; this.repelY = 0; this.velocityX = 0; this.velocityY = 0; this.prevVelX = 0; this.prevVelY = 0; this.spinVelocity = 0; this.cumulativeSpin = 0;
        }
        update(dt: number, center: {x:number;y:number}, mx: number, my: number, ptu: number, repelRadiusSq: number, repelRadius: number, dampDt: number) {
          this.timer += dt; var elapsed = this.timer - this.delay;
          if (elapsed < 0) { this.mesh.visible = false; return; }
          this.mesh.visible = true;
          var p = Math.min(elapsed / this.duration, 1);
          if (p >= 1) { this.alive = false; this.mesh.visible = false; return; }
          var lutIdx = Math.min(255, Math.floor(p * 256));
          var tyPx = LUT_tyPx[lutIdx], rP = LUT_rP[lutIdx], op = LUT_op[lutIdx], sc = LUT_sc[lutIdx];
          var baseTargetX = center.x + this.baseX;
          var baseTargetY = center.y + this.baseY + tyPx * this.yMultiplier * this.yBoost * ptu;
          var dx = mx - baseTargetX, dy = my - baseTargetY, distSq = dx*dx + dy*dy;
          var tx = 0, ty = 0;
          if (distSq < repelRadiusSq && distSq > 0.00001) {
            var dist = Math.sqrt(distSq), invDist = 1 / dist, ratio = (repelRadius - dist) / repelRadius;
            var f = ratio * ratio * 1.2 / this.mass;
            tx = dx * invDist * f; ty = dy * invDist * f;
          }
          var ax = (tx - this.repelX) * 0.15 - this.velocityX * (1 - dampDt);
          var ay = (ty - this.repelY) * 0.15 - this.velocityY * (1 - dampDt);
          var am = (ax > 0 ? ax : -ax) + (ay > 0 ? ay : -ay);
          if (am > 0.0113) { var s2 = 0.0113 / am; ax *= s2; ay *= s2; }
          this.velocityX = (this.velocityX + ax) * dampDt; this.velocityY = (this.velocityY + ay) * dampDt;
          this.repelX += this.velocityX; this.repelY += this.velocityY;
          this.mesh.position.x = baseTargetX + this.repelX; this.mesh.position.y = baseTargetY + this.repelY;
          this.mesh.scale.setScalar(Math.max(0.001, sc * this.meshScale));
          var dVx = this.velocityX - this.prevVelX, dVy = this.velocityY - this.prevVelY;
          var dVm = (dVx > 0 ? dVx : -dVx) + (dVy > 0 ? dVy : -dVy);
          this.spinVelocity += dVm * 14.14; this.spinVelocity = Math.max(-0.2, Math.min(0.2, this.spinVelocity * 0.95));
          this.cumulativeSpin += this.spinVelocity * dt * 60;
          var entryPhase = Math.max(0, 1 - p * 3.33), entryEase = entryPhase * entryPhase;
          var startZ = -Math.PI / 4;
          this.mesh.rotation.set(this.rotX * rP + this.initialSpinX * entryEase, this.rotY * rP + this.initialSpinY * entryEase, startZ + (this.rotZ * rP) + this.initialSpinZ * entryEase + this.cumulativeSpin);
          this.prevVelX = this.velocityX; this.prevVelY = this.velocityY;
          var newOp = this.baseOpacity * op; if (this.material.opacity !== newOp) { this.material.opacity = newOp; }
        }
        dispose() { scene.remove(this.mesh); if (this.material) this.material.dispose(); }
      }

      function updatePixelScale() { var h = window.innerHeight; if (h === 0) { state.pixelToUnit = 0.01; return; } state.pixelToUnit = (2 * Math.tan(camera.fov * Math.PI / 360) * camera.position.z) / h; }
      var btnPageCx = 0, btnPageCy = 0;
      function cacheButtonRect() { var btnEl = starsState?.btnElement; if (!btnEl) return; var rect = btnEl.getBoundingClientRect(); if (rect.width < 20) return; btnRectCache.width = rect.width; btnRectCache.height = rect.height; btnPageCx = rect.left + rect.width / 2 + window.scrollX; btnPageCy = rect.top + rect.height / 2 + window.scrollY; btnRectCache.cx = rect.left + rect.width / 2; btnRectCache.cy = rect.top + rect.height / 2; }
      function updateButtonRectFromScroll() { btnRectCache.cx = btnPageCx - window.scrollX; btnRectCache.cy = btnPageCy - window.scrollY; }
      function updateResponsiveConfig() { var bw = btnRectCache.width, bh = btnRectCache.width > 0 ? (btnRectCache.height || btnRectCache.width * 0.5) : 0; if (bw < 20) return; containerConfig.width = bw * 1.12; containerConfig.offsetX = 0; containerConfig.offsetY = -bh * 0.05; containerConfig.minY = -bh * 0.65; containerConfig.maxY = bh * 0.85; state.sizeScaleFactor = (bw / 290) * (window.innerWidth < 600 ? 2 : 1.4); }
      function initParticles() { for (var i = 0; i < state.particles.length; i++) state.particles[i].dispose(); state.particles = []; state.sceneSeed = (Math.random() * 0xFFFFFFFF) >>> 0; for (var i = 0; i < PARTICLE_COUNT; i++) { state.particles.push(new VelvetParticle(i)); } }
      function triggerBatch(isManual = false) {
        cacheButtonRect(); updateResponsiveConfig();
        var available: number[] = [];
        for (var i = 0; i < PARTICLE_COUNT; i++) { if (!state.particles[i].alive) available.push(i); }
        if (available.length === 0) return;
        var toAdd = Math.min(available.length, 5 + Math.floor(Math.random() * 4));
        for (var i = available.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = available[i]; available[i] = available[j]; available[j] = tmp; }
        for (var j = 0; j < toAdd; j++) { var i = available[j]; var baseDelay = (j / toAdd) * 0.15; state.particles[i].spawn(baseDelay + Math.random() * 0.05, isManual); }
        wakeThreeLoop();
      }
      var clock = new THREE.Clock();
      var viewportHalfHeight = camera.position.z * Math.tan(camera.fov * Math.PI / 360);
      var RENDER_INTERVAL = 15, lastRenderTime = 0;
      function animate(now: number) {
        var dt = Math.min(clock.getDelta(), 0.1), dampDt = Math.pow(0.85, dt * 60);
        while (starsState.triggerAuto > 0) { starsState.triggerAuto--; triggerBatch(false); }
        while (starsState.triggerManual > 0) { starsState.triggerManual--; triggerBatch(true); }
        var ptu = state.pixelToUnit || 0.01, repelRadius = 280 * ptu, repelRadiusSq = repelRadius * repelRadius;
        centerCache.x = (btnRectCache.cx - window.innerWidth / 2) * ptu;
        centerCache.y = -(btnRectCache.cy - window.innerHeight / 2) * ptu;
        var mx = state.mouse.x * viewportHalfHeight * camera.aspect, my = state.mouse.y * viewportHalfHeight;
        var anyAlive = false, particles = state.particles;
        for (var i = 0; i < particles.length; i++) { var p = particles[i]; p.update(dt, centerCache, mx, my, ptu, repelRadiusSq, repelRadius, dampDt); if (p.alive) anyAlive = true; }
        if ((window as any)._blok45Debug) (window as any)._blok45Debug.starsActive = anyAlive;
        if (anyAlive && (now - lastRenderTime >= RENDER_INTERVAL)) {
          var dpr = renderer.getPixelRatio(), margin = Math.min(window.innerWidth * 0.6, 500);
          var sx = Math.max(0, btnRectCache.cx - margin), sy = Math.max(0, btnRectCache.cy - margin * 1.3);
          var sw = Math.min(margin * 2, window.innerWidth - sx), sh = Math.min(margin * 2.6, window.innerHeight - sy);
          renderer.setScissor(sx * dpr, (window.innerHeight - sy - sh) * dpr, sw * dpr, sh * dpr);
          renderer.setViewport(0, 0, window.innerWidth * dpr, window.innerHeight * dpr);
          renderer.render(scene, camera); lastRenderTime = now;
        }
        if (!anyAlive) {
          threeRunning = false;
          document.removeEventListener('mousemove', mouseHandler); document.removeEventListener('touchmove', touchHandler);
          if (canvasVisible) { renderer.domElement.style.visibility = 'hidden'; canvasVisible = false; }
          return;
        }
        requestAnimationFrame(animate);
      }
      function _onThreeResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); updatePixelScale(); cacheButtonRect(); updateResponsiveConfig(); }
      window.addEventListener('resize', _onThreeResize);
      function _onThreeScroll() { updateButtonRectFromScroll(); }
      window.addEventListener('scroll', _onThreeScroll, { passive: true });
      updatePixelScale(); initParticles();
      renderer.domElement.style.visibility = 'hidden'; canvasVisible = false;
      setTimeout(function() {
        cacheButtonRect(); updateResponsiveConfig();
        var btnEl = starsState?.btnElement;
        if (btnEl) { btnEl.addEventListener('pointerdown', btnPointerDown, { passive: true }); btnEl.addEventListener('touchstart', btnTouchStart, { passive: true }); }
      }, 100);
      function dispose() {
        if (_disposed) return; _disposed = true;
        if (_envMapIdleId && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(_envMapIdleId);
        window.removeEventListener('resize', _onThreeResize); window.removeEventListener('scroll', _onThreeScroll);
        var btnEl = starsState.btnElement;
        if (btnEl) { btnEl.removeEventListener('pointerdown', btnPointerDown); btnEl.removeEventListener('touchstart', btnTouchStart); }
        document.removeEventListener('mousemove', mouseHandler); document.removeEventListener('touchmove', touchHandler);
        state.particles.forEach(function(p: any) { p.dispose(); });
        crossGeom.dispose(); _baseMaterialAuto.dispose(); _baseMaterialManualBlack.dispose(); _baseMaterialManualRed.dispose();
        if (renderer) { renderer.dispose(); if (renderer.domElement && renderer.domElement.parentNode) { renderer.domElement.parentNode.removeChild(renderer.domElement); } }
        if (scene.environment) scene.environment.dispose();
      }
      return { wake: wakeThreeLoop, dispose: dispose };
    }

    // =========================================================
    // THREE.JS LAZY LOADING
    // =========================================================
    var _webglSupported = (function() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch(e) { return false; } })();
    var _threeDepsPromise: Promise<any[]> | null = null;
    var _starsEngine: { wake: () => void; dispose: () => void } | null = null;
    var _starsEnginePromise: Promise<any> | null = null;

    function loadThreeDeps() {
      if (!_threeDepsPromise) {
        var BASE = 'https://cdn.jsdelivr.net/npm/three@0.160.0';
        _threeDepsPromise = Promise.all([
          import(/* webpackIgnore: true */ BASE + '/build/three.module.js'),
          import(/* webpackIgnore: true */ BASE + '/examples/jsm/geometries/RoundedBoxGeometry.js'),
          import(/* webpackIgnore: true */ BASE + '/examples/jsm/environments/RoomEnvironment.js'),
          import(/* webpackIgnore: true */ BASE + '/examples/jsm/utils/BufferGeometryUtils.js')
        ]);
      }
      return _threeDepsPromise;
    }

    function ensureStarsEngine() {
      if (!_webglSupported) return Promise.resolve(null);
      if (_starsEngine) return Promise.resolve(_starsEngine);
      if (_starsEnginePromise) return _starsEnginePromise;
      _starsEnginePromise = loadThreeDeps().then(function(deps) {
        if (isDead) return null;
        var THREE = deps[0], RoundedBoxGeometry = deps[1].RoundedBoxGeometry, RoomEnvironment = deps[2].RoomEnvironment, BufferGeometryUtils = deps[3];
        var starsContainer = $id('blok-4-5-stars-canvas') as HTMLElement | null;
        if (!starsContainer) return null;
        _starsEngine = createStarsEngine(THREE, RoundedBoxGeometry, RoomEnvironment, BufferGeometryUtils, starsContainer, starsState);
        starsState.wake = _starsEngine!.wake; starsState.dispose = _starsEngine!.dispose;
        if (starsState.triggerAuto > 0 || starsState.triggerManual > 0) { starsState.wake!(); }
        return _starsEngine;
      }).catch(function(err: any) { console.warn('[blok-4-5] Stars engine init failed:', err); return null; }).finally(function() { _starsEnginePromise = null; });
      return _starsEnginePromise;
    }

    if (_webglSupported) {
      if (typeof window.requestIdleCallback === 'function') {
        var _warmupId = window.requestIdleCallback(function() { loadThreeDeps(); });
        timerIds.push({ type: 'idle', id: _warmupId });
      } else {
        var _warmupTid = setTimeout(function() { loadThreeDeps(); }, 500);
        timerIds.push({ type: 'timeout', id: _warmupTid });
      }
    }

    var lastTouchTime = 0;
    function onBtnTouchStart() { lastTouchTime = performance.now(); mouseOver = true; startGlowTick(); }
    function onBtnTouchEnd() { lastTouchTime = performance.now(); mouseOver = false; lastMouseLeaveTime = performance.now(); cycleStart = performance.now() + MOUSE_COOLDOWN - CYCLE; }
    function onBtnMouseEnter() { if (performance.now() - lastTouchTime < 1000) return; mouseOver = true; startGlowTick(); }
    function onBtnMouseLeave() { mouseOver = false; lastMouseLeaveTime = performance.now(); cycleStart = performance.now() + MOUSE_COOLDOWN - CYCLE; }
    function onBtnClick() { starsState.triggerManual++; if (starsState.wake) starsState.wake(); else ensureStarsEngine(); }
    function onBtnPointerDown() { if (btnWrap) btnWrap.classList.add('is-active'); }
    function onBtnPointerUp() { if (btnWrap) btnWrap.classList.remove('is-active'); }
    function onBtnPointerLeave() { if (btnWrap) btnWrap.classList.remove('is-active'); }

    if (btn) {
      btn.addEventListener('touchstart', onBtnTouchStart, { passive: true });
      btn.addEventListener('touchend', onBtnTouchEnd, { passive: true });
      btn.addEventListener('touchcancel', onBtnTouchEnd, { passive: true });
      btn.addEventListener('mouseenter', onBtnMouseEnter);
      btn.addEventListener('mouseleave', onBtnMouseLeave);
      btn.addEventListener('click', onBtnClick);
      btn.addEventListener('pointerdown', onBtnPointerDown);
      btn.addEventListener('pointerup', onBtnPointerUp);
      btn.addEventListener('pointercancel', onBtnPointerUp);
      btn.addEventListener('pointerleave', onBtnPointerLeave);
      cleanups.push(function() {
        btn!.removeEventListener('touchstart', onBtnTouchStart); btn!.removeEventListener('touchend', onBtnTouchEnd); btn!.removeEventListener('touchcancel', onBtnTouchEnd);
        btn!.removeEventListener('mouseenter', onBtnMouseEnter); btn!.removeEventListener('mouseleave', onBtnMouseLeave); btn!.removeEventListener('click', onBtnClick);
        btn!.removeEventListener('pointerdown', onBtnPointerDown); btn!.removeEventListener('pointerup', onBtnPointerUp); btn!.removeEventListener('pointercancel', onBtnPointerUp); btn!.removeEventListener('pointerleave', onBtnPointerLeave);
      });
    }

    var prevBtnEffective = false, hoverClassApplied = false, tickIOVisible = false, autoWakeTimer = 0;

    function needsTickFrames(now: number) { var inCooldown = (now - lastMouseLeaveTime) < MOUSE_COOLDOWN && lastMouseLeaveTime > 0; var e = (now - (cycleStart || 0)) % CYCLE; return mouseOver || !glowSettled || (!inCooldown && e < AUTO_BTN_ON_END); }
    function startGlowTick() { if (tickIOVisible && !document.hidden) { gsap.ticker.add(glowTickFn); } }
    function scheduleAutoWake() {
      if (autoWakeTimer) clearTimeout(autoWakeTimer);
      var now = performance.now(), inCooldown = (now - lastMouseLeaveTime) < MOUSE_COOLDOWN && lastMouseLeaveTime > 0, delay: number;
      if (inCooldown) { delay = MOUSE_COOLDOWN - (now - lastMouseLeaveTime) + 50; }
      else { var e = (now - (cycleStart || 0)) % CYCLE; delay = CYCLE - e + 10; }
      autoWakeTimer = setTimeout(startGlowTick, delay);
      timerIds.push({ type: 'timeout', id: autoWakeTimer });
    }

    function glowTickFn() {
      var now = performance.now();
      if (!tickIOVisible || document.hidden) { gsap.ticker.remove(glowTickFn); scheduleAutoWake(); return; }
      if (!cycleStart) cycleStart = now - (CYCLE - INITIAL_DELAY);
      var inCooldown = (now - lastMouseLeaveTime) < MOUSE_COOLDOWN && lastMouseLeaveTime > 0;
      var e = (now - cycleStart) % CYCLE;
      var autoGlowWants = !inCooldown && e < AUTO_GLOW_ON_END, autoBtnWants = !inCooldown && e < AUTO_BTN_ON_END;
      var btnEffective = autoBtnWants || mouseOver, glowEffective = autoGlowWants || mouseOver;
      if (btnEffective && !prevBtnEffective) {
        if (mouseOver) { starsState.triggerManual++; } else { starsState.triggerAuto++; }
        if (starsState.wake) starsState.wake(); else ensureStarsEngine();
      }
      prevBtnEffective = btnEffective;
      if (btnWrap) {
        if (btnEffective && !hoverClassApplied) { btnWrap.classList.add('anim-hover'); hoverClassApplied = true; }
        else if (!btnEffective && hoverClassApplied) { btnWrap.classList.remove('anim-hover'); hoverClassApplied = false; }
      }
      if ((glowEffective ? 1 : 0) !== glowTarget) { setGlowTarget(glowEffective ? 1 : 0, now); }
      updateGlow(now);
      if (!needsTickFrames(now)) { gsap.ticker.remove(glowTickFn); scheduleAutoWake(); }
    }

    var glowIO = new IntersectionObserver(function(entries) {
      if (!entries[0]) return;
      tickIOVisible = entries[0].isIntersecting;
      if (tickIOVisible && !document.hidden) startGlowTick();
      else { gsap.ticker.remove(glowTickFn); scheduleAutoWake(); }
    }, { threshold: 0.1 });
    var konwersjaWrap = $('.konwersja-wrap');
    if (konwersjaWrap) glowIO.observe(konwersjaWrap);
    observers.push(glowIO);
    function onVisChange() { if (document.hidden) { gsap.ticker.remove(glowTickFn); } else if (tickIOVisible) startGlowTick(); }
    document.addEventListener('visibilitychange', onVisChange);
    cleanups.push(function() { document.removeEventListener('visibilitychange', onVisChange); });

    // =========================================================
    // WALKING ANIMATION
    // =========================================================
    var DRAG_MULT = [2.8, 2.1, 1.7, 1.3, 1.1, 0.8, 0.8, 0.8, 0.8, 0.8];
    var MASS_TABLE = [1.2, 1.0, 0.7, 0.7, 0.7, 0.4, 0.4, 0.4, 0.4, 0.4];
    var EMIT_CHANCE = [0.90, 0.90, 0.90, 0.50, 0.50, 0.20, 0.20, 0.05, 0.05];
    var WORD_POOL = ['Spieszę się.', 'Później wrócę.', 'Szkoda czasu.', 'Muszę lecieć.', 'Innym razem.', 'Tylko oglądam.', 'Może kiedyś.', 'Nie rozumiem tego.', 'Kto to jest?', 'Jeszcze pomyślę.', 'Może później.', 'Hm?', 'Ej!', 'Serio?', 'Daj spokój', 'Osz!', 'Niee!', 'Aaaaa', 'Pomocy!', 'Weź...', 'Znowu?', 'Puszczaj!'];

    var SPRITES = {
      smoke: null as HTMLCanvasElement | null, star: null as HTMLCanvasElement | null, fire: null as HTMLCanvasElement | null,
      init: function() {
        var sm = document.createElement('canvas'); sm.width = 64; sm.height = 64;
        var sCtx = sm.getContext('2d')!;
        var grad = sCtx.createRadialGradient(32,32,0,32,32,32); grad.addColorStop(0,'hsla(40,15%,55%,0.5)'); grad.addColorStop(0.5,'hsla(40,10%,65%,0.25)'); grad.addColorStop(1,'transparent');
        sCtx.fillStyle = grad; sCtx.fillRect(0,0,64,64); this.smoke = sm;
        var st = document.createElement('canvas'); st.width = 32; st.height = 32;
        var stCtx = st.getContext('2d')!; stCtx.fillStyle = '#fec708'; stCtx.shadowColor = '#fec708'; stCtx.shadowBlur = 8;
        this.drawStar(stCtx,16,16,5,14,5.6); this.star = st;
        var fi = document.createElement('canvas'); fi.width = 64; fi.height = 64;
        var fCtx = fi.getContext('2d')!;
        var fGrad = fCtx.createRadialGradient(32,32,0,32,32,32); fGrad.addColorStop(0,'#fff'); fGrad.addColorStop(0.3,'#ffaa44'); fGrad.addColorStop(1,'rgba(224,88,27,0)');
        fCtx.fillStyle = fGrad; fCtx.fillRect(0,0,64,64); this.fire = fi;
      },
      drawStar: function(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outer: number, inner: number) {
        var rot = Math.PI/2*3, step = Math.PI/spikes; ctx.beginPath(); ctx.moveTo(cx, cy-outer);
        for (var i = 0; i < spikes; i++) { ctx.lineTo(cx+Math.cos(rot)*outer,cy+Math.sin(rot)*outer); rot+=step; ctx.lineTo(cx+Math.cos(rot)*inner,cy+Math.sin(rot)*inner); rot+=step; }
        ctx.closePath(); ctx.fill();
      }
    };

    var POOL_SIZE = 400, POOL: any[] = [], poolActive = 0;
    function initPool() {
      for (var i = 0; i < POOL_SIZE; i++) {
        POOL[i] = { type:0,x:0,y:0,vx:0,vy:0,life:0,decay:0,size:0,growRate:0,rotation:0,rSpeed:0,gravity:0,drag:0,hue:0,alpha:0,lineWidth:0,charIndex:-1,offsetX:0,localBaseY:0,maxRise:0,anchorX:0,anchorY:0,localX:0,localY:0,colorA:'',colorB:'',debrisColor:'',cosA:1,sinA:0,cosR:1,sinR:0 };
      }
    }

    var CONFIG = { text: 'wychodzą.', walkStride: 20, walkLift: 6, walkSpeed: 0.05 };
    var chars: HTMLElement[] = [], charStates: any[] = [];
    var walkTime = 0, wordOffsetX = 0, anchorScrollY = 0, anchorOffsetX = 0, lastScrollY = 0;
    var scrollUpVelocity = 0, pullStrength = 0, isScrollingDown = false;
    var currentMode = 'escape', visualBlend = 0;
    var hasStarted = false, isDead = false, isReturning = false;
    var elasticTime = 0, elasticActive = false, physicsSettled = false, frameCount = 0;
    var mana = 0, manaActivated = false, manaComplete = false, MANA_MAX = 375;
    var smokeCanvas: HTMLCanvasElement | null, smokeCtx: CanvasRenderingContext2D | null;
    var sparksCanvas: HTMLCanvasElement | null, sparksCtx: CanvasRenderingContext2D | null;
    var iStarCanvas: HTMLCanvasElement | null, iStarCtx: CanvasRenderingContext2D | null, iStarWrapper: HTMLElement | null;
    var manaContainer: HTMLElement | null, manaBar: HTMLElement | null;
    var _containerEl: HTMLElement | null = null, _anchorCharEl: Element | null = null;

    var frameCache = {
      containerLeft:0,containerTop:0,containerTransformX:0,anchorBottom:0,firstLeft:0,firstBottom:0,firstRight:0,
      gritFloorY:0,fontScale:1,cachedFloorOffset:-16,valid:false,
      containerPageLeft:0,containerPageTop:0,anchorPageBottom:0,charOffsetTop:0,charOffsetHeight:0,charOffsetWidths:[] as number[]
    };

    function cacheBaseMetrics() {
      if (!_containerEl) return;
      var cr = _containerEl.getBoundingClientRect(); frameCache.containerPageLeft = cr.left + window.scrollX; frameCache.containerPageTop = cr.top + window.scrollY;
      if (_anchorCharEl) { var ar = _anchorCharEl.getBoundingClientRect(); frameCache.anchorPageBottom = ar.bottom + window.scrollY; }
      if (chars[0]) { frameCache.charOffsetTop = chars[0].offsetTop; frameCache.charOffsetHeight = chars[0].offsetHeight; }
      frameCache.charOffsetWidths = chars.map(function(c) { return c.offsetWidth; });
    }
    function updateFrameCache() {
      if (!_containerEl) { frameCache.valid = false; return; }
      var sy = lastScrollY; frameCache.containerTransformX = wordOffsetX * visualBlend;
      frameCache.containerLeft = frameCache.containerPageLeft; frameCache.containerTop = frameCache.containerPageTop - sy;
      frameCache.anchorBottom = frameCache.anchorPageBottom - sy;
      if (chars[0]) {
        var fLeft = frameCache.containerLeft + frameCache.containerTransformX + charStates[0].baseOffsetLeft + charStates[0].finalX;
        var fTop = frameCache.containerTop + frameCache.charOffsetTop + charStates[0].finalY;
        var fBottom = fTop + frameCache.charOffsetHeight;
        frameCache.firstLeft = fLeft; frameCache.firstBottom = fBottom; frameCache.firstRight = fLeft + (frameCache.charOffsetWidths[0] || 0); frameCache.gritFloorY = fBottom;
      }
      frameCache.valid = true;
    }
    function updateCachedFontSize() { if (chars[0]) { var fs = parseFloat(getComputedStyle(chars[0]).fontSize); frameCache.fontScale = fs / 40; frameCache.cachedFloorOffset = -0.4 * fs; } }

    // BUBBLES
    var bubbles: {b1:HTMLElement|null;b2:HTMLElement|null;b3:HTMLElement|null} = {b1:null,b2:null,b3:null};
    var bubbleTypes = {b1:'speech',b2:'thought',b3:'speech'};
    var activeTargets: {b1:number|null;b2:number|null;b3:number|null} = {b1:null,b2:null,b3:null};
    var activeBubbleCount = 0, lastUsedWords: string[] = [], lastTriggerTime = 0, sequenceTimeouts: number[] = [], cleanupTimer: number | null = null;
    var bubbleFirstPullDone = false;

    function initBubbles() {
      var layer = $id('blok-4-5-bubble-layer'); if (!layer) return; layer.innerHTML = '';
      (['b1','b2','b3'] as const).forEach(function(k) { var b = document.createElement('div'); b.className = bubbleTypes[k] === 'thought' ? 'thought-bubble' : 'speech-bubble'; layer!.appendChild(b); bubbles[k] = b; });
    }
    function getUniqueWord() {
      var available = WORD_POOL.filter(function(w) { return !lastUsedWords.includes(w); });
      if (available.length === 0) { lastUsedWords = []; available = WORD_POOL.slice(); }
      var word = available[Math.floor(Math.random() * available.length)]; lastUsedWords.push(word); if (lastUsedWords.length > 10) lastUsedWords.shift(); return word;
    }
    function triggerSpeechSequence() {
      sequenceTimeouts.forEach(function(id) { clearTimeout(id); }); sequenceTimeouts = [];
      if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = null; }
      var freeSlots: Array<'b1'|'b2'|'b3'> = [];
      (['b1','b2','b3'] as const).forEach(function(k) { if (activeTargets[k] === null) freeSlots.push(k); });
      if (freeSlots.length === 0) return;
      var wantedCount = Math.random() < 0.50 ? 2 : 3, count = Math.min(wantedCount, freeSlots.length);
      if (count === 0) return;
      var patterns3 = [[0,3,6],[1,4,7],[0,4,8],[2,5,8]];
      var allIndices = count === 3 ? patterns3[Math.floor(Math.random()*4)] : count === 2 ? [0,4].sort(function(){return Math.random()-0.5;}) : [Math.floor(Math.random()*6)];
      var indices = allIndices.slice(0, count), scales = [0.85,1.0,1.15].sort(function(){return Math.random()-0.5;});
      indices.forEach(function(charIndex, i) {
        var key = freeSlots[i]; if (!key) return;
        var bubble = bubbles[key], word = getUniqueWord(); activeTargets[key] = charIndex;
        var startDelay = i === 0 ? 0 : Math.random() * 300;
        var tid1 = setTimeout(function() { if (!bubble) return; bubble.textContent = word; (bubble as HTMLElement).style.fontSize = (scales[i]||1)+'em'; bubble.classList.add('visible'); activeBubbleCount++; }, startDelay);
        sequenceTimeouts.push(tid1); timerIds.push({type:'timeout',id:tid1});
        var totalDuration = startDelay + 1500 + Math.random() * 500;
        var tid2 = setTimeout(function() { if (!bubble) return; bubble.classList.remove('visible'); activeTargets[key] = null; activeBubbleCount--; }, totalDuration);
        sequenceTimeouts.push(tid2); timerIds.push({type:'timeout',id:tid2});
      });
      var cTid = setTimeout(function() { (['b1','b2','b3'] as const).forEach(function(k){activeTargets[k]=null;}); activeBubbleCount=0; cleanupTimer=null; }, 3000);
      cleanupTimer = cTid; timerIds.push({type:'timeout',id:cTid});
    }
    function updateBubblePositions() {
      (['b1','b2','b3'] as const).forEach(function(k) {
        var charIndex = activeTargets[k], bubble = bubbles[k];
        if (charIndex === null || !bubble || !frameCache.valid || !chars[charIndex]) return;
        var s = charStates[charIndex];
        var lx = frameCache.containerLeft + frameCache.containerTransformX + s.baseOffsetLeft + s.finalX + (frameCache.charOffsetWidths[charIndex]||0)/2;
        var ly = frameCache.containerTop + frameCache.charOffsetTop + s.finalY;
        var bw = bubble.offsetWidth;
        bubble.style.transform = 'translate('+(lx-bw/2)+'px,'+(ly-bubble.offsetHeight-18)+'px)';
      });
    }

    function initStarCanvas() { iStarWrapper = $id('blok-4-5-iHeatWrapper') as HTMLElement|null; iStarCanvas = $id('blok-4-5-iHeatCanvas') as HTMLCanvasElement|null; if (iStarCanvas) iStarCtx = iStarCanvas.getContext('2d'); }
    function spawnStars() { if (!_starsEngine && _webglSupported) ensureStarsEngine(); starsState.triggerManual += 3; if (starsState.wake) starsState.wake(); }
    function initCanvases() {
      smokeCanvas = $id('blok-4-5-particleCanvas') as HTMLCanvasElement|null; if (smokeCanvas) smokeCtx = smokeCanvas.getContext('2d');
      sparksCanvas = $id('blok-4-5-sparksCanvas') as HTMLCanvasElement|null; if (sparksCanvas) sparksCtx = sparksCanvas.getContext('2d');
    }
    function resizeCanvases() {
      if (smokeCanvas) { smokeCanvas.width = window.innerWidth+200; smokeCanvas.height = 150; }
      if (sparksCanvas) { sparksCanvas.width = window.innerWidth; sparksCanvas.height = window.innerHeight; }
      updateCachedFontSize(); cacheBaseMetrics();
      Object.values(bubbles).forEach(function(b){return b&&b.classList.remove('visible');});
      (['b1','b2','b3'] as const).forEach(function(k){activeTargets[k]=null;}); activeBubbleCount=0;
    }

    // =========================================================
    // PARTICLE SYSTEM
    // =========================================================
    var canvasOffsetX = 100, canvasOffsetY = 50, fireQueue = new Array(64), fireCount = 0;

    function spawnParticle(type: number, x: number, y: number, opts: any) {
      if (poolActive >= POOL_SIZE) return null;
      var p = POOL[poolActive++], vs = frameCache.fontScale || 0.8;
      p.type=type;p.x=x;p.y=y;p.life=1.0;p.vx=0;p.vy=0;p.gravity=0;p.drag=1;p.rotation=0;p.rSpeed=0;p.size=0;p.growRate=0;p.charIndex=-1;p.offsetX=0;p.localBaseY=0;p.maxRise=0;p.anchorX=0;p.anchorY=0;p.localX=0;p.localY=0;
      if (type === 0) {
        p.charIndex=opts.idx;p.localBaseY=opts.by;p.maxRise=(15+Math.random()*5)*vs;p.offsetX=(Math.random()-0.5)*15*vs;p.vy=-0.2-Math.random()*0.3;p.drag=0.96;p.decay=0.0077+Math.random()*0.004;p.size=(5+Math.random()*4)*vs;p.growRate=0.2*vs;p.rotation=Math.random()*Math.PI*2;p.rSpeed=(Math.random()-0.5)*0.01;p.alpha=0.4;
      } else if (type === 4) {
        p.vx=(Math.random()-0.5)*12;p.vy=(Math.random()-0.5)*12;p.gravity=0.15;p.decay=Math.random()*0.012+0.008;p.size=Math.random()*8+5;p.rotation=Math.random()*Math.PI*2;p.rSpeed=(Math.random()-0.5)*0.2;
      } else if (type === 5) {
        var angle=Math.random()*Math.PI*2,speed=1+Math.random()*3;p.vx=Math.cos(angle)*speed;p.vy=Math.sin(angle)*speed-1;p.gravity=0.15;p.drag=0.95;p.decay=0.02+Math.random()*0.02;p.size=(2+Math.random()*4)*vs;p.charIndex=0;p.anchorX=opts.offsetX||0;p.anchorY=0;p.localX=0;p.localY=0;
      } else {
        var angle2=(15+Math.random()*20)*Math.PI/180,speed2=(type===1?4+Math.random()*5:6+Math.random()*7.5)*frameCache.fontScale;
        p.vx=-Math.cos(angle2)*speed2;p.vy=-Math.sin(angle2)*speed2*0.8;p.gravity=(type===1?0.15:0.2)*frameCache.fontScale;p.decay=type===1?0.02+Math.random()*0.02:0.015+Math.random()*0.02;p.size=(type===1?1+Math.random()*1.5:(2+Math.random()*2)*1.3)*vs;p.hue=type===1?30+Math.random()*30:60+Math.random()*60;p.lineWidth=(1+Math.random()*1.5)*vs;p.rSpeed=type===2?(Math.random()-0.5)*0.25:0;p.rotation=type===2?Math.random()*Math.PI*2:0;
        if (type===2){p.cosA=Math.cos(p.rotation);p.sinA=Math.sin(p.rotation);p.cosR=Math.cos(p.rSpeed);p.sinR=Math.sin(p.rSpeed);}
        if(type===1){p.colorA='hsla('+p.hue+',100%,60%,1)';p.colorB='hsla('+p.hue+',100%,50%,0)';}else{p.debrisColor='rgb('+p.hue+','+p.hue+','+p.hue+')';}
      }
      return p;
    }

    function processParticles() {
      if (!frameCache.valid) return;
      var isActiveScrollUp = scrollUpVelocity < -2;
      if (!(frameCount & 1)) {
        if (isActiveScrollUp && hasStarted && !isDead && chars.length > 0) {
          var mass = charStates[0]?.mass||1.0;
          if (Math.random() < pullStrength*3.5*mass*1.15 && frameCache.valid) {
            var type=Math.random()<0.15?1:2;
            if(type===1||Math.random()<0.575){spawnParticle(type,frameCache.firstLeft,frameCache.anchorBottom+frameCache.cachedFloorOffset,{});}
          }
        }
        if (currentMode==='pull'&&pullStrength>0.15&&hasStarted&&!isDead&&chars.length>0&&frameCache.valid) {
          var count2=2+Math.floor(Math.random()*3),charWidth=frameCache.firstRight-frameCache.firstLeft;
          for(var i=0;i<count2;i++){var offsetX=Math.random()*(charWidth/3);spawnParticle(5,frameCache.firstLeft+offsetX,frameCache.firstBottom,{offsetX:offsetX});}
        }
        if (currentMode==='pull'&&pullStrength>0.1&&hasStarted&&!isDead&&chars.length>0) {
          var localFloorY=frameCache.charOffsetTop+frameCache.charOffsetHeight;
          for(var ci=0;ci<chars.length;ci++){
            if(Math.random()>EMIT_CHANCE[ci])continue;
            var s=charStates[ci];var lx=s.baseOffsetLeft+s.finalX+(frameCache.charOffsetWidths[ci]||0)/2;
            if(s.prevVaporX===undefined)s.prevVaporX=lx;
            var dx=lx-s.prevVaporX;
            if(Math.abs(dx)>2){var steps=Math.min(Math.ceil(Math.abs(dx)/10),20);for(var k=0;k<=steps;k++){spawnParticle(0,s.prevVaporX+dx*(k/steps)+canvasOffsetX,localFloorY+canvasOffsetY,{idx:ci,by:localFloorY});}}
            s.prevVaporX=lx;
          }
        }
      }
      if (poolActive===0) {
        if(smokeCtx&&(smokeCtx as any)._hadContent){smokeCtx.clearRect(0,0,smokeCanvas!.width,smokeCanvas!.height);(smokeCtx as any)._hadContent=false;}
        if(sparksCtx&&(sparksCtx as any)._hadContent){sparksCtx.clearRect(0,0,sparksCanvas!.width,sparksCanvas!.height);(sparksCtx as any)._hadContent=false;}
        return;
      }
      if(smokeCtx)smokeCtx.clearRect(0,0,smokeCanvas!.width,smokeCanvas!.height);
      if(sparksCtx){sparksCtx.clearRect(0,0,sparksCanvas!.width,sparksCanvas!.height);sparksCtx.lineCap='butt';}
      fireCount=0;var hadSmoke=false,hadSparks=false;
      for(var i=poolActive-1;i>=0;i--){
        var p=POOL[i];if(p.type===4)continue;var dead=false;
        if(p.type===0){
          if(p.charIndex>=0&&chars[p.charIndex]&&charStates[p.charIndex]){var s2=charStates[p.charIndex];var targetX=s2.baseOffsetLeft+s2.finalX+(frameCache.charOffsetWidths[p.charIndex]||0)/2+canvasOffsetX+p.offsetX;p.x+=(targetX-p.x)*0.3;}
          p.y+=p.vy;p.vy*=p.drag;var minY=p.localBaseY+canvasOffsetY-p.maxRise;if(p.y<minY){p.y=minY;p.vy=0;}
          p.size=p.life>0.5?p.size+p.growRate:p.size*0.96;p.rotation+=p.rSpeed;
          if(p.life<=0||p.size<1||p.x<0||p.x>(smokeCanvas?.width||2000))dead=true;
          if(!dead&&p.life*p.alpha<0.02)dead=true;
        }else if(p.type===5){
          p.localX+=p.vx;p.localY+=p.vy;p.vy+=p.gravity;p.vx*=p.drag;p.vy*=p.drag;p.size*=0.96;
          if(p.life<=0||p.size<0.5)dead=true;
        }else{
          p.x+=p.vx;p.y+=p.vy;p.vy+=p.gravity;p.vx*=0.99;p.vy*=0.99;
          if(p.type===2){var newCos=p.cosA*p.cosR-p.sinA*p.sinR;var newSin=p.sinA*p.cosR+p.cosA*p.sinR;p.cosA=newCos;p.sinA=newSin;}
          if(p.life<=0||p.y>window.innerHeight+50||p.x<-100)dead=true;
        }
        p.life-=p.decay;
        if(dead){poolActive--;var tmp=POOL[i];POOL[i]=POOL[poolActive];POOL[poolActive]=tmp;continue;}
        if(p.type===0){hadSmoke=true;var sw2=p.size*2,sh2=sw2*0.7;smokeCtx!.globalAlpha=p.life*p.alpha;smokeCtx!.drawImage(SPRITES.smoke!,p.x-sw2*0.5,p.y-sh2*0.5,sw2,sh2);}
        else if(p.type===1){sparksCtx!.globalAlpha=p.life;sparksCtx!.strokeStyle=p.colorA;sparksCtx!.lineWidth=p.lineWidth;sparksCtx!.beginPath();sparksCtx!.moveTo(p.x,p.y);sparksCtx!.lineTo(p.x-p.vx*2,p.y-p.vy*2);sparksCtx!.stroke();hadSparks=true;}
        else if(p.type===2){sparksCtx!.globalAlpha=p.life;sparksCtx!.setTransform(p.cosA,p.sinA,-p.sinA,p.cosA,p.x,p.y);sparksCtx!.fillStyle=p.debrisColor;sparksCtx!.fillRect(-p.size/2,-p.size/2,p.size,p.size);hadSparks=true;}
        else if(p.type===5){fireQueue[fireCount++]=p;}
      }
      if(smokeCtx)smokeCtx.setTransform(1,0,0,1,0,0);if(sparksCtx)sparksCtx.setTransform(1,0,0,1,0,0);
      if(fireCount>0&&frameCache.valid){
        hadSparks=true;sparksCtx!.globalCompositeOperation='lighter';
        for(var fi=0;fi<fireCount;fi++){var fp=fireQueue[fi];var screenX=frameCache.firstLeft+fp.anchorX+fp.localX;var screenY=frameCache.firstBottom+fp.anchorY+fp.localY;sparksCtx!.globalAlpha=fp.life;var fs2=fp.size;sparksCtx!.drawImage(SPRITES.fire!,screenX-fs2,screenY-fs2,fs2*2,fs2*2);}
        sparksCtx!.globalCompositeOperation='source-over';
      }
      if(smokeCtx){(smokeCtx as any)._hadContent=hadSmoke;smokeCtx.globalAlpha=1;}
      if(sparksCtx){(sparksCtx as any)._hadContent=hadSparks;sparksCtx.globalAlpha=1;}
    }

    // =========================================================
    // MANA
    // =========================================================
    function initMana() {
      manaContainer=$id('blok-4-5-manaContainer') as HTMLElement|null;manaBar=$id('blok-4-5-manaBar') as HTMLElement|null;
      var textSection=$id('blok-4-5-voidSectionWrapper');
      if(textSection&&manaContainer){
        var observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting&&!isDead){manaContainer!.classList.add('in-viewport');}else{manaContainer!.classList.remove('in-viewport');}});},{threshold:0.1});
        observer.observe(textSection);observers.push(observer);
      }
    }
    function killMana() { if(manaContainer){manaContainer.classList.remove('visible','in-viewport');} }
    function updateMana() {
      if(manaComplete)return;
      if(currentMode==='pull'&&scrollUpVelocity<-1){
        if(!manaActivated){manaActivated=true;manaContainer?.classList.add('visible');}
        var vel=Math.abs(scrollUpVelocity),gain=2.0+Math.min(vel/25,1.0);gain*=(window.innerWidth<600?3:1);
        mana=Math.min(MANA_MAX,mana+gain);if(manaBar)manaBar.style.width=(mana/MANA_MAX*100)+'%';
        if(mana>=MANA_MAX)onManaComplete();
      }
    }
    function onManaComplete() {
      manaComplete=true;if(manaContainer){manaContainer.style.width=manaContainer.offsetWidth+'px';}
      manaBar?.classList.add('complete');Object.values(bubbles).forEach(function(b){return b&&b.classList.remove('visible');});activeBubbleCount=0;
      $id('blok-4-5-anchorChar')?.classList.add('mana-active');
      isReturning=true;currentMode='escape';visualBlend=0;physicsSettled=false;
    }

    // =========================================================
    // TRANSFORM TO "ZOSTAJĄ!"
    // =========================================================
    function transformToZostaja() {
      spawnStars();
      var newText='zostają!',targetChars=newText.split('');
      var walkContainer=$id('blok-4-5-walkingContainer') as HTMLElement|null;if(!walkContainer)return;
      var containerRect=walkContainer.getBoundingClientRect();
      var measure=document.createElement('span');
      measure.style.cssText='position:absolute;visibility:hidden;white-space:pre;font-family:'+getComputedStyle(walkContainer).fontFamily+';font-size:'+getComputedStyle(walkContainer).fontSize+';font-weight:'+getComputedStyle(walkContainer).fontWeight;
      var measureChars=targetChars.map(function(ch){var s=document.createElement('span');s.textContent=ch;s.style.display='inline-block';measure.appendChild(s);return s;});
      document.body.appendChild(measure);
      var mRect=measure.getBoundingClientRect();
      var targetPos=measureChars.map(function(s){return{left:s.getBoundingClientRect().left-mRect.left};});
      document.body.removeChild(measure);
      var currentPos=chars.map(function(c){return{left:c.getBoundingClientRect().left-containerRect.left};});
      walkContainer.style.position='relative';walkContainer.style.width=mRect.width+'px';walkContainer.style.height=containerRect.height+'px';
      chars.forEach(function(c,i){c.style.position='absolute';c.style.left=currentPos[i].left+'px';c.style.top='0';});
      var total=targetChars.length;
      chars.forEach(function(c,i){
        var delay=i*0.06;
        if(i<total){
          var mid=(total-1)/2,norm=(i-mid)/mid,arcY=Math.cos(norm*Math.PI*0.5)*5,arcRot=norm*2;
          var tl=gsap.timeline({delay:delay});gsapInstances.push(tl);
          tl.to(c,{y:-20,opacity:0,duration:0.15,ease:"power2.out",onComplete:function(){c.textContent=targetChars[i];c.style.left=targetPos[i].left+'px';}});
          tl.to(c,{y:arcY,opacity:1,rotation:arcRot,duration:0.35,ease:"back.out(1.7)"});
        }else{
          var tw=gsap.to(c,{opacity:0,duration:0.2,delay:delay,onComplete:function(){c.style.display='none';}});gsapInstances.push(tw);
        }
      });
      var tid=setTimeout(function(){
        isDead=true;gsap.ticker.remove(mainLoop);
        if(sparksCanvas)sparksCanvas.width=sparksCanvas.height=1;if(smokeCanvas)smokeCanvas.width=smokeCanvas.height=1;
        killMana();var tid2=setTimeout(showPopup,200);timerIds.push({type:'timeout',id:tid2});
      },(total-1)*0.06*1000+800);
      timerIds.push({type:'timeout',id:tid});
    }

    // =========================================================
    // MAIN LOOP
    // =========================================================
    function handleScrollWalking() {
      var y=scrollRuntime.getRawScroll(),d=y-lastScrollY;
      if(d<0){scrollUpVelocity=d;isScrollingDown=false;}else if(d>0){scrollUpVelocity=0;isScrollingDown=true;}
      lastScrollY=y;
    }

    function mainLoop() {
      if(!hasStarted){scrollUpVelocity*=0.9;if(scrollUpVelocity>-0.01)scrollUpVelocity=0;return;}
      if(isDead)return;
      if(walkTime*CONFIG.walkStride>window.innerWidth+200){isDead=true;killMana();gsap.ticker.remove(mainLoop);if(sparksCanvas)sparksCanvas.width=sparksCanvas.height=1;if(smokeCanvas)smokeCanvas.width=smokeCanvas.height=1;return;}
      updateFrameCache();
      if(isScrollingDown){pullStrength*=0.8;if(pullStrength<0.01){pullStrength=0;isScrollingDown=false;}}
      else{if(scrollUpVelocity<0){pullStrength+=(Math.min(1.0,Math.abs(scrollUpVelocity)/35)-pullStrength)*0.3;}else pullStrength*=0.978;}
      if(pullStrength<0.01)pullStrength=0;scrollUpVelocity*=0.9;if(scrollUpVelocity>-0.01)scrollUpVelocity=0;
      var shouldPull=pullStrength>(currentMode==='escape'?0.08:0.02);
      if(!isReturning){
        if(shouldPull&&currentMode==='escape'){currentMode='pull';anchorScrollY=lastScrollY;anchorOffsetX=walkTime*CONFIG.walkStride;wordOffsetX=anchorOffsetX;elasticActive=true;elasticTime=0;physicsSettled=false;}
        else if(!shouldPull&&currentMode==='pull'){currentMode='escape';walkTime=Math.max(0,wordOffsetX/CONFIG.walkStride);elasticActive=true;elasticTime=0;physicsSettled=false;if(!bubbleFirstPullDone)bubbleFirstPullDone=true;}
      }
      if(elasticActive){elasticTime+=0.016;if(elasticTime>0.5)elasticActive=false;}
      if(currentMode==='escape'&&!isReturning)walkTime+=CONFIG.walkSpeed;
      if(isReturning){
        walkTime-=CONFIG.walkSpeed*2;
        if(walkTime<=0){
          walkTime=0;isReturning=false;gsap.ticker.remove(mainLoop);poolActive=0;
          if(smokeCtx)smokeCtx.clearRect(0,0,smokeCanvas!.width,smokeCanvas!.height);
          if(sparksCtx)sparksCtx.clearRect(0,0,sparksCanvas!.width,sparksCanvas!.height);
          chars.forEach(function(c){c.style.transform='none';});
          ($id('blok-4-5-walkingContainer') as HTMLElement).style.transform='none';
          cacheBaseMetrics();transformToZostaja();return;
        }
      }
      if(currentMode==='pull'){var d2=anchorScrollY-lastScrollY;wordOffsetX+=(Math.max(0,anchorOffsetX-Math.max(0,d2)*0.8)-wordOffsetX)*0.12;}
      var targetBlend=currentMode==='pull'?1:0;visualBlend+=(targetBlend-visualBlend)*0.15;if(Math.abs(targetBlend-visualBlend)<0.001)visualBlend=targetBlend;
      var newTx=wordOffsetX*visualBlend;if(_containerEl)_containerEl.style.transform='translateX('+newTx+'px)';
      var t=walkTime;
      for(var i=0;i<chars.length;i++){
        var cs=charStates[i],drag=DRAG_MULT[i]||0.8,phase=t*drag;
        var stepY=Math.sin(phase*Math.PI*2)*CONFIG.walkLift,rotZ=Math.cos(phase*Math.PI*2)*5;
        if(currentMode==='pull'){
          var pullT=Math.min(1,pullStrength*2);
          cs.pullRot=cs.pullRot*0.85+(pullT*(i%2===0?-12:12))*0.15;cs.pullSkew=cs.pullSkew*0.85+(pullT*-8)*0.15;cs.pullRotY=cs.pullRotY*0.85+(pullT*(i%2===0?-5:5))*0.15;cs.pullSqueeze=cs.pullSqueeze*0.85+(pullT*0.15)*0.15;cs.elasticY=cs.elasticY*0.85+(elasticActive?pullT*8*Math.sin(elasticTime*20):0)*0.15;
        }else{cs.pullRot*=0.85;cs.pullSkew*=0.85;cs.pullRotY*=0.85;cs.pullSqueeze*=0.85;cs.elasticY*=0.85;}
        cs.finalX=cs.pullX||0;cs.finalY=stepY+cs.elasticY;
        var totalRotZ=rotZ+cs.pullRot,scaleX=1+cs.pullSqueeze,scaleY=1-cs.pullSqueeze*0.5;
        var pqx=cs.finalX,pqy=cs.finalY,pqrz=totalRotZ,pqry=cs.pullRotY,pqsk=cs.pullSkew;
        if(pqx===cs.pqx&&pqy===cs.pqy&&pqrz===cs.pqrz&&pqry===cs.pqry&&pqsk===cs.pqsk)continue;
        cs.pqx=pqx;cs.pqy=pqy;cs.pqrz=pqrz;cs.pqry=pqry;cs.pqsk=pqsk;
        chars[i].style.transform='translateX('+cs.finalX+'px) translateY('+cs.finalY+'px) rotateZ('+totalRotZ+'deg) rotateY('+cs.pullRotY+'deg) skewX('+cs.pullSkew+'deg) scaleX('+scaleX+') scaleY('+scaleY+')';
      }
      frameCount++;
      if(currentMode==='pull'&&hasStarted&&!isDead){
        var now2=performance.now();if(now2-lastTriggerTime>800&&activeBubbleCount<3){lastTriggerTime=now2;triggerSpeechSequence();}
        updateBubblePositions();
      }
      updateMana();processParticles();
    }

    // =========================================================
    // BURST + POPUP
    // =========================================================
    var burstCanvas: HTMLCanvasElement|null=null,burstCtx: CanvasRenderingContext2D|null=null,morphGhost: HTMLElement|null=null;

    function initBurstCanvas() { burstCanvas=$id('blok-4-5-burstCanvas') as HTMLCanvasElement|null; if(burstCanvas)burstCtx=burstCanvas.getContext('2d'); morphGhost=$id('blok-4-5-morphGhost') as HTMLElement|null; }

    function showPopup() {
      var overlay=$id('blok-4-5-popupOverlay') as HTMLElement|null,popup=$id('blok-4-5-popup') as HTMLElement|null;
      if(!overlay||!popup||!manaContainer||!burstCanvas||!burstCtx||!morphGhost)return;
      var manaRect=manaContainer.getBoundingClientRect(),cx=manaRect.left+manaRect.width/2,cy=manaRect.top+manaRect.height/2;
      burstCanvas.width=window.innerWidth;burstCanvas.height=window.innerHeight;burstCanvas.style.display='block';
      var burstParticles: any[]=[],COLORS=['#fec708','#fc7900','#fd9b00','#fa4900','#298f61','#8cd3b3'],COUNT=80;
      for(var i=0;i<COUNT;i++){var angle=(i/COUNT)*Math.PI*2+(Math.random()-0.5)*0.5,speed=3+Math.random()*8;burstParticles.push({x:cx+(Math.random()-0.5)*manaRect.width,y:cy+(Math.random()-0.5)*manaRect.height,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,size:2+Math.random()*5,color:COLORS[Math.floor(Math.random()*COLORS.length)],life:1,decay:0.015+Math.random()*0.01,gravity:0.08,drag:0.97});}
      manaContainer.style.opacity='0';manaContainer.style.pointerEvents='none';
      Object.assign(morphGhost.style,{left:manaRect.left+'px',top:manaRect.top+'px',width:manaRect.width+'px',height:manaRect.height+'px',borderRadius:'20px',opacity:'1',background:'white',boxShadow:'0 0 60px rgba(254,199,8,0.6),0 0 120px rgba(254,199,8,0.3)',transition:'all 200ms ease-out',zIndex:'10000'});
      requestAnimationFrame(function(){morphGhost!.style.transform='scale(1.15)';morphGhost!.style.opacity='0';});
      var running=true,frame2=0;
      function animateBurst(){
        if(!running||!burstCtx||!burstCanvas)return;
        burstCtx.clearRect(0,0,burstCanvas.width,burstCanvas.height);var alive=0;
        for(var j=0;j<burstParticles.length;j++){var p2=burstParticles[j];if(p2.life<=0)continue;alive++;p2.x+=p2.vx;p2.y+=p2.vy;p2.vy+=p2.gravity;p2.vx*=p2.drag;p2.vy*=p2.drag;p2.life-=p2.decay;var radius=p2.size*Math.max(0,p2.life);if(radius<=0)continue;burstCtx.globalAlpha=Math.max(0,p2.life);burstCtx.fillStyle=p2.color;burstCtx.beginPath();burstCtx.arc(p2.x,p2.y,radius,0,Math.PI*2);burstCtx.fill();}
        burstCtx.globalAlpha=1;frame2++;
        if(alive>0&&frame2<60)requestAnimationFrame(animateBurst);
        else{running=false;if(burstCtx&&burstCanvas){burstCtx.clearRect(0,0,burstCanvas.width,burstCanvas.height);burstCanvas.width=burstCanvas.height=1;burstCanvas.style.display='none';}}
      }
      requestAnimationFrame(animateBurst);
      var tid1=setTimeout(function(){
        if(!overlay)return;overlay.style.display='grid';
        requestAnimationFrame(function(){overlay!.classList.add('visible');});
        var pw=container.querySelector('.popup-wrapper') as HTMLElement|null;
        if(pw){pw.style.transform='scale(0.3)';pw.style.opacity='0';pw.style.transition='all 450ms cubic-bezier(0.22,1,0.36,1)';requestAnimationFrame(function(){requestAnimationFrame(function(){if(pw){pw.style.transform='scale(1)';pw.style.opacity='1';}});});}
        popup!.classList.add('popup--animated');
      },180);
      timerIds.push({type:'timeout',id:tid1});
      var tid2=setTimeout(function(){overlay!.classList.add('content-reveal');},400);
      timerIds.push({type:'timeout',id:tid2});
    }

    function closePopup() {
      var overlay=$id('blok-4-5-popupOverlay') as HTMLElement|null;
      if(overlay){
        overlay.classList.remove('visible','content-reveal');
        var pw=container.querySelector('.popup-wrapper') as HTMLElement|null;if(pw)pw.style.cssText='';
        overlay.addEventListener('transitionend',function handler(){if(!overlay!.classList.contains('visible'))overlay!.style.display='none';overlay!.removeEventListener('transitionend',handler);});
      }
    }

    function initPopup() {
      initBurstCanvas();var btns=$$('[data-reveal]'),tileWraps=$$('.tile-wrap');
      function _onRevealClick(e: Event){
        var b=e.currentTarget as HTMLButtonElement,id=(b as HTMLElement).dataset.reveal;
        var chosen=container.querySelector('.tile-wrap[data-tile="'+id+'"]');if(!chosen)return;
        chosen.classList.add('chosen');tileWraps.forEach(function(tw){if((tw as HTMLElement).dataset.tile!==id)tw.classList.add('dimmed');});
        btns.forEach(function(other){if(other!==b){(other as HTMLButtonElement).disabled=true;other.textContent='Niedostępne';}});
      }
      var _revealHandlers: Element[]=[];
      btns.forEach(function(b){b.addEventListener('click',_onRevealClick);_revealHandlers.push(b);});
      var _popupCloseEl=$id('blok-4-5-popupClose'),_popupBottomCloseEl=$id('blok-4-5-popupBottomClose');
      if(_popupCloseEl)_popupCloseEl.addEventListener('click',closePopup);if(_popupBottomCloseEl)_popupBottomCloseEl.addEventListener('click',closePopup);
      cleanups.push(function(){_revealHandlers.forEach(function(b){b.removeEventListener('click',_onRevealClick);});if(_popupCloseEl)_popupCloseEl.removeEventListener('click',closePopup);if(_popupBottomCloseEl)_popupBottomCloseEl.removeEventListener('click',closePopup);});
    }

    // =========================================================
    // INIT ALL
    // =========================================================
    SPRITES.init();initPool();
    var walkContainer=$id('blok-4-5-walkingContainer') as HTMLElement|null;
    if(!walkContainer)return{pause:function(){},resume:function(){},kill:function(){}};
    walkContainer.innerHTML='';
    CONFIG.text.split('').forEach(function(ch,i){
      var span=document.createElement('span');span.className='walking-char';span.textContent=ch;span.style.transformOrigin=i>=5?'50% 100%':'0% 100%';walkContainer!.appendChild(span);chars.push(span);
      charStates.push({pullRot:0,pullSkew:0,pullRotY:0,pullSqueeze:0,pullX:0,elasticY:0,mass:MASS_TABLE[i]+(i>=2&&i<5?Math.random()*0.3:0),finalX:0,finalY:0,baseOffsetLeft:0,prevVaporX:undefined,pqx:-9999,pqy:-9999,pqrz:-9999,pqry:-9999,pqsk:-9999});
    });
    lastScrollY=scrollRuntime.getRawScroll();anchorScrollY=lastScrollY;
    _containerEl=$id('blok-4-5-walkingContainer') as HTMLElement|null;_anchorCharEl=$id('blok-4-5-anchorChar');
    initCanvases();initBubbles();initMana();initStarCanvas();initPopup();
    requestAnimationFrame(function(){chars.forEach(function(c,i){charStates[i].baseOffsetLeft=c.offsetLeft;});updateCachedFontSize();cacheBaseMetrics();});

    function onResizeMain(){resizeCanvases();}
    window.addEventListener('resize',onResizeMain);cleanups.push(function(){window.removeEventListener('resize',onResizeMain);});
    if(window.visualViewport){window.visualViewport.addEventListener('resize',onResizeMain);cleanups.push(function(){window.visualViewport!.removeEventListener('resize',onResizeMain);});}
    window.addEventListener('scroll',handleScrollWalking,{passive:true});cleanups.push(function(){window.removeEventListener('scroll',handleScrollWalking);});

    var stWalking=ScrollTrigger.create({trigger:'#blok-4-5-voidSection',start:"top 35%",once:true,onEnter:function(){hasStarted=true;anchorScrollY=lastScrollY;if((window as any)._blok45Debug)(window as any)._blok45Debug.walkingStarted=true;}});
    gsapInstances.push(stWalking);
    gsap.ticker.add(mainLoop);
    var ticking=true,sectionInView=true;
    var mainLoopIO=new IntersectionObserver(function(entries){if(!entries[0])return;sectionInView=entries[0].isIntersecting;if(sectionInView&&!document.hidden&&ticking){gsap.ticker.add(mainLoop);}else if(!sectionInView){gsap.ticker.remove(mainLoop);}},{rootMargin:'200px 0px'});
    mainLoopIO.observe(container);observers.push(mainLoopIO);
    var onMainVisChange=function(){if(document.hidden){gsap.ticker.remove(mainLoop);}else if(sectionInView&&ticking){gsap.ticker.add(mainLoop);}};
    document.addEventListener('visibilitychange',onMainVisChange);cleanups.push(function(){document.removeEventListener('visibilitychange',onMainVisChange);});

    // TYP B: pause / resume / kill
    var hfListeners: Array<{target:EventTarget;event:string;fn:EventListenerOrEventListenerObject;options?:any}>=[];
    function pause(){if(ticking){gsap.ticker.remove(mainLoop);gsap.ticker.remove(glowTickFn);ticking=false;}if(eyePauseFn)eyePauseFn();hfListeners.forEach(function(entry){entry.target.removeEventListener(entry.event,entry.fn,entry.options);});}
    function resume(){if(!ticking){if(sectionInView&&!document.hidden)gsap.ticker.add(mainLoop);if(tickIOVisible)gsap.ticker.add(glowTickFn);ticking=true;}if(eyeResumeFn)eyeResumeFn();hfListeners.forEach(function(entry){entry.target.addEventListener(entry.event,entry.fn,entry.options);});}
    function kill(){
      pause();
      cleanups.forEach(function(fn){try{fn();}catch(e){console.error(e);}});
      timerIds.forEach(function(entry){try{if(entry.type==='timeout')clearTimeout(entry.id);else if(entry.type==='interval')clearInterval(entry.id);else if(entry.type==='raf')cancelAnimationFrame(entry.id);else if(entry.type==='idle'&&typeof window.cancelIdleCallback==='function')cancelIdleCallback(entry.id);}catch(e){}});
      observers.forEach(function(obs){obs?.disconnect?.();});
      gsapInstances.forEach(function(inst){try{(inst as any)?.revert?.();}catch(e){}try{inst?.kill?.();}catch(e){}});
      starsState.triggerAuto=0;starsState.triggerManual=0;if(starsState.dispose)starsState.dispose();
      if(sparksCanvas)sparksCanvas.width=sparksCanvas.height=1;if(smokeCanvas)smokeCanvas.width=smokeCanvas.height=1;if(iStarCanvas)iStarCanvas.width=iStarCanvas.height=1;
      isDead=true;
    }

    // =========================================================
    // TYPOGRAFICZNE OCZY
    // =========================================================
    var eyePauseFn: (()=>void)|null=null,eyeResumeFn: (()=>void)|null=null;
    (function initEyes(){
      if(window.innerWidth<600)return;
      var EYES_FRAME_BUDGET=33,EYES_DEAD_ZONE=2,RAD2DEG_EYES=57.29578;
      var eyeCache: Array<{arm:HTMLElement;ax:number;ay:number;prevDeg:number}>=[];
      var eyeMouseX=window.innerWidth*0.5,eyeMouseY=window.innerHeight*0.5;
      var eyeLastFrame=0,eyeTicking=false,eyesDead=false,eyesPaused=false;
      function buildEyeCache(){if(window.innerWidth<600)return;var arms=container.querySelectorAll('.blok45-pair-b .blok45-pupil-arm');eyeCache=[];for(var i=0;i<arms.length;i++){var eye=arms[i].parentElement!,rect=eye.getBoundingClientRect();eyeCache.push({arm:arms[i] as HTMLElement,ax:rect.left+rect.width*0.5+window.scrollX,ay:rect.top+rect.height*0.6+window.scrollY,prevDeg:-9999});}}
      function eyeTick(timestamp: number){eyeTicking=false;if(eyesDead||eyesPaused||window.innerWidth<600)return;if(timestamp-eyeLastFrame<EYES_FRAME_BUDGET){scheduleEyeFrame();return;}eyeLastFrame=timestamp;var sx=window.scrollX,sy=window.scrollY;for(var i=0;i<eyeCache.length;i++){var e=eyeCache[i],dx=eyeMouseX-(e.ax-sx),dy=eyeMouseY-(e.ay-sy),deg=Math.atan2(dy,dx)*RAD2DEG_EYES,diff=deg-e.prevDeg;if(diff>180)diff-=360;if(diff<-180)diff+=360;if(diff>-EYES_DEAD_ZONE&&diff<EYES_DEAD_ZONE)continue;e.prevDeg=deg;e.arm.style.transform='rotate('+deg.toFixed(1)+'deg)';}}
      function scheduleEyeFrame(){if(!eyeTicking&&!eyesDead){eyeTicking=true;requestAnimationFrame(eyeTick);}}
      function onEyeMouseMove(e: MouseEvent){if(eyesPaused)return;eyeMouseX=e.clientX;eyeMouseY=e.clientY;scheduleEyeFrame();}
      function onEyeResize(){if(eyesPaused)return;buildEyeCache();}
      var _eyeScrollRebuildPending=false;
      function onEyeScroll(){if(eyesPaused)return;if(!_eyeScrollRebuildPending&&eyeCache.length===0){_eyeScrollRebuildPending=true;requestAnimationFrame(function(){_eyeScrollRebuildPending=false;buildEyeCache();});}scheduleEyeFrame();}
      if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){if(!eyesDead){buildEyeCache();scheduleEyeFrame();}});}
      else{var _eyeInitTid=setTimeout(function(){buildEyeCache();scheduleEyeFrame();},300);timerIds.push({type:'timeout',id:_eyeInitTid});}
      eyePauseFn=function(){eyesPaused=true;};
      eyeResumeFn=function(){buildEyeCache();eyesPaused=false;scheduleEyeFrame();};
      document.addEventListener('mousemove',onEyeMouseMove,{passive:true});window.addEventListener('resize',onEyeResize,{passive:true});window.addEventListener('scroll',onEyeScroll,{passive:true});
      cleanups.push(function(){eyesDead=true;document.removeEventListener('mousemove',onEyeMouseMove);window.removeEventListener('resize',onEyeResize);window.removeEventListener('scroll',onEyeScroll);eyeCache=[];});
    })();

    // ═══ FACTORY: CPU GATING ═══
    var _s={_killed:false},_factoryPaused=false;
    var _getVH=function(){return window.visualViewport?.height??window.innerHeight;};
    var _calcRootMargin=function(){return Math.min(1200,Math.max(200,Math.round(1.0*_getVH())));};
    var _factoryIO: IntersectionObserver|null=null,_factoryIODebounce: number|null=null;
    function _factoryIOCallback(entries: IntersectionObserverEntry[]){if(!entries[0])return;if(entries[0].isIntersecting){if(_factoryPaused){_factoryPaused=false;resume();}}else{if(!_factoryPaused){_factoryPaused=true;pause();}}}
    function _createFactoryIO(){var rm=_calcRootMargin();_factoryIO=new IntersectionObserver(_factoryIOCallback,{rootMargin:rm+'px 0px',threshold:0.01});_factoryIO.observe(container);observers.push(_factoryIO);}
    function _recreateFactoryIO(){if(_factoryIODebounce)clearTimeout(_factoryIODebounce);_factoryIODebounce=setTimeout(function(){if(_s._killed)return;if(_factoryIO)_factoryIO.disconnect();_createFactoryIO();},50);}
    function _onFactoryVVResize(){_recreateFactoryIO();}
    _createFactoryIO();
    window.addEventListener('resize',_onFactoryVVResize,{passive:true});window.addEventListener('orientationchange',_onFactoryVVResize,{passive:true});
    if(window.visualViewport){window.visualViewport.addEventListener('resize',_onFactoryVVResize,{passive:true});}
    cleanups.push(function(){_s._killed=true;if(_factoryIODebounce)clearTimeout(_factoryIODebounce);window.removeEventListener('resize',_onFactoryVVResize);window.removeEventListener('orientationchange',_onFactoryVVResize);if(window.visualViewport)window.visualViewport.removeEventListener('resize',_onFactoryVVResize);if(_factoryIO)_factoryIO.disconnect();});

    // ═══ FACTORY: ST-REFRESH-01 ═══
    var _stIo=new IntersectionObserver(function(entries){if(!entries[0]?.isIntersecting)return;scrollRuntime.requestRefresh('section-in-view');_stIo.disconnect();},{threshold:0,rootMargin:'0px'});
    _stIo.observe(container);observers.push(_stIo);cleanups.push(function(){_stIo.disconnect();});
    var _settleTimer=setTimeout(function(){scrollRuntime.requestRefresh('layout-settle');},1000);
    timerIds.push({type:'timeout',id:_settleTimer});

    return{pause:pause,resume:resume,kill:kill};
}

// ─────────────────────────────────────────────────────────────
// Blok45Engine — React component
// ─────────────────────────────────────────────────────────────
export default function Blok45Engine() {
  const rootRef = useRef<HTMLElement | null>(null);

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
    return () => inst?.kill?.();
  }, { scope: rootRef });

  useEffect(() => {
    scrollRuntime.requestRefresh('dynamic-mounted');
    let id1 = 0, id2 = 0;
    id1 = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => { scrollRuntime.requestRefresh('dynamic-mounted-settle'); }); });
    return () => { if (id1) cancelAnimationFrame(id1); if (id2) cancelAnimationFrame(id2); };
  }, []);

  return (
    <section id="blok-4-5-section" ref={rootRef}>
      <div className="blok-4-5-wave-wrap" id="blok-4-5-wave-wrap">
        <svg className="blok-4-5-wave-overlay" id="blok-4-5-wave-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="wave-path"></path><path className="wave-path"></path><path className="wave-path"></path><path className="wave-path"></path>
        </svg>
      </div>
      <canvas id="blok-4-5-sparksCanvas"></canvas>
      <div id="blok-4-5-bubble-layer"></div>
      <div className="morph-ghost" id="blok-4-5-morphGhost"></div>
      <canvas id="blok-4-5-burstCanvas"></canvas>
      <div className="overlay" id="blok-4-5-popupOverlay">
        <div className="popup-wrapper">
          <button className="close" id="blok-4-5-popupClose" aria-label="Zamknij">✕</button>
          <section className="popup" id="blok-4-5-popup">
            <div className="popup-inner">
              <div className="burst-bg">
                <div className="burst-container">
                  <div className="burst-ripple burst-ripple--1"></div><div className="burst-ripple burst-ripple--2"></div>
                  <div className="burst-ripple burst-ripple--3"></div><div className="burst-ripple burst-ripple--4"></div>
                </div>
              </div>
              <div className="content">
                <div className="hero">
                  <div className="heading">
                    <span className="heading-light">Wybierz swój powód,<br className="br-mobile-heading" /> by zatrzymać<br className="br-desktop-heading" /> klientów,<br className="br-mobile-heading" /> na <span className="heading-inline-bold">nowej owocnej stronie.</span></span>
                  </div>
                  <p className="subtitle">Odbierz swój kod — możesz odsłonić&nbsp;jeden.</p>
                </div>
                <div className="divider"><span className="divider-diamond">◆</span></div>
                <div className="tiles">
                  <div className="tile-wrap" data-tile="1">
                    <div className="tile-glow"></div><div className="tile-conic"></div>
                    <article className="tile">
                      <div className="tile-label">Konkretny rabat</div>
                      <div className="tile-desc">Obniżamy końcową fakturę o&nbsp;kwotę.</div>
                      <div className="tile-bottom">
                        <div className="tile-value">750 zł</div>
                        <button className="popup-btn" data-reveal="1">Zobacz kod</button>
                        <div className="codebox">Przy wycenie podaj kod: <span>&quot;Zostają 750&quot;</span></div>
                      </div>
                    </article>
                  </div>
                  <div className="tile-wrap" data-tile="2">
                    <div className="tile-glow"></div><div className="tile-conic"></div>
                    <article className="tile">
                      <div className="tile-label">SOCIAL MEDIA PACK</div>
                      <div className="tile-desc">Profile firmowe — spójne z&nbsp;nową stroną.</div>
                      <div className="tile-bottom">
                        <div className="tile-value">&quot;WOW!&quot;</div>
                        <button className="popup-btn" data-reveal="2">Zobacz kod</button>
                        <div className="codebox">Przy wycenie podaj kod: <span>&quot;Zostają sociale&quot;</span></div>
                      </div>
                    </article>
                  </div>
                </div>
                <div className="bottom-close">
                  <button className="bottom-close-btn" id="blok-4-5-popupBottomClose"><span className="x-icon">✕</span> Zamknij</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <section style={{ position: 'relative', zIndex: 1 }}>
        <div id="blok-4-5-block-4">
          <div className="illustration-container">
            <div className="text-above-illustration">
              <div className="blok45-intro-line1">Potencjalni klienci</div>
              <div className="blok45-intro-line2" id="blok-4-5-introLine2">wchodzą na stronę,</div>
              <div className="blok45-intro-line3">rozglądają się &#x2013;&nbsp;<span className="blok45-eyes-wrap"><span className="blok45-letter">Ł</span><span className="blok45-eye blok45-pair-a">o<span className="blok45-pupil-arm"><span className="blok45-pupil"></span></span></span><span className="blok45-eye blok45-pair-a">o<span className="blok45-pupil-arm"><span className="blok45-pupil"></span></span></span><span className="blok45-eye blok45-pair-b">o<span className="blok45-pupil-arm"><span className="blok45-pupil"></span></span></span><span className="blok45-eye blok45-pair-b">o<span className="blok45-pupil-arm"><span className="blok45-pupil"></span></span></span><span className="blok45-letter">ł</span></span></div>
            </div>
            <div className="text-on-illustration-top">
              <div className="void-section-wrapper" id="blok-4-5-voidSectionWrapper">
                <p className="void-section" id="blok-4-5-voidSection">
                  <span id="blok-4-5-anchorChar" style={{ fontWeight: 700 }}>i&nbsp;</span><span id="blok-4-5-walkingContainer" className="walking-text-container"></span>
                  <div id="blok-4-5-iHeatWrapper"><canvas id="blok-4-5-iHeatCanvas"></canvas></div>
                </p>
              </div>
            </div>
            <div className="full-width-image" style={{ background: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', fontWeight: 600, letterSpacing: '0.05em' }}>
              <picture>
                <source media="(max-width: 599px)" srcSet="Ludzie-Small.avif" type="image/avif" />
                <source media="(max-width: 599px)" srcSet="Ludzie-Small.webp" type="image/webp" />
                <source media="(min-width: 600px)" srcSet="Ludzie.avif" type="image/avif" />
                <source media="(min-width: 600px)" srcSet="Ludzie.webp" type="image/webp" />
                <img src="Ludzie.webp" alt="Ilustracja - ludzie" loading="lazy" decoding="async" fetchPriority="high" />
              </picture>
            </div>
            <div className="text-on-illustration-bottom" id="blok-4-5-mozemy-to-zmienic">
              <h1 className="line hero-h1" style={{ flexDirection: 'column' }}>
                <span>Możemy</span>
                <span>to <span className="highlight-container">
                  <span className="gradient-text-reveal" id="blok-4-5-zmienicText">zmienić</span>
                  <div className="highlight-svg-box" id="blok-4-5-ellipseBox">
                    <svg viewBox="0 0 400 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                      <path d="M15,25 Q200,85 385,25" stroke="#1a1a1a" strokeWidth="18" fill="none" className="draw-anim" strokeLinecap="round" />
                    </svg>
                  </div>
                </span></span>
              </h1>
            </div>
          </div>
          <div style={{ height: 'clamp(2rem, 6vw, 6rem)' }}></div>
          <div id="blok-4-5-block-5-content">
            <div className="line line-small body-copy-block">Tworzymy strony zdolne zamieniać<br /> odwiedzających w prawdziwych,<br /> <span className="bold-line">płacących klientów.</span></div>
            <div style={{ height: 'clamp(1rem, 3vw, 3rem)' }}></div>
            <div className="line line-small">Ta zdolność to</div>
            <div style={{ height: 'clamp(0.5rem, 1.5vw, 1.5rem)' }}></div>
            <div className="konwersja-wrap">
              <div className="glow" id="blok-4-5-glow"></div>
              <div className="button-wrap" id="blok-4-5-btnWrap">
                <button id="blok-4-5-btn"><span>Konwersja!</span></button>
                <div className="button-shadow"></div>
              </div>
            </div>
            <div style={{ height: 'clamp(0.5rem, 1.5vw, 1.5rem)' }}></div>
            <div className="line line-small">Czyli <span className="bold-line" style={{ marginLeft: '0.2em' }}>realne pieniądze.</span></div>
            <div style={{ height: 'clamp(4.2rem, 12.6vw, 12.6rem)' }}></div>
            <h1 className="line hero-h1 body-copy-block" id="blok-4-5-zobaczH1" style={{ color: '#252030', backgroundImage: 'linear-gradient(135deg, #252030 2%, #2a2130 44%, #382630 56.7%, #512b2b 67.5%, #7d3527 80.2%, #7d3527 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              <span style={{ fontWeight: 700 }}>Zobacz ile pieniędzy odzyskasz</span><br className="br-desktop-only" /> <span style={{ fontWeight: 200 }}>po naprawie konwersji strony</span>
            </h1>
          </div>
        </div>
      </section>
      <div className="mana-container" id="blok-4-5-manaContainer">
        <div className="mana-progress"><div className="mana-bar" id="blok-4-5-manaBar"></div></div>
      </div>
      <div id="blok-4-5-stars-canvas"></div>
      <div id="blok-4-5-res-debug"></div>
    </section>
  );
}
