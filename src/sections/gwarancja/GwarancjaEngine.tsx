"use client";

import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getDeviceTier } from "@/lib/autoTier";
import "./gwarancja-section.css";

/**
 * Engine sidecar (B1.1): renderuje wyłącznie wizualne warstwy sekcji — video,
 * tarcze, cursor. Treść SEO (h1, p, CTA, pill) jest SSR'owana przez
 * `GwarancjaSectionWrapper` i nie jest częścią tego chunka. `ssr: false` →
 * Engine NIE pojawia się w initial HTML; hydracja 2400 LoC wypadów poza first load.
 *
 * Kontrakt z wrapperem:
 *  - `rootRef` wskazuje na `<section id="gwarancja-section">` (scope dla useGSAP i init).
 *  - Wrapper renderuje `<section>/<div.lens-scene>/<div#gwarancja-container>` —
 *    engine wypełnia `#gwarancja-container` layerami (video+cursor+tarcze).
 *  - Wszystkie `container.querySelector` w `init()` dalej działają, bo rootRef = section,
 *    a section zawiera zarówno engine-DOM jak i SSR content-group (CTA, pill, h1).
 */

/** ≤600px: tylko szkło — plik mechanizmu nie jest ładowany (brak src na video). */
const GWARANCJA_MOBILE_MAX_W = 600;
const GWARANCJA_MECHANISM_VIDEO_SRC =
  "/videos/gwarancja/Strony-Gwarancja-MECHANIZM-MINIFILE.mp4";

// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// Next.js pre-renderuje Client Components na serwerze — window/document nie istnieją.
// registerPlugin() WYŁĄCZNIE wewnątrz useGSAP(() => { ... }) jak poniżej.

