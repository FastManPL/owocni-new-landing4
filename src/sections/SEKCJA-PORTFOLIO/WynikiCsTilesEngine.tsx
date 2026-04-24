'use client';

import { useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollRuntime } from '@/lib/scrollRuntime';
import './wyniki-cs-tiles-section.css';

// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.

function init(container: HTMLElement): { pause: () => void; resume: () => void; kill: () => void } {
    var DEBUG_MODE=new URLSearchParams(window.location.search).has('debug')||localStorage.getItem('debug')==='1';
    var _cleanups=[],_observers=[];
    var _isMobile=window.innerWidth<=640;
    function _addWL(e,f,o){window.addEventListener(e,f,o);_cleanups.push(function(){window.removeEventListener(e,f,o);});}
    function _addDL(e,f){document.addEventListener(e,f);_cleanups.push(function(){document.removeEventListener(e,f);});}
    _addWL('resize',function(){_isMobile=window.innerWidth<=640;});

    /* KONIEC GLOBAL SHELL */

    /* ═══ CS1 (BANACH) ═══ */
    (function() {
        var rpEl = container.querySelector('#cs1-right') || document.createElement('div');
    var cdEl = container.querySelector('#cs1-card') || document.createElement('div');
    var currentMode = 'start';
    var scrollTl = null;

        var _VALS_D = {'--bg-top-r':{s:227,e:247,t:'rp'},'--bg-top-g':{s:225,e:246,t:'rp'},'--bg-top-b':{s:221,e:244,t:'rp'},'--bg-bot-r':{s:227,e:227,t:'rp'},'--bg-bot-g':{s:225,e:225,t:'rp'},'--bg-bot-b':{s:221,e:221,t:'rp'},'--bg-grad-stop':{s:21,e:34,t:'rp'},'--banach-left':{s:-4,e:-15,t:'rp'},'--banach-bottom':{s:-41,e:-5,t:'rp'},'--banach-width':{s:154,e:204,t:'rp'},'--banach-clip':{s:100,e:100,t:'rp'},'--consult-left':{s:14,e:14,t:'rp'},'--consult-bottom':{s:-10,e:-1,t:'rp'},'--consult-width':{s:54,e:61,t:'rp'},'--consult-grad-opacity':{s:25,e:0,t:'rp'},'--vid1-left':{s:0,e:0,t:'rp'},'--vid1-top':{s:57,e:57,t:'rp'},'--vid1-width':{s:16,e:16,t:'rp'},'--vid2-left':{s:1,e:1,t:'rp'},'--vid2-top':{s:71,e:71,t:'rp'},'--vid2-width':{s:14,e:14,t:'rp'},'--vid3-left':{s:2,e:2,t:'rp'},'--vid3-top':{s:85,e:85,t:'rp'},'--vid3-width':{s:12,e:12,t:'rp'},'--finanse-left':{s:30,e:30,t:'rp'},'--finanse-bottom':{s:-30,e:-18,t:'rp'},'--finanse-width':{s:51,e:61,t:'rp'},'--finanse-grad-opacity':{s:25,e:0,t:'rp'},'--phone-right':{s:-5,e:-5,t:'cd'},'--phone-bottom':{s:-5,e:-5,t:'cd'},'--phone-width':{s:20,e:20,t:'cd'}};
    var _VALS_M = {'--bg-top-r':{s:227,e:247,t:'rp'},'--bg-top-g':{s:225,e:246,t:'rp'},'--bg-top-b':{s:221,e:244,t:'rp'},'--bg-bot-r':{s:227,e:227,t:'rp'},'--bg-bot-g':{s:225,e:225,t:'rp'},'--bg-bot-b':{s:221,e:221,t:'rp'},'--bg-grad-stop':{s:21,e:34,t:'rp'},'--banach-left':{s:-4,e:-15,t:'rp'},'--banach-bottom':{s:-41,e:-5,t:'rp'},'--banach-width':{s:154,e:204,t:'rp'},'--banach-clip':{s:100,e:100,t:'rp'},'--consult-left':{s:14,e:14,t:'rp'},'--consult-bottom':{s:-10,e:-1,t:'rp'},'--consult-width':{s:54,e:61,t:'rp'},'--consult-grad-opacity':{s:25,e:0,t:'rp'},'--vid1-left':{s:0,e:0,t:'rp'},'--vid1-top':{s:57,e:57,t:'rp'},'--vid1-width':{s:16,e:16,t:'rp'},'--vid2-left':{s:1,e:1,t:'rp'},'--vid2-top':{s:71,e:71,t:'rp'},'--vid2-width':{s:14,e:14,t:'rp'},'--vid3-left':{s:2,e:2,t:'rp'},'--vid3-top':{s:85,e:85,t:'rp'},'--vid3-width':{s:12,e:12,t:'rp'},'--finanse-left':{s:30,e:30,t:'rp'},'--finanse-bottom':{s:-30,e:-18,t:'rp'},'--finanse-width':{s:51,e:61,t:'rp'},'--finanse-grad-opacity':{s:25,e:0,t:'rp'},'--phone-right':{s:0,e:0,t:'cd'},'--phone-bottom':{s:35,e:50,t:'cd'},'--phone-width':{s:35,e:32,t:'cd'}};
    function getVals(mode) {
      var src = _isMobile ? _VALS_M : _VALS_D;
      var v = {};
      Object.keys(src).forEach(function(p) {
        v[p] = { val: mode==='start' ? src[p].s : src[p].e, target: src[p].t };
      });
      return v;
    }

    function applyCSS(vals) {
      Object.keys(vals).forEach(function(p){
        var el = vals[p].target === 'cd' ? cdEl : rpEl;
        var isUnitless = (p==='--bg-bot-g'||p==='--bg-top-g'||p==='--bg-bot-r'||p==='--bg-top-b'||p==='--bg-bot-b'||p==='--bg-top-r'||p==='--consult-grad-opacity'||p==='--finanse-grad-opacity');
        el.style.setProperty(p, isUnitless ? vals[p].val : vals[p].val + '%');
      });
    }

    function buildTimeline() {
      if(scrollTl){ if(scrollTl.scrollTrigger) scrollTl.scrollTrigger.kill(); scrollTl.kill(); scrollTl=null; }
      var sv = getVals('start'), ev = getVals('end');
      applyCSS(sv);

      var rpProxy={}, rpTarget={}, rpProps=[];
      var cdProxy={}, cdTarget={}, cdProps=[];
      Object.keys(sv).forEach(function(p){
        var k = p.replace(/--/g,'').replace(/-/g,'_');
        if(sv[p].target === 'cd') {
          cdProxy[k]=sv[p].val; cdTarget[k]=ev[p].val; cdProps.push({key:k,prop:p});
        } else {
          rpProxy[k]=sv[p].val; rpTarget[k]=ev[p].val; rpProps.push({key:k,prop:p});
        }
      });

      scrollTl = gsap.timeline({
        scrollTrigger: { trigger:'#cs1-section', start:'60% bottom', end:window.innerWidth<=640?'center 50%':'center 30%', scrub:0.6 }
      });

      /* Right panel */
      var rpAnim = Object.assign({}, rpTarget);
      rpAnim.ease = 'power2.inOut'; rpAnim.duration = 1;
      rpAnim.onUpdate = function(){
        rpProps.forEach(function(p){
          var isU = (p.prop==='--bg-bot-g'||p.prop==='--bg-top-g'||p.prop==='--bg-bot-r'||p.prop==='--bg-top-b'||p.prop==='--bg-bot-b'||p.prop==='--bg-top-r'||p.prop==='--consult-grad-opacity'||p.prop==='--finanse-grad-opacity');
          rpEl.style.setProperty(p.prop, isU ? String(Math.round(rpProxy[p.key])) : rpProxy[p.key].toFixed(1)+'%');
        });
      };
      scrollTl.to(rpProxy, rpAnim, 0);

      /* Card */
      if(cdProps.length > 0) {
        var cdAnim = Object.assign({}, cdTarget);
        cdAnim.ease = 'power2.inOut'; cdAnim.duration = 1;
        cdAnim.onUpdate = function(){
          cdProps.forEach(function(p){
            cdEl.style.setProperty(p.prop, p.prop.toFixed ? p.prop.toFixed(1)+'%' : cdProxy[p.key].toFixed(1)+'%');
          });
        };
        scrollTl.to(cdProxy, cdAnim, 0);
      }

      scrollRuntime.requestRefresh('st-refresh');
    }

    buildTimeline();

    /* ═══ MEGA PANEL JS ═══ */

    _addDL('keydown', function(e){
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
      if(e.key==='g'||e.key==='G') if(mp)mp.classList.toggle('open');
    });

      return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
    }
    function rgbToHex(r,g,b) {
      return '#'+[r,g,b].map(function(v){ return Math.round(v).toString(16).padStart(2,'0'); }).join('');
    }

      currentMode = m;
      if(m==='start'){
        sb.style.background='#4ade80'; sb.style.color='#000'; sb.style.borderColor='#4ade80';
        eb.style.background='transparent'; eb.style.color='#888'; eb.style.borderColor='#555';
      } else {
        eb.style.background='#ef4444'; eb.style.color='#fff'; eb.style.borderColor='#ef4444';
        sb.style.background='transparent'; sb.style.color='#888'; sb.style.borderColor='#555';
      }
        var isMob=window.innerWidth<=640; var key=m==='start'?(isMob?'ms':'start'):(isMob?'me':'end'); var v=s.dataset[key]; s.value=v;
        var unit = s.dataset.unit || '';
        s.nextElementSibling.textContent = v + unit;
      });
      /* Sync color pickers */
      if(ct) { ct.value = ct.dataset[m+'Hex'] || ct.dataset.startHex; ct.nextElementSibling.textContent = ct.value; }
      if(cb) { cb.value = cb.dataset[m+'Hex'] || cb.dataset.startHex; cb.nextElementSibling.textContent = cb.value; }
    }


    /* Slider handler */
      s.addEventListener('input', function(){
        var v = s.value;
        var unit = s.dataset.unit || '';
        s.nextElementSibling.textContent = v + unit;
        var isMob=window.innerWidth<=640; var wk=currentMode==='start'?(isMob?'ms':'start'):(isMob?'me':'end'); s.dataset[wk]=v;
        var el = s.dataset.target === 'cd' ? cdEl : rpEl;
        var isU = (s.dataset.prop==='--bg-bot-g'||s.dataset.prop==='--bg-top-g'||s.dataset.prop==='--bg-bot-r'||s.dataset.prop==='--bg-top-b'||s.dataset.prop==='--bg-bot-b'||s.dataset.prop==='--bg-top-r'||s.dataset.prop==='--consult-grad-opacity'||s.dataset.prop==='--finanse-grad-opacity');
        el.style.setProperty(s.dataset.prop, isU ? v : v + unit);
      });
    });

    /* Color pickers → update hidden RGB sliders */
      var rgb = hexToRgb(hex);
      var props = ['--bg-'+prefix+'-r','--bg-'+prefix+'-g','--bg-'+prefix+'-b'];
      props.forEach(function(p, i) {
        var slider = document.querySelector('input[data-prop="'+p+'"]');
        if(slider) {
          slider.dataset[currentMode] = rgb[i];
          rpEl.style.setProperty(p, rgb[i]);
        }
      });
    }

      this.dataset[currentMode+'Hex'] = this.value;
      this.nextElementSibling.textContent = this.value;
      syncColorToSliders('top', this.value);
    });
      this.dataset[currentMode+'Hex'] = this.value;
      this.nextElementSibling.textContent = this.value;
      syncColorToSliders('bot', this.value);
    });

    /* ZASTOSUJ */
      buildTimeline(); updateOut();
      (container.querySelector('#cs1-section')||{scrollIntoView:function(){}}).scrollIntoView({behavior:'smooth',block:'center'});
    });


      var l=[];
        var unit = s.dataset.unit || '';
        l.push(s.dataset.prop.replace('--','')+'  S='+s.dataset.start+unit+'  F='+s.dataset.end+unit);
      });
      /* Add color hex */
      if(ct) l.unshift('color-top  S='+ct.dataset.startHex+'  F='+ct.dataset.endHex);
      if(cb) l.splice(1,0,'color-bot  S='+cb.dataset.startHex+'  F='+cb.dataset.endHex);
    }


    /* Init: sync slider display to current viewport */

    /* Rebuild when crossing mobile/desktop threshold */
    var _wasMobcs1 = window.innerWidth <= 640;
    _addWL('resize', function() {
      var isMob = window.innerWidth <= 640;
      if (isMob !== _wasMobcs1) {
        _wasMobcs1 = isMob;
        buildTimeline();
        setMode(currentMode);
      }
    });


    })();

    /* ═══ CS2 (PRAGMILE) ═══ */
    (function() {
    
    /* ═══ DUAL-MODE ANIMATION SYSTEM ═══ */
    var rpEl = container.querySelector('#cs2-right') || document.createElement('div');
    var cdEl = container.querySelector('#cs2-card') || document.createElement('div');
    var bgEl = container.querySelector('#cs2-section .cs2-bg') || document.createElement('div');
    var currentMode = 'start'; // 'start' or 'end'
    var scrollTl = null;

        var _VALS_D = {'--imgit-left':{s:16,e:18,t:'rp'},'--imgit-bottom':{s:28,e:47,t:'rp'},'--imgit-width':{s:70,e:70,t:'rp'},'--kratki-left':{s:28,e:25,t:'rp'},'--kratki-top':{s:35,e:21,t:'rp'},'--kratki-width':{s:13,e:13,t:'rp'},'--tekst1-left':{s:24,e:29,t:'rp'},'--tekst1-top':{s:52,e:29,t:'rp'},'--tekst1-width':{s:51,e:43,t:'rp'},'--tekst2-right':{s:8,e:28,t:'rp'},'--tekst2-top':{s:70,e:57,t:'rp'},'--tekst2-width':{s:32,e:22,t:'rp'},'--plate-left':{s:-3,e:-3,t:'rp'},'--plate-bottom':{s:6,e:6,t:'rp'},'--plate-width':{s:114,e:114,t:'rp'},'--plate-height':{s:96,e:96,t:'rp'},'--plate-grad-stop':{s:100,e:0,t:'rp'},'--pragma-left':{s:37,e:37,t:'cd'},'--pragma-bottom':{s:6,e:6,t:'cd'},'--pragma-width':{s:29,e:29,t:'cd'},'--dlon-left':{s:54,e:59,t:'cd'},'--dlon-bottom':{s:6,e:6,t:'cd'},'--dlon-width':{s:44,e:44,t:'cd'},'--kw1-left':{s:66,e:69,t:'cd'},'--kw1-bottom':{s:19,e:13,t:'cd'},'--kw1-size':{s:4,e:2,t:'cd'},'--kw2-left':{s:66,e:62,t:'cd'},'--kw2-bottom':{s:16,e:18,t:'cd'},'--kw2-size':{s:7,e:5,t:'cd'},'--kw3-left':{s:60,e:62,t:'cd'},'--kw3-bottom':{s:14,e:31,t:'cd'},'--kw3-size':{s:10,e:7,t:'cd'}};
    var _VALS_M = {'--imgit-left':{s:16,e:18,t:'rp'},'--imgit-bottom':{s:28,e:47,t:'rp'},'--imgit-width':{s:70,e:70,t:'rp'},'--kratki-left':{s:28,e:25,t:'rp'},'--kratki-top':{s:35,e:21,t:'rp'},'--kratki-width':{s:13,e:13,t:'rp'},'--tekst1-left':{s:24,e:29,t:'rp'},'--tekst1-top':{s:52,e:29,t:'rp'},'--tekst1-width':{s:51,e:43,t:'rp'},'--tekst2-right':{s:8,e:28,t:'rp'},'--tekst2-top':{s:70,e:57,t:'rp'},'--tekst2-width':{s:32,e:22,t:'rp'},'--plate-left':{s:0,e:0,t:'rp'},'--plate-bottom':{s:6,e:6,t:'rp'},'--plate-width':{s:100,e:100,t:'rp'},'--plate-height':{s:96,e:96,t:'rp'},'--plate-grad-stop':{s:100,e:0,t:'rp'},'--pragma-left':{s:-15,e:-15,t:'cd'},'--pragma-bottom':{s:0,e:0,t:'cd'},'--pragma-width':{s:56,e:56,t:'cd'},'--dlon-left':{s:18,e:27,t:'cd'},'--dlon-bottom':{s:0,e:0,t:'cd'},'--dlon-width':{s:84,e:84,t:'cd'},'--kw1-left':{s:54,e:46,t:'cd'},'--kw1-bottom':{s:15,e:8,t:'cd'},'--kw1-size':{s:8,e:4,t:'cd'},'--kw2-left':{s:41,e:33,t:'cd'},'--kw2-bottom':{s:11,e:14,t:'cd'},'--kw2-size':{s:13,e:10,t:'cd'},'--kw3-left':{s:29,e:33,t:'cd'},'--kw3-bottom':{s:9,e:28,t:'cd'},'--kw3-size':{s:19,e:13,t:'cd'}};
    function getSliderValues(mode) {
      var src = _isMobile ? _VALS_M : _VALS_D;
      var v = {};
      Object.keys(src).forEach(function(p) {
        v[p] = { val: mode==='start' ? src[p].s : src[p].e, target: src[p].t };
      });
      return v;
    }

    function applyCSS(vals) {
      Object.keys(vals).forEach(function(prop) {
        var v = vals[prop];
        /* On mobile, card-level elements moved to right panel */
        var el;
        if (v.target === 'cd') {
          /* Check if a matching element exists in right panel (reparented) */
          var isMob = window.innerWidth <= 640;
          el = isMob ? rpEl : cdEl;
        } else {
          el = rpEl;
        }
        el.style.setProperty(prop, v.val + '%');
      });
    }

    function buildTimeline() {
      /* Kill existing */
      if (scrollTl) {
        if (scrollTl.scrollTrigger) scrollTl.scrollTrigger.kill();
        scrollTl.kill();
        scrollTl = null;
      }

      /* Read current slider values */
      var startVals = getSliderValues('start');
      var endVals = getSliderValues('end');

      /* Apply START as CSS defaults */
      applyCSS(startVals);

      /* Build proxy objects */
      var rpProxy = {};
      var cdProxy = {};
      var rpTarget = {};
      var cdTarget = {};
      var rpProps = [];
      var cdProps = [];

      Object.keys(startVals).forEach(function(prop) {
        var s = startVals[prop];
        var e = endVals[prop];
        var key = prop.replace(/--/g, '').replace(/-/g, '_');
        if (s.target === 'cd') {
          cdProxy[key] = s.val;
          cdTarget[key] = e.val;
          cdProps.push({ key: key, prop: prop });
        } else {
          rpProxy[key] = s.val;
          rpTarget[key] = e.val;
          rpProps.push({ key: key, prop: prop });
        }
      });

      scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: '#cs2-section',
          start: '60% bottom',
          end: window.innerWidth<=640 ? 'center 50%' : 'center 30%',
          scrub: 0.6
        }
      });

      /* Brightness */
      if (bgEl) {
        scrollTl.fromTo(bgEl,
          { filter: 'brightness(0.15)' },
          { filter: 'brightness(1)', ease: 'power2.inOut', duration: 1 },
          0
        );
      }

      /* Right panel */
      var rpAnimTarget = Object.assign({}, rpTarget);
      rpAnimTarget.ease = 'power2.inOut';
      rpAnimTarget.duration = 1;
      rpAnimTarget.onUpdate = function() {
        rpProps.forEach(function(p) {
          rpEl.style.setProperty(p.prop, rpProxy[p.key].toFixed(1) + '%');
        });
      };
      scrollTl.to(rpProxy, rpAnimTarget, 0);

      /* Card */
      var cdAnimTarget = Object.assign({}, cdTarget);
      cdAnimTarget.ease = 'power2.inOut';
      cdAnimTarget.duration = 1;
      var _mobAnim = window.innerWidth <= 640;
      cdAnimTarget.onUpdate = function() {
        cdProps.forEach(function(p) {
          var targetEl = _mobAnim ? rpEl : cdEl;
          targetEl.style.setProperty(p.prop, cdProxy[p.key].toFixed(1) + '%');
        });
      };
      scrollTl.to(cdProxy, cdAnimTarget, 0);

      scrollRuntime.requestRefresh('st-refresh');
    }

    /* Initial build */
    buildTimeline();

    /* ═══ CANVAS PHONE — physics momentum (flywheel) ═══
       Scroll nadaje siłę → klatki kręcą się z inercją → zwalniają.
       Nigdy nie przeskakuje klatek — rAF rysuje co 1.
       D = debug HUD, P = diagnostyka */

    (function() {
      var FRAME_COUNT = 41;
      var BASE_URL = 'assets/portfolios/canvas/';
      var SOURCE_W = 242;
      var SOURCE_H = 397;

      /* PHYSICS CONFIG */
      var SCROLL_GAIN = 0.08;
      var FRICTION = 0.94;
      var MIN_VELOCITY = 0.01;
      var MAX_VELOCITY = 3.0;

      var canvasEl = container.querySelector('#cs2-phone-canvas') || document.createElement('div');
      var phoneContainer = canvasEl ? canvasEl.parentElement : null;
      var sectionEl = container.querySelector('#cs2-section') || document.createElement('div');
      if (!canvasEl || !phoneContainer || !sectionEl) return;

      var ctx = canvasEl.getContext('2d');
      if (!ctx) return;

      var frames = new Array(FRAME_COUNT);
      var loadedCount = 0;
      var allLoaded = false;
      var position = 0;
      var velocity = 0;
      var lastScrollY = window.scrollY;
      var isVisible = false;
      var spinRafId = 0;
      var lastDrawnFrame = -1;
      var diag = { transitions: [], draws: 0, startTime: 0, peakVel: 0 };
      var cached = { cw: 0, ch: 0, sw: 0, sh: 0, sx: 0, sy: 0 };

      function setupCanvasDPR() {
        if (!ctx || !phoneContainer) return;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var rect = phoneContainer.getBoundingClientRect();
        var cw = Math.round(rect.width);
        var ch = Math.round(rect.height);
        if (cw === 0 || ch === 0) return;
        if (cw === cached.cw && ch === cached.ch) return;
        var newW = Math.round(rect.width * dpr);
        var newH = Math.round(rect.height * dpr);
        if (canvasEl.width !== newW || canvasEl.height !== newH) {
          canvasEl.width = newW;
          canvasEl.height = newH;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        var scale = Math.max(cw / SOURCE_W, ch / SOURCE_H);
        cached.cw = cw; cached.ch = ch;
        cached.sw = Math.round(SOURCE_W * scale);
        cached.sh = Math.round(SOURCE_H * scale);
        cached.sx = Math.round((cw - cached.sw) / 2);
        cached.sy = Math.round((ch - cached.sh) / 2);
      }

      function drawFrame(index) {
        if (!ctx || !frames[index] || index === lastDrawnFrame) return;
        ctx.clearRect(0, 0, cached.cw, cached.ch);
        ctx.drawImage(frames[index], cached.sx, cached.sy, cached.sw, cached.sh);
        lastDrawnFrame = index;
        diag.draws++;
      }

      function spin() {
        position += velocity;
        position = ((position % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
        var frameIdx = Math.round(position) % FRAME_COUNT;
        if (frameIdx !== lastDrawnFrame) {
          var prev = lastDrawnFrame;
          drawFrame(frameIdx);
          diag.transitions.push({ from: prev, to: frameIdx, time: (performance.now() - diag.startTime).toFixed(1), vel: velocity.toFixed(3) });
          if (diag.transitions.length > 500) diag.transitions = diag.transitions.slice(-250);
          updateHUD();
        }
        velocity *= FRICTION;
        if (Math.abs(velocity) < MIN_VELOCITY) { velocity = 0; spinRafId = 0; return; }
        spinRafId = requestAnimationFrame(spin);
      }

      function startSpin() { if (spinRafId) return; spinRafId = requestAnimationFrame(spin); }

      function onScroll() {
        if (!isVisible || !allLoaded) return;
        var scrollY = window.scrollY;
        var delta = scrollY - lastScrollY;
        lastScrollY = scrollY;
        if (delta === 0) return;
        velocity += delta * SCROLL_GAIN;
        if (velocity > MAX_VELOCITY) velocity = MAX_VELOCITY;
        if (velocity < -MAX_VELOCITY) velocity = -MAX_VELOCITY;
        if (Math.abs(velocity) > diag.peakVel) diag.peakVel = Math.abs(velocity);
        startSpin();
      }
      _addWL('scroll', onScroll, { passive: true });

      var visIO = new IntersectionObserver(function(entries) {
        if (!entries[0]) return;
        isVisible = entries[0].isIntersecting;
        if (isVisible) lastScrollY = window.scrollY;
      }, { rootMargin: '10% 0px' });
      visIO.observe(sectionEl);_observers.push(visIO);

      var roRafId = 0;
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(function() {
          cancelAnimationFrame(roRafId);
          roRafId = requestAnimationFrame(function() {
            setupCanvasDPR();
            lastDrawnFrame = -1;
            var f = Math.round(position) % FRAME_COUNT;
            if (frames[f]) drawFrame(f);
          });
        });
        ro.observe(phoneContainer);_observers.push(ro);
      }

      /* DEBUG HUD (D) */
      }
      var hudVisible = false;

      function updateHUD() {
        if (!hudVisible) return;
        var last20 = diag.transitions.slice(-20).map(function(t) { return t.to; });
      }

      /* DIAGNOSTIC PANEL (P) */
        + '<div style="margin-bottom:6px;color:#888">Scrolluj, potem SNAPSHOT</div>'
      }

        var missing = [];
        for (var i = 0; i < FRAME_COUNT; i++) { if (!frames[i]) missing.push(i); }
        var jumps = [];
        var half = FRAME_COUNT / 2;
        for (var j = 1; j < diag.transitions.length; j++) {
          var t = diag.transitions[j];
          var p = diag.transitions[j - 1];
          if (t.from < 0) continue;
          var d = Math.abs(t.to - t.from);
          if (d > half) d = FRAME_COUNT - d;
          if (d > 1) jumps.push({ at: t.time + 'ms', from: t.from, to: t.to, jump: d, vel: t.vel });
        }
        var fps = 0;
        if (diag.transitions.length > 10) {
          var recent = diag.transitions.slice(-30);
          var dt = parseFloat(recent[recent.length - 1].time) - parseFloat(recent[0].time);
          if (dt > 0) fps = Math.round(recent.length / (dt / 1000));
        }
        var last50 = diag.transitions.slice(-50).map(function(t) { return t.to; });
        return [
          '=== CANVAS FLYWHEEL DIAGNOSTIC ===',
          'SCROLL_GAIN: ' + SCROLL_GAIN + '  FRICTION: ' + FRICTION + '  MAX_VEL: ' + MAX_VELOCITY,
          'Loaded: ' + loadedCount + '/' + FRAME_COUNT + '  Missing: ' + (missing.length === 0 ? 'none' : missing.join(',')),
          'Draws: ' + diag.draws + '  Peak vel: ' + diag.peakVel.toFixed(3) + '  FPS: ' + fps,
          '',
          'PERCEPCYJNE SKOKI (>1 frame):',
          jumps.length === 0 ? '  none' : jumps.map(function(j) { return '  ' + j.at + ': ' + j.from + '->' + j.to + ' (skok ' + j.jump + ' vel=' + j.vel + ')'; }).join('\n'),
          '',
          'SEKWENCJA (50):',
          last50.join('->'),
          '',
          'TRANSITIONS (80):',
          diag.transitions.slice(-80).map(function(t) { return t.time + 'ms: ' + t.from + '->' + t.to + ' v=' + t.vel; }).join('\n')
        ].join('\n');
      }

      if(DEBUG_MODE) _addDL('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      });

        try { navigator.clipboard.writeText(r); } catch(e) {}
      });

        diag.transitions = []; diag.draws = 0; diag.peakVel = 0; diag.startTime = performance.now();
      });

      /* PRELOAD */
      function preloadFrame(index) {
        return new Promise(function(resolve) {
          var url = BASE_URL + String(index).padStart(3, '0') + '.jpg';
          var img = new Image();
          img.onload = function() {
            if (img.decode) {
              img.decode().then(function() { frames[index] = img; loadedCount++; resolve(index); })
                .catch(function() { frames[index] = img; loadedCount++; resolve(index); });
            } else { frames[index] = img; loadedCount++; resolve(index); }
          };
          img.onerror = function() { console.warn('[canvas] FAIL ' + index + ' → ' + url); resolve(index); };
          img.src = url;
        });
      }

      var sentryIO = new IntersectionObserver(function(entries) {
        if (!entries[0] || !entries[0].isIntersecting) return;
        sentryIO.disconnect();
        diag.startTime = performance.now();
        preloadFrame(0).then(function() {
          setupCanvasDPR();
          drawFrame(0);
          canvasEl.classList.add('is-ready');
          var queue = [];
          for (var i = 1; i < FRAME_COUNT; i++) queue.push(i);
          function loadNext() {
            if (queue.length === 0) {
              allLoaded = true;
              if(DEBUG_MODE) console.log('[canvas] ALL LOADED: ' + loadedCount + '/' + FRAME_COUNT);
              if(DEBUG_MODE) console.log('[canvas] BASE_URL: ' + BASE_URL);
              if(DEBUG_MODE) console.log('[canvas] Example URL: ' + BASE_URL + '000.jpg');
              var missing = [];
              for (var i = 0; i < FRAME_COUNT; i++) { if (!frames[i]) missing.push(i); }
              if (missing.length > 0) console.warn('[canvas] MISSING: ' + missing.join(', '));
              lastScrollY = window.scrollY;
              return;
            }
            preloadFrame(queue.shift()).then(loadNext).catch(loadNext);
          }
          var c = Math.min(3, queue.length);
          for (var k = 0; k < c; k++) preloadFrame(queue.shift()).then(loadNext).catch(loadNext);
        });
      }, { rootMargin: '1000px 0px 1000px 0px' });
      sentryIO.observe(sectionEl);_observers.push(sentryIO);
    })();


    /* ═══ MEGA PANEL JS ═══ */

    _addDL('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'g' || e.key === 'G') if(mp)mp.classList.toggle('open');
    });

      currentMode = mode;
      if (mode === 'start') {
        modeStartBtn.style.background = '#4ade80'; modeStartBtn.style.color = '#000'; modeStartBtn.style.borderColor = '#4ade80';
        modeEndBtn.style.background = 'transparent'; modeEndBtn.style.color = '#888'; modeEndBtn.style.borderColor = '#555';
      } else {
        modeEndBtn.style.background = '#ef4444'; modeEndBtn.style.color = '#fff'; modeEndBtn.style.borderColor = '#ef4444';
        modeStartBtn.style.background = 'transparent'; modeStartBtn.style.color = '#888'; modeStartBtn.style.borderColor = '#555';
      }
      /* Update sliders to show current mode values */
        var isMob=window.innerWidth<=640;
        var key=mode==='start'?(isMob?'ms':'start'):(isMob?'me':'end');
        var v = s.dataset[key];
        s.value = v;
        s.nextElementSibling.textContent = v + '%';
      });
    }
    modeEndBtn.addEventListener('click', function() { setMode('end'); });

    /* Slider input: update data-start or data-end + live CSS preview */
      s.addEventListener('input', function() {
        var v = s.value;
        s.nextElementSibling.textContent = v + '%';
        var isMob=window.innerWidth<=640; var wk=currentMode==='start'?(isMob?'ms':'start'):(isMob?'me':'end'); s.dataset[wk]=v;
        /* Live preview: apply to CSS immediately */
        var el = (s.dataset.target === 'cd' && window.innerWidth <= 640) ? rpEl : (s.dataset.target === 'cd' ? cdEl : rpEl);
        el.style.setProperty(s.dataset.prop, v + '%');
      });
    });

    /* Apply button */
      buildTimeline();
      /* Scroll to section to preview */
      var sect = container.querySelector('#cs2-section') || document.createElement('div');
      if (sect) sect.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });


      var vw = window.innerWidth;
      var lines = [];
        var isMob=window.innerWidth<=640; var sk=isMob?'ms':'start'; var ek=isMob?'me':'end'; lines.push(s.dataset.prop.replace('--','') + '  S=' + s.dataset[sk] + '%  F=' + s.dataset[ek] + '%');
      });
    }


    /* Init: sync slider display to current viewport */


    /* MOBILE FIX: Reparent card-level elements into .cs2-right
       so % positioning is relative to the visual panel, not the full card */
    function reparentForMobile() {
      var isMob = window.innerWidth <= 640;
      var right = container.querySelector('#cs2-section .cs2-right') || document.createElement('div');
      var card = container.querySelector('#cs2-card') || document.createElement('div');
      var els = ['cs2-pragma', 'cs2-dlon', 'cs2-kw1', 'cs2-kw2', 'cs2-kw3'];
      
      els.forEach(function(cls) {
        var el = document.querySelector('.' + cls);
        if (!el) return;
        if (isMob && el.parentElement === card) {
          right.appendChild(el);
        } else if (!isMob && el.parentElement === right) {
          card.appendChild(el);
        }
      });
    }
    reparentForMobile();

    /* Rebuild when crossing mobile/desktop threshold */
    var _wasMobcs2 = window.innerWidth <= 640;
    _addWL('resize', function() {
      var isMob = window.innerWidth <= 640;
      if (isMob !== _wasMobcs2) {
        _wasMobcs2 = isMob;
        reparentForMobile();
        buildTimeline();
        setMode(currentMode);
      }
    });


    })();

    /* ═══ CS3 (STUDIOOKO) ═══ */
    (function() {
        var rpEl = container.querySelector('#cs3-right') || document.createElement('div');
    var tloEl = container.querySelector('#cs3-section .cs3-tlo') || document.createElement('div');
    var currentMode = 'start';
    var scrollTl = null;

        var _CS3_S = {'--tlo-left':41,'--tlo-top':2,'--tlo-width':56,'--eye-left':19,'--eye-top':21,'--eye-width':65,'--hand1-right':19,'--hand1-top':5,'--hand1-width':15,'--hand1-opacity':0,'--hand2-left':67,'--hand2-bottom':53,'--hand2-width':17,'--hand2-opacity':0,'--tlum-left':20,'--tlum-bottom':40,'--tlum-width':66,'--tlum-opacity':0,'--hipno-left':19,'--hipno-bottom':20,'--hipno-width':67,'--hipno-opacity':0,'--przyklady-left':28,'--przyklady-bottom':4,'--przyklady-width':72,'--przyklady-opacity':35,'--przyklady-rad-start':0,'--przyklady-rad-opacity':0,'--przyklady-cx':50,'--przyklady-cy':50,'--bg-grad-stop':100,'--eye-radial-start':0,'--eye-radial-opacity':100};
    var _CS3_E = {'--tlo-left':44,'--tlo-top':-3,'--tlo-width':57,'--eye-left':20,'--eye-top':10,'--eye-width':65,'--hand1-right':18,'--hand1-top':17,'--hand1-width':17,'--hand1-opacity':100,'--hand2-left':67,'--hand2-bottom':53,'--hand2-width':18,'--hand2-opacity':100,'--tlum-left':20,'--tlum-bottom':40,'--tlum-width':66,'--tlum-opacity':100,'--hipno-left':19,'--hipno-bottom':20,'--hipno-width':67,'--hipno-opacity':100,'--przyklady-left':5,'--przyklady-bottom':-16,'--przyklady-width':97,'--przyklady-opacity':51,'--przyklady-rad-start':60,'--przyklady-rad-opacity':0,'--przyklady-cx':50,'--przyklady-cy':50,'--bg-grad-stop':43,'--eye-radial-start':80,'--eye-radial-opacity':59};
    function getVals(mode) { return mode==='start' ? Object.assign({}, _CS3_S) : Object.assign({}, _CS3_E); }
    function applyCSS(v) { Object.keys(v).forEach(function(p){ rpEl.style.setProperty(p, (p==='--eye-radial-opacity'||p==='--tlum-opacity'||p==='--hipno-opacity'||p==='--hand1-opacity'||p==='--hand2-opacity'||p==='--przyklady-opacity'||p==='--przyklady-rad-opacity')?v[p]:v[p]+'%'); }); }

    function buildTimeline() {
      if(scrollTl){if(scrollTl.scrollTrigger)scrollTl.scrollTrigger.kill();scrollTl.kill();scrollTl=null;}
      var sv=getVals('start'), ev=getVals('end');
      applyCSS(sv);
      var proxy={},target={},props=[];
      Object.keys(sv).forEach(function(p){var k=p.replace(/--/g,'').replace(/-/g,'_');proxy[k]=sv[p];target[k]=ev[p];props.push({key:k,prop:p});});
      scrollTl=gsap.timeline({scrollTrigger:{trigger:'#cs3-section',start:'60% bottom',end:window.innerWidth<=640?'center 50%':'center 30%',scrub:0.6}});
      if(tloEl)scrollTl.fromTo(tloEl,{filter:'brightness(0.15)'},{filter:'brightness(1)',ease:'power2.inOut',duration:1},0);
      var at=Object.assign({},target);at.ease='power2.inOut';at.duration=1;
      at.onUpdate=function(){props.forEach(function(p){rpEl.style.setProperty(p.prop,(p.prop==='--eye-radial-opacity'||p.prop==='--tlum-opacity'||p.prop==='--hipno-opacity'||p.prop==='--hand1-opacity'||p.prop==='--hand2-opacity'||p.prop==='--przyklady-opacity'||p.prop==='--przyklady-rad-opacity')?String(Math.round(proxy[p.key])):proxy[p.key].toFixed(1)+'%');});};
      scrollTl.to(proxy,at,0);
      scrollRuntime.requestRefresh('st-refresh');
    }
    buildTimeline();

    _addDL('keydown',function(e){if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;if(e.key==='g'||e.key==='G')if(mp)mp.classList.toggle('open');});
      if(m==='start'){sb.style.background='#4ade80';sb.style.color='#000';sb.style.borderColor='#4ade80';eb.style.background='transparent';eb.style.color='#888';eb.style.borderColor='#555';}
      else{eb.style.background='#ef4444';eb.style.color='#fff';eb.style.borderColor='#ef4444';sb.style.background='transparent';sb.style.color='#888';sb.style.borderColor='#555';}
    }


    /* Init: sync slider display to current viewport */

    /* Rebuild when crossing mobile/desktop threshold */
    var _wasMobcs3 = window.innerWidth <= 640;
    _addWL('resize', function() {
      var isMob = window.innerWidth <= 640;
      if (isMob !== _wasMobcs3) {
        _wasMobcs3 = isMob;
        buildTimeline();
        setMode(currentMode);
      }
    });


    })();


    /* Mark as initialized for degradation */
    container.classList.add('is-init');

    /* ═══ FACTORY IO GATING — Ścieżka 1 (Typ B) ═══ */
    var _factoryIo = null;
    var _ioDebounce = null;
    function _getRM() {
      var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      return Math.min(1200, Math.max(200, Math.round(0.5 * vh)));
    }
    function _ioCallback(entries) {
      var e = entries[0]; if (!e) return;
      if (e.isIntersecting) { resume(); }
      else { pause(); }
    }
    function _recreateIO() {
      clearTimeout(_ioDebounce);
      _ioDebounce = setTimeout(function() {
        if (_killed) return;
        if (_factoryIo) _factoryIo.disconnect();
        var rm = _getRM() + 'px';
        _factoryIo = new IntersectionObserver(_ioCallback, { rootMargin: rm + ' 0px ' + rm + ' 0px' });
        _factoryIo.observe(container);
      }, 50);
    }
    _recreateIO();
    _observers.push({ disconnect: function() { if (_factoryIo) _factoryIo.disconnect(); clearTimeout(_ioDebounce); } });
    if (window.visualViewport) {
      var _onVVResize = function() { _recreateIO(); };
      window.visualViewport.addEventListener('resize', _onVVResize, { passive: true });
      _cleanups.push(function() { clearTimeout(_ioDebounce); window.visualViewport.removeEventListener('resize', _onVVResize); });
    }

    /* ═══ LIFECYCLE (Typ B — canvas rAF in CS2) ═══ */
    var _paused = false;
    var _killed = false;

    function pause() {
      if (_paused) return;
      _paused = true;
      /* ONLY canvas rAF — ST scrub is self-gated, videos managed by vidIO */
      if (typeof spinRafId !== 'undefined' && spinRafId) {
        cancelAnimationFrame(spinRafId);
        spinRafId = 0;
      }
    }

    function resume() {
      if (!_paused || _killed) return;
      _paused = false;
      /* ONLY canvas rAF restart */
      if (typeof startSpin === 'function' && typeof spinRafId !== 'undefined') {
        startSpin();
      }
    }

    function kill() {
      if (_killed) return;
      _killed = true;
      pause();
      /* ScrollTriggers — kill all owned by this section */
      ScrollTrigger.getAll().forEach(function(st) {
        if (st.trigger && container.contains(st.trigger)) { st.kill(); }
      });
      /* Observers */
      _observers.forEach(function(o) { if (o && o.disconnect) o.disconnect(); });
      /* Tracked listeners */
      _cleanups.forEach(function(f) { f(); });
      /* Container class */
      /* .is-init kept — degradation is for JS-fail, not intentional kill */
    }

    return { pause: pause, resume: resume, kill: kill };
}

