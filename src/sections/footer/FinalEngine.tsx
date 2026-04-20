// @ts-nocheck — init() przeniesiony z P2A (vanilla); pełne typowanie = osobna sesja Fabryki
'use client';

import { useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { scrollRuntime } from '@/lib/scrollRuntime';
import { FinalFormCard } from './FinalFormCard';
import './final-section.css';


// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// Sekcja nie używa żadnych pluginów GSAP — brak potrzeby registerPlugin.
// Three.js + requestIdleCallback nie są kompatybilne z SSR →
// FinalSection używa next/dynamic z ssr:false.

// ── INIT FUNCTION — skopiowana 1:1 z P2A reference.html ─────────────────────
// Zmiany względem vanilla:
//   - TypeScript typy na sygnaturze init() i helperze $id (P2A: $ / $$ usunięte — dead code)
//   - usunięto: var getScroll (dead code — nigdy niewywoływany w init())
//   - usunięto: 'use strict' (moduł ESM jest strict z definicji)
// Bez ScrollTrigger — brak gsap.registerPlugin().
// ─────────────────────────────────────────────────────────────────────────────

function init(container: HTMLElement): { pause: () => void; resume: () => void; kill: () => void } {

var DEBUG_MODE = window.location.search.indexOf('debug=1') !== -1 ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('debug') === '1');

var $id = function(id: string){ return container.querySelector('#' + id); };

var cleanups    = [];
var gsapInstances = [];
function _gsapTrack(inst){
  gsapInstances.push(inst);
  if(gsapInstances.length>50){ // O12: auto-prune dead tweens
    gsapInstances=gsapInstances.filter(function(t){
      try{return t&&t.isActive&&t.isActive();}catch(e){return false;}
    });
  }
  return inst;
}
var timerIds    = [];
var observers   = [];
var tickFn      = null;
var ticking     = false;
var hfListeners = [];

// ── WEBGL LIFECYCLE STATE ────────────────────────────────────────────────────
// COLD(renderer=null) -> WARM(compileAsync done) -> HOT(ticking) -> OFF(pause)
var renderer  = null;
var isWarmed  = false;
var isKilled  = false;
var _paused   = true;   // B-CPU-03: idempotencja — start PAUSED, resume po IO
var _ioState  = false;  // IO: sekcja w zasięgu rootMargin

// ── CLOCK CONSTANTS / PARAMS ─────────────────────────────────────────────────
var CC = {posX:-1.10, posY:0.58, posZ:2.20, scale:0.20, rotX:0.07, rotY:0.31, rotZ:0.15};
var levFrozen = false;
var REF_ASPECT = 1000/971;
var GW=4.7, GH=0.9, GR=2.0, GD=0.24, GB=0.11, CLOCK_Z=GD/2+GB+0.06;
var CLOCK_SCALE=1.01, CLOCK_X=0.0, CLOCK_Y=-0.05;
var ORIG_X=[0,98,223,321,446,544], ORIG_TOT=654;
var CTOP, CBOT;

var P = {
  lightX:-0.075, lightY:0.2, lightOM:2.0, lightRX:2.8, lightRY:1.9, lightZ:1.2,
  lightInt:6.5, lightFall:7.2, lightFoc:0.6, lightCol:'#e3e3e3',
  shadX:0.015, shadY:-0.105, shadSX:0.12, shadSY:0.055, shadStr:4.0, shadDark:0.8,
  shad2X:0.015, shad2Y:0.075, shad2SX:0.275, shad2SY:0.25, shad2Str:1.2, shad2Dark:1.0,
  bulgeX:0.115, bulgeY:0.105, bulgeH:0.65,
  specExp:20, specInt:0.8, specStr:0.10, ambFloor:0.32, bevel:0.22,
  gradStr:0.38, gradDirX:0.75, gradDirY:0.1, gradStart:0.0, gradEnd:0.85,
  dirMin:0.76, dirRng:0.3, lerp:0.065
};

// ── SHADERS (inline) ─────────────────────────────────────────────────────────
var DVRT=['varying vec2 vUv;','void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }'].join('\n');
var DFRG=[
  'varying vec2 vUv;','uniform sampler2D uTex1,uTex2,uDisp;','uniform float uRnd,uT;',
  'vec2 rot(vec2 v,float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c)*v;}',
  'void main(){',
  '  vec2 ruv=rot(vUv-0.5,uRnd)+0.5;vec4 d=texture2D(uDisp,ruv);float str=d.g*0.28;',
  '  vec4 a=texture2D(uTex1,vec2(vUv.x+uT*str,vUv.y));',
  '  vec4 b=texture2D(uTex2,vec2(vUv.x-(1.-uT)*str,vUv.y));',
  '  vec4 b2=texture2D(uTex2,vec2(vUv.x+(1.-uT)*str*.85,vUv.y));',
  '  vec4 f=mix(a,b,uT)*mix(a,b2,uT);float lum=dot(f.rgb,vec3(.299,.587,.114));',
  '  gl_FragColor=vec4(1.,1.,1.,1.-lum);}'].join('\n');
var CVRT=['varying vec2 vUv;','void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }'].join('\n');
var CFRG=[
  'varying vec2 vUv;','uniform sampler2D uTex;','uniform float uAlpha;',
  'void main(){vec4 s=texture2D(uTex,vUv);float lum=dot(s.rgb,vec3(.299,.587,.114));',
  'gl_FragColor=vec4(1.,1.,1.,(1.-lum)*uAlpha);}'].join('\n');

// ── THREE.JS SCENE VARS (assigned in warmup) ──────────────────────────────────
var scene, camera, mesh, mat, geo;
var glassMat, glassGeo, clockParent, glassGroup, clockGroup;
var planeW, planeH, cr, envRT, dispMap;
var textCenter, textRadius, compScaleVal, layoutInfo;
var uMouse, U;
var w, h, dpr;

// ── CLOCK STATE ───────────────────────────────────────────────────────────────
var digitTex=[], CLOCK_FDW=0, CLOCK_FDH=0, CLOCK_TOTAL_W=0;
var dayTexCache=null;
var slots=[], colonMats=[], dayMesh=null, dayMat=null;
var TRANS_DUR=0.70, OVERLAP=0.55, CYCLE=5.0, JUZ_HOLD=0.7, DAY_HOLD=1.5;
var CLK={CLOCK:'c',TO_DAY:'td',DAY:'d',TO_CLOCK:'tc'};
var state=CLK.CLOCK, activeTL=null, nextCall=null;
var _digits=[0,0,0,0,0,0], _date=new Date();

// ── INTERACTION ───────────────────────────────────────────────────────────────
var isPageVisible=true, rawMouse={x:0,y:0};
var mouse={x:0,y:0}, smooth={x:0,y:0}, mUV_x=0, mUV_y=0;
var _m2cResult={x:0,y:0};
var clockResponsiveOffsetX=0, clockResponsiveOffsetY=0;
var PHI=1.6180339887;
var lev={rotX:0,rotY:0,rotZ:0};
var levS={posX:CC.posX,posY:CC.posY,posZ:CC.posZ,rotX:CC.rotX,rotY:CC.rotY,rotZ:CC.rotZ};
var spring={rotX:0,rotY:0,velRotX:0,velRotY:0};
var SPRING_STIFF=0.18, SPRING_DAMP=0.72, levInf=0;
var _lastTime=performance.now();

// ── DOM ───────────────────────────────────────────────────────────────────────
var el = $id('final-scene');
var stickyEl = container.querySelector('#final-sticky');
if (!el) return {pause:function(){},resume:function(){},kill:function(){}};
var cardEl = $id('final-formCard');
var extScrollEl = container.querySelector('.final-scroll-extender');
var _cardMaxUp = 0; // max px karty do przesunięcia w górę (scroll mobile / positionCard desktop)
var _lastMobCardHpx = -1; // cache --final-mobile-card-h (px) żeby nie setProperty co klatkę scrolla

/** Wysokość karty mobilnej — zostaw ~120px na WebGL; iOS: visualViewport ≠ innerHeight. */
function computeMobileCardH(){
  var pin = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  return Math.min(640, Math.max(360, Math.round(pin - 120)));
}

/** Mobile <1200 + layout mobilny: forma wjeżdża po odsłonie napisów — zakres z .final-scroll-extender (final.stack.html). */
function updateMobileFormScroll(){
  if(!cardEl || !extScrollEl || !layoutInfo || !layoutInfo.isMobile || !layoutInfo.lh) return;
  var cw2=w||window.innerWidth;
  var vh=window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if(cw2>=1200) return;
  gsap.killTweensOf(cardEl);
  var nextMobH = computeMobileCardH();
  if (nextMobH !== _lastMobCardHpx) {
    _lastMobCardHpx = nextMobH;
    container.style.setProperty('--final-mobile-card-h', nextMobH + 'px');
  }
  var cardH = Math.round(cardEl.getBoundingClientRect().height) || nextMobH;
  var sec=container.getBoundingClientRect();
  if(sec.bottom<=0 || sec.top>=vh){
    cardEl.style.transform='translateY('+cardH+'px)';
    cardEl.style.pointerEvents='none';
    _cardMaxUp=0;
    return;
  }
  var er=extScrollEl.getBoundingClientRect();
  var t=0;
  var eh=Math.max(er.height,1);
  if(er.bottom<=0 || er.top>=vh){
    t=0;
  } else if(er.top<0){
    /* Extender wychodzi w górę — bez tego enter rośnie i t clampuje do 1 → karta „pływa” przy scrollu w górę */
    t=Math.max(0,Math.min(1,er.bottom/eh));
  } else if(er.top<vh){
    var enter=vh-er.top;
    /* Niżej niż 0.84: mniej „martwego” scrollu z samym zegarem zanim karta zacznie wjeżdżać (mobile UX). */
    var delayRatio=0.48;
    if(enter>=vh*delayRatio){
      t=(enter-vh*delayRatio)/(vh*(1-delayRatio));
      if(t>1)t=1;
    }
  }
  var off=(1-t)*cardH;
  cardEl.style.transform='translateY('+off+'px)';
  cardEl.style.pointerEvents=t>0.08?'auto':'none';
  if(t>=0.998){ _cardMaxUp=Math.max(0,cardH-(vh-40)); }
  else{ _cardMaxUp=0; }
}

// ── CLOCK INTERVAL ────────────────────────────────────────────────────────────
var clockIntervalId = null;
function _stopClockInterval(){ if(clockIntervalId){clearInterval(clockIntervalId);clockIntervalId=null;} }
function _startClockInterval(){
  if(!clockIntervalId){ clockIntervalId=setInterval(_clockTick,1000); timerIds.push({type:'interval',id:clockIntervalId}); } // O11: 1s interval
}

// ── TEXTURE / GEOMETRY HELPERS ────────────────────────────────────────────────
var _blankTex=null;
function getBlankTex(){
  if(_blankTex) return _blankTex;
  var cv=document.createElement('canvas'); cv.width=4; cv.height=4;
  var _ctx=cv.getContext('2d');
  if(_ctx){ _ctx.fillStyle='white'; _ctx.fillRect(0,0,4,4); }
  _blankTex=new THREE.CanvasTexture(cv); _blankTex.minFilter=THREE.LinearFilter;
  return _blankTex;
}

function makeGlassShape(w,h,r){
  var s=new THREE.Shape(),sr=Math.min(r,w/2-0.01,h/2-0.01),x=-w/2,y=-h/2;
  s.moveTo(x+sr,y);s.lineTo(x+w-sr,y);s.quadraticCurveTo(x+w,y,x+w,y+sr);
  s.lineTo(x+w,y+h-sr);s.quadraticCurveTo(x+w,y+h,x+w-sr,y+h);
  s.lineTo(x+sr,y+h);s.quadraticCurveTo(x,y+h,x,y+h-sr);
  s.lineTo(x,y+sr);s.quadraticCurveTo(x,y,x+sr,y);
  return s;
}

function buildDigitTex(n){
  var cv=document.createElement('canvas'); cv.width=256; cv.height=384;
  var ctx=cv.getContext('2d');
  ctx.fillStyle='white'; ctx.fillRect(0,0,256,384);
  ctx.fillStyle='black'; ctx.font='700 340px "Lexend",sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(n,128,200);
  var t=new THREE.CanvasTexture(cv); t.minFilter=THREE.LinearFilter;
  return t;
}

function getContentRect(w,h){
  var va=w/h;
  if(va>REF_ASPECT){ var cw=h*REF_ASPECT; return{ox:(w-cw)/(2*w),oy:0,sx:cw/w,sy:1.0}; }
  var ch=w/REF_ASPECT; return{ox:0,oy:(h-ch)/(2*h),sx:1.0,sy:ch/h};
}
function getBannerLayout(w){
  var cw=Math.min(0.92*w,1750),cm=(w-cw)/2;
  return{textLeft:cm+Math.max(32,Math.min(0.05*w,128))};
}

function makeTexture(tw,th){
  var cv=document.createElement('canvas'),cx=cv.getContext('2d');
  if(!cx) return{tex:new THREE.Texture(),textCenter:{x:0.5,y:0.5},textRadius:1,compScale:1.0,layout:{}};
  var dp=Math.min(window.devicePixelRatio||1, dpr||1.0); // O5: match renderer DPR
  cv.width=tw*dp; cv.height=th*dp;
  cx.fillStyle='#f7f6f4'; cx.fillRect(0,0,cv.width,cv.height);
  var cR=getContentRect(tw,th);
  var cTop=cR.oy*cv.height,cWidth=cR.sx*cv.width,cHeight=cR.sy*cv.height;
  var gs=Math.max(20*dp,Math.min(40*dp,cWidth*0.025));
  var gCv=document.createElement('canvas'); gCv.width=cv.width; gCv.height=cv.height;
  var gc=gCv.getContext('2d'); gc.strokeStyle='rgba(0,0,0,0.055)'; gc.lineWidth=1*dp;
  for(var gy=0;gy<cv.height;gy+=gs){gc.beginPath();gc.moveTo(0,gy);gc.lineTo(cv.width,gy);gc.stroke();}
  for(var gx=0;gx<cv.width;gx+=gs){gc.beginPath();gc.moveTo(gx,0);gc.lineTo(gx,cv.height);gc.stroke();}
  gc.globalCompositeOperation='destination-in';
  var hG=gc.createLinearGradient(0,0,cv.width,0);
  hG.addColorStop(0,'rgba(0,0,0,0)');hG.addColorStop(0.15,'rgba(0,0,0,1)');
  hG.addColorStop(0.85,'rgba(0,0,0,1)');hG.addColorStop(1,'rgba(0,0,0,0)');
  gc.fillStyle=hG; gc.fillRect(0,0,cv.width,cv.height);
  var vG=gc.createLinearGradient(0,0,0,cv.height);
  vG.addColorStop(0,'rgba(0,0,0,0)');vG.addColorStop(0.20,'rgba(0,0,0,1)');
  vG.addColorStop(0.80,'rgba(0,0,0,1)');vG.addColorStop(1,'rgba(0,0,0,0)');
  gc.fillStyle=vG; gc.fillRect(0,0,cv.width,cv.height);
  cx.drawImage(gCv,0,0);
  var lines=['DOBRY','CZAS','JEST','TERAZ'];
  var _bl=getBannerLayout(tw),_textLeft=_bl.textLeft;
  var W_START=1650,W_END=1200,MIN_MARGIN=30;
  var fsNat=Math.min(Math.max(80*dp,cWidth*0.17),220*dp);
  var _tc=document.createElement('canvas').getContext('2d');
  _tc.font='700 '+fsNat+'px "Lexend",sans-serif';
  var _mw=Math.max.apply(null,lines.map(function(l){return _tc.measureText(l).width;}));
  var _lm,_mtw,fs,pl,sy,lh,th2;
  if(tw<1200){
    _lm=MIN_MARGIN; _mtw=(tw-2*MIN_MARGIN)*dp;
    fs=(_mw>_mtw)?fsNat*(_mtw/_mw)*0.98:fsNat; fs=Math.max(36*dp,fs);
    lh=fs*0.8; th2=lines.length*lh;
    var mw2_=_mw*(fs/fsNat); pl=cv.width/2-mw2_/2; pl=Math.max(MIN_MARGIN*dp,pl); sy=100*dp+fs*0.75;
  } else {
    var _t=tw>=W_START?0:(W_START-tw)/(W_START-W_END);
    _lm=_textLeft*(1-_t)+MIN_MARGIN*_t;
    var _cL=Math.max(_textLeft,tw-_textLeft-500),_gap=40;
    _mtw=(_cL-_lm-_gap)*dp;
    fs=(_mtw>0&&_mw>_mtw)?fsNat*(_mtw/_mw)*0.98:fsNat; fs=Math.max(40*dp,fs);
    lh=fs*0.8; th2=lines.length*lh; pl=_lm*dp; sy=cTop+(cHeight-th2)/2+fs*0.75;
  }
  cx.font='700 '+fs+'px "Lexend",sans-serif'; cx.textAlign='left'; cx.textBaseline='alphabetic';
  var mwF=0; lines.forEach(function(l){mwF=Math.max(mwF,cx.measureText(l).width);});
  var tTop=sy-fs*0.75,cx2p=pl+mwF/2,cy2p=tTop+th2/2,hl=0.7071*(mwF+th2)/2;
  var tg=cx.createLinearGradient(cx2p-0.7071*hl,cy2p-0.7071*hl,cx2p+0.7071*hl,cy2p+0.7071*hl);
  tg.addColorStop(0.02,'#252030');tg.addColorStop(0.44,'#2a2130');
  tg.addColorStop(0.567,'#382630');tg.addColorStop(0.675,'#512b2b');
  tg.addColorStop(0.802,'#7d3527');tg.addColorStop(1.0,'#7d3527');
  cx.fillStyle=tg; lines.forEach(function(l,i){cx.fillText(l,pl,sy+i*lh);});
  var tcxR=(pl+mwF*0.5)/cv.width,tcyR=(sy-fs*0.75+th2*0.5)/cv.height;
  var tcxC=(tcxR-cR.ox)/cR.sx,tcyC=1.0-((tcyR-cR.oy)/cR.sy);
  var tRad=Math.max(mwF/cv.width/cR.sx,th2/cv.height/cR.sy)*0.6;
  var tex=new THREE.CanvasTexture(cv);
  tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter; tex.needsUpdate=true;
  var rCS=tw<1200?(fs/(Math.min(Math.max(80*dp,cWidth*0.17),220*dp))):1.0;
  var li={fs:fs/dp,lh:fs*0.8/dp,textTopPx:tw<1200?100:null,isMobile:tw<1200};
  return{tex:tex,textCenter:{x:tcxC,y:tcyC},textRadius:tRad,compScale:rCS,layout:li};
}

function makeDispMat(){
  return new THREE.ShaderMaterial({
    uniforms:{uTex1:{value:getBlankTex()},uTex2:{value:getBlankTex()},uDisp:{value:dispMap},uRnd:{value:0.0},uT:{value:0.0}},
    vertexShader:DVRT,fragmentShader:DFRG,transparent:true,depthWrite:false
  });
}

function buildDayTex(text){
  var ratio=CLOCK_TOTAL_W/CLOCK_FDW;
  var CVW=Math.round(256*ratio),CVH=384;
  var cv=document.createElement('canvas'); cv.width=CVW; cv.height=CVH;
  var ctx=cv.getContext('2d'); var fs=300;
  ctx.font='700 '+fs+'px "Lexend",sans-serif';
  var tw2=ctx.measureText(text).width;
  if(tw2>CVW*0.92) fs=Math.floor(fs*CVW*0.92/tw2);
  ctx.fillStyle='white'; ctx.fillRect(0,0,CVW,CVH);
  ctx.fillStyle='black'; ctx.font='700 '+fs+'px "Lexend",sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,CVW/2,CVH/2);
  var t=new THREE.CanvasTexture(cv); t.minFilter=THREE.LinearFilter;
  return t;
}
function prebakeDayTextures(){
  var DAYS_PL=['NIEDZIELA','PONIEDZIAŁEK','WTOREK','ŚRODA','CZWARTEK','PIĄTEK','SOBOTA'];
  dayTexCache={juzJest:buildDayTex('JUŻ JEST'),days:DAYS_PL.map(function(d){return buildDayTex(d);})};
}

// ── WARMUP (COLD -> WARM) — BUG-2 FIX: 3 fazy rAF ────────────────────────────
// Faza 1 (sync): WebGL context + scene shell + event listeners  ~30ms
// Faza 2 (rAF1): pmrem/env + makeTexture + ShaderMaterial + geo  ~500ms (ale już nowy frame)
// Faza 3 (rAF2): digitTex + buildClock + compileAsync            ~150ms (kolejny frame)
// Między fazami przeglądarka może przetworzyć wheel/touch events -> brak freeze
// ric(fn, timeout) — requestIdleCallback z rAF fallback (Safari)
function _ric(fn, timeout){
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(fn, { timeout: timeout || 2000 });
  } else {
    requestAnimationFrame(function () {
      fn({ didTimeout: false });
    });
  }
}

