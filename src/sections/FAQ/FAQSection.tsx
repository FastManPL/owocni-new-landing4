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
import { scrollRuntime } from '@/lib/scroll-runtime';
import './faq-section.css';

// --- DATA ---
const faqDataLeft = [
  { q: "Jak rozpocząć współpracę?", a: `Wszystko zaczyna się od <strong>warsztatu strategicznego</strong> z naszym zespołem.<br>Niezwłocznie po podpisaniu umowy.<br><br><strong>Na warsztacie:</strong><br>• Doprecyzowujemy harmonogram i Twoje oczekiwania<br>• Definiujemy cele, KPI i zakres projektu<br>• Sprawdzamy, czy "mamy do siebie chemię"<br><br><strong>Kluczowe:</strong> Po pierwszym warsztacie zdecydujemy wspólnie, czy "jest między nami chemia" — jeśli to nie będzie to czego oczekujesz, możesz natychmiast rozwiązać umowę bez żadnych kosztów. A my pokryjemy koszty przygotowań.<br><br>Projekt startujemy z reguły w ciągu <strong>3 dni roboczych</strong> od podpisania umowy.<br><br>Prosto i bez ryzyka.` },
  { q: "Jak przebiega proces realizacji?", a: `Jeśli idzie o Twoje zaangażowanie, jest ono <strong>minimalne</strong>.<br><br>Cała realizacja sprowadza się do:<br>• Maksymalnie 2 spotkań (warsztaty strategiczne po ~1,5h każdy)<br>• Zgłaszanie uwag i sugestii do przygotowywanych projektów<br><br>Resztę zrobimy za Ciebie w 3 etapach.<br><br><strong>Etap 1: UX & Copywriting</strong> (tydzień 1-3)<br>Analiza konkurencji + profil klienta + klikalny prototyp<br><br><strong>Etap 2: Design</strong> (tydzień 3-5)<br>Projektowanie wizualne + hierarchia elementów<br><br><strong>Etap 3: Wdrożenie</strong> (tydzień 5-8)<br>Programowanie + testy + szkolenie z panelu` },
  { q: "Co przygotować do współpracy?", a: `Musisz wiedzieć tylko <strong>CO chcesz oferować światu</strong>.<br>Resztę wypracujemy razem z zespołem specjalistów.<br><br>Na warsztatach strategicznych wydobędziemy od Ciebie potrzebne informacje, przejrzymy liderów w branży i ustalimy strategię konkurowania.<br><br>Materiały wizualne potrzebne są dopiero w etapie 3 (design). Możemy śmiało zaczynać bez nich — będziesz miał czas się przygotować.<br><br>Z reguły są to:<br>• Logotypy i materiały identyfikacyjne (jeśli istnieją)<br>• Zdjęcia produktów/zespołu (jeśli będą potrzebne)` },
  { q: "Jak wygląda opieka po starcie?", a: `W okresie rozruchowym możesz liczyć na nasze <strong>pełne wsparcie</strong>.<br>Wsparcie techniczne. Szkolenia wideo z obsługi. Wyjaśnienia.<br><br>W długim dystansie posiadamy różne modele opieki. Włącznie z reakcją <strong>24/7</strong>.<br><br>Opieka 24/7 oznacza, że jeśli coś wymaga natychmiastowej reakcji — odbierzemy to nawet w niedzielę w nocy i zareagujemy w ciągu godziny.<br><br>Plany opieki tworzymy indywidualnie w zależności od potrzeb:<br>• Backupy, aktualizacje bezpieczeństwa<br>• Monitoring i naprawa awarii<br>• Pomoc z certyfikatami, domeną, pocztą<br>• I wszystko czego potrzebujesz by się nie martwić<br><br>Zazwyczaj jest to spokój ducha w cenie dobrego obiadu.` },
];

