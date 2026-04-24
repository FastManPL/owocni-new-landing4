// @ts-nocheck
'use client';

import { useRef, useEffect, createElement } from 'react';
import Image from 'next/image';
import logoA from './logo-A.jpg';
import logoB from './logo-B.jpg';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Draggable } from 'gsap/Draggable';
import { scrollRuntime } from '@/lib/scrollRuntime';
import {
  getWebGLProfile,
  getWebGLPixelRatio,
  getWebGLRendererCreationOptions,
} from '@/lib/webglBroker';
import './onas-section.css';
import { CENNIK_STRONY_URL } from '@/config/ctaUrls';

// GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// registerPlugin() WYLACZNIE wewnatrz useGSAP(() => { ... }) ponizej.

// ─────────────────────────────────────────────────────────────────────────────
// CAROUSEL INIT — 1:1 z reference.html
// ─────────────────────────────────────────────────────────────────────────────

var onasCarouselInit = (function() {

function init(container) {
    var $ = function(sel) { return container.querySelector(sel); };
    var $$ = function(sel) { return container.querySelectorAll(sel); };
    var $id = function(id) { return container.querySelector('#' + id); };
    var getScroll = function() { return scrollRuntime.getScroll(); };
    var getRawScroll = function() { return scrollRuntime.getRawScroll(); };

    var cleanups = [];
    var gsapInstances = [];
    var timerIds = [];
    var observers = [];

    var tickFn = null;
    var ticking = false;
    var hfListeners = [];
    var wistiaPopupLoadPromise = null;

    function loadScriptOnce(src, type) {
        return new Promise(function(resolve, reject) {
            var escapedSrc = src.replace(/"/g, '\\"');
            var existing = document.querySelector('script[src="' + escapedSrc + '"]');
            if (existing) {
                if (existing.dataset.loaded === 'true') {
                    resolve();
                    return;
                }
                existing.addEventListener('load', function onLoad() {
                    existing.dataset.loaded = 'true';
                    resolve();
                }, { once: true });
                existing.addEventListener('error', function onError() {
                    reject(new Error('Failed to load script: ' + src));
                }, { once: true });
                return;
            }

            var script = document.createElement('script');
            script.src = src;
            script.async = true;
            if (type) script.type = type;
            script.addEventListener('load', function onLoad() {
                script.dataset.loaded = 'true';
                resolve();
            }, { once: true });
            script.addEventListener('error', function onError() {
                reject(new Error('Failed to load script: ' + src));
            }, { once: true });
            document.head.appendChild(script);
        });
    }

    function ensurePopupWistiaLoaded() {
        if (!wistiaPopupLoadPromise) {
            wistiaPopupLoadPromise = loadScriptOnce('https://fast.wistia.com/player.js')
                .then(function() {
                    return loadScriptOnce('https://fast.wistia.com/embed/fds00b5wst.js', 'module');
                })
                .then(function() {
                    return customElements.whenDefined('wistia-player');
                });
        }
        return wistiaPopupLoadPromise;
    }

    /* ── PLAY BUTTON (video card overlay) ── */
    function createPlayButton(card, size) {
        var YELLOW='#ffc600', ns='http://www.w3.org/2000/svg';
        var SW=Math.max(2,size*0.035), CX=size/2, CY=size/2;
        var R=CX-SW*2-2, CIRC=2*Math.PI*R;
        var DOT_R=SW*1.05, DOT_COUNT=Math.round(CIRC/(DOT_R*5.5));
        var id='onas-pb'+Math.random().toString(36).slice(2,8);

        /* Scoped keyframes */
        var st=document.createElement('style');
        st.textContent='@keyframes '+id+'-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
        document.head.appendChild(st);

        var wrap=document.createElement('div');
        wrap.className='play-btn';
        /* Size controlled by CSS (% of card) — no inline px */
        card.appendChild(wrap);

        var svg=document.createElementNS(ns,'svg');
        svg.setAttribute('width',size);svg.setAttribute('height',size);
        svg.setAttribute('viewBox','0 0 '+size+' '+size);
        svg.style.cssText='overflow:visible;display:block;';
        wrap.appendChild(svg);

        /* DOTS ring */
        var dotsG=document.createElementNS(ns,'g');
        dotsG.style.cssText='transform-origin:'+CX+'px '+CY+'px;animation:'+id+'-spin 8s linear infinite;animation-play-state:paused;will-change:transform;';
        svg.appendChild(dotsG);
        var dotEls=[];
        for(var i=0;i<DOT_COUNT;i++){
            var a=(i/DOT_COUNT)*Math.PI*2-Math.PI/2;
            var dot=document.createElementNS(ns,'circle');
            dot.setAttribute('cx',CX+Math.cos(a)*R);
            dot.setAttribute('cy',CY+Math.sin(a)*R);
            dot.setAttribute('r',DOT_R);dot.setAttribute('fill',YELLOW);
            dot.setAttribute('opacity','0.22');
            dot.style.transition='opacity 0.35s ease';
            dotsG.appendChild(dot);dotEls.push(dot);
        }

        /* Progress ARC — driven by video timeupdate */
        var arc=document.createElementNS(ns,'circle');
        arc.setAttribute('cx',CX);arc.setAttribute('cy',CY);arc.setAttribute('r',R);
        arc.setAttribute('fill','none');arc.setAttribute('stroke',YELLOW);
        arc.setAttribute('stroke-width',SW*1.5);
        arc.setAttribute('stroke-dasharray',CIRC);
        arc.setAttribute('stroke-dashoffset',CIRC);
        arc.setAttribute('stroke-linecap','round');
        arc.setAttribute('transform','rotate(-90 '+CX+' '+CY+')');
        arc.style.cssText='transition:opacity 0.4s ease;will-change:stroke-dashoffset;';
        svg.appendChild(arc);

        /* TRIANGLE */
        var h=size*0.32, w=h*0.866, ox=h*0.1;
        var triPts=(CX-w/2+ox)+','+(CY-h/2)+' '+(CX+w/2+ox)+','+CY+' '+(CX-w/2+ox)+','+(CY+h/2);
        var triG=document.createElementNS(ns,'g');
        triG.style.cssText='transform-origin:'+CX+'px '+CY+'px;transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1);';
        svg.appendChild(triG);
        var tri=document.createElementNS(ns,'polygon');
        tri.setAttribute('points',triPts);tri.setAttribute('fill',YELLOW);
        tri.style.transition='fill 0.3s ease';
        triG.appendChild(tri);

        /* HOVER — driven by CARD hover, not button hover */
        var bounceT=null;
        function enterHover(){
            dotsG.style.animationPlayState='running';
            dotEls.forEach(function(d){d.setAttribute('opacity','0.5');});
            arc.style.opacity='0';
            tri.setAttribute('fill','#ffffff');
            triG.style.transform='scale(0.7)';
            clearTimeout(bounceT);
            bounceT=setTimeout(function(){triG.style.transform='scale(1.35)';},150);
        }
        function leaveHover(){
            dotsG.style.animationPlayState='paused';
            dotEls.forEach(function(d){d.setAttribute('opacity','0.22');});
            arc.style.opacity='1';
            tri.setAttribute('fill',YELLOW);
            triG.style.transform='scale(0.75)';
            clearTimeout(bounceT);
            bounceT=setTimeout(function(){triG.style.transform='scale(1)';},150);
        }

        /* VIDEO PROGRESS — called from timeupdate */
        function updateProgress(ratio){
            arc.setAttribute('stroke-dashoffset',(CIRC*(1-ratio)).toFixed(1));
        }

        /* Cleanup */
        cleanups.push(function(){
            clearTimeout(bounceT);
            if(st.parentNode) document.head.removeChild(st);
        });

        return {el:wrap, enterHover:enterHover, leaveHover:leaveHover, updateProgress:updateProgress};
    }

    function generateJellyfishSVG(index) {
        var palettes = [
            { body:'#ff6b9d', tent:'#c44569', bg:'#2d1b69', glow:'#ff6b9d' },
            { body:'#48dbfb', tent:'#0abde3', bg:'#0a1628', glow:'#48dbfb' },
            { body:'#ff9ff3', tent:'#f368e0', bg:'#1a0a2e', glow:'#ff9ff3' },
            { body:'#54a0ff', tent:'#2e86de', bg:'#0c1445', glow:'#54a0ff' },
            { body:'#5f27cd', tent:'#341f97', bg:'#0a0520', glow:'#a55eea' },
            { body:'#00d2d3', tent:'#01a3a4', bg:'#021c1e', glow:'#00d2d3' },
            { body:'#ff6348', tent:'#ee5a24', bg:'#2d0a0a', glow:'#ff6348' }
        ];
        var p = palettes[index % palettes.length];
        var s = function(n) { return Math.sin(index*127.1+n*311.7)*0.5+0.5; };
        var bodyY=30+s(1)*10, bodyW=28+s(2)*16, bodyH=20+s(3)*12;
        var tentacles='', tentCount=5+Math.floor(s(4)*4);
        for(var t=0;t<tentCount;t++){
            var tx=50-bodyW/2+(bodyW/(tentCount-1))*t, ty=bodyY+bodyH*0.7;
            var len=20+s(t+10)*25, c1=(s(t+20)-0.5)*20, c2=(s(t+30)-0.5)*15;
            var op=(0.3+s(t+40)*0.5).toFixed(2), sw=(1+s(t+50)).toFixed(1);
            tentacles+='<path d="M'+tx+','+ty+' Q'+(tx+c1)+','+(ty+len*0.5)+' '+(tx+c2)+','+(ty+len)+'" stroke="'+p.tent+'" stroke-width="'+sw+'" fill="none" opacity="'+op+'" stroke-linecap="round"/>';
        }
        var particles='';
        for(var pp=0;pp<6;pp++){
            var px=(s(pp+70)*100).toFixed(1),py=(s(pp+80)*100).toFixed(1),pr=(0.5+s(pp+90)*1.5).toFixed(1),po=(0.1+s(pp+95)*0.3).toFixed(2);
            particles+='<circle cx="'+px+'" cy="'+py+'" r="'+pr+'" fill="'+p.glow+'" opacity="'+po+'"/>';
        }
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="onas-glow'+index+'" cx="50%" cy="40%" r="50%"><stop offset="0%" stop-color="'+p.glow+'" stop-opacity="0.3"/><stop offset="100%" stop-color="'+p.bg+'" stop-opacity="0"/></radialGradient><radialGradient id="onas-body'+index+'" cx="50%" cy="30%" r="50%"><stop offset="0%" stop-color="'+p.body+'" stop-opacity="0.9"/><stop offset="70%" stop-color="'+p.body+'" stop-opacity="0.5"/><stop offset="100%" stop-color="'+p.tent+'" stop-opacity="0.2"/></radialGradient><filter id="onas-blur'+index+'"><feGaussianBlur stdDeviation="1.5"/></filter></defs><rect width="100" height="100" fill="'+p.bg+'"/>'+
        '<ellipse cx="50" cy="'+bodyY+'" rx="'+bodyW+'" ry="'+(bodyH+10)+'" fill="url(#onas-glow'+index+')" filter="url(#onas-blur'+index+')"/>'+particles+tentacles+
        '<ellipse cx="50" cy="'+bodyY+'" rx="'+(bodyW/2)+'" ry="'+(bodyH/2)+'" fill="url(#onas-body'+index+')"/>'+
        '<ellipse cx="50" cy="'+(bodyY-2)+'" rx="'+(bodyW/3)+'" ry="'+(bodyH/3)+'" fill="'+p.body+'" opacity="0.3"/><ellipse cx="50" cy="'+(bodyY-3)+'" rx="'+(bodyW/5)+'" ry="'+(bodyH/5)+'" fill="white" opacity="0.15"/></svg>';
    }

    function svgToDataUri(svgString) { return 'data:image/svg+xml,' + encodeURIComponent(svgString); }
    function getCardImageUrl(index) { return svgToDataUri(generateJellyfishSVG(index)); }

    function preloadCardImages(selector) {
        return new Promise(function(resolve) {
            if (typeof imagesLoaded === 'function') {
                imagesLoaded(container.querySelectorAll(selector), { background: true }, resolve);
            } else { resolve(); }
        });
    }

    var CarouselEngine = (function() {
        function E() {
            this.targetAngle=0; this.currentAngle=0; this.velocity=0;
            this.isDragging=false; this.isSnapping=false;
            this.autoplayActive=true;
            this.config={
                lerp:0.035, wheelSensitivity:0.12, dragSensitivity:0.15,
                friction:0.985, snapStiffness:300, snapDamping:28, snapEnabled:true,
                mass:1.0, velocityThreshold:0.3, maxVelocity:0.75, autoplaySpeed:4.0,
                opacitySpread:0.15, frontZoneDeg:57, frontScale:1.14, frontEasing:'pulse',
                glowScale:0.4, scaleEma:0.15, glowOffsetY:0.2, glowColor:'#f9cd90',
                scrollInfluence:0.06, scrollTimeConstant:0.7, scrollMaxMomentum:1.0
            };
            this.velocitySamples=[]; this.cardCount=0; this.cardAngle=0;
            this.a3dElement=null; this.sceneElement=null; this.cards=[]; this.lastTime=0;
            this.cardScaleValues=[]; this._lastWrittenScale=[]; this._lastWrittenBr=[];
            this._lastFrameBreatheLean=[0,0];
            this._radiusBase=1.13; this._radiusExpand=1.25; this._radiusCurrent=1.13; this._radiusTarget=1.13;
            this.lastScrollY=0; this._scrollVel=0; this._scrollMomentum=0; this.isInView=false;
            this._lastAbsVel=0; this._lastCurrentAngle=0; this._idleFrames=0;
            this._activeGlow='gold-ring'; this.glowTimer=0; this.glowThreshold=0.5;
            this._cardStaticRY=[]; this._halfAngleDeg='';
            this._lastGlowLevel=[]; this._wasFront=[]; this._wasGlowActive=[];
            this._glowDirty=true; this._glowColorRgb=hexToRgb('#f9cd90'); this._glowLUT=null;
            this._hoverTimelines=[]; this._hoverListeners=[]; this._cardStyleIdx=[];
            this._pendingHoverX=-1; this._pendingHoverY=-1;
            this._hoverDirty=false; this._hoverPointerIsMouse=false; this._hoverLeft=false;
            this._lastHoverMoveX=-1; this._lastHoverMoveY=-1;
            this._hoverRectCache=[]; this._hoverRectCacheTs=0; this._hoverRectCacheTtl=50;
            this.reducedMotion=false;
            if(window.matchMedia){
                var mq=window.matchMedia('(prefers-reduced-motion: reduce)');
                this.reducedMotion=mq.matches;
                var self=this;
                var mqChange=function(e){self.reducedMotion=e.matches;};
                if(mq.addEventListener) mq.addEventListener('change',mqChange);
                else if(mq.addListener) mq.addListener(mqChange);
            }
            var self=this;
            this._bW=function(e){self._onWheel(e)};
            this._bK=function(e){self._onK(e)};
            this._ucAccum=0; this._ucInterval=1000/30;
            this._bT=function(time,deltaTime){
                self._tick(time,deltaTime);
            };
            this._lastDragX=0; this._lastDragTime=0; this._draggableInstance=null;
            this._pressX=0; this._pressY=0; this._pressSpeed=0; this._tappedCard=null;
            
            
            this._tickerActive=false; this._pausedAt=0; this._easingFn=null; this._isVisible=[];
            // CASCADE REVEAL
            this._revealState=[];
            this._revealTriggered=false;
            this._revealComplete=false;
            this._revealTimeline=null;
        }

        var EASING_FNS={
            spotlight:function(t){var t8=t*t*t*t*t*t*t*t;var f=Math.max(0,1-16*t8);return t>0.45?0:f;},
            halo:function(t){return Math.pow(Math.cos(t*Math.PI/2),0.6);},
            cascade:function(t){var step=Math.floor(t*5);var levels=[1,0.85,0.55,0.2,0];return step>=4?0:levels[step];},
            trail:function(t,ra,velDir,ftNorm){var raSigned=ra/180;var trailBias=0;if(velDir!==0)trailBias=raSigned*velDir*0.35;var tTrail=Math.abs(raSigned)/ftNorm+trailBias;tTrail=Math.max(0,Math.min(1,tTrail));return 1-tTrail*tTrail*(3-2*tTrail);},
            pulse:function(t){var f=1-t*t*(3-2*t);return Math.max(0,Math.min(1,f));},
            duo:function(t){if(t<0.35)return 1;var d=(t-0.35)/0.65;return Math.max(0,1-d*d);},
            elastic:function(t){var f;if(t<0.1)f=1+0.08*Math.sin(t/0.1*Math.PI);else if(t<0.8){var u=(t-0.1)/0.7;f=1-u*u*(2.7*u-1.7);}else f=Math.max(0,(1-t)/0.2*0.05);return Math.max(0,Math.min(1.08,f));},
            threshold:function(t){if(t<0.15)return 1;var d2=(1-t)/(1-0.15);return Math.max(0,d2*d2*d2);},
            bell:function(t){return Math.exp(-4.5*t*t);},
            plateau:function(t){if(t<0.3)return 1;var d3=(t-0.3)/0.7;return Math.max(0,1-Math.pow(d3,1.5));}
        };
        var EASING_DEFAULT=function(t){if(t<0.5){var t4=t*t*t*t;return 1-8*t4;}var u2=-2*t+2;return u2*u2*u2*u2/2;};

        E.prototype._bindEasing=function(name){this._easingFn=EASING_FNS[name]||EASING_DEFAULT;};

        E.prototype.init=function(a,s){
            this.a3dElement=a; this.sceneElement=s;
            var section=$id('onas-carousel');
            if(!section) { console.warn('onas-carousel: section not found'); return; }
            this._sectionEl=section;
            section.addEventListener('wheel',this._bW,{passive:false});
            cleanups.push(function(){section.removeEventListener('wheel',this._bW);}.bind(this));
            window.addEventListener('keydown',this._bK);
            cleanups.push(function(){window.removeEventListener('keydown',this._bK);}.bind(this));
            this.lastScrollY=getRawScroll();
            var self=this;
            if(window.IntersectionObserver){
                var obs=new IntersectionObserver(function(entries){
                    var wasInView=self.isInView;
                    self.isInView=entries[0]?.isIntersecting ?? false;
                    if(self.isInView&&!wasInView) self._wakeTicker();
                    else if(!self.isInView&&wasInView&&!self.isDragging) self._sleepTicker();
                },{threshold:0.2});
                obs.observe(section);
                observers.push(obs);
            }

            var proxy=document.createElement('div');
            proxy.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;visibility:hidden;pointer-events:none;';
            document.body.appendChild(proxy);
            cleanups.push(function(){ if(proxy.parentNode) proxy.parentNode.removeChild(proxy); });

            this._draggableInstance=Draggable.create(proxy,{
                type:'x', trigger:section, zIndexBoost:false, allowContextMenu:true,
                cursor:'', activeCursor:'',
                onPress:function(){

                    if(!self._revealComplete)return;

                    /* === DETECT VIDEO CARD AT PRESS TIME (before it escapes) === */
                    self._pressX=this.pointerX; self._pressY=this.pointerY;
                    self._pressSpeed=Math.abs(self.velocity)+Math.abs(self._scrollMomentum);
                    self._tappedCard=null;

                    var px=this.pointerX-(window.pageXOffset||0), py=this.pointerY-(window.pageYOffset||0);
                    for(var vi=0;vi<self.cards.length;vi++){
                        var vc=self.cards[vi];
                        if(!vc.classList.contains('card--video'))continue;
                        if(!vc._fullSrc)continue;
                        var rect=vc.getBoundingClientRect();
                        if(rect.width<10||rect.height<10)continue; /* skip tiny back cards */
                        var pad=30;
                        if(px>=rect.left-pad&&px<=rect.right+pad&&py>=rect.top-pad&&py<=rect.bottom+pad){
                            self._tappedCard=vc;
                            /* Brake ONLY when tapping video card — not every touch */
                            self.velocity=0;
                            self._scrollMomentum=0;
                            self.targetAngle=self.currentAngle;
                            break;
                        }
                    }

                    self._wakeTicker(); self.isDragging=true;
                    self._invalidateHoverRectCache();
                    self._sectionEl.classList.add('is-dragging');
                    self.isSnapping=false; self._radiusTarget=self._radiusExpand;
                    document.body.style.userSelect='none';
                    if(self._hoveredCardIdx>=0&&self._hoverTimelines[self._hoveredCardIdx]) self._hoverTimelines[self._hoveredCardIdx].reverse();
                    if(self._hoveredCardIdx>=0){var dragPb=self.cards[self._hoveredCardIdx]._playBtn;if(dragPb)dragPb.leaveHover();}
                    self._hoveredCardIdx=-1; self.velocitySamples=[];
                    self._lastDragX=this.x; self._lastDragTime=performance.now();
                },
                onDrag:function(){
                    var dx=this.x-self._lastDragX; var now=performance.now(); var dt=now-self._lastDragTime;
                    
                    self._lastDragX=this.x; self._lastDragTime=now;
                    self.targetAngle+=dx*self.config.dragSensitivity;
                    if(dt>0){
                        var iv=(dx*self.config.dragSensitivity)/(dt/16.67);
                        var lv=self.velocitySamples.length>0?self.velocitySamples[self.velocitySamples.length-1]:iv;
                        self.velocitySamples.push(0.8*iv+0.2*lv);
                        if(self.velocitySamples.length>5)self.velocitySamples.shift();
                    }
                },
                onRelease:function(){
                    self.isDragging=false;
                    self._invalidateHoverRectCache();
                    self._sectionEl.classList.remove('is-dragging');
                    document.body.style.userSelect=''; self._radiusTarget=self._radiusBase;

                    /* === TAP VS DRAG: 15px threshold === */
                    var dx=Math.abs(this.pointerX-self._pressX);
                    var dy=Math.abs(this.pointerY-self._pressY);
                    var isTap=dx<15&&dy<15;

                    if(!isTap&&self.velocitySamples.length>0){
                        var sum=0; for(var i=0;i<self.velocitySamples.length;i++) sum+=self.velocitySamples[i];
                        self.velocity=sum/self.velocitySamples.length; self._clampVel();
                    }
                    if(Math.abs(self.velocity)<self.config.velocityThreshold&&self.config.snapEnabled) self.isSnapping=true;
                    gsap.set(proxy,{x:0}); self._lastDragX=0;

                    /* === OPEN VIDEO POPUP (Wistia) === */
                    if(isTap&&self._revealComplete&&self._tappedCard){
                        var popup=$id('onas-video-popup');
                        if(popup&&!popup.classList.contains('is-open')){
                            var fs=self._tappedCard._fullSrc;
                            if(fs&&String(fs).indexOf('__wistia_')===0){
                                var wp=popup.querySelector('wistia-player');
                                if(wp){
                                    /* Recreate player node on each open so autoplay attribute
                                       is applied during fresh initialization. */
                                    var freshWp = wp.cloneNode(false);
                                    freshWp.setAttribute('autoplay', 'true');
                                    wp.replaceWith(freshWp);
                                    wp = freshWp;
                                    self.velocity=0;
                                    self.targetAngle=self.currentAngle;
                                    wp.setAttribute('autoplay', 'true');
                                    popup.classList.add('is-open');
                                    document.body.style.overflow='hidden';
                                    ensurePopupWistiaLoaded()
                                        .then(function() {
                                            var tries = 0;
                                            var maxTries = 8;
                                            var attemptPlay = function() {
                                                tries++;
                                                var currentWp = popup.querySelector('wistia-player');
                                                if (currentWp && typeof currentWp.play === 'function') {
                                                    currentWp.play().catch(function(){});
                                                    return;
                                                }
                                                if (tries < maxTries) {
                                                    window.setTimeout(attemptPlay, 120);
                                                }
                                            };
                                            attemptPlay();
                                        })
                                        .catch(function(){});
                                }
                            }
                        }
                    }
                    self._tappedCard=null;
                }
            })[0];
            gsapInstances.push(this._draggableInstance);

            this.lastTime=performance.now();
            gsap.ticker.lagSmoothing(0);
            tickFn=this._bT; gsap.ticker.add(tickFn); ticking=true; this._tickerActive=true;
        };

        E.prototype._sleepTicker=function(){
            if(!this._tickerActive) return;
            this._tickerActive=false; this._pausedAt=performance.now(); gsap.ticker.remove(this._bT);
        };
        E.prototype._wakeTicker=function(){
            if(this._tickerActive) return;
            this._tickerActive=true;
            if(this._pausedAt>0&&this.autoplayActive){
                var elapsed=(performance.now()-this._pausedAt)/1000;
                var catchUp=this.config.autoplaySpeed*elapsed;
                this.targetAngle+=catchUp; this.currentAngle+=catchUp;
            }
            this._pausedAt=0; this._scrollMomentum=0; this._scrollVel=0; this.lastScrollY=getRawScroll();
            if(this._hoveredCardIdx>=0&&this._hoverTimelines[this._hoveredCardIdx]) this._hoverTimelines[this._hoveredCardIdx].reverse();
            if(this._hoveredCardIdx>=0){var wakePb=this.cards[this._hoveredCardIdx]._playBtn;if(wakePb)wakePb.leaveHover();}
            this._hoveredCardIdx=-1; gsap.ticker.add(this._bT); this._idleFrames=0;
            for(var i=0;i<this._lastWrittenScale.length;i++){this._lastWrittenScale[i]=-1;this._lastWrittenBr[i]=-1;this._lastGlowLevel[i]=-1;}
        };

        var HOVER_STYLES=[
            {elems:3,stagger:-0.12,initialScale:1.5,duration:0.6,ease:'power2.inOut',animate:'scale',origin:'50% 50%'},
            {elems:4,stagger:-0.1,initialScale:2,duration:0.6,ease:'power2.inOut',animate:'scale',origin:'50% 50%'},
            {elems:5,stagger:-0.1,initialScale:2,duration:0.6,ease:'power2.inOut',animate:'scaleX',origin:'0% 50%'},
            {elems:4,stagger:-0.1,initialScale:1.8,duration:0.6,ease:'power2.inOut',animate:'scaleY',origin:'50% 0%'}
        ];

        E.prototype.renderCards=function(c,base,dup){
            c.innerHTML=''; var total=base*dup; this.cardCount=total; this.cardAngle=360/total;
            c.style.setProperty('--n',total);
            if(this._hoverTimelines){for(var h=0;h<this._hoverTimelines.length;h++){if(this._hoverTimelines[h])this._hoverTimelines[h].kill();}}
            if(this._hoverListeners){for(var hl=0;hl<this._hoverListeners.length;hl++){var li=this._hoverListeners[hl];if(li.type==='pointermove')li.el.removeEventListener('pointermove',li.enter);else if(li.type==='pointerleave')li.el.removeEventListener('pointerleave',li.leave);else{li.el.removeEventListener('mouseenter',li.enter);li.el.removeEventListener('mouseleave',li.leave);}}}
            this._hoverTimelines=[]; this._hoverListeners=[]; this._cardStyleIdx=[];
            var PEOPLE_MEDIA = [
                '/assets/people/adam.webp',
                '/assets/people/iwona.webp',
                '/assets/people/jakub.webp',
                '/assets/people/mariusz.mp4',
                '/assets/people/kinga.webp',
                '/assets/people/marta.webp',
                '/assets/people/paulina.webp'
            ];
            /* Per-card media: 1 asset (image/video) per base card.
               Bez /_next/image w url() — query (&w, &q) potrafi psuć background-image w części przeglądarek. */
            var _bgCache=new Array(base);
            for(var bi=0;bi<base;bi++){
                var mediaPath=PEOPLE_MEDIA[bi%PEOPLE_MEDIA.length];
                var posterPath=(mediaPath&&mediaPath.toLowerCase().endsWith('.mp4'))
                    ? PEOPLE_MEDIA[0]
                    : mediaPath;
                _bgCache[bi]='url("'+posterPath+'")';
            }
            /* VIDEO CARD: loop MP4 na kafelku; tap → popup Wistia (fullSrc) */
            var VIDEO_CARD={
                baseIdx: 3,
                src: '/assets/people/mariusz.mp4',
                fullSrc: '__wistia_fds00b5wst__',
                poster: _bgCache[3]
            };
            this._videoBaseIdx=VIDEO_CARD.baseIdx;
            for(var i=0;i<total;i++){
                var d=document.createElement('div'); d.className='card'; d.style.setProperty('--i',i);
                d.style.opacity='0'; /* CASCADE REVEAL: invisible until animated */
                var baseIdx=i%base; var style=HOVER_STYLES[baseIdx%4]; var numLayers=style.elems;
                var isVideo=(baseIdx===VIDEO_CARD.baseIdx);
                if(isVideo){
                    /* VIDEO CARD: poster + <video> loop + play → popup Wistia */
                    d.classList.add('card--video');
                    var innerHTML='<div class="card__wrap"><div class="card__layer"></div></div>';
                    innerHTML+='<video muted loop playsinline preload="none"'+(VIDEO_CARD.src?' src="'+VIDEO_CARD.src+'"':'')+'></video>';
                    d.innerHTML=innerHTML;
                    d.querySelector('.card__layer').style.backgroundImage=VIDEO_CARD.poster;
                    /* Avoid forced layout read (offsetWidth) during card creation. */
                    var pb=createPlayButton(d, 66);
                    d._playBtn=pb;
                    d._fullSrc=VIDEO_CARD.fullSrc;
                    var vid=d.querySelector('video');
                    if(vid){
                        vid.addEventListener('timeupdate',function(){
                            if(vid.duration>0) pb.updateProgress(vid.currentTime/vid.duration);
                        });
                    }
                } else {
                    /* NORMAL CARD: bg-image layers + hover parallax */
                    var bgUri=_bgCache[baseIdx]; var innerHTML='';
                    innerHTML+='<div class="card__wrap"><div class="card__layer"></div></div>';
                    for(var j=1;j<numLayers;j++) innerHTML+='<div class="card__layer hover-layer"></div>';
                    d.innerHTML=innerHTML;
                    var allLayers=d.querySelectorAll('.card__layer');
                    for(var l=0;l<allLayers.length;l++) allLayers[l].style.backgroundImage=bgUri;
                }
                c.appendChild(d);
            }
            this.cards=Array.prototype.slice.call(c.querySelectorAll('.card'));
            this._hoverRectCache=new Array(total); this._hoverRectCacheTs=0;
            this.cardScaleValues=new Array(total); this._lastWrittenScale=new Array(total);
            this._lastWrittenBr=new Array(total); this._isVisible=new Array(total);
            for(var j2=0;j2<total;j2++){this.cardScaleValues[j2]=1.0;this._lastWrittenScale[j2]=-1;this._lastWrittenBr[j2]=-1;this._isVisible[j2]=true;}
            this._cardStaticRY=new Array(total);
            for(var k=0;k<total;k++) this._cardStaticRY[k]=(k*360/total).toFixed(4);
            this._halfAngleDeg=(180/total).toFixed(6);
            this._tanHalf=Math.tan(Math.PI/total);
            this._lastGlowLevel=new Array(total); this._wasFront=new Array(total); this._wasGlowActive=new Array(total);
            for(var m=0;m<total;m++){this._lastGlowLevel[m]=-1;this._wasFront[m]=false;this._wasGlowActive[m]=false;}
            // CASCADE REVEAL: init hidden
            this._revealState=new Array(total);
            for(var rv=0;rv<total;rv++) this._revealState[rv]={y:-160,opacity:0};
            this._revealTriggered=false; this._revealComplete=false;
            this._glowDirty=true; this._idleFrames=0;
            this._initHoverEffects(base);
        };

        E.prototype._initHoverEffects=function(base){
            var self=this; this._hoveredCardIdx=-1; this._cardStyleIdx=[];
            for(var i=0;i<this.cards.length;i++){
                var card=this.cards[i]; var baseIdx=i%base; var styleIdx=baseIdx%4;
                var style=HOVER_STYLES[styleIdx]; this._cardStyleIdx.push(styleIdx);
                var layers=card.querySelectorAll('.card__layer');
                var isVideoCard=card.classList.contains('card--video');
                if(isVideoCard){
                    /* VIDEO CARD: overlay fade only (play btn driven from _processHover) */
                    gsap.set(card,{transformOrigin:'50% 50%','--overlay-opacity':1});
                    var vtl=gsap.timeline({paused:true,
                        onReverseComplete:(function(c){return function(){c.classList.remove('is-hovered');};})(card)
                    }).to(card,{'--overlay-opacity':0,duration:0.5,ease:'power2.inOut'},0);
                    this._hoverTimelines.push(vtl); gsapInstances.push(vtl);
                    continue;
                }
                if(layers.length<2){this._hoverTimelines.push(null);continue;}
                gsap.set(card,{transformOrigin:'50% 50%','--overlay-opacity':1});
                gsap.set(layers,{transformOrigin:style.origin});
                var prop=style.animate; var setProps={}; setProps[prop]=style.initialScale;
                var toProps={duration:style.duration,ease:style.ease,stagger:style.stagger};
                toProps[prop]=function(idx){return +!idx;};
                var tl=gsap.timeline({paused:true,
                    onReverseComplete:(function(c){return function(){c.classList.remove('is-hovered');};})(card)
                }).set(layers[0],setProps).to(layers,toProps,0).to(card,{'--overlay-opacity':0,duration:style.duration,ease:style.ease},0);
                this._hoverTimelines.push(tl); gsapInstances.push(tl);
            }
            var section=$id('onas-carousel');
            var HOVER_MOVE_EPSILON=1;
            var passivePointerOpts={passive:true};
            var onMove=function(e){
                if(e.pointerType!=='mouse')return;
                if(self._lastHoverMoveX>=0&&self._lastHoverMoveY>=0){
                    if(Math.abs(e.clientX-self._lastHoverMoveX)<HOVER_MOVE_EPSILON&&Math.abs(e.clientY-self._lastHoverMoveY)<HOVER_MOVE_EPSILON)return;
                }
                self._lastHoverMoveX=e.clientX; self._lastHoverMoveY=e.clientY;
                self._pendingHoverX=e.clientX;self._pendingHoverY=e.clientY;self._hoverDirty=true;self._hoverPointerIsMouse=true;self._hoverLeft=false;
            };
            var onLeave=function(e){self._hoverLeft=true;self._hoverDirty=true;};
            section.addEventListener('pointermove',onMove,passivePointerOpts); section.addEventListener('pointerleave',onLeave);
            this._hoverListeners.push({el:section,enter:onMove,leave:onLeave,type:'pointermove'},{el:section,enter:null,leave:onLeave,type:'pointerleave'});
            hfListeners.push({el:section,type:'pointermove',fn:onMove,options:passivePointerOpts},{el:section,type:'pointerleave',fn:onLeave,options:undefined});
        };

        E.prototype._invalidateHoverRectCache=function(){
            this._hoverRectCacheTs=0;
            if(this._hoverRectCache&&this._hoverRectCache.length){
                for(var hi=0;hi<this._hoverRectCache.length;hi++) this._hoverRectCache[hi]=null;
            }
        };

        E.prototype._processHover=function(){
            if(!this._hoverDirty||!this._revealComplete)return; this._hoverDirty=false;
            if(this._hoverLeft){this._hoverLeft=false;if(this._hoveredCardIdx>=0){if(this._hoverTimelines[this._hoveredCardIdx])this._hoverTimelines[this._hoveredCardIdx].reverse();var leavePb=this.cards[this._hoveredCardIdx]._playBtn;if(leavePb)leavePb.leaveHover();}this._hoveredCardIdx=-1;return;}
            if(this.isDragging)return;
            var mx=this._pendingHoverX,my=this._pendingHoverY; if(mx<0)return;
            var now=performance.now();
            var useCachedRects=(now-this._hoverRectCacheTs)<this._hoverRectCacheTtl;
            if(!useCachedRects){this._hoverRectCacheTs=now;}
            var bestIdx=-1,bestDist=Infinity,bestRect=null;
            for(var c=0;c<this.cards.length;c++){
                if(!this._wasFront[c])continue;
                var rect=useCachedRects?this._hoverRectCache[c]:null;
                if(!rect){
                    rect=this.cards[c].getBoundingClientRect();
                    this._hoverRectCache[c]=rect;
                }
                if(rect.width<2||rect.height<2)continue;
                var pad=8;
                if(mx>=rect.left-pad&&mx<=rect.right+pad&&my>=rect.top-pad&&my<=rect.bottom+pad){
                    var cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
                    var dist=(mx-cx)*(mx-cx)+(my-cy)*(my-cy);
                    if(dist<bestDist){bestDist=dist;bestIdx=c;bestRect=rect;}
                }
            }
            if(bestIdx!==this._hoveredCardIdx){
                /* Leave old card */
                if(this._hoveredCardIdx>=0){
                    if(this._hoverTimelines[this._hoveredCardIdx])this._hoverTimelines[this._hoveredCardIdx].reverse();
                    var oldPb=this.cards[this._hoveredCardIdx]._playBtn;
                    if(oldPb) oldPb.leaveHover();
                }
                this._hoveredCardIdx=bestIdx;
                /* Enter new card */
                if(bestIdx>=0&&this._hoverTimelines[bestIdx]){
                    this.cards[bestIdx].classList.add('is-hovered');
                    if(this._cardStyleIdx[bestIdx]===2&&bestRect){var card=this.cards[bestIdx];var cardCenterX=bestRect.left+bestRect.width/2;var screenCenterX=document.documentElement.clientWidth/2;var layers=card.querySelectorAll('.card__layer');var newOrigin=(cardCenterX>screenCenterX)?'100% 50%':'0% 50%';gsap.set(layers,{transformOrigin:newOrigin});}
                    this._hoverTimelines[bestIdx].play();
                    var newPb=this.cards[bestIdx]._playBtn;
                    if(newPb) newPb.enterHover();
                }
            }
        };

        E.prototype._clampVel=function(){var mv=this.config.maxVelocity;if(this.velocity>mv)this.velocity=mv;if(this.velocity<-mv)this.velocity=-mv;};

        E.prototype._onWheel=function(e){
            if(!this._revealComplete)return;
            if(Math.abs(e.deltaX)>Math.abs(e.deltaY)){
                e.preventDefault(); this._wakeTicker(); this.isSnapping=false;
                var mult=1; if(e.deltaMode===1)mult=40; if(e.deltaMode===2)mult=800;
                this.velocity+=e.deltaX*mult*this.config.wheelSensitivity*0.01; this._clampVel();
            }
        };

        E.prototype._onK=function(e){
            if(!this._revealComplete)return;
            var dir=0;
            if(e.key==='ArrowLeft'||e.key==='ArrowUp')dir=-1;
            if(e.key==='ArrowRight'||e.key==='ArrowDown')dir=1;
            if(dir!==0){e.preventDefault();this._wakeTicker();var ni=this._ni()+dir;this.targetAngle=-ni*this.cardAngle;this.velocity=0;this.isSnapping=true;}
        };

        E.prototype._ni=function(){return Math.round(-this.targetAngle/this.cardAngle)};

        E.prototype._snap=function(dt){
            var ni=Math.round(-this.targetAngle/this.cardAngle),st=-ni*this.cardAngle,disp=this.targetAngle-st;
            var f=-this.config.snapStiffness*disp-this.config.snapDamping*this.velocity;
            this.velocity+=(f/this.config.mass)*dt; this._clampVel(); this.targetAngle+=this.velocity*dt;
            if(Math.abs(disp)<0.01&&Math.abs(this.velocity)<0.01){this.targetAngle=st;this.velocity=0;this.isSnapping=false;this.glowTimer=0.5;}
        };

        E.prototype._tick=function(time,deltaTime){
            var dMs=Math.min(deltaTime,50),dt=dMs/1000,dt60=dt*60;
            if(this.reducedMotion){if(this.a3dElement)this.a3dElement.style.transform='translateZ(var(--camera-dist)) translateY(calc(var(--pos-y-user) + var(--pos-y-auto))) scale(var(--zoom)) rotateX(var(--tilt)) rotateY('+this.currentAngle+'deg)';this._uc(0);return;}
            this._processHover();
            var sy=getRawScroll(),sd=sy-this.lastScrollY;this.lastScrollY=sy;
            var scrollSmooth=Math.pow(0.8,dt60);
            this._scrollVel=this._scrollVel*scrollSmooth+sd*(1-scrollSmooth);
            if(this.isInView&&Math.abs(this._scrollVel)>0.3) this._scrollMomentum+=this._scrollVel*this.config.scrollInfluence;
            var maxM=this.config.scrollMaxMomentum;
            if(Math.abs(this._scrollMomentum)>0.001) this._scrollMomentum=maxM*Math.tanh(this._scrollMomentum/maxM);
            this._scrollMomentum*=Math.exp(-dt/this.config.scrollTimeConstant);
            if(Math.abs(this._scrollMomentum)<0.0005)this._scrollMomentum=0;
            var autoplayDelta=0;
            if(this.autoplayActive&&!this.isDragging){autoplayDelta=this.config.autoplaySpeed*dt;this.targetAngle+=autoplayDelta;}
            this.targetAngle+=this._scrollMomentum*dt60;
            if(!this.isDragging&&!this.isSnapping){
                if(Math.abs(this.velocity)>0.001){
                    this.targetAngle+=this.velocity*dt60;
                    this.velocity*=Math.pow(this.config.friction,dt60);
                    if(Math.abs(this.velocity)<this.config.velocityThreshold&&this.config.snapEnabled) this.isSnapping=true;
                    if(Math.abs(this.velocity)<0.02) this.velocity=0;
                }
            }
            if(this.isSnapping)this._snap(dt);
            var lerpFactor=1-Math.pow(1-this.config.lerp,dt60);
            this.currentAngle+=(this.targetAngle-this.currentAngle)*lerpFactor;
            this.currentAngle+=autoplayDelta;
            if(Math.abs(this._radiusCurrent-this._radiusTarget)>0.001){this._radiusCurrent+=(this._radiusTarget-this._radiusCurrent)*Math.min(1,dt*5);this.sceneElement.style.setProperty('--radius-mult',this._radiusCurrent.toFixed(4));}
            if(this.a3dElement) this.a3dElement.style.transform='translateZ(var(--camera-dist)) translateY(calc(var(--pos-y-user) + var(--pos-y-auto))) scale(var(--zoom)) rotateX(var(--tilt)) rotateY('+this.currentAngle+'deg)';
            var absVel=Math.abs(this.velocity)+Math.abs(this._scrollMomentum);
            if(this.glowTimer>0){this.glowTimer-=dt;if(this.glowTimer<0)this.glowTimer=0;}
            var angleDelta=Math.abs(this.currentAngle-this._lastCurrentAngle);
            var radiusAnimating=Math.abs(this._radiusCurrent-this._radiusTarget)>0.001;
            this._ucAccum+=dMs;
            if(this._ucAccum>=this._ucInterval){
                this._ucAccum=0;
                if(absVel>0.01||angleDelta>0.05||this._idleFrames<3||this.glowTimer>0||radiusAnimating){
                    this._uc(absVel); this._lastAbsVel=absVel; this._lastCurrentAngle=this.currentAngle;
                    if(absVel<0.01&&angleDelta<0.05) this._idleFrames++; else this._idleFrames=0;
                }
            }
        };

        var GLOW_PRESETS={
            'terracotta-soft':[{blur:3,spread:0.5,c:[196,129,107],a:0.5},{blur:6,spread:1,c:[212,165,116],a:0.2}],
            'terracotta-fire':[{blur:2.5,spread:0.8,c:[196,129,107],a:0.7},{blur:5,spread:1.5,c:[212,165,116],a:0.35},{blur:8,spread:2,c:[196,129,107],a:0.15}],
            'golden-haze':[{blur:3,spread:1,c:[212,165,116],a:0.65},{blur:6,spread:2,c:[212,165,116],a:0.3},{blur:2,spread:0,c:[212,165,116],a:0.1,inset:true}],
            'ember':[{blur:2,spread:0.5,c:[196,129,107],a:0.8},{blur:4,spread:1,c:[180,90,60],a:0.4},{blur:8,spread:2,c:[139,125,107],a:0.2}],
            'sunset-ring':[{ring:4,c:[196,129,107],a:0.7},{blur:2,spread:0.5,c:[212,165,116],a:0.5},{blur:5,spread:1.5,c:[196,129,107],a:0.25}],
            'gold-ring':[{ring:2,c:[212,165,116],a:0.75},{blur:3,spread:1,c:[212,165,116],a:0.55},{blur:6,spread:2,c:[212,165,116],a:0.25},{blur:2,spread:0,c:[212,165,116],a:0.1,inset:true}],
            'gold-ring-2':[{ring:2.5,c:[235,200,110],a:0.85},{blur:3,spread:1.5,c:[212,175,90],a:0.6},{blur:2,spread:0,c:[235,200,110],a:0.35,inset:true},{blur:6,spread:2.5,c:[190,155,60],a:0.15}]
        };
        var BASE_SHADOW='0 0 2em rgba(0,0,0,0.4)';
        function hexToRgb(hex){hex=hex.replace('#','');if(hex.length===3)hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];var n=parseInt(hex,16);return[(n>>16)&255,(n>>8)&255,n&255];}
        function buildGlow(preset,f,gs,oY,colOvr){var p=[];for(var i=0;i<preset.length;i++){var l=preset[i],a=(l.a*f).toFixed(3);var c=colOvr||l.c;var col='rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';if(l.ring){p.push('0 '+oY.toFixed(1)+'em 0 '+(l.ring*f*gs).toFixed(1)+'px '+col);}else{var pre=l.inset?'inset ':'';p.push(pre+'0 '+oY.toFixed(1)+'em '+(l.blur*gs).toFixed(2)+'em '+((l.spread||0)*gs).toFixed(2)+'em '+col);}}return p.join(', ');}

        E.prototype._uc=function(absVel){
            var n=this.cards.length;if(!n)return;
            var os=this.config.opacitySpread;var ftNorm=this.config.frontZoneDeg/180;var boost=this.config.frontScale-1;
            var glowPreset=GLOW_PRESETS[this._activeGlow]||null;var gs=this.config.glowScale;var oY=this.config.glowOffsetY;
            var colOvr=this._glowColorRgb;var scaleEma=this.config.scaleEma;var thresh=this.glowThreshold;
            var pulseActive=this.glowTimer>0;var pulseIntensity=pulseActive?Math.min(this.glowTimer/0.3,1):0;
            var breathe=Math.min(absVel*0.003,0.02);var lean=this.velocity*0.15;lean=Math.max(-3,Math.min(3,lean));
            var velDir=this.velocity>0.01?1:(this.velocity<-0.01?-1:0);
            var breatheFactor=(1+breathe);
            var tzPart=' translateZ(calc(var(--z-sign) * '+breatheFactor+' * var(--radius-mult) * (.5 * var(--card-width) + .5rem) / '+this._tanHalf.toFixed(6)+'))';
            var rxPart=' rotateX(calc(var(--card-xtilt) + '+lean.toFixed(2)+'deg))';
            if(this._glowDirty){
                for(var g=0;g<n;g++)this._lastGlowLevel[g]=-1;this._glowDirty=false;
                if(glowPreset){var lut={};lut[0]=BASE_SHADOW;for(var lvl=1;lvl<=37;lvl++)lut[lvl]=BASE_SHADOW+', '+buildGlow(glowPreset,(lvl-1)/20,gs,oY,colOvr);for(var nlvl=-1;nlvl>=-3;nlvl--)lut[nlvl]=BASE_SHADOW+', '+buildGlow(glowPreset,(-nlvl-1)/20,gs,oY,colOvr);this._glowLUT=lut;}else{this._glowLUT=null;}
            }
            var frameBreathe=breatheFactor,frameLean=lean;
            var frameDirty=(Math.abs(frameBreathe-this._lastFrameBreatheLean[0])>0.0001||Math.abs(frameLean-this._lastFrameBreatheLean[1])>0.001);
            if(frameDirty){this._lastFrameBreatheLean[0]=frameBreathe;this._lastFrameBreatheLean[1]=frameLean;for(var fd=0;fd<n;fd++)this._lastWrittenScale[fd]=-1;}
            var revealing=!this._revealComplete;
            for(var i=0;i<n;i++){
                var ba=i*this.cardAngle,ra=((ba+this.currentAngle)%360+540)%360-180;
                var shouldBeVisible=Math.abs(ra)<95;
                if(shouldBeVisible!==this._isVisible[i]){this._isVisible[i]=shouldBeVisible;this.cards[i].style.visibility=shouldBeVisible?'visible':'hidden';if(!shouldBeVisible){this._lastWrittenScale[i]=-1;this._lastWrittenBr[i]=-1;this._lastGlowLevel[i]=-1;}
                    /* VIDEO CARD: play/pause on visibility change */
                    if(this.cards[i].classList.contains('card--video')){var vid=this.cards[i].querySelector('video');if(vid&&vid.src){if(shouldBeVisible&&this._revealComplete){vid.play().catch(function(){});vid.classList.add('is-playing');}else{vid.pause();vid.classList.remove('is-playing');}}}
                }
                if(!shouldBeVisible)continue;
                var pr=Math.abs(ra)/180;var t=pr/ftNorm;if(t>1)t=1;
                var frontness=this._easingFn(t,ra,velDir,ftNorm);
                var halfStep=(this.cardAngle/2)/this.config.frontZoneDeg;var tSync=Math.min(1,t/halfStep*0.5);
                var scaleF=Math.max(0,Math.min(1,1-tSync*tSync*(3-2*tSync)));var targetScale=1+boost*scaleF;
                this.cardScaleValues[i]+=(targetScale-this.cardScaleValues[i])*scaleEma;var sc=this.cardScaleValues[i];
                /* CASCADE REVEAL: read state + apply */
                var ry=0,ro=1;
                if(revealing&&this._revealState[i]){
                    ry=this._revealState[i].y;
                    ro=this._revealState[i].opacity;
                    this.cards[i].style.opacity=ro.toFixed(3);
                }
                /* Transform: force write every frame during reveal (ry changes), normal gate after */
                if(revealing||Math.abs(sc-this._lastWrittenScale[i])>0.0005){
                    this._lastWrittenScale[i]=sc;
                    var ryPart=ry!==0?' translateY('+ry.toFixed(1)+'px)':'';
                    this.cards[i].style.transform='rotateY('+this._cardStaticRY[i]+'deg)'+tzPart+ryPart+rxPart+' scale('+sc.toFixed(4)+')';
                }
                /* During reveal: skip brightness, glow, hover classes — everything waits */
                if(revealing) continue;
                var br=0.92+frontness*0.16;
                if(Math.abs(br-this._lastWrittenBr[i])>0.0005){this._lastWrittenBr[i]=br;this.cards[i].style.filter='brightness('+br.toFixed(3)+')';}
                var isFrontGlow=frontness>thresh;
                if(isFrontGlow!==this._wasFront[i]){this._wasFront[i]=isFrontGlow;if(isFrontGlow)this.cards[i].classList.add('is-front');else this.cards[i].classList.remove('is-front');}
                var wantGlowActive=pulseActive&&isFrontGlow;
                if(wantGlowActive!==this._wasGlowActive[i]){this._wasGlowActive[i]=wantGlowActive;if(wantGlowActive)this.cards[i].classList.add('glow-active');else this.cards[i].classList.remove('glow-active');}
                var glowLevel;
                if(!glowPreset){glowLevel=0;}else if(isFrontGlow){var glowF=scaleF*1.4;if(pulseActive)glowF=Math.min(1.8,glowF+pulseIntensity*0.4);glowLevel=1+Math.round(Math.min(glowF,1.8)*20);}else if(frontness>0.05){glowLevel=-(1+Math.round(frontness*0.12*20));}else{glowLevel=0;}
                if(glowLevel!==this._lastGlowLevel[i]){this._lastGlowLevel[i]=glowLevel;this.cards[i].style.boxShadow=this._glowLUT?this._glowLUT[glowLevel]||BASE_SHADOW:BASE_SHADOW;}
            }
        };

        E.prototype.toggleAutoplay=function(){this.autoplayActive=!this.autoplayActive;return this.autoplayActive;};
        E.prototype.updateConfig=function(k,v){
            if(k==='snapEnabled')this.config.snapEnabled=(v==='1'||v===true||v===1);
            else if(k==='frontEasing'||k==='glowColor')this.config[k]=v;
            else this.config[k]=parseFloat(v);
            if(k==='frontEasing')this._bindEasing(v);
            if(k==='glowColor')this._glowColorRgb=v?hexToRgb(v):null;
            if(k==='glowColor'||k==='glowScale'||k==='glowOffsetY')this._glowDirty=true;
        };

        /* ══════════════════════════════════════════════════
           CASCADE REVEAL — cards fall in while carousel rotates
           Autoplay + scroll momentum: ACTIVE (natural rhythm)
           Hover, drag, keyboard, glow: BLOCKED until complete
           ══════════════════════════════════════════════════ */
        E.prototype.startCascadeReveal=function(){
            if(this._revealTriggered)return;
            this._revealTriggered=true;
            this._wakeTicker(); // ensure _uc runs

            // Disable drag during reveal
            if(this._draggableInstance)this._draggableInstance.disable();

            var self=this;
            var n=this.cards.length;

            // Sort indices: left-to-right (most negative angle = leftmost)
            var indices=[];
            for(var i=0;i<n;i++) indices.push(i);
            indices.sort(function(a,b){
                var raA=((self._cardStaticRY[a]*1+self.currentAngle)%360+540)%360-180;
                var raB=((self._cardStaticRY[b]*1+self.currentAngle)%360+540)%360-180;
                return raB-raA;
            });

            // Build staggered timeline
            this._revealTimeline=gsap.timeline({
                onComplete:function(){
                    self._revealComplete=true;
                    // Re-enable drag
                    if(self._draggableInstance)self._draggableInstance.enable();
                    // Clean up inline opacity + force full repaint
                    for(var c=0;c<n;c++){
                        self.cards[c].style.opacity='';
                        self._lastWrittenScale[c]=-1;
                        self._lastWrittenBr[c]=-1;
                        self._lastGlowLevel[c]=-1;
                    }
                    self._glowDirty=true;
                    self._idleFrames=0;
                    /* Start visible video cards after reveal + trigger play-btn slide-in */
                    for(var v=0;v<n;v++){
                        if(self.cards[v].classList.contains('card--video')){
                            self.cards[v].classList.add('reveal-done');
                            if(self._isVisible[v]){
                                var vid=self.cards[v].querySelector('video');
                                if(vid&&vid.src){vid.play().catch(function(){});vid.classList.add('is-playing');}
                            }
                        }
                    }
                }
            });
            gsapInstances.push(this._revealTimeline);

            for(var j=0;j<n;j++){
                var idx=indices[j];
                this._revealTimeline.to(
                    this._revealState[idx],
                    {y:0, opacity:1, duration:0.9, ease:'power3.out'},
                    j*0.06
                );
            }
        };

        E.prototype.resetReveal=function(){
            var n=this.cards.length;
            if(this._revealTimeline){this._revealTimeline.kill();this._revealTimeline=null;}
            this._revealTriggered=false;
            this._revealComplete=false;
            if(this._draggableInstance)this._draggableInstance.disable();
            for(var i=0;i<n;i++){
                this._revealState[i]={y:-160,opacity:0};
                this.cards[i].style.opacity='';
                this._lastWrittenScale[i]=-1;
                /* Pause video cards */
                var vid=this.cards[i].querySelector('video');
                if(vid){vid.pause();vid.classList.remove('is-playing');}
                this.cards[i].classList.remove('reveal-done');
            }
            this._idleFrames=0;
            window.scrollTo({top:0,behavior:'smooth'});
        };

        return E;
    })();

    var engine = new CarouselEngine();
    var carouselEl = $id('onas-inner');
    if(!carouselEl) { 
        console.warn('onas: carousel inner not found'); 
        return { pause:function(){}, resume:function(){}, kill:function(){} }; 
    }
    engine.renderCards(carouselEl, 7, 3);
    /* INIT ASAP: do not block carousel startup on background image decode. */
    engine.init(carouselEl, $id('onas-scene'));
    /* Defer heavy background preload so first carousel frames stay responsive. */
    var deferredPreloadTimer=0;
    var deferredPreloadIdleId=0;
    var deferLayerPreload=function(){
        var runPreload=function(){preloadCardImages('.card__layer');};
        if(typeof window.requestIdleCallback==='function'){
            deferredPreloadIdleId=window.requestIdleCallback(runPreload,{timeout:1500});
        }else{
            deferredPreloadTimer=setTimeout(runPreload,1200);
        }
    };
    deferLayerPreload();
    engine._activeGlow = 'gold-ring'; engine._glowDirty = true;
    engine.config.frontEasing = 'pulse'; engine._bindEasing('pulse');

    /* ── CASCADE REVEAL: IntersectionObserver + fallbacks
       Previously rootMargin included -10% bottom, shrinking the IO root — isIntersecting
       could stay false while #onas-carousel was visibly on screen → cards stuck at opacity 0.
       Fallback: browsers without IO; delayed bbox check if IO never fires. */
    var revealTarget=$id('onas-scene');
    if(window.IntersectionObserver&&revealTarget){
        var revealIO=new IntersectionObserver(function(entries){
            if(entries[0]?.isIntersecting&&!engine._revealTriggered){
                engine.startCascadeReveal();
            }
        },{root:null,rootMargin:'200px 0px 0px 0px',threshold:0});
        revealIO.observe(revealTarget);
        observers.push(revealIO);
    } else if(revealTarget){
        engine.startCascadeReveal();
    }
    if(revealTarget){
        var revealFallbackTid=setTimeout(function(){
            if(engine._revealTriggered||!revealTarget)return;
            var r=revealTarget.getBoundingClientRect();
            var vh=window.innerHeight||document.documentElement.clientHeight||800;
            if(r.bottom>0&&r.top<vh) engine.startCascadeReveal();
        },200);
        timerIds.push(revealFallbackTid);
    }

    /* ── VIDEO POPUP: close logic ── */
    var popup=$id('onas-video-popup');
    if(popup){
        var popupWistia=popup.querySelector('wistia-player');
        var popupClose=popup.querySelector('.popup-close');
        var popupCloseText=popup.querySelector('.popup-close-text');
        function closePopup(){
            popup.classList.remove('is-open');
            document.body.style.overflow='';
            var currentWp = popup.querySelector('wistia-player');
            if (currentWp) currentWp.removeAttribute('autoplay');
            if(currentWp && typeof currentWp.pause==='function'){
                try { currentWp.pause(); } catch(e){}
            }
        }
        /* Named handlers for cleanup */
        var onPopupBackdrop=function(e){ if(e.target===popup) closePopup(); };
        var onPopupEsc=function(e){ if(e.key==='Escape'&&popup.classList.contains('is-open')) closePopup(); };
        popup.addEventListener('click',onPopupBackdrop);
        if(popupClose) popupClose.addEventListener('click',closePopup);
        if(popupCloseText) popupCloseText.addEventListener('click',closePopup);
        document.addEventListener('keydown',onPopupEsc);
        cleanups.push(function(){
            popup.removeEventListener('click',onPopupBackdrop);
            if(popupClose) popupClose.removeEventListener('click',closePopup);
            if(popupCloseText) popupCloseText.removeEventListener('click',closePopup);
            document.removeEventListener('keydown',onPopupEsc);
        });
    }

    /* Stable viewport height — ignores mobile toolbar show/hide (<100px change) */
    var _stableVh=window.innerHeight;
    function getStableVh(){
        var raw=window.innerHeight;
        if(Math.abs(raw-_stableVh)>100) _stableVh=raw;
        return _stableVh;
    }

    function updateGalleryResponsive() {
        var vw = document.documentElement.clientWidth;
        var tilt;
        if(vw>=1520) tilt=Math.max(3,-0.00909*vw+20.82);
        else if(vw>=656) tilt=-0.01736*vw+33.4;
        else tilt=-0.00962*vw+28.3;
        var vh=getStableVh();
        var cardWidth=17.5; if(vw<800) cardWidth=Math.max(6,0.0024*vw+5.42);
        var perspective; if(vw>=800) perspective=65; else perspective=Math.max(26,0.065*vw+10.4);
        var radiusMult=vw<400?0.99:1.05;

        var root=container;
        var sceneEl=$id('onas-scene');
        root.style.setProperty('--tilt',tilt.toFixed(2)+'deg');
        root.style.setProperty('--card-width',cardWidth.toFixed(2)+'rem');
        root.style.setProperty('--card-radius',(cardWidth*0.086).toFixed(2)+'rem');
        root.style.setProperty('--perspective',perspective.toFixed(1)+'rem');
        if(sceneEl) sceneEl.style.setProperty('--radius-mult',radiusMult.toFixed(2));
        if(typeof engine!=='undefined'&&engine._radiusBase!==undefined){
            engine._radiusBase=radiusMult; engine._radiusExpand=radiusMult*1.106;
            engine._radiusCurrent=radiusMult; engine._radiusTarget=radiusMult;
        }
        var BASE_H=1111; var hDelta=BASE_H-vh; var posAuto=Math.max(0,Math.min(220,hDelta*0.5));
        root.style.setProperty('--pos-y-auto',posAuto.toFixed(1)+'px');
        /* ultrawide posY: tilt capped at 3° above vw~1960, cards need to go lower */
        /* -500 @ vw=1960  →  -670 @ vw=3440  (linear) */
        if(vw>1960){
            var posYu=Math.round(-500-(vw-1960)*0.1149);
            root.style.setProperty('--pos-y-user',posYu+'px');
        }

        /* FIX P1: Reference prawdziwego Capitana */
        var capitan=$id('onas-capitan');

        if(sceneEl){
            var maskValue;
            if(vw>=1200&&capitan){
                var rect=capitan.getBoundingClientRect();
                var maskStart=(rect.left/vw)*100; var maskEnd=(rect.right/vw)*100;
                var fadeWidth=12; var softStart=Math.max(0,maskStart-3); var softEnd=Math.min(100,maskEnd+3);
                maskValue='linear-gradient(90deg, '+
                    'rgba(255,0,0,0) 0%, rgba(255,0,0,0) '+softStart.toFixed(1)+'%, '+
                    'rgba(255,0,0,0.05) '+maskStart.toFixed(1)+'%, '+
                    'rgba(255,0,0,0.15) '+(maskStart+fadeWidth*0.2).toFixed(1)+'%, '+
                    'rgba(255,0,0,0.35) '+(maskStart+fadeWidth*0.4).toFixed(1)+'%, '+
                    'rgba(255,0,0,0.6) '+(maskStart+fadeWidth*0.6).toFixed(1)+'%, '+
                    'rgba(255,0,0,0.85) '+(maskStart+fadeWidth*0.8).toFixed(1)+'%, '+
                    'rgba(255,0,0,1) '+(maskStart+fadeWidth).toFixed(1)+'%, '+
                    'rgba(255,0,0,1) '+(maskEnd-fadeWidth).toFixed(1)+'%, '+
                    'rgba(255,0,0,0.85) '+(maskEnd-fadeWidth*0.8).toFixed(1)+'%, '+
                    'rgba(255,0,0,0.6) '+(maskEnd-fadeWidth*0.6).toFixed(1)+'%, '+
                    'rgba(255,0,0,0.35) '+(maskEnd-fadeWidth*0.4).toFixed(1)+'%, '+
                    'rgba(255,0,0,0.15) '+(maskEnd-fadeWidth*0.2).toFixed(1)+'%, '+
                    'rgba(255,0,0,0.05) '+maskEnd.toFixed(1)+'%, '+
                    'rgba(255,0,0,0) '+softEnd.toFixed(1)+'%, rgba(255,0,0,0) 100%)';
            } else {
                maskValue='linear-gradient(90deg, transparent, red 15% 85%, transparent)';
            }
            sceneEl.style.webkitMask=maskValue; sceneEl.style.mask=maskValue;
        }

        /* ── pressY + logogap: calibrated anchors + kv-scaled vh comp ── */
        var d=Math.max(0,1111-Math.min(vh,1111));
        var pressY;
        if(vw<=500){
            /* mobile: linear fit from post-overflow-fix calibration */
            pressY=Math.round(-485+0.70*d);
        } else {
            /* desktop: piecewise-linear base + kv-scaled quadratic comp */
            var anchX=[500,620,959,980,1252,1663,1731,1734,1929,3440];
            var anchY=[-485,-522,-398,-243,-321,-579,-565,-417,-513,-620];
            var base=-620;
            for(var i=0;i<9;i++){ if(vw<=anchX[i+1]){ var t=(vw-anchX[i])/(anchX[i+1]-anchX[i]); base=anchY[i]+t*(anchY[i+1]-anchY[i]); break; }}
            var kv;
            if(vw<=1252) kv=0.55;
            else if(vw<=1731) kv=0.55+(vw-1252)*0.000564;
            else kv=0.82;
            pressY=Math.round(base+kv*(1.76*d-0.00119*d*d));
        }
        var logogap=vw>=600?118:42;
        root.style.setProperty('--press-y',pressY+'px');
        root.style.setProperty('--logo-gap',logogap+'px');

        /* ── Anti-flash reveal (J7): show elements after first calc ── */
        if(sceneEl) sceneEl.style.visibility='visible';
        var pressEl=root.querySelector('.onas-press');
        var textBlock=root.querySelector('.onas-text-block');
        if(pressEl) pressEl.style.visibility='visible';
        if(textBlock) textBlock.style.visibility='visible';
    }

    // Dynamic-mounted section may initialize after window "load" already fired.
    // Run once immediately to avoid fallback geometry (over-bent / too low carousel).
    updateGalleryResponsive();
    function onLoad(){updateGalleryResponsive();}
    window.addEventListener('load',onLoad);
    cleanups.push(function(){window.removeEventListener('load',onLoad);});
    var galleryResizeTimeout;
    var _lastResizeVw=document.documentElement.clientWidth;
    function onResize(){
        var currentVw=document.documentElement.clientWidth;
        /* Mobile toolbar hide/show changes only height — ignore to prevent jitter */
        if(currentVw===_lastResizeVw&&/Mobi|Android/i.test(navigator.userAgent))return;
        _lastResizeVw=currentVw;
        clearTimeout(galleryResizeTimeout);galleryResizeTimeout=setTimeout(updateGalleryResponsive,50);timerIds.push(galleryResizeTimeout);
    }
    window.addEventListener('resize',onResize);
    cleanups.push(function(){window.removeEventListener('resize',onResize);});

    /* FIX P4: Expand toggle USUNIĘTY — Capitan ma swój własny */

    function syncInlineVideoPlayback(shouldPause){
        if(!engine||!engine.cards||!engine.cards.length)return;
        for(var i=0;i<engine.cards.length;i++){
            var card=engine.cards[i];
            if(!card||!card.classList||!card.classList.contains('card--video'))continue;
            var vid=card.querySelector('video');
            if(!vid||!vid.src)continue;
            if(shouldPause){
                if(!vid.paused&&!vid.ended) vid.setAttribute('data-onas-paused-by-io','1');
                vid.pause();
                vid.classList.remove('is-playing');
                continue;
            }
            var wasPausedByIo=vid.getAttribute('data-onas-paused-by-io')==='1';
            var cardVisible=card.style.visibility!=='hidden';
            if(wasPausedByIo&&cardVisible&&engine._revealComplete){
                vid.play().catch(function(){});
                vid.classList.add('is-playing');
            }
            vid.removeAttribute('data-onas-paused-by-io');
        }
    }
    function pause(){
        if(ticking&&tickFn){gsap.ticker.remove(tickFn);ticking=false;}
        for(var i=0;i<hfListeners.length;i++){var hf=hfListeners[i];hf.el.removeEventListener(hf.type,hf.fn,hf.options);}
        syncInlineVideoPlayback(true);
    }
    function resume(){
        if(!ticking&&tickFn){gsap.ticker.add(tickFn);ticking=true;}
        for(var i=0;i<hfListeners.length;i++){var hf=hfListeners[i];hf.el.addEventListener(hf.type,hf.fn,hf.options);}
        syncInlineVideoPlayback(false);
    }
    function kill(){
        pause();
        syncInlineVideoPlayback(false);
        if(deferredPreloadTimer){clearTimeout(deferredPreloadTimer);deferredPreloadTimer=0;}
        if(deferredPreloadIdleId&&typeof window.cancelIdleCallback==='function'){window.cancelIdleCallback(deferredPreloadIdleId);deferredPreloadIdleId=0;}
        for(var i=0;i<cleanups.length;i++){try{cleanups[i]();}catch(e){}}cleanups.length=0;
        if(galleryResizeTimeout)clearTimeout(galleryResizeTimeout);timerIds.forEach(function(id){clearTimeout(id);});timerIds.length=0;
        for(var j=0;j<observers.length;j++){if(observers[j]&&observers[j].disconnect)observers[j].disconnect();}observers.length=0;
        for(var k=0;k<gsapInstances.length;k++){var inst=gsapInstances[k];if(inst&&inst.revert)try{inst.revert();}catch(e){}if(inst&&inst.kill)try{inst.kill();}catch(e){}}gsapInstances.length=0;
        hfListeners.length=0;tickFn=null;
    }
    return { pause:pause, resume:resume, kill:kill };
}
return init;
})();