function warmup(){
  if(renderer || isKilled) return;
  // #final-scene = position:fixed; width:100%; height:100% = viewport
  // Nie czytamy el.clientWidth — el może być display:none podczas warmup (IO pre-load)
  w = window.innerWidth;
  h = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio||1, 1.0); // max 1.0 — oszczędność GPU bez artefaktów

  // ── FAZA 1: GL context (musi być sync — appends canvas do DOM) ──────────────
  try {
    renderer = new THREE.WebGLRenderer({antialias: window.innerWidth >= 768, powerPreference:"high-performance"}); // O1: AA off mobile
  } catch(e) {
    console.error('[final] WebGL unavailable:', e);
    return;
  }
  var rw=Math.min(w,2340); // stały bufor max 1800px — CSS skaluje do 100%
  renderer.setSize(rw,h,false);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.75;
  el.appendChild(renderer.domElement);

  renderer.domElement.addEventListener('webglcontextlost', function(e){
    e.preventDefault(); isPageVisible=false;
    if(ticking){ gsap.ticker.remove(tickFn); ticking=false; }
  }, false);
  renderer.domElement.addEventListener('webglcontextrestored', function(){
    isPageVisible=true; _lastTime=performance.now();
    if(!ticking && tickFn && !_paused){ gsap.ticker.add(tickFn); ticking=true; }
  }, false);

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#f7f6f4');

  // ── FAZA 2 (idle): ciężka praca CPU/GPU — odpala gdy przeglądarka oddycha ────
  _ric(function(){
    if(isKilled || !renderer) return;

    // pmrem.fromScene() — synchronous GPU env render (najcięższy fragment)
    var pmrem = new THREE.PMREMGenerator(renderer);
    envRT = pmrem.fromScene(new RoomEnvironment());
    scene.environment = envRT.texture;
    pmrem.dispose();

    var d1 = new THREE.DirectionalLight(0xfff0e8,3.5); d1.position.set(3,5,6); scene.add(d1);

    planeH=5;
    var vFov=55*Math.PI/180; var camZ_=(planeH/2)/Math.tan(vFov/2);
    camera = new THREE.PerspectiveCamera(55,w/h,0.1,200);
    camera.position.z = camZ_;
    planeW = planeH*(w/h);
    cr = getContentRect(w,h);

    // makeTexture() — duży canvas 2D (ciężki CPU)
    var texRes = makeTexture(w,h);
    textCenter=texRes.textCenter; textRadius=texRes.textRadius;
    compScaleVal=texRes.compScale||1.0; layoutInfo=texRes.layout||{};
    uMouse = {value:new THREE.Vector2(0,0)};

    U = {
      uTexture:{value:texRes.tex}, uMouse:uMouse,
      uContentOffset:{value:new THREE.Vector2(cr.ox,cr.oy)},
      uContentScale:{value:new THREE.Vector2(cr.sx,cr.sy)},
      uLightOffset:{value:new THREE.Vector2(P.lightX,P.lightY)}, uLightOM:{value:P.lightOM},
      uLightReach:{value:new THREE.Vector2(P.lightRX,P.lightRY)}, uLightZ:{value:P.lightZ},
      uLightInt:{value:P.lightInt}, uLightFall:{value:P.lightFall}, uLightFoc:{value:P.lightFoc},
      uLightColor:{value:new THREE.Color(P.lightCol)},
      uShadowOffset:{value:new THREE.Vector2(P.shadX,P.shadY)},
      uShadowSize:{value:new THREE.Vector2(P.shadSX,P.shadSY)},
      uShadowStr:{value:P.shadStr}, uShadowDark:{value:P.shadDark},
      uShadow2Offset:{value:new THREE.Vector2(P.shad2X,P.shad2Y)},
      uShadow2Size:{value:new THREE.Vector2(P.shad2SX,P.shad2SY)},
      uShadow2Str:{value:P.shad2Str}, uShadow2Dark:{value:P.shad2Dark},
      uBulgeSize:{value:new THREE.Vector2(P.bulgeX,P.bulgeY)}, uBulgeH:{value:P.bulgeH},
      uSpecExp:{value:P.specExp}, uSpecInt:{value:P.specInt}, uSpecStr:{value:P.specStr},
      uBevel:{value:P.bevel},
      uGradStr:{value:P.gradStr},
      uGradDir:{value:new THREE.Vector2(P.gradDirX,P.gradDirY).normalize()},
      uGradStart:{value:P.gradStart}, uGradEnd:{value:P.gradEnd},
      uDirMin:{value:P.dirMin}, uDirRng:{value:P.dirRng}, uAmbientFloor:{value:P.ambFloor}
    };

    mat = new THREE.ShaderMaterial({
      uniforms:U, extensions:{derivatives:true},
      vertexShader:[
        'uniform vec2 uMouse,uBulgeSize,uContentOffset,uContentScale;',
        'uniform float uBulgeH;',
        'varying vec2 vUv,vContentUv; varying vec3 vWorldPos; varying vec3 vNrm;',
        'float gauss(vec2 u,vec2 c,vec2 s){vec2 d=(u-c)/s;return exp(-0.5*dot(d,d));}',
          'void main(){',
        '  vUv=uv; vContentUv=(uv-uContentOffset)/uContentScale;',
        '  vec2 mc=uMouse*0.5+0.5; vec3 pos=position;',
        '  float eL=smoothstep(0.,0.12,uv.x),eR=smoothstep(0.,0.12,1.-uv.x);',
        '  float eB=smoothstep(0.,0.18,uv.y),eT=smoothstep(0.,0.18,1.-uv.y);',
        '  float bz=gauss(vContentUv,mc,uBulgeSize)*uBulgeH*(eL*eR*eB*eT);', // O2: single gauss
        '  pos.z+=bz;',
        '  vec2 dg_=(vContentUv-mc)/uBulgeSize; vec2 grad=-dg_/uBulgeSize*bz;',
        '  vNrm=normalize(vec3(-grad.x*0.08,-grad.y*0.08,1.0));',
        '  vec4 wp=modelMatrix*vec4(pos,1.); vWorldPos=wp.xyz;',
        '  gl_Position=projectionMatrix*viewMatrix*wp;',
        '}'
      ].join('\n'),
      fragmentShader:[
        'uniform sampler2D uTexture;',
        'uniform vec2 uMouse,uLightOffset,uLightReach,uShadowOffset,uShadowSize,uShadow2Offset,uShadow2Size,uBulgeSize,uGradDir;',
        'uniform float uLightOM,uLightZ,uLightInt,uLightFall,uLightFoc; uniform vec3 uLightColor;',
        'uniform float uShadowStr,uShadowDark,uShadow2Str,uShadow2Dark;',
        'uniform float uSpecExp,uSpecInt,uSpecStr,uBevel,uGradStr,uGradStart,uGradEnd;',
        'uniform float uDirMin,uDirRng,uAmbientFloor;',
        'varying vec2 vUv,vContentUv; varying vec3 vWorldPos; varying vec3 vNrm;',
        'void main(){',
        '  vec4 tex=texture2D(uTexture,vUv);',
        '  vec2 cUv=vContentUv,mUv=uMouse*0.5+0.5;',
        '  vec3 N=normalize(vNrm);',
        '  float NdL=max(dot(N,vec3(-0.4969,0.3478,0.7950)),0.);',
        '  float dShade=uDirMin+NdL*uDirRng;',
        '  float lum=dot(tex.rgb,vec3(0.299,0.587,0.114));',
        '  vec3 bevelAdd=vec3((-clamp(dFdx(lum),-0.08,0.08)*0.6+clamp(dFdy(lum),-0.08,0.08)*0.4)*2.5*uBevel);',
        '  float tMask=1.-smoothstep(0.1,0.9,lum);',
        '  if(tMask<0.01){gl_FragColor=vec4(tex.rgb*dShade,1.);return;}',
        '  vec3 pPos=vec3((uMouse.x+uLightOffset.x*uLightOM)*uLightReach.x,(uMouse.y+uLightOffset.y*uLightOM)*uLightReach.y,uLightZ);',
        '  vec3 toL=pPos-vWorldPos; float dist=length(toL); vec3 Lp=normalize(toL);',
        '  float atten=1./(1.+dist*dist*uLightFall);',
        '  float pLight=mix(atten,max(dot(N,Lp),0.)*atten,uLightFoc);',
        '  vec3 bc=tex.rgb*dShade; bc+=bevelAdd;',
        '  vec2 sd1=(cUv-(mUv+uShadowOffset))/uShadowSize; float bd1Sq=dot(sd1,sd1);',
        '  float dp1=clamp(1.-exp(-0.5*bd1Sq)*uShadowStr,0.,1.);',
        '  float dpF1=mix(dp1,max(dp1,uAmbientFloor),tMask); bc*=1.-(1.-dpF1)*uShadowDark*tMask;',
        '  vec2 sd2=(cUv-(mUv+uShadow2Offset))/uShadow2Size; float bd2Sq=dot(sd2,sd2);',
        '  float dp2=clamp(1.-exp(-0.5*bd2Sq)*uShadow2Str,0.,1.);',
        '  float dpF2=mix(dp2,max(dp2,uAmbientFloor),tMask); bc*=1.-(1.-dpF2)*uShadow2Dark*tMask;',
        '  float totD=min(dpF1,dpF2);',
        '  float sg=smoothstep(uGradStart,uGradEnd,dot(vUv,uGradDir));',
        '  bc*=1.+sg*uGradStr*tMask*totD;',
        '  vec3 pc=uLightColor*pLight*tMask*dShade*uLightInt;',
        '  vec3 hd=normalize(Lp+vec3(0.,0.,1.)); hd.x*=uSpecStr; hd=normalize(hd);',
        '  float nh=max(dot(N,hd),0.);float nh2=nh*nh;float nh4=nh2*nh2;float nh8=nh4*nh4;float nh20=nh8*nh8*nh4;', // O3: pow->MUL
      '  vec3 sc=uLightColor*nh20*atten*tMask*dShade*uSpecInt;',
        '  vec3 fc=clamp(bc+pc+sc,0.,1.); gl_FragColor=vec4(fc,1.);}',
      ].join('\n')
    });

    geo = new THREE.PlaneGeometry(planeW,planeH,32,32);
    mesh = new THREE.Mesh(geo,mat);
    scene.add(mesh);

    CTOP=new THREE.Color(0x8b5190); CBOT=new THREE.Color(0xc2452b);
    // Transmission na wszystkich urządzeniach — najlepszy efekt wizualny
    glassMat = new THREE.MeshPhysicalMaterial({
      color:0xffffff, transmission:1.0, roughness:0.03, ior:1.65, thickness:2.1,
      specularIntensity:0.75, envMapIntensity:1.25
    });
    glassMat.onBeforeCompile=function(sh){
      sh.uniforms.rimCTop={value:CTOP.clone()};sh.uniforms.rimCBot={value:CBOT.clone()};
      sh.uniforms.rimPow={value:1.4};sh.uniforms.rimInt={value:25.0};sh.uniforms.glassHalfH={value:GH*0.5};
      sh.vertexShader=sh.vertexShader
        .replace('void main() {','varying vec3 vAp; varying float vAy; void main() {')
        .replace('#include <project_vertex>','#include <project_vertex>\nvAp=(modelViewMatrix*vec4(position,1.)).xyz;\nvAy=position.y;');
      sh.fragmentShader=sh.fragmentShader
        .replace('void main() {','varying vec3 vAp; varying float vAy;\nuniform vec3 rimCTop,rimCBot;\nuniform float rimPow,rimInt,glassHalfH;\nvoid main() {')
        .replace('#include <tonemapping_fragment>','{vec3 vn=normalize(vNormal);vec3 vv=vec3(0.,0.,1.);\nfloat rim=pow(1.-clamp(dot(vn,vv),0.,1.),rimPow);\nfloat tt=clamp(vAy/glassHalfH*0.5+0.5,0.,1.);\ngl_FragColor.rgb+=mix(rimCBot,rimCTop,tt)*rim*rimInt;}\n#include <tonemapping_fragment>');
    };
    glassMat.needsUpdate=true;
    glassGeo=new THREE.ExtrudeGeometry(
      makeGlassShape(GW,GH,GR),
      {depth:GD,bevelEnabled:true,bevelSegments:8,bevelSize:0.09,bevelThickness:GB,curveSegments:32}
    );
    glassGeo.center();
    clockParent=new THREE.Group(); glassGroup=new THREE.Group(); clockGroup=new THREE.Group();
    scene.add(clockParent); clockParent.add(glassGroup); clockParent.add(clockGroup);
    glassGroup.add(new THREE.Mesh(glassGeo,glassMat));

    dispMap=new THREE.Texture(); dispMap.wrapS=dispMap.wrapT=THREE.RepeatWrapping;
    var _di=new Image();
    _di.onload=function(){
      dispMap.image=_di; dispMap.needsUpdate=true;
      slots.forEach(function(s){ s.mat.uniforms.uDisp.value=dispMap; });
      if(dayMat) dayMat.uniforms.uDisp.value=dispMap;
    };
    _di.src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbDpzcGFjZT0icHJlc2VydmUiIGJhc2VQcm9maWxlPSJ0aW55IiBvdmVyZmxvdz0idmlzaWJsZSIgdmVyc2lvbj0iMS4yIiB2aWV3Qm94PSIwIDAgNTMwIDM1NCI+CiAgPHBhdGggZD0iTTUzMCAzMTNjOSAzNC0xNDctOC0xODEgMTBsOTAgMmMyNCA3IDk5LTEyIDkxIDIwLTExNCA3LTIyOCA0LTM0MyA2LTYyIDYtMTI1IDEtMTg3IDMtOC01MSAyNS0zMyA2MS00NSA1My0xNiAxMDUgNSAxNTggOCA3MSA3IDEzOS0zMiAyMTAtMTMgMzMgOSA2NyAxMCAxMDEgOXoiLz48cGF0aCBkPSJNNTMwIDI4OWMxMiA0NC04MyAxMy0xMDkgMTEtODMtMjEtMTY1IDMzLTI0OSA5LTM4LTktNzctMTUtMTE2LTVMMCAzMTZjLTQtMjEgNS0yMiAyMy0yNC0xNyAzLTI3IDQtMjMtMTcgNDkgMiA5Ny0xMiAxNDYgMSAzOCA0IDc1LTEzIDExMy03IDIzIDIgNDYgMyA2OS0xIDQyLTEwIDg0IDExIDEyNiAzIDI1IDEgODQtMjYgNzYgMTUtNjQgNi0xMjYtNi0xOTAtMi05MSAxMi0xODMgMi0yNzUgNSA1NC02IDEwNiAxMiAxNjAgN2wxMDktMTFjNjYtNyAxMzAgMTcgMTk2IDR6Ii8+PHBhdGggZD0iTTUzMCAyMjR2MTdjLTIzLTQtNDYtMy02OSAxLTM3IDgtNzUgMy0xMTIgNCA1NiAxMSAxMDgtNyAxNjMtNCAxNS0xIDIxIDIgMTggMTgtMjEtMiA0MiAyLTYzIDYtMjQgNC00NyA2LTcwIDAtNDEtMTMtODQtMS0xMjYtMi0yNS0yLTQ5IDAtNzMgNS00MyAxNC04Ni04LTEyOS01bC02OSA1Yy03LTI4IDMzLTE0IDQ4LTE5LTE4LTMtNTYgMTItNDgtMjAgNjItMyAxMjIgMjIgMTg1IDggNTAtNSAxMDEtMjAgMTUyLTcgNjQgMTggMTI5IDEgMTkzLTd6Ii8+PHBhdGggZD0iTTUzMCA1OWMzIDEyLTE1IDUtMjEgOCA1NCA3LTQ0IDUtNjUgNS04NiA3LTE3MyAzLTI2MCAyLTYxIDQtMTIzIDctMTg0IDMgMTctMTQgNjMtMiA5MC04QzcxIDU1IDMgODEgMCA2MWM3Ny05IDE1My04IDIzMC0xIDU0IDYgMTA2LTkgMTU5LThsMTQxIDd6Ii8+PHBhdGggZD0iTTAgMTMzYy02LTI5IDQwLTE2IDYwLTI0IDg0LTI3IDE2NiAxNyAyNTAgMyA0Ni05IDk0LTIwIDE0Mi0xMSAyNiA1IDUyIDExIDc4IDEyIDkgNDItMTA2LTEzLTEzNSAxLTY4IDktMTM2IDI4LTIwMyA4LTY0LTE4LTEyOCA4LTE5MiAxMXoiLz48cGF0aCBkPSJNNTMwIDIwOGM4IDI2LTczIDE4LTkzIDI1LTQyIDgtODMtNC0xMjQtMTEtNTYtMS0xMTEgMTItMTY3IDE2LTQ5IDYtOTYtMTktMTQ2LTExLTQtMzMgNzItNiA5NC03IDY0IDUgMTI3LTYgMTkwLTExIDI5LTQgNTggNiA4NyA4IDUzIDQgMTA2LTQgMTU5LTl6Ii8+PHBhdGggZD0iTTUzMCAxMzNjNiAyOC01OSA1LTc4IDctMzUtNi03MS03LTEwNy0zLTYzIDEyLTEyNSAxNi0xODggMi01My02LTEwNSAyLTE1NyAxMi01LTIyIDE5LTEzIDMzLTE4bDcyLTEyYzY0LTEzIDEyNCAyNiAxODkgMTIgNDgtNSA5NS0yMiAxNDQtMTUgMzAgNiA2MCAxOCA5MiAxNXptMC05MmMtMyAzNC0xMjgtMTQtMTYwIDEtOTAgMjctMTgxIDMtMjcxIDEtMzMgOC02NiAxMi05OSAxMy00LTI3IDQyLTE1IDYwLTI0IDU3LTE1IDExMiAxMSAxNjkgMTIgNjIgNSAxMjAtMjcgMTgxLTE1IDQwIDggNzkgMTYgMTIwIDEyek00NDEgMGMyMSA1IDg2LTExIDg5IDgtMjEtMiA0MyAwLTY0IDEtNjctMS0xMzQtMS0yMDEgMi04OSAyLTE3Ni01LTI2NSAxLTMtMjcgMTEyLTcgMTM5LTExbDMwMi0xeiIvPjxwYXRoIGZpbGw9IiNGRkYiIGQ9Ik01MzAgNDFjLTQxIDQtODAtNC0xMjAtMTItNjEtMTItMTE5IDIwLTE4MSAxNS05OS0xMS0xMjQtMjctMjI5LTItMy0xMSAxMy00IDE1LTExLTUtMS0xNiA0LTE1LTQgNTAtMSAxMDAtMTQgMTQ5LTMgOTAgMjMgMTgxLTE3IDI3MC0yIDI1IDUgNTAgOSA3NSA3IDEwIDIgMzQtOCAzNiAyLTI5IDAtNTggMi04Ny0xIDIzIDEyIDc5LTEgODcgMTF6Ii8+PHBhdGggZD0iTTUzMCAyN2MtMzcgNC03NCA0LTExMS01LTYzLTExLTEyNyA3LTE5MCA5LTI3IDItNTMtMS04MC03LTQ5LTExLTk5IDItMTQ5IDMtMy0yMSA2Mi05IDgwLTE1IDQ3LTMgOTMgMTUgMTQxIDEwIDY2LTMgMTMyLTE4IDE5OC02IDI3IDUgNTQgNyA4MSA0IDExIDIgMzQtMTAgMzAgN3oiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMCA1NmMzMy0xIDY2LTUgOTktMTMgMzUtNCA3MCA3IDEwNiA5IDU1IDYgMTExIDMgMTY1LTEwIDQ4LTggOTYgMTIgMTQ0IDExIDUxIDEzLTE1Ny05LTE4NCAzLTcxIDExLTE0MyAwLTIxNC0zLTMyLTctOTggMTktMTE2IDN6bTUzMC0zOWMtODQgMTItMTY3LTE2LTI1MiAwLTY2IDE0LTEzMi00LTE5OC01LTI0LTMtNjYgMTMtODAgMCAxMDgtOCAyMTUgNCAzMjMtMyA0OC02IDk1IDQgMTQzIDAgMTggNCA2My0xMyA2NCA4ek0wIDc3Yzg0IDYgMTY4LTUgMjUxLTIgOTMgNiAxODYtNiAyNzktMi0zMiAxMS04NyAwLTEyNyAxMC01NSA4LTExMS00LTE2Ny00LTc1LTUtMTcwIDI0LTIzNi0yem01MzAgMzdjLTUzLTUtMTA1LTI0LTE1OS0xMy01MyA5LTEwNyAyMy0xNjEgOC00OS0xMy0xMDEtMTEtMTUwIDAtMTYtMi02MiAxOS02MCAwIDUxLTUgMTAyLTEyIDE1My0xNCA0OCAxIDk1IDIwIDE0NCA5IDYwLTUgMTIxLTE4IDE4MS00IDE0IDggNTMtMyA1MiAxNHptMCA5NGMtNTMgNS0xMDYgMTMtMTYwIDktMjktMiA1Ny0xMi04Ni04LTczIDUtMTQ4IDIxLTIyMSA2LTE1LTgtNjQgNi02My0xMCA2NCA0IDEyOCAyMSAxOTIgNiAzNS02IDcwLTEzIDEwNi04IDM4IDQgNzUgMTQgMTEzIDEwIDI1IDUgMTE3LTI5IDExOS01ek0wIDI2OWM0OS01IDk3LTkgMTQ1IDQgNDMgNCA4My0xNSAxMjYtOSA0MiAxIDg1LTExIDEyNiAyIDQxIDE3IDEwMS0yMCAxMzMtMS00NC00LTg4IDE1LTEzMSA1LTQ3LTEyLTkzIDctMTQwLTEtNDgtNS05NiAxNy0xNDUgMy0zMi0xMy05NSAxOC0xMTQtM3oiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNNTMwIDEzM2MtMzIgMy02Mi05LTkyLTE1LTQ5LTctOTYgMTAtMTQ0IDE1LTY0IDE0LTEyNS0yNS0xODktMTItMzMgMi03OCAyMS0xMDUgMTIgMzgtMyA3Ni0xMCAxMTUtMTYgNjctOCAxMzIgMjggMjAwIDkgNDctNiA5NS0yMCAxNDEtOCAyMyAxMCA1NyA2IDc0IDE1em0wIDE1NmMtNjYgMTMtMTMwLTExLTE5Ni00bC0xMDkgMTFjLTU0IDUtMTA2LTEzLTE2MC03IDcwLTUgMTM5IDcgMjA5IDAgNDYtMiA5My0xMSAxMzktNCAzNyA5IDg3LTUgMTE3IDR6Ii8+PHBhdGggZmlsbD0iI0ZGRiIgZD0iTTUzMCAyNDRjLTYxLTktMTIwIDE0LTE4MSAyIDM3LTEgNzUgNCAxMTItNCAyMS0yIDUzLTkgNjkgMnpNMCA2OWMzMCAwIDYyLTkgOTAgMC0yOC0yLTY5IDktOTAgMHoiLz48L3N2Zz4=";

    // ── FAZA 3 (rAF): tekstury zegara + compileAsync — następna klatka po idle (faza 2) ──
    requestAnimationFrame(function(){
      if(isKilled || !renderer) return;

      for(var _i=0;_i<10;_i++) digitTex.push(buildDigitTex(_i));
      buildClock();

      var compilePromise = renderer.compileAsync ? renderer.compileAsync(scene,camera) : Promise.resolve();
      compilePromise.then(function(){
        isWarmed = true;
        // Jeśli resume() zostało wywołane podczas warmup — uruchom ticker teraz
        if(!_paused && !ticking && tickFn){ gsap.ticker.add(tickFn); ticking=true; }
        if(DEBUG_MODE) console.log('[final] WARM — compileAsync done, ticker:', ticking);
      }).catch(function(e){
        console.warn('[final] compileAsync failed, proceeding:', e);
        isWarmed = true;
        if(!_paused && !ticking && tickFn){ gsap.ticker.add(tickFn); ticking=true; }
      });

      positionCard();
      updateClockResponsive();
      var _cw=w||window.innerWidth;
      var _mobileStack=_cw<1200 && layoutInfo && layoutInfo.isMobile && layoutInfo.lh;
      if(_mobileStack){ updateMobileFormScroll(); }
      else if(_cw>=1200){ _setupCardBottomSheet(); }
    });
  }, 1000); // end _ric faza 2 (timeout 1s)
}