const faqDataRight = [
  { q: "Co jeśli projekt się opóźni?", a: `<strong>Termin to nasza najważniejsza wartość.</strong><br>Dlatego ustalony harmonogram jest dla nas święty.<br><br>Zarządzamy kilkoma projektami jednocześnie, więc precyzyjnie planujemy każdy krok od samego startu.<br><br>Aby zapewnić Ci poczucie bezpieczeństwa, nasza umowa przewiduje <strong>konkretne kary finansowe</strong> za każdy dzień opóźnienia z naszej strony.<br><br>Wierzymy, że rzeczy zrobione bez wysiłku, oglądają się bez przyjemności. Dlatego nie przyjmujemy wyzwań krótszych niż 30 dni.<br><br>Możesz czuć się bezpiecznie.` },
  { q: "Czy gwarancja zawsze działa?", a: `Są dwa przypadki, kiedy nie możemy zagwarantować wzrostu:<br><br><strong>Przypadek 1. Startujesz z nową stroną</strong> (brak punktu odniesienia)<br>Nie mamy starej wersji do porównania, więc nie możemy przeprowadzić testów A/B. Jednak nawet nad nową stroną pracuje ten sam zespół ekspertów. Dlatego otrzymasz cały know-how i najlepsze praktyki nawet jeśli to będzie nowa marka.<br><br><strong>Przypadek 2. Za mało danych do pomiaru statystycznego</strong><br>Jeśli rzucisz kostką 10 razy i szóstka wypadnie 6 razy — to nie znaczy, że kostka jest magiczna. Potrzebujemy odpowiedniej liczby zdarzeń, aby mieć statystyczną pewność, że nasza praca faktycznie podniosła konwersję.` },
  { q: "Jesteście drożsi od konkurencji?", a: `Dobrze, że chcesz to zobaczyć. Najlepiej widać to w liczbach.<br><br>Różnica między pojedynczym młodym freelancerem, a dojrzałym zespołem — to różnica między <strong>dziesięcioma zapytaniami a czterdziestoma</strong> z tej samej liczby odwiedzin strony.<br><br>Uzyskanie wysokich zwrotów z inwestycji to zadanie dla całego zespołu.<br><br>W Owocnych otrzymujesz ten sam proces. Te same kompetencje. I ten sam zespół, który realizuje duże giełdowe projekty w kwotach często przekraczających 100.000 zł, za ułamek tej ceny.<br><br>Oszczędności rzędu kilku tysięcy złotych na starcie potrafią zmienić się w kilkadziesiąt, czy nawet kilkaset tysięcy złotych strat rocznie.<br><br><strong>Prawdziwa cena to zwrot z inwestycji w czasie.</strong>` },
];

const sineDelay = (i, n) => {
  const norm = i / Math.max(n - 1, 1);
  return norm * 0.38 + Math.sin(norm * Math.PI) * 0.08;
};

// --- ABC DATA ---
const abcData = [
  { letter: '3', text: '<strong>Nie masz<br>czasu</strong> się tym<br>zajmować.' },
  { letter: '2', text: 'Ale chcesz, by<br>ktoś wziął to<br>na siebie.' },
  { letter: '1', text: 'Tak, aby było<br>to <strong>zrobione<br>porządnie.</strong>' },
];

// --- GSAP ANIMATIONS (gsap importowany bezpośrednio, bez parametru) ---
// WARN-05: gsapRef singleton usunięty — gsap dostępny z importu
function enterFS2(el) {
  const parent = el.parentElement;
  gsap.set(parent, { perspective: 1200 });
  gsap.set(el, { clipPath: 'inset(0 0 100% 0)', rotationX: -56, opacity: 0, transformOrigin: 'top center' });
  const tl = gsap.timeline();
  tl.to(el, { clipPath: 'inset(0 0 -10% 0)', duration: 0.82, ease: 'power2.out' }, 0);
  tl.to(el, { opacity: 1, duration: 0.25, ease: 'power1.in' }, 0.07);
  tl.to(el, { rotationX: 0, duration: 0.82, ease: 'power3.out' }, 0);
  return tl;
}