// ─────────────────────────────────────────────────────────────────────────────
// CAPITAN INIT — 1:1 z reference.html
// Three.js importowany dynamicznie; gsap.registerPlugin usuniety (→ useGSAP)
// ─────────────────────────────────────────────────────────────────────────────

async function onasCapitanInit(container) {
  const THREE = await import('three');
  const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
  const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js');
  const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');
  const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
  const { SVGLoader } = await import('three/examples/jsm/loaders/SVGLoader.js');
  const BufferGeometryUtils = await import('three/examples/jsm/utils/BufferGeometryUtils.js');

  const $ = (sel) => container.querySelector(sel);
  const $$ = (sel) => container.querySelectorAll(sel);
  const $id = (id) => container.querySelector('#' + id);
  const getScroll = () => scrollRuntime.getScroll();
  const getRawScroll = () => scrollRuntime.getRawScroll();

  const cleanups = [];
  const gsapInstances = [];
  const timerIds = [];
  const observers = [];

  // ── NULL GUARDS: structural elements ──
  const expandToggle = $id('onas-capitan-expandToggle');
  const badge = $id('onas-capitan-badgeWrapper');
  const content = $('.banner__content');
  if (!expandToggle || !badge || !content) {
    console.warn('onas-capitan: critical DOM missing', { expandToggle: !!expandToggle, badge: !!badge, content: !!content });
    return { pause(){}, resume(){}, kill(){} };
  }

  function onExpandClick() {
    container.classList.toggle('is-expanded');
    expandToggle.classList.toggle('is-active');
  }
  expandToggle.addEventListener('click', onExpandClick);
  cleanups.push(() => expandToggle.removeEventListener('click', onExpandClick));

  const mq = window.matchMedia('(max-width: 600px)');

  let posRaf = 0;
  let cachedContentH = 0;

  function positionBadge() {
    const h = cachedContentH;
    if (h <= 0) return;
    const isMobile = mq.matches;
    if (isMobile) {
      const topPx = h * 0.215;
      badge.style.top = topPx + 'px';
      badge.style.left = '78%';
      badge.style.width = '69.3%';
    } else {
      const topPx = h * 0.87 - 20;
      badge.style.top = topPx + 'px';
      badge.style.left = '13.5%';
      badge.style.width = '30.74%';
    }
    /* aspect-ratio: 1 fallback — keep badge square on Safari < 15 */
    if (!CSS.supports || !CSS.supports('aspect-ratio', '1 / 1')) {
      const bw = badge.offsetWidth;
      if (bw > 0) badge.style.height = bw + 'px';
    }
  }

  function schedulePosition() {
    if (posRaf) return;
    posRaf = requestAnimationFrame(() => { posRaf = 0; positionBadge(); });
  }

  const posRo = new ResizeObserver((entries) => {
    const entry = entries[0];
    cachedContentH = entry.contentRect.height;
    schedulePosition();
  });
  posRo.observe(content);
  observers.push(posRo);

  function onMqChange() { schedulePosition(); }
  if (mq.addEventListener) mq.addEventListener('change', onMqChange);
  else mq.addListener(onMqChange);
  cleanups.push(() => {
    if (mq.removeEventListener) mq.removeEventListener('change', onMqChange);
    else mq.removeListener(onMqChange);
  });

  schedulePosition();

  const threeContainer = badge;
  const onasWebGLProfile = getWebGLProfile();
  if (onasWebGLProfile === 'none') {
    return { pause(){}, resume(){}, kill(){} };
  }
  const wgOpts = getWebGLRendererCreationOptions(onasWebGLProfile);
  const DPR = getWebGLPixelRatio(onasWebGLProfile);
  const BLOOM_SCALE = 0.25;
  const BLOOM_INTERVAL = 4;

  function getSize() {
    const rect = threeContainer.getBoundingClientRect();
    return Math.round(rect.width) || 230;
  }

  let SIZE = getSize();

  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.z = 15;

  const isMobileInit = window.matchMedia('(max-width: 600px)').matches;

  /* WebGL init — graceful degradation if GPU unavailable */
  let baseRenderer, bloomRenderer;
  try {
    baseRenderer = new THREE.WebGLRenderer({
      antialias: wgOpts.antialias,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: wgOpts.powerPreference || 'default',
    });
  } catch(e) {
    console.warn('WebGL init failed, badge 3D disabled:', e);
    return { pause(){}, resume(){}, kill(){} };
  }
  baseRenderer.setClearColor(0x000000, 0);
  baseRenderer.setSize(SIZE, SIZE);
  baseRenderer.setPixelRatio(DPR);
  baseRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  baseRenderer.toneMappingExposure = 1.0;
  baseRenderer.shadowMap.enabled = false;
  baseRenderer.shadowMap.type = THREE.PCFShadowMap;
  baseRenderer.domElement.id = 'onas-capitan-canvas-base';
  baseRenderer.sortObjects = false;
  threeContainer.appendChild(baseRenderer.domElement);

  let bloomSize = Math.max(Math.round(SIZE * BLOOM_SCALE), 64);
  try {
    bloomRenderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: wgOpts.powerPreference || 'default',
    });
  } catch(e) {
    console.warn('Bloom WebGL init failed, badge 3D disabled:', e);
    try { baseRenderer.dispose(); baseRenderer.domElement.remove(); } catch(x){}
    return { pause(){}, resume(){}, kill(){} };
  }
  bloomRenderer.setSize(bloomSize, bloomSize);
  bloomRenderer.setPixelRatio(1);
  bloomRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  bloomRenderer.toneMappingExposure = 1.0;
  bloomRenderer.domElement.id = 'onas-capitan-canvas-bloom';
  bloomRenderer.sortObjects = false;
  threeContainer.appendChild(bloomRenderer.domElement);

  const bloomBg = new THREE.Color(0x000000);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(bloomSize, bloomSize), 1.5, 0.4, 0.85);
  bloomPass.threshold = 0.15;
  bloomPass.strength = 0.8;
  bloomPass.radius = 0.9;

  const composer = new EffectComposer(bloomRenderer);
  composer.setSize(bloomSize, bloomSize);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);

  const pmremGenerator = new THREE.PMREMGenerator(baseRenderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  pmremGenerator.dispose();

  /* Lighting: only lights with >2% contribution kept.
     Removed: AmbientLight (0% — metalness:1 kills diffuse),
     BackLight (0% — specular reflects away from camera at all angles),
     TopLight (<1%), BottomFill (<0.5%).
     Kept: SpotLight main (~18%), RimL/RimR (3-5% on edge at 90°/270°).
     80%+ of visual comes from RoomEnvironment envMap. */
  const spotLight = new THREE.SpotLight(0xffffff, 50);
  spotLight.position.set(0, 1.5, 12);
  spotLight.angle = Math.PI / 4;
  spotLight.penumbra = 0.5;
  spotLight.castShadow = false;
  spotLight.shadow.autoUpdate = false;
  spotLight.shadow.camera.near = 8;
  spotLight.shadow.camera.far = 20;
  scene.add(spotLight);

  /* All medal light from envMap (80%+) + 1 frontal SpotLight (~18%).
     RimL/RimR removed — 3-5% on edge moments covered by envMap + edgePeak bloom. */

  let logoGroup = null;
  let goldMaterial = null;
  let shadowInitialized = false;
  let baseScaleFactor = 1;
  let allGeoRefs = [];  // for cleanup

  /* ── Animatable element groups (THREE.Group pivots) ── */
  const EL = {
    base: null,       // Path 1 (big "1") + Path 2 (outer ring) + static T, P
    innerRing: null,  // Path 3 — already working ring spin
    small1: null,     // Small "1" stroke under big "1"
    topO: null,       // Letter O in "TOP" — can spin around own axis
    polP: null,       // P in "POLAND"
    polO: null,       // O in "POLAND"
    polL: null,       // L in "POLAND"
    polA: null,       // A in "POLAND"
    polN: null,       // N in "POLAND"
    polD: null,       // D in "POLAND"
  };

  // Alias for backward compatibility
  let ringPivot = null;

  function buildLogoFromSVG() {
    const svgEl = $id('onas-capitan-badge-svg');
    if (!svgEl) {
      console.warn('onas-capitan: badge SVG not found');
      return null;
    }
    const svgString = new XMLSerializer().serializeToString(svgEl);
    const svgData = new SVGLoader().parse(svgString);

    const extrudeSettings = { depth: 12, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.2, bevelOffset: 0, bevelSegments: 1 };

    goldMaterial = new THREE.MeshStandardMaterial({ color: 0xf3ae23, metalness: 1.0, roughness: 0.15, envMapIntensity: 1.5 });

    /* ═══════════════════════════════════════════════════════════
       STEP 1: Extrude all shapes, tag with path index + bbox
       ═══════════════════════════════════════════════════════════ */
    const tagged = [];  // { geo, pathIdx, cx, cy, minX, maxX, minY, maxY }

    svgData.paths.forEach((path, idx) => {
      SVGLoader.createShapes(path).forEach((shape) => {
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.computeBoundingBox();
        const b = geo.boundingBox;
        tagged.push({
          geo,
          pathIdx: idx,
          cx: (b.min.x + b.max.x) * 0.5,
          cy: (b.min.y + b.max.y) * 0.5,
          minX: b.min.x, maxX: b.max.x,
          minY: b.min.y, maxY: b.max.y
        });
      });
    });

    /* ═══════════════════════════════════════════════════════════
       STEP 2: Compute unified center from ALL geometry
       ═══════════════════════════════════════════════════════════ */
    const tempMerge = BufferGeometryUtils.mergeGeometries(tagged.map(t => t.geo.clone()), false);
    tempMerge.computeBoundingBox();
    const box = tempMerge.boundingBox;
    const cx = (box.min.x + box.max.x) * 0.5;
    const cy = (box.min.y + box.max.y) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    const sizeY = box.max.y - box.min.y;
    tempMerge.dispose();

    /* ═══════════════════════════════════════════════════════════
       STEP 3: Classify each shape into groups by path + bbox
       
       SVG viewBox: 0 0 339 323
       Path 0 contains: TOP letters (y < 60), POLAND letters (y > 250),
                         small "1" stroke (y 109-313, x < 80)
       Path 1: big "1" shape → BASE
       Path 2: outer ring → BASE
       Path 3: inner ring → ringPivot
       ═══════════════════════════════════════════════════════════ */
    const groups = {
      base: [],      // path 1 + path 2 + static letters T, P
      innerRing: [], // path 3
      small1: [],    // path 0, y > 100 && x < 80
      topO: [],      // path 0, y < 60, cx 40-80
      polP: [],      // path 0, y > 250, cx < 170
      polO: [],      // path 0, y > 250, cx 170-205
      polL: [],      // path 0, y > 250, cx 205-240
      polA: [],      // path 0, y > 250, cx 240-275
      polN: [],      // path 0, y > 250, cx 275-310
      polD: [],      // path 0, y > 250, cx > 310
    };

    for (const t of tagged) {
      if (t.pathIdx === 1 || t.pathIdx === 2) {
        groups.base.push(t.geo);
      }
      else if (t.pathIdx === 3) {
        groups.innerRing.push(t.geo);
      }
      else if (t.pathIdx === 0) {
        // Classify path 0 shapes by bbox position
        if (t.cy > 100 && t.cx < 80) {
          groups.small1.push(t.geo);
        }
        else if (t.cy < 60) {
          // TOP letters: T and P are static (never animated) → merge to base
          // Only O gets own pivot (spins around own axis)
          if (t.cx >= 40 && t.cx < 80) groups.topO.push(t.geo);
          else groups.base.push(t.geo); // T and P → base
        }
        else if (t.cy > 250) {
          // POLAND letters
          if (t.cx < 170) groups.polP.push(t.geo);
          else if (t.cx < 205) groups.polO.push(t.geo);
          else if (t.cx < 240) groups.polL.push(t.geo);
          else if (t.cx < 275) groups.polA.push(t.geo);
          else if (t.cx < 310) groups.polN.push(t.geo);
          else groups.polD.push(t.geo);
        }
        else {
          // Fallback: anything unclassified goes to base
          groups.base.push(t.geo);
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       STEP 4: For each group, merge geos → translate → mesh → pivot
       All use same center offset → everything stays in place
       ═══════════════════════════════════════════════════════════ */
    // DEFAULT: pivot at medal center — element stays in place, rotation = around medal center
    // This is what innerRing needs for ring spin (opening/closing effect)
    function buildGroup(geos) {
      if (!geos || geos.length === 0) return null;
      const merged = geos.length === 1 ? geos[0] : BufferGeometryUtils.mergeGeometries(geos, false);
      merged.translate(-cx, -cy, -cz);
      allGeoRefs.push(merged);

      const mesh = new THREE.Mesh(merged, goldMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      const pivot = new THREE.Group();
      pivot.add(mesh);
      return pivot;
    }

    // OWN-CENTER PIVOT: element rotates around its own center (for letters that spin in place)
    function buildGroupOwnPivot(geos) {
      if (!geos || geos.length === 0) return null;
      const merged = geos.length === 1 ? geos[0] : BufferGeometryUtils.mergeGeometries(geos, false);
      allGeoRefs.push(merged);

      merged.computeBoundingBox();
      const eb = merged.boundingBox;
      const eCx = (eb.min.x + eb.max.x) * 0.5;
      const eCy = (eb.min.y + eb.max.y) * 0.5;
      const eCz = (eb.min.z + eb.max.z) * 0.5;

      // Mesh centered at own origin
      merged.translate(-eCx, -eCy, -eCz);

      const mesh = new THREE.Mesh(merged, goldMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      // Pivot positioned within medal space
      const pivot = new THREE.Group();
      pivot.position.set(eCx - cx, eCy - cy, eCz - cz);
      pivot.add(mesh);
      return pivot;
    }

    // DUAL PIVOT for innerRing:
    //   outerPivot (medal center) → .rotation.y = scroll ring spin (✅ ACCEPTED)
    //   localPivot (ring's own center) → .rotation.x/y/z = idle wobble (small, local)
    function buildGroupDualPivot(geos) {
      if (!geos || geos.length === 0) return null;
      const merged = geos.length === 1 ? geos[0] : BufferGeometryUtils.mergeGeometries(geos, false);
      allGeoRefs.push(merged);

      merged.computeBoundingBox();
      const eb = merged.boundingBox;
      const eCx = (eb.min.x + eb.max.x) * 0.5;
      const eCy = (eb.min.y + eb.max.y) * 0.5;
      const eCz = (eb.min.z + eb.max.z) * 0.5;

      merged.translate(-eCx, -eCy, -eCz);

      const mesh = new THREE.Mesh(merged, goldMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      // Local pivot at ring's own center — idle wobble rotates here
      const localPivot = new THREE.Group();
      localPivot.position.set(eCx - cx, eCy - cy, eCz - cz);
      localPivot.add(mesh);

      // Outer pivot at medal center — scroll ring spin rotates here
      const outerPivot = new THREE.Group();
      outerPivot.add(localPivot);
      outerPivot._localPivot = localPivot;

      return outerPivot;
    }

    // FOOT+CENTER DUAL PIVOT for small "1":
    //   outerPivot (foot of letter) → scroll Bézier animation
    //   localPivot (center of letter) → idle wobble (subtle, like inner ring)
    function buildGroupFootDualPivot(geos) {
      if (!geos || geos.length === 0) return null;
      const merged = geos.length === 1 ? geos[0] : BufferGeometryUtils.mergeGeometries(geos, false);
      allGeoRefs.push(merged);

      merged.computeBoundingBox();
      const eb = merged.boundingBox;

      // Center of letter (for idle pivot)
      const eCx = (eb.min.x + eb.max.x) * 0.5;
      const eCy = (eb.min.y + eb.max.y) * 0.5;
      const eCz = (eb.min.z + eb.max.z) * 0.5;

      // Foot of letter (bottom, for scroll pivot)
      const footY = eb.max.y; // max Y = bottom in flipped SVG coords

      // Mesh centered at letter's own center
      merged.translate(-eCx, -eCy, -eCz);

      const mesh = new THREE.Mesh(merged, goldMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      // Local pivot at letter center (idle wobble rotates here)
      const localPivot = new THREE.Group();
      // Offset from foot to center
      localPivot.position.set(eCx - eCx, eCy - footY, eCz - eCz); // = (0, center-foot, 0)
      localPivot.add(mesh);

      // Outer pivot at foot position in medal space (scroll animates here)
      const outerPivot = new THREE.Group();
      outerPivot.position.set(eCx - cx, footY - cy, eCz - cz);
      outerPivot.add(localPivot);
      outerPivot._localPivot = localPivot;

      return outerPivot;
    }

    EL.base      = buildGroup(groups.base);
    EL.innerRing = buildGroupDualPivot(groups.innerRing);  // dual pivot: scroll + local wobble
    EL.small1    = buildGroupFootDualPivot(groups.small1);  // foot for scroll, center for idle

    // Store home position on element for animation to read
    if (EL.small1) {
      EL.small1._homeX = EL.small1.position.x;
      EL.small1._homeY = EL.small1.position.y;
      EL.small1._homeZ = EL.small1.position.z;
    }
    EL.topO      = buildGroupOwnPivot(groups.topO);  // spins around own center
    EL.polP      = buildGroupOwnPivot(groups.polP);  // own pivot for Y spin
    EL.polO      = buildGroupOwnPivot(groups.polO);
    EL.polL      = buildGroupOwnPivot(groups.polL);
    EL.polA      = buildGroupOwnPivot(groups.polA);
    EL.polN      = buildGroupOwnPivot(groups.polN);
    EL.polD      = buildGroupOwnPivot(groups.polD);

    // Backward compat alias
    ringPivot = EL.innerRing;

    /* ═══════════════════════════════════════════════════════════
       STEP 5: Assemble hierarchy
       wrapper > all element pivots
       ═══════════════════════════════════════════════════════════ */
    const wrapper = new THREE.Group();
    for (const key of Object.keys(EL)) {
      if (EL[key]) wrapper.add(EL[key]);
    }

    const visibleHeight = 2 * Math.tan((28 * Math.PI / 180) / 2) * 15;
    const scaleFactor = (visibleHeight * 0.54) / sizeY;
    baseScaleFactor = scaleFactor;
    wrapper.scale.set(scaleFactor, -scaleFactor, scaleFactor);
    scene.add(wrapper);
    logoGroup = wrapper;
  }

  const mouse = { x: 0, y: 0, near: false, influence: 0 };
  let rectCache = threeContainer.getBoundingClientRect();
  let lastClientX = 0, lastClientY = 0;
  let pmRaf = 0;

  function onPointerEnter() { mouse.near = true; rectCache = threeContainer.getBoundingClientRect(); }
  function onPointerLeave() {
    mouse.near = false;
    /* Stale normalized coords (e.g. last move on right edge of badge) kept mRy≠0 while influence
       decayed slowly → medal looked “flipped” vs cursor far right on screen. Clear on exit. */
    mouse.x = 0;
    mouse.y = 0;
    if (pmRaf) {
      cancelAnimationFrame(pmRaf);
      pmRaf = 0;
    }
  }
  function onPointerMove(e) {
    lastClientX = e.clientX; lastClientY = e.clientY;
    if (!mouse.near) mouse.near = true;
    if (pmRaf) return;
    pmRaf = requestAnimationFrame(() => {
      pmRaf = 0;
      rectCache = threeContainer.getBoundingClientRect(); // FIX C: fresh rect before normalization
      if (rectCache.width <= 0 || rectCache.height <= 0) return;
      mouse.x = ((lastClientX - rectCache.left) / rectCache.width) * 2 - 1;
      mouse.y = ((lastClientY - rectCache.top) / rectCache.height) * 2 - 1;
    });
  }

  const hfListeners = [
    { target: threeContainer, event: 'pointermove', fn: onPointerMove, options: { passive: true } }
  ];
  /* pointerenter / leave / move — attached only after badgeInteractReady (see attachBadgePointerListeners) */

  let lastResizedSize = SIZE;
  const threeRo = new ResizeObserver(() => {
    rectCache = threeContainer.getBoundingClientRect();
    const newSize = Math.round(rectCache.width) || 230;
    if (Math.abs(newSize - lastResizedSize) >= 3 && newSize > 0) {
      SIZE = newSize; lastResizedSize = newSize;
      baseRenderer.setSize(SIZE, SIZE);
      bloomSize = Math.max(Math.round(SIZE * BLOOM_SCALE), 64);
      bloomRenderer.setSize(bloomSize, bloomSize);
      composer.setSize(bloomSize, bloomSize);
      rectCache = threeContainer.getBoundingClientRect(); // re-read after resize
    }
  });
  threeRo.observe(threeContainer);
  observers.push(threeRo);

  let inView = true;
  let pageVisible = !document.hidden;
  let stActive = false;    // ScrollTrigger onToggle state
  let running = true;
  let ticking = false;
  let tickFn = null;
  let hoverAttract = 0;
  let _effectiveFrame = 0; // hover-attract blended frame
  let frameCount = 0;
  let _lastSlX = 0, _lastSlY = 1.5; // shadow delta tracking
  let _wakeSkip = false;   // Type B: skip velocity on first frame after wake

  function onVisibilityChange() {
    pageVisible = !document.hidden;
    if (pageVisible) _wakeSkip = true; // tab switch = wake → skip velocity spike
    syncRunning();
  }
  document.addEventListener('visibilitychange', onVisibilityChange, { passive: true });
  cleanups.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));

  const io = new IntersectionObserver(
    (entries) => { inView = entries[0]?.isIntersecting ?? false; syncRunning(); },
    // Tighter window to suspend WebGL sooner after leave.
    { root: null, threshold: 0.01, rootMargin: '80px' }
  );
  io.observe(threeContainer);
  observers.push(io);

  /* ── Badge reveal + scroll drift ── */
  let _stableVhCap = window.innerHeight;
  function getStableVhCap(){
    const raw = window.innerHeight;
    if (Math.abs(raw - _stableVhCap) > 100) _stableVhCap = raw;
    return _stableVhCap;
  }
  const DRIFT_PX = 220;
  const DRIFT_SCALE_START = 1.4;
  const DRIFT_SCALE_END = 1.0;
  const DRIFT_ROTX_START = -30; /* degrees 2D tilt at start */

  /* Drift calculator — reusable */
  function calcDriftProgress() {
    const rect = container.getBoundingClientRect();
    const vh = getStableVhCap();
    const totalTravel = vh + rect.height;
    const scrolled = vh - rect.top;
    return Math.max(0, Math.min(1, scrolled / (totalTravel * 0.8)));
  }

  function setBadgeTransform(offset, scale, rot) {
    badge.style.transform = 'translate(-50%, calc(-50% - ' + offset.toFixed(1) + 'px)) rotate(' + rot.toFixed(1) + 'deg) scale(' + scale.toFixed(4) + ')';
  }

  /* Scroll drift + inertia + scale */
  let driftActive = false;
  let driftRaf = 0;
  let badgeScale = { v: 1 };
  let driftInertia = 0;
  let lastScrollY = window.scrollY;
  let inertiaRunning = false;
  let smoothProgress = 0; /* lerped progress — trails real scroll */
  let smoothRaf = 0;
  let inertiaRaf = 0;
  /** Until reveal + drift settle: only scroll drives 3D (ignore cursor / hover-attract). */
  let badgeInteractReady = false;
  let badgePointerAttached = false;

  function updateBadgeDrift() {
    if (mq.matches) {
      badge.style.transform = 'translate(-50%, -50%) rotate(0deg)';
      return;
    }
    const baseOffset = DRIFT_PX * (1 - smoothProgress);
    const driftScale = DRIFT_SCALE_START + (DRIFT_SCALE_END - DRIFT_SCALE_START) * smoothProgress;
    const driftRot = DRIFT_ROTX_START * (1 - smoothProgress);
    setBadgeTransform(baseOffset - driftInertia, driftScale * badgeScale.v, driftRot);
  }

  /* Smooth follow loop — runs when badge is drifting */
  function smoothLoop() {
    if (!driftActive) return;
    const target = calcDriftProgress();
    const diff = target - smoothProgress;
    if (Math.abs(diff) > 0.0005) {
      smoothProgress += diff * 0.08; /* lerp factor — lower = more lag */
      updateBadgeDrift();
      smoothRaf = requestAnimationFrame(smoothLoop);
    } else {
      smoothProgress = target;
      updateBadgeDrift();
      smoothRaf = 0;
    }
  }

  function kickSmooth() {
    if (!smoothRaf) {
      smoothRaf = requestAnimationFrame(smoothLoop);
    }
  }

  function decayInertia() {
    driftInertia *= 0.92;
    if (Math.abs(driftInertia) < 0.5) {
      driftInertia = 0;
      inertiaRunning = false;
      inertiaRaf = 0;
      updateBadgeDrift();
      return;
    }
    updateBadgeDrift();
    inertiaRaf = requestAnimationFrame(decayInertia);
  }

  function onScrollDrift() {
    if (!driftActive) return;
    const sy = window.scrollY;
    const delta = sy - lastScrollY;
    lastScrollY = sy;
    driftInertia = Math.max(-60, Math.min(60, delta * 0.35));

    kickSmooth(); /* start/continue smooth follow */

    if (!inertiaRunning && Math.abs(driftInertia) > 1) {
      inertiaRunning = true;
      inertiaRaf = requestAnimationFrame(decayInertia);
    }
  }

  const badgeRevealIO = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        badgeRevealIO.disconnect();
        const isMobileNow = mq.matches;

        if (!isMobileNow) {
          /* DESKTOP: GSAP reveal with drift from frame 1 */
          driftActive = true;
          lastScrollY = window.scrollY;
          smoothProgress = calcDriftProgress(); /* sync initial */
          window.addEventListener('scroll', onScrollDrift, { passive: true });
          cleanups.push(() => window.removeEventListener('scroll', onScrollDrift));

          /* Set initial state: drifted position, hidden, small */
          badgeScale.v = 0.7;
          badge.style.opacity = '0';
          updateBadgeDrift();

          /* Animate reveal — smooth loop handles drift+scale+rot */
          var revealBadgeTl = gsap.timeline({
            onUpdate: function() { updateBadgeDrift(); kickSmooth(); },
            onComplete: function() {
              badge.style.setProperty('--onas-badge-reveal', '72%');
              badge.style.webkitMaskImage = 'none';
              badge.style.maskImage = 'none';
              /* After GSAP, wait until drift lerp + scroll inertia settle — then allow pointer. */
              let settleFrames = 0;
              function waitDriftSettle() {
                settleFrames++;
                const target = calcDriftProgress();
                const settled =
                  Math.abs(target - smoothProgress) < 0.005 &&
                  !inertiaRunning &&
                  Math.abs(driftInertia) < 0.6;
                if (settled || settleFrames > 120) {
                  badgeInteractReady = true;
                  attachBadgePointerListeners();
                  return;
                }
                requestAnimationFrame(waitDriftSettle);
              }
              requestAnimationFrame(waitDriftSettle);
            }
          });
          revealBadgeTl.to(badge, {
            opacity: 1,
            '--onas-badge-reveal': '72%',
            duration: 1.43,
            ease: 'power3.out'
          }, 0);
          revealBadgeTl.to(badgeScale, {
            v: 1,
            duration: 1.43,
            ease: 'power3.out'
          }, 0);
          gsapInstances.push(revealBadgeTl);

        } else {
          /* MOBILE: check @property support for smooth mask reveal */
          var supportsAtProperty = !!(window.CSS && CSS.registerProperty);

          if (supportsAtProperty) {
            /* @property works — CSS keyframes animate --onas-badge-reveal smoothly */
            container.classList.add('badge-revealed');
            badge.addEventListener('animationend', () => {
              badge.style.opacity = '1';
              badge.style.transform = 'translate(-50%, -50%) rotate(0deg)';
              badge.style.setProperty('--onas-badge-reveal', '72%');
              badge.style.webkitMaskImage = 'none';
              badge.style.maskImage = 'none';
              badge.style.animation = 'none';
              badgeInteractReady = true;
              attachBadgePointerListeners();
            }, { once: true });
          } else {
            /* No @property (Safari < 16.4): skip broken mask, fade+scale only */
            badge.style.webkitMaskImage = 'none';
            badge.style.maskImage = 'none';
            badge.style.opacity = '0';
            badge.style.transform = 'translate(-50%, -50%) rotate(0deg) scale(0.7)';
            gsap.to(badge, {
              opacity: 1, scale: 1, duration: 1.0,
              ease: 'power3.out',
              onComplete: function() {
                badgeInteractReady = true;
                attachBadgePointerListeners();
              }
            });
          }
        }
      }
    },
    { root: null, threshold: 0.05 }
  );
  badgeRevealIO.observe(container);
  observers.push(badgeRevealIO);

  /* If IO/reveal never completes (edge layout), do not block pointer forever */
  const badgeInteractFailsafeId = window.setTimeout(() => {
    badgeInteractReady = true;
    attachBadgePointerListeners();
  }, 12000);
  cleanups.push(() => clearTimeout(badgeInteractFailsafeId));

  function attachBadgePointerListeners() {
    if (badgePointerAttached || !badgeInteractReady) return;
    badgePointerAttached = true;
    hoverAttract = 0;
    mouse.x = 0;
    mouse.y = 0;
    mouse.near = false;
    mouse.influence = 0;
    rectCache = threeContainer.getBoundingClientRect();
    threeContainer.addEventListener('pointerenter', onPointerEnter, { passive: true });
    threeContainer.addEventListener('pointerleave', onPointerLeave, { passive: true });
    hfListeners.forEach(l => l.target.addEventListener(l.event, l.fn, l.options));
  }

  function detachBadgePointerListeners() {
    if (!badgePointerAttached) return;
    badgePointerAttached = false;
    threeContainer.removeEventListener('pointerenter', onPointerEnter, { passive: true });
    threeContainer.removeEventListener('pointerleave', onPointerLeave, { passive: true });
    hfListeners.forEach(l => l.target.removeEventListener(l.event, l.fn, l.options));
    if (pmRaf) {
      cancelAnimationFrame(pmRaf);
      pmRaf = 0;
    }
    mouse.x = 0;
    mouse.y = 0;
    mouse.near = false;
  }

  cleanups.push(() => detachBadgePointerListeners());

  /* ── syncRunning: OR logic — IO visible OR ScrollTrigger active → ticker runs ── */
  function syncRunning() {
    const shouldRun = (inView || stActive) && pageVisible;
    if (shouldRun === running) return;
    running = shouldRun;
    if (running) {
      _wakeSkip = true; // wake from sleep → skip first-frame velocity spike
      if (!ticking) { ticking = true; gsap.ticker.add(tickFn); }
      if (badgeInteractReady) attachBadgePointerListeners();
    } else {
      if (ticking) { ticking = false; gsap.ticker.remove(tickFn); }
      detachBadgePointerListeners();
    }
  }

  buildLogoFromSVG();

  // Pre-compile shaders — eliminates first-frame jank
  baseRenderer.compile(scene, camera);
  bloomRenderer.compile(scene, camera);

  const RX_CENTER = -0.063;
  const PHI = 1.618033988;

  /* ═══════════════════════════════════════════════════════════════
     TWO BOLD SCENES — scroll-choreographed
     
     Lighting setup (optimized — 6 dead lights removed, PBR audit):
       SpotLight(50)  at (0, 1.5, 12)    — main frontal specular (~18%)
       RoomEnv PMREM                     — 80%+ of visual (envMapIntensity dynamic)
       [REMOVED: Ambient(0%), backLight(0%), rimL/R(3-5% covered by envMap),
        topLight(<1%), bottomFill(<0.5%)]
     
     Geometry:
       bodyMesh  = text + outer circle ring (paths 0,1,2)
       ringPivot → ringMesh = inner circle (path 3) — can rotate independently
       Extrude depth: 12, bevel: 1.5/1.2
       Material: metalness 1.0, roughness 0.15
     ═══════════════════════════════════════════════════════════════ */

  const J = { p: 0, prev: 0, on: false };



  /* ── Small "1" idle — HARDCODED parameters ──
     ry:12° @0.9Hz | rx:2.5° @0.35Hz | rz:9° @1Hz
     floatY:14 @0.75Hz | floatZ:16 @0.7Hz
     scale:5.5% @0.95Hz | mod:0.15
  */
  /* ── Small "1" idle — redesigned to match inner ring calm ──
     Inner ring reference: perlin4, 0.6-0.9 Hz, ±30°, 3 axes only
     Small "1": same philosophy — slow, wide, few axes, pure perlin4
     
     Primary:   rz (pendulum swing, like leaf on water)
     Secondary: rx (gentle nod)
     Tertiary:  position.y (float up/down)
     NO: fast speeds, NO: perlinMod chaos, NO: scale pulsation, NO: position.z
  */
  const S1_IDLE = {
    rzAmp: 0.40,   rzHz: 0.72,   // ±23° — primary pendulum swing (ring: 0.74)
    rxAmp: 0.22,   rxHz: 0.55,   // ±13° — depth nod (ring: 0.62)
    fyAmp: 8,      fyHz: 0.48,   // ±8 units — float up/down (ring: 0.88)
  };

  // MUST be before first use
  let _s1CurrentFrame = 0;

  /* ── Idle fade: all params fade to 0 by frame 900 (90% of 1000) ──
     Frame 0-250:   collision ramp up (0.02 → 0.08)
     Frame 250-500: ramp to peak (0.08 → 0.50)
     Frame 500-700: hold mid (0.50)
     Frame 700-1000: ramp to full (0.50 → 1.0) — visible, collision-free
  */
  function s1IdleFade() {
    const f = _s1CurrentFrame;
    if (f <= 0) return 0.02;
    if (f >= 900) return 0;                                    // settled — no wobble
    if (f <= 250) return 0.02 + (f / 250) * 0.06;             // collision ramp
    if (f <= 500) return 0.08 + ((f - 250) / 250) * 0.42;     // grow to 0.50
    if (f <= 700) return 0.50;                                  // hold during travel
    // 700→900: fade out smoothly
    const t = (f - 700) / 200;
    return 0.50 * (1 - t * t * (3 - 2 * t));                   // smoothstep → 0
  }

  function applyS1Idle(time) {
    return; // frozen — stays in final animation position
  }



  // ScrollTrigger — badge viewport traversal drives animation 0→100%
  // Maps scroll progress to sceneRing p = 0.40 → 0.796
  // start: badge top enters viewport bottom → 0%
  // end:   badge top reaches viewport top   → 100% (badge still partially visible)
  // Range = exactly 1× viewport height
  const ANIM_START = 0.40;   // sceneRing p where ring = 189°
  const ANIM_END   = 0.796;  // sceneRing p where settle = 7%
  const ANIM_RANGE = ANIM_END - ANIM_START;

  // Badge starts in animation mode at frame 0 — no auto-rotation phase
  J.p = ANIM_START;
  J.prev = ANIM_START;
  J.on = true;

  /* ── ScrollTrigger: #onas-capitan jako trigger (FIX A — stabilny rect; badge ma drift transform)
       scrub:true = direct link, Lenis handles ALL smoothing
       invalidateOnRefresh = recalculate bounds on resize/refresh
       onToggle = OR logic with IO for ticker sleep/wake ── */
  const badgeST = ScrollTrigger.create({
    trigger: container,           // FIX A: #onas-capitan — stabilny rect, bez JS-driven transform
    start: 'bottom 65%',           // badge bottom at 65% from top → progress 0
    end: 'top 1%',                 // badge top reaches 1% from viewport top → progress 1
    scrub: true,                  // direct link (Lenis = only smoother, no double-smooth)
    invalidateOnRefresh: true,    // recalc bounds on resize/orientationchange
    onUpdate(self) {
      J.prev = J.p;
      J.p = ANIM_START + Math.max(0, Math.min(1, self.progress)) * ANIM_RANGE;
    },
    onToggle(self) {
      stActive = self.isActive;
      syncRunning();              // OR logic: IO visible OR ST active → ticker runs
    }
  });

  // Helpers
  function lerp(a, b, t) { return a + (b - a) * t; }
  function remap(t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); }
  function easeInOut(t) { return t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }
  function dampSpring(t, amp, dec, frq) { return amp * Math.exp(-dec * t) * Math.cos(frq * t); }

  /* ═══════════════════════════════════════════════════════════════
     B: RING SPIN
     
     Medal w pozycji spoczynkowej. Spokojny.
     Wewnętrzny ring (path 3 — mniejszy koncentric circle) robi
     pełen obrót 360° wokół osi Y (horyzontalny flip).
     
     Geometry: ring extrude depth=12. Radius wew. ~54, zew. ~71.
     Gap do outer ring = 20 units → nie klipuje przy obrocie.
     
     Przy rotacji ringu:
       0°:   face ringu widoczny — pełny frontalny specular
       45°:  bevel łapie rimLight — edge glow rośnie
       90°:  krawędź ringu — cienka linia złota, rim lights PEAK
       135°: tył ringu obraca się — envMap oświetla krawędź
       180°: pełen tył — envMap intensity pumped via backPeak
       270°: druga krawędź — znów rim lights peak
       360°: powrót do face
     
     SpotLight pulsuje subtelnie żeby specular na ringu żył.
     Bloom spikes przy 0° i 180° (face moments).
     Ciało medalu (text + outer ring) ma delikatny micro-breathe.
     ═══════════════════════════════════════════════════════════════ */
  /* ═══════════════════════════════════════════════════════════════
     IDLE LEVITATION — element-level organic motion
     
     Runs EVERY frame. Independent of scroll.
     Uses pseudo-Perlin: 4 sines × incommensurate ratios → never repeats.
     
     1. EL.topO: rotation.y ±60° (±1.047 rad) — slow organic swing
     2. EL.innerRing: rotation.x ±30°, rotation.y ±30° — drift inside O
     3. POLAND: wave P→D, P largest amplitude, D smallest
     ═══════════════════════════════════════════════════════════════ */
  const SQRT2 = 1.4142135623730951;
  const SQRT3 = 1.7320508075688772;

  // Pseudo-Perlin: sum of sines with incommensurate frequency multipliers
  // Returns -1..+1 (normalized). Never repeats.
  function perlin4(time, baseSpeed) {
    const s = baseSpeed;
    return (
      Math.sin(time * s) * 0.40 +
      Math.sin(time * s * PHI)   * 0.30 +
      Math.sin(time * s * SQRT2) * 0.20 +
      Math.sin(time * s * SQRT3) * 0.10
    );
  }

  // POLAND wave: P→D, P biggest amplitude, D smallest, phase-shifted
  const POLAND_KEYS = ['polP', 'polO', 'polL', 'polA', 'polN', 'polD'];
  const POLAND_AMPS = [0.18, 0.15, 0.12, 0.09, 0.06, 0.04]; // tilt rad — P~10° → D~2°
  const POLAND_SPIN = [0.12, 0.18, 0.25, 0.35, 0.50, 0.70]; // Y-axis spin rad — P~7° → D~40°
  const POLAND_PHASE_STEP = 0.7; // seconds of phase offset between letters
  // Each letter has slightly different perlin speed → never sync
  const POLAND_SPEEDS = [1.365, 1.248, 1.131, 1.482, 1.326, 1.209]; // +30% (was ~0.87-1.14)
  const POLAND_YSPEEDS = [0.819, 0.936, 0.741, 1.053, 0.897, 1.014]; // +30% (was ~0.57-0.81)

  function applyIdleLevitation(time) {
    /* ── Inner ring — ALWAYS runs (independent of idleFade) ──
         Amplitude ramp: frames 0-181 → scale 0.1→1.0 (prevents clipping outer ring)
         frames 181+ or idle → full amplitude
    */
    if (EL.innerRing && EL.innerRing._localPivot) {
      const lp = EL.innerRing._localPivot;

      let wobbleScale = 1.0;
      if ((J.on || hoverAttract > 0.01) && _effectiveFrame < 181) {
        wobbleScale = 0.1 + 0.9 * (_effectiveFrame / 181);
      }

      lp.rotation.x = perlin4(time, 0.88) * 0.524 * wobbleScale;
      lp.rotation.y = perlin4(time, 0.62) * 0.524 * wobbleScale;
      lp.rotation.z = perlin4(time, 0.74) * 0.087 * wobbleScale;
    }

    /* ── Fade multiplier: topO + POLAND settle to SVG at 95-100% scroll ── */
    let idleFade = 1.0;
    if ((J.on || hoverAttract > 0.01) && _effectiveFrame >= 950) {
      if (_effectiveFrame >= 1000) { idleFade = 0; }
      else {
        const t = (_effectiveFrame - 950) / 50;
        idleFade = 1 - t * t * (3 - 2 * t);
      }
    }

    /* ── OPT: skip ~60 Math.sin() when topO + POLAND produce zeros ── */
    if (idleFade === 0) return;

    /* ── TOP "O" — slow swing around own Y axis ±60° ── */
    if (EL.topO) {
      const swing = perlin4(time, 0.5625) * 0.524 * idleFade;
      EL.topO.rotation.y = swing;
      EL.topO.rotation.x = perlin4(time, 0.42) * 0.03 * idleFade;
    }

    /* ── POLAND wave — P initiates tilt, ripple through to D ── */
    for (let i = 0; i < POLAND_KEYS.length; i++) {
      const el = EL[POLAND_KEYS[i]];
      if (!el) continue;

      const phaseShift = i * POLAND_PHASE_STEP;
      const wave = perlin4(time - phaseShift, POLAND_SPEEDS[i]);

      el.rotation.x = wave * POLAND_AMPS[i] * idleFade;
      el.rotation.z = wave * POLAND_AMPS[i] * 0.3 * idleFade;

      el.rotation.y = perlin4(time, POLAND_YSPEEDS[i]) * POLAND_SPIN[i] * idleFade;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     SMALL "1" CHOREOGRAPHY — scroll-driven reveal
     
     FOOT PIVOT: rotation swings from the base.
     
     QUADRATIC BÉZIER through 3 points — ONE smooth organic curve:
     P0 (frame 0):    hidden behind big "1"
     P1 (control):    bounce peak — most extended
     P2 (frame 800):  home
     
     B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
     
     No phases, no breaks, no sharp transitions.
     The curve naturally sweeps through the bounce peak
     and settles at home. Completely organic.
     
     Runs alongside ✅ ACCEPTED sceneRing, does NOT modify it.
     ═══════════════════════════════════════════════════════════════ */
  
  // Three keyframes for Bézier
  const S1_P0 = { ry: -1.7453, dpx: 56,  dpy: 0,  dpz: -78 }; // start: hidden
  const S1_P1 = { ry: -1.5010, dpx: 18,  dpy: 56, dpz: 80  }; // control: bounce peak
  const S1_P2 = { ry:  0.0873, dpx: 0,   dpy: 0,  dpz: 0   }; // end: home (5°)

  function applyS1(ry, dpx, dpy, dpz) {
    const hx = EL.small1._homeX || 0;
    const hy = EL.small1._homeY || 0;
    const hz = EL.small1._homeZ || 0;
    EL.small1.rotation.y = ry;
    EL.small1.position.x = hx + dpx;
    EL.small1.position.y = hy + dpy;
    EL.small1.position.z = hz + dpz;
  }

  /* ── DAMPED SPRING EASING ──
     Physically-based: overshoot → undershoot → settle
     Visible movement throughout full timeline (no dead tail).
     
     decay=3, freq=2.5: lands exactly at 1.0 (cos(2.5π)=0)
     3 direction changes, visible oscillation to t=0.95
  */
  function dampedSpring(t, decay, freq) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 1 - Math.exp(-decay * t) * Math.cos(freq * Math.PI * t);
  }

  function animateSmall1(frame) {
    if (!EL.small1) return;
    _s1CurrentFrame = frame;

    if (frame <= 0) {
      applyS1(S1_P0.ry, S1_P0.dpx, S1_P0.dpy, S1_P0.dpz);
      return;
    }

    if (frame >= 1000) {
      applyS1(S1_P2.ry, S1_P2.dpx, S1_P2.dpy, S1_P2.dpz);
      return;
    }

    const raw = frame / 1000; // full timeline, spring handles the rest

    // ── dpx/dpz: damped spring settling (same spring for both axes) ──
    const spring = dampedSpring(raw, 3, 2.5);
    const dpx = S1_P0.dpx + (S1_P2.dpx - S1_P0.dpx) * spring;

    // ── dpy: arc up and down, peak at center ──
    // Pure sine: visible rise AND visible descent (no easeOut frontloading)
    const dpy = S1_P1.dpy * Math.sin(raw * Math.PI);

    const dpz = S1_P0.dpz + (S1_P2.dpz - S1_P0.dpz) * spring;

    // ── ry: back-facing (kreska) for 0→70%, reveals face in 70→100% ──
    // At -100° the "1" is edge-on/back = thin line. Smoothstep = zero velocity at both ends.
    const ryT = raw < 0.7 ? 0 : (raw - 0.7) / 0.3;
    const rySmooth = ryT * ryT * (3 - 2 * ryT); // smoothstep
    const ry = S1_P0.ry + (S1_P2.ry - S1_P0.ry) * rySmooth;

    applyS1(ry, dpx, dpy, dpz);
  }


  /* ═══════════════════════════════════════════════════════════════
     ✅ ACCEPTED — NIE RUSZAĆ BEZ WYRAŹNEGO ŻYCZENIA
     
     RING TIMELINE — otwieranie/zamykanie inner ringu (rotation.y)
     
     Frame 1 = ring starts opening (0°)
     Mid-point = ring fully open / edge visible (180°)
     Frame ~780 = ring closed again (360°)
     Frame 780-1000 = settle (damped bounce)
     
     Badge ALWAYS visible. No fade in/out. No scale ramp.
     This IS the animation. Everything else builds on top of this.
     
     ⚠️  sceneRing() steruje TYLKO ringRy (= ringPivot.rotation.y)
         Idle drift na rotation.x / rotation.z jest NIEZALEŻNY
         i działa w applyIdleLevitation()
     ═══════════════════════════════════════════════════════════════ */
  let _srLastP = NaN;
  const _srOut = { rx: RX_CENTER, ry: 0, rz: 0, sc: 1, envI: 1.5, blm: .8,
                   slY: 1.5, slX: 0, ringRy: 0 };

  function sceneRing(p) {
    // Memoize: pure function of p — skip recompute when idle
    if (p === _srLastP) return _srOut;
    _srLastP = p;

    const o = _srOut;
    o.rx = RX_CENTER; o.ry = 0; o.rz = 0; o.sc = 1;
    o.envI = 1.5; o.blm = .8; o.slY = 1.5; o.slX = 0; o.ringRy = 0;

    if (p < 0.78) {
      /* ── RING ROTATION: 0° → 360° ── */
      const t = p / 0.78;  // 0→1 across rotation phase

      // easeInOut for satisfying acceleration → deceleration
      const spinProgress = easeInOut(t);
      o.ringRy = spinProgress * Math.PI * 2;

      // Body: gentle breathe, star is the ring
      o.rx = RX_CENTER + Math.sin(t * Math.PI * 3) * 0.015;
      o.ry = Math.sin(t * Math.PI * 2) * 0.025;

      // envI & bloom mapped to ring angle
      const ringAngle = o.ringRy;
      const ringFace = Math.cos(ringAngle);  // +1 at 0° and 360°, -1 at 180°

      // Face moments (0°, 360°): frontal specular
      const facePeak = Math.pow(Math.max(0, ringFace), 4) * 0.6;
      // Back moment (180°): envMap pumped (backLight removed — was placebo)
      const backPeak = Math.pow(Math.max(0, -ringFace), 3) * 0.4;
      // Edge moments (90°, 270°): rim lights catch thin edge
      const edgeness = 1 - Math.abs(ringFace);
      const edgePeak = Math.pow(edgeness, 2) * 0.5;

      o.envI = 1.5 + facePeak + backPeak + edgePeak;
      o.blm = 0.8 + facePeak * 1.2 + edgePeak * 0.8 + backPeak * 0.3;

      // SpotLight gentle orbit to keep reflections alive
      o.slY = 1.5 + Math.sin(t * Math.PI * 4) * 0.5;
      o.slX = Math.sin(t * Math.PI * 3) * 0.6;

      o.sc = 1.0;
    }
    else {
      /* ── SETTLE: damped spring overshoot + bounce ── */
      const t = remap(p, 0.78, 1.0);
      const T = t * 4;

      // Ring: overshoot past 2π, bounce back — visible through p=0.98
      o.ringRy = Math.PI * 2 + dampSpring(T, 0.5, 0.5, 3.534);

      // Body: sympathetic wobble
      o.rx = RX_CENTER + dampSpring(T, 0.02, 2.5, 5.0);
      o.ry = dampSpring(T, 0.03, 2.0, 4.5);

      // Bloom on overshoot
      const ringBounce = dampSpring(T, 0.5, 0.5, 3.534);
      o.envI = 1.5 + Math.abs(ringBounce) * 2;
      o.blm = 0.8 + Math.pow(Math.max(0, Math.abs(ringBounce) / 0.25), 2) * 0.6;

      o.sc = 1.0;
    }
    return o;
  }

  /* ── Smooth state — initialized from sceneRing(ANIM_START) ── */
  const _initC = sceneRing(ANIM_START);
  let sRx = _initC.rx, sRy = _initC.ry, sRz = _initC.rz, sSc = _initC.sc;
  let sEnvI = _initC.envI, sBlm = _initC.blm, sSlY = _initC.slY, sSlX = _initC.slX, sRingRy = _initC.ringRy;
  const SP = 0.12;
  let _smoothVk = 0;

  /* Ticker off-screen: ring/small1 keep Three.js defaults (ringRy=0, small1 identity) until first
     capitanTick — visible as ~180° snap on inner ring + wrong pose for center strokes. One-time sync. */
  (function syncCapitanMeshesToCurrentScroll() {
    const c0 = sceneRing(J.p);
    if (ringPivot) ringPivot.rotation.y = c0.ringRy;
    if (EL.small1) {
      const sp0 = J.on ? Math.max(0, Math.min(1, (J.p - ANIM_START) / ANIM_RANGE)) : 0;
      animateSmall1(Math.round(sp0 * 1000));
    }
  })();

  tickFn = function capitanTick(time) {
    if (!running) return;

    /* ── Type B: skip velocity on first frame after wake ──
       When ticker sleeps (IO/visibility) but ST.onUpdate keeps moving J.p,
       J.prev stays stale. First frame after wake: J.p - J.prev = huge delta.
       Fix: equalize prev→current, so vk = 0 on wake frame. */
    if (_wakeSkip) {
      _wakeSkip = false;
      J.prev = J.p;
      _smoothVk = 0;
    }

    const scrollOnlyBadge = !badgeInteractReady;
    const targetInfluence = scrollOnlyBadge ? 0 : (mouse.near ? 1 : 0);
    mouse.influence += (targetInfluence - mouse.influence) * 0.04;

    /* ── Hover attract: mouse near → animation glides to 100% (disabled until badgeInteractReady) ── */
    const hoverTarget = scrollOnlyBadge ? 0 : (mouse.near ? 1 : 0);
    hoverAttract += (hoverTarget - hoverAttract) * 0.025; // slow, smooth glide
    if (Math.abs(hoverAttract) < 0.001) hoverAttract = 0;

    // Scroll progress (0→1) from wherever scroll is
    const scrollProgress = J.on
      ? Math.max(0, Math.min(1, (J.p - ANIM_START) / ANIM_RANGE))
      : 0;
    // Effective progress: blend scroll → 100% based on hover attract
    const effProgress = scrollOnlyBadge
      ? scrollProgress
      : scrollProgress + (1 - scrollProgress) * hoverAttract;
    const effP = ANIM_START + effProgress * ANIM_RANGE;
    const effFrame = Math.round(effProgress * 1000);
    _effectiveFrame = effFrame; // expose for applyIdleLevitation

    if (logoGroup) {
      const p = (scrollOnlyBadge || hoverAttract <= 0.01) ? J.p : effP;
      const active = (J.on && p > 0.003 && p < 0.997) || hoverAttract > 0.01;

      /* ── Idle levitation: ALWAYS runs (topO, POLAND wave, innerRing drift) ── */
      applyIdleLevitation(time);

      if (active) {
        const c = sceneRing(p);

        // Lerp everything smoothly
        sRx    = lerp(sRx,    c.rx,     SP);
        sRy    = lerp(sRy,    c.ry,     SP);
        sRz    = lerp(sRz,    c.rz,     SP);
        sSc    = lerp(sSc,    c.sc,     SP);
        sEnvI  = lerp(sEnvI,  c.envI,   SP);
        sBlm   = lerp(sBlm,   c.blm,    0.07);
        sSlY   = lerp(sSlY,   c.slY,    0.08);
        sSlX   = lerp(sSlX,   c.slX,    0.08);
        sRingRy = lerp(sRingRy, c.ringRy || 0, SP);

        // Micro-shimmer: gold always alive
        const shY = Math.sin(time * 2.3) * 0.004 + Math.sin(time * 3.7) * 0.002;
        const shX = Math.sin(time * 1.9) * 0.003;

        // Scroll velocity kick — smoothed (FIX B: lerp tłumi spiki ±17° → ±3°)
        _smoothVk += ((J.p - J.prev) * 2.5 - _smoothVk) * 0.18;
        const vk = _smoothVk;

        // ── Global levitation (old animation PHI harmonics, always running) ──
        const t1 = time * 1.3, t2 = time * 0.9;
        const levRx = Math.sin(t2) * 0.04 + Math.sin(t2 * PHI) * 0.02;
        const levRy = Math.sin(t1) * 0.11 + Math.sin(t1 * PHI) * 0.045 + Math.sin(t1 * PHI * PHI) * 0.02;
        const levRz = Math.sin(time * 0.4) * 0.01;

        // Mouse deltas (old animation mouse response)
        const mRx = mouse.y * 0.08;
        const mRy = mouse.x * 0.25;
        const inf = scrollOnlyBadge ? 0 : mouse.influence;

        // Organic layer: (RX_CENTER + levitation) ↔ (RX_CENTER + mouse)
        // Exactly like old animation: both branches include RX_CENTER
        const orgRx = RX_CENTER + levRx * (1 - inf) + mRx * inf;
        const orgRy = levRy * (1 - inf) + mRy * inf;
        const orgRz = levRz * (1 - inf);

        // Choreography delta fades on hover (old: auto faded to 0 at inf=1)
        // inf=0: full choreography + levitation
        // inf=1: ONLY mouse + RX_CENTER (identical to old animation)
        logoGroup.rotation.x = orgRx + (sRx - RX_CENTER) * (1 - inf) + shX;
        logoGroup.rotation.y = orgRy + sRy * (1 - inf) + shY + vk;
        logoGroup.rotation.z = orgRz + sRz * (1 - inf);

        // Scale
        const s = baseScaleFactor * sSc;
        logoGroup.scale.set(s, -s, s);

        // Inner ring: scroll drives outerPivot.y (opening/closing)
        // Local wobble on _localPivot is handled by applyIdleLevitation
        if (ringPivot) {
          ringPivot.rotation.y = sRingRy;
        }

        // Small "1": scroll animation + idle levitation
        animateSmall1(effFrame);
        applyS1Idle(time);

        // Material
        if (goldMaterial) goldMaterial.envMapIntensity = sEnvI;

        // Bloom
        bloomPass.strength = sBlm;

        // SpotLight
        spotLight.position.x = sSlX;
        spotLight.position.y = sSlY;

        // Update shadow only when light actually moved (delta-based, not position-based)
        if (Math.abs(sSlX - _lastSlX) > 0.05 || Math.abs(sSlY - _lastSlY) > 0.05) {
          baseRenderer.shadowMap.needsUpdate = true;
          _lastSlX = sSlX; _lastSlY = sSlY;
        }

      }
    }
    if (!shadowInitialized) { baseRenderer.shadowMap.needsUpdate = true; shadowInitialized = true; }
    scene.background = null;
    baseRenderer.render(scene, camera);
    // Bloom: every frame during scroll/hover, otherwise co 4 klatki (idle perlin <1Hz → 15fps bloom wystarczy)
    const scrolling = Math.abs(J.p - J.prev) > 0.0001;
    const hovering = hoverAttract > 0.01;
    const doBloom = scrolling || hovering || (frameCount % BLOOM_INTERVAL === 0);
    if (doBloom) { scene.background = bloomBg; composer.render(); }
    frameCount++;
  };

  ticking = true;
  gsap.ticker.add(tickFn);

  function pause() {
    if (!ticking) return;
    ticking = false; gsap.ticker.remove(tickFn);
    if (smoothRaf) { cancelAnimationFrame(smoothRaf); smoothRaf = 0; }
    if (inertiaRaf) { cancelAnimationFrame(inertiaRaf); inertiaRaf = 0; }
    if (pmRaf) { cancelAnimationFrame(pmRaf); pmRaf = 0; }
    if (posRaf) { cancelAnimationFrame(posRaf); posRaf = 0; }
    inertiaRunning = false;
    detachBadgePointerListeners();
  }

  function resume() {
    if (ticking) return; if (!running) return;
    _wakeSkip = true; // manual resume = wake → skip velocity spike
    ticking = true; gsap.ticker.add(tickFn);
    if (badgeInteractReady) attachBadgePointerListeners();
  }

  function kill() {
    pause();
    /* Stop rAF ghost loops */
    driftActive = false;
    inertiaRunning = false;
    if (smoothRaf) { cancelAnimationFrame(smoothRaf); smoothRaf = 0; }
    if (inertiaRaf) { cancelAnimationFrame(inertiaRaf); inertiaRaf = 0; }
    if (posRaf) { cancelAnimationFrame(posRaf); posRaf = 0; }
    /* GSAP instances cleanup */
    gsapInstances.forEach(inst => { try { inst.revert?.(); } catch(e){} try { inst.kill?.(); } catch(e){} }); gsapInstances.length = 0;
    try { badgeST.kill(); } catch (e) { console.error(e); } // ScrollTrigger cleanup
    cleanups.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    if (pmRaf) { cancelAnimationFrame(pmRaf); pmRaf = 0; }
    observers.forEach(o => { try { o?.disconnect?.(); } catch (e) { console.error(e); } });
    for (const g of allGeoRefs) { try { g.dispose(); } catch(e) {} }
    if (goldMaterial) { try { goldMaterial.dispose(); } catch (e) { console.error(e); } }
    try { baseRenderer.dispose(); } catch (e) { console.error(e); }
    try { bloomRenderer.dispose(); } catch (e) { console.error(e); }
    try { composer.dispose(); } catch (e) { console.error(e); }
    if (scene.environment) { try { scene.environment.dispose(); } catch (e) { console.error(e); } }
    try { baseRenderer.domElement.remove(); } catch (e) { console.error(e); }
    try { bloomRenderer.domElement.remove(); } catch (e) { console.error(e); }
  }

  return { pause, resume, kill };
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY WRAPPER — IO Gating Sciezka 1
// Opcja A: capitan bootowany async przez onasCapitanInit()
// DEV overlay usuniety (P3: FACTORY:DEV-OVERLAY removed)
// ─────────────────────────────────────────────────────────────────────────────

function factoryInit(container) {
  /* ── Subsystem init ── */
  var carouselInst = onasCarouselInit(container);
  if (!carouselInst) carouselInst = { pause:function(){}, resume:function(){}, kill:function(){} };

  var capitanEl = container.querySelector('#onas-capitan');
  var capitanInst = null;

/* ── IO Gating: Ścieżka 1 (Typ B) ── */
  var _paused = false;
  var _killed = false;
  var _io = null;
  var _ioDebounce = null;

  function _getRM() {
    var vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) || 800;
    // Smaller pre-activation window: suspend earlier after leaving viewport.
    return Math.min(320, Math.max(120, Math.round(vh * 0.2))) + 'px';
  }

  function _pause() {
    if (_paused || _killed) return;
    _paused = true;
    if (carouselInst) carouselInst.pause();
    if (capitanInst) capitanInst.pause();
  }

  function _resume() {
    if (!_paused || _killed) return;
    _paused = false;
    if (carouselInst) carouselInst.resume();
    if (capitanInst) capitanInst.resume();
  }

  function _kill() {
    _killed = true;
    _paused = true;
    if (_io) { _io.disconnect(); _io = null; }
    clearTimeout(_ioDebounce);
    if (carouselInst) { try { carouselInst.kill(); } catch(e) { console.error(e); } }
    if (capitanInst) { try { capitanInst.kill(); } catch(e) { console.error(e); } }
    carouselInst = null;
    capitanInst = null;
  }

  function _ioCallback(entries) {
    if (_killed) return;
    var entry = entries[0];
    if (!entry) return;
    if (entry.isIntersecting) { _resume(); }
    else { _pause(); }
  }

  function _recreateIO() {
    clearTimeout(_ioDebounce);
    _ioDebounce = setTimeout(function() {
      if (_killed) return;
      if (_io) _io.disconnect();
      var rm = _getRM();
      _io = new IntersectionObserver(_ioCallback, { rootMargin: rm + ' 0px ' + rm + ' 0px' });
      _io.observe(container);
    }, 50);
  }

  function _onVVResize() { _recreateIO(); }

  _recreateIO();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _onVVResize, { passive: true });
  }


  /* ── Boot capitan async (Opcja A — Three.js importowany dynamicznie w onasCapitanInit) ── */
  if (capitanEl) {
    onasCapitanInit(capitanEl).then(function(inst) {
      if (_killed) { if (inst) { try { inst.kill(); } catch(e) {} } return; }
      capitanInst = inst || { pause:function(){}, resume:function(){}, kill:function(){} };
      if (_paused) capitanInst.pause();
    }).catch(function(e) {
      console.warn('onas-capitan: boot failed', e);
      capitanInst = { pause:function(){}, resume:function(){}, kill:function(){} };
    });
  }


  /* ── Graceful degradation: onerror on press logos ── */
  var logos = container.querySelectorAll('.onas-press__logo');
  for (var li = 0; li < logos.length; li++) {
    logos[li].onerror = function() { this.classList.add('load-failed'); this.onerror = null; };
  }

  return { pause: _pause, resume: _resume, kill: _kill };
}

