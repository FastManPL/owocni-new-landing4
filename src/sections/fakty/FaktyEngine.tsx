"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollRuntime } from "@/lib/scrollRuntime";
import "./fakty-section.css";

// ⚠️ GSAP-SSR-01: ZAKAZ gsap.registerPlugin() na module top-level.
// Next.js pre-renderuje Client Components na serwerze — window/document nie istnieją.
// registerPlugin() WYŁĄCZNIE wewnątrz useGSAP(() => { ... }) jak poniżej.

// ════════════════════════════════════════════════════════════
// fakty-section — hardened init(container)  [P2A → P3 output]
//
// AUTO-FIXy (P2A):
//   [1] TS-LINT-UNUSED-01: usunięto nieużywaną funkcję hslO()
//   [2] FRAMES_BASE_PATH: wydzielony placeholder dla integratora
//       Podmień na właściwą ścieżkę: np. '/sections/fakty/frames/fakty-'
//   [3] CPU Gating Ścieżka 2: IO → disableOrganic() safety net
//   [4] INP-LEAK-01: named handler _onVVResize dla visualViewport.resize
//   [5] IO-SAFE-01: entries[0] null guard w _ioCallback
//
// P3 zmiany:
//   - ScrollTrigger.refresh(true) → scrollRuntime.requestRefresh('st-refresh')
//   - Patch I: scrollRuntime.requestRefresh('fonts-ready-settle') po ST build
//   - Patch G: typeof window.createImageBitmap === 'function'
//   - TS annotations (signatures, generics, guards)
//
// geometryContract: geometry-sensitive
// Wymaga: gsap, ScrollTrigger (rejestrowane w useGSAP)
// Zwraca: { kill }
// ════════════════════════════════════════════════════════════