export function WynikiCsTilesEngine() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useGSAP(() => {
    gsap.registerPlugin(ScrollTrigger);

    const el = rootRef.current;
    if (!el) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error('[P3] rootRef.current is null — ref not attached to <div>.');
      }
      return;
    }
    const inst = init(el);
    // POST-BUILD-CATCHUP-01 (2026-04-23): patrz komentarz w CaseStudiesTilesEngine.
    let killed = false;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (killed) return;
        ScrollTrigger.refresh(false);
        ScrollTrigger.update();
      });
    });
    return () => {
      killed = true;
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      inst?.kill?.();
    };
  }, { scope: rootRef });

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
    <div id="wyniki-cs-tiles-section">
  <section id="cs1-section">
    <div className="cs1-card" id="cs1-card">
      <div className="cs1-content">
        <div className="cs1-left">
          <div className="cs-kicker">KSIĘGOWOŚĆ</div>
          <div className="cs-headline">Rebranding, który buduje zaufanie zarządów i ustawia proces sprzedaży</div>
          <div className="cs-stars" aria-hidden="true">
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
          </div>
          <p className="cs-body">Owocni zmienili naszą firmę z &apos;nudnej księgowości&apos; w zaufanego partnera CFO. Praca jak w zegarku. Polecam z czystym sumieniem.</p>
          <div className="cs-author">
            <div className="cs-author-avatar"><img src="assets/ptr.png" alt="" width="37" height="37" loading="lazy" /></div>
            <div>
              <div className="cs-author-name">Piotr Banach</div>
              <div className="cs-author-role">DYREKTOR OPERACYJNY</div>
            </div>
          </div>
        </div>
        <div className="cs1-right" id="cs1-right">
          <div className="cs-tile1-bg-mobile" aria-hidden="true"></div>
          <div className="cs-tile1-banach-desktop" aria-hidden="true"><img src="assets/banach-1wszyi-planFIN-1.png" alt="" width="1400" height="803" loading="lazy" /></div>
          <div className="cs-tile1-consulting">
            <img src="assets/tworzenie-strony-konsulting.jpg" alt="" width="350" height="410" loading="lazy" />
            <video className="cs-vid cs-vid--1" src="assets/portfolios/strona-pattern1.mp4" autoPlay loop playsInline muted></video>
            <video className="cs-vid cs-vid--2" src="assets/portfolios/strona-pattern2.mp4" autoPlay loop playsInline muted></video>
            <video className="cs-vid cs-vid--3" src="assets/portfolios/strona-pattern3.mp4" autoPlay loop playsInline muted></video>
          </div>
          <div className="cs-tile1-finanse"><img src="assets/tworzenie-strony-finanse.jpg" alt="" width="350" height="295" loading="lazy" /></div>
        </div>
      </div>
      <video className="cs-tile1-phone-video" src="assets/portfolios/mobile-design.mp4" autoPlay loop playsInline muted></video>
    </div>
  </section>
  <div className="scroll-spacer"></div>

    <div className="cs-spacer">↓ CS2 Pragmile ↓</div>

  <div className="scroll-spacer"></div>
  <section id="cs2-section">
    <div className="cs2-card" id="cs2-card">
      <div className="cs2-content">
        <div className="cs2-left">
          <div className="cs-kicker">USŁUGI IT &amp; AI</div>
          <div className="cs-headline">Nowy software house od Pragmile™ wchodzi do ligi enterprise AI w 3 miesiące</div>
          <div className="cs-stars" aria-hidden="true">
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
          </div>
          <p className="cs-body">Strona przyciąga dokładnie tych klientów, których szukamy. Tempo ekspresowe, terminy co do dnia! Będziemy wracać.</p>
          <div className="cs-author">
            <div className="cs-author-avatar"><img src="assets/mar.png" alt="" width="37" height="37" loading="lazy" /></div>
            <div>
              <div className="cs-author-name">Marcin Jabłonowski</div>
              <div className="cs-author-role">DYREKTOR ZARZĄDZAJĄCY</div>
            </div>
          </div>
        </div>
        <div className="cs2-right" id="cs2-right">
          <div className="cs2-bg" aria-hidden="true"></div>
          <div className="cs2-plate" aria-hidden="true"></div>
          <div className="cs2-kratki"><img src="assets/kratki.png" alt="" width="200" height="200" loading="lazy" /></div>
          <div className="cs2-tekst1"><img src="assets/tekst-strony1.png" alt="" width="320" height="144" loading="lazy" /></div>
          <div className="cs2-tekst2"><img src="assets/tekst-strony2.png" alt="" width="145" height="120" loading="lazy" /></div>
          <div className="cs2-imgit"><img src="assets/projektowanie-stron-it.jpg" alt="" width="480" height="250" loading="lazy" /></div>
        </div>
      </div>
      {/* Elementy wystawające — poza .cs2-content */}
      <div className="cs2-pragma" aria-hidden="true"><img src="assets/pragma-marcin.png" alt="" width="288" height="339" loading="lazy" /></div>
      <div className="cs2-kw1" aria-hidden="true"><img src="assets/kwadrat-tyl.png" alt="" width="36" height="34" loading="lazy" /></div>
      <div className="cs2-kw2" aria-hidden="true"><img src="assets/kwadrat-srodek.png" alt="" width="53" height="52" loading="lazy" /></div>
      <div className="cs2-kw3" aria-hidden="true"><img src="assets/kwadrat-przod.png" alt="" width="82" height="78" loading="lazy" /></div>
      <div className="cs2-dlon">
        <img src="assets/dlon-mobilna.png" alt="" width="640" height="410" loading="lazy" />
        <div className="cs2-canvas-phone">
          <canvas id="cs2-phone-canvas" aria-hidden="true"></canvas>
          <img className="cs2-phone-fallback" src="assets/portfolios/canvas/000.jpg" alt="" width="242" height="397" loading="lazy" />
        </div>
      </div>
    </div>
  </section>
  <div className="scroll-spacer"></div>

    <div className="cs-spacer">↓ CS3 StudioOko ↓</div>

  <div className="scroll-spacer"></div>
  <section id="cs3-section">
    <div className="cs3-card" id="cs3-card">
      <div className="cs3-content">
        <div className="cs3-left">
          <div className="cs-kicker">MEDIA</div>
          <div className="cs-headline">Od pomysłu do lidera immersyjnych technologii video online — w 6 tygodni</div>
          <div className="cs-stars" aria-hidden="true">
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
            <svg width="70" height="67" viewBox="0 0 70 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M68.7 27.8c.7-.7.9-1.7.6-2.5-.4-.9-1.1-1.5-1.9-1.5l-20.1-3c-.6-.1-1.1-.5-1.4-1.1L36.9 1.3v-.1C36.4.5 35.6 0 34.8 0c-1 0-1.8.5-2.2 1.4L23.6 19.8c-.2.5-.8.9-1.4 1L2.2 23.8c-.9.1-1.6.7-2 1.6-.3.9-.2 1.8.5 2.6l14.5 14.3c.5.5.7 1.1.6 1.8L12.4 64c-.2.9.2 1.8.9 2.4l.1.1c.5.3.9.4 1.3.4s.9-.2 1.1-.3l18-9.6c.5-.3 1.2-.3 1.8 0l17.9 9.5c.5.3 1.4.6 2.5-.1.9-.5 1.3-1.5 1.1-2.4l-3.4-20.2c-.1-.6.1-1.3.5-1.7l14.5-14.3z" fill="#FFC602"/></svg>
          </div>
          <p className="cs-body">Wreszcie mamy narzędzie, które pokazuje prawdziwą jakość naszego projektu. Niespotykana dbałość o detale. Pełen profesjonalizm.</p>
          <div className="cs-author">
            <div className="cs-author-avatar"><img src="assets/vit.png" alt="" width="37" height="37" loading="lazy" /></div>
            <div>
              <div className="cs-author-name">Witalij Bińkowski</div>
              <div className="cs-author-role">WŁAŚCICIEL</div>
            </div>
          </div>
        </div>
        <div className="cs3-right" id="cs3-right">
          <div className="cs3-bg" aria-hidden="true"></div>
          <div className="cs3-tlo"><img src="assets/tlo-strony.png" alt="" width="320" height="295" loading="lazy" /></div>
          <div className="cs3-eye">
            <img src="assets/projektowanie-strony-oko.jpg" alt="" width="560" height="289" loading="lazy" />
            <div className="cs3-eye-radial" aria-hidden="true"></div>
          </div>
          <div className="cs3-hand1"><img src="assets/dlon-artefakt.png" alt="" width="160" height="187" loading="lazy" /></div>
          <div className="cs3-hand2"><img src="assets/dlon-mobile-design.png" alt="" width="160" height="107" loading="lazy" /></div>
          <div className="cs3-tlum"><img src="assets/tlum.png" alt="" width="560" height="115" loading="lazy" /></div>
          <div className="cs3-hipno"><img src="assets/hipnotyzuj.gif" alt="" width="400" height="114" loading="lazy" /></div>
          <div className="cs3-przyklady"><img src="assets/przyklady-strony.png" alt="" width="432" height="213" loading="lazy" />
            <div className="cs3-przyklady-radial" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
  <div className="scroll-spacer"></div>
    </div>
  );
}
