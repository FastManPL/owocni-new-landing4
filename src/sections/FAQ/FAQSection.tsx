'use client';

// ============================================================
// FAQSection V2 — 3D Unfold + Bounce + Glow Edges + Checkmark
// Typ: B | GSAP runtime | Pointer-tracked edge glow
// ============================================================
// ZMIANY P1 React Audit:
//   BLOCKER-01: 'use client' dodane
//   BLOCKER-02: CDN loader (loadGsap/gsapPromise) usunięty → import bundler
//   BLOCKER-03: window.ScrollTrigger → importowany ScrollTrigger
//   BLOCKER-04: registerPlugin → wewnątrz useGSAP (BETON GSAP-SSR-01)
//   BLOCKER-05: ST.config() usunięty (należy do scrollRuntime)
//   BLOCKER-06: ScrollTrigger.refresh() → scrollRuntime.requestRefresh()
//   WARN-01:    double-cleanup fix (tile: tylko return, ABC: tylko useGSAP)
//   WARN-02:    FontLinks usunięty (fonty przez next/font w layout.tsx)
//   WARN-03:    Styles → ./faq-section.css
//   WARN-04:    GSAP open/close animation → useGSAP z deps
//   WARN-05:    gsapRef singleton usunięty (gsap importowany bezpośrednio)
//   WARN-07:    getScroll → scrollRuntime.getScroll() (helper zaktualizowany)
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
// TODO: dostosuj ścieżkę do scrollRuntime w projekcie (Shared Core Layer)
import { scrollRuntime } from '@/lib/scrollRuntime';
import type { FaqItem } from './faqData';
import { abcData, faqDataLeft, faqDataRight, TOTAL_FAQ } from './faqData';
import './faq-section.css';

type ColumnId = 'left' | 'right';

type FAQMorphingProProps = {
  data: FaqItem[];
  columnId: ColumnId;
  openIndex: number | null;
  onToggle: (col: ColumnId, i: number) => void;
  visited: Set<number>;
};

type BurstParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  decay: number;
  gravity: number;
  drag: number;
};

const sineDelay = (i: number, n: number) => {
  const norm = i / Math.max(n - 1, 1);
  return norm * 0.38 + Math.sin(norm * Math.PI) * 0.08;
};

// --- GSAP ANIMATIONS (gsap importowany bezpośrednio, bez parametru) ---
// WARN-05: gsapRef singleton usunięty — gsap dostępny z importu
function enterFS2(el: HTMLElement) {
  const parent = el.parentElement;
  if (parent) gsap.set(parent, { perspective: 1200 });
  gsap.set(el, { clipPath: 'inset(0 0 100% 0)', rotationX: -56, opacity: 0, transformOrigin: 'top center' });
  const tl = gsap.timeline();
  tl.to(el, { clipPath: 'inset(0 0 -10% 0)', duration: 0.82, ease: 'power2.out' }, 0);
  tl.to(el, { opacity: 1, duration: 0.25, ease: 'power1.in' }, 0.07);
  tl.to(el, { rotationX: 0, duration: 0.82, ease: 'power3.out' }, 0);
  return tl;
}

function leaveFS2(el: HTMLElement) {
  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set(el, { clearProps: 'all' });
      if (el.parentElement) gsap.set(el.parentElement, { clearProps: 'perspective' });
    }
  });
  tl.to(el, { rotationX: -20, opacity: 0, duration: 0.14, ease: 'power2.in' }, 0);
  tl.to(el, { clipPath: 'inset(0 0 100% 0)', duration: 0.14, ease: 'power2.in' }, 0);
  return tl;
}