function init(container: HTMLElement): {
  kill: () => void;
  pause: () => void;
  resume: () => void;
} {
  const $ = (sel: string) => container.querySelector(sel);
  const $$ = (sel: string) => container.querySelectorAll(sel);
  const $id = (id: string) => container.querySelector("#" + id);

  const cleanups: (() => void)[] = [],
    gsapInstances: gsap.core.Tween[] = [],
    timerIds: { kill: () => void }[] = [],
    observers: IntersectionObserver[] = [];

  const containerEl = $id("gwarancja-container");
  const maskWrap = $id("gwarancja-layer-top-wrap");
  const videoBottom = $id("gwarancja-layer-bottom");
  const videoTop = $id("gwarancja-layer-top");
  const isVideo = (el: Element | null) => el && el.tagName === "VIDEO";
  if (isVideo(videoTop)) {
    if (
      typeof window !== "undefined" &&
      window.innerWidth > GWARANCJA_MOBILE_MAX_W
    ) {
      (videoTop as HTMLVideoElement).setAttribute("fetchpriority", "high");
    }
  }
  const cursorStage = $id("gwarancja-cursor-stage");
  const cursorPivot = $id("gwarancja-cursor-pivot");

  const tarczaGauge = $id("gwarancja-tarcza-gauge");
  const tarczaTextRing = $id("gwarancja-tarcza-text-ring");
  const tarczaCenterCircle = $id("gwarancja-tarcza-center-circle");
  const tarczaSecondsLeft = $id("gwarancja-tarcza-seconds-left");
  const tarczaSecondsRight = $id("gwarancja-tarcza-seconds-right");

  // === SHARED STATE ===
  const maskState = { alpha: 0, radius: 0 };
  const maskPos = { x: 0, y: 0 };
  let targetAlpha = 0,
    idleTimerRef: gsap.core.Tween | null = null,
    paused = false;
  const pauseHooks: (() => void)[] = [],
    resumeHooks: (() => void)[] = [];
  let xTo: gsap.QuickToFunc | null = null,
    yTo: gsap.QuickToFunc | null = null;
  let mxTo: gsap.QuickToFunc | null = null,
    myTo: gsap.QuickToFunc | null = null;

  if (
    !containerEl ||
    !tarczaGauge ||
    !tarczaSecondsLeft ||
    !tarczaSecondsRight ||
    !cursorStage
  ) {
    console.error("[gwarancja] init: critical elements missing — abort");
    return { kill: () => {}, pause: () => {}, resume: () => {} };
  }

  // === RESPONSIVE SCALE ===
  const BASE_RADIUS = 140;
  const BASE_FEATHER = 80;
  const BASE_PAD = 180;
  const MOBILE_BREAKPOINT = GWARANCJA_MOBILE_MAX_W;
  const SCALE_REF = 1400;
  const SCALE_MIN = 0.45;
  let lensScale = 1;
  let scaledRadius = BASE_RADIUS;
  let scaledPad = BASE_PAD;
  let scaledFeather = BASE_FEATHER;
  const weakDeviceDisabled = getDeviceTier() === 0;
  let isMobileDisabled = false;
  let bottomVideoLoaded = false;
  let mechanismVideoPrimed = false;

  function computeScale() {
    const w = window.innerWidth;
    if (w <= MOBILE_BREAKPOINT || weakDeviceDisabled) {
      if (!isMobileDisabled) {
        isMobileDisabled = true;
        unbindDoc();
      }
      lensScale = 0;
      return;
    }
    const wasMobile = isMobileDisabled;
    isMobileDisabled = false;
    if (wasMobile) mechanismVideoPrimed = false;
    lensScale = Math.max(SCALE_MIN, Math.min(1, w / SCALE_REF));
    scaledRadius = BASE_RADIUS * lensScale;
    scaledPad = BASE_PAD * lensScale;
    scaledFeather = BASE_FEATHER * lensScale;
    if (cursorPivot)
      (cursorPivot as HTMLElement).style.transform =
        `translate(-50%, -50%) scale(${lensScale})`;
    if (wasMobile && isContainerVisible) bindDoc();
  }
  let isVirtuallyInside = false,
    isContainerVisible = false,
    documentListenerBound = false;
  let lastMouseX = 0,
    lastMouseY = 0,
    rafPending = false;
  computeScale();

  let cachedRect = (containerEl as HTMLElement).getBoundingClientRect();
  /** Ostatni odczyt layoutu — throttling w processMousePos (Layout w trace). */
  let lastRectReadAt = performance.now();
  const RECT_FORCE_SYNC_MS = 250;
  let rectDirty = false;
  let rectDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollRectRaf: number | null = null;
  function updateCachedRect() {
    cachedRect = (containerEl as HTMLElement).getBoundingClientRect();
    lastRectReadAt = performance.now();
    rectDirty = false;
  }
  /** Scroll: max 1×/klatkę (rAF), bez opóźnienia 100 ms — świeży rect przy przewijaniu. */
  function scheduleRectFromScroll() {
    if (scrollRectRaf != null) return;
    scrollRectRaf = requestAnimationFrame(() => {
      scrollRectRaf = null;
      updateCachedRect();
    });
  }
  function debouncedRectUpdate() {
    if (rectDebounceTimer) clearTimeout(rectDebounceTimer);
    rectDebounceTimer = setTimeout(() => {
      updateCachedRect();
      computeScale();
    }, 100);
    rectDirty = true;
  }
  let rectListenersBound = false;
  function bindRectListeners() {
    if (rectListenersBound) return;
    window.addEventListener("scroll", scheduleRectFromScroll, {
      passive: true,
    });
    window.addEventListener("resize", debouncedRectUpdate, { passive: true });
    rectListenersBound = true;
  }
  function unbindRectListeners() {
    if (!rectListenersBound) return;
    window.removeEventListener("scroll", scheduleRectFromScroll);
    window.removeEventListener("resize", debouncedRectUpdate);
    if (scrollRectRaf != null) {
      cancelAnimationFrame(scrollRectRaf);
      scrollRectRaf = null;
    }
    if (rectDebounceTimer) {
      clearTimeout(rectDebounceTimer);
      rectDebounceTimer = null;
    }
    rectListenersBound = false;
  }
  cleanups.push(() => {
    unbindRectListeners();
  });

  // === TARCZA STATE ===
  const TARGET_FPS = 30,
    FRAME_TIME = 1000 / TARGET_FPS;

  const VELOCITY_LERP = 1 - Math.pow(0.75, 2);
  const TILT_FRICTION = Math.pow(0.94, 2);
  const VELOCITY_DECAY = Math.pow(0.8, 2);
  const RIPPLE_INC = 0.08;
  const MAX_DELTA = 2.0;
  const TILT_IDLE_INC = 2;
  const EPS = 0.3;
  const GC = 150,
    GR = 103,
    TICKS = 120;
  const DEG2RAD = Math.PI / 180;

  const lineData: {
    cosA: number;
    sinA: number;
    baseLength: number;
    phaseK: number;
    lastX2: number;
    lastY2: number;
  }[] = [];
  const lineElements: SVGLineElement[] = [];
  for (let i = 0; i < TICKS; i++) {
    const ad = i * 3,
      ar = ad * DEG2RAD;
    let len: number, w: number, op: number;
    if (i % 30 === 0) {
      len = 15;
      w = 1.2;
      op = 1;
    } else if (i % 10 === 0) {
      len = 12;
      w = 0.8;
      op = 1;
    } else {
      len = 8;
      w = 0.5;
      op = 1;
    }
    const ca = Math.cos(ar),
      sa = Math.sin(ar);
    const x1 = GC + GR * ca,
      y1 = GC + GR * sa,
      x2 = GC + (GR - len) * ca,
      y2 = GC + (GR - len) * sa;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("stroke", "#111111");
    line.setAttribute("stroke-width", String(w));
    line.setAttribute("opacity", String(op));
    line.setAttribute("stroke-dasharray", "0 20");
    tarczaGauge.appendChild(line);
    lineData.push({
      cosA: ca,
      sinA: sa,
      baseLength: len,
      phaseK: ad * 0.05,
      lastX2: x2,
      lastY2: y2,
    });
    lineElements.push(line);
  }

  let tActive = false,
    tFollowing = false,
    tLastFrame = 0;
  let tCursorNormX = 0,
    tCursorNormY = 0;
  const gs = {
    tiltX: 0,
    tiltY: 0,
    svX: 0,
    svY: 0,
    lrcX: 0,
    lrcY: 0,
    tiltIdle: 0,
    isRet: false,
  };
  let cState = { scale: 0, rotation: -180 },
    giState = { scale: 0, rotation: -180 },
    tiState = { scale: 0, rotation: -180 };
  let retTween: gsap.core.Tween | null = null,
    ratchetAngle = 0,
    ratchetStart = 0,
    ripplePhase = 0;
  let lastFontSize = -1,
    letterAnims: { cancel?: () => void; kill?: () => void }[] = [],
    upSpans: SVGTSpanElement[] = [],
    downSpans: SVGTSpanElement[] = [];
  const _safariSVGFix = /^((?!chrome|android).)*safari/i.test(
    navigator.userAgent,
  );

  let tLastMove = 0,
    txtIdleTw: gsap.core.Tween | null = null;
  let txtState = { scale: 1.1, opacity: 1.0, fontSize: 16 },
    isTxtIdle = false,
    isFirstIdle = true;
  const TXT_IDLE = { scale: 0.97, opacity: 0.25, fontSize: 14 },
    TXT_ACTIVE = { scale: 1.1, opacity: 1.0, fontSize: 16 };
  const secCfg = {
    dots: 5,
    arc: 30,
    maxS: 2.2,
    minS: 0.7,
    maxO: 0.85,
    minO: 0.08,
    steps: 5,
    speed: 3000,
    intro: 1,
    r: 130,
    cx: 181,
    cy: 170,
  };
  let secState = { scale: 1.1, opacity: 1.0 };
  const SEC_ACT = { scale: 1.1, opacity: 1.0 },
    SEC_IDLE = { scale: 0.97, opacity: 0.25 };
  let secFrame: number | null = null,
    secStart: number | null = null,
    secActive = false,
    secOutro = false,
    secOutroStart: number | null = null;
  const secOutroDur = 1000;
  let cLeftDots: SVGCircleElement[] = [],
    cRightDots: SVGCircleElement[] = [];

  const masterTL = gsap.timeline({ paused: true });
  masterTL.to(
    lineElements,
    {
      attr: { "stroke-dasharray": "20 0" },
      duration: 0.225,
      stagger: { each: 0.005, from: "start" },
      ease: "power2.out",
    },
    0,
  );

  const smoothBounce = (p: number) => {
    if (p < 0.7) {
      const t = p / 0.7;
      return t * t * (3 - 2 * t) * 1.08;
    } else if (p < 0.85) {
      const t = (p - 0.7) / 0.15;
      return 1.08 - t * t * (3 - 2 * t) * 0.08;
    }
    return 1;
  };

  function splitText(pid: string, txt: string, fw: number) {
    const p = $id(pid);
    if (!p) return [];
    p.textContent = "";
    const s: SVGTSpanElement[] = [];
    txt.split("").forEach((c: string) => {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      t.textContent = c;
      t.style.opacity = "0";
      t.style.fontWeight = String(fw);
      p.appendChild(t);
      s.push(t);
    });
    return s;
  }
  function resetSpans(spans: SVGTSpanElement[]) {
    for (let i = 0; i < spans.length; i++) {
      const el = spans[i];
      if (el) {
        el.style.opacity = "0";
        el.style.fontSize = "";
      }
    }
  }
  // Pre-create tspans once — reused on every hover
  upSpans = splitText("gwarancja-tp-up", "Precyzja wewnątrz", 200);
  downSpans = splitText("gwarancja-tp-down", "Elegancja na zewnątrz", 200);

  let secDotsCreated = false;
  const _tarczaLeft = tarczaSecondsLeft!,
    _tarczaRight = tarczaSecondsRight!;
  function createSecDots() {
    if (secDotsCreated) {
      for (let i = 0; i < cLeftDots.length; i++) {
        const cl = cLeftDots[i],
          cr = cRightDots[i];
        if (cl) cl.setAttribute("opacity", "0");
        if (cr) cr.setAttribute("opacity", "0");
      }
      return;
    }
    cLeftDots = [];
    cRightDots = [];
    for (let i = 0; i < secCfg.dots; i++) {
      const l = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      l.setAttribute("fill", "#111111");
      l.setAttribute("opacity", "0");
      _tarczaLeft.appendChild(l);
      cLeftDots.push(l);
      const r = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      r.setAttribute("fill", "#111111");
      r.setAttribute("opacity", "0");
      _tarczaRight.appendChild(r);
      cRightDots.push(r);
    }
    secDotsCreated = true;
  }

  function animSec(ts: number) {
    if (!secActive && !secOutro) return;
    const el = ts - (secStart ?? 0);
    const {
      cx,
      cy,
      r,
      dots,
      arc,
      maxS,
      minS,
      maxO,
      minO,
      steps,
      speed,
      intro,
    } = secCfg;
    const vt = Math.min(1, el / (speed * intro));
    let op = 1;
    if (secOutro) {
      const oe = ts - (secOutroStart ?? 0);
      const lp = Math.min(1, oe / secOutroDur);
      op = 1 - (1 - Math.pow(1 - lp, 3));
      if (op <= 0) {
        secOutro = false;
        secFrame = null;
        for (let i = 0; i < cLeftDots.length; i++) {
          const cl = cLeftDots[i],
            cr = cRightDots[i];
          if (cl) cl.setAttribute("opacity", "0");
          if (cr) cr.setAttribute("opacity", "0");
        }
        return;
      }
    }
    const sd = speed / steps;
    const cs = Math.floor(el / sd);
    const sp = (el % sd) / sd;
    const esp = smoothBounce(sp);
    const cp = ((cs % steps) + esp) / steps;
    const ha = arc / 2;
    for (let i = 0; i < dots; i++) {
      const bp = (i + 0.5) / dots;
      const dp = (bp + cp) % 1;
      const la = (180 + ha - dp * arc) * DEG2RAD;
      const ra = (-ha + dp * arc) * DEG2RAD;
      const d = Math.abs(dp - 0.5) * 2;
      const e = 1 - Math.pow(d, 1.5);
      let sz = minS + (maxS - minS) * e;
      let o = minO + (maxO - minO) * e;
      if (dp > vt) {
        o = 0;
        sz = minS;
      }
      if (secOutro) {
        sz *= op;
        o *= op;
      }
      o *= secState.opacity;
      sz *= secState.scale;
      const sr = r * secState.scale;
      const ld = cLeftDots[i],
        rd = cRightDots[i];
      if (ld) {
        ld.cx.baseVal.value = cx + sr * Math.cos(la);
        ld.cy.baseVal.value = cy + sr * Math.sin(la);
        ld.r.baseVal.value = sz;
        ld.setAttribute("opacity", String(o));
      }
      if (rd) {
        rd.cx.baseVal.value = cx + sr * Math.cos(ra);
        rd.cy.baseVal.value = cy + sr * Math.sin(ra);
        rd.r.baseVal.value = sz;
        rd.setAttribute("opacity", String(o));
      }
    }
    secFrame = requestAnimationFrame(animSec);
  }

  function startSec() {
    createSecDots();
    secStart = performance.now();
    secActive = true;
    secOutro = false;
    if (secFrame) cancelAnimationFrame(secFrame);
    secFrame = requestAnimationFrame(animSec);
  }
  function stopSec() {
    secActive = false;
    secOutro = true;
    secOutroStart = performance.now();
  }
  function resetSec() {
    secActive = false;
    secOutro = false;
    if (secFrame) {
      cancelAnimationFrame(secFrame);
      secFrame = null;
    }
    for (let i = 0; i < cLeftDots.length; i++) {
      const cl = cLeftDots[i],
        cr = cRightDots[i];
      if (cl) cl.setAttribute("opacity", "0");
      if (cr) cr.setAttribute("opacity", "0");
    }
  }

  // Pause/resume hook — seconds RAF
  let _wasSecActive = false,
    _wasSecOutro = false;
  pauseHooks.push(() => {
    _wasSecActive = secActive;
    _wasSecOutro = secOutro;
    if (secFrame) {
      cancelAnimationFrame(secFrame);
      secFrame = null;
    }
    secActive = false;
    secOutro = false;
  });
  resumeHooks.push(() => {
    if (_wasSecActive || _wasSecOutro) {
      secActive = _wasSecActive;
      secOutro = _wasSecOutro;
      secFrame = requestAnimationFrame(animSec);
    }
  });

  function updateGauge3D() {
    const rvx = tCursorNormX - gs.lrcX,
      rvy = tCursorNormY - gs.lrcY;
    gs.lrcX = tCursorNormX;
    gs.lrcY = tCursorNormY;
    gs.svX += (rvx - gs.svX) * VELOCITY_LERP;
    gs.svY += (rvy - gs.svY) * VELOCITY_LERP;
    if (Math.abs(gs.svX) + Math.abs(gs.svY) > 0.0003) {
      if (retTween) {
        retTween.kill();
        retTween = null;
      }
      gs.isRet = false;
      gs.tiltIdle = 0;
      let dx = -gs.svY * 180,
        dy = gs.svX * 180;
      dx = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, dx));
      dy = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, dy));
      gs.tiltX = Math.max(-15, Math.min(15, gs.tiltX + dx));
      gs.tiltY = Math.max(-15, Math.min(15, gs.tiltY + dy));
    } else {
      gs.tiltIdle += TILT_IDLE_INC;
      gs.tiltX *= TILT_FRICTION;
      gs.tiltY *= TILT_FRICTION;
      gs.svX *= VELOCITY_DECAY;
      gs.svY *= VELOCITY_DECAY;
      if (
        gs.tiltIdle > 12 &&
        !gs.isRet &&
        (Math.abs(gs.tiltX) > 0.8 || Math.abs(gs.tiltY) > 0.8)
      ) {
        gs.isRet = true;
        retTween = gsap.to(gs, {
          tiltX: 0,
          tiltY: 0,
          duration: 0.5,
          ease: "power2.out",
          onComplete: () => {
            gs.isRet = false;
            retTween = null;
          },
        });
      }
    }
  }

  function updateRipple() {
    if (giState.scale < 0.01) return;
    ripplePhase += RIPPLE_INC;
    for (let i = 0; i < lineData.length; i++) {
      const d = lineData[i],
        le = lineElements[i];
      if (!d || !le) continue;
      const w = Math.sin(ripplePhase * 2 + d.phaseK) * 0.5;
      const fl = Math.max(4, d.baseLength + w * 4);
      const x2 = GC + (GR - fl) * d.cosA,
        y2 = GC + (GR - fl) * d.sinA;
      if (Math.abs(x2 - d.lastX2) > EPS || Math.abs(y2 - d.lastY2) > EPS) {
        le.x2.baseVal.value = x2;
        le.y2.baseVal.value = y2;
        d.lastX2 = x2;
        d.lastY2 = y2;
      }
    }
  }

  function startTxtIdle() {
    if (isTxtIdle) return;
    isTxtIdle = true;
    if (txtIdleTw) txtIdleTw.kill();
    txtIdleTw = gsap.to(txtState, {
      ...TXT_IDLE,
      duration: 1,
      ease: "power2.out",
    });
    gsapInstances.push(
      gsap.to(secState, { ...SEC_IDLE, duration: 1, ease: "power2.out" }),
    );
    gsapInstances.push(
      gsap.to(maskState, {
        alpha: 0.0,
        duration: 1,
        ease: "power2.out",
        overwrite: "auto",
      }),
    );
    targetAlpha = 0.0;
    isFirstIdle = false;
  }
  function stopTxtIdle() {
    if (!isTxtIdle) return;
    isTxtIdle = false;
    if (txtIdleTw) txtIdleTw.kill();
    txtIdleTw = gsap.to(txtState, {
      ...TXT_ACTIVE,
      duration: 1,
      ease: "power2.out",
    });
    gsapInstances.push(
      gsap.to(secState, { ...SEC_ACT, duration: 1, ease: "power2.out" }),
    );
    gsapInstances.push(
      gsap.to(maskState, {
        alpha: 0.5,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto",
      }),
    );
    targetAlpha = 0.5;
  }
  function chkTxtIdle(ts: number) {
    if (!tActive) return;
    if (ts - tLastMove > (isFirstIdle ? 1400 : 400) && !isTxtIdle)
      startTxtIdle();
  }

  function animLettersIn() {
    letterAnims.forEach((a) => {
      if (a.cancel) a.cancel();
      else if (a.kill) a.kill();
    });
    letterAnims = [];
    resetSpans(upSpans);
    resetSpans(downSpans);
    lastFontSize = -1;
    let lf = 0;
    if (_safariSVGFix) {
      upSpans
        .slice()
        .reverse()
        .forEach((s, i) => {
          const tl = gsap.timeline({ delay: i * 0.03 });
          tl.fromTo(
            s,
            { opacity: 0, fontSize: 0 },
            { opacity: 1, fontSize: 22, duration: 0.6, ease: "power1.inOut" },
          ).to(s, {
            fontSize: 18,
            duration: 0.4,
            ease: "power1.inOut",
            onComplete() {
              gsap.set(s, { willChange: "auto" });
            },
          });
          letterAnims.push({ cancel: () => tl.kill() });
          lf = Math.max(lf, 1000 + i * 30);
        });
      downSpans.forEach((s, i) => {
        const tl = gsap.timeline({ delay: i * 0.03 });
        tl.fromTo(
          s,
          { opacity: 0, fontSize: 0 },
          { opacity: 1, fontSize: 22, duration: 0.6, ease: "power1.inOut" },
        ).to(s, {
          fontSize: 18,
          duration: 0.4,
          ease: "power1.inOut",
          onComplete() {
            gsap.set(s, { willChange: "auto" });
          },
        });
        letterAnims.push({ cancel: () => tl.kill() });
        lf = Math.max(lf, 1000 + i * 30);
      });
    } else {
      upSpans
        .slice()
        .reverse()
        .forEach((s, i) => {
          const a = s.animate(
            [
              { opacity: 0, fontSize: "0px" },
              { opacity: 1, fontSize: "22px", offset: 0.6 },
              { opacity: 1, fontSize: "18px" },
            ],
            {
              duration: 1000,
              delay: i * 30,
              easing: "ease-in-out",
              fill: "forwards",
            },
          );
          letterAnims.push(a);
          lf = Math.max(lf, 1000 + i * 30);
        });
      downSpans.forEach((s, i) => {
        const a = s.animate(
          [
            { opacity: 0, fontSize: "0px" },
            { opacity: 1, fontSize: "22px", offset: 0.6 },
            { opacity: 1, fontSize: "18px" },
          ],
          {
            duration: 1000,
            delay: i * 30,
            easing: "ease-in-out",
            fill: "forwards",
          },
        );
        letterAnims.push(a);
        lf = Math.max(lf, 1000 + i * 30);
      });
    }
    const t = setTimeout(() => {
      if (!tActive) return;
      txtState.fontSize = 18;
      gsap.to(txtState, { fontSize: 16, duration: 1, ease: "power2.out" });
    }, lf);
    timerIds.push({ kill: () => clearTimeout(t) });
  }

  function animLettersOut() {
    const cs = `${txtState.fontSize}px`;
    if (_safariSVGFix) {
      upSpans.forEach((s, i) => {
        const tw = gsap.to(s, {
          opacity: 0,
          fontSize: 0,
          duration: 0.6,
          delay: i * 0.02,
          ease: "power1.inOut",
          onComplete() {
            gsap.set(s, { willChange: "auto" });
          },
        });
        letterAnims.push({ cancel: () => tw.kill() });
      });
      downSpans
        .slice()
        .reverse()
        .forEach((s, i) => {
          const tw = gsap.to(s, {
            opacity: 0,
            fontSize: 0,
            duration: 0.6,
            delay: i * 0.02,
            ease: "power1.inOut",
            onComplete() {
              gsap.set(s, { willChange: "auto" });
            },
          });
          letterAnims.push({ cancel: () => tw.kill() });
        });
    } else {
      upSpans.forEach((s, i) => {
        letterAnims.push(
          s.animate(
            [
              { opacity: 1, fontSize: cs },
              { opacity: 0, fontSize: "0px" },
            ],
            {
              duration: 600,
              delay: i * 20,
              easing: "ease-in-out",
              fill: "forwards",
            },
          ),
        );
      });
      downSpans
        .slice()
        .reverse()
        .forEach((s, i) => {
          letterAnims.push(
            s.animate(
              [
                { opacity: 1, fontSize: cs },
                { opacity: 0, fontSize: "0px" },
              ],
              {
                duration: 600,
                delay: i * 20,
                easing: "ease-in-out",
                fill: "forwards",
              },
            ),
          );
        });
    }
  }

  function tarczaLoop(ts: number) {
    if (!tFollowing) return;
    if (ts - tLastFrame < FRAME_TIME) {
      requestAnimationFrame(tarczaLoop);
      return;
    }
    tLastFrame = ts;
    if (tActive) {
      updateGauge3D();
      const el = ts - ratchetStart;
      ratchetAngle = (el / 385) * 6;
      (tarczaGauge as HTMLElement).style.transform =
        `perspective(400px) rotateX(${gs.tiltX}deg) rotateY(${gs.tiltY}deg) rotate(${giState.rotation + ratchetAngle}deg) scale(${giState.scale})`;
      (tarczaCenterCircle as HTMLElement).style.transform =
        `scale(${cState.scale}) rotate(${cState.rotation}deg)`;
      updateRipple();
      const tts = tiState.scale * txtState.scale;
      (tarczaTextRing as HTMLElement).style.transform =
        `scale(${tts}) rotate(${tiState.rotation}deg)`;
      (tarczaTextRing as HTMLElement).style.opacity = String(txtState.opacity);
      const fs = txtState.fontSize;
      if (Math.abs(fs - lastFontSize) > 0.01) {
        (tarczaTextRing as HTMLElement).style.setProperty(
          "--gwarancja-dynamic-fs",
          `${fs}px`,
        );
        lastFontSize = fs;
      }
      chkTxtIdle(ts);
    }
    requestAnimationFrame(tarczaLoop);
  }

  function startTarczaFollow() {
    if (tFollowing) return;
    tFollowing = true;
    tLastFrame = 0;
    requestAnimationFrame(tarczaLoop);
  }

  // Pause/resume hook — tarcza RAF
  let _wasTarczaFollowing = false,
    _wasTarczaActive = false;
  pauseHooks.push(() => {
    _wasTarczaFollowing = tFollowing;
    _wasTarczaActive = tActive;
    tFollowing = false;
  });
  resumeHooks.push(() => {
    if (_wasTarczaFollowing && _wasTarczaActive) startTarczaFollow();
  });

  function tarczaIntro(rx: number, ry: number) {
    letterAnims.forEach((a) => {
      if (a.cancel) a.cancel();
    });
    letterAnims = [];
    masterTL.pause().progress(0);
    if (txtIdleTw) {
      txtIdleTw.kill();
      txtIdleTw = null;
    }
    txtState.scale = 1.1;
    txtState.opacity = 1.0;
    txtState.fontSize = 16;
    isFirstIdle = true;
    isTxtIdle = false;
    tLastMove = performance.now();
    lastFontSize = -1;
    gsap.killTweensOf(secState);
    secState.scale = 1.1;
    secState.opacity = 1.0;
    tCursorNormX = (rx / cachedRect.width) * 2 - 1;
    tCursorNormY = (ry / cachedRect.height) * 2 - 1;
    gs.lrcX = tCursorNormX;
    gs.lrcY = tCursorNormY;
    (tarczaTextRing as HTMLElement).style.opacity = "1";
    gsap.killTweensOf(giState);
    gsap.killTweensOf(cState);
    gsap.killTweensOf(tiState);
    giState.scale = 0;
    giState.rotation = -180;
    gsapInstances.push(
      gsap.to(giState, {
        scale: 1,
        rotation: 0,
        duration: 1,
        ease: "power3.out",
      }),
    );
    cState.scale = 0;
    cState.rotation = -180;
    gsapInstances.push(
      gsap.to(cState, {
        scale: 1,
        rotation: 0,
        duration: 1,
        ease: "power3.out",
      }),
    );
    tiState.scale = 0;
    tiState.rotation = -180;
    gsapInstances.push(
      gsap.to(tiState, {
        scale: 1,
        rotation: 0,
        duration: 1,
        ease: "power3.out",
      }),
    );
    tActive = true;
    ratchetStart = performance.now();
    startSec();
    startTarczaFollow();
    masterTL.play();
    animLettersIn();
  }

  function tarczaOutro() {
    tActive = false;
    tFollowing = false;
    stopSec();
    gsap.killTweensOf(cState);
    gsap.killTweensOf(giState);
    gsap.killTweensOf(tiState);
    gsapInstances.push(
      gsap.to(giState, {
        scale: 0,
        rotation: -180,
        duration: 1,
        ease: "power3.in",
        onUpdate() {
          (tarczaGauge as HTMLElement).style.transform =
            `scale(${giState.scale}) rotate(${giState.rotation}deg)`;
        },
      }),
    );
    gsapInstances.push(
      gsap.to(cState, {
        scale: 0,
        rotation: -180,
        duration: 1,
        ease: "power3.in",
        onUpdate() {
          (tarczaCenterCircle as HTMLElement).style.transform =
            `scale(${cState.scale}) rotate(${cState.rotation}deg)`;
        },
      }),
    );
    gsapInstances.push(
      gsap.to(tiState, {
        scale: 0,
        rotation: -180,
        duration: 1,
        ease: "power3.in",
        onUpdate() {
          (tarczaTextRing as HTMLElement).style.transform =
            `scale(${tiState.scale}) rotate(${tiState.rotation}deg)`;
        },
        onComplete() {
          gsap.set(cursorStage, { opacity: 0 });
        },
      }),
    );
    if (txtIdleTw) {
      txtIdleTw.kill();
      txtIdleTw = null;
    }
    animLettersOut();
    masterTL.reverse();
  }

  // === GSAP SETUP ===
  // NOTE: gsap.registerPlugin(ScrollTrigger) moved to useGSAP scope (GSAP-SSR-01)

  maskPos.x = cachedRect.width / 2;
  maskPos.y = cachedRect.height / 2;
  mxTo = gsap.quickTo(maskPos, "x", { duration: 0.6, ease: "power3.out" });
  myTo = gsap.quickTo(maskPos, "y", { duration: 0.6, ease: "power3.out" });

  gsap.set(cursorStage, { x: cachedRect.width / 2, y: cachedRect.height / 2 });
  xTo = gsap.quickTo(cursorStage, "x", { duration: 0.6, ease: "power3.out" });
  yTo = gsap.quickTo(cursorStage, "y", { duration: 0.6, ease: "power3.out" });

  let hasEnteredOnce = false;
  let lmCx = -999,
    lmCy = -999,
    lmR = -999,
    lmA = -999,
    lmNone = false;
  function renderMask() {
    if (paused || !maskWrap || !isContainerVisible) return;
    if (!hasEnteredOnce || (maskState.radius < 0.5 && maskState.alpha < 0.01)) {
      if (!lmNone) {
        (maskWrap as HTMLElement).style.webkitMaskImage =
          "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 1px)";
        (maskWrap as HTMLElement).style.maskImage =
          "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 1px)";
        lmNone = true;
      }
      return;
    }
    const cx = maskPos.x,
      cy = maskPos.y,
      r = maskState.radius,
      a = maskState.alpha;
    if (
      Math.abs(cx - lmCx) < 0.5 &&
      Math.abs(cy - lmCy) < 0.5 &&
      Math.abs(r - lmR) < 0.1 &&
      Math.abs(a - lmA) < 0.005
    )
      return;
    lmCx = cx;
    lmCy = cy;
    lmR = r;
    lmA = a;
    lmNone = false;
    const g = `radial-gradient(circle at ${cx}px ${cy}px,rgba(0,0,0,${a}) 0px,rgba(0,0,0,${a}) ${r}px,rgba(0,0,0,0) ${r + scaledFeather}px)`;
    (maskWrap as HTMLElement).style.webkitMaskImage = g;
    (maskWrap as HTMLElement).style.maskImage = g;
  }
  gsap.ticker.add(renderMask);
  cleanups.push(() => gsap.ticker.remove(renderMask));

  // Pause/resume hook — mask ticker
  pauseHooks.push(() => gsap.ticker.remove(renderMask));
  resumeHooks.push(() => gsap.ticker.add(renderMask));

  // === DOCUMENT-LEVEL TRACKING ===
  function processMousePos() {
    rafPending = false;
    if (paused || !isContainerVisible || isMobileDisabled) return;
    const now = performance.now();
    if (rectDirty || now - lastRectReadAt >= RECT_FORCE_SYNC_MS) {
      updateCachedRect();
    }
    const x = lastMouseX - cachedRect.left,
      y = lastMouseY - cachedRect.top,
      h = cachedRect.height,
      w = cachedRect.width;
    const inX = x >= 0 && x <= w;
    // Rozszerzona strefa lens (jak FIX B): pełna wysokość + 50px — bez osobnej strefy tarczy,
    // żeby maska i zegar zawsze były zsynchronizowane (tarczaOutro tylko przy handleMouseLeave).
    const should = inX && y >= -50 && y <= h + 50;
    if (should && !isVirtuallyInside) {
      isVirtuallyInside = true;
      handleMouseEnter(x, y);
    } else if (!should && isVirtuallyInside) {
      isVirtuallyInside = false;
      handleMouseLeave();
    }
    if (inX && y >= -50 && y <= h + 50) {
      mxTo!(x);
      myTo!(y);
      const cx = Math.max(scaledPad, Math.min(w - scaledPad, x));
      const cy = Math.max(scaledPad, Math.min(h - scaledPad, y));
      xTo!(cx);
      yTo!(cy);
    }
    if (isVirtuallyInside) {
      tCursorNormX = (x / w) * 2 - 1;
      tCursorNormY = (y / h) * 2 - 1;
      tLastMove = performance.now();
      stopTxtIdle();
      if (targetAlpha !== 0.5) {
        gsapInstances.push(
          gsap.to(maskState, {
            alpha: 0.5,
            duration: 0.3,
            ease: "power2.out",
            overwrite: "auto",
          }),
        );
        targetAlpha = 0.5;
      }
    }
  }

  function handleDocMouseMove(e: MouseEvent) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(processMousePos);
    }
  }
  function bindDoc() {
    if (documentListenerBound) return;
    document.addEventListener("mousemove", handleDocMouseMove, {
      passive: true,
    });
    documentListenerBound = true;
  }
  function unbindDoc() {
    if (!documentListenerBound) return;
    document.removeEventListener("mousemove", handleDocMouseMove);
    documentListenerBound = false;
    if (isVirtuallyInside) {
      isVirtuallyInside = false;
      handleMouseLeave();
    }
  }

  // === VIDEO LAZY LOAD ===
  /** Jednorazowe .load() na wideo mechanizmu — bez tego pierwszy play() często czeka na sieć/dekodowanie (duże opóźnienie przy hover). */
  function primeMechanismVideoOnce() {
    if (mechanismVideoPrimed || !isVideo(videoTop) || isMobileDisabled) return;
    mechanismVideoPrimed = true;
    try {
      (videoTop as HTMLVideoElement).load();
    } catch {
      mechanismVideoPrimed = false;
    }
  }
  function loadBottomVideo() {
    if (bottomVideoLoaded || !isVideo(videoBottom)) return;
    (videoBottom as HTMLVideoElement).load();
    (videoBottom as HTMLVideoElement).play().catch(() => {});
    bottomVideoLoaded = true;
  }

  // Aureola bind/unbind stubs — filled by CTA AUREOLA block
  let bindAureola = () => {},
    unbindAureola = () => {};

  const io = new IntersectionObserver(
    (e) => {
      isContainerVisible = e[0]?.isIntersecting ?? false;
      if (paused) return; // state tracked above, but no bind/unbind while paused
      if (isContainerVisible) {
        if (!isMobileDisabled) {
          updateCachedRect();
          computeScale();
          bindDoc();
          bindRectListeners();
          bindAureola();
        } else {
          unbindDoc();
          unbindRectListeners();
          unbindAureola();
        }
        loadBottomVideo();
        primeMechanismVideoOnce();
        if (isVideo(videoTop) && !isMobileDisabled) {
          (videoTop as HTMLVideoElement).play().catch(() => {});
        } else if (isVideo(videoTop)) {
          (videoTop as HTMLVideoElement).pause();
        }
        if (isVideo(videoBottom)) {
          (videoBottom as HTMLVideoElement).play().catch(() => {});
        }
        container.classList.remove("lens-oop");
      } else {
        unbindDoc();
        unbindRectListeners();
        unbindAureola();
        if (isVideo(videoTop)) (videoTop as HTMLVideoElement).pause();
        if (isVideo(videoBottom)) (videoBottom as HTMLVideoElement).pause();
        container.classList.add("lens-oop");
      }
    },
    { rootMargin: "200px 0px" },
  );
  io.observe(containerEl);
  observers.push(io);
  cleanups.push(() => unbindDoc());

  // Pierwszy callback IO bywa 1 klatkę później — jeśli kontener już blisko viewport, od razu rozpocznij pobieranie mechanizmu.
  const _mechanismPrimeRaf = requestAnimationFrame(() => {
    if (paused || isMobileDisabled) return;
    const r = (containerEl as HTMLElement).getBoundingClientRect();
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const m = 200;
    if (r.bottom <= -m || r.top >= vh + m) return;
    primeMechanismVideoOnce();
    if (isVideo(videoTop) && (videoTop as HTMLVideoElement).paused) {
      (videoTop as HTMLVideoElement).play().catch(() => {});
    }
  });
  cleanups.push(() => cancelAnimationFrame(_mechanismPrimeRaf));

  // FIX 1: Direct mouseenter — bypass IO delay (React-specyficzne).
  // Ten sam setup co przy wejściu w viewport (IO), żeby wideo mechanizmu grało od pierwszej klatki.
  const _onDirectEnter = (e: MouseEvent) => {
    if (paused || isMobileDisabled) return;
    updateCachedRect();
    computeScale();
    if (!isContainerVisible) isContainerVisible = true;
    container.classList.remove("lens-oop");
    bindDoc();
    bindRectListeners();
    bindAureola();
    loadBottomVideo();
    primeMechanismVideoOnce();
    if (isVideo(videoTop))
      (videoTop as HTMLVideoElement).play().catch(() => {});
    if (isVideo(videoBottom) && bottomVideoLoaded)
      (videoBottom as HTMLVideoElement).play().catch(() => {});
    const x = e.clientX - cachedRect.left;
    const y = e.clientY - cachedRect.top;
    if (!isVirtuallyInside) {
      isVirtuallyInside = true;
      handleMouseEnter(x, y);
    }
  };
  (containerEl as HTMLElement).addEventListener("mouseenter", _onDirectEnter, {
    passive: true,
  });
  cleanups.push(() =>
    (containerEl as HTMLElement).removeEventListener(
      "mouseenter",
      _onDirectEnter,
    ),
  );

  // Pause/resume hook — doc + rect + aureola listeners, media
  let _wasDocBound = false,
    _wasRectBound = false,
    _wasContainerVisible = false;
  pauseHooks.push(() => {
    _wasDocBound = documentListenerBound;
    _wasRectBound = rectListenersBound;
    _wasContainerVisible = isContainerVisible;
    unbindDoc();
    unbindRectListeners();
    unbindAureola();
    if (isVideo(videoTop)) (videoTop as HTMLVideoElement).pause();
    if (isVideo(videoBottom)) (videoBottom as HTMLVideoElement).pause();
  });
  resumeHooks.push(() => {
    if (!_wasContainerVisible) return;
    if (!isMobileDisabled) {
      if (_wasDocBound) bindDoc();
      if (_wasRectBound) bindRectListeners();
      bindAureola();
    } else {
      unbindDoc();
      unbindRectListeners();
      unbindAureola();
    }
    loadBottomVideo();
    primeMechanismVideoOnce();
    if (isVideo(videoTop) && !isMobileDisabled) {
      (videoTop as HTMLVideoElement).play().catch(() => {});
    } else if (isVideo(videoTop)) {
      (videoTop as HTMLVideoElement).pause();
    }
    if (isVideo(videoBottom)) {
      (videoBottom as HTMLVideoElement).play().catch(() => {});
    }
  });

  // === UNIFIED ENTER/LEAVE ===
  function handleMouseEnter(rx: number, ry: number) {
    if (paused) return;
    hasEnteredOnce = true;
    // FIX 4a: seed alpha + initial radius — prześwit od pierwszej ramki
    maskState.alpha = 0.02;
    maskState.radius = 0.25 * scaledRadius;
    lmNone = false;
    maskPos.x = rx;
    maskPos.y = ry;
    const clampX = Math.max(
      scaledPad,
      Math.min(cachedRect.width - scaledPad, rx),
    );
    const clampY = Math.max(
      scaledPad,
      Math.min(cachedRect.height - scaledPad, ry),
    );
    gsap.set(cursorStage, { x: clampX, y: clampY });
    mxTo!(rx);
    myTo!(ry);
    xTo!(clampX);
    yTo!(clampY);
    gsapInstances.push(
      gsap.to(maskState, {
        radius: scaledRadius,
        duration: 0.8,
        ease: "elastic.out(1, 0.75)",
        overwrite: "auto",
      }),
    );
    // FIX 4b musi pójść zawsze z enter — nie tylko z processMousePos: tam tween alpha→0.5 jest
    // za if (targetAlpha !== 0.5). Ustawienie targetAlpha=0.5 przed ruchem myszy blokowało tween
    // i zostawało alpha≈0.02 (niewidoczny mechanizm), a pełna widoczność wracała dopiero po stopTxtIdle.
    gsapInstances.push(
      gsap.to(maskState, {
        alpha: 0.5,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto",
      }),
    );
    targetAlpha = 0.5;
    gsap.set(cursorStage, { scale: 1, opacity: 1 });
    tarczaIntro(rx, ry);
  }

  function handleMouseLeave() {
    if (paused) return;
    gsapInstances.push(
      gsap.to(maskState, {
        radius: 0,
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto",
      }),
    );
    gsapInstances.push(
      gsap.to(maskState, { alpha: 0, duration: 0.5, overwrite: "auto" }),
    );
    targetAlpha = 0;
    if (idleTimerRef && idleTimerRef.kill) idleTimerRef.kill();
    idleTimerRef = null;
    tarczaOutro();
  }

  // === LIFECYCLE ===
  function pause() {
    if (paused) return;
    paused = true;
    container.classList.add("lens-oop");
    pauseHooks.forEach((fn) => fn());
  }
  function resume() {
    if (!paused) return;
    paused = false;
    if (isContainerVisible) container.classList.remove("lens-oop");
    resumeHooks.forEach((fn) => fn());
  }
  function kill() {
    paused = true;
    container.classList.add("lens-oop");
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
    gsapInstances.forEach((tw) => {
      if (tw) {
        if (tw.revert) tw.revert();
        if (tw.kill) tw.kill();
      }
    });
    gsapInstances.length = 0;
    timerIds.forEach((t) => {
      if (t && t.kill) t.kill();
    });
    timerIds.length = 0;
    observers.forEach((o) => o.disconnect());
    observers.length = 0;
    if (isVideo(videoTop)) {
      (videoTop as HTMLVideoElement).pause();
      (videoTop as HTMLVideoElement).removeAttribute("src");
      (videoTop as HTMLVideoElement).load();
    }
    if (isVideo(videoBottom)) {
      (videoBottom as HTMLVideoElement).pause();
      (videoBottom as HTMLVideoElement).removeAttribute("src");
      (videoBottom as HTMLVideoElement).load();
    }
    tFollowing = false;
    tActive = false;
    resetSec();
    letterAnims.forEach((a) => {
      if (a.cancel) a.cancel();
    });
    letterAnims = [];
    if (retTween) {
      retTween.kill();
      retTween = null;
    }
    if (txtIdleTw) {
      txtIdleTw.kill();
      txtIdleTw = null;
    }
    masterTL.kill();
  }

  // === CTA — WAVE CLICK (moved inside init) ===
  $$(".btn-wrapper-wave").forEach((wrapper: Element) => {
    const _touchActivate = () => {};
    wrapper.addEventListener("touchstart", _touchActivate, { passive: true }); // iOS :active activation
    cleanups.push(() =>
      wrapper.removeEventListener("touchstart", _touchActivate),
    );
    const handler = () => {
      const wave = document.createElement("span");
      wave.classList.add("wave-effect", "animating");
      wrapper.insertBefore(wave, wrapper.firstChild);
      wave.addEventListener("animationend", () => wave.remove());
    };
    wrapper.addEventListener("click", handler);
    cleanups.push(() => wrapper.removeEventListener("click", handler));
  });

  // ═══════════════════════════════════════════════════════════════
  // SHARED STAR SPRITES — pre-rendered for Halo + Cursor
  // 3 twinkle phases × star shape + 1 dot sprite. Created once.
  // ═══════════════════════════════════════════════════════════════
  const STAR_PTS = 8;
  const starCos = new Float32Array(STAR_PTS),
    starSin = new Float32Array(STAR_PTS);
  for (let i = 0; i < STAR_PTS; i++) {
    const a = (i * Math.PI) / 4;
    starCos[i] = Math.cos(a);
    starSin[i] = Math.sin(a);
  }

  const STAR_SPR_SZ = 128;
  const STAR_SPR_HALF = STAR_SPR_SZ / 2;
  const sharedStarPhases = [0, 0.5, 1.0].map((tw) => {
    const c = document.createElement("canvas");
    c.width = STAR_SPR_SZ;
    c.height = STAR_SPR_SZ;
    const ctx = c.getContext("2d")!;
    ctx.translate(STAR_SPR_HALF, STAR_SPR_HALF);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, STAR_SPR_HALF);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(0.3, "#fffde8");
    gr.addColorStop(0.6, "#ffeaa0");
    gr.addColorStop(1, "rgba(255,234,160,0)");
    ctx.fillStyle = gr;
    const refSize = STAR_SPR_HALF / 2;
    const oR = refSize * (1.4 + tw * 0.5);
    const iR = refSize * 0.35;
    ctx.beginPath();
    for (let i = 0; i < STAR_PTS; i++) {
      const r = (i & 1) === 0 ? oR : iR;
      const sc = starCos[i],
        ss = starSin[i];
      if (sc == null || ss == null) continue;
      if (i === 0) ctx.moveTo(sc * r, ss * r);
      else ctx.lineTo(sc * r, ss * r);
    }
    ctx.closePath();
    ctx.fill();
    return c;
  });
  const sharedDotSprite = document.createElement("canvas");
  sharedDotSprite.width = 64;
  sharedDotSprite.height = 64;
  {
    const ctx = sharedDotSprite.getContext("2d")!;
    ctx.translate(32, 32);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 32 * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // === CTA — AUREOLA (moved inside init) ===
  {
    const canDoHover =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      window.innerWidth > 600;
    if (canDoHover) {
      const aWrapper = $(".btn-wrapper-wave") as HTMLElement | null;
      const aButton = $(".cta-button") as HTMLElement | null;
      if (aWrapper && aButton) {
        const aCanvas = document.createElement("canvas");
        const aCtx = aCanvas.getContext("2d")!;
        aCanvas.style.cssText =
          "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:5;";
        aWrapper.insertBefore(aCanvas, aWrapper.firstChild);

        let aWidth: number,
          aHeight: number,
          aCenterX: number,
          aCenterY: number,
          aButtonWidth = 0;
        const A_PROX_X = 400,
          A_PROX_Y = 180,
          A_PROX_EXIT_X = 415,
          A_PROX_EXIT_Y = 195;
        let aIsHovering = false,
          aIsInProximity = false,
          aWasHoveredRecently = false;
        let aBtnRect: DOMRect | null = null,
          aBtnCenterX = 0,
          aBtnCenterY = 0;

        function aUpdateButtonRect() {
          aBtnRect = aButton!.getBoundingClientRect();
          aBtnCenterX = aBtnRect.left + aBtnRect.width / 2;
          aBtnCenterY = aBtnRect.top + aBtnRect.height / 2;
        }
        function aShouldBeActive() {
          return aIsHovering || (aIsInProximity && !aWasHoveredRecently);
        }

        let aAnimationId: number | null = null,
          aIsAnimating = false,
          aResizeScheduled = false;

        function aResize() {
          aResizeScheduled = false;
          const dpr = window.devicePixelRatio || 1;
          const localBtnRect = aButton!.getBoundingClientRect();
          aButtonWidth = localBtnRect.width;
          aWidth = aButtonWidth * 3;
          aHeight = localBtnRect.height * 5;
          aCanvas.width = Math.round(aWidth * dpr);
          aCanvas.height = Math.round(aHeight * dpr);
          aCanvas.style.width = aWidth + "px";
          aCanvas.style.height = aHeight + "px";
          aCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          aCenterX = aWidth / 2;
          aCenterY = aHeight / 2;
          aUpdateButtonRect();
        }
        function aScheduleResize() {
          if (!aResizeScheduled) {
            aResizeScheduled = true;
            requestAnimationFrame(aResize);
          }
        }
        window.addEventListener("resize", aScheduleResize);
        cleanups.push(() =>
          window.removeEventListener("resize", aScheduleResize),
        );
        aResize();

        const aRand = (min: number, max: number) =>
          Math.random() * (max - min) + min;

        class HaloParticle {
          angle: number;
          radius: number;
          angleSpeed: number;
          masterAlpha: number;
          fadeRate: number;
          wakeDelay: number;
          baseSize: number;
          rotation: number;
          rotationSpeed: number;
          twinkle: number;
          twinkleSpeed: number;
          x: number;
          y: number;
          size: number;
          life: number;
          constructor() {
            this.x = 0;
            this.y = 0;
            this.size = 0;
            this.life = 0;
            this.angle = 0;
            this.radius = 0;
            this.angleSpeed = 0;
            this.masterAlpha = 0;
            this.fadeRate = 0;
            this.wakeDelay = 0;
            this.baseSize = 0;
            this.rotation = 0;
            this.rotationSpeed = 0;
            this.twinkle = 0;
            this.twinkleSpeed = 0;
            this.init();
          }
          init() {
            this.angle = aRand(0, Math.PI * 2);
            this.radius = (aButtonWidth > 0 ? aButtonWidth : 200) * 0.55;
            this.angleSpeed =
              aRand(0.0056, 0.0105) * (Math.random() > 0.5 ? 1 : -1);
            this.masterAlpha = 0;
            this.fadeRate = aRand(0.015, 0.035);
            this.wakeDelay = aRand(0, 20);
            this.baseSize = Math.random() < 0.75 ? aRand(2, 4) : aRand(5, 8);
            this.rotation = aRand(0, Math.PI * 2);
            this.rotationSpeed = (Math.random() - 0.5) * 0.1;
            this.twinkle = aRand(0, Math.PI * 2);
            this.twinkleSpeed = aRand(0.1, 0.28);
          }
          update() {
            // 2× step: physics calibrated for 60fps, we run at 30fps
            this.angle += this.angleSpeed * 2;
            this.rotation += this.rotationSpeed * 2;
            this.twinkle += this.twinkleSpeed * 2;
            if (aShouldBeActive()) {
              if (this.wakeDelay > 0) this.wakeDelay--;
              else if (this.masterAlpha < 1) this.masterAlpha += this.fadeRate;
            } else {
              this.wakeDelay = aRand(0, 15);
              if (this.masterAlpha > 0) this.masterAlpha -= this.fadeRate;
            }
            const sinA = Math.sin(this.angle),
              cosA = Math.cos(this.angle);
            this.x = aCenterX + cosA * this.radius * 0.6;
            this.y = aCenterY - 39 + sinA * this.radius * 0.12;
            this.size = this.baseSize * (1.5 - (sinA + 1) * 0.45);
            this.life = this.masterAlpha;
          }
          draw(dpr: number) {
            if (this.life <= 0.01) return;
            const tw = (Math.sin(this.twinkle) + 1) * 0.5,
              al = this.life * (0.5 + tw * 0.5);
            const co = Math.cos(this.rotation),
              si = Math.sin(this.rotation);
            aCtx.setTransform(
              co * dpr,
              si * dpr,
              -si * dpr,
              co * dpr,
              this.x * dpr,
              this.y * dpr,
            );
            aCtx.globalAlpha = al;
            // Select nearest twinkle phase sprite (0→compact, 1→medium, 2→expanded)
            const phase = tw < 0.25 ? 0 : tw < 0.75 ? 1 : 2;
            const drawR = this.size * 2;
            const starSprite = sharedStarPhases[phase];
            if (starSprite)
              aCtx.drawImage(starSprite, -drawR, -drawR, drawR * 2, drawR * 2);
            // White center dot — life alpha only (no twinkle), more stable anchor
            aCtx.globalAlpha = this.life;
            if (sharedDotSprite)
              aCtx.drawImage(
                sharedDotSprite,
                -drawR,
                -drawR,
                drawR * 2,
                drawR * 2,
              );
          }
        }

        const aParticles: HaloParticle[] = [];
        for (let i = 0; i < 50; i++) aParticles.push(new HaloParticle());

        function aCheckAllFaded() {
          for (let i = 0; i < aParticles.length; i++) {
            const ap = aParticles[i];
            if (ap && ap.masterAlpha > 0.01) return false;
          }
          return true;
        }
        const A_FRAME_MS = 1000 / 30; // 30fps throttle
        let aLastPaint = 0;
        function aAnimate(ts: number) {
          if (ts - aLastPaint < A_FRAME_MS) {
            aAnimationId = requestAnimationFrame(aAnimate);
            return;
          }
          aLastPaint = ts;
          const dpr = window.devicePixelRatio || 1;
          aCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          aCtx.clearRect(0, 0, aWidth, aHeight);
          aCtx.globalCompositeOperation = "lighter";
          for (let i = 0; i < aParticles.length; i++) {
            const ap = aParticles[i];
            if (ap) {
              ap.update();
              ap.draw(dpr);
            }
          }
          if (!aShouldBeActive() && aCheckAllFaded()) {
            aIsAnimating = false;
            aAnimationId = null;
            return;
          }
          aAnimationId = requestAnimationFrame(aAnimate);
        }
        function aStartAnimation() {
          if (!aIsAnimating) {
            aIsAnimating = true;
            aAnimationId = requestAnimationFrame(aAnimate);
          }
        }

        const aOnEnter = () => {
          aIsHovering = true;
          aStartAnimation();
        };
        const aOnLeave = () => {
          aIsHovering = false;
          aWasHoveredRecently = true;
        };
        const aOnMove = (e: MouseEvent) => {
          if (!aBtnRect) aUpdateButtonRect();
          const dx = Math.abs(e.clientX - aBtnCenterX),
            dy = Math.abs(e.clientY - aBtnCenterY);
          if (!aIsInProximity && dx < A_PROX_X && dy < A_PROX_Y) {
            aIsInProximity = true;
            if (!aIsHovering && !aWasHoveredRecently) aStartAnimation();
          } else if (
            aIsInProximity &&
            (dx > A_PROX_EXIT_X || dy > A_PROX_EXIT_Y)
          ) {
            aIsInProximity = false;
            aWasHoveredRecently = false;
          }
        };
        let aBtnRectScheduled = false;
        const aOnScroll = () => {
          if (!aBtnRectScheduled) {
            aBtnRectScheduled = true;
            requestAnimationFrame(() => {
              aUpdateButtonRect();
              aBtnRectScheduled = false;
            });
          }
        };
        const aOnVisChange = () => {
          if (document.hidden) {
            aIsHovering = false;
            aIsInProximity = false;
            aWasHoveredRecently = false;
          }
        };

        aButton.addEventListener("mouseenter", aOnEnter);
        aButton.addEventListener("mouseleave", aOnLeave);

        let aDocBound = false;
        bindAureola = () => {
          if (aDocBound) return;
          document.addEventListener("mousemove", aOnMove, { passive: true });
          window.addEventListener("scroll", aOnScroll, { passive: true });
          aDocBound = true;
        };
        unbindAureola = () => {
          if (!aDocBound) return;
          document.removeEventListener("mousemove", aOnMove);
          window.removeEventListener("scroll", aOnScroll);
          aDocBound = false;
          aIsInProximity = false;
          aWasHoveredRecently = false;
        };
        // Bind immediately only if section already visible (IO may have fired)
        if (isContainerVisible) bindAureola();
        document.addEventListener("visibilitychange", aOnVisChange);

        // Pause/resume hook — aureola RAF
        let _wasAAnimating = false;
        pauseHooks.push(() => {
          _wasAAnimating = aIsAnimating;
          if (aAnimationId) {
            cancelAnimationFrame(aAnimationId);
            aAnimationId = null;
          }
          aIsAnimating = false;
        });
        resumeHooks.push(() => {
          if (_wasAAnimating) aStartAnimation();
        });

        cleanups.push(() => {
          if (aAnimationId) cancelAnimationFrame(aAnimationId);
          aButton!.removeEventListener("mouseenter", aOnEnter);
          aButton!.removeEventListener("mouseleave", aOnLeave);
          unbindAureola();
          document.removeEventListener("visibilitychange", aOnVisChange);
          if (aCanvas.parentNode) aCanvas.parentNode.removeChild(aCanvas);
        });
      }
    }
  }

  // === CTA — CURSOR PARTICLES (moved inside init) ===
  {
    const canDoHover =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      window.innerWidth > 600;
    if (canDoHover) {
      const cWrapper = $(".btn-wrapper-wave") as HTMLElement | null;
      const cButton = $(".cta-button") as HTMLElement | null;
      if (cWrapper && cButton) {
        const cCanvas = document.createElement("canvas");
        const cCtx = cCanvas.getContext("2d")!;
        cCanvas.style.cssText =
          "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:100;width:500px;height:300px;";
        const cDpr = window.devicePixelRatio || 1;
        cCanvas.width = Math.round(500 * cDpr);
        cCanvas.height = Math.round(300 * cDpr);
        cWrapper.appendChild(cCanvas);

        let cIsHovering = false,
          cLastSpawn = 0;
        const cSpawnRate = 31;
        let cMouseX = 250,
          cMouseY = 150,
          cTargetMouseX = 250,
          cTargetMouseY = 150,
          cLastMouseX2 = 250,
          cLastMouseY2 = 150;
        let cMouseSpeed = 0,
          cMouseAngle = 0,
          cSmoothedSpeed = 0,
          cIdleTime = 0,
          cLastTimestamp = 0;
        let cAnimationId: number | null = null,
          cIsAnimating = false;

        const C_MAX_PARTICLES = 150;
        const C_FRICTION = 0.970225; // Math.pow(0.985, 2) pre-computed for 2× step
        const cParticles: (CursorParticle | null)[] = new Array(
          C_MAX_PARTICLES,
        );
        let cActiveCount = 0;
        for (let i = 0; i < C_MAX_PARTICLES; i++) cParticles[i] = null;

        // Glow sprite (cursor-specific — warm halo for 25% of particles)
        const glowSprite = document.createElement("canvas");
        glowSprite.width = 128;
        glowSprite.height = 128;
        const glowCtx = glowSprite.getContext("2d")!;
        const gg = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gg.addColorStop(0, "rgba(255,255,255,1)");
        gg.addColorStop(0.2, "rgba(255,253,232,0.71)");
        gg.addColorStop(0.5, "rgba(255,234,160,0.29)");
        gg.addColorStop(1, "rgba(255,234,160,0)");
        glowCtx.fillStyle = gg;
        glowCtx.fillRect(0, 0, 128, 128);

        let cCachedRect: DOMRect | null = null,
          cCachedScaleX = 1,
          cCachedScaleY = 1;
        function cUpdateCachedRect() {
          cCachedRect = cCanvas.getBoundingClientRect();
          cCachedScaleX = 500 / cCachedRect.width;
          cCachedScaleY = 300 / cCachedRect.height;
        }
        requestAnimationFrame(cUpdateCachedRect);
        let cResizeScheduled = false;
        const cOnResize = () => {
          if (!cResizeScheduled) {
            cResizeScheduled = true;
            requestAnimationFrame(() => {
              cUpdateCachedRect();
              cResizeScheduled = false;
            });
          }
        };
        window.addEventListener("resize", cOnResize);

        const cRand = (min: number, max: number) =>
          Math.random() * (max - min) + min;

        class CursorParticle {
          x: number;
          y: number;
          size: number;
          hasGlow: boolean;
          speedX: number;
          speedY: number;
          life: number;
          maxLife: number;
          fadeInSpeed: number;
          isFadingIn: boolean;
          decay: number;
          gravity: number;
          rotation: number;
          rotationSpeed: number;
          twinkle: number;
          twinkleSpeed: number;
          constructor() {
            this.x = 0;
            this.y = 0;
            this.size = 0;
            this.hasGlow = false;
            this.speedX = 0;
            this.speedY = 0;
            this.life = 0;
            this.maxLife = 1;
            this.fadeInSpeed = 0.07;
            this.isFadingIn = true;
            this.decay = 0;
            this.gravity = -0.002;
            this.rotation = 0;
            this.rotationSpeed = 0;
            this.twinkle = 0;
            this.twinkleSpeed = 0;
            this.reset(0, 0, 0, 0);
          }
          reset(
            x: number,
            y: number,
            cursorSpeed: number,
            cursorAngle: number,
          ) {
            this.x = x;
            this.y = y;
            this.size =
              Math.random() < 0.25 ? cRand(5.625, 8.625) : cRand(2.25, 4.375);
            this.hasGlow = Math.random() < 0.25;
            const isMoving = cursorSpeed > 0.5;
            if (isMoving) {
              const opp = cursorAngle + Math.PI;
              const spread = (Math.random() - 0.5) * Math.PI * 0.6;
              const a = opp + spread;
              const s = cRand(0.3, 0.9) + cursorSpeed * 0.1;
              this.speedX = Math.cos(a) * s;
              this.speedY = Math.sin(a) * s;
            } else {
              const a = cRand(0, Math.PI * 2);
              const s = cRand(0.15, 0.45);
              this.speedX = Math.cos(a) * s;
              this.speedY = Math.sin(a) * s;
            }
            this.life = 0;
            this.maxLife = 1;
            this.fadeInSpeed = 0.07;
            this.isFadingIn = true;
            this.decay = cRand(0.006, 0.018);
            this.gravity = -0.002;
            this.rotation = cRand(0, Math.PI * 2);
            this.rotationSpeed = (Math.random() - 0.5) * 0.15;
            this.twinkle = cRand(0, Math.PI * 2);
            this.twinkleSpeed = cRand(0.1, 0.32);
            return this;
          }
          update() {
            // 2× step: physics calibrated for 60fps, we run at 30fps
            if (this.isFadingIn) {
              this.life += this.fadeInSpeed * 2;
              if (this.life >= this.maxLife) {
                this.life = this.maxLife;
                this.isFadingIn = false;
              }
            } else {
              this.life -= this.decay * 2;
            }
            this.x += this.speedX * 2;
            this.y += this.speedY * 2;
            this.speedY += this.gravity * 2;
            this.speedX *= C_FRICTION;
            this.speedY *= C_FRICTION;
            this.rotation += this.rotationSpeed * 2;
            this.twinkle += this.twinkleSpeed * 2;
            return this.life > 0;
          }
          draw() {
            if (this.life <= 0) return;
            const tw = (Math.sin(this.twinkle) + 1) * 0.5,
              al = this.life * (0.5 + tw * 0.5);
            const co = Math.cos(this.rotation),
              si = Math.sin(this.rotation);
            cCtx.setTransform(
              co * cDpr,
              si * cDpr,
              -si * cDpr,
              co * cDpr,
              this.x * cDpr,
              this.y * cDpr,
            );
            if (this.hasGlow) {
              const gd = (this.size * 4 + 10 + tw * 8) * 0.75 * 2,
                go = -gd / 2;
              cCtx.globalAlpha = al * 0.35;
              cCtx.drawImage(glowSprite, go, go, gd, gd);
            }
            cCtx.globalAlpha = al;
            // Select nearest twinkle phase sprite
            const phase = tw < 0.25 ? 0 : tw < 0.75 ? 1 : 2;
            const drawR = this.size * 2;
            const starSprite = sharedStarPhases[phase];
            if (starSprite)
              cCtx.drawImage(starSprite, -drawR, -drawR, drawR * 2, drawR * 2);
            // White center dot — life alpha only
            cCtx.globalAlpha = this.life;
            if (sharedDotSprite)
              cCtx.drawImage(
                sharedDotSprite,
                -drawR,
                -drawR,
                drawR * 2,
                drawR * 2,
              );
          }
        }

        const cParticlePool: CursorParticle[] = [];
        function cGetParticle(x: number, y: number, s: number, a: number) {
          let p = cParticlePool.pop();
          if (!p) p = new CursorParticle();
          return p.reset(x, y, s, a);
        }
        function cReleaseParticle(p: CursorParticle) {
          if (cParticlePool.length < C_MAX_PARTICLES) cParticlePool.push(p);
        }

        function cCreateParticle() {
          if (cActiveCount >= C_MAX_PARTICLES) return;
          const minR = 10,
            maxR = 30,
            offY = Math.random() < 0.9 ? 28 : 0;
          let sR: number, sA: number;
          if (cSmoothedSpeed > 0.5) {
            const oa = cMouseAngle + Math.PI;
            sA = oa + (Math.random() - 0.5) * Math.PI * 0.8;
            sR = minR + Math.random() * (maxR - minR) + cSmoothedSpeed * 3;
          } else {
            sA = cRand(0, Math.PI * 2);
            sR = minR + Math.random() * (maxR - minR);
          }
          const px = cMouseX + Math.cos(sA) * sR,
            py = cMouseY + Math.sin(sA) * sR + offY;
          const p = cGetParticle(px, py, cSmoothedSpeed, cMouseAngle);
          for (let i = 0; i < C_MAX_PARTICLES; i++) {
            if (cParticles[i] === null) {
              cParticles[i] = p;
              cActiveCount++;
              return;
            }
          }
        }
        function cStartAnimation() {
          if (!cIsAnimating) {
            cIsAnimating = true;
            cLastTimestamp = performance.now();
            cAnimationId = requestAnimationFrame(cAnimate);
          }
        }
        const C_FRAME_MS = 1000 / 30; // 30fps throttle
        let cLastPaint = 0;
        function cAnimate(ts: number) {
          if (ts - cLastPaint < C_FRAME_MS) {
            cAnimationId = requestAnimationFrame(cAnimate);
            return;
          }
          cLastPaint = ts;
          const dt = cLastTimestamp ? (ts - cLastTimestamp) / 1000 : 0;
          cLastTimestamp = ts;
          cMouseX += (cTargetMouseX - cMouseX) * 0.18;
          cMouseY += (cTargetMouseY - cMouseY) * 0.18;
          const dx = cMouseX - cLastMouseX2,
            dy = cMouseY - cLastMouseY2;
          cMouseSpeed = Math.sqrt(dx * dx + dy * dy);
          if (cMouseSpeed > 0.1) cMouseAngle = Math.atan2(dy, dx);
          cSmoothedSpeed += (cMouseSpeed - cSmoothedSpeed) * 0.15;
          if (cSmoothedSpeed < 0.5) cIdleTime += dt;
          else cIdleTime = 0;
          cLastMouseX2 = cMouseX;
          cLastMouseY2 = cMouseY;
          cCtx.setTransform(cDpr, 0, 0, cDpr, 0, 0);
          cCtx.clearRect(0, 0, 500, 300);
          if (cIsHovering) {
            let rate = cSpawnRate;
            if (cIdleTime > 0)
              rate = cSpawnRate * (1 + 1.5 * Math.min(cIdleTime / 3, 1));
            if (ts - cLastSpawn > rate) {
              cCreateParticle();
              cLastSpawn = ts;
            }
          }
          for (let i = 0; i < C_MAX_PARTICLES; i++) {
            const p = cParticles[i];
            if (p == null) continue;
            if (p.update()) p.draw();
            else {
              cReleaseParticle(p);
              cParticles[i] = null;
              cActiveCount--;
            }
          }
          if (!cIsHovering && cActiveCount === 0) {
            cIsAnimating = false;
            cAnimationId = null;
            return;
          }
          cAnimationId = requestAnimationFrame(cAnimate);
        }

        const cOnMove = (e: MouseEvent) => {
          if (!cCachedRect) return;
          cTargetMouseX = (e.clientX - cCachedRect.left) * cCachedScaleX;
          cTargetMouseY = (e.clientY - cCachedRect.top) * cCachedScaleY;
        };
        const cOnEnter = () => {
          cIsHovering = true;
          cUpdateCachedRect();
          cStartAnimation();
        };
        const cOnLeave = () => {
          cIsHovering = false;
        };

        cWrapper.addEventListener("mousemove", cOnMove);
        cButton.addEventListener("mouseenter", cOnEnter);
        cButton.addEventListener("mouseleave", cOnLeave);

        // Pause/resume hook — cursor particles RAF
        let _wasCAnimating = false;
        pauseHooks.push(() => {
          _wasCAnimating = cIsAnimating;
          if (cAnimationId) {
            cancelAnimationFrame(cAnimationId);
            cAnimationId = null;
          }
          cIsAnimating = false;
        });
        resumeHooks.push(() => {
          if (_wasCAnimating && cActiveCount > 0) cStartAnimation();
        });

        cleanups.push(() => {
          if (cAnimationId) cancelAnimationFrame(cAnimationId);
          window.removeEventListener("resize", cOnResize);
          cWrapper!.removeEventListener("mousemove", cOnMove);
          cButton!.removeEventListener("mouseenter", cOnEnter);
          cButton!.removeEventListener("mouseleave", cOnLeave);
          if (cCanvas.parentNode) cCanvas.parentNode.removeChild(cCanvas);
        });
      }
    }
  }

  // ── FACTORY CPU GATING — Ścieżka 1 (Typ B) ──────────────────────────
  // Sekcja ma niezależne pętle rAF (tarczaLoop, animSec, cAnimate, aAnimate)
  // + gsap.ticker (renderMask) → IO wywołuje pause()/resume().
  // rootMargin = clamp(200,1200, 0.5×VH). Recreate IO na resize (mobile toolbar).
  let _factoryKilled = false;
  let _factoryHasBeenActive = false;
  let _factoryIO: IntersectionObserver | null = null;
  let _factoryIODebounce: ReturnType<typeof setTimeout> | null = null;
  function _getVH() {
    return (
      (window.visualViewport && window.visualViewport.height) ||
      window.innerHeight
    );
  }
  function _factoryIOCallback(entries: IntersectionObserverEntry[]) {
    if (!entries[0]) return;
    if (entries[0].isIntersecting) {
      _factoryHasBeenActive = true;
      resume();
    } else {
      if (!_factoryHasBeenActive) return;
      pause();
    }
  }
  function _recreateFactoryIO() {
    if (_factoryIODebounce) clearTimeout(_factoryIODebounce);
    _factoryIODebounce = setTimeout(function () {
      if (_factoryKilled) return;
      if (_factoryIO) _factoryIO.disconnect();
      const rm =
        Math.min(1200, Math.max(200, Math.round(0.5 * _getVH()))) + "px 0px";
      _factoryIO = new IntersectionObserver(_factoryIOCallback, {
        rootMargin: rm,
      });
      _factoryIO.observe(container);
    }, 50);
  }
  const _onFactoryVVResize = function () {
    _recreateFactoryIO();
  };
  _recreateFactoryIO();
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", _onFactoryVVResize, {
      passive: true,
    });
  }
  cleanups.push(function () {
    _factoryKilled = true;
    if (_factoryIODebounce) clearTimeout(_factoryIODebounce);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", _onFactoryVVResize);
    }
    if (_factoryIO) {
      _factoryIO.disconnect();
      _factoryIO = null;
    }
  });
  // ── KONIEC FACTORY CPU GATING ─────────────────────────────────────────

  return { pause, resume, kill };
}