function leaveFS2(el) {
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
const FAQMorphingPro = React.memo(({ data, columnId, openIndex, onToggle, visited }) => {
  const wrapperRef = useRef(null);
  const contentRefs = useRef({});
  const prevOpenRef = useRef(null);

  // Pointer tracking refs
  const cachedRect = useRef(null);
  const cachedGlow = useRef(null);
  const lastAngle = useRef(-1);
  const lastEdge = useRef(-1);
  const rafPending = useRef(false);
  const rafFrameCount = useRef(0);
  const pointerPos = useRef({ x: 0, y: 0 });

  // WARN-05: gsapRef + loadGsap useEffect usunięte — gsap importowany bezpośrednio

  // Sine wave entrance (IO-driven — nie GSAP context, własny cleanup)
  useEffect(() => {
    const w = wrapperRef.current;
    if (!w) return;
    const items = w.querySelectorAll('.pro-item');
    const n = items.length;
    const timers = [];
    items.forEach(el => el.classList.add('faq-hidden'));
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
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
    return () => { timers.forEach(t => clearTimeout(t)); obs.disconnect(); };
  }, []);

  const storeRef = useCallback((el, i) => {
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

    // Kill glow na wszystkich items (bulletproof reset)
    if (w) {
      w.querySelectorAll('.faq-glow').forEach(g => g.style.setProperty('--glow-int', '0'));
    }

    // Zamknij poprzedni item + circle ripple
    if (prev !== null && prev !== curr) {
      const el = contentRefs.current[`${columnId}-${prev}`];
      if (el) leaveFS2(el);
      if (w) {
        const cir = w.querySelectorAll('.pro-item')[prev]?.querySelector('.pro-icon-circle');
        if (cir) {
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
      const el = contentRefs.current[`${columnId}-${curr}`];
      // Bez rAF — w useGSAP DOM jest już zaktualizowany (timing jak useEffect)
      if (el) enterFS2(el);
      if (w) {
        const currItem = w.querySelectorAll('.pro-item')[curr];
        const currGlow = currItem?.querySelector('.faq-glow');
        if (currGlow) {
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
    const enterHandler = (e) => {
      const item = e.target.closest('.pro-item');
      if (item && item.classList.contains('open')) {
        cachedRect.current = item.getBoundingClientRect();
        cachedGlow.current = item.querySelector('.faq-glow');
      }
    };

    // Invalidate tylko na resize (scroll nie wpływa na dx/dy relatywne do centrum)
    const invalidateRect = () => { cachedRect.current = null; cachedGlow.current = null; };

    const processGlow = () => {
      rafPending.current = false;
      // Frame skipper: co 2-gi frame = ~30fps zamiast ~60fps
      rafFrameCount.current = (rafFrameCount.current + 1) % 2;
      if (rafFrameCount.current !== 0) {
        rafPending.current = true;
        requestAnimationFrame(processGlow);
        return;
      }
      const item = wrapper.querySelector('.pro-item.open');
      if (!item) return;
      const glow = cachedGlow.current || item.querySelector('.faq-glow');
      if (!glow) return;

      if (!cachedRect.current) cachedRect.current = item.getBoundingClientRect();
      const rect = cachedRect.current;

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

    const handler = (e) => {
      const item = e.target.closest('.pro-item');
      if (!item || !item.classList.contains('open')) return;
      pointerPos.current.x = e.clientX;
      pointerPos.current.y = e.clientY;
      if (!rafPending.current) {
        rafPending.current = true;
        requestAnimationFrame(processGlow);
      }
    };

    wrapper.addEventListener('pointerenter', enterHandler, true);
    wrapper.addEventListener('pointermove', handler);
    window.addEventListener('resize', invalidateRect);
    return () => {
      wrapper.removeEventListener('pointerenter', enterHandler, true);
      wrapper.removeEventListener('pointermove', handler);
      window.removeEventListener('resize', invalidateRect);
    };
  }, []);

  // Font weight hover animation (GSAP numeric proxy dla płynnej interpolacji wght)
  useEffect(() => {
    const w = wrapperRef.current;
    if (!w) return;
    const btns = w.querySelectorAll('.pro-btn');
    const tweens = new Map();
    const weights = new Map();

    const animateWeight = (title, target) => {
      // WARN-05: gsap importowany bezpośrednio, bez gsapRef.current
      if (tweens.has(title)) tweens.get(title).kill();
      if (!weights.has(title)) weights.set(title, { v: 400 });
      const obj = weights.get(title);
      tweens.set(title, gsap.to(obj, {
        v: target, duration: 0.4, ease: 'power2.out',
        onUpdate: () => { title.style.fontVariationSettings = `'wght' ${obj.v}`; }
      }));
    };

    const enter = (e) => {
      const title = e.currentTarget.querySelector('.pro-title');
      if (title) animateWeight(title, 600);
    };
    const leave = (e) => {
      const title = e.currentTarget.querySelector('.pro-title');
      if (!title) return;
      const item = e.currentTarget.closest('.pro-item');
      if (item && item.classList.contains('open')) return;
      animateWeight(title, 400);
    };

    btns.forEach(btn => {
      btn.addEventListener('mouseenter', enter);
      btn.addEventListener('mouseleave', leave);
    });
    return () => {
      btns.forEach(btn => {
        btn.removeEventListener('mouseenter', enter);
        btn.removeEventListener('mouseleave', leave);
      });
      tweens.forEach(t => t.kill());
    };
  }, []);

  return (
    <div className="faq-wrapper faq-morphing-pro" ref={wrapperRef}>
      {data.map((item, i) => {
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
}, (prev, next) =>
  prev.openIndex === next.openIndex &&
  prev.visited === next.visited &&
  prev.columnId === next.columnId &&
  prev.onToggle === next.onToggle
);


// --- ROOT ---
const TOTAL_FAQ = faqDataLeft.length + faqDataRight.length;

export default function FAQSection() {
  // --- DEV GATE ---
  const DEBUG_MODE = typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('debug') ||
     localStorage.getItem('debug') === '1');

  // --- getScroll helper (reguła 13.2: scrollRuntime.getScroll()) ---
  // WARN-07: zaktualizowany z window.lenis → scrollRuntime.getScroll()
  const getScroll = () => scrollRuntime.getScroll();

  const [openCol, setOpenCol] = useState(null);
  const [openIdx, setOpenIdx] = useState(null);
  const [visited, setVisited] = useState({ left: new Set(), right: new Set() });
  const abcRef = useRef(null);
  const popupShown = useRef(false);
  const burstCanvasRef = useRef(null);
  const overlayRef = useRef(null);
  const popupRef = useRef(null);
  const gsapRefreshTimer = useRef(null);
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

    function initColumns(columns, starts, scrubVal) {
      const ownTriggers = [];
      const refs = Array.from(columns).map((col) => {
        const letterProxy = col.querySelector('.tc-letter-proxy');
        const takProxy = col.querySelector('.tc-tak-proxy');
        gsap.set(letterProxy, { xPercent: -50, yPercent: -50, scale: 6, autoAlpha: 0 });
        gsap.set(takProxy, { xPercent: -50, yPercent: -50, scale: 1, autoAlpha: 1 });
        return { col, letterProxy, takProxy };
      });
      refs.forEach((r, idx) => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: r.col, start: starts[idx], end: 'top 25%',
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
      return () => { ownTriggers.forEach(st => st.kill()); };
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
    const canvas = burstCanvasRef.current;
    if (!overlay || !popup || !canvas) return;

    // Confetti burst from viewport center
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Canvas unavailable — skip confetti, open popup normally
      setTimeout(() => {
        overlay.style.display = 'grid';
        requestAnimationFrame(() => overlay.classList.add('visible'));
        const pw = overlay.querySelector('.faq-popup-wrapper');
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    canvas.style.display = 'block';
    ctx.scale(dpr, dpr);
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const COLORS = ['#fec708', '#fc7900', '#fd9b00', '#fa4900', '#298f61', '#8cd3b3'];
    const particles = [];
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 8;
      particles.push({ x: cx + (Math.random() - 0.5) * 120, y: cy + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 5, color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1, decay: 0.015 + Math.random() * 0.01, gravity: 0.08, drag: 0.97 });
    }
    let running = true, frame = 0;
    function animateBurst() {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      if (alive > 0 && frame < 60) requestAnimationFrame(animateBurst);
      else {
        running = false;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = canvas.height = 1;
        canvas.style.width = ''; canvas.style.height = ''; canvas.style.display = 'none';
      }
    }
    requestAnimationFrame(animateBurst);

    // Show overlay + popup scale-in
    setTimeout(() => {
      overlay.style.display = 'grid';
      requestAnimationFrame(() => overlay.classList.add('visible'));
      const pw = overlay.querySelector('.faq-popup-wrapper');
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
    const pw = overlay.querySelector('.faq-popup-wrapper');
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
    const handler = (e) => {
      const btn = e.target.closest('.faq-popup-btn');
      if (!btn) return;
      const tileWrap = btn.closest('.faq-tile-wrap');
      if (!tileWrap) return;
      const id = tileWrap.dataset.tile;
      tileWrap.classList.add('chosen');
      overlay.querySelectorAll('.faq-tile-wrap').forEach(tw => {
        if (tw.dataset.tile !== id) tw.classList.add('dimmed');
      });
      overlay.querySelectorAll('.faq-popup-btn').forEach(b => {
        if (b !== btn) { b.disabled = true; b.textContent = 'Niedostępne'; }
      });
    };
    overlay.addEventListener('click', handler);
    return () => overlay.removeEventListener('click', handler);
  }, []);

  const handleToggle = (col, i) => {
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
    clearTimeout(gsapRefreshTimer.current);
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
      clearTimeout(gsapRefreshTimer.current);
    };
  }, []);

  return (
    // WARN-02: FontLinks usunięty — fonty przez next/font/google w layout.tsx
    // WARN-03: Styles usunięty — CSS w ./faq-section.css
    <section id="faq-section">
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
      <div className="faq-overlay" ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) closeFaqPopup(); }}>
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