// --- FAQMorphingPro ---
const FAQMorphingPro = React.memo(function FAQMorphingPro({
  data,
  columnId,
  openIndex,
  onToggle,
  visited,
}: FAQMorphingProProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRefs = useRef<Record<string, HTMLElement | null>>({});
  const prevOpenRef = useRef<number | null>(null);

  // Pointer tracking refs
  const cachedRect = useRef<DOMRect | null>(null);
  const cachedGlow = useRef<HTMLElement | null>(null);
  const lastAngle = useRef(-1);
  const lastEdge = useRef(-1);
  const rafPending = useRef(false);
  const rafFrameCount = useRef(0);
  const pointerPos = useRef({ x: 0, y: 0 });
  const cachedOpenItem = useRef<HTMLElement | null>(null);

  // WARN-05: gsapRef + loadGsap useEffect usunięte — gsap importowany bezpośrednio

  // Sine wave entrance (IO-driven — nie GSAP context, własny cleanup)
  useEffect(() => {
    const w = wrapperRef.current;
    if (!w) return;
    const items = w.querySelectorAll('.pro-item');
    const n = items.length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    items.forEach((el) => el.classList.add('faq-hidden'));
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          items.forEach((el, i) => {
            const t = setTimeout(() => {
              el.classList.remove('faq-hidden');
              el.classList.add('faq-visible');
            }, sineDelay(i, n) * 1000);
            timers.push(t);
          });
          obs.disconnect();
        }
      });
    }, { threshold: 0.15 });
    obs.observe(w);
    return () => { timers.forEach((t) => clearTimeout(t)); obs.disconnect(); };
  }, []);

  const storeRef = useCallback((el: HTMLElement | null, i: number) => {
    contentRefs.current[`${columnId}-${i}`] = el;
  }, [columnId]);

  // WARN-04: GSAP open/close animation → useGSAP z deps (auto cleanup kontekstu)
  // WARN-05: activeTween.current + glowTween.current usunięte — useGSAP zarządza cleanup
  useGSAP(() => {
    const w = wrapperRef.current;
    const prev = prevOpenRef.current;
    const curr = openIndex;
    prevOpenRef.current = curr;

    // Resetuj cache rect przy zmianie stanu
    if (cachedRect.current) cachedRect.current = null;
    cachedOpenItem.current = null;

    // Kill glow na wszystkich items (bulletproof reset)
    if (w) {
      w.querySelectorAll('.faq-glow').forEach((g) => {
        (g as HTMLElement).style.setProperty('--glow-int', '0');
      });
    }

    // Zamknij poprzedni item + circle ripple
    if (prev !== null && prev !== curr) {
      const elPrev = contentRefs.current[`${columnId}-${prev}`];
      if (elPrev) leaveFS2(elPrev);
      if (w) {
        const cir = w.querySelectorAll('.pro-item')[prev]?.querySelector('.pro-icon-circle');
        if (cir instanceof HTMLElement) {
          // Kill CSS transitions — GSAP przejmuje pełną kontrolę
          cir.style.transition = 'none';
          gsap.timeline({
            onComplete: () => { cir.style.transition = ''; gsap.set(cir, { clearProps: 'scale,boxShadow' }); }
          })
            .fromTo(cir,
              { scale: 1, background: '#fff', boxShadow: '0 0 0 0px rgba(182,234,147,0)' },
              { scale: 1.3, background: '#b6ea93', boxShadow: '0 0 0 0px rgba(182,234,147,0.6)', duration: 0.18, ease: 'power2.out' }
            )
            .to(cir, { scale: 1, boxShadow: '0 0 0 14px rgba(182,234,147,0)', duration: 0.52, ease: 'power3.out' })
            .to(cir, { background: '#fff', duration: 0.28, ease: 'power2.inOut' }, 0.4);
        }
      }
    }

    // Otwórz aktualny — animuj content + glow 3s reveal
    if (curr !== null) {
      const elCurr = contentRefs.current[`${columnId}-${curr}`];
      // Bez rAF — w useGSAP DOM jest już zaktualizowany (timing jak useEffect)
      if (elCurr) enterFS2(elCurr);
      if (w) {
        const currItem = w.querySelectorAll('.pro-item')[curr];
        const currGlow = currItem?.querySelector('.faq-glow');
        if (currGlow instanceof HTMLElement) {
          currGlow.style.setProperty('--glow-int', '0');
          gsap.to(currGlow, { '--glow-int': 0.3, duration: 3, delay: 1, ease: 'power2.out' });
        }
      }
    }
  }, { dependencies: [openIndex, columnId], scope: wrapperRef });

  // Pointer tracking dla glow edges (rAF-batched: max 1 update/frame, cached refs)
  // Pure DOM events — zostaje jako useEffect
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Cache rect + glow ref na pointerenter otwartego itemu
    const enterHandler = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const item = t.closest('.pro-item');
      if (item instanceof HTMLElement && item.classList.contains('open')) {
        cachedOpenItem.current = item;
        cachedRect.current = item.getBoundingClientRect();
        cachedGlow.current = item.querySelector('.faq-glow');
      }
    };

    // Invalidate tylko na resize (scroll nie wpływa na dx/dy relatywne do centrum)
    const invalidateRect = () => {
      cachedRect.current = null;
      cachedGlow.current = null;
      cachedOpenItem.current = null;
    };

    const processGlow = () => {
      rafPending.current = false;
      // Frame skipper: co 2-gi frame = ~30fps zamiast ~60fps
      rafFrameCount.current = (rafFrameCount.current + 1) % 2;
      if (rafFrameCount.current !== 0) {
        rafPending.current = true;
        requestAnimationFrame(processGlow);
        return;
      }
      let item = cachedOpenItem.current;
      if (!item || !item.classList.contains('open')) {
        const el = wrapper.querySelector('.pro-item.open');
        item = el instanceof HTMLElement ? el : null;
        cachedOpenItem.current = item;
      }
      if (!item) return;
      const glow = cachedGlow.current || item.querySelector('.faq-glow');
      if (!glow) return;

      if (!cachedRect.current) cachedRect.current = item.getBoundingClientRect();
      const rect = cachedRect.current;
      if (!rect) return;

      const x = pointerPos.current.x - rect.left;
      const y = pointerPos.current.y - rect.top;
      const cx = rect.width / 2, cy = rect.height / 2;
      const dx = x - cx, dy = y - cy;
      let angle = 45;
      if (dx !== 0 || dy !== 0) {
        angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;
      }
      let kx = Infinity, ky = Infinity;
      if (dx !== 0) kx = cx / Math.abs(dx);
      if (dy !== 0) ky = cy / Math.abs(dy);
      const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

      // Numeric dirty check — próg percepcyjny: 1.5° kąta, 0.5% edge
      if (Math.abs(angle - lastAngle.current) > 1.5) {
        glow.style.setProperty('--pointer-angle', `${angle}deg`);
        lastAngle.current = angle;
      }
      const edgeVal = edge * 100;
      if (Math.abs(edgeVal - lastEdge.current) > 0.5) {
        glow.style.setProperty('--pointer-d', `${edgeVal}`);
        lastEdge.current = edgeVal;
      }
    };

    const handler = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const item = t.closest('.pro-item');
      if (!(item instanceof HTMLElement) || !item.classList.contains('open')) return;
      cachedOpenItem.current = item;
      pointerPos.current.x = e.clientX;
      pointerPos.current.y = e.clientY;
      if (!rafPending.current) {
        rafPending.current = true;
        requestAnimationFrame(processGlow);
      }
    };

    const pointerEnterOpts: AddEventListenerOptions = { capture: true, passive: true };
    const pointerMoveOpts: AddEventListenerOptions = { passive: true };
    wrapper.addEventListener('pointerenter', enterHandler, pointerEnterOpts);
    wrapper.addEventListener('pointermove', handler, pointerMoveOpts);
    window.addEventListener('resize', invalidateRect, pointerMoveOpts);
    return () => {
      wrapper.removeEventListener('pointerenter', enterHandler, pointerEnterOpts);
      wrapper.removeEventListener('pointermove', handler, pointerMoveOpts);
      window.removeEventListener('resize', invalidateRect, pointerMoveOpts);
    };
  }, []);

  // Font weight hover animation (GSAP numeric proxy dla płynnej interpolacji wght)
  useEffect(() => {
    const w = wrapperRef.current;
    if (!w) return;
    const btns = w.querySelectorAll<HTMLButtonElement>('.pro-btn');
    const tweens = new Map<HTMLElement, gsap.core.Tween>();
    const weights = new Map<HTMLElement, { v: number }>();

    const animateWeight = (title: HTMLElement, target: number) => {
      // WARN-05: gsap importowany bezpośrednio, bez gsapRef.current
      const existing = tweens.get(title);
      if (existing) existing.kill();
      if (!weights.has(title)) weights.set(title, { v: 400 });
      const obj = weights.get(title);
      if (!obj) return;
      tweens.set(title, gsap.to(obj, {
        v: target, duration: 0.4, ease: 'power2.out',
        onUpdate: () => { title.style.fontVariationSettings = `'wght' ${obj.v}`; }
      }));
    };

    const enter: EventListener = (e) => {
      const ct = e.currentTarget;
      if (!(ct instanceof HTMLElement)) return;
      const title = ct.querySelector('.pro-title');
      if (title instanceof HTMLElement) animateWeight(title, 600);
    };
    const leave: EventListener = (e) => {
      const ct = e.currentTarget;
      if (!(ct instanceof HTMLElement)) return;
      const title = ct.querySelector('.pro-title');
      if (!(title instanceof HTMLElement)) return;
      const item = ct.closest('.pro-item');
      if (item && item.classList.contains('open')) return;
      animateWeight(title, 400);
    };

    btns.forEach((btn) => {
      btn.addEventListener('mouseenter', enter);
      btn.addEventListener('mouseleave', leave);
    });
    return () => {
      btns.forEach((btn) => {
        btn.removeEventListener('mouseenter', enter);
        btn.removeEventListener('mouseleave', leave);
      });
      tweens.forEach((t) => t.kill());
    };
  }, []);

  return (
    <div className="faq-wrapper faq-morphing-pro" ref={wrapperRef}>
      {data.map((item: FaqItem, i: number) => {
        const isOpen = openIndex === i;
        const isBeforeOpen = openIndex !== null && openIndex === i + 1;
        const isAfterOpen = openIndex !== null && i === openIndex + 1;
        const isFirst = i === 0;
        const isLast = i === data.length - 1;
        const dist = openIndex !== null ? i - openIndex : 999;
        const r = '16px';
        let borderRadius = '0';
        if (isOpen) borderRadius = r;
        else if (isFirst && isLast) borderRadius = r;
        else if (isFirst && isBeforeOpen) borderRadius = r;
        else if (isFirst) borderRadius = `${r} ${r} 0 0`;
        else if (isLast && isAfterOpen) borderRadius = r;
        else if (isLast) borderRadius = `0 0 ${r} ${r}`;
        else if (isBeforeOpen) borderRadius = `0 0 ${r} ${r}`;
        else if (isAfterOpen) borderRadius = `${r} ${r} 0 0`;

        return (
          <div key={i}
            className={`pro-item ${isOpen ? 'open' : ''}${visited.has(i) ? ' visited' : ''}`}
            data-dist={dist} style={{ borderRadius, cursor: isOpen ? 'pointer' : undefined }}
            onClick={isOpen ? () => onToggle(columnId, i) : undefined}>
            {isOpen && <div className="faq-glow"><span className="faq-glow-outer" /></div>}
            <button type="button" className="pro-btn"
              onClick={(e) => { e.stopPropagation(); onToggle(columnId, i); }}
              aria-expanded={isOpen}
              aria-controls={`faq-a-${columnId}-${i}`}
              id={`faq-q-${columnId}-${i}`}>
              <span className="pro-title">{item.q}</span>
              <div className="pro-icon-wrap">
                <div className="pro-icon-circle" />
                <svg className="pro-icon pro-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 12H20" /><path d="M14 6L20 12L14 18" />
                </svg>
                <svg className="pro-icon pro-icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M4 12.5L9.5 18L20 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>
            <div id={`faq-a-${columnId}-${i}`} className="pro-answer" role="region" aria-labelledby={`faq-q-${columnId}-${i}`}>
              <div className="pro-answer-inner">
                <div className="pro-answer-content" ref={(el) => storeRef(el, i)} dangerouslySetInnerHTML={{ __html: item.a }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}, (prev: FAQMorphingProProps, next: FAQMorphingProProps) =>
  prev.openIndex === next.openIndex &&
  prev.visited === next.visited &&
  prev.columnId === next.columnId &&
  prev.onToggle === next.onToggle
);


// --- ROOT ---

export default function FAQSection() {
  const [openCol, setOpenCol] = useState<ColumnId | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [visited, setVisited] = useState<{ left: Set<number>; right: Set<number> }>({
    left: new Set(),
    right: new Set(),
  });
  const abcRef = useRef<HTMLDivElement>(null);
  const popupShown = useRef(false);
  const burstCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLElement>(null);
  const gsapRefreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const burstAbortRef = useRef<{ aborted: boolean }>({ aborted: false });
  // WARN-01: cleanupRef usunięty — każdy useEffect ma własny return, GSAP → useGSAP

  // BLOCKER-04: registerPlugin wewnątrz useGSAP (BETON GSAP-SSR-01)
  // BLOCKER-05: ST.config() usunięte — należy do scrollRuntime
  // ABC scroll animation (ScrollTrigger scrub)
  useGSAP(() => {
    gsap.registerPlugin(ScrollTrigger);

    const wrap = abcRef.current;
    if (!wrap) return;

    // BLOCKER-05 REMOVED: ST.config({ ignoreMobileResize: true })
    // → skonsultuj z scrollRuntime czy jest już ustawione globalnie

    const mm = gsap.matchMedia();

    function initColumns(
      columns: NodeListOf<Element>,
      starts: string[],
      scrubVal: number,
    ) {
      const ownTriggers: (ScrollTrigger | null | undefined)[] = [];
      const refs = Array.from(columns)
        .map((col) => {
          const el = col as HTMLElement;
          const letterProxy = el.querySelector<HTMLElement>('.tc-letter-proxy');
          const takProxy = el.querySelector<HTMLElement>('.tc-tak-proxy');
          if (!letterProxy || !takProxy) return null;
          gsap.set(letterProxy, { xPercent: -50, yPercent: -50, scale: 6, autoAlpha: 0 });
          gsap.set(takProxy, { xPercent: -50, yPercent: -50, scale: 1, autoAlpha: 1 });
          return { col: el, letterProxy, takProxy };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      refs.forEach((r, idx) => {
        const startAt = starts[idx] ?? 'top 50%';
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: r.col, start: startAt, end: 'top 25%',
            scrub: scrubVal, invalidateOnRefresh: true, fastScrollEnd: true,
          }
        });
        ownTriggers.push(tl.scrollTrigger);
        tl.fromTo(r.letterProxy,
          { scale: 6, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 2, ease: 'power2.out', immediateRender: false }, 0
        ).fromTo(r.takProxy,
          { scale: 1, autoAlpha: 1 },
          { scale: 0.08, autoAlpha: 0, duration: 2, ease: 'power2.in', immediateRender: false }, -0.5
        );
      });
      return () => { ownTriggers.forEach((st) => st?.kill()); };
    }

    mm.add('(min-width: 600px)', () => {
      const cols = wrap.querySelectorAll('.tc-column');
      return initColumns(cols, ['top 56.9%', 'top 49.9%', 'top 42.8%'], 1.5);
    });

    mm.add('(max-width: 599px)', () => {
      const cols = wrap.querySelectorAll('.tc-column');
      return initColumns(cols, ['top 47.5%', 'top 47.5%', 'top 47.5%'], 1.2);
    });

    // BLOCKER-06: ScrollTrigger.refresh() → scrollRuntime.requestRefresh()
    scrollRuntime.requestRefresh('faq-abc-init');

    // WARN-01: brak push do cleanupRef — useGSAP auto-revertuje mm + wszystkie triggery
  }, { scope: abcRef });

  // --- POPUP: show with confetti burst ---
  const showFaqPopup = useCallback(() => {
    const overlay = overlayRef.current;
    const popup = popupRef.current;
    const canvasEl = burstCanvasRef.current;
    if (!overlay || !popup || !canvasEl) return;

    burstAbortRef.current.aborted = true;
    const burstToken = { aborted: false };
    burstAbortRef.current = burstToken;

    // Confetti burst from viewport center
    const ctxMaybe = canvasEl.getContext('2d');
    if (!ctxMaybe) {
      // Canvas unavailable — skip confetti, open popup normally
      setTimeout(() => {
        overlay.style.display = 'grid';
        requestAnimationFrame(() => overlay.classList.add('visible'));
        const pw = overlay.querySelector<HTMLElement>('.faq-popup-wrapper');
        if (pw) {
          pw.style.transform = 'scale(0.3)'; pw.style.opacity = '0';
          pw.style.transition = 'all 450ms cubic-bezier(0.22, 1, 0.36, 1)';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            pw.style.transform = 'scale(1)'; pw.style.opacity = '1';
          }));
        }
        popup.classList.add('faq-popup--animated');
      }, 180);
      setTimeout(() => overlay.classList.add('content-reveal'), 400);
      return;
    }
    const ctx = ctxMaybe;
    const cvs = canvasEl;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = window.innerWidth * dpr;
    cvs.height = window.innerHeight * dpr;
    cvs.style.width = `${window.innerWidth}px`;
    cvs.style.height = `${window.innerHeight}px`;
    cvs.style.display = 'block';
    ctx.scale(dpr, dpr);
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const COLORS = ['#fec708', '#fc7900', '#fd9b00', '#fa4900', '#298f61', '#8cd3b3'];
    const particles: BurstParticle[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 8;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#fec708';
      particles.push({ x: cx + (Math.random() - 0.5) * 120, y: cy + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 5, color,
        life: 1, decay: 0.015 + Math.random() * 0.01, gravity: 0.08, drag: 0.97 });
    }
    let running = true, frame = 0;
    function animateBurst() {
      if (burstToken.aborted || !running) return;
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      let alive = 0;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive++;
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.vx *= p.drag; p.vy *= p.drag; p.life -= p.decay;
        const r = p.size * Math.max(0, p.life);
        if (r <= 0) continue;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      frame++;
      if (!burstToken.aborted && alive > 0 && frame < 60) requestAnimationFrame(animateBurst);
      else {
        running = false;
        if (!burstToken.aborted) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, cvs.width, cvs.height);
          cvs.width = cvs.height = 1;
          cvs.style.width = ''; cvs.style.height = ''; cvs.style.display = 'none';
        }
      }
    }
    requestAnimationFrame(animateBurst);

    // Show overlay + popup scale-in
    setTimeout(() => {
      overlay.style.display = 'grid';
      requestAnimationFrame(() => overlay.classList.add('visible'));
      const pw = overlay.querySelector<HTMLElement>('.faq-popup-wrapper');
      if (pw) {
        pw.style.transform = 'scale(0.3)'; pw.style.opacity = '0';
        pw.style.transition = 'all 450ms cubic-bezier(0.22, 1, 0.36, 1)';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          pw.style.transform = 'scale(1)'; pw.style.opacity = '1';
        }));
      }
      popup.classList.add('faq-popup--animated');
    }, 180);
    setTimeout(() => overlay.classList.add('content-reveal'), 400);
  }, []);

  // --- POPUP: close ---
  const closeFaqPopup = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.classList.remove('visible', 'content-reveal');
    const pw = overlay.querySelector<HTMLElement>('.faq-popup-wrapper');
    if (pw) pw.style.cssText = '';
    const handler = () => {
      if (!overlay.classList.contains('visible')) overlay.style.display = 'none';
      overlay.removeEventListener('transitionend', handler);
    };
    overlay.addEventListener('transitionend', handler);
  }, []);

  // --- POPUP: tile reveal ---
  // WARN-01: tylko return — usunięty push do cleanupRef (double-cleanup fix)
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const handler = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const btn = t.closest('.faq-popup-btn');
      if (!(btn instanceof HTMLButtonElement)) return;
      const tileWrap = btn.closest('.faq-tile-wrap');
      if (!(tileWrap instanceof HTMLElement)) return;
      const id = tileWrap.dataset.tile ?? '';
      tileWrap.classList.add('chosen');
      overlay.querySelectorAll<HTMLElement>('.faq-tile-wrap').forEach((tw) => {
        if (tw.dataset.tile !== id) tw.classList.add('dimmed');
      });
      overlay.querySelectorAll<HTMLButtonElement>('.faq-popup-btn').forEach((b) => {
        if (b !== btn) { b.disabled = true; b.textContent = 'Niedostępne'; }
      });
    };
    overlay.addEventListener('click', handler);
    return () => overlay.removeEventListener('click', handler);
  }, []);

  const handleToggle = (col: ColumnId, i: number) => {
    // Kopiuj tylko Set który faktycznie się zmienia — drugi przekazuj przez referencję
    const closingCol = openCol;
    const closingIdx = openIdx;
    const isClosing = closingCol === col && closingIdx === i;

    if (closingCol !== null && closingIdx !== null) {
      setVisited(prev => {
        if (closingCol === 'left') {
          const next = new Set(prev.left);
          next.add(closingIdx);
          return { left: next, right: prev.right };
        } else {
          const next = new Set(prev.right);
          next.add(closingIdx);
          return { left: prev.left, right: next };
        }
      });
    }

    if (isClosing) { setOpenCol(null); setOpenIdx(null); }
    else { setOpenCol(col); setOpenIdx(i); }

    // BLOCKER-06: ScrollTrigger sync po zakończeniu animacji akordeonu (--faq-speed: 0.9s)
    // window.ScrollTrigger.refresh() → scrollRuntime.requestRefresh()
    const prevTimer = gsapRefreshTimer.current;
    if (prevTimer !== undefined) clearTimeout(prevTimer);
    gsapRefreshTimer.current = setTimeout(
      () => scrollRuntime.requestRefresh('faq-accordion-toggle'),
      950
    );

    // Check: opening the LAST unread item
    if (!isClosing && !popupShown.current) {
      const leftSize = visited.left.size + (openCol === 'left' && openIdx !== null ? 1 : 0);
      const rightSize = visited.right.size + (openCol === 'right' && openIdx !== null ? 1 : 0);
      const totalVisited = leftSize + rightSize;
      const isAlreadyVisited = col === 'left' ? visited.left.has(i) : visited.right.has(i);
      if (totalVisited >= TOTAL_FAQ - 1 && !isAlreadyVisited) {
        popupShown.current = true;
        setTimeout(() => showFaqPopup(), 1200);
      }
    }
  };

  // Central cleanup — uproszczony po migracji
  // WARN-01: GSAP cleanup → useGSAP (auto), events → ich własne useEffect returns
  // Tu zostaje tylko timer (nie ma swojego useEffect return)
  useEffect(() => {
    return () => {
      const t = gsapRefreshTimer.current;
      if (t !== undefined) clearTimeout(t);
      burstAbortRef.current.aborted = true;
    };
  }, []);

  return (
    // WARN-02: FontLinks usunięty — fonty przez next/font/google w layout.tsx
    // WARN-03: Styles usunięty — CSS w ./faq-section.css
    <section id="faq-section">
      <div className="faq-section-lead">
        <h2 className="faq-section-lead__title">
          <span className="faq-section-lead__strong">Budżety, z którymi pracujemy.</span>
          <span className="faq-section-lead__light">Dwa zespoły. Jeden standard.</span>
        </h2>
      </div>
      <canvas id="faq-burstCanvas" ref={burstCanvasRef} />
      <div className="faq-header">
        <div className="faq-header-col">
          <h2>Realizacje<br/><span>strategiczne</span></h2>
          <p>Rozwiązania dla firm, dla których strona to narzędzie wzrostu — Tworzy zespół z najdłuższym stażem. Spersonalizowaną ofertę budujemy po zdefiniowaniu 3 obszarów:</p>
          <div className="faq-price-row"><div className="faq-price-block"><strong>1. Zakres prac</strong></div><div className="faq-price-block"><strong>2. Poziom wykonania</strong></div><div className="faq-price-block"><strong>3. Tempo</strong></div></div>
        </div>
        <div className="faq-header-col">
          <h2>Mikro firmy,<br/><span>i małe projekty.</span></h2>
          <p>Tworzymy świetną stronę i bierzemy ją pod stałą opiekę. Zdejmujemy Ci z głowy obowiązki związane z utrzymaniem. Kwestie techniczne i wdrażanie zmian masz w opiece.</p>
          <div className="faq-price-row">
            <div className="faq-price-block">
              <strong>Ceny od: 299zł /mc</strong>
              <small>dla subskrypcji– 36mcy.</small>
            </div>
            <div className="faq-price-block">
              <strong>ok: 9.420 zł / (Jednorazowo)</strong>
              <small>Bez subskrypcji.</small>
            </div>
          </div>
        </div>
      </div>
      <div className="faq-grid">
        <FAQMorphingPro data={faqDataLeft} columnId="left"
          openIndex={openCol === 'left' ? openIdx : null} onToggle={handleToggle} visited={visited.left} />
        <FAQMorphingPro data={faqDataRight} columnId="right"
          openIndex={openCol === 'right' ? openIdx : null} onToggle={handleToggle} visited={visited.right} />
      </div>
      <div className="faq-divider" />
      <div className="tc-grid" ref={abcRef}>
        {abcData.map((col, i) => (
          <div className="tc-column" key={i}>
            <div className="tc-letter-proxy"><span className="tc-letter">{col.letter}</span></div>
            <div className="tc-tak-proxy"><span className="tc-tak">TAK</span></div>
            <div className="tc-text-wrapper">
              <p className="tc-text" dangerouslySetInnerHTML={{ __html: col.text }} />
            </div>
          </div>
        ))}
      </div>
      {/* POPUP OVERLAY */}
      <div
        className="faq-overlay"
        ref={overlayRef}
        onClick={(e) => {
          if (e.target === overlayRef.current) closeFaqPopup();
        }}
      >
        <div className="faq-popup-wrapper">
          <button className="faq-close" onClick={closeFaqPopup} aria-label="Zamknij">✕</button>
          <section className="faq-popup" ref={popupRef}>
            <div className="faq-popup-inner">
              <div className="faq-burst-bg">
                <div className="faq-burst-container">
                  <div className="faq-burst-ripple faq-burst-ripple--1" />
                  <div className="faq-burst-ripple faq-burst-ripple--2" />
                  <div className="faq-burst-ripple faq-burst-ripple--3" />
                  <div className="faq-burst-ripple faq-burst-ripple--4" />
                </div>
              </div>
              <div className="faq-content">
                <div className="faq-hero">
                  <div className="faq-heading">
                    <span className="faq-heading-light">Wybierz swój powód, <span className="faq-heading-br" />by zatrzymać klientów <span className="faq-heading-br" /><strong>na nowej owocnej stronie.</strong></span>
                  </div>
                  <p className="faq-subtitle">Odbierz swój kod — możesz odsłonić&nbsp;jeden.</p>
                </div>
                <div className="faq-popup-divider"><span className="faq-divider-diamond">◆</span></div>
                <div className="faq-tiles">
                  <div className="faq-tile-wrap" data-tile="1">
                    <article className="faq-tile">
                      <div className="faq-tile-label">Konkretny rabat</div>
                      <div className="faq-tile-desc">Obniżamy końcową fakturę o&nbsp;kwotę.</div>
                      <div className="faq-tile-bottom">
                        <div className="faq-tile-value">750 zł</div>
                        <button className="faq-popup-btn" data-reveal="1">Zobacz kod</button>
                        <div className="faq-codebox">Przy wycenie podaj kod: <span>"Zostają 750"</span></div>
                      </div>
                    </article>
                  </div>
                  <div className="faq-tile-wrap" data-tile="2">
                    <article className="faq-tile">
                      <div className="faq-tile-label">SOCIAL MEDIA PACK</div>
                      <div className="faq-tile-desc">Profile firmowe — spójne z&nbsp;nową stroną.</div>
                      <div className="faq-tile-bottom">
                        <div className="faq-tile-value">"WOW!"</div>
                        <button className="faq-popup-btn" data-reveal="2">Zobacz kod</button>
                        <div className="faq-codebox">Przy wycenie podaj kod: <span>"Zostają sociale"</span></div>
                      </div>
                    </article>
                  </div>
                </div>
                <div className="faq-bottom-close">
                  <button className="faq-bottom-close-btn" onClick={closeFaqPopup}><span className="faq-x-icon">✕</span> Zamknij</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