// ─────────────────────────────────────────────────────────────────────────────
// REACT ENGINE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function OnasEngine() {
  const rootRef = useRef(null);

  // Double rAF refresh po dynamic mount (manifest.dynamicImport: true)
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

  useGSAP(() => {
    gsap.registerPlugin(ScrollTrigger, Draggable);

    const el = rootRef.current;
    if (!el) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error('[P3] rootRef.current is null — ref not attached to <section>.');
      }
      return;
    }

    // Flex gap detection (Safari 13-14.0 fallback)
    (function() {
      var d = document.createElement('div');
      d.style.cssText = 'display:inline-flex;gap:1px;visibility:hidden;position:absolute';
      d.appendChild(document.createElement('div'));
      d.appendChild(document.createElement('div'));
      document.body.appendChild(d);
      var has = d.scrollWidth === 1;
      document.body.removeChild(d);
      if (!has) el.classList.add('no-flex-gap');
    })();

    const revealFailSafeId = window.setTimeout(() => {
      const sceneEl = el.querySelector('#onas-scene');
      const pressEl = el.querySelector('.onas-press');
      const textBlockEl = el.querySelector('.onas-text-block');
      if (sceneEl && sceneEl instanceof HTMLElement) sceneEl.style.visibility = 'visible';
      if (pressEl && pressEl instanceof HTMLElement) pressEl.style.visibility = 'visible';
      if (textBlockEl && textBlockEl instanceof HTMLElement) textBlockEl.style.visibility = 'visible';
    }, 1200);

    const inst = factoryInit(el);
    return () => {
      clearTimeout(revealFailSafeId);
      inst?.kill?.();
    };
  }, { scope: rootRef });

  return (
    <>
    <section id="onas-section" ref={rootRef}>


  {/* ====== CAPITAN (1:1 z Rating.txt) ====== */}
  <div className="banner fog-visible" id="onas-capitan">
    <div className="banner__mesh-top"></div>
    <div className="banner__mesh-fog"></div>

    <div className="banner__badge" id="onas-capitan-badgeWrapper">
      <svg
        id="onas-capitan-badge-svg"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'none' }}
        viewBox="0 0 339 323"
      >
        <path d="m37.6 15.6-.1 1.5-.2 1-.4.5-.5.2H26.2v31.9l-.2.5c-.1.2-.3.3-.7.4l-1.3.2-2 .1-2-.1-1.3-.2-.7-.4a.8.8 0 0 1-.2-.5V18.8H7.9a.8.8 0 0 1-.5-.2l-.3-.5-.2-1-.1-1.5.1-1.5.2-1 .3-.5.5-.2h28.4l.5.2.4.5.2 1c.2.3.2.8.2 1.5zm39.1 15.9c0 3.3-.4 6.2-1.2 8.8-.9 2.6-2.1 4.8-3.7 6.6a16.4 16.4 0 0 1-6.1 4.1c-2.4 1-5.2 1.4-8.3 1.4-3.1 0-5.9-.4-8.2-1.2-2.4-.8-4.2-2.1-5.9-3.7a16.7 16.7 0 0 1-3.5-6.3c-.8-2.5-1.2-5.5-1.2-9 0-3.1.4-6.1 1.2-8.7a16.4 16.4 0 0 1 9.8-10.6 22 22 0 0 1 8.5-1.4c3 0 5.7.4 8 1.2 2.4.8 4.2 2.1 5.9 3.7 1.5 1.6 2.7 3.7 3.6 6.3a32 32 0 0 1 1.1 8.8zm-8.5.4c0-2.1-.2-4-.5-5.6A11 11 0 0 0 66 22a7.6 7.6 0 0 0-3.1-2.8c-1.3-.7-3-1-5-1-2.1 0-3.7.3-5 1.1-1.3.8-2.4 1.7-3.3 2.9-.9 1.2-1.4 2.7-1.7 4.3a29 29 0 0 0 0 11.2c.3 1.7.9 3.1 1.6 4.4.8 1.2 1.8 2.2 3.1 2.8s3 1 5 1 3.7-.3 5-1.1c1.3-.8 2.4-1.7 3.3-3 .9-1.3 1.4-2.7 1.7-4.4.2-1.8.6-3.5.6-5.5zm42.9-7.7a13.3 13.3 0 0 1-4.1 10.2c-1.3 1.2-3 2.1-5 2.7-2 .7-4.2.9-6.9.9h-3.4v12.6l-.2.5c-.1.2-.3.3-.7.4l-1.2.2-2 .1-2-.1-1.3-.2-.7-.4a.8.8 0 0 1-.2-.5V15c0-1 .2-1.6.8-2.2.5-.4 1.2-.8 2-.8h9.4l2.7.1 3.1.4c1.2.2 2.4.7 3.7 1.3a10.7 10.7 0 0 1 5.1 5.8c.7 1.6.9 3 .9 4.6zm-8.6.6c0-1.4-.2-2.5-.8-3.5a5.9 5.9 0 0 0-1.8-2 7 7 0 0 0-2.3-.8l-2.5-.2h-3.5v13.4h3.7c1.3 0 2.4-.2 3.3-.5.9-.3 1.6-.9 2.2-1.4.5-.7 1-1.4 1.3-2.3.3-.8.4-1.6.4-2.7zM163 277.2c0 2.2-.3 4.1-1 5.7-.7 1.7-1.5 3.1-2.7 4.2a10.3 10.3 0 0 1-4.4 2.6c-1.7.7-3.8.9-6.2.9h-2.9V303l-.2.5-.5.4-1.1.2-1.7.1-1.7-.1-1.1-.2c-.3-.1-.4-.2-.5-.4l-.2-.5v-34.8c0-1 .2-1.6.7-2.2.4-.4 1.1-.8 1.7-.8h8.5l2.4.1 2.7.4a11.3 11.3 0 0 1 6.1 3.7c.8 1 1.4 2.1 1.7 3.4.2 1.4.4 2.8.4 4.4zm-7.6.6c0-1.4-.2-2.5-.7-3.4-.4-.9-1-1.5-1.6-2-.7-.4-1.3-.7-2.1-.8l-2.2-.2h-3v13.2h3.3c1.2 0 2.2-.2 2.9-.5s1.4-.9 2-1.4c.5-.7.9-1.3 1.1-2.2.2-.8.3-1.6.3-2.7zm45.2 6.6c0 3.3-.3 6.1-1.1 8.7a19 19 0 0 1-3.3 6.5 14.4 14.4 0 0 1-5.4 4c-2.2 1-4.7 1.4-7.4 1.4-2.8 0-5.2-.4-7.3-1.2-2.1-.8-3.8-2-5.2-3.6s-2.4-3.7-3.1-6.2a32.8 32.8 0 0 1 0-17.4c.8-2.5 1.8-4.7 3.3-6.4 1.4-1.7 3.3-3.1 5.4-4a18 18 0 0 1 7.5-1.4c2.7 0 5.1.4 7.2 1.2 2.1.8 3.8 2 5.2 3.6 1.4 1.6 2.4 3.7 3.1 6.2a30 30 0 0 1 1.1 8.6zm-7.6.4c0-2.1-.1-3.9-.4-5.5-.3-1.6-.8-3.1-1.5-4.3s-1.6-2.1-2.8-2.7-2.6-1-4.4-1c-1.7 0-3.3.3-4.4 1.1-1.2.8-2.2 1.7-2.9 2.9s-1.3 2.6-1.5 4.2a32.5 32.5 0 0 0 0 10.9c.3 1.7.8 3.1 1.5 4.3a6 6 0 0 0 2.8 2.7c1.2.7 2.6 1 4.4 1 1.8 0 3.3-.3 4.4-1.1a9 9 0 0 0 2.9-2.9 10 10 0 0 0 1.5-4.3c.2-1.6.4-3.4.4-5.3zm37.2 16.2-.1 1.5-.2 1-.3.5-.4.2h-21.1c-.7 0-1.1-.2-1.5-.5-.4-.4-.7-1-.7-2v-35.2l.2-.5.5-.4 1.1-.2 1.7-.1 1.7.1 1.1.2c.3.1.4.2.5.4l.2.5v31.2h16l.4.2.3.5.2 1c.4.5.4 1 .4 1.6zm33.5.4.4 1.7c.1.4 0 .8-.2 1s-.5.3-1.1.4l-2.2.1h-2.2l-1.2-.2-.5-.3-.3-.7-2.4-7.8h-13.3l-2.3 7.6-.3.8-.5.4-1.1.2-2 .1-2-.1c-.4-.1-.8-.2-1-.4-.2-.2-.2-.5-.2-1l.4-1.7 10.9-34.5c.1-.3.2-.7.4-.9l.7-.4 1.3-.2h4.9l1.5.2c.3.1.7.3.8.5l.4.9 11.1 34.3zm-16.3-28.5-5.1 16.5h10.1l-5-16.5zm48.4 28.6-.2 1.2-.5.9a2 2 0 0 1-.9.5l-1.1.2h-3l-1.6-.2a3 3 0 0 1-1.3-.8c-.4-.3-.8-.9-1.2-1.5-.3-.7-.8-1.4-1.2-2.5l-8.9-18.2c-.5-1.1-1.1-2.3-1.5-3.5l-1.4-3.7h-.1l.2 4.3.1 4.4V303l-.1.5-.5.4-1 .2-1.6.1-1.6-.1-1-.2-.5-.4-.1-.5v-34.9c0-1 .2-1.6.8-2.2.5-.4 1.1-.8 1.8-.8h3.9l1.7.2c.4.1.9.3 1.3.7l1.1 1.2 1 2 6.9 14.2 1.2 2.5 1.2 2.5 1.1 2.5 1 2.4-.1-4.3v-22.5l.2-.5.5-.4 1-.2 1.6-.1 1.5.1 1 .2c.2.1.4.2.4.4l.1.5v35h-.2zm35.4-17.2a27 27 0 0 1-1.3 9.1c-.9 2.5-2.1 4.6-3.7 6.2a15.4 15.4 0 0 1-5.9 3.6c-2.3.8-5 1.1-8.1 1.1h-8.6c-.7 0-1.1-.2-1.5-.5-.4-.4-.7-1-.7-2V268c0-.9.2-1.5.7-2 .4-.4 1-.5 1.5-.5h9.1c3.1 0 5.9.4 8.1 1.2 2.2.8 4.1 2.1 5.6 3.6 1.5 1.6 2.7 3.6 3.5 5.9.9 2.3 1.3 5.1 1.3 8.1zm-7.5.3c0-1.8-.2-3.6-.5-5.1-.4-1.6-1-2.9-2-4.1-.9-1.2-2-2.1-3.4-2.7s-3.1-1-5.4-1h-3.7v26.4h3.8c2 0 3.7-.3 5-.9a7.8 7.8 0 0 0 3.4-2.5c.9-1.1 1.6-2.5 2.1-4.2.4-1.8.7-3.7.7-5.9zM74.6 109.4v203.5H56.5V135.4l-31.8 13-6-16z"/>
        <path d="M113.6 76s-13 19.3-13 60.7a93 93 0 0 0 13 49.8V313H94.8V78.6L74.6 87l-63.3 26.1L5 96.5l108.6-44.7V76z"/>
        <path d="M215.4 17.7C155.6 17.7 107 68.6 107 131.4s48.5 113.7 108.4 113.7 108.4-50.9 108.4-113.7c-.1-62.8-48.6-113.7-108.4-113.7zm0 210c-50.2 0-91-43.2-91-96.3s40.8-96.3 91-96.3 91 43.2 91 96.3c-.1 53.1-40.8 96.3-91 96.3z"/>
        <path d="M215.4 56.6c-39.3 0-71.3 33.5-71.3 74.8s32 74.8 71.3 74.8 71.3-33.5 71.3-74.8c-.1-41.3-32-74.8-71.3-74.8zm0 132.2c-29.7 0-54-25.8-54-57.4s24.2-57.4 54-57.4 54 25.8 54 57.4c-.1 31.6-24.3 57.4-54 57.4z"/>
      </svg>
    </div>

    <div className="banner__content">
      <div className="banner__left">
        <svg className="banner__logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 769 441">
          <defs>
            <linearGradient id="onas-capitan-goldGrad" x1="0" y1="441" x2="700" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="4%" stop-color="#19140C"/>
              <stop offset="73%" stop-color="#8E7143"/>
              <stop offset="100%" stop-color="#C2A468"/>
            </linearGradient>
          </defs>
          <path fill="url(#onas-capitan-goldGrad)" d="M251 94c26-8 31-52 12-69-11-10-26-9-28-9h-66v145h11V97c80-2 63-2 89 66l11-4-16-44c-1-2-4-13-13-21zm-16-8h-55V27h55c1 0 11-1 20 7 11 8 10 35 0 44-8 8-19 8-20 8zm112 79c14 0 27-8 36-20v18h11V57h-11v17c-28-40-86-13-84 35 0 31 22 56 48 56zm0-100c48 1 48 87 0 88-48-1-48-87 0-88zm87 67c1 25 23 34 45 31v-11c-16 1-32-1-34-20l1-63h33V58h-34V26l-11 5v27h-19v11h19v63zm64-75h11v106h-11zm7-25c11 0 11-19 0-19s-11 19 0 19zm116 64v65h11c-2-35 15-104-40-106-13-1-28 2-37 13V57h-11v106h11v-51c-2-22 2-44 29-45 18-3 37 8 37 29zm80 61c15 0 28-7 37-18 0 24 5 57-29 59-10-2-23 3-38-10l-9 8c17 16 33 12 48 13 22 0 39-18 39-40V54h-11v19c-27-37-86-13-84 33 0 28 21 51 47 51zm0-92c48 1 48 80 0 81-47-1-47-80 0-81zM388 283c3-50-62-68-87-31h-1l1-18h-18l-1 33v117h20v-63h1c26 34 87 14 85-38zm-54 40c-18 0-32-12-32-29 1-5 0-20 2-24 4-14 17-23 31-23 45-1 42 79-1 76zm-95-89v18c-25-37-90-19-87 32-2 51 58 71 85 38h1v15h20V234h-19zm-1 60c-3 44-70 36-66-10-2-44 61-51 66-7v17zm289 44c15 0 27-6 34-16h1v15h20l-1-103h-18v18c-9-13-22-20-40-20-66 1-59 110 4 106zm3-91c31 2 35 29 31 55-4 13-16 21-31 21-43 3-46-77 0-76z"/>
          <path fill="url(#onas-capitan-goldGrad)" d="m466 335-1-14c-14 3-28 2-27-18v-54h29v-14h-29v-37l-20 11v26h-17v14h17v54c-2 32 24 40 48 32zm166-140c1-15-25-15-25 0s26 14 25 0zm-22 40h20v101h-20zm122 43v58h20c-2-38 12-105-39-104-19 0-32 10-37 19h-1l1-16h-19v101h20c0-6-2-66 1-70 11-29 57-23 54 12zM54 224c19-24 56-17 77 0l8-14a80 80 0 0 0-79-13c-29 11-42 41-42 71-1 30 11 58 40 68 27 9 57 6 81-13l-6-15c-28 22-78 25-89-17-6-20-5-50 10-67zm358 160-19-2c-12-25-10-25-22 0-28 4-27 1-7 20-5 28-6 25 18 13 24 12 23 15 17-13l14-13c2-2 1-4-1-5zm84 0-19-2c-12-25-10-25-22 0-28 4-27 1-7 20-5 28-6 25 18 13 24 12 22 15 17-13l14-13c2-2 1-4-1-5zm85 0-19-2c-12-25-10-25-22 0-27 4-26 1-6 20-6 28-7 25 17 13 24 12 23 15 18-13l13-13c2-2 1-4-1-5zm84 0-19-2c-12-25-10-25-22 0-27 4-26 1-7 20-5 28-6 25 18 13 24 12 23 15 18-13l13-13c2-2 1-4-1-5zm85 0-19-2c-12-25-10-25-22 0-28 4-26 1-7 20-5 28-7 26 18 13 25 13 22 15 17-13l14-13c2-2 1-4-1-5zm-15 16-1 1 1 2 3 19-17-9-1-1v-46l8 18 2 1 19 2-14 13z"/>
        </svg>
      </div>

      <div className="banner__divider"></div>

      <div className="banner__right">
        <h2 className="banner__heading">
          Owocni w gronie<br />
          10 najlepszych agencji<br />
          reklamowych w&nbsp;Polsce.
        </h2>
        <p className="banner__body">
          Raport amerykańskiej agencji ratingowej "Rating Captain" plasuje nas
          w gronie 10 najlepszych agencji w&nbsp;Polsce na podstawie prawdziwych opinii w&nbsp;Google.
        </p>
      </div>
    </div>

    <div className="banner__curve">
      <button className="curve-btn" id="onas-capitan-expandToggle">Jak powstaje raport</button>
    </div>

    <div className="banner__expand">
      <div className="banner__expand-text">
        <p>Raport tworzony jest przez amerykańską markę Rating Captain z&nbsp;siedzibą w&nbsp;Los Angeles 5101 Santa Monica Blvd Ste 8 Los Angeles, CA 90029.</p>
        <p>W raporcie pod uwagę zostały wzięte firmy z&nbsp;Polski z&nbsp;największą liczbą opinii w&nbsp;Google oraz najwyższą średnią oceną według opinii klientów wyłącznie z&nbsp;prawdziwych kont Google.</p>
        <p>Wszystkim agencjom gratulujemy poziomu i&nbsp;życzymy dalszych sukcesów.</p>
      </div>
    </div>
  </div>
  {/* /onas-capitan */}

  {/* ====== CAROUSEL ====== */}
  <section className="carousel-section" id="onas-carousel">
    <div className="scene" id="onas-scene">
      <div className="a3d" id="onas-inner"></div>
    </div>
  </section>

  <div className="onas-press">
    <div className="onas-press__text">
      <p><b style={{fontWeight:500}}>Pracujesz z tymi samymi ludźmi,</b><br />
      których znasz z publikacji na łamach:</p>
    </div>
    <div className="onas-press__logos">
      <Image decoding="async" src={logoA} alt="Logo publikacji" className="onas-press__logo" width={446} height={67} sizes="(max-width: 600px) 40vw, 20vw" />
      <Image fetchPriority="high" decoding="async" src={logoB} alt="Logo publikacji" className="onas-press__logo" width={466} height={91} sizes="(max-width: 600px) 40vw, 20vw" />
    </div>
  </div>

  <div className="onas-text-block">
    <div className="onas-sep-wrap onas-headline__sep--top">
      <span className="onas-headline__sep" aria-hidden="true"></span>
      <div className="lens-pill-wrapper">
        <div className="lens-pill-glow"></div>
        <div className="lens-pill-conic"></div>
        <span className="lens-pill" style={{padding:'4px 6px 4px 14px'}}>
          <span className="lens-pill-txt">0% mikrozarządzania</span>
          <span className="lens-pill-badge">100% ODCIĄŻENIA</span>
        </span>
      </div>
    </div>
    <h2 className="onas-headline" style={{
          backgroundImage: 'linear-gradient(135deg, #252030 2%, #2a2130 44%, #382630 56.7%, #512b2b 67.5%, #7d3527 80.2%, #7d3527 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
      Proces realizacji zaprojektowany dla<br className="br-headline" />
      <b style={{fontWeight:700}}>zapracowanych właścicieli firm.</b>
      <span className="onas-headline__sep" aria-hidden="true"></span>
    </h2>
    <p className="onas-subtitle">
      <b style={{color:'#c53c0a'}}>Twój wkład =</b> 2 spotkania online <b style={{color:'#c53c0a'}}>+</b> decyzje w kluczowych momentach.<br className="br-desktop" />
      {' '}Resztę bierzemy na siebie. <i>(Masz spokój i wolną głowę.)</i>
    </p>
  </div>

  {/* VIDEO POPUP — inside #onas-section for proper scoping */}
  <div id="onas-video-popup">
    <div className="popup-panel">
      <div className="popup-close">✕</div>
      <div className="popup-video-wrap">
        {createElement('wistia-player', {
          'media-id': 'fds00b5wst',
          seo: 'false',
          aspect: '1.7777777777777777',
        })}
      </div>
      <div className="popup-content">
        <span className="popup-tag">Porozmawiajmy o twoich liczbach</span>
        <h3 className="popup-title"><b>Otrzymaj 3 propozycje cenowe</b> na projekt dla swojej firmy.</h3>
        <div className="popup-buttons">
          <a className="popup-cta" href={CENNIK_STRONY_URL}>Otrzymaj wycenę teraz →</a>
          <button className="popup-close-text" type="button">Zamknij wideo</button>
        </div>
      </div>
    </div>
  </div>

    </section>
    </>
  );
}