// ── CLOCK FUNCTIONS ───────────────────────────────────────────────────────────
function buildClock(){
  while(clockGroup.children.length) clockGroup.remove(clockGroup.children[0]);
  slots.length=0; colonMats.length=0; dayMesh=null; dayMat=null;
  CLOCK_FDW=0.72*CLOCK_SCALE; CLOCK_FDH=CLOCK_FDW*1.5;
  var FSC=CLOCK_FDW/110;
  var sX=ORIG_X.map(function(p){return(p+55-ORIG_TOT/2)*FSC;});
  CLOCK_TOTAL_W=(sX[5]+CLOCK_FDW/2)-(sX[0]-CLOCK_FDW/2);
  for(var i=0;i<6;i++){
    var _m=makeDispMat();
    var _ms=new THREE.Mesh(new THREE.PlaneGeometry(CLOCK_FDW,CLOCK_FDH),_m);
    _ms.position.set(sX[i]+CLOCK_X,CLOCK_Y,CLOCK_Z); _ms.renderOrder=10;
    clockGroup.add(_ms);
    slots.push({mesh:_ms,mat:_m,curVal:-1,tgtVal:-1,isAnim:false});
  }
  var cxA=(sX[1]+sX[2])/2, cxB=(sX[3]+sX[4])/2;
  [cxA,cxB].forEach(function(cxPos){
    var cv2=document.createElement('canvas'); cv2.width=80; cv2.height=384;
    var c2=cv2.getContext('2d');
    c2.fillStyle='white'; c2.fillRect(0,0,80,384);
    c2.fillStyle='black'; c2.font='700 300px "Lexend",sans-serif';
    c2.textAlign='center'; c2.textBaseline='middle'; c2.fillText(':',40,192);
    var ct=new THREE.CanvasTexture(cv2); ct.minFilter=THREE.LinearFilter;
    var cmat=new THREE.ShaderMaterial({
      uniforms:{uTex:{value:ct},uAlpha:{value:1.0}},
      vertexShader:CVRT,fragmentShader:CFRG,transparent:true,depthWrite:false
    });
    colonMats.push(cmat);
    var _cm=new THREE.Mesh(new THREE.PlaneGeometry(CLOCK_FDW*0.3,CLOCK_FDH*0.85),cmat);
    _cm.position.set(cxPos+CLOCK_X,CLOCK_Y,CLOCK_Z); _cm.renderOrder=11;
    clockGroup.add(_cm);
  });
  dayMat=makeDispMat();
  dayMesh=new THREE.Mesh(new THREE.PlaneGeometry(CLOCK_TOTAL_W,CLOCK_FDH),dayMat);
  dayMesh.position.set(CLOCK_X,CLOCK_Y,CLOCK_Z); dayMesh.visible=false; dayMesh.renderOrder=12;
  clockGroup.add(dayMesh);
  prebakeDayTextures();
}