function init(container: HTMLElement): { kill: () => void } {
  const $id = (id: string) => container.querySelector<HTMLElement>("#" + id);

  const cleanups: (() => void)[] = [];
  const gsapInstances: { revert?(): void; kill?(): void }[] = [];
  const timerIds: { type: string; id: number | (() => number | null) }[] = [];
  const observers: IntersectionObserver[] = [];

  const KERNING_MARGINS = [0, -0.1459, -0.1101, -0.1196, -0.1316];
  const TEXT_ROWS = [
    { text: "FAKTY", weight: 900, kerning: KERNING_MARGINS },
    { text: "SĄ TAKIE", weight: 139, kerning: null },
  ];

  const faktyBlock = $id("fakty-block");
  const faktyDom = $id("fakty-dom");

  if (!faktyBlock || !faktyDom) {
    console.warn("[fakty] Brak wymaganych elementów DOM");
    return { kill: () => {} };
  }

  let charOffsets: { el: HTMLElement; x: number; y: number }[] = [];
  let currentFrame = -1;
  const playhead = { frame: 0 };
  /** Scrub może wywołać onUpdate >1× / frame — jedna aktualizacja CSS na klatkę. */
  let frameScrollRafId: number | null = null;
  let frameScrollPendingIndex: number | null = null;
  let isKilled = false;
  let stableViewportHeight = window.innerHeight;

  // ── DOM BUILD ──────────────────────────────────────────────
  function buildDOM() {
    if (!faktyDom) return;
    faktyDom.innerHTML = "";
    TEXT_ROWS.forEach((rowDef, ri) => {
      const rowSpan = document.createElement("span");
      rowSpan.className = "title-row title-row--" + (ri + 1);
      if (ri === 0) {
        const words = rowDef.text.split(" ");
        let charIndex = 0;
        words.forEach((word) => {
          const wordSpan = document.createElement("span");
          wordSpan.className = "word";
          [...word].forEach((ch) => {
            const span = document.createElement("span");
            span.className = "char video-fill";
            span.textContent = ch;
            if (
              rowDef.kerning &&
              charIndex < rowDef.kerning.length &&
              rowDef.kerning[charIndex] !== 0
            ) {
              span.style.marginLeft = rowDef.kerning[charIndex] + "em";
            }
            wordSpan.appendChild(span);
            charIndex++;
          });
          rowSpan.appendChild(wordSpan);
          charIndex++;
        });
      } else {
        const wordSpan = document.createElement("span");
        wordSpan.className = "word";
        wordSpan.textContent = rowDef.text;
        rowSpan.appendChild(wordSpan);
      }
      faktyDom.appendChild(rowSpan);
    });
  }

  // Fix [4]: Singleton measure canvas — reused across resize calls
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");

  function computeAndSetBase() {
    if (!faktyBlock || !faktyDom) return;
    const rectW = faktyBlock.getBoundingClientRect().width;
    const vpCap =
      typeof document !== "undefined" && document.documentElement
        ? document.documentElement.clientWidth
        : rectW;
    /** Margines na subpiksele, paddingi bearingów i różnice silnika — bez tego sporadycznie tekst wyjeżdżał poza ekran na mobile. */
    const targetW = Math.max(0, Math.min(rectW, vpCap) - 4);
    const rows = faktyDom.querySelectorAll<HTMLElement>(".title-row");
    const r1 = rows[0],
      r2 = rows[1];
    if (!r1 || !r2) return;

    r1.style.fontSize = "200px";
    r2.style.fontSize = "200px";
    const r1w = r1.getBoundingClientRect().width;
    const r2w = r2.getBoundingClientRect().width;
    if (r1w <= 0 || r2w <= 0) return;

    const base = Math.floor((targetW / r1w) * 200);
    const ratio = (r1w / r2w).toFixed(4);

    faktyBlock.style.setProperty("--base", base + "px");
    faktyBlock.style.setProperty("--ratio", ratio);
    r1.style.fontSize = "";
    r2.style.fontSize = "";

    const row1Size = base;
    const row2Size = base * parseFloat(ratio);
    if (!measureCtx) {
      faktyBlock.classList.add("ready");
      return;
    }

    measureCtx.font = "900 " + row1Size + "px Lexend";
    const bearingR1 = Math.abs(
      measureCtx.measureText("F").actualBoundingBoxLeft,
    );
    measureCtx.font = "139 " + row2Size + "px Lexend";
    const bearingR2 = Math.abs(
      measureCtx.measureText("S").actualBoundingBoxLeft,
    );
    const bearingDiff = bearingR1 - bearingR2;

    if (bearingDiff > 0.5) {
      faktyBlock.style.setProperty("--sideoffset-r1", "0px");
      faktyBlock.style.setProperty(
        "--sideoffset-r2",
        bearingDiff.toFixed(1) + "px",
      );
    } else if (bearingDiff < -0.5) {
      faktyBlock.style.setProperty(
        "--sideoffset-r1",
        (-bearingDiff).toFixed(1) + "px",
      );
      faktyBlock.style.setProperty("--sideoffset-r2", "0px");
    } else {
      faktyBlock.style.setProperty("--sideoffset-r1", "0px");
      faktyBlock.style.setProperty("--sideoffset-r2", "0px");
    }

    /** Po ustawieniu paddingów wyrównania rzeczywista szerokość wiersza może > targetW — jeden korekcyjny resize (następna klatka layoutu). */
    const baseAfterBearing = base;
    requestAnimationFrame(() => {
      if (isKilled || !container.isConnected || !faktyBlock || !r1 || !r2) return;
      const w1 = r1.getBoundingClientRect().width;
      const w2 = r2.getBoundingClientRect().width;
      const maxW = Math.max(w1, w2);
      if (maxW > targetW + 0.5 && maxW > 0) {
        const adj = Math.max(8, Math.floor(baseAfterBearing * (targetW / maxW)));
        if (adj < baseAfterBearing) {
          faktyBlock.style.setProperty("--base", adj + "px");
        }
      }
      faktyBlock.classList.add("ready");
    });
  }

  function measureCharOffsets() {
    if (!faktyBlock || !faktyDom) return;
    const blockRect = faktyBlock.getBoundingClientRect();
    charOffsets = [];
    faktyDom.querySelectorAll<HTMLElement>(".video-fill").forEach((el) => {
      const r = el.getBoundingClientRect();
      charOffsets.push({
        el,
        x: r.left - blockRect.left,
        y: r.top - blockRect.top,
      });
    });
  }

  // ── FRAME SEQUENCE ─────────────────────────────────────────
  // [AUTO-FIX 2] Obrazki z public/frames → URL /frames/fakty-NN.webp
  const FRAMES_BASE_PATH = "/frames/fakty-";
  const FRAME_COUNT = 34;
  const FRAME_EXT = ".webp";
  const frameURLs = Array.from(
    { length: FRAME_COUNT },
    (_, i) => FRAMES_BASE_PATH + String(i + 1).padStart(2, "0") + FRAME_EXT,
  );
  const frameURLsWrapped = frameURLs.map((url) => "url(" + url + ")");
  let framesReady = false;
  let preloadedImages: HTMLImageElement[] = []; // persystentna referencja — zapobiega GC

  function preloadSingleFrame(index: number) {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        preloadedImages[index] = img;
        if (img.decode) {
          img.decode().then(resolve).catch(resolve);
        } else {
          resolve();
        }
      };
      img.onerror = () => resolve();
      img.src = frameURLs[index] ?? "";
    });
  }

  function preloadRemainingFrames() {
    // T2-4: Concurrency-limited queue — max 4 parallel decodes
    let next = 1;
    const CONCURRENCY = 4;
    function loadNext() {
      if (next >= FRAME_COUNT || isKilled) return;
      const i = next++;
      preloadSingleFrame(i).then(loadNext);
    }
    for (let c = 0; c < CONCURRENCY; c++) loadNext();
  }

  function applyFrame(index: number) {
    if (index === currentFrame) return;
    currentFrame = index;
    if (!framesReady) return;
    const wrapped = frameURLsWrapped[index];
    if (wrapped && faktyDom) {
      faktyDom.style.setProperty("--current-frame-url", wrapped);
    }
  }
  function scheduleFrameScrollApply(index: number) {
    frameScrollPendingIndex = index;
    if (frameScrollRafId !== null) return;
    frameScrollRafId = requestAnimationFrame(() => {
      frameScrollRafId = null;
      const idx = frameScrollPendingIndex;
      frameScrollPendingIndex = null;
      if (idx !== null) applyFrame(idx);
    });
  }

  function setupVideoFill() {
    if (!faktyBlock) return;
    const blockW = faktyBlock.getBoundingClientRect().width;
    const frameH = Math.round((blockW * 540) / 960);
    charOffsets.forEach((co) => {
      co.el.style.backgroundSize = blockW + "px " + frameH + "px";
      co.el.style.backgroundPosition = -co.x + "px " + -co.y + "px";
    });
  }

  /** Po cold refresh / Lenis: ST czasem ma progress>0 gdy tytuł jeszcze pod viewportem → „FAKTY SĄ TAKIE” od razu rozwinięte. */
  let repairPhase1ScrollMisfire: (() => void) | null = null;

  // ── PHASE 1 ANIMATIONS ─────────────────────────────────────
  function buildPhase1() {
    if (!faktyDom) return;
    const rows = faktyDom.querySelectorAll<HTMLElement>(".title-row");
    const row1 = rows[0],
      row2 = rows[1];
    if (!row1 || !row2) return;
    const row1Chars = [...row1.querySelectorAll<HTMLElement>(".char")];
    if (row1Chars.length === 0) return;
    row1Chars.forEach((ch) => gsap.set(ch.parentNode, { perspective: 1000 }));
    const setWC = (els: HTMLElement[], value: string) =>
      els.forEach((el) => {
        el.style.willChange = value;
      });
    setWC(row1Chars, "transform, opacity");
    gsap.set(row1Chars, {
      opacity: 0,
      rotationX: -90,
      z: -200,
      transformOrigin: "50% 0%",
    });
    const row2Word = row2.querySelector<HTMLElement>(".word");
    if (!row2Word) return;
    setWC([row2Word], "transform");
    gsap.set(row2Word, { scaleY: 0, transformOrigin: "50% 0%" });
    const opacityEnd = 54;

    buildOrganicST();

    const st1 = ScrollTrigger.create({
      trigger: row1,
      start: "center bottom",
      end: "top top+=20%",
      scrub: true,
      invalidateOnRefresh: true,
      animation: gsap.to(row1Chars, {
        ease: "power1",
        stagger: 0.07,
        rotationX: 0,
        z: 0,
      }),
      onLeave: () => setWC(row1Chars, "auto"),
      onEnterBack: () => setWC(row1Chars, "transform, opacity"),
      onLeaveBack: () => setWC(row1Chars, "auto"),
    });
    gsapInstances.push(st1);

    const st2 = ScrollTrigger.create({
      trigger: row1,
      start: "center bottom",
      end: `top top+=${opacityEnd}%`,
      scrub: true,
      invalidateOnRefresh: true,
      animation: gsap.to(row1Chars, {
        opacity: 1,
        ease: "power2.in",
        stagger: 0.07,
      }),
    });
    gsapInstances.push(st2);

    const tl = gsap.timeline();
    tl.to(row2Word, { ease: "power1.inOut", scaleY: 1, duration: 0.5 }, 0.08);
    const st3 = ScrollTrigger.create({
      trigger: faktyBlock,
      start: "center bottom",
      end: "top top",
      scrub: true,
      invalidateOnRefresh: true,
      animation: tl,
      onEnter: () => setWC([row2Word], "transform"),
      onLeave: () => setWC([row2Word], "auto"),
      onEnterBack: () => setWC([row2Word], "transform"),
      onLeaveBack: () => setWC([row2Word], "auto"),
    });
    gsapInstances.push(st3);

    repairPhase1ScrollMisfire = function () {
      if (isKilled || !row1.isConnected) return;
      // FAKTY-EARLY-FIRE-01: poprzednio `if (y > 200) return` ograniczało repair do scroll-top
      // (odświeżenie strony). W scenariuszu szybkiego scrollu z góry ST powstają późno, user jest
      // już poza strefą startu → progress=1, repair z guardem nigdy nie odpalał → animacja
      // "FAKTY / SĄ TAKIE" była już rozegrana zanim user ją zobaczył. Warunek
      // `centerY > vh + 8 && p1 > 0.03` sam w sobie jest bezpieczny: oznacza "row1 center
      // jest NADAL poniżej viewport bottom (>8 px zapas), a progress > 3 %" — to możliwe tylko
      // gdy ST syncowało się ze stale scroll/pozycją, nie przy normalnym scrollu w dół.
      const rect = row1.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const centerY = rect.top + rect.height * 0.5;
      const p1 = st1.progress;
      if (centerY > vh + 8 && p1 > 0.03) {
        gsap.set(row1Chars, {
          opacity: 0,
          rotationX: -90,
          z: -200,
          transformOrigin: "50% 0%",
        });
        gsap.set(row2Word, { scaleY: 0, transformOrigin: "50% 0%" });
        [st1, st2, st3].forEach((inst) => {
          inst.refresh();
        });
        ScrollTrigger.update();
      }
    };
  }

  // ══════════════════════════════════════════════════════════
  // ORGANIC ENGINE
  // ══════════════════════════════════════════════════════════

  const PRIMARY_PATH = [
    { a: [-0.0359, 0.5806], hi: [0.0, 0.0], ho: [-0.0375, -0.08] },
    { a: [0.02, 0.45], hi: [-0.06, 0.0], ho: [0.06, 0.0] },
    { a: [0.615, 0.488], hi: [-0.1964, 0.0356], ho: [0.1712, -0.031] },
    { a: [1.01, 0.12], hi: [-0.0691, 0.1845], ho: [0.04, -0.02] },
    { a: [1.0245, -0.0082], hi: [0.04, 0.06], ho: [0.0, 0.0] },
  ];
  const SECONDARY_PATH = [
    [0.03, 0.67],
    [0.115, 0.44],
    [0.74, 0.485],
    [1.155, 0.265],
    [0.01, 0.006],
  ];
  const ORG = {
    globalYOffset: -0.02,
    primarySpeed: 0.87,
    primaryDelay: 0.015,
    secondarySpeed: 0.72,
    secondaryDelay: 0.03,
    primary: {
      hueStart: 10,
      hueMid: 20,
      hueEnd: 20,
      saturation: 57,
      lightnessStart: 10,
      lightnessMid: 45,
      lightnessEnd: 98,
      strokeOpacity: 1,
      lineWidth: 9.5,
      areaAlphaTop: 0.64,
      areaAlphaMid: 0,
      areaStopMid: 0.3,
      shadowBlur: 21,
      shadowAlpha: 1,
      flareMidAlpha: 0.66,
      flareCoreAlpha: 1,
    },
    secondary: {
      hueStart: 10,
      hueMid: 0,
      hueEnd: 0,
      saturation: 54,
      lightnessStart: 10,
      lightnessMid: 46,
      lightnessEnd: 20,
      strokeOpacity: 1,
      lineWidth: 8.4,
      areaAlphaTop: 0.32,
      areaAlphaMid: 0.11,
      areaStopMid: 0.05,
      shadowBlur: 15,
      shadowAlpha: 0.95,
      flareMidAlpha: 0.5,
      flareCoreAlpha: 1,
    },
  };

  type OrgConfig = typeof ORG.primary;

  const GRID_LINE_COUNT = 5;
  const GRID_TRIGGER_PP = 0.3;
  const GRID_SPACING = 0.05;
  const GRID_OFFSET_Y = -0.3;

  // ── T2-2: CSS saturate(195%) baked into HSL via sRGB matrix ──
  function _saturateHSL(
    h: number,
    s: number,
    l: number,
  ): [number, number, number] {
    const S = 1.95,
      s1 = s / 100,
      l1 = l / 100;
    let r: number, g: number, b: number;
    if (s1 === 0) {
      r = g = b = l1;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l1 < 0.5 ? l1 * (1 + s1) : l1 + s1 - l1 * s1,
        p = 2 * l1 - q;
      r = hue2rgb(p, q, h / 360 + 1 / 3);
      g = hue2rgb(p, q, h / 360);
      b = hue2rgb(p, q, h / 360 - 1 / 3);
    }
    const r2 = Math.min(
      1,
      Math.max(
        0,
        (0.2126 + 0.7874 * S) * r +
          (0.7152 - 0.7152 * S) * g +
          (0.0722 - 0.0722 * S) * b,
      ),
    );
    const g2 = Math.min(
      1,
      Math.max(
        0,
        (0.2126 - 0.2126 * S) * r +
          (0.7152 + 0.2848 * S) * g +
          (0.0722 - 0.0722 * S) * b,
      ),
    );
    const b2 = Math.min(
      1,
      Math.max(
        0,
        (0.2126 - 0.2126 * S) * r +
          (0.7152 - 0.7152 * S) * g +
          (0.0722 + 0.9278 * S) * b,
      ),
    );
    const mx = Math.max(r2, g2, b2),
      mn = Math.min(r2, g2, b2);
    let h2: number, s2: number;
    const l2 = (mx + mn) / 2;
    if (mx === mn) {
      h2 = 0;
      s2 = 0;
    } else {
      const d = mx - mn;
      s2 = l2 > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r2) h2 = (g2 - b2) / d + (g2 < b2 ? 6 : 0);
      else if (mx === g2) h2 = (b2 - r2) / d + 2;
      else h2 = (r2 - g2) / d + 4;
      h2 /= 6;
    }
    return [Math.round(h2 * 360), Math.round(s2 * 100), Math.round(l2 * 100)];
  }
  function _bakeHSL(h: number, s: number, l: number, a: number) {
    const [h2, s2, l2] = _saturateHSL(h, s, l);
    return `hsla(${h2},${s2}%,${l2}%,${a})`;
  }
  function _bakePrefix(h: number, s: number, l: number) {
    const [h2, s2, l2] = _saturateHSL(h, s, l);
    return "hsla(" + h2 + "," + s2 + "%," + l2 + "%,";
  }

  interface PrecomputedLineColors {
    areaTop: string;
    areaMid: string;
    areaEnd: string;
    strokeStart: string;
    strokeMid: string;
    strokeEnd: string;
    shadow: string;
  }

  function _precomputeLineColors(c: OrgConfig): PrecomputedLineColors {
    return {
      areaTop: _bakeHSL(
        c.hueStart,
        c.saturation,
        c.lightnessStart,
        c.areaAlphaTop,
      ),
      areaMid: _bakeHSL(c.hueMid, c.saturation, c.lightnessMid, c.areaAlphaMid),
      areaEnd: _bakeHSL(c.hueEnd, c.saturation, c.lightnessEnd, 0),
      strokeStart: _bakeHSL(
        c.hueStart,
        c.saturation,
        c.lightnessStart,
        c.strokeOpacity,
      ),
      strokeMid: _bakeHSL(
        c.hueMid,
        c.saturation,
        c.lightnessMid,
        c.strokeOpacity,
      ),
      strokeEnd: _bakeHSL(
        c.hueEnd,
        c.saturation,
        c.lightnessEnd,
        c.strokeOpacity,
      ),
      shadow: _bakeHSL(c.hueMid, c.saturation, c.lightnessMid, c.shadowAlpha),
    };
  }
  const ORG_CLR_P = _precomputeLineColors(ORG.primary);
  const ORG_CLR_S = _precomputeLineColors(ORG.secondary);

  interface PrecomputedFlareColors {
    glow0: string;
    glow55: string;
    ringFull: [string, string];
    midFull: string;
    innerFull: string;
  }

  function _precomputeFlareColors(c: OrgConfig): PrecomputedFlareColors {
    const rs = Math.max(55, c.saturation);
    return {
      glow0: _bakePrefix(
        c.hueMid,
        Math.max(60, c.saturation),
        Math.min(90, c.lightnessMid + 14),
      ),
      glow55: _bakePrefix(
        c.hueEnd,
        Math.max(50, c.saturation - 8),
        Math.min(82, c.lightnessMid + 10),
      ),
      ringFull: [
        _bakeHSL(c.hueStart, rs, Math.min(96, c.lightnessStart + 24), 1),
        _bakeHSL(c.hueMid, rs, Math.min(96, c.lightnessStart + 24), 1),
      ],
      midFull: _bakeHSL(
        c.hueMid,
        Math.max(58, c.saturation),
        Math.min(88, c.lightnessMid + 12),
        1,
      ),
      innerFull: _bakeHSL(
        c.hueMid,
        Math.max(65, c.saturation),
        Math.min(86, c.lightnessMid + 8),
        1,
      ),
    };
  }
  const ORG_FLARE_P = _precomputeFlareColors(ORG.primary);
  const ORG_FLARE_S = _precomputeFlareColors(ORG.secondary);

  interface BezierSeg {
    sx: number;
    sy: number;
    c1x: number;
    c1y: number;
    c2x: number;
    c2y: number;
    ex: number;
    ey: number;
  }

  function catmullRomSegs(pts: number[][], tension = 0.5): BezierSeg[] {
    const segs: BezierSeg[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)],
        p1 = pts[i],
        p2 = pts[i + 1],
        p3 = pts[Math.min(i + 2, pts.length - 1)];
      const x0 = p1?.[0] ?? 0,
        y0 = p1?.[1] ?? 0,
        x1 = p2?.[0] ?? 0,
        y1 = p2?.[1] ?? 0,
        x0p = p0?.[0] ?? 0,
        y0p = p0?.[1] ?? 0,
        x3 = p3?.[0] ?? 0,
        y3 = p3?.[1] ?? 0;
      segs.push({
        sx: x0,
        sy: y0,
        c1x: x0 + (x1 - x0p) / (6 * tension),
        c1y: y0 + (y1 - y0p) / (6 * tension),
        c2x: x1 - (x3 - x0) / (6 * tension),
        c2y: y1 - (y3 - y0) / (6 * tension),
        ex: x1,
        ey: y1,
      });
    }
    return segs;
  }

  interface PathNode {
    a: number[];
    hi: number[];
    ho: number[];
  }

  function bezierSegsFromNodes(
    nodes: PathNode[],
    W: number,
    H: number,
    yOff: number,
  ): BezierSeg[] {
    const segs: BezierSeg[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const n0 = nodes[i]!,
        n1 = nodes[i + 1]!;
      const ax0 = (n0.a[0] ?? 0) * W,
        ay0 = ((n0.a[1] ?? 0) + yOff) * H;
      const ax1 = (n1.a[0] ?? 0) * W,
        ay1 = ((n1.a[1] ?? 0) + yOff) * H;
      const c1x = ((n0.a[0] ?? 0) + (n0.ho[0] ?? 0)) * W,
        c1y = ((n0.a[1] ?? 0) + (n0.ho[1] ?? 0) + yOff) * H;
      const c2x = ((n1.a[0] ?? 0) + (n1.hi[0] ?? 0)) * W,
        c2y = ((n1.a[1] ?? 0) + (n1.hi[1] ?? 0) + yOff) * H;
      segs.push({ sx: ax0, sy: ay0, c1x, c1y, c2x, c2y, ex: ax1, ey: ay1 });
    }
    return segs;
  }

  const _bezPt = { x: 0, y: 0, m1x: 0, m1y: 0, mm1x: 0, mm1y: 0 };
  function bezierAt(seg: BezierSeg, t: number) {
    const m1x = seg.sx + (seg.c1x - seg.sx) * t,
      m1y = seg.sy + (seg.c1y - seg.sy) * t;
    const m2x = seg.c1x + (seg.c2x - seg.c1x) * t,
      m2y = seg.c1y + (seg.c2y - seg.c1y) * t;
    const m3x = seg.c2x + (seg.ex - seg.c2x) * t,
      m3y = seg.c2y + (seg.ey - seg.c2y) * t;
    const mm1x = m1x + (m2x - m1x) * t,
      mm1y = m1y + (m2y - m1y) * t;
    const mm2x = m2x + (m3x - m2x) * t,
      mm2y = m2y + (m3y - m2y) * t;
    _bezPt.x = mm1x + (mm2x - mm1x) * t;
    _bezPt.y = mm1y + (mm2y - mm1y) * t;
    _bezPt.m1x = m1x;
    _bezPt.m1y = m1y;
    _bezPt.mm1x = mm1x;
    _bezPt.mm1y = mm1y;
    return _bezPt;
  }

  function orgProg(master: number, delay: number, speed: number) {
    return Math.max(0, Math.min(1, (master - delay) * speed));
  }

  const _lineHead = { lx: 0, ly: 0 };
  function drawOrgLine(
    ctx: CanvasRenderingContext2D,
    segs: BezierSeg[],
    active: number,
    H: number,
    _W: number,
    c: OrgConfig,
    clr: PrecomputedLineColors,
    strokeGrad: CanvasGradient,
  ) {
    const s0 = segs[0];
    if (!s0) return _lineHead;
    if (active <= 0) {
      _lineHead.lx = s0.sx;
      _lineHead.ly = s0.sy;
      return _lineHead;
    }
    ctx.beginPath();
    ctx.moveTo(s0.sx, H);
    ctx.lineTo(s0.sx, s0.sy);
    let lx = s0.sx,
      ly = s0.sy;
    for (let i = 0; i < segs.length; i++) {
      if (i >= active) break;
      const s = segs[i];
      if (!s) continue;
      const sp = Math.min(1, active - i);
      if (sp >= 1) {
        ctx.bezierCurveTo(s.c1x, s.c1y, s.c2x, s.c2y, s.ex, s.ey);
        lx = s.ex;
        ly = s.ey;
      } else {
        const pt = bezierAt(s, sp);
        ctx.bezierCurveTo(pt.m1x, pt.m1y, pt.mm1x, pt.mm1y, pt.x, pt.y);
        lx = pt.x;
        ly = pt.y;
      }
    }
    ctx.lineTo(lx, H);
    ctx.closePath();
    const ag = ctx.createLinearGradient(0, ly, 0, H);
    ag.addColorStop(0, clr.areaTop);
    ag.addColorStop(c.areaStopMid, clr.areaMid);
    ag.addColorStop(1, clr.areaEnd);
    ctx.fillStyle = ag;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s0.sx, s0.sy);
    for (let i = 0; i < segs.length; i++) {
      if (i >= active) break;
      const s = segs[i];
      if (!s) continue;
      const sp = Math.min(1, active - i);
      if (sp >= 1) {
        ctx.bezierCurveTo(s.c1x, s.c1y, s.c2x, s.c2y, s.ex, s.ey);
      } else {
        const pt = bezierAt(s, sp);
        ctx.bezierCurveTo(pt.m1x, pt.m1y, pt.mm1x, pt.mm1y, pt.x, pt.y);
      }
    }
    const lw = c.lineWidth * orgSizeScale,
      sb = c.shadowBlur * orgSizeScale;
    ctx.strokeStyle = strokeGrad;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.06;
    ctx.lineWidth = lw + sb * 1.5;
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = lw + sb * 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = lw;
    ctx.stroke();
    _lineHead.lx = lx;
    _lineHead.ly = ly;
    return _lineHead;
  }

  function drawOrgFlare(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    t: number,
    c: OrgConfig,
    fc: PrecomputedFlareColors,
  ) {
    if (progress <= 0.05) return;
    const pulse = (Math.sin(t) + 1) / 2;
    const reveal = Math.min(1, Math.max(0, (progress - 0.05) / 0.08));
    const sc = orgSizeScale;
    ctx.save();
    ctx.lineWidth = 2.4 * sc;
    for (let i = 0; i < 2; i++) {
      const pR = (t * 0.166 + i / 3) % 1;
      ctx.globalAlpha = 0.4 * (1 - pR) * reveal;
      ctx.strokeStyle = fc.ringFull[i] ?? "transparent";
      ctx.beginPath();
      ctx.arc(x, y, pR * 72 * sc, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const gr = 49.6 * sc;
    const gf = ctx.createRadialGradient(x, y, 0, x, y, gr);
    gf.addColorStop(0, fc.glow0 + (0.35 + pulse * 0.15) * reveal + ")");
    gf.addColorStop(0.55, fc.glow55 + (0.14 + pulse * 0.08) * reveal + ")");
    gf.addColorStop(1, "transparent");
    ctx.fillStyle = gf;
    ctx.beginPath();
    ctx.arc(x, y, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fc.midFull;
    ctx.globalAlpha = (0.28 + pulse * 0.12) * reveal;
    ctx.beginPath();
    ctx.arc(x, y, (30 + pulse * 8) * 0.8 * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.globalAlpha = 0.2 * reveal;
    ctx.beginPath();
    ctx.arc(x, y, (18 + pulse * 5) * 0.8 * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fc.innerFull;
    ctx.globalAlpha = (c.flareMidAlpha + pulse * 0.08) * reveal;
    ctx.beginPath();
    ctx.arc(x, y, (10.5 + pulse * 2.6) * 0.8 * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(80,43,1,1)";
    ctx.globalAlpha = c.flareCoreAlpha * reveal;
    ctx.beginPath();
    ctx.arc(x, y, 5.2 * 0.8 * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function gridSeg(p: number, p0: number, p1: number, v0: number, v1: number) {
    if (p <= p0) return v0;
    if (p >= p1) return v1;
    return v0 + ((v1 - v0) * (p - p0)) / (p1 - p0);
  }
  const _lineKF = { opacity: 0, offsetY: 0 };
  function linesKF(rawP: number) {
    const p = Math.min(rawP, 0.5);
    _lineKF.opacity =
      p < 0.12 ? 0 : p < 0.17 ? gridSeg(p, 0.12, 0.17, 0, 1) : 1;
    _lineKF.offsetY =
      p < 0.07
        ? 0
        : p < 0.12
          ? gridSeg(p, 0.07, 0.12, 0, -20)
          : p < 0.17
            ? gridSeg(p, 0.12, 0.17, -20, 10)
            : p < 0.25
              ? gridSeg(p, 0.17, 0.25, 10, -5)
              : p < 0.3
                ? gridSeg(p, 0.25, 0.3, -5, 0)
                : 0;
    const blur = p < 0.07 ? 10 : p < 0.25 ? gridSeg(p, 0.07, 0.25, 10, 0) : 0;
    _lineKF.opacity *= blur > 0 ? 1 - (blur / 10) * 0.6 : 1;
    return _lineKF;
  }
  function drawGridLines(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    pp: number,
  ) {
    if (pp < GRID_TRIGGER_PP) return;
    const master = Math.min(
      (pp - GRID_TRIGGER_PP) / ((1 - GRID_TRIGGER_PP) * 0.3),
      1,
    );
    const totalRange = GRID_SPACING * H * (GRID_LINE_COUNT - 1);
    const yCenter = H * (0.71 + GRID_OFFSET_Y);
    const yBottom = yCenter + totalRange / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3 * orgSizeScale;
    for (let i = 0; i < GRID_LINE_COUNT; i++) {
      const yBase = yBottom - i * GRID_SPACING * H;
      const stagger = i * 0.06;
      const p = Math.min(Math.max(0, (master - stagger) / (1 - stagger)), 0.5);
      const kf = linesKF(p);
      const alpha = kf.opacity * 0.3;
      if (alpha <= 0.01) continue;
      const drawX = Math.min(p / 0.5, 1) * W;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(0, yBase + kf.offsetY);
      ctx.lineTo(drawX, yBase + kf.offsetY);
      ctx.stroke();
    }
    ctx.restore();
  }

  const orgOverlay =
    container.querySelector<HTMLCanvasElement>("#organic-overlay");
  const orgCtx = orgOverlay ? orgOverlay.getContext("2d") : null;
  const orgState = { progress: 0 };
  let orgRafId: number | null = null;
  let orgActive = false;
  let orgST: ScrollTrigger | null = null;

  let orgSegDrawW = 0,
    orgSegH = 0;
  let orgCachedPSegs: BezierSeg[] | null = null,
    orgCachedSSegs: BezierSeg[] | null = null;
  let orgStrokeGradP: CanvasGradient | null = null,
    orgStrokeGradS: CanvasGradient | null = null;

  function rebuildSegments(drawW: number, H: number, yOff: number) {
    orgSegDrawW = drawW;
    orgSegH = H;
    orgCachedPSegs = bezierSegsFromNodes(PRIMARY_PATH, drawW, H, yOff);
    const scaledSec: number[][] = [];
    for (let i = 0; i < SECONDARY_PATH.length; i++) {
      const pt = SECONDARY_PATH[i];
      scaledSec[i] = [(pt?.[0] ?? 0) * drawW, ((pt?.[1] ?? 0) + yOff) * H];
    }
    orgCachedSSegs = catmullRomSegs(scaledSec, 0.45);
    if (orgCtx) {
      function mkStrokeGrad(clr: PrecomputedLineColors) {
        const g = orgCtx!.createLinearGradient(0, 0, drawW, 0);
        g.addColorStop(0, clr.strokeStart);
        g.addColorStop(0.5, clr.strokeMid);
        g.addColorStop(1, clr.strokeEnd);
        return g;
      }
      orgStrokeGradP = mkStrokeGrad(ORG_CLR_P);
      orgStrokeGradS = mkStrokeGrad(ORG_CLR_S);
    }
  }

  let orgRow1Ref: HTMLElement | null = null,
    orgCachedRatio = 0;
  function measureOrgRatio() {
    if (!faktyBlock || !faktyDom) return;
    if (!orgRow1Ref)
      orgRow1Ref = faktyDom.querySelector<HTMLElement>(".title-row--1");
    const blockW = faktyBlock.offsetWidth;
    const textWcss = orgRow1Ref
      ? orgRow1Ref.getBoundingClientRect().width
      : blockW;
    orgCachedRatio = blockW > 0 ? textWcss / blockW : 1;
  }

  let orgResizeRaf: number | null = null;
  let orgBlockResizeObs: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    orgBlockResizeObs = new ResizeObserver(() => {
      if (orgResizeRaf !== null) return;
      orgResizeRaf = requestAnimationFrame(() => {
        orgResizeRaf = null;
        if (!isKilled) measureOrgRatio();
      });
    });
    orgBlockResizeObs.observe(faktyBlock);
    cleanups.push(() => {
      if (orgResizeRaf !== null) {
        cancelAnimationFrame(orgResizeRaf);
        orgResizeRaf = null;
      }
      orgBlockResizeObs?.disconnect();
      orgBlockResizeObs = null;
    });
  }

  const ORG_RENDER_SCALE = 0.5,
    ORG_REF_WIDTH = 1200;
  let orgCssW = 0,
    orgCssH = 0,
    orgSizeScale = 1;

  function resizeOrgCanvas() {
    if (!orgOverlay || !orgCtx || !faktyBlock) return;
    orgCssW = faktyBlock.offsetWidth;
    orgCssH = faktyBlock.offsetHeight;
    orgSizeScale = Math.min(1, Math.sqrt(orgCssW / ORG_REF_WIDTH));
    const bW = Math.round(orgCssW * ORG_RENDER_SCALE);
    const bH = Math.round(orgCssH * ORG_RENDER_SCALE);
    if (orgOverlay.width !== bW || orgOverlay.height !== bH) {
      orgOverlay.width = bW;
      orgOverlay.height = bH;
    }
    orgCtx.setTransform(ORG_RENDER_SCALE, 0, 0, ORG_RENDER_SCALE, 0, 0);
    if (orgOffscreen) {
      if (orgOffscreen.width !== bW || orgOffscreen.height !== bH) {
        orgOffscreen.width = bW;
        orgOffscreen.height = bH;
      }
      orgOffCtx.setTransform(ORG_RENDER_SCALE, 0, 0, ORG_RENDER_SCALE, 0, 0);
    }
    orgSnapshotDirty = true;
  }

  const orgOffscreen = document.createElement("canvas");
  const orgOffCtx = orgOffscreen.getContext("2d")!;
  let orgSnapshotDirty = true,
    orgLastProgress = -1;
  let orgCachedSLx = 0,
    orgCachedSLy = 0,
    orgCachedPLx = 0,
    orgCachedPLy = 0;

  let orgReduceMotion = false;
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    orgReduceMotion = mq.matches;
    const onReduceMotion = () => {
      orgReduceMotion = mq.matches;
    };
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onReduceMotion);
      cleanups.push(() => mq.removeEventListener("change", onReduceMotion));
    } else {
      mq.addListener(onReduceMotion);
      cleanups.push(() => mq.removeListener(onReduceMotion));
    }
  }

  function renderStaticSnapshot(
    W: number,
    H: number,
    drawW: number,
    pp: number,
    sp: number,
  ) {
    orgOffCtx.clearRect(0, 0, W, H);
    drawGridLines(orgOffCtx, drawW, H, pp);
    const sHead = drawOrgLine(
      orgOffCtx,
      orgCachedSSegs!,
      sp * orgCachedSSegs!.length,
      H,
      drawW,
      ORG.secondary,
      ORG_CLR_S,
      orgStrokeGradS!,
    );
    orgCachedSLx = sHead.lx;
    orgCachedSLy = sHead.ly;
    const pHead = drawOrgLine(
      orgOffCtx,
      orgCachedPSegs!,
      pp * orgCachedPSegs!.length,
      H,
      drawW,
      ORG.primary,
      ORG_CLR_P,
      orgStrokeGradP!,
    );
    orgCachedPLx = pHead.lx;
    orgCachedPLy = pHead.ly;
    orgSnapshotDirty = false;
  }

  function renderOrganic() {
    if (!orgCtx) return;
    const W = orgCssW,
      H = orgCssH;
    if (!W || !H) return;
    const yOff = ORG.globalYOffset;
    const drawW = W * (orgCachedRatio + 1) * 0.5;
    if (drawW !== orgSegDrawW || H !== orgSegH) {
      rebuildSegments(drawW, H, yOff);
      orgSnapshotDirty = true;
    }
    const pp = orgProg(orgState.progress, ORG.primaryDelay, ORG.primarySpeed);
    const sp = orgProg(
      orgState.progress,
      ORG.secondaryDelay,
      ORG.secondarySpeed,
    );
    if (orgState.progress !== orgLastProgress || orgSnapshotDirty) {
      orgLastProgress = orgState.progress;
      renderStaticSnapshot(W, H, drawW, pp, sp);
    }
    orgCtx.clearRect(0, 0, W, H);
    orgCtx.drawImage(orgOffscreen, 0, 0, W, H);
    if (!orgReduceMotion) {
      const t = performance.now() * 0.001;
      if (sp > 0.05)
        drawOrgFlare(
          orgCtx,
          orgCachedSLx,
          orgCachedSLy,
          sp,
          t + 0.45,
          ORG.secondary,
          ORG_FLARE_S,
        );
      if (pp > 0.05)
        drawOrgFlare(
          orgCtx,
          orgCachedPLx,
          orgCachedPLy,
          pp,
          t,
          ORG.primary,
          ORG_FLARE_P,
        );
    }
  }

  let orgLastRender = 0;
  function orgLoop(now: number) {
    if (!orgActive || isKilled) {
      orgRafId = null;
      return;
    }
    orgRafId = requestAnimationFrame(orgLoop);
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    )
      return;
    if (now - orgLastRender < 32) return;
    orgLastRender = now;
    renderOrganic();
  }

  function buildOrganicST() {
    if (orgST) return;
    resizeOrgCanvas();
    measureOrgRatio();
    const tween = gsap.to(orgState, {
      progress: 1,
      ease: "none",
      scrollTrigger: {
        trigger: faktyBlock,
        start: "top bottom-=30%",
        end: "bottom center",
        scrub: 1,
      },
    });
    orgST = tween.scrollTrigger ?? null;
    if (orgST) gsapInstances.push(orgST);
  }

  function enableOrganic() {
    if (orgActive || isKilled || !orgOverlay) return;
    orgActive = true;
    orgOverlay.classList.add("active");
    if (orgRafId === null) orgRafId = requestAnimationFrame(orgLoop);
  }
  function pauseOrganic() {
    if (!orgActive) return;
    orgActive = false;
    if (orgRafId !== null) {
      cancelAnimationFrame(orgRafId);
      orgRafId = null;
    }
  }
  function disableOrganic() {
    if (orgRafId !== null) {
      cancelAnimationFrame(orgRafId);
      orgRafId = null;
    }
    orgActive = false;
    if (orgOverlay && orgOverlay.classList.contains("active")) {
      orgOverlay.classList.remove("active");
      if (orgCtx)
        orgCtx.clearRect(
          0,
          0,
          orgCssW || orgOverlay.width,
          orgCssH || orgOverlay.height,
        );
    }
  }
  cleanups.push(() => {
    disableOrganic();
  });

  // ── frameST ────────────────────────────────────────────────
  let frameST: ScrollTrigger | null = null;
  function buildFrameScroll() {
    if (frameScrollRafId !== null) {
      cancelAnimationFrame(frameScrollRafId);
      frameScrollRafId = null;
    }
    frameScrollPendingIndex = null;
    if (frameST) {
      frameST.kill();
      frameST = null;
    }
    if (!faktyBlock || !faktyDom) return;
    const row1 = faktyDom.querySelector<HTMLElement>(".title-row--1");
    if (!row1) return;
    playhead.frame = 0;
    currentFrame = -1;
    const START_PCT = 61;
    const tween = gsap.to(playhead, {
      frame: FRAME_COUNT - 1,
      snap: "frame",
      ease: "none",
    });
    frameST = ScrollTrigger.create({
      trigger: row1,
      start: "top top+=" + START_PCT + "%",
      end: function () {
        const ratio = faktyBlock.offsetHeight / stableViewportHeight;
        const endPct = Math.max(5, Math.round(ratio * 45));
        return "top top-=" + endPct + "%";
      },
      scrub: true,
      invalidateOnRefresh: true,
      animation: tween,
      onEnter: () => enableOrganic(),
      onLeave: () => pauseOrganic(),
      onEnterBack: () => enableOrganic(),
      onLeaveBack: () => disableOrganic(),
      onUpdate: function () {
        scheduleFrameScrollApply(Math.round(playhead.frame));
      },
    });
    gsapInstances.push(frameST);
  }

  // ── resize ─────────────────────────────────────────────────
  let resizeTimer: ReturnType<typeof setTimeout> | null = null,
    lastBlockWidth = 0,
    lastInnerWidth = window.innerWidth;
  function onResize() {
    const currentInnerWidth = window.innerWidth;
    if (currentInnerWidth === lastInnerWidth) return;
    lastInnerWidth = currentInnerWidth;
    stableViewportHeight = window.innerHeight;
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isKilled || !container.isConnected || !faktyBlock) return;
      const currentWidth = faktyBlock.offsetWidth;
      if (currentWidth === lastBlockWidth) return;
      lastBlockWidth = currentWidth;
      computeAndSetBase();
      measureCharOffsets();
      resizeOrgCanvas();
      measureOrgRatio();
      setupVideoFill();
      currentFrame = -1;
      applyFrame(Math.round(playhead.frame));
      scrollRuntime.requestRefresh("st-refresh");
    }, 150);
  }
  window.addEventListener("resize", onResize, { passive: true });
  cleanups.push(() => window.removeEventListener("resize", onResize));
  timerIds.push({ type: "timeout", id: () => resizeTimer as number | null });

  // ══════════════════════════════════════════════════════════
  // CPU GATING — Ścieżka 2
  // Zewnętrzna warstwa bezpieczeństwa ponad wewnętrzny frameST gating.
  // On leave (poza rootMargin): disableOrganic() — zatrzymuje RAF
  // On enter: brak akcji — frameST zarządza enableOrganic() w viewport
  // rootMargin: clamp(120px, 0.35×VH, 600px) — wężej niż 0.5×VH/1200px: wcześniej gasi organic offscreen
  // Koegzystencja bezpieczna: enableOrganic/disableOrganic idempotentne.
  // ══════════════════════════════════════════════════════════
  let _io: IntersectionObserver | null = null;
  let _ioDebounce: ReturnType<typeof setTimeout> | null = null;

  function _getVH() {
    return window.visualViewport?.height ?? window.innerHeight;
  }
  function _getRootMargin() {
    const px = Math.min(600, Math.max(120, Math.round(0.35 * _getVH())));
    return px + "px";
  }
  function _ioCallback(entries: IntersectionObserverEntry[]) {
    const e = entries[0];
    if (!e) return; // IO-SAFE-01: null guard
    if (!e.isIntersecting) {
      disableOrganic();
    }
    // on enter → brak akcji (frameST dominuje)
  }
  function _recreateIO() {
    if (_ioDebounce !== null) clearTimeout(_ioDebounce);
    _ioDebounce = setTimeout(() => {
      if (isKilled) return;
      _io?.disconnect();
      _io = new IntersectionObserver(_ioCallback, {
        rootMargin: _getRootMargin(),
      });
      if (faktyBlock) _io.observe(faktyBlock);
      observers.push(_io);
    }, 50);
  }
  function _onVVResize() {
    _recreateIO();
  } // named handler — INP-LEAK-01

  _recreateIO();
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", _onVVResize, {
      passive: true,
    });
    cleanups.push(() => {
      if (_ioDebounce !== null) clearTimeout(_ioDebounce);
      window.visualViewport?.removeEventListener("resize", _onVVResize);
    });
  }

  // ── kill ───────────────────────────────────────────────────
  function kill() {
    isKilled = true;
    repairPhase1ScrollMisfire = null;
    if (frameScrollRafId !== null) {
      cancelAnimationFrame(frameScrollRafId);
      frameScrollRafId = null;
    }
    frameScrollPendingIndex = null;
    if (lazyStTimeout !== null) {
      clearTimeout(lazyStTimeout);
      lazyStTimeout = null;
    }
    lazyStObserver?.disconnect();
    lazyStObserver = null;
    preloadedImages = [];
    if (orgOverlay) {
      orgOverlay.width = 0;
      orgOverlay.height = 0;
    }
    if (orgOffscreen) {
      orgOffscreen.width = 0;
      orgOffscreen.height = 0;
    }
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        /* cleanup guard */
      }
    });
    timerIds.forEach((t) => {
      try {
        const id = typeof t.id === "function" ? t.id() : t.id;
        if (id == null) return;
        if (t.type === "timeout") clearTimeout(id);
        else if (t.type === "interval") clearInterval(id);
        else if (t.type === "raf") cancelAnimationFrame(id);
        else if (
          t.type === "idle" &&
          typeof window.cancelIdleCallback === "function"
        )
          window.cancelIdleCallback(id);
      } catch (e) {
        /* cleanup guard */
      }
    });
    observers.forEach((obs) => {
      try {
        obs?.disconnect?.();
      } catch (e) {
        /* cleanup guard */
      }
    });
    gsapInstances.forEach((inst) => {
      try {
        inst?.revert?.();
      } catch (e) {
        /* cleanup guard */
      }
      try {
        inst?.kill?.();
      } catch (e) {
        /* cleanup guard */
      }
    });
    if (faktyBlock) faktyBlock.classList.remove("ready");
    if (faktyDom) faktyDom.innerHTML = "";
  }

  // ── lazy ScrollTrigger creation ─────────────────────────────
  // ST tworzone dopiero gdy sekcja w viewport (IO) lub po 1,2 s (fallback).
  // Zapobiega złym start/end przy scroll≈0 i przy późniejszym globalnym refreshu (resize).
  // Po cold deploy / sporadycznie: ST powstaje gdy Lenis jeszcze nie zsynchronizował scrollu ze
  // scrollerProxy — scrub zostaje na końcu. Czekamy na isReady(), potem refresh + pierwszy tick Lenisa.
  let stCreated = false;
  let lazyStLock = false;
  let lazyStTimeout: ReturnType<typeof setTimeout> | null = null;
  let lazyStObserver: IntersectionObserver | null = null;
  // DEFERRED-ST-CREATION-01: Kinetic gate — gdy SHOW_KINETIC_SECTION=true, Fakty ST nie mogą
  // powstać zanim Kinetic pin-spacer trafi do layoutu ORAZ globalny `ScrollTrigger.refresh()`
  // przeliczy pozycje. Inaczej `row1.getBoundingClientRect()` zwraca pozycję ~1500 px za wysoko,
  // a podczas kolejnego globalnego refreshu `invalidateOnRefresh` przesuwa start/end tak, że
  // user (który jeszcze nie zjechał do Fakty) nagle jest `past end` → scrub animacja
  // „FAKTY / SĄ TAKIE" skacze z progress=0 do progress=1 bez widzialnej interpolacji.
  let kineticReadyLatched = false;
  let kineticReadyListener: (() => void) | null = null;
  function kineticReadyForFaktyST(): boolean {
    if (kineticReadyLatched) return true;
    const kineticExpected = typeof document !== 'undefined' && !!document.getElementById('kinetic-section');
    if (!kineticExpected) {
      kineticReadyLatched = true;
      return true;
    }
    const flag = (window as unknown as { __kineticReadyAndRefreshed?: boolean }).__kineticReadyAndRefreshed;
    if (flag === true) {
      kineticReadyLatched = true;
      return true;
    }
    return false;
  }
  function maybeCreateScrollTriggers() {
    if (lazyStLock || stCreated || isKilled || !container.isConnected || !faktyBlock)
      return;
    if (!kineticReadyForFaktyST()) {
      // Rejestracja jednorazowego listenera — kolejne wywołania z IO/timeout są no-op dzięki
      // lazyStLock=false + `stCreated=false`. Pozwala fallback timeoutowi nadal liczyć.
      if (!kineticReadyListener) {
        // Safety net: 5 s fallback na wypadek gdyby chunk Kinetic nie wystartował —
        // lepsze uruchomienie Fakty ST z niepewnymi pozycjami niż permanentnie nieanimowana sekcja.
        const safetyFallback = window.setTimeout(() => {
          window.removeEventListener('kinetic-ready-and-refreshed', onReady);
          kineticReadyListener = null;
          kineticReadyLatched = true;
          maybeCreateScrollTriggers();
        }, 5000);
        const onReady = () => {
          window.clearTimeout(safetyFallback);
          window.removeEventListener('kinetic-ready-and-refreshed', onReady);
          kineticReadyListener = null;
          maybeCreateScrollTriggers();
        };
        kineticReadyListener = onReady;
        window.addEventListener('kinetic-ready-and-refreshed', onReady);
        cleanups.push(() => {
          window.clearTimeout(safetyFallback);
          window.removeEventListener('kinetic-ready-and-refreshed', onReady);
          kineticReadyListener = null;
        });
      }
      return;
    }
    lazyStLock = true;
    if (lazyStTimeout !== null) {
      clearTimeout(lazyStTimeout);
      lazyStTimeout = null;
    }
    lazyStObserver?.disconnect();
    lazyStObserver = null;

    function runBuild() {
      if (stCreated || isKilled || !container.isConnected || !faktyBlock) return;
      stCreated = true;
      buildPhase1();
      buildFrameScroll();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (isKilled) return;
          ScrollTrigger.refresh(false);
          ScrollTrigger.update();
          repairPhase1ScrollMisfire?.();
          requestAnimationFrame(() => {
            if (isKilled) return;
            repairPhase1ScrollMisfire?.();
          });
          if (scrollRuntime.isReady()) {
            scrollRuntime.requestRefreshImmediate();
          }
          const L = scrollRuntime.getLenis();
          if (!L) return;
          let synced = false;
          const once = () => {
            if (synced || isKilled) return;
            synced = true;
            try {
              L.off("scroll", once);
            } catch {
              /* lenis off */
            }
            ScrollTrigger.update();
            repairPhase1ScrollMisfire?.();
          };
          L.on("scroll", once);
          const faktyStSyncTimer = window.setTimeout(once, 140);
          cleanups.push(() => {
            window.clearTimeout(faktyStSyncTimer);
            try {
              L.off("scroll", once);
            } catch {
              /* */
            }
          });
        });
      });
    }

    function waitForLenisThenBuild() {
      let attempts = 0;
      const maxAttempts = 150;
      const tick = () => {
        if (isKilled || !container.isConnected) return;
        if (scrollRuntime.isReady()) {
          requestAnimationFrame(() => {
            requestAnimationFrame(runBuild);
          });
          return;
        }
        if (++attempts >= maxAttempts) {
          runBuild();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    if (scrollRuntime.isReady()) {
      requestAnimationFrame(() => {
        requestAnimationFrame(runBuild);
      });
    } else {
      waitForLenisThenBuild();
    }
  }

  // ── fonts → build (bez ST; ST w maybeCreateScrollTriggers) ───
  Promise.all([
    document.fonts.load("900 16px Lexend"),
    document.fonts.load("139 16px Lexend"),
  ])
    .then(() => document.fonts.ready)
    .then(async () => {
      if (isKilled || !container.isConnected || !faktyBlock) return;
      stableViewportHeight = window.innerHeight;
      buildDOM();
      computeAndSetBase();
      lastBlockWidth = faktyBlock.offsetWidth;
      measureCharOffsets();
      await preloadSingleFrame(0);
      framesReady = true;
      if (isKilled || !container.isConnected) return;
      setupVideoFill();
      applyFrame(0);
      preloadRemainingFrames();
      // Lazy ST: wejście sekcji w viewport albo fallback 1,2 s.
      // FAKTY-EARLY-FIRE-01 (revert): preemptive rootMargin 500 px powodowało, że runBuild() —
      // zawierający globalne `ScrollTrigger.refresh(false)` + `requestRefreshImmediate()` — odpalał
      // się zanim Kinetic pin-spacer trafił do layoutu. Wave ST w Blok45 dostawał w tym momencie
      // stale pozycje (pre-pinSpacer) i uruchamiał się przy BookStats/Fakty. Fakty misfire jest
      // intermittent ("czasem"), wave regres był częsty ("najczęściej") — priorytet wygrywa
      // stabilność wave. Fakty misfire obsłużony przez zachowane usunięcie `y > 200` guardu
      // w `repairPhase1ScrollMisfire` + skrócony timeout 600 ms.
      lazyStObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) maybeCreateScrollTriggers();
        },
        { root: null, rootMargin: "0px", threshold: 0 },
      );
      lazyStObserver.observe(container);
      observers.push(lazyStObserver);
      lazyStTimeout = setTimeout(maybeCreateScrollTriggers, 600);
      // FIX 3: Force re-apply frame + organic ratio po powrocie do karty (reflow/fonty bez ResizeObserver)
      function onVisibilityChange() {
        if (document.visibilityState === "visible" && framesReady) {
          const frame = currentFrame;
          currentFrame = -1;
          applyFrame(frame);
          measureOrgRatio();
          orgSnapshotDirty = true;
        }
      }
      document.addEventListener("visibilitychange", onVisibilityChange);
      cleanups.push(() =>
        document.removeEventListener("visibilitychange", onVisibilityChange),
      );
    });

  return { kill };
}

// ════════════════════════════════════════════════════════════
// React Component — FaktyEngine (dynamic import target)
// ════════════════════════════════════════════════════════════

export default function FaktyEngine() {
  const rootRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger); // ← GSAP-SSR-01: TUTAJ, nie na top-level
      // GSAP_PLUGINS_USED = [] — brak dodatkowych pluginów

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
      // 1. isKilled flag w kill() + try/catch — idempotencja gwarantowana
      // 2. useGSAP scope — context revert czyszczony przez React
    },
    { scope: rootRef },
  );

  // Sekcja fakty nie wywołuje requestRefresh przy mount — tylko onResize (szerokość).
  // Zapobiega przeliczaniu ST przy scrollu (np. toolbar → resize → refresh).

  return (
    <section id="fakty-section" ref={rootRef}>
      <noscript>
        <p className="fakty-noscript-title">
          FAKTY
          <br />
          SĄ TAKIE
        </p>
      </noscript>
      <div className="title-block" id="fakty-block">
        <div className="title-dom" id="fakty-dom"></div>
        <canvas id="organic-overlay"></canvas>
      </div>
    </section>
  );
}