type GwarancjaEngineProps = {
  rootRef: RefObject<HTMLElement | null>;
};

export function GwarancjaEngine({ rootRef }: GwarancjaEngineProps) {

  /**
   * Src warstwy mechanizmu tylko przez DOM (nie przez state + useGSAP deps).
   * Gdy `mechanismVideoSrc` było w dependencies useGSAP, @gsap/react przy zmianie
   * deps robił revert → kill() → removeAttribute("src") PO commicie React z nowym src,
   * więc na desktopie wideo zostawało bez źródła.
   */
  useLayoutEffect(() => {
    function syncMechanismSrc() {
      const c = rootRef.current;
      if (!c) return;
      const videoTop = c.querySelector(
        "#gwarancja-layer-top",
      ) as HTMLVideoElement | null;
      if (!videoTop) return;
      const desktop = window.innerWidth > GWARANCJA_MOBILE_MAX_W;
      if (desktop) {
        if (videoTop.getAttribute("src") !== GWARANCJA_MECHANISM_VIDEO_SRC) {
          videoTop.src = GWARANCJA_MECHANISM_VIDEO_SRC;
          videoTop.load();
        }
      } else {
        videoTop.pause();
        videoTop.removeAttribute("src");
        videoTop.load();
      }
    }

    syncMechanismSrc();
    window.addEventListener("resize", syncMechanismSrc, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncMechanismSrc, {
        passive: true,
      });
    }
    return () => {
      window.removeEventListener("resize", syncMechanismSrc);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", syncMechanismSrc);
      }
    };
  }, []);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger); // ← TUTAJ, nie na top-level (GSAP-SSR-01)

      const el = rootRef.current;
      if (!el) {
        // DEV: twardy sygnał — null tu oznacza błąd wiring-u ref w JSX
        if (process.env.NODE_ENV !== "production") {
          throw new Error(
            "[P3] rootRef.current is null — ref not attached to <section>.",
          );
        }
        return;
      }
      const inst = init(el);
      return () => inst?.kill?.();
      // scope: useGSAP Context revertuje instancje GSAP z init() automatycznie
      // inst.kill() revertuje je powtórnie + czyści observers/timers/listeners
      // Double cleanup nie jest problemem — bezpieczeństwo wynika z:
      // 1. cleanups.length=0 guard w kill() — idempotencja gwarantowana
      // 2. useGSAP scope — context revert czyszczony przez React
    },
    { scope: rootRef },
  );

  return (
    <>
          {/* G2/G3 WARM: preload="none" — ~730 KB mp4 nie konkuruje z hero LCP.
               JS w init() wywołuje `.load()` + `.play()` wyłącznie gdy sekcja
               zbliża się do viewportu (istniejący mechanizm `loadBottomVideo`). */}
          <video
            id="gwarancja-layer-bottom"
            src="/videos/gwarancja/Strony-Gwarancja-MINIFILE.mp4"
            muted
            playsInline
            loop
            preload="none"
            aria-hidden
          />

          <div id="gwarancja-layer-top-wrap">
            <video
              id="gwarancja-layer-top"
              muted
              playsInline
              loop
              preload="none"
              aria-hidden
            />
          </div>
          <div id="gwarancja-cursor-stage">
            <div id="gwarancja-cursor-pivot">
              <svg id="gwarancja-tarcza-gauge" viewBox="0 0 300 300"></svg>
              <svg
                id="gwarancja-tarcza-seconds-left"
                viewBox="0 0 360 360"
              ></svg>
              <svg
                id="gwarancja-tarcza-seconds-right"
                viewBox="0 0 360 360"
              ></svg>
              <svg id="gwarancja-tarcza-text-ring" viewBox="0 0 360 360">
                <defs>
                  <path
                    id="gwarancja-path-up"
                    d="M 64,180 A 116,116 0 0,1 296,180"
                  />
                  <path
                    id="gwarancja-path-down"
                    d="M 64,180 A 116,116 0 0,0 296,180"
                  />
                </defs>
                <text className="lens-magnetic-text">
                  <textPath
                    id="gwarancja-tp-up"
                    href="#gwarancja-path-up"
                    startOffset="50%"
                    textAnchor="middle"
                  >
                    Precyzja wewnątrz
                  </textPath>
                </text>
                <text className="lens-magnetic-text" dy="18">
                  <textPath
                    id="gwarancja-tp-down"
                    href="#gwarancja-path-down"
                    startOffset="50%"
                    textAnchor="middle"
                  >
                    Elegancja na zewnątrz
                  </textPath>
                </text>
              </svg>
              <div id="gwarancja-tarcza-center-circle"></div>
            </div>
          </div>
    </>
  );
}