function killAll(){
  if(activeTL){activeTL.kill();activeTL=null;}
  if(nextCall){nextCall.kill();nextCall=null;}
  slots.forEach(function(s){
    gsap.killTweensOf(s.mat.uniforms.uT);
    s.isAnim=false;
  });
  colonMats.forEach(function(m){gsap.killTweensOf(m.uniforms.uAlpha);});
  if(dayMat) gsap.killTweensOf(dayMat.uniforms.uT);
}

function slotTargetTex(slot){
  var v=(slot.tgtVal>=0)?slot.tgtVal:slot.curVal;
  return v>=0?digitTex[v]:getBlankTex();
}

function getDigits(){
  _date.setTime(Date.now());
  var h2=_date.getHours(),m2=_date.getMinutes(),s2=_date.getSeconds();
  _digits[0]=(h2/10)|0; _digits[1]=h2%10;
  _digits[2]=(m2/10)|0; _digits[3]=m2%10;
  _digits[4]=(s2/10)|0; _digits[5]=s2%10;
  return _digits;
}

function animateSlot(slot,newVal){
  if(slot.isAnim) return;
  var old=slot.curVal<0?newVal:slot.curVal;
  if(old===newVal&&slot.curVal>=0) return;
  slot.isAnim=true; slot.tgtVal=newVal;
  slot.mat.uniforms.uTex1.value=digitTex[old];
  slot.mat.uniforms.uTex2.value=digitTex[newVal];
  slot.mat.uniforms.uRnd.value=Math.random()*10;
  slot.mat.uniforms.uT.value=0;
  var _tw=gsap.to(slot.mat.uniforms.uT,{value:1,duration:0.30,ease:'power2.in',onComplete:function(){
    slot.mat.uniforms.uTex1.value=digitTex[newVal];
    slot.mat.uniforms.uTex2.value=digitTex[newVal];
    gsap.to(slot.mat.uniforms.uT,{value:0,duration:0.30,ease:'power2.out',onComplete:function(){
      slot.isAnim=false; slot.curVal=newVal; slot.tgtVal=newVal;
    }});
  }});
  _gsapTrack(_tw);
}

