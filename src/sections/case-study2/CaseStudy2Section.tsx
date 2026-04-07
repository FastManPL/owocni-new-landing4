// @ts-nocheck — sekcja robocza (silnie typowana w Fabryce); import z page.tsx wymusza check bez exclude.
'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollRuntime } from '@/lib/scrollRuntime';
import './case-study-section.css';

// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// registerPlugin() WYŁĄCZNIE wewnątrz useGSAP(() => { ... }).

function init(container: HTMLElement): { kill: () => void; pause: () => void; resume: () => void } {
  /* FIX: null container guard — SPA / async mount safety */
  if (!container) return { pause: function(){}, resume: function(){}, kill: function(){} };

  const DEBUG_MODE =
    new URLSearchParams(window.location.search).has('debug') ||
    localStorage.getItem('debug') === '1';

  const $   = (sel: string): Element | null => container.querySelector(sel);
  const $$  = (sel: string): Element[] => [...container.querySelectorAll(sel)];
  const $id = (id: string): Element | null => container.querySelector('#' + id);
  const getScroll = (): number => scrollRuntime.getScroll();

  const cleanups = [];
  const timerIds = [];
  const observers = [];

  /* ─── DEBUG ───────────────────────────────────────────────────────── */
  const elDebug   = $id('case-study-debug');
  const elDbScroll = $id('case-study-debug-scroll');
  const elDbVp    = $id('case-study-debug-vp');
  const elDbBp    = $id('case-study-debug-bp');

  if (DEBUG_MODE && elDebug) {
    elDebug.classList.add('case-study-debug--visible');

    const onScroll = () => {
      if (elDbScroll) elDbScroll.textContent = Math.round(getScroll()) + 'px';
    };
    const onResize = () => {
      const w = window.innerWidth;
      if (elDbVp) elDbVp.textContent = w + '×' + window.innerHeight;
      if (elDbBp) elDbBp.textContent =
        w <= 600 ? 'mobile' : w <= 720 ? 'tablet' : w >= 2000 ? 'widescreen' : 'desktop';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    onScroll(); onResize();
    cleanups.push(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    });
  }

  /* ─── CTA — WAVE + AUREOLA + CURSOR PARTICLES ────────────────────── */
  const pauseHooks = [], resumeHooks = [];
  let bindAureola = () => {}, unbindAureola = () => {};

  const onVisChange = () => {
    if (document.hidden) pauseHooks.forEach(h => h());
    else resumeHooks.forEach(h => h());
  };
  document.addEventListener('visibilitychange', onVisChange);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVisChange));

  // Wave click
  $$('.case-study-btn-wrapper-wave').forEach((wrapper) => {
    const _touchActivate = () => {};
    wrapper.addEventListener('touchstart', _touchActivate, {passive:true});
    const handler = () => {
      const wave = document.createElement('span');
      wave.classList.add('case-study-wave-effect', 'animating');
      wrapper.insertBefore(wave, wrapper.firstChild);
      wave.addEventListener('animationend', () => wave.remove());
    };
    wrapper.addEventListener('click', handler);
    cleanups.push(() => {
      wrapper.removeEventListener('touchstart', _touchActivate);
      wrapper.removeEventListener('click', handler);
    });
  });

  // Cursor particles — sprites + system TYLKO na desktop (2C)
  {
    const canDoHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth > 600;
    if (canDoHover) {
      // Shared star sprites (przeniesione z globalnego scope)
      const STAR_PTS = 8;
      const starCos = new Float32Array(STAR_PTS), starSin = new Float32Array(STAR_PTS);
      for (let i = 0; i < STAR_PTS; i++) { const a = (i * Math.PI) / 4; starCos[i] = Math.cos(a); starSin[i] = Math.sin(a); }
      const STAR_SPR_SZ = 128, STAR_SPR_HALF = STAR_SPR_SZ / 2;
      const sharedStarPhases = [0, 0.5, 1.0].map(tw => {
        const c = document.createElement('canvas'); c.width = STAR_SPR_SZ; c.height = STAR_SPR_SZ;
        const ctx = c.getContext('2d'); if (!ctx) return c;
        ctx.translate(STAR_SPR_HALF, STAR_SPR_HALF);
        const gr = ctx.createRadialGradient(0,0,0, 0,0, STAR_SPR_HALF);
        gr.addColorStop(0,'#ffffff'); gr.addColorStop(0.3,'#fffde8');
        gr.addColorStop(0.6,'#ffeaa0'); gr.addColorStop(1,'rgba(255,234,160,0)');
        ctx.fillStyle = gr;
        const refSize = STAR_SPR_HALF / 2, oR = refSize * (1.4 + tw * 0.5), iR = refSize * 0.35;
        ctx.beginPath();
        for (let i=0;i<STAR_PTS;i++){const r=(i&1)===0?oR:iR;if(i===0)ctx.moveTo(starCos[i]*r,starSin[i]*r);else ctx.lineTo(starCos[i]*r,starSin[i]*r);}
        ctx.closePath(); ctx.fill(); return c;
      });
      const sharedDotSprite = document.createElement('canvas'); sharedDotSprite.width = 64; sharedDotSprite.height = 64;
      { const ctx = sharedDotSprite.getContext('2d'); if (ctx) { ctx.translate(32,32); ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(0,0,32*0.15,0,Math.PI*2); ctx.fill(); } }

      const cWrapper = $('.case-study-btn-wrapper-wave'), cButton = $('.case-study-cta');
      if (cWrapper && cButton) {
        const cCanvas = document.createElement('canvas'), cCtx = cCanvas.getContext('2d');
        if (!cCtx) return;  /* FIX: graceful degradation if context unavailable */
        cCanvas.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:100;width:500px;height:300px;';
        const cDpr=window.devicePixelRatio||1; cCanvas.width=Math.round(500*cDpr); cCanvas.height=Math.round(300*cDpr);
        cWrapper.appendChild(cCanvas);
        const glowSprite=document.createElement('canvas'); glowSprite.width=128; glowSprite.height=128;
        const glowCtx=glowSprite.getContext('2d');
        if (!glowCtx) { if (cCanvas.parentNode) cCanvas.parentNode.removeChild(cCanvas); return; }
        const gg=glowCtx.createRadialGradient(64,64,0,64,64,64);
        gg.addColorStop(0,'rgba(255,255,255,1)'); gg.addColorStop(0.2,'rgba(255,253,232,0.71)');
        gg.addColorStop(0.5,'rgba(255,234,160,0.29)'); gg.addColorStop(1,'rgba(255,234,160,0)');
        glowCtx.fillStyle=gg; glowCtx.fillRect(0,0,128,128);
        let cIsHovering=false,cLastSpawn=0; const cSpawnRate=31;
        let cMouseX=250,cMouseY=150,cTargetMouseX=250,cTargetMouseY=150,cLastMouseX2=250,cLastMouseY2=150;
        let cMouseSpeed=0,cMouseAngle=0,cSmoothedSpeed=0,cIdleTime=0,cLastTimestamp=0;
        let cAnimationId=null,cIsAnimating=false;
        const C_MAX_PARTICLES=150,C_FRICTION=0.970225;
        const cParticles=new Array(C_MAX_PARTICLES); let cActiveCount=0;
        for(let i=0;i<C_MAX_PARTICLES;i++)cParticles[i]=null;
        let cCachedRect=null,cCachedScaleX=1,cCachedScaleY=1;
        function cUpdateCachedRect(){cCachedRect=cCanvas.getBoundingClientRect();cCachedScaleX=500/cCachedRect.width;cCachedScaleY=300/cCachedRect.height;}
        requestAnimationFrame(cUpdateCachedRect);
        let cResizeScheduled=false;
        const cOnResize=()=>{if(!cResizeScheduled){cResizeScheduled=true;requestAnimationFrame(()=>{cUpdateCachedRect();cResizeScheduled=false;});}};
        window.addEventListener('resize',cOnResize);
        const cRand=(min,max)=>Math.random()*(max-min)+min;
        const cParticlePool=[];
        class CursorParticle{constructor(){this.x=0;this.y=0;this.size=0;this.hasGlow=false;this.speedX=0;this.speedY=0;this.life=0;this.maxLife=1;this.fadeInSpeed=0.07;this.isFadingIn=true;this.decay=0;this.gravity=-0.002;this.rotation=0;this.rotationSpeed=0;this.twinkle=0;this.twinkleSpeed=0;this.reset(0,0,0,0);}
          reset(x,y,cs,ca){this.x=x;this.y=y;this.size=Math.random()<0.25?cRand(5.625,8.625):cRand(2.25,4.375);this.hasGlow=Math.random()<0.25;const isMoving=cs>0.5;if(isMoving){const opp=ca+Math.PI,spread=(Math.random()-0.5)*Math.PI*0.6,a=opp+spread,s=cRand(0.3,0.9)+cs*0.1;this.speedX=Math.cos(a)*s;this.speedY=Math.sin(a)*s;}else{const a=cRand(0,Math.PI*2),s=cRand(0.15,0.45);this.speedX=Math.cos(a)*s;this.speedY=Math.sin(a)*s;}this.life=0;this.maxLife=1;this.fadeInSpeed=0.07;this.isFadingIn=true;this.decay=cRand(0.006,0.018);this.gravity=-0.002;this.rotation=cRand(0,Math.PI*2);this.rotationSpeed=(Math.random()-0.5)*0.15;this.twinkle=cRand(0,Math.PI*2);this.twinkleSpeed=cRand(0.1,0.32);return this;}
          update(){if(this.isFadingIn){this.life+=this.fadeInSpeed*2;if(this.life>=this.maxLife){this.life=this.maxLife;this.isFadingIn=false;}}else{this.life-=this.decay*2;}this.x+=this.speedX*2;this.y+=this.speedY*2;this.speedY+=this.gravity*2;this.speedX*=C_FRICTION;this.speedY*=C_FRICTION;this.rotation+=this.rotationSpeed*2;this.twinkle+=this.twinkleSpeed*2;return this.life>0;}
          draw(){if(this.life<=0)return;const tw=(Math.sin(this.twinkle)+1)*0.5,al=this.life*(0.5+tw*0.5);const co=Math.cos(this.rotation),si=Math.sin(this.rotation);cCtx.setTransform(co*cDpr,si*cDpr,-si*cDpr,co*cDpr,this.x*cDpr,this.y*cDpr);if(this.hasGlow){const gd=(this.size*4+10+tw*8)*0.75*2,go=-gd/2;cCtx.globalAlpha=al*0.35;cCtx.drawImage(glowSprite,go,go,gd,gd);}cCtx.globalAlpha=al;const phase=tw<0.25?0:tw<0.75?1:2;const drawR=this.size*2;cCtx.drawImage(sharedStarPhases[phase],-drawR,-drawR,drawR*2,drawR*2);cCtx.globalAlpha=this.life;cCtx.drawImage(sharedDotSprite,-drawR,-drawR,drawR*2,drawR*2);}}
        function cGetParticle(x,y,s,a){let p=cParticlePool.pop();if(!p)p=new CursorParticle();return p.reset(x,y,s,a);}
        function cReleaseParticle(p){if(cParticlePool.length<C_MAX_PARTICLES)cParticlePool.push(p);}
        function cCreateParticle(){if(cActiveCount>=C_MAX_PARTICLES)return;const minR=10,maxR=30,offY=Math.random()<0.9?28:0;let sR,sA;if(cSmoothedSpeed>0.5){const oa=cMouseAngle+Math.PI;sA=oa+(Math.random()-0.5)*Math.PI*0.8;sR=minR+Math.random()*(maxR-minR)+cSmoothedSpeed*3;}else{sA=cRand(0,Math.PI*2);sR=minR+Math.random()*(maxR-minR);}const px=cMouseX+Math.cos(sA)*sR,py=cMouseY+Math.sin(sA)*sR+offY;const p=cGetParticle(px,py,cSmoothedSpeed,cMouseAngle);for(let i=0;i<C_MAX_PARTICLES;i++){if(cParticles[i]===null){cParticles[i]=p;cActiveCount++;return;}}}
        function cStartAnimation(){if(!cIsAnimating){cIsAnimating=true;cLastTimestamp=performance.now();cAnimationId=requestAnimationFrame(cAnimate);}}
        const C_FRAME_MS=1000/30; let cLastPaint=0;
        function cAnimate(ts){if(ts-cLastPaint<C_FRAME_MS){cAnimationId=requestAnimationFrame(cAnimate);return;}cLastPaint=ts;const dt=cLastTimestamp?(ts-cLastTimestamp)/1000:0;cLastTimestamp=ts;cMouseX+=(cTargetMouseX-cMouseX)*0.18;cMouseY+=(cTargetMouseY-cMouseY)*0.18;const dx=cMouseX-cLastMouseX2,dy=cMouseY-cLastMouseY2;cMouseSpeed=Math.sqrt(dx*dx+dy*dy);if(cMouseSpeed>0.1)cMouseAngle=Math.atan2(dy,dx);cSmoothedSpeed+=(cMouseSpeed-cSmoothedSpeed)*0.15;if(cSmoothedSpeed<0.5)cIdleTime+=dt;else cIdleTime=0;cLastMouseX2=cMouseX;cLastMouseY2=cMouseY;cCtx.setTransform(cDpr,0,0,cDpr,0,0);cCtx.clearRect(0,0,500,300);if(cIsHovering){let rate=cSpawnRate;if(cIdleTime>0)rate=cSpawnRate*(1+1.5*Math.min(cIdleTime/3,1));if(ts-cLastSpawn>rate){cCreateParticle();cLastSpawn=ts;}}for(let i=0;i<C_MAX_PARTICLES;i++){const p=cParticles[i];if(p===null)continue;if(p.update())p.draw();else{cReleaseParticle(p);cParticles[i]=null;cActiveCount--;}}if(!cIsHovering&&cActiveCount===0){cIsAnimating=false;cAnimationId=null;return;}cAnimationId=requestAnimationFrame(cAnimate);}
        const cOnMove=(e)=>{if(!cCachedRect)return;cTargetMouseX=(e.clientX-cCachedRect.left)*cCachedScaleX;cTargetMouseY=(e.clientY-cCachedRect.top)*cCachedScaleY;};
        const cOnEnter=()=>{cIsHovering=true;cUpdateCachedRect();cStartAnimation();};
        const cOnLeave=()=>{cIsHovering=false;};
        cWrapper.addEventListener('mousemove',cOnMove);
        cButton.addEventListener('mouseenter',cOnEnter);
        cButton.addEventListener('mouseleave',cOnLeave);
        let _wasCAnimating=false;
        pauseHooks.push(()=>{_wasCAnimating=cIsAnimating;if(cAnimationId){cancelAnimationFrame(cAnimationId);cAnimationId=null;}cIsAnimating=false;});
        resumeHooks.push(()=>{if(_wasCAnimating&&cActiveCount>0)cStartAnimation();});
        cleanups.push(()=>{if(cAnimationId)cancelAnimationFrame(cAnimationId);window.removeEventListener('resize',cOnResize);cWrapper.removeEventListener('mousemove',cOnMove);cButton.removeEventListener('mouseenter',cOnEnter);cButton.removeEventListener('mouseleave',cOnLeave);if(cCanvas.parentNode)cCanvas.parentNode.removeChild(cCanvas);});
      }
    }
  }


  /* ═══ ZOOM SCROLL ANIMATION (merged into init — N2) ═══════════════ */
  const gsapInstances = [];   /* N3: tracking GSAP for kill() */

  const layer   = $id('case-study-zoom-layer');
  const tlo     = $id('case-study-tlo');
  const deviceWrapper = $id('case-study-device-wrapper');
  const bgVideo = $('.mockup-video');
  const laptopFrame = $id('case-study-laptop-frame');

  if (layer) {
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: '60% bottom',
        end:   'center 30%',
        scrub: 0.6,
      }
    });
    gsapInstances.push(tl);

    /* TLO parallax: góra→dół */
    if (tlo) {
      tl.fromTo(tlo,
        { yPercent: 0 },
        { yPercent: -43.5, ease: 'none', duration: 1 },
        0
      );
    }

    /* Laptop Frame: proxy → CSS vars (transform-origin: bottom)
     * MIN (dół scrollu):  x:0%,   y:-0.5%, scale:1.07
     * MAX (góra scrollu): x:2%,   y:8%,    scale:1.35
     */
    if (laptopFrame) {
      var frameP = { x: 0, y: -0.5, s: 1.07 };
      tl.to(frameP, {
        x: 2, y: 8, s: 1.35,
        ease: 'power2.inOut', duration: 1,
        onUpdate: function() {
          laptopFrame.style.setProperty('--frame-x', frameP.x.toFixed(2) + '%');
          laptopFrame.style.setProperty('--frame-y', frameP.y.toFixed(2) + '%');
          laptopFrame.style.setProperty('--frame-scale', frameP.s.toFixed(4));
        }
      }, 0);
    }

    /* Screen Video: proxy → CSS vars (breakpoint-aware)
     * MOBILE (≤600):   MIN … s:1.08  →  MAX … s:1.26 (większy fill otworu ekranu)
     * DESKTOP (>600):  MIN x:49.5 y:55 s:1.02  →  MAX x:50.5 y:52   s:1.27
     */
    if (bgVideo) {
      var isMobile = window.innerWidth <= 600;
      var vidMin = isMobile
        ? { x: 49,   y: 55,  s: 1.08 }
        : { x: 49.5, y: 55,  s: 1.02 };
      var vidMax = isMobile
        ? { x: 51,   y: 52.5, s: 1.26 }
        : { x: 50.5, y: 52,   s: 1.27 };

      var vidP = { x: vidMin.x, y: vidMin.y, s: vidMin.s };
      tl.to(vidP, {
        x: vidMax.x, y: vidMax.y, s: vidMax.s,
        ease: 'power2.inOut', duration: 1,
        onUpdate: function() {
          bgVideo.style.setProperty('--scrvid-x', vidP.x.toFixed(2) + '%');
          bgVideo.style.setProperty('--scrvid-y', vidP.y.toFixed(2) + '%');
          bgVideo.style.setProperty('--scrvid-scale', vidP.s.toFixed(4));
        }
      }, 0);
    }

    /* Device wrapper: brightness — wyjeżdża z cienia */
    if (deviceWrapper) {
      tl.fromTo(deviceWrapper,
        { filter: 'brightness(0.15)' },
        { filter: 'brightness(1)', ease: 'power2.inOut', duration: 1 },
        0
      );
    }
  }

  /* Video visibility gating (3B) */
  if (bgVideo && 'IntersectionObserver' in window) {
    var videoIO = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) bgVideo.play().catch(function() {});
        else bgVideo.pause();
      });
    }, { rootMargin: '200px' });
    videoIO.observe(bgVideo);
    observers.push(videoIO);   /* N4: tracked for kill() */

    /* Video pause/resume hooks — koordynacja z Factory IO gating */
    pauseHooks.push(function() { bgVideo.pause(); });
    resumeHooks.push(function() { bgVideo.play().catch(function() {}); });
    /* Explicit kill cleanup — pause only (src jest w statycznym HTML) */
    cleanups.push(function() { bgVideo.pause(); });
  }

  /* ─── THUMB VIDEO (PLAY-NEW.mp4, lewy panel) — pause/resume/kill ─── */
  var thumbVideo = $('.case-study-vthumb-face video');
  if (thumbVideo) {
    pauseHooks.push(function() { thumbVideo.pause(); });
    resumeHooks.push(function() { thumbVideo.play().catch(function() {}); });
    cleanups.push(function() { thumbVideo.pause(); });
  }

  /* ═══ PLAY BUTTON + VIDEO POPUP (merged into init — N2) ════════ */
  var rightPanel = $('.case-study-right');
  var ctaBtn     = $('.case-study-cta');
  /* Popup renderowany przez portal na document.body — poza #case-study-section */
  var popup      = document.getElementById('case-study-video-popup');
  var bodyOverflowLocked = false;   /* N5: guard */

  if (rightPanel && popup) {
    /* ─── CREATE PLAY BUTTON SVG ─────────────────────────────── */
    var YELLOW = '#ffc600', ns = 'http://www.w3.org/2000/svg';
    var pbSize = 64;
    var SW = Math.max(2, pbSize * 0.035), CX = pbSize / 2, CY = pbSize / 2;
    var R = CX - SW * 2 - 2, CIRC = 2 * Math.PI * R;
    var DOT_R = SW * 1.05, DOT_COUNT = Math.round(CIRC / (DOT_R * 5.5));
    var kfId = 'case-study-pb-spin';

    var kfStyle = document.createElement('style');
    kfStyle.textContent = '@keyframes ' + kfId + '{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
    document.head.appendChild(kfStyle);
    cleanups.push(function() { if (kfStyle.parentNode) kfStyle.parentNode.removeChild(kfStyle); });

    var wrap = document.createElement('div');
    wrap.className = 'case-study-play-btn';
    rightPanel.appendChild(wrap);
    cleanups.push(function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); });

    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', pbSize);
    svg.setAttribute('height', pbSize);
    svg.setAttribute('viewBox', '0 0 ' + pbSize + ' ' + pbSize);
    svg.style.cssText = 'display:block;overflow:visible;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.35));';
    wrap.appendChild(svg);

    /* Dots ring */
    var dotsG = document.createElementNS(ns, 'g');
    dotsG.style.cssText = 'transform-origin:' + CX + 'px ' + CY + 'px;animation:' + kfId + ' 8s linear infinite;animation-play-state:paused;';
    svg.appendChild(dotsG);
    var dotEls = [];
    for (var di = 0; di < DOT_COUNT; di++) {
      var da = (di / DOT_COUNT) * Math.PI * 2 - Math.PI / 2;
      var dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', CX + Math.cos(da) * R);
      dot.setAttribute('cy', CY + Math.sin(da) * R);
      dot.setAttribute('r', DOT_R);
      dot.setAttribute('fill', YELLOW);
      dot.setAttribute('opacity', '0.22');
      dot.style.transition = 'opacity 0.35s ease';
      dotsG.appendChild(dot);
      dotEls.push(dot);
    }

    /* Progress arc */
    var arc = document.createElementNS(ns, 'circle');
    arc.setAttribute('cx', CX);
    arc.setAttribute('cy', CY);
    arc.setAttribute('r', R);
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', '#ffffff');
    arc.setAttribute('stroke-width', SW * 1.6);
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('stroke-dasharray', CIRC.toFixed(1));
    arc.setAttribute('stroke-dashoffset', CIRC.toFixed(1));
    arc.setAttribute('transform', 'rotate(-90 ' + CX + ' ' + CY + ')');
    arc.style.cssText = 'transition:opacity 0.4s ease;';
    svg.appendChild(arc);

    /* Triangle */
    var h = pbSize * 0.32, w = h * 0.866, ox = h * 0.1;
    var triPts = (CX - w/2 + ox) + ',' + (CY - h/2) + ' ' + (CX + w/2 + ox) + ',' + CY + ' ' + (CX - w/2 + ox) + ',' + (CY + h/2);
    var triG = document.createElementNS(ns, 'g');
    triG.style.cssText = 'transform-origin:' + CX + 'px ' + CY + 'px;transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1);';
    svg.appendChild(triG);
    var tri = document.createElementNS(ns, 'polygon');
    tri.setAttribute('points', triPts);
    tri.setAttribute('fill', YELLOW);
    tri.style.transition = 'fill 0.3s ease';
    triG.appendChild(tri);

    /* Show play button */
    var showPbTimer = setTimeout(function() { wrap.classList.add('is-visible'); }, 800);
    timerIds.push(showPbTimer);

    /* Hover effects — right panel */
    var bounceT = null;
    var onPanelEnter = function() {
      dotsG.style.animationPlayState = 'running';
      dotEls.forEach(function(d) { d.setAttribute('opacity', '0.5'); });
      arc.style.opacity = '0';
      tri.setAttribute('fill', '#ffffff');
      triG.style.transform = 'scale(0.7)';
      clearTimeout(bounceT);
      bounceT = setTimeout(function() { triG.style.transform = 'scale(1.35)'; }, 150);
    };
    var onPanelLeave = function() {
      dotsG.style.animationPlayState = 'paused';
      dotEls.forEach(function(d) { d.setAttribute('opacity', '0.22'); });
      arc.style.opacity = '1';
      tri.setAttribute('fill', YELLOW);
      triG.style.transform = 'scale(0.75)';
      clearTimeout(bounceT);
      bounceT = setTimeout(function() { triG.style.transform = 'scale(1)'; }, 150);
    };
    rightPanel.addEventListener('mouseenter', onPanelEnter);
    rightPanel.addEventListener('mouseleave', onPanelLeave);
    cleanups.push(function() {
      rightPanel.removeEventListener('mouseenter', onPanelEnter);
      rightPanel.removeEventListener('mouseleave', onPanelLeave);
      clearTimeout(bounceT);
    });

    /* Video progress → arc (throttled 500ms) */
    if (bgVideo) {
      var arcLastUpdate = 0;
      var onTimeUpdate = function() {
        var now = performance.now();
        if (now - arcLastUpdate < 500) return;
        arcLastUpdate = now;
        if (bgVideo.duration > 0) {
          arc.setAttribute('stroke-dashoffset', (CIRC * (1 - bgVideo.currentTime / bgVideo.duration)).toFixed(1));
        }
      };
      bgVideo.addEventListener('timeupdate', onTimeUpdate);
      cleanups.push(function() { bgVideo.removeEventListener('timeupdate', onTimeUpdate); });
    }

    /* ─── POPUP LOGIC ────────────────────────────────────────── */
    var popupVid = popup.querySelector('video');

    function openPopup() {
      if (popup.classList.contains('is-open')) return;
      if (popupVid) {
        popupVid.src = '/wyniki/Parkapp.mp4';
        popupVid.load();           /* FIX: wymuszenie bufora dla iOS Safari */
        popupVid.currentTime = 0;
      }
      popup.classList.add('is-open');
      /*
       * Blokada tła jak w WynikiSection (overflow) — BEZ position:fixed + top.
       * Wzorzec iOS (fixed body + scrollTo przy close) psuje Lenis: po unlock skok na górę.
       */
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      bodyOverflowLocked = true;
      if (popupVid) {
        var pp = popupVid.play();
        if (pp !== undefined) pp.catch(function() {});
      }
    }

    function closePopup() {
      popup.classList.remove('is-open');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      bodyOverflowLocked = false;
      if (popupVid) {
        popupVid.pause();
        popupVid.removeAttribute('src');
        popupVid.load();
      }
    }

    var onRightPanelClick = function(e) { e.preventDefault(); openPopup(); };
    rightPanel.addEventListener('click', onRightPanelClick);
    cleanups.push(function() { rightPanel.removeEventListener('click', onRightPanelClick); });

    /* Video thumbnail (lewy panel) — też otwiera popup */
    var vThumb = container.querySelector('.case-study-video-thumb');
    if (vThumb) {
      var onVThumbClick = function(e) { e.preventDefault(); openPopup(); };
      vThumb.addEventListener('click', onVThumbClick);
      cleanups.push(function() { vThumb.removeEventListener('click', onVThumbClick); });
    }

    if (ctaBtn) {
      var onCtaClick = function(e) { e.preventDefault(); openPopup(); };
      ctaBtn.addEventListener('click', onCtaClick);
      cleanups.push(function() { ctaBtn.removeEventListener('click', onCtaClick); });
    }

    /* Popup CTA "Otrzymaj wycenę" — zamyka modal; bez tego #kontakt + Lenis skacze na górę */
    var popupCta = popup.querySelector('#case-study-popup-cta');
    if (popupCta) {
      var onPopupCtaClick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        closePopup();
      };
      popupCta.addEventListener('click', onPopupCtaClick);
      cleanups.push(function() { popupCta.removeEventListener('click', onPopupCtaClick); });
    }

    var onPopupBackdropClick = function(e) { if (e.target === popup) closePopup(); };
    popup.addEventListener('click', onPopupBackdropClick);
    cleanups.push(function() { popup.removeEventListener('click', onPopupBackdropClick); });

    var closeX = popup.querySelector('.wp-close');
    var closeTextBtn = popup.querySelector('.wp-close-text');
    if (closeX) {
      closeX.addEventListener('click', closePopup);
      cleanups.push(function() { closeX.removeEventListener('click', closePopup); });
    }
    if (closeTextBtn) {
      closeTextBtn.addEventListener('click', closePopup);
      cleanups.push(function() { closeTextBtn.removeEventListener('click', closePopup); });
    }

    var onEscKey = function(e) {
      if (e.key === 'Escape' && popup.classList.contains('is-open')) closePopup();
    };
    document.addEventListener('keydown', onEscKey);
    cleanups.push(function() { document.removeEventListener('keydown', onEscKey); });
  }

  /* ═══ FACTORY IO GATING — Ścieżka 1 (Typ B → pause/resume) ════ */
  var _factoryIo = null;
  var _factoryIoDebounce = null;

  function _getGatingMargin() {
    var vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) || 800;
    return Math.min(1200, Math.max(200, Math.round(vh * 0.5))) + 'px';
  }

  function _ioCallback(entries) {
    if (!entries[0]) return;
    if (entries[0].isIntersecting) { resume(); }
    else { pause(); }
  }

  function _recreateFactoryIo() {
    clearTimeout(_factoryIoDebounce);
    _factoryIoDebounce = setTimeout(function() {
      if (_killed) return;
      if (_factoryIo) _factoryIo.disconnect();
      _factoryIo = new IntersectionObserver(_ioCallback, {
        rootMargin: _getGatingMargin()
      });
      _factoryIo.observe(container);
      observers.push(_factoryIo);
    }, 50);
  }

  _recreateFactoryIo();

  var _onVVResize = function() { _recreateFactoryIo(); };
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _onVVResize, { passive: true });
    cleanups.push(function() {
      clearTimeout(_factoryIoDebounce);
      window.visualViewport.removeEventListener('resize', _onVVResize);
    });
  }

  /* ═══ ST-REFRESH-01 — section-in-view + layout-settle ══════════ */
  var _stIo = new IntersectionObserver(function(entries) {
    if (!entries[0]?.isIntersecting) return;
    scrollRuntime.requestRefresh('section-in-view');
    _stIo.disconnect();
  }, { threshold: 0, rootMargin: '0px' });
  _stIo.observe(container);
  observers.push(_stIo);
  cleanups.push(function() { _stIo.disconnect(); });

  var _settleTimer = setTimeout(function() {
    scrollRuntime.requestRefresh('layout-settle');
  }, 1000);
  timerIds.push(_settleTimer);

  /* ═══ LIFECYCLE (N3 + N5 + N6 + B-CPU-03) ════════════════════════ */
  var _paused = false;
  var _killed = false;
  function pause() {
    if (_paused) return;  /* B-CPU-03: idempotent */
    _paused = true;
    pauseHooks.forEach(function(h) { h(); });
  }
  function resume() {
    if (!_paused) return; /* B-CPU-03: idempotent */
    _paused = false;
    resumeHooks.forEach(function(h) { h(); });
  }

  function kill() {
    if (_killed) return;
    _killed = true;
    pause(); /* ensure paused before teardown */
    /* Background video: tylko pause — src jest w statycznym HTML, nie usuwaj */
    if (bgVideo) { bgVideo.pause(); }
    /* Domknij popup jeśli otwarty */
    if (popup && popup.classList.contains('is-open')) {
      popup.classList.remove('is-open');
      var v = popup.querySelector('video');
      if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    }
    /* B-CPU-05: tickery/RAF → listeners → observers → timelines → ST */
    cleanups.forEach(function(fn) { try { fn(); } catch(e) {} });
    timerIds.forEach(function(id) { try { clearTimeout(id); } catch(e) {} });
    observers.forEach(function(o) { try { o.disconnect?.(); } catch(e) {} });
    gsapInstances.forEach(function(x) { try { x.revert(); x.kill(); } catch(e) {} });
    if (bodyOverflowLocked) {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    gsapInstances.length = 0;
    cleanups.length = 0;
    timerIds.length = 0;
    observers.length = 0;
  }

  return { pause, resume, kill };
}