function showDay(){
  if(state!==CLK.CLOCK) return;
  if(!dayTexCache) return; // guard: buildClock nie ukończony jeszcze
  state=CLK.TO_DAY; killAll();
  var rnd=Math.random()*10;
  var juzTex=dayTexCache.juzJest;
  _date.setTime(Date.now());
  var dTex=dayTexCache.days[_date.getDay()];
  var dayStart=(1.0-OVERLAP)*TRANS_DUR;
  slots.forEach(function(slot){
    gsap.killTweensOf(slot.mat.uniforms.uT); slot.isAnim=false;
    slot.mat.uniforms.uTex1.value=slotTargetTex(slot);
    slot.mat.uniforms.uTex2.value=getBlankTex();
    slot.mat.uniforms.uRnd.value=rnd; slot.mat.uniforms.uT.value=0;
  });
  dayMesh.visible=true;
  dayMat.uniforms.uTex1.value=getBlankTex();
  dayMat.uniforms.uTex2.value=juzTex;
  dayMat.uniforms.uRnd.value=rnd; dayMat.uniforms.uT.value=0;
  activeTL=gsap.timeline({onComplete:function(){
    slots.forEach(function(s){s.mesh.visible=false;});
    state=CLK.DAY;
    nextCall=gsap.delayedCall(JUZ_HOLD,function(){
      var rnd2=Math.random()*10;
      dayMat.uniforms.uTex1.value=juzTex;
      dayMat.uniforms.uTex2.value=dTex;
      dayMat.uniforms.uRnd.value=rnd2;
      gsap.to(dayMat.uniforms.uT,{value:0,duration:0,onComplete:function(){
        gsap.to(dayMat.uniforms.uT,{value:1,duration:TRANS_DUR,ease:'power2.inOut'});
      }});
      nextCall=gsap.delayedCall(DAY_HOLD,hideDay);
      _gsapTrack(nextCall);
    });
    _gsapTrack(nextCall);
  }});
  slots.forEach(function(s){activeTL.to(s.mat.uniforms.uT,{value:1,duration:TRANS_DUR,ease:'power2.inOut'},0);});
  colonMats.forEach(function(m){activeTL.to(m.uniforms.uAlpha,{value:0,duration:TRANS_DUR,ease:'power2.inOut'},0);});
  activeTL.to(dayMat.uniforms.uT,{value:1,duration:TRANS_DUR,ease:'power2.inOut'},dayStart);
  _gsapTrack(activeTL);
}

function hideDay(){
  if(state!==CLK.DAY) return;
  state=CLK.TO_CLOCK; killAll();
  var rnd=Math.random()*10;
  var clockStart=(1.0-OVERLAP)*TRANS_DUR;
  var shownDay=dayMat.uniforms.uTex2.value;
  dayMat.uniforms.uTex1.value=shownDay;
  dayMat.uniforms.uTex2.value=getBlankTex();
  dayMat.uniforms.uRnd.value=rnd; dayMat.uniforms.uT.value=0;
  slots.forEach(function(slot){
    slot.mat.uniforms.uTex1.value=getBlankTex();
    slot.mat.uniforms.uTex2.value=getBlankTex();
    slot.mat.uniforms.uRnd.value=rnd; slot.mat.uniforms.uT.value=0; slot.isAnim=false;
  });
  colonMats.forEach(function(m){m.uniforms.uAlpha.value=0;});
  activeTL=gsap.timeline({onComplete:function(){
    slots.forEach(function(s){
      if(s.curVal>=0){
        s.mat.uniforms.uTex1.value=digitTex[s.curVal];
        s.mat.uniforms.uTex2.value=digitTex[s.curVal];
      }
      s.mat.uniforms.uT.value=0;
    });
    dayMesh.visible=false; state=CLK.CLOCK;
    nextCall=gsap.delayedCall(CYCLE,showDay);
    _gsapTrack(nextCall);
  }});
  activeTL.to(dayMat.uniforms.uT,{value:1,duration:TRANS_DUR,ease:'power2.inOut'},0);
  activeTL.call(function(){
    var d=getDigits();
    slots.forEach(function(slot,i){
      slot.curVal=d[i]; slot.tgtVal=d[i];
      slot.mat.uniforms.uTex2.value=digitTex[d[i]]; slot.mesh.visible=true;
    });
  },null,clockStart);
  slots.forEach(function(s){activeTL.to(s.mat.uniforms.uT,{value:1,duration:TRANS_DUR,ease:'power2.inOut'},clockStart);});
  colonMats.forEach(function(m){activeTL.to(m.uniforms.uAlpha,{value:1,duration:TRANS_DUR,ease:'power2.inOut'},clockStart);});
  _gsapTrack(activeTL);
}

function _clockTick(){
  if(!isPageVisible) return;
  if(!digitTex.length||!slots.length||state!==CLK.CLOCK) return;
  var d=getDigits();
  for(var p=0;p<3;p++){
    var ti=p*2,ui=p*2+1;
    if(d[ti]!==slots[ti].curVal){ animateSlot(slots[ti],d[ti]); animateSlot(slots[ui],d[ui]); }
    else if(d[ui]!==slots[ui].curVal){ animateSlot(slots[ui],d[ui]); }
  }
}

// ── CARD BOTTOM SHEET — tap to expand, velocity swipe to collapse ─────────────

function _setupCardBottomSheet(){
  if(!cardEl || document.getElementById('final-card-handle')) return;
  var handle = document.createElement('div');
  handle.id = 'final-card-handle';
  handle.style.cssText = 'position:absolute;top:0;left:0;right:0;height:44px;'+
    'display:flex;align-items:center;justify-content:center;touch-action:pan-x;cursor:grab;z-index:1;border-radius:24px 24px 0 0;';
  var bar = document.createElement('div');
  bar.style.cssText = 'width:36px;height:4px;border-radius:2px;background:rgba(0,0,0,0.2);transition:background 0.2s;';
  handle.appendChild(bar);
  cardEl.insertBefore(handle, cardEl.firstChild);
  var _t0=0, _y0=0, _expanded=false;
  function _expand(){
    if(_cardMaxUp<=0) return; // karta nie jest ucięta — nic do roboty
    _expanded=true;
    gsap.to(cardEl,{y:-_cardMaxUp,duration:0.38,ease:'power3.out'});
    bar.style.background='rgba(0,0,0,0.1)';
  }
  function _collapse(){
    _expanded=false;
    gsap.to(cardEl,{y:0,duration:0.38,ease:'power3.out'});
    bar.style.background='rgba(0,0,0,0.2)';
  }
  function _onTouchStart(e){ _t0=Date.now(); _y0=e.touches[0].clientY; }
  function _onTouchEnd(e){
    var dy=e.changedTouches[0].clientY-_y0, dt=Math.max(1,Date.now()-_t0);
    var velocity=dy/dt*1000;
    var isTap=Math.abs(dy)<12&&dt<300;
    if(isTap){ return; } // tap handled by click event
    else if(velocity>350&&_expanded){ _collapse(); }
    else if(velocity<-350&&!_expanded){ _expand(); }
  }
  // Click = toggle (mysz na desktop małe okno + touch fallback)
  function _onClick(e){
    // Ignoruj klik jeśli to był drag (>12px ruchu)
    if(Math.abs((e.clientY||0) - _y0) > 12) return;
    _expanded ? _collapse() : _expand();
  }

  var _touchOpts = { passive: true };
  cardEl.addEventListener('touchstart', _onTouchStart, _touchOpts);
  cardEl.addEventListener('touchend',   _onTouchEnd,   _touchOpts);
  cardEl.addEventListener('click',      _onClick);
  cleanups.push(function(){
    cardEl.removeEventListener('touchstart', _onTouchStart, _touchOpts);
    cardEl.removeEventListener('touchend',   _onTouchEnd,   _touchOpts);
    cardEl.removeEventListener('click',      _onClick);
  });
}

// ── RESPONSIVE HELPERS ────────────────────────────────────────────────────────
function positionCard(){
  if(!cardEl) return; // NULL-GUARD-01
  gsap.killTweensOf(cardEl);
  var cw2=w||window.innerWidth; // O8: cached, no DOM read
  if(cw2<1200){
    /* Zawsze „bottom sheet” na wąskim ekranie — NIGDY translate(-50%,-50%) na środku viewportu:
     * 640px karty zasłania cały WebGL (napisy + zegar); użytkownik widzi tylko formularz i pustkę. */
    var mobH = computeMobileCardH();
    _lastMobCardHpx = mobH;
    container.style.setProperty('--final-mobile-card-h', mobH + 'px');
    cardEl.style.position='absolute';
    cardEl.style.top='auto';
    cardEl.style.bottom='0';
    cardEl.style.height='';
    cardEl.style.borderRadius='24px 24px 0 0';
    var cardW=Math.min(500,cw2-40);
    cardEl.style.width=cardW+'px';
    cardEl.style.left=Math.round((cw2-cardW)/2)+'px';
    cardEl.style.right='auto';
    cardEl.style.transform='translateY('+mobH+'px)';
    _cardMaxUp=0;
    if(_lastMinH!==''){ container.style.minHeight=''; _lastMinH=''; }
    var _hMob=document.getElementById('final-card-handle');
    if(_hMob) _hMob.style.display='none';
    updateMobileFormScroll();
  } else if(cw2>=1200){
    _lastMobCardHpx = -1;
    container.style.removeProperty('--final-mobile-card-h');
    /* absolute w #final-sticky — NIE fixed: fixed po resize z mobile sprawia, że karta jedzie po całym viewport nad innymi sekcjami */
    cardEl.style.position='absolute'; cardEl.style.height='640px'; cardEl.style.width='';
    var bl=getBannerLayout(cw2), textLeftPx=bl.textLeft;
    var cardLeft=cw2-textLeftPx-500; cardLeft=Math.max(textLeftPx,cardLeft);
    cardEl.style.left=cardLeft+'px'; cardEl.style.top='50%';
    cardEl.style.right='auto';
    cardEl.style.transform='translateY(-50%)'; cardEl.style.bottom='auto';
    cardEl.style.borderRadius='24px';
    _cardMaxUp=0;
    cardEl.style.pointerEvents='auto';
    var _handle=document.getElementById('final-card-handle');
    if(_handle) _handle.style.display='none';
    container.style.minHeight='100vh';
    _lastMinH='100vh';
  }
}