export function CaseStudy2Section() {
  const rootRef = useRef<HTMLElement | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useLayoutEffect(() => {
    setPortalReady(true);
  }, []);

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
  }, { scope: rootRef, dependencies: [portalReady], revertOnUpdate: true });

  const popupMarkup = (
    <div id="case-study-video-popup">
      <div className="wp-wrapper">
        <div className="wp-close">✕</div>
        <div className="wp-panel">
          <div className="wp-video-wrap">
            <video controls playsInline preload="none"></video>
          </div>
          <div className="wp-content">
            <span className="wp-tag">Zobacz jak to działa</span>
            <h3 className="wp-title"><b>Otrzymaj 3 propozycje cenowe</b> na projekt dla swojej firmy.</h3>
            <div className="wp-buttons">
              <div className="case-study-btn-wrapper-wave">
                <a href="#kontakt" className="case-study-cta" id="case-study-popup-cta">
                  <span className="case-study-btn-hole"></span>
                  <span className="case-study-btn-cap"></span>
                  <span className="case-study-btn-text" data-text="Otrzymaj wycenę teraz →">Otrzymaj wycenę teraz →</span>
                </a>
                <div className="case-study-btn-static-floor"></div>
              </div>
              <button className="wp-close-text" type="button">Zamknij wideo</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
  <>
  <section id="case-study-section" ref={rootRef}>

    <div className="case-study-card">
      <div className="case-study-content">

        {/* LEWY PANEL: Case Study */}
        <div className="case-study-left">
          <h2 className="case-study-heading case-study-heading--casestudy" id="case-study-heading">
            CASE STUDY
          </h2>

          <div className="case-study-spacer case-study-spacer--top" aria-hidden="true"></div>

          <p className="case-study-sub case-study-sub--casestudy" id="case-study-sub">
            <strong>Zobacz przebieg realizacji<br />strony ParkAPP.pl od kuchni.</strong><br />
            <span className="case-study-sub-light" style={{ fontStyle: 'normal' }}>(1 min) – Słowami właściciela</span>
          </p>

          {/* Video — absolute, pętla, nie rozpycha layoutu */}
          <div className="case-study-video-thumb" id="case-study-video-thumb">
            <div className="case-study-vthumb-face">
              <video src="/wyniki/PLAY-NEW.mp4" poster="/wyniki/TLO-Portfolio.webp" autoPlay loop muted playsInline preload="auto"></video>
            </div>
          </div>

          {/* Flex grow — popycha CTA ku dołowi */}
          <div className="case-study-spacer" aria-hidden="true" style={{ flex: 1 }}></div>

          <div className="case-study-btn-wrapper-wave">
            <a href="#" className="case-study-cta" id="case-study-cta">
              <span className="case-study-btn-hole"></span>
              <span className="case-study-btn-cap"></span>
              <span className="case-study-btn-text" data-text="Zobacz realizację">Zobacz realizację</span>
            </a>
            <div className="case-study-btn-static-floor"></div>
          </div>

          <div className="case-study-spacer" aria-hidden="true" style={{ flex: '0 0 auto', minHeight: 0 }}></div>
        </div>

        {/* PRAWY PANEL: Portfolio mockup */}
        <div className="case-study-right" id="case-study-media">
          <div className="case-study-placeholder" id="case-study-placeholder">
            <div className="mockup-zoom-wrapper">
              <div className="mockup-zoom-layer" id="case-study-zoom-layer">
                {/* z:1 — TLO Portfolio (parallax góra→dół) — POZA wrapperem brightness */}
                <picture>
                  <source srcSet="/wyniki/TLO-Portfolio.avif" type="image/avif" />
                  <source srcSet="/wyniki/TLO-Portfolio.webp" type="image/webp" />
                  <img className="mockup-tlo" id="case-study-tlo"
                       src="/wyniki/TLO-Portfolio.webp"
                       alt="Tło portfolio"
                       loading="eager" decoding="async" fetchPriority="high"
                       onError={(e) => e.currentTarget.classList.add('load-failed')}
                       draggable="false" />
                </picture>
                {/* z:2 — Device wrapper: brightness() na video+laptop razem */}
                <div className="mockup-device-wrapper" id="case-study-device-wrapper">
                  {/* Video (pod laptopem, na ekranie) */}
                  <video className="mockup-video" id="case-study-screen-video"
                         src="/wyniki/Parkapp.mp4"
                         poster="/wyniki/TLO-Portfolio.webp"
                         preload="auto"
                         autoPlay loop muted playsInline
                         disablePictureInPicture></video>
                  {/* Laptop frame (nad video) */}
                  <picture>
                    <source srcSet="/wyniki/Laptop.avif" type="image/avif" />
                    <source srcSet="/wyniki/Laptop.webp" type="image/webp" />
                    <img className="mockup-frame" id="case-study-laptop-frame"
                         src="/wyniki/Laptop.webp"
                         alt="Laptop"
                         loading="eager" decoding="async"
                         onError={(e) => e.currentTarget.classList.add('load-failed')}
                         draggable="false" />
                  </picture>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    {/* DEBUG PANEL (niewidoczny w produkcji) */}
    <div className="case-study-debug" id="case-study-debug">
      <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>case-study-section</div>
      <div className="case-study-debug-row">
        <span className="case-study-debug-key">scroll</span>
        <span id="case-study-debug-scroll">—</span>
      </div>
      <div className="case-study-debug-row">
        <span className="case-study-debug-key">viewport</span>
        <span id="case-study-debug-vp">—</span>
      </div>
      <div className="case-study-debug-row">
        <span className="case-study-debug-key">bp</span>
        <span id="case-study-debug-bp">—</span>
      </div>
      <div className="case-study-debug-row">
        <span className="case-study-debug-key">st</span>
        <span id="case-study-debug-st">idle</span>
      </div>
    </div>

  </section>
  {portalReady ? createPortal(popupMarkup, document.body) : null}
  </>
  );
}