function updateClockResponsive(){
  if(!camera||!layoutInfo) return;
  var cW=w,cH=h;
  var vFov2=55*Math.PI/180;
  var dist=camera.position.z-CC.posZ;
  var unitPx=cH/(2*Math.tan(vFov2/2)*dist);
  var _bl=getBannerLayout(cW),_tL=_bl.textLeft;
  var W_START=1650,W_END=1200,MIN_MARGIN=16;
  var W_CLAMP=1700,TARGET_DIST_TO_D=163;
  var _t2=cW>=W_START?0:cW<=W_END?1:(W_START-cW)/(W_START-W_END);
  var curLeftMargin=_tL*(1-_t2)+MIN_MARGIN*_t2;
  var refLeftMargin=getBannerLayout(W_START).textLeft;
  var deltaMarginPx=curLeftMargin-refLeftMargin;
  var desiredPosX,desiredPosY;
  if(cW<1200){
    desiredPosX=0;
    if(layoutInfo.isMobile&&layoutInfo.lh){
      var textCenterPx=layoutInfo.textTopPx-layoutInfo.lh*0.4;
      desiredPosY=(cH/2-textCenterPx)/unitPx;
      var clockHalfH=0.9*CC.scale*unitPx*0.5;
      var clockBottomPx=(cH/2-desiredPosY*unitPx)+clockHalfH;
      var textStartPx=layoutInfo.textTopPx, minGap=8;
      if(clockBottomPx>textStartPx-minGap){ var overflowPx=clockBottomPx-(textStartPx-minGap); desiredPosY+=overflowPx/unitPx; }
    } else { desiredPosY=CC.posY; }
    var clockTopPxM=(cH/2-desiredPosY*unitPx)-(0.9*CC.scale*unitPx*0.5);
    if(clockTopPxM<50) desiredPosY-=(50-clockTopPxM)/unitPx;
  } else {
    desiredPosX=CC.posX+deltaMarginPx/unitPx;
    if(cW>W_CLAMP){ desiredPosX=(_tL+TARGET_DIST_TO_D-cW/2)/unitPx; }
    var clockLeftPx=(cW/2+desiredPosX*unitPx)-(4.4*CC.scale*unitPx*0.5);
    if(clockLeftPx<50) desiredPosX+=(50-clockLeftPx)/unitPx;
    desiredPosY=CC.posY;
    var clockTopPx2=(cH/2-desiredPosY*unitPx)-(0.9*CC.scale*unitPx*0.5);
    if(clockTopPx2<50) desiredPosY-=(50-clockTopPx2)/unitPx;
  }
  clockResponsiveOffsetX=desiredPosX-CC.posX;
  clockResponsiveOffsetY=(desiredPosY!==undefined?desiredPosY:CC.posY)-CC.posY;
}

function m2c(cx2,cy2){
  var vx=cx2/w,vy=1-cy2/h;
  _m2cResult.x=((vx-cr.ox)/cr.sx)*2-1;
  _m2cResult.y=((vy-cr.oy)/cr.sy)*2-1;
  return _m2cResult;
}


// ── TICK FUNCTION (HOT loop) ───────────────────────────────────────────────────
tickFn = function(){
  if(!isPageVisible || !renderer) return;
  var now=performance.now(),t=now*0.001;
  var dt=Math.min((now-_lastTime)/1000,0.033); _lastTime=now; var dt60=dt*60.0;
  var m=m2c(rawMouse.x,rawMouse.y);
  mouse.x=m.x; mouse.y=m.y;
  var _lerpDt=1.0-Math.pow(1.0-P.lerp,dt60); // dt-compensated — frame-rate independent
  smooth.x+=(mouse.x-smooth.x)*_lerpDt;
  smooth.y+=(mouse.y-smooth.y)*_lerpDt;
  uMouse.value.set(smooth.x,smooth.y);
  mUV_x=smooth.x*0.5+0.5; mUV_y=smooth.y*0.5+0.5;
  var dx=mUV_x-textCenter.x,dy=mUV_y-textCenter.y;
  var prox=1.0-Math.min(Math.sqrt(dx*dx+dy*dy)/(textRadius*2.5),1.0);
  prox*=prox;
  U.uBulgeH.value+=(P.bulgeH*(0.35+0.65*prox)-U.uBulgeH.value)*(1.0-Math.pow(0.92,dt60));
  lev.rotX=Math.sin(t*0.21)*0.22+Math.sin(t*0.21*PHI)*0.022;
  lev.rotY=Math.sin(t*0.13)*0.13+Math.sin(t*0.13*PHI)*0.013;
  lev.rotZ=Math.sin(t*0.11)*0.09+Math.sin(t*0.11*PHI)*0.009;
  var levMult=(levFrozen?0:1);
  var camZ2=camera.position.z;
  var projScale=camZ2/(camZ2-levS.posZ);
  var optPosY=levS.posY+0.11*CC.scale*compScaleVal;
  var projX=levS.posX*projScale,projY=optPosY*projScale;
  var clockPlaneUvX=projX/planeW+0.5,clockPlaneUvY=projY/planeH+0.5;
  var clockContentX=(clockPlaneUvX-cr.ox)/cr.sx;
  var clockContentY=(clockPlaneUvY-cr.oy)/cr.sy;
  var ballContentX=mUV_x,ballContentY=mUV_y;
  var ASPECT_STRETCH_X=1.6;
  var bdX=(clockContentX-ballContentX)/(P.bulgeX*ASPECT_STRETCH_X);
  var bdY=(clockContentY-ballContentY)/P.bulgeY;
  var dist2=Math.sqrt(bdX*bdX+bdY*bdY);
  var DEAD_ZONE=0.20,distAdj=Math.max(0,dist2-DEAD_ZONE);
  var GAUSS_K=1.2,gradMag=distAdj*Math.exp(-GAUSS_K*distAdj*distAdj);
  var invDist=dist2>0.001?1.0/dist2:0;
  var dirX=bdX*invDist,dirY=bdY*invDist;
  var TILT_STRENGTH_X=2.0,TILT_STRENGTH_Y=1.2;
  var visualBoostY=(dirX<0.0)?2.2:0.85;
  var springTargetRotX=-dirY*gradMag*TILT_STRENGTH_X;
  var springTargetRotY=dirX*gradMag*TILT_STRENGTH_Y*visualBoostY;
  var stiffDt=Math.min(SPRING_STIFF*dt60,1.0),dampDt=Math.pow(SPRING_DAMP,dt60);
  spring.velRotX+=(springTargetRotX-spring.rotX)*stiffDt;
  spring.velRotY+=(springTargetRotY-spring.rotY)*stiffDt;
  spring.velRotX*=dampDt; spring.velRotY*=dampDt;
  spring.rotX+=spring.velRotX; spring.rotY+=spring.velRotY;
  var springEnergy=Math.abs(spring.rotX)+Math.abs(spring.rotY)+Math.abs(spring.velRotX)+Math.abs(spring.velRotY);
  var targetInf=(dist2<2.5||springEnergy>0.01)?1.0:0.0;
  levInf+=(targetInf-levInf)*(1.0-Math.pow(0.96,dt60));
  var finalPosX=CC.posX+clockResponsiveOffsetX,finalPosY=CC.posY+clockResponsiveOffsetY,finalPosZ=CC.posZ;
  var finalRotX=CC.rotX+lev.rotX*levMult*(1-levInf)+spring.rotX*levInf;
  var finalRotY=CC.rotY+lev.rotY*levMult*(1-levInf)+spring.rotY*levInf;
  var finalRotZ=CC.rotZ+lev.rotZ*levMult;
  var _ls=levFrozen?1.0:(1.0-Math.pow(0.96,dt60)); // dt-compensated lerpSpeed
  levS.posX+=(finalPosX-levS.posX)*_ls; levS.posY+=(finalPosY-levS.posY)*_ls;
  levS.posZ+=(finalPosZ-levS.posZ)*_ls; levS.rotX+=(finalRotX-levS.rotX)*_ls;
  levS.rotY+=(finalRotY-levS.rotY)*_ls; levS.rotZ+=(finalRotZ-levS.rotZ)*_ls;
  clockParent.position.set(levS.posX,levS.posY,levS.posZ);
  clockParent.scale.setScalar(CC.scale*compScaleVal);
  clockParent.rotation.set(levS.rotX,levS.rotY,levS.rotZ);
  renderer.render(scene,camera);
};

// ── RESIZE HANDLER ────────────────────────────────────────────────────────────
var resizePending=false, lastResizeW2=0, lastResizeH2=0, _resizeRaf=null;
var _lastMinH='';
function handleResize(){
  resizePending=false; _resizeRaf=null;
  if(isKilled||!renderer) return;
  var newW=window.innerWidth,newH=window.innerHeight; // O7: consistent with warmup
  if(newW===w&&newH===h) return;
  var widthChanged=Math.abs(newW-lastResizeW2)>1;
  var aspectChanged=Math.abs(newW/newH-lastResizeW2/lastResizeH2)>0.05;
  var heightDelta=Math.abs(newH-h);
  // O7: deadband — toolbar show/hide (<60px) skips full rebuild
  if(!widthChanged && heightDelta<60){
    w=newW; h=newH;
    var _rw=Math.min(w,2340);
    renderer.setSize(_rw,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
    if (w < 1200) {
      _lastMobCardHpx = -1;
      container.style.setProperty('--final-mobile-card-h', computeMobileCardH() + 'px');
    }
    updateMobileFormScroll();
    return;
  }
  w=newW; h=newH;
  var rw=Math.min(w,2340);
  renderer.setSize(rw,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
  if(widthChanged||aspectChanged){
    lastResizeW2=w; lastResizeH2=h;
    var pw=planeH*(w/h); planeW=pw;
    mesh.geometry.dispose();
    mesh.geometry=new THREE.PlaneGeometry(pw,planeH,32,32);
    var nt=makeTexture(w,h);
    U.uTexture.value.dispose(); U.uTexture.value=nt.tex;
    textCenter=nt.textCenter; textRadius=nt.textRadius;
    compScaleVal=nt.compScale||1.0; layoutInfo=nt.layout||{};
  }
  cr=getContentRect(w,h);
  U.uContentOffset.value.set(cr.ox,cr.oy); U.uContentScale.value.set(cr.sx,cr.sy);
  updateClockResponsive(); positionCard();
  updateMobileFormScroll();
}
var _onResize=function(){
  if(!resizePending){ resizePending=true; _resizeRaf=requestAnimationFrame(handleResize); }
};
window.addEventListener('resize',_onResize);
cleanups.push(function(){ window.removeEventListener('resize',_onResize); });

// ── VISIBILITY HANDLER ────────────────────────────────────────────────────────
var _onVisChange=function(){
  isPageVisible=!document.hidden;
  if(!isPageVisible){
    if(activeTL){activeTL.pause();} if(nextCall){nextCall.pause();}
  } else {
    _lastTime=performance.now();
    if(activeTL){activeTL.resume();} if(nextCall){nextCall.resume();}
  }
};
document.addEventListener('visibilitychange',_onVisChange);
cleanups.push(function(){ document.removeEventListener('visibilitychange',_onVisChange); });

// ── POINTERMOVE (HF — za IO gatingiem) ───────────────────────────────────────
var _onPointerMove=function(e){ rawMouse.x=e.clientX; rawMouse.y=e.clientY; };
// INP-02: dodawany/usuwany przez pause/resume, nie w init()
hfListeners.push({target:window,event:'pointermove',fn:_onPointerMove,options:{passive:true}});

// ── PAUSE / RESUME / KILL (B-CPU-03 idempotent) ───────────────────────────────
function pause(){
  if(_paused) return; // B-CPU-03: idempotent
  _paused=true;
  if(ticking){ gsap.ticker.remove(tickFn); ticking=false; }
  _stopClockInterval();
  hfListeners.forEach(function(h){ h.target.removeEventListener(h.event,h.fn,h.options); });
  if(DEBUG_MODE) console.log('[final] pause() -> OFF');
}

function resume(){
  if(!_paused) return; // B-CPU-03: idempotent
  _paused=false;
  if(!renderer){ warmup(); }
  // GL-CPU-01: ticker startuje dopiero gdy isWarmed=true
  // Jeśli warmup jest w trakcie (rAF fazy 2/3) — faza 3 sprawdzi _paused i uruchomi ticker
  if(isWarmed && !ticking && tickFn){ gsap.ticker.add(tickFn); ticking=true; }
  if(window.innerWidth < 768){ gsap.ticker.fps(30); } // O9: 30fps mobile — dt-compensated lerp kompensuje wizualnie
  if(!clockIntervalId){
    _startClockInterval();
    state=CLK.CLOCK;
    nextCall=gsap.delayedCall(CYCLE,showDay);
    _gsapTrack(nextCall);
  }
  hfListeners.forEach(function(h){ h.target.addEventListener(h.event,h.fn,h.options); });
  if(DEBUG_MODE) console.log('[final] resume() — warmed:', isWarmed, 'ticking:', ticking);
}

function kill(){
  isKilled=true; _s._killed=true;
  if(_resizeRaf){ cancelAnimationFrame(_resizeRaf); _resizeRaf=null; }
  pause();
  killAll();
  cleanups.forEach(function(fn){ try{fn();}catch(e){} });
  timerIds.forEach(function(t){
    if(t.type==='interval') clearInterval(t.id);
    else if(t.type==='timeout') clearTimeout(t.id);
    else if(t.type==='raf'&&t.id!=null) cancelAnimationFrame(t.id);
  });
  observers.forEach(function(o){ if(o&&o.disconnect) o.disconnect(); });
  gsapInstances.forEach(function(inst){
    try{if(inst&&inst.revert)inst.revert();}catch(e){}
    try{if(inst&&inst.kill)inst.kill();}catch(e){}
  });
  // GL-MEM-01: pełny dispose COLD
  if(renderer){
    try{scene&&(scene.environment=null);}catch(e){}
    try{envRT&&envRT.dispose&&envRT.dispose();}catch(e){} envRT=null;
    try{mesh&&mesh.geometry&&mesh.geometry.dispose();}catch(e){}
    try{mat&&mat.dispose();}catch(e){}
    try{U&&U.uTexture&&U.uTexture.value&&U.uTexture.value.dispose();}catch(e){}
    try{glassGeo&&glassGeo.dispose();}catch(e){}
    try{glassMat&&glassMat.dispose();}catch(e){}
    try{dispMap&&dispMap.dispose();}catch(e){}
    if(digitTex&&digitTex.length){
      for(var i=0;i<digitTex.length;i++){try{digitTex[i]&&digitTex[i].dispose();}catch(e){}}
      digitTex.length=0;
    }
    if(dayTexCache){
      try{dayTexCache.juzJest&&dayTexCache.juzJest.dispose();}catch(e){}
      if(dayTexCache.days){for(var j=0;j<dayTexCache.days.length;j++){try{dayTexCache.days[j].dispose();}catch(e){}}}
      dayTexCache=null;
    }
    renderer.dispose();
    // canvasOwnership = runtime -> canvas.remove() WYMAGANE (GL-MEM-01)
    if(renderer.domElement&&renderer.domElement.parentNode){
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    renderer=null; isWarmed=false;
  }
  if(DEBUG_MODE) console.log('[final] kill() -> COLD');
}


// ── CPU GATING — jeden IO observer ───────────────────────────────────────────
// rootMargin 3×VH — warmup z wyprzedzeniem + resume/pause
// Obserwuje stickyEl (#final-sticky) który nie ma margin-top offset
var _ioWarm = null, _ioDebounce = null;
var _s = {_killed: false};

function _getVH(){ return window.visualViewport ? window.visualViewport.height : window.innerHeight; }
function _getWarmMargin(){
  return Math.min(5000, Math.max(800, Math.round(5.0 * _getVH()))) + 'px'; // A: 5×VH — więcej czasu na idle warmup
}

function _ioCallback(entries){
  var e = entries[0]; if(!e) return;
  var wasActive = _ioState;
  _ioState = e.isIntersecting;
  if(_ioState && !wasActive){
    if(!renderer) warmup();
    resume();
    if(DEBUG_MODE) console.log('[final] IO: ENTER');
  } else if(!_ioState && wasActive){
    pause();
    if(DEBUG_MODE) console.log('[final] IO: LEAVE');
  }
}

function _recreateIO(){
  clearTimeout(_ioDebounce);
  _ioDebounce = setTimeout(function(){
    if(_s._killed) return;
    if(_ioWarm){ _ioWarm.disconnect();
      var idx=observers.indexOf(_ioWarm); if(idx>=0) observers.splice(idx,1); // nie akumuluj
    }
    _ioWarm = new IntersectionObserver(_ioCallback, {rootMargin: _getWarmMargin()});
    _ioWarm.observe(stickyEl || container);
    observers.push(_ioWarm);
  }, 300); // O10: 300ms debounce (was 50ms)
}

var _onVVResize = function(){
  var cwMob = (w || window.innerWidth) || 0;
  if (cwMob < 1200 && !isKilled && cardEl) {
    positionCard();
    updateMobileFormScroll();
  }
  if(_ioState && !_paused) return; // O10: skip if section active
  _recreateIO();
}; // named handler — INP-LEAK-01

if(window.visualViewport){
  window.visualViewport.addEventListener('resize', _onVVResize, {passive:true});
  cleanups.push(function(){
    clearTimeout(_ioDebounce);
    window.visualViewport.removeEventListener('resize', _onVVResize);
  });
}

_recreateIO(); // bootstrap IO

// ── Scroll (Lenis): aktualizacja wjazdu karty — musi być zsynchronizowane z getBoundingClientRect extendera
var _formScrollAttempts = 0;
var _formScrollBindRaf = 0;
var _formScrollFn = function(){ updateMobileFormScroll(); };
function _bindFormScrollLoop(){
  if(scrollRuntime.isReady()){
    scrollRuntime.on('scroll', _formScrollFn);
    cleanups.push(function(){ scrollRuntime.off('scroll', _formScrollFn); });
    updateMobileFormScroll();
    return;
  }
  if(_formScrollAttempts>300){
    window.addEventListener('scroll', _formScrollFn, {passive:true});
    cleanups.push(function(){ window.removeEventListener('scroll', _formScrollFn); });
    updateMobileFormScroll();
    return;
  }
  _formScrollAttempts++;
  _formScrollBindRaf = requestAnimationFrame(_bindFormScrollLoop);
}
_bindFormScrollLoop();
cleanups.push(function(){
  if(_formScrollBindRaf) cancelAnimationFrame(_formScrollBindRaf);
});

// ── DEV metadata (tylko jeśli DEBUG_MODE) ─────────────────────────────────────
if(DEBUG_MODE){
  window._finalMeta = {state:'COLD',ticking:false,ioState:false,warmed:false,gsapN:0};
  var _metaTimer = setInterval(function(){
    if(isKilled){ clearInterval(_metaTimer); return; }
    window._finalMeta.state   = ticking?'HOT':(_paused?'OFF':renderer?'WARM':'COLD');
    window._finalMeta.ticking = ticking;
    window._finalMeta.ioState = _ioState ? 'ENTER' : 'LEAVE';
    window._finalMeta.warmed  = isWarmed;
    window._finalMeta.gsapN   = gsapInstances.length;
  }, 500);
  timerIds.push({type:'interval', id:_metaTimer});
}

return { pause:pause, resume:resume, kill:kill };
} // end init()


// ── REACT COMPONENT ──────────────────────────────────────────────────────────

export function FinalEngine() {
  const rootRef = useRef<HTMLElement | null>(null);

  // Double rAF refresh po dynamic mount (pin/geometry settle)
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
  }, []); // tylko przy pierwszym mount

  useGSAP(() => {
    // Sekcja nie używa pluginów GSAP — brak gsap.registerPlugin()

    const el = rootRef.current;
    if (!el) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error('[P3] rootRef.current is null — ref not attached to <section>.');
      }
      return;
    }
    const inst = init(el);
    return () => inst?.kill?.();
    // useGSAP Context revertuje instancje GSAP z init() automatycznie.
    // inst.kill() revertuje je powtórnie + czyści observers/timers/listeners.
    // Double cleanup nie jest problemem — kill() jest idempotentny (isKilled guard).
  }, { scope: rootRef });

  return (
    <section id="final-section" ref={rootRef}>
      <div id="final-sticky">
        <div id="final-scene"></div>
        <div id="final-formCard">
          <FinalFormCard />
        </div>

      </div>
      <div className="final-scroll-extender" aria-hidden="true" />
    </section>
  );
}
